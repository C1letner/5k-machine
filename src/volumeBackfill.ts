// Build 043: multi-year hourly volume backfill (VOL035), matching the price backfill.
// Rows are labeled with the candle START time and hold the full hour's base-asset volume.
import { db } from "./db.js";
import { fetchCandles } from "./backfillHistory.js";

const ASSETS = ["BTC", "ETH", "XRP", "SOL", "ADA", "DOGE", "AVAX", "LINK"];
const HOUR = 3600_000, CHUNK_HOURS = 240;
const DAYS = Number(process.env.BACKFILL_DAYS ?? 1095);
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function main() {
  if (!Number.isFinite(DAYS) || DAYS < 1 || DAYS > 3650) throw new Error(`BACKFILL_DAYS must be 1-3650, got ${process.env.BACKFILL_DAYS}`);
  const end = new Date(), start = new Date(end.getTime() - DAYS * 24 * HOUR);
  let n = 0;
  for (const a of ASSETS) {
    for (let t = start.getTime(); t < end.getTime(); t += CHUNK_HOURS * HOUR) {
      const s = new Date(t), e = new Date(Math.min(t + CHUNK_HOURS * HOUR, end.getTime()));
      const rows = (await fetchCandles(a, s, e, "5k-machine-volume/1.1")).map((v) => ({ observed_at: new Date(v[0] * 1000).toISOString(), asset: a, market: `${a}-USD`, volume_base: Number(v[5]), source: "coinbase_exchange_candles", sensor_version: "VOL035" }));
      if (rows.length) {
        const { error } = await db.from("market_volume_observations").upsert(rows, { onConflict: "observed_at,asset,source,sensor_version", ignoreDuplicates: true });
        if (error) throw error;
        n += rows.length;
      }
      await sleep(175);
    }
    console.log(JSON.stringify({ asset: a, done: true }));
  }
  console.log(JSON.stringify({ ok: true, build: "043", daysRequested: DAYS, rowsConsidered: n, assets: ASSETS, authorizedToTrade: false }, null, 2));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
