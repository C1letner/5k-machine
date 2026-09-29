# Build 047B — Kraken Funding Carry (EXPLORATORY, one year, NOT VALIDATION)

Classification: **ECONOMICALLY UNINTERESTING** (preregistered; see docs/BUILD-047-PREREGISTRATION.md).
Mode: EXPLORATORY / INSUFFICIENT HISTORY / NOT VALIDATION. Eligible for promotion: **false**. The permanent
730-day funding gate is unchanged. Trading authority remains OFF.

## Objective

Is Kraken's raw funding compensation large enough to justify continued research while two years of data accumulate?

## Data and validation

Stored `FUND046-KRAKEN` rows (settled hourly rates), read from the database only; Kraken was not contacted.

| Asset | Instrument | Rows | First (UTC) | Last (UTC) | Duplicates | Gaps | Missing hours |
|---|---|---:|---|---|---:|---:|---:|
| BTC | PF_XBTUSD | 8,881 | 2025-09-24 08:00 | 2026-09-29 16:00 | 0 | 7 | 8 |
| ETH | PF_ETHUSD | 8,881 | 2025-09-24 08:00 | 2026-09-29 16:00 | 0 | 7 | 8 |
| SOL | PF_SOLUSD | 8,882 | 2025-09-24 08:00 | 2026-09-29 16:00 | 0 | 6 | 7 |

- Gaps are in Kraken's own record (one 3-hour and five or six 2-hour spacings); interval is otherwise hourly throughout.
- Metadata agrees with Kraken's documentation: relativeFundingRate is a fraction of notional per one-hour period;
  timestamp is the period start (UTC); positive rates are paid by longs and received by shorts; rates are within
  the documented ±0.5%/hour cap. Asset and instrument mappings match.
- Units independently checked: |fundingRate / relativeFundingRate| in the raw snapshot equals the coin price
  (implied about $112,600 BTC, $4,176 ETH and $211 SOL on Sep 24, 2025), confirming the relative rate is a fraction,
  not a percentage.

## Results: RAW FUNDING COMPENSATION (always short the perpetual)

| Series | % pos | % neg | Cumulative | Simple ann. | Compounded ann. | Best month | Worst month | Longest - streak | Max cum. DD |
|---|---:|---:|---:|---:|---:|---|---|---:|---:|
| BTC | 69.2% | 30.8% | 3.22% | 3.18% | 3.23% | 2026-01 +0.65% | 2026-04 -0.28% | 94 h | -0.50% |
| ETH | 68.3% | 31.7% | 3.24% | 3.20% | 3.25% | 2026-09 +0.66% | 2026-02 -0.14% | 86 h | -0.33% |
| SOL | 51.8% | 48.2% | -0.33% | -0.33% | -0.33% | 2026-08 +0.52% | 2026-02 -0.75% | 117 h | -1.76% |
| **Equal weight** | 63.3% | 36.7% | 2.04% | 2.02% | 2.04% | 2026-08 +0.54% | 2026-02 -0.32% | 70 h | -0.67% |

Median hourly rates: BTC 3.5e-6, ETH 3.6e-6, SOL 5.8e-7 (0.00035%, 0.00036% and 0.00006% per hour). No zero-rate
hours. Full per-asset statistics (means, SDs, best/worst days, streaks) and monthly totals are in the JSON report.
Equal-weight months: 8 of 12 full months positive (67%); February to April and June 2026 were negative.

## Preregistered exposure rules (equal weight, funding only, no costs)

| Rule | Exposed | Position switches / yr | Simple ann. raw funding |
|---|---:|---:|---:|
| Always exposed | 100% | 0 | 2.02% |
| Exposed if previous hour > 0 | 63% | 4,073 | 4.34% |
| Exposed if trailing 24h > 10%/yr | 9.5% | 275 | 1.05% |

The previous-hour rule adds about 1.1 to 4.6 percentage points per asset, but needs 1,000 to 1,800 hedged entries or
exits per asset per year. Break-even is about 0.1 to 0.3 bps per switch for both legs combined, far below any real
trading cost. The threshold rule collects less than always-on.

## Classification

Preregistered cut-off: below 5% simple annualized raw funding is ECONOMICALLY UNINTERESTING. The equal-weight
portfolio earned **2.02%**, before any costs. BTC and ETH alone were about 3.2%; SOL was negative.

This is gross funding on the short leg only. A real long-spot / short-perp trade would also tie up spot capital plus
perpetual margin (so return on capital is lower still), pay fees and spread on both legs at entry, exit and each
rebalance, and carry basis, exchange and stablecoin risk. Positive raw funding does not imply profit.

## What realizable delta-neutral return would need

Hourly Kraken perpetual mark and spot-index prices (for basis), actual fee tier and spread on Kraken spot and
futures, margin and collateral rules for PF_ contracts, a hedge-rebalancing policy, and cash yield on idle margin.
Kraken's public charts API publishes mark and spot-index OHLC for these instruments; none is stored yet, so no
hedge simulation was run.

## Data retention

The weekly accumulation job (`funding-accumulate.yml`) was reviewed:
- Idempotent and append-safe: inserts only timestamps not already stored; never overwrites.
- Duplicate-safe: unique key (observed_at, venue, instrument, sensor_version) plus ignore-duplicates.
- Provenance: every row carries the source tag. Build 047 adds publishing of each run's raw responses and SHA-256
  manifest to the `reports` branch (it previously kept them only for the first ingest).
- Gap detection: each run records coverage, gaps and missing hours (informational).
- Kraken keeps about a year, so any interruption shorter than a year loses nothing.

Two full years of stored history: **2027-09-24 08:00 UTC**, if collection continues without an interruption longer
than about a year.

## Next recommended experiment

Given 2% gross, no further funding-carry work is justified now beyond passive accumulation. Revisit at two years
(Sep 2027) with the same preregistered rules. If revisited earlier, the useful addition is Kraken mark/spot-index
history to measure basis, since basis and costs decide whether any carry is realizable.

## Files

`src/funding/exploratory.ts`, `src/fundingExploratory.ts`, `tests/fundingExploratory.test.ts`.
Report: `reports` branch, `2026-09-29-build-047b-funding-exploratory/` (JSON and markdown).
