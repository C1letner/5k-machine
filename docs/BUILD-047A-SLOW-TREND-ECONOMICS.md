# Build 047A — Slow Trend: Corrected Economics

Classification: **INCONCLUSIVE** (preregistered rule; see docs/BUILD-047-PREREGISTRATION.md).
Research only. Trading authority remains OFF.

## Objective

Correct the accounting of the Build 045 slow volatility-scaled trend and rerun the same hypothesis. No parameters
were changed or searched.

## Bugs corrected

1. **Cost charged every day.** `mechanismLab.ts` passed daily strategy returns to the bootstrap with `costBps: 10`,
   which subtracts 10 bps from every daily return: about 36.5% a year of cost for a strategy that trades rarely.
   Now cost = 10 bps x |exposure change|, charged only when exposure changes.
2. **Same-close execution.** Build 045 traded at the same daily close that formed the signal, contrary to Build 044's
   next-bar rule. Now the decision uses the day's last hourly close and the trade happens at the next hourly close.

The strategy rule is unchanged (90-day direction, 30-day sample volatility, 1% target daily vol, max 1x). A test
proves the simulator reproduces Build 045's `volScaledTrend` returns exactly at zero cost with 045 timing.

## Method

- Data: HIST-028 hourly Coinbase closes, Sep 30, 2023 to Sep 29, 2026, reduced to daily signals. After the 91-day
  warm-up, 1,003 trading days per asset (Dec 30, 2023 to Sep 27, 2026).
- Cost: 10 bps per unit of turnover (primary); 5 bps sensitivity (if 045's "round trip" label is literal).
- Entry from flat counts as turnover. The open position at the end is marked to market.
- Equal-weight portfolio: daily average of the eight sleeves (sleeve rebalancing costs not modeled).
- Annualization: 365 days. Sharpe uses a zero risk-free rate.
- Significance: circular block bootstrap (blocks of 10 days, 4,999 resamples) on daily net returns.
- Split: Build 044's 70/30 split (at Dec 1, 2025), descriptive only. The last 30% is not a pristine holdout, because
  Build 045 already evaluated the full period.

## Results (primary: next-bar timing, 10 bps per unit turnover)

| Asset | Dir. changes | Turnover (total / per yr) | Gross cum. | Net cum. | CAGR | Vol | Sharpe | Max DD | % up days | Costs on $1 | Final $ | p |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| BTC | 28 | 40.7 / 14.8 | 30.6% | 25.4% | 8.6% | 20.9% | 0.50 | -31.8% | 50.6% | $0.054 | 1.254 | 0.21 |
| ETH | 28 | 31.4 / 11.4 | 33.9% | 29.8% | 9.9% | 21.5% | 0.55 | -28.5% | 51.4% | $0.043 | 1.298 | 0.17 |
| XRP | 58 | 43.8 / 15.9 | -18.8% | -22.2% | -8.7% | 22.8% | -0.29 | -35.6% | 50.8% | $0.034 | 0.778 | 0.67 |
| SOL | 46 | 34.3 / 12.5 | 3.9% | 0.4% | 0.1% | 20.4% | 0.11 | -30.4% | 49.5% | $0.035 | 1.004 | 0.37 |
| ADA | 40 | 29.8 / 10.8 | 37.8% | 33.8% | 11.2% | 22.4% | 0.59 | -24.0% | 53.2% | $0.032 | 1.338 | 0.18 |
| DOGE | 52 | 32.2 / 11.7 | 14.3% | 10.6% | 3.7% | 21.7% | 0.28 | -29.3% | 51.7% | $0.039 | 1.106 | 0.33 |
| AVAX | 54 | 33.2 / 12.1 | 2.5% | -0.9% | -0.3% | 20.7% | 0.09 | -37.2% | 50.2% | $0.028 | 0.991 | 0.43 |
| LINK | 26 | 20.3 / 7.4 | -5.6% | -7.5% | -2.8% | 20.4% | -0.04 | -25.1% | 49.2% | $0.019 | 0.925 | 0.62 |
| **Equal weight** | n/a | 33.2 / 12.1 | 13.8% | 10.0% | 3.5% | 16.0% | 0.30 | -16.6% | 52.4% | $0.036 | 1.100 | 0.33 |

Portfolio checks: 5 bps cost gives +11.9% net; Build 045 same-close timing gives +7.1%; first 70% +10.3%
(Sharpe 0.41); last 30% -0.2% (Sharpe 0.07).

For comparison, Build 045's accounting implied a mean daily NET return of -6 to -12 bps per asset (about -20% to
-36% a year). Under turnover-based costs, costs total about 1.2% of capital a year. The Build 045 negative result was
an artifact of the accounting error.

## Classification

The preregistered PROMISING test needs portfolio Sharpe >= 0.5, p < 0.05 and positive net return in both segments.
Observed: Sharpe 0.30, p = 0.33, last-30% segment -0.2%. It is not NEGATIVE (CAGR 3.5% > 0; Sharpe 0.30 >= 0.2).
Result: **INCONCLUSIVE**.

Plainly: after the fix the strategy made money on paper, but little (3.5% a year with 16% volatility and a 17%
drawdown), essentially all of it before December 2025. It is statistically indistinguishable from zero: with 2.75
years of data, the standard error of a Sharpe ratio is about 0.6. Four of eight assets were at or below zero.

## Limitations

- Only 2.75 usable years, one market cycle. The last 30% was seen by Build 045.
- Costs are a flat 10 bps per unit turnover; slippage, funding for short positions and borrow costs are not modeled.
- Turnover uses |Δ target exposure| and ignores drift between rebalances (standard approximation).
- The equal-weight portfolio ignores the cost of rebalancing between sleeves.

## Next recommended experiment

Run the same frozen specification on **older, never-evaluated Coinbase history** (hourly candles before Sep 30,
2023, for the assets listed then) as a genuine out-of-sample test. No parameter changes. Preregister the same
classification rule. This is the only way to get untouched evidence for this strategy.

## Files

`src/mechanisms/trendEconomics.ts`, `src/trendEconomicsLab.ts`, `tests/trendEconomics.test.ts`.
Report: `reports` branch, `2026-09-29-build-047a-trend-economics/` (JSON, markdown, daily ledger CSV).
