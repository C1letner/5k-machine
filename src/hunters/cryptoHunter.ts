import { db } from "../db.js";
import type { BtcSpot } from "../market/coinbase.js";

export async function recordBtcObservation(spot: BtcSpot) {
  const { data, error } = await db
    .from("market_observations")
    .insert({
      observed_at: spot.observedAt,
      agent: "crypto_hunter_v1",
      asset: spot.asset,
      market: spot.market,
      observation_type: "SPOT_PRICE",
      price_usd: spot.priceUsd,
      payload: {
        note: "Build 001 raw BTC spot observation. No investment action authorized."
      },
      source: spot.source
    })
    .select("id, observed_at, price_usd")
    .single();

  if (error) throw error;
  return data;
}

export async function maybeCreateCandidate() {
  // Build 001 deliberately does not invent an investment thesis from one price tick.
  // Candidate creation will require a defined trigger + independent supporting signal.
  return null;
}
