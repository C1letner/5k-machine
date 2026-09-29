// Build 048: backfill Coinbase hourly candles from 2015-01-01 up to but EXCLUDING 2023-09-30 00:00 UTC, stored as
// HIST-048 (same convention as HIST-028: candle-start timestamp, candle close). No existing research stage reads
// HIST-048, so this history stays untouched until the preregistered replication (docs/BUILD-048-PREREGISTRATION.md).
// Idempotent (upsert ignoring duplicates), windowed below Coinbase's 300-candle limit with a truncation guard,
// rate-limit aware (fetchCandles retries 429/5xx with backoff). Writes market data only; no trading.
import { db } from "./db.js";
import { fetchCandles } from "./backfillHistory.js";
import { CUTOFF_MS } from "./mechanisms/replication.js";

const ASSETS = ["BTC", "ETH", "XRP", "SOL", "ADA", "DOGE", "AVAX", "LINK"];
const START_MS = Date.parse("2015-01-01T00:00:00Z"), HOUR = 3600_000, CHUNK_HOURS = 240, MAX_CANDLES = 300;
export const SENSOR = "HIST-048";
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  const per: Record<string, { requests: number; candles: number; first: string | null; last: string | null }> = {};
  for (const asset of ASSETS) {
    let requests = 0, candles = 0, first: number | null = null, last: number | null = null;
    for (let t = START_MS; t < CUTOFF_MS; t += CHUNK_HOURS * HOUR) {
      // Windows share their boundary candle whether Coinbase treats `end` as inclusive or exclusive; the duplicate
      // is ignored on upsert, and anything at or after the cutoff is filtered out below.
      const a = new Date(t), b = new Date(Math.min(t + CHUNK_HOURS * HOUR, CUTOFF_MS));
      const rows = await fetchCandles(asset, a, b, "5k-machine-backfill/048");
      requests++;
      if (rows.length >= MAX_CANDLES) throw new Error(`${asset}: ${rows.length} candles in one window; response may be truncated`);
      const payload = rows.map((x) => ({ t: x[0] * 1000, p: Number(x[4]) }))
        .filter((x) => x.t >= START_MS && x.t < CUTOFF_MS && Number.isFinite(x.p) && x.p > 0)
        .map((x) => ({ observed_at: new Date(x.t).toISOString(), asset, market: `${asset}-USD`, price_usd: x.p, source: "coinbase_exchange_candles", sensor_version: SENSOR }));
      if (payload.length) {
        const { error } = await db.from("crypto_universe_snapshots").upsert(payload, { onConflict: "observed_at,asset", ignoreDuplicates: true });
        if (error) throw error;
        candles += payload.length;
        for (const r of payload) { const x = Date.parse(r.observed_at); first = first == null ? x : Math.min(first, x); last = last == null ? x : Math.max(last, x); }
      }
      await sleep(175);
    }
    per[asset] = { requests, candles, first: first == null ? null : new Date(first).toISOString(), last: last == null ? null : new Date(last).toISOString() };
    console.error(JSON.stringify({ asset, ...per[asset] }));
  }
  console.log(JSON.stringify({ ok: true, build: "048", sensorVersion: SENSOR, window: { start: new Date(START_MS).toISOString(), endExclusive: new Date(CUTOFF_MS).toISOString() }, source: "api.exchange.coinbase.com candles, granularity 3600; ts = candle start; value = close", perAsset: per, authorizedToTrade: false }, null, 2));
}

if (process.argv[1]?.endsWith("backfillUntouched.ts")) main().catch((e) => { console.error(e); process.exitCode = 1; });
