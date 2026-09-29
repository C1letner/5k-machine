// Build 043: multi-year hourly price backfill from Coinbase Exchange candles.
// Writes HIST-028 rows: labeled with the candle START time, holding the candle CLOSE
// price (known one hour after observed_at). Same convention as the original 180-day
// backfill, so existing rows and new rows form one consistent series.
import { db } from "./db.js";

const ASSETS = ["BTC", "ETH", "XRP", "SOL", "ADA", "DOGE", "AVAX", "LINK"] as const;
const HOUR = 3600_000, CHUNK_HOURS = 240; // Coinbase returns at most 300 candles per request
const DAYS = Number(process.env.BACKFILL_DAYS ?? 1095); // default: 3 years
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function fetchCandles(asset: string, start: Date, end: Date, agent: string): Promise<number[][]> {
  const u = new URL(`https://api.exchange.coinbase.com/products/${asset}-USD/candles`);
  u.searchParams.set("granularity", "3600");
  u.searchParams.set("start", start.toISOString());
  u.searchParams.set("end", end.toISOString());
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(u, { headers: { "User-Agent": agent } });
    if (r.ok) return (await r.json()) as number[][];
    // Rate limits and transient errors: back off and retry, up to 6 attempts.
    if ((r.status === 429 || r.status >= 500) && attempt < 6) { await sleep(1000 * 2 ** attempt); continue; }
    throw new Error(`${asset} candles HTTP ${r.status}: ${await r.text()}`);
  }
}

async function main() {
  if (!Number.isFinite(DAYS) || DAYS < 1 || DAYS > 3650) throw new Error(`BACKFILL_DAYS must be 1-3650, got ${process.env.BACKFILL_DAYS}`);
  const boundary = new Date(), start = new Date(boundary.getTime() - DAYS * 24 * HOUR);
  const perAsset: Record<string, { candles: number; earliest: string | null }> = {};
  for (const asset of ASSETS) {
    let candles = 0, earliest: number | null = null;
    for (let t = start.getTime(); t < boundary.getTime(); t += CHUNK_HOURS * HOUR) {
      const a = new Date(t), b = new Date(Math.min(t + CHUNK_HOURS * HOUR, boundary.getTime()));
      const rows = await fetchCandles(asset, a, b, "5k-machine-backfill/1.1");
      const payload = rows.map((x) => ({ observed_at: new Date(x[0] * 1000).toISOString(), asset, market: `${asset}-USD`, price_usd: Number(x[4]), source: "coinbase_exchange_candles", sensor_version: "HIST-028" }));
      if (payload.length) {
        const { error } = await db.from("crypto_universe_snapshots").upsert(payload, { onConflict: "observed_at,asset", ignoreDuplicates: true });
        if (error) throw error;
        candles += payload.length;
        const first = Math.min(...rows.map((x) => x[0] * 1000));
        earliest = earliest == null ? first : Math.min(earliest, first);
      }
      await sleep(175);
    }
    perAsset[asset] = { candles, earliest: earliest == null ? null : new Date(earliest).toISOString() };
    console.log(JSON.stringify({ asset, ...perAsset[asset] }));
  }
  console.log(JSON.stringify({ ok: true, build: "043", daysRequested: DAYS, requestedStart: start.toISOString(), forwardBoundary: boundary.toISOString(), perAsset, note: "Upsert ignores rows that already exist; an asset with a later 'earliest' was not listed on Coinbase for the whole window.", authorizedToTrade: false }, null, 2));
}

if (process.argv[1]?.endsWith("backfillHistory.ts")) main().catch((e) => { console.error(e); process.exitCode = 1; });
