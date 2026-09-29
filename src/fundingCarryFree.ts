// Build 046: funding-carry baseline on STORED history (Kraken Futures linear perpetuals, FUND046-KRAKEN).
// Reads Supabase only; never contacts an exchange. Ingest first with `npm run ingest:funding`.
//
// Reports the RAW FUNDING LEG of a short perpetual: cumulative and annualized funding, positive/negative
// frequency, funding drawdowns, per-year results, and a no-look-ahead trailing-sign filter.
// This is NOT a delta-neutral carry return. Not modeled: spot/perp basis changes, fees and spread on both
// legs, rebalancing, collateral haircuts and idle margin, exchange/stablecoin risk. No profitability claim.
import { byYear, fundingStats, trailingSignFilter } from "./funding/carryStats.js";
import { loadStored, researchSeries } from "./funding/completenessJob.js";
import { INSTRUMENTS, SENSOR_VERSION, SOURCE_TAG, VENUE } from "./funding/kraken.js";

async function main() {
  const results: any[] = [];
  for (const { asset, instrument } of INSTRUMENTS) {
    // Research series: validated analytics history if it passes the completeness gate, else settled rates.
    const { chosen } = await researchSeries(instrument);
    if (!chosen) throw new Error(`${instrument}: no stored funding series passes the completeness gate; run funding-completeness for details`);
    const rows = chosen.rows, settled = await loadStored(instrument, SENSOR_VERSION);
    // Cross-check: over the settled period, the research series and settled rates should give the same funding.
    const sStart = settled[0]?.t ?? Infinity, overlap = rows.filter((r) => r.t >= sStart);
    results.push({ asset, instrument, series: chosen.sensor, alwaysShortPerp: fundingStats(rows), byYear: byYear(rows), trailing7dSignFilter: trailingSignFilter(rows, 168),
      crossCheckSettledPeriod: { settled: fundingStats(settled), researchSeriesSamePeriod: fundingStats(overlap) } });
  }
  console.log(JSON.stringify({
    ok: true, build: "046", program: "FUNDING_CARRY_BASELINE_RAW_FUNDING_LEG",
    data: { venue: VENUE, settledSensor: SENSOR_VERSION, settledSourceTag: SOURCE_TAG, seriesNote: "per-instrument `series` names the stored series used; FUND046-KRAKEN-AN rows carry their validation in the source tag", units: "fraction of notional; annualized = cumulative / years (simple, not compounded)" },
    interpretation: "Raw funding received by a short perpetual per unit notional. NOT a realizable delta-neutral return: spot/perp basis, fees and spread on both legs, rebalancing, collateral and counterparty risk are not modeled. No profitability claim.",
    results, authorizedToTrade: false,
  }, null, 2));
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
