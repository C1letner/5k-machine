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
  const { data, error } = await db.from("market_observations").select("observed_at, price_usd")
    .eq("asset","BTC").eq("observation_type","SPOT_PRICE").gte("observed_at",since)
    .order("observed_at",{ascending:true});
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
    payload:{build:"002",features,trigger,supportingSignal,candidateReady,
      note:candidateReady?"Trigger + supporting price-structure signal detected. No capital action.":"Memory/features updated; no candidate."},
    source:"derived:market_observations"
  }).select("id").single();
  if(memoryError) throw memoryError;
  return {features,trigger,supportingSignal,candidateReady,memoryId:memory.id};
}
