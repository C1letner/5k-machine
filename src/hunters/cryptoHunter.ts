import { db } from "../db.js";
import type { BtcSpot } from "../market/coinbase.js";

type PricePoint = { observed_at: string; price_usd: number | string | null };

function pct(now: number, then: number | null): number | null {
  if (!then || then <= 0) return null;
  return ((now / then) - 1) * 100;
}
function nearestAtOrBefore(rows: PricePoint[], targetMs: number): number | null {
  let best: PricePoint | null = null;
  for (const row of rows) {
    const t = Date.parse(row.observed_at);
    if (t <= targetMs && (!best || t > Date.parse(best.observed_at))) best = row;
  }
  return best?.price_usd == null ? null : Number(best.price_usd);
}
export async function recordBtcObservation(spot: BtcSpot) {
  const { data, error } = await db.from("market_observations").insert({
    observed_at: spot.observedAt, agent: "crypto_hunter_v2", asset: spot.asset,
    market: spot.market, observation_type: "SPOT_PRICE", price_usd: spot.priceUsd,
    payload: { build: "002", note: "Raw BTC spot observation. No investment action authorized." },
    source: spot.source
  }).select("id, observed_at, price_usd").single();
  if (error) throw error;
  return data;
}
export async function buildBtcMemory(spot: BtcSpot) {
  const since = new Date(Date.parse(spot.observedAt) - 8*24*60*60*1000).toISOString();
  // Build 004: the authoritative clock is btc_sensor_v1. During bootstrap,
  // fall back to legacy Hunter spot rows only if the sensor has too little history.
  let { data, error } = await db.from("market_observations").select("observed_at, price_usd")
    .eq("asset","BTC").eq("observation_type","SPOT_PRICE").eq("agent","btc_sensor_v1")
    .gte("observed_at",since).order("observed_at",{ascending:true});
  if (!error && (data?.length ?? 0) < 2) {
    const fallback = await db.from("market_observations").select("observed_at, price_usd")
      .eq("asset","BTC").eq("observation_type","SPOT_PRICE").gte("observed_at",since)
      .order("observed_at",{ascending:true});
    data = fallback.data; error = fallback.error;
  }
  if (error) throw error;
  const rows=(data??[]) as PricePoint[], nowMs=Date.parse(spot.observedAt);
  const prices=rows.map(r=>Number(r.price_usd)).filter(Number.isFinite);
  const high=prices.length?Math.max(...prices):spot.priceUsd, low=prices.length?Math.min(...prices):spot.priceUsd;
  const features={
    observations:rows.length,
    change1hPct:pct(spot.priceUsd,nearestAtOrBefore(rows,nowMs-60*60*1000)),
    change4hPct:pct(spot.priceUsd,nearestAtOrBefore(rows,nowMs-4*60*60*1000)),
    change24hPct:pct(spot.priceUsd,nearestAtOrBefore(rows,nowMs-24*60*60*1000)),
    change7dPct:pct(spot.priceUsd,nearestAtOrBefore(rows,nowMs-7*24*60*60*1000)),
    rolling8dHigh:high, rolling8dLow:low,
    drawdownFromRollingHighPct:pct(spot.priceUsd,high),
    distanceFromRollingLowPct:pct(spot.priceUsd,low)
  };
  const trigger=features.change24hPct!=null&&Math.abs(features.change24hPct)>=3?"ABS_24H_MOVE_GTE_3PCT":null;
  const supportingSignal=spot.priceUsd>=high?"ROLLING_HIGH":spot.priceUsd<=low?"ROLLING_LOW":null;
  const candidateReady=Boolean(trigger&&supportingSignal);
  const {data:memory,error:memoryError}=await db.from("market_observations").insert({
    observed_at:spot.observedAt,agent:"crypto_hunter_v2",asset:"BTC",market:"BTC-USD",
    observation_type:candidateReady?"CANDIDATE_SIGNAL":"MARKET_FEATURES",price_usd:spot.priceUsd,
    payload:{build:"004",authoritativeSensor:"btc_sensor_v1",features,trigger,supportingSignal,candidateReady,
      note:candidateReady?"Trigger + supporting price-structure signal detected. No capital action.":"Memory/features updated; no candidate."},
    source:"derived:market_observations"
  }).select("id").single();
  if(memoryError) throw memoryError;
  let candidateId: string | null = null;
  if (candidateReady) {
    const direction = supportingSignal === "ROLLING_HIGH" ? "LONG" : "SHORT";
    const { data: candidate, error: candidateError } = await db.from("candidates").insert({
      observation_id: memory.id,
      asset: "BTC",
      market: "BTC-USD",
      direction,
      discovery_price_usd: spot.priceUsd,
      trigger: trigger ?? "UNKNOWN",
      supporting_signal: supportingSignal,
      mispricing_thesis: direction === "LONG"
        ? "Large 24h move with a fresh observed rolling high may indicate momentum continuation."
        : "Large 24h move with a fresh observed rolling low may indicate downside momentum continuation.",
      catalyst: "Price/market-structure signal only; deep research not yet attached.",
      horizon: "1d-7d",
      invalidation: "Signal loses rolling extreme and subsequent evidence fails to support continuation.",
      liquidity_notes: "BTC-USD is treated as liquid for the $5K shadow experiment; execution not authorized.",
      estimated_costs_bps: 50,
      hunter: "crypto_hunter_v2",
      hunter_confidence: "LOW",
      known_unknowns: ["volume confirmation","derivatives positioning","spot flow","news catalyst"],
      status: "DISCOVERED"
    }).select("id").single();
    if (candidateError) throw candidateError;
    candidateId = candidate.id;
  }
  return {features,trigger,supportingSignal,candidateReady,memoryId:memory.id,candidateId};
}
