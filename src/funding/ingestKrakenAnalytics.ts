// Build 046 data: ingest Kraken's analytics funding series for older history, but ONLY after validating it
// against the settled rates already stored (FUND046-KRAKEN, from `npm run ingest:funding`).
//
// Per instrument:
//   1. Fetch hourly analytics candles from the listing date to now (public, no credentials).
//   2. Compare every OHLC field and hour offset with the settled rates over the overlapping period.
//   3. If the best combination matches >= 99% of >= 180 days of overlapping hours, store the full series
//      under FUND046-KRAKEN-AN with the chosen field, offset and match rate in the source tag.
//      Otherwise store nothing for that instrument and fail the job.
// Idempotent (existing rows never overwritten) with read-back reconciliation; raw snapshot + SHA-256 published.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { db } from "../db.js";
import { loadStored } from "./completenessJob.js";
import { INSTRUMENTS, VENUE, completeness } from "./kraken.js";
import { ANALYTICS_BASE, ANALYTICS_SENSOR, VALIDATION_GATE, parseAnalytics, toFundingRows, validate, type Candle } from "./krakenAnalytics.js";

const LISTED: Record<string, string> = { PF_XBTUSD: "2022-03-22", PF_ETHUSD: "2022-03-22", PF_SOLUSD: "2022-06-13" };
const WINDOW_S = 60 * 86400, BATCH = 1000, PAGE = 1000;
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function getJson(url: string) {
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(url, { headers: { "User-Agent": "5k-machine-research/046 (historical funding ingest)" } });
    const text = await r.text();
    if (r.ok) return { text, body: JSON.parse(text) };
    if ((r.status === 429 || r.status >= 500) && attempt < 5) { await sleep(2000 * 2 ** attempt); continue; }
    throw new Error(`HTTP ${r.status} from Kraken analytics for ${url} (${text.slice(0, 200)}). Not retrying via other routes.`);
  }
}

async function fetchAll(symbol: string) {
  const start = Math.floor(Date.parse(LISTED[symbol] + "T00:00:00Z") / 1000) - 86400, end = Math.floor(Date.now() / 1000);
  const candles = new Map<number, Candle>(), pages: { url: string; sha256: string; bytes: number; candles: number; more: boolean }[] = [];
  for (let since = start; since < end; ) {
    const to = Math.min(end, since + WINDOW_S);
    const url = `${ANALYTICS_BASE}/${encodeURIComponent(symbol)}/funding?since=${since}&to=${to}&interval=3600`;
    const { text, body } = await getJson(url);
    const { candles: cs, more } = parseAnalytics(body, symbol);
    pages.push({ url, sha256: createHash("sha256").update(text).digest("hex"), bytes: text.length, candles: cs.length, more });
    for (const c of cs) candles.set(c.t, c);
    // If the window was truncated, continue from the last candle; otherwise move to the next window.
    const lastT = cs.length ? Math.floor(cs[cs.length - 1].t / 1000) : null;
    since = more && lastT != null && lastT + 3600 > since ? lastT + 3600 : to;
    if (pages.length > 2000) throw new Error(`${symbol}: too many pages`);
    await sleep(150);
  }
  return { candles: [...candles.values()].sort((a, b) => a.t - b.t), pages };
}

async function storedMap(instrument: string) {
  const m = new Map<string, number>();
  for (let f = 0; ; f += PAGE) {
    const { data, error } = await db.from("derivatives_observations").select("observed_at,funding_rate")
      .eq("venue", VENUE).eq("instrument", instrument).eq("sensor_version", ANALYTICS_SENSOR)
      .order("observed_at", { ascending: true }).range(f, f + PAGE - 1);
    if (error) throw error;
    for (const r of data ?? []) m.set(new Date(r.observed_at).toISOString(), Number(r.funding_rate));
    if ((data ?? []).length < PAGE) break;
  }
  return m;
}

async function main() {
  const fetchedAt = new Date().toISOString(), raw: Record<string, Candle[]> = {}, manifest: any[] = [], results: any[] = [];
  let failed = false;
  for (const { asset, instrument } of INSTRUMENTS) {
    const { candles, pages } = await fetchAll(instrument);
    raw[instrument] = candles;
    manifest.push({ instrument, fetchedAt, pages });
    const settled = await loadStored(instrument);
    const ranking = validate(candles, settled), best = ranking[0];
    const accepted = !!best && best.overlap >= VALIDATION_GATE.minOverlapHours && best.matchRate >= VALIDATION_GATE.minMatchRate;
    const cov = completeness(candles.map((c) => ({ t: c.t, relative: c.c })));
    const res: any = { asset, instrument, analyticsCandles: candles.length, analyticsFirst: cov.first, analyticsLast: cov.last, analyticsCoverageDays: cov.coverageDays,
      settledRowsForValidation: settled.length, validationTop3: ranking.slice(0, 3), gate: VALIDATION_GATE, accepted };
    if (accepted) {
      const rows = toFundingRows(candles, best), tag = `kraken_futures_charts_v1_analytics_funding|rate=relativeRate.${best.field},fraction_per_period|interval=1h|ts=period_start_utc(offset ${best.offsetHours}h applied)|sign=positive_paid_to_shorts|validated_vs=FUND046-KRAKEN,match=${(best.matchRate * 100).toFixed(2)}%,overlap=${best.overlap}h`;
      const before = await storedMap(instrument), fresh = rows.filter((r) => !before.has(new Date(r.t).toISOString()));
      for (let i = 0; i < fresh.length; i += BATCH) {
        const payload = fresh.slice(i, i + BATCH).map((r) => ({ observed_at: new Date(r.t).toISOString(), venue: VENUE, asset, instrument, funding_rate: r.relative, source: tag, sensor_version: ANALYTICS_SENSOR }));
        const { error } = await db.from("derivatives_observations").upsert(payload, { onConflict: "observed_at,venue,instrument,sensor_version", ignoreDuplicates: true });
        if (error) throw error;
      }
      const after = await storedMap(instrument);
      let missing = 0, mismatches = 0;
      for (const r of rows) { const v = after.get(new Date(r.t).toISOString()); if (v == null) missing++; else if (Math.abs(v - r.relative) > 1e-12) mismatches++; }
      Object.assign(res, { sourceTag: tag, newRowsWritten: fresh.length, storedRowsAfter: after.size, missingAfterWrite: missing, valueMismatchesVsStored: mismatches });
      if (missing) failed = true;
    } else {
      failed = true;
      res.reason = !best || best.overlap < VALIDATION_GATE.minOverlapHours ? `overlap ${best?.overlap ?? 0}h < ${VALIDATION_GATE.minOverlapHours}h` : `best match rate ${(best.matchRate * 100).toFixed(2)}% < ${VALIDATION_GATE.minMatchRate * 100}%`;
    }
    results.push(res);
    console.error(JSON.stringify(res));
  }
  writeFileSync("kraken-funding-analytics-raw.json.gz", gzipSync(JSON.stringify({ fetchedAt, source: ANALYTICS_BASE, raw })));
  writeFileSync("kraken-funding-analytics-manifest.json", JSON.stringify({ fetchedAt, sensorVersion: ANALYTICS_SENSOR, files: manifest }, null, 2));
  console.log(JSON.stringify({ ok: !failed, build: "046-data", series: ANALYTICS_SENSOR, fetchedAt, results, authorizedToTrade: false }, null, 2));
  if (failed) process.exitCode = 1;
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
