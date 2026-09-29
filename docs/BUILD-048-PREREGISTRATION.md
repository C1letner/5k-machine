# Build 048 — Preregistration: Untouched Historical Replication of the Frozen Slow Trend

Written 2026-09-29, before any pre-2023-09-30 price data was downloaded and before any Build 048 strategy result
existed. Nothing below may change after results are seen; any deviation must be recorded with its reason.

## Untouched-data audit (performed before this document)

- Earliest price row in the database: HIST-028, 2023-09-30 04:00 UTC. No price data before 2023-09-30 exists in
  Supabase, in the `reports` branch, or in any document or code in the repository.
- Every research stage that reads prices filters to HIST-028 or to a recent window (hypothesis tester, prosecutor,
  holdout, miners, calibration, temporal audit, mechanism labs). None has read pre-2023-09-30 prices.
- The slow-trend rule (src/mechanisms/slowTrend.ts, Build 045, 2026-09-28) uses conventional round-number parameters
  and was never tuned on any data.
- Disclosed caveat: the trend-following family was chosen partly because published research reports it worked in
  crypto historically, including 2015-2023. The period is untouched by this project's data and parameters, not by
  general knowledge. A PASS must be read with that in mind.

## Frozen strategy (no changes permitted)

90-day trend direction (>= 0 is long), 30-day sample volatility of daily returns, 1% target daily volatility,
maximum leverage 1x. Build 047A simulator (`src/mechanisms/trendEconomics.ts`), Build 044 next-bar timing: decide on
the date's last hourly close, trade at the next hourly close. Cost 10 bps per unit of turnover |w_t - w_(t-1)|; entry
from flat counts; the final open position is marked to market. No other lookback, window, threshold, leverage,
weighting, entry or exit rule may be run.

## Data

- Source: Coinbase Exchange public hourly candles (`api.exchange.coinbase.com/products/{ASSET}-USD/candles`,
  granularity 3600), the same source and convention as HIST-028: timestamp = candle START (UTC), value = candle CLOSE,
  knowable one hour after the timestamp.
- Stored as `sensor_version = HIST-048` in `crypto_universe_snapshots`, so no existing research stage reads it.
- Requested window: 2015-01-01 00:00 UTC up to but excluding 2023-09-30 00:00 UTC. Each asset starts at its first
  available candle. Nothing at or after 2023-09-30 00:00 is used.
- Requested universe: BTC, ETH, XRP, SOL, ADA, DOGE, AVAX, LINK.

## Missing data and eligibility (mechanical, decided before data)

- A daily record exists for a UTC date if it has at least one hourly candle and a later candle exists (the execution
  price). Missing hours within a date are tolerated; missing whole dates are not filled.
- Segments: a missing calendar date ends a segment. Each asset uses its single LONGEST segment of consecutive dates.
- Eligible if that segment yields at least 365 daily position decisions after the 91-day warm-up
  (at least 457 consecutive dates). Otherwise excluded, reported as excluded for data reasons, and never replaced.

## Portfolio

Equal weight across eligible sleeves active on each date (average of the active sleeves' daily net returns). The
number of active sleeves is reported through time. Sleeve rebalancing costs are not modeled.

## Statistics

Circular block bootstrap (existing engine, `src/science/bootstrap.ts`) on daily NET returns against a zero mean,
blocks of 10 days, 4,999 resamples, for each eligible asset and the portfolio. Economic results and statistical
evidence are reported separately.

## Classification (portfolio, primary cost and timing)

The replication period is split in half by time.
- **REPLICATION PASS:** net Sharpe >= 0.5 AND bootstrap p < 0.05 AND net return positive in both halves.
- **REPLICATION FAIL:** net CAGR <= 0 OR net Sharpe < 0.2.
- **REPLICATION INCONCLUSIVE:** anything else.

Descriptive only (never used for classification): per-asset results, calendar-year returns, 5 bps cost sensitivity.

## Consequences (fixed in advance)

- PASS: no trading; recommend a prospective shadow test of the unchanged rule.
- INCONCLUSIVE: no optimization; state whether more untouched history exists.
- FAIL: recommend closing this exact specification; no parameter search.
