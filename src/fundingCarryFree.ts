// Build 046: funding-carry baseline on STORED history (Kraken Futures linear perpetuals, FUND046-KRAKEN).
// Reads Supabase only; never contacts an exchange. Ingest first with `npm run ingest:funding`.
//
// Reports the RAW FUNDING LEG of a short perpetual: cumulative and annualized funding, positive/negative
// frequency, funding drawdowns, per-year results, and a no-look-ahead trailing-sign filter.
// This is NOT a delta-neutral carry return. Not modeled: spot/perp basis changes, fees and spread on both
// legs, rebalancing, collateral haircuts and idle margin, exchange/stablecoin risk. No profitability claim.
import { byYear, fundingStats, trailingSignFilter } from "./funding/carryStats.js";
import { loadStored } from "./funding/completenessJob.js";
import { INSTRUMENTS, SENSOR_VERSION, SOURCE_TAG, VENUE } from "./funding/kraken.js";

async function main() {
  const results: any[] = [];
  for (const { asset, instrument } of INSTRUMENTS) {
    const rows = await loadStored(instrument);
    if (!rows.length) throw new Error(`${instrument}: no stored ${SENSOR_VERSION} funding rows; run ingest:funding first`);
    results.push({ asset, instrument, alwaysShortPerp: fundingStats(rows), byYear: byYear(rows), trailing7dSignFilter: trailingSignFilter(rows, 168) });
  }
  console.log(JSON.stringify({
    ok: true, build: "046", program: "FUNDING_CARRY_BASELINE_RAW_FUNDING_LEG",
    data: { venue: VENUE, sensorVersion: SENSOR_VERSION, sourceTag: SOURCE_TAG, units: "fraction of notional; annualized = cumulative / years (simple, not compounded)" },
    interpretation: "Raw funding received by a short perpetual per unit notional. NOT a realizable delta-neutral return: spot/perp basis, fees and spread on both legs, rebalancing, collateral and counterparty risk are not modeled. No profitability claim.",
    results, authorizedToTrade: false,
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
