import { config } from "../config.js";

export type BtcSpot = {
  asset: "BTC";
  market: "BTC-USD";
  priceUsd: number;
  observedAt: string;
  source: string;
};

export async function fetchBtcSpot(): Promise<BtcSpot> {
  const response = await fetch(config.btcPriceUrl, {
    headers: { "User-Agent": "5k-machine/0.1" }
  });

  if (!response.ok) {
    throw new Error(`BTC price request failed: ${response.status}`);
  }

  const json = await response.json() as {
    data?: { amount?: string; base?: string; currency?: string }
  };

  const priceUsd = Number(json.data?.amount);
  if (!Number.isFinite(priceUsd) || priceUsd <= 0) {
    throw new Error("BTC price response did not contain a valid price");
  }

  return {
    asset: "BTC",
    market: "BTC-USD",
    priceUsd,
    observedAt: new Date().toISOString(),
    source: config.btcPriceUrl
  };
}
