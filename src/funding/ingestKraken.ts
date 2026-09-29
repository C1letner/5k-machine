// Build 046 data: one-time (re-runnable) ingestion of Kraken Futures historical funding into Supabase.
// Contacts Kraken ONLY here. Research jobs read the stored rows and never call an exchange.
//
// - Public endpoint, no credentials. If Kraken refuses the runner (403/451 etc.), this job fails and
//   reports it; it does not retry through other routes.
// - Idempotent: rows are upserted on (observed_at, venue, instrument, sensor_version) and existing rows
//   are never overwritten. A read-back reconciliation reports any stored value that differs from the
//   freshly fetched value, instead of silently changing history.
// - Provenance: the raw API responses are saved (gzip) with a SHA-256 manifest, published with the report.
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { db } from "../db.js";
import { INSTRUMENTS, KRAKEN_BASE, SENSOR_VERSION, SOURCE_TAG, VENUE, completeness, parseResponse, type FundingRow } from "./kraken.js";

const BATCH = 1000, PAGE = 1000;

async function fetchSymbol(symbol: string) {
  const url = `${KRAKEN_BASE}?symbol=${encodeURIComponent(symbol)}`;
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(url, { headers: { "User-Agent": "5k-machine-research/046 (historical funding ingest)" } });
    const text = await r.text();
    if (r.ok) return { url, text, body: JSON.parse(text) };
    if ((r.status === 429 || r.status >= 500) && attempt < 5) { await new Promise((s) => setTimeout(s, 2000 * 2 ** attempt)); continue; }
    throw new Error(`${symbol}: HTTP ${r.status} from Kraken (${text.slice(0, 200)}). Not retrying via other routes.`);
  }
}

async function stored(instrument: string) {
  const out = new Map<string, number>();
  for (let f = 0; ; f += PAGE) {
    const { data, error } = await db.from("derivatives_observations").select("observed_at,funding_rate")
      .eq("venue", VENUE).eq("instrument", instrument).eq("sensor_version", SENSOR_VERSION)
      .order("observed_at", { ascending: true }).range(f, f + PAGE - 1);
    if (error) throw error;
    for (const r of data ?? []) out.set(new Date(r.observed_at).toISOString(), Number(r.funding_rate));
    if ((data ?? []).length < PAGE) break;
  }
  return out;
}

async function main() {
  const fetchedAt = new Date().toISOString();
  const raw: Record<string, unknown> = {}, manifest: any[] = [], results: any[] = [];
  for (const { asset, instrument } of INSTRUMENTS) {
    const { url, text, body } = await fetchSymbol(instrument);
    raw[instrument] = body;
    manifest.push({ instrument, url, fetchedAt, bytes: text.length, sha256: createHash("sha256").update(text).digest("hex"), serverTime: body?.serverTime ?? null });
    const rows: FundingRow[] = parseResponse(body, instrument);
    const before = await stored(instrument);
    const fresh = rows.filter((r) => !before.has(r.iso));
    for (let i = 0; i < fresh.length; i += BATCH) {
      const payload = fresh.slice(i, i + BATCH).map((r) => ({ observed_at: r.iso, venue: VENUE, asset, instrument, funding_rate: r.relative, source: SOURCE_TAG, sensor_version: SENSOR_VERSION }));
      const { error } = await db.from("derivatives_observations").upsert(payload, { onConflict: "observed_at,venue,instrument,sensor_version", ignoreDuplicates: true });
      if (error) throw error;
    }
    const after = await stored(instrument);
    // The funding_rate column stores 12 decimal places, so compare at that precision.
    let mismatches = 0, missingAfter = 0;
    const examples: any[] = [];
    for (const r of rows) {
      const v = after.get(r.iso);
      if (v == null) { missingAfter++; continue; }
      if (Math.abs(v - r.relative) > 1e-12) { mismatches++; if (examples.length < 5) examples.push({ t: r.iso, stored: v, fetched: r.relative }); }
    }
    const c = completeness(rows);
    results.push({ asset, instrument, fetchedRows: rows.length, newRowsWritten: fresh.length, storedRowsAfter: after.size, missingAfterWrite: missingAfter, valueMismatchesVsStored: mismatches, mismatchExamples: examples, fetchedFirst: c.first, fetchedLast: c.last, fetchedCoverageDays: c.coverageDays });
    console.error(JSON.stringify(results.at(-1)));
    if (missingAfter) throw new Error(`${instrument}: ${missingAfter} fetched rows not found in the database after writing`);
  }
  writeFileSync("kraken-funding-raw.json.gz", gzipSync(JSON.stringify({ fetchedAt, source: KRAKEN_BASE, raw })));
  writeFileSync("kraken-funding-manifest.json", JSON.stringify({ fetchedAt, sensorVersion: SENSOR_VERSION, sourceTag: SOURCE_TAG, files: manifest }, null, 2));
  console.log(JSON.stringify({ ok: true, build: "046-data", venue: VENUE, sensorVersion: SENSOR_VERSION, sourceTag: SOURCE_TAG, fetchedAt, results, authorizedToTrade: false }, null, 2));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
