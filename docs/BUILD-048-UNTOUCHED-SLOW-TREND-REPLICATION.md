# Build 048 — Untouched Historical Replication of the Frozen Slow Trend

**Classification: REPLICATION INCONCLUSIVE** (preregistered rule). Trading authority remains OFF.

1. **Preregistration commit:** `cf7f5f67be519be0f3e98afc2c96b3d0a08829dd` (2026-09-29 10:47 MST, before any
   pre-2023 data was downloaded or any result existed). No deviations.
2. **Code commit (run):** `a124ebc64088ce765f1d41f447828b5244da4c67` (implementation `39a34b87`).
3. **Data provenance:** Coinbase Exchange public hourly candles (`/products/{ASSET}-USD/candles`, granularity 3600),
   stored as `HIST-048` in `crypto_universe_snapshots`: timestamp = candle start (UTC), value = close (known one hour
   later). 320 windowed requests per asset, no truncation, no rows at or after the cutoff. Raw run logs and the daily
   ledger are in the `reports` branch under `2026-09-29-build-048-untouched-replication/`.
4. **Replication period:** each asset's first Coinbase candle to 2023-09-29 23:00 UTC (last candle before the
   2023-09-30 cutoff). Strategy decisions: 2015-10-19 to 2023-09-27.
5. **Requested universe:** BTC, ETH, XRP, SOL, ADA, DOGE, AVAX, LINK.
6. **Eligible universe (mechanical):** all eight.

## Untouched-data audit

Before this build, the database's earliest price row was 2023-09-30 04:00 UTC. No stage, report, document or code
had used earlier prices. The parameters were set once in Build 045 and never tuned. Caveat: trend following was
chosen partly because published research reports it worked in crypto in these years. The period was untouched by this
project's data, not by general knowledge.

## Data integrity (HIST-048)

| Asset | First | Observations | Duplicates | Missing hours | Complete | Gaps > 24h | Longest usable run |
|---|---|---:|---:|---:|---:|---:|---|
| BTC | 2015-07-20 | 71,790 | 0 | 45 | 99.94% | 0 | 2015-07-20 to 2023-09-28 (2,993 dates) |
| ETH | 2016-05-18 | 64,381 | 0 | 203 | 99.69% | 1 (66 h, May 2016) | 2016-05-23 to 2023-09-28 (2,685) |
| XRP | 2019-02-26 | 18,505 | 0 | 21,726 | 46% | 1 (Coinbase suspension Jan 2021 to Jul 2023) | 2019-02-26 to 2021-01-18 (693) |
| SOL | 2021-06-17 | 20,019 | 0 | 5 | 99.98% | 0 | 834 dates |
| ADA | 2021-03-18 | 22,203 | 0 | 5 | 99.98% | 0 | 925 dates |
| DOGE | 2021-06-03 | 20,355 | 0 | 5 | 99.98% | 0 | 848 dates |
| AVAX | 2021-09-30 | 17,497 | 0 | 4 | 99.98% | 0 | 729 dates |
| LINK | 2019-06-27 | 37,317 | 0 | 11 | 99.97% | 0 | 1,555 dates |

All ends are 2023-09-29 23:00 UTC. XRP's second listing segment (78 dates in 2023) is not used, per the
longest-run rule.

## Asset results (frozen rule; 10 bps per unit turnover; next-bar execution)

| Asset | Period | Days | Dir. changes | Turnover/yr | Gross cum. | Net cum. | CAGR | Vol | Sharpe | Max DD | % up | Final $ | p |
|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| BTC | 2015-10 to 2023-09 | 2,901 | 108 | 15.4 | 326.3% | 277.3% | 18.2% | 23.4% | 0.83 | -44.3% | 52.7% | 3.77 | 0.014 |
| ETH | 2016-08 to 2023-09 | 2,593 | 102 | 10.8 | 303.7% | 273.9% | 20.4% | 21.9% | 0.96 | -37.0% | 51.0% | 3.74 | 0.006 |
| XRP | 2019-05 to 2021-01 | 601 | 26 | 12.1 | -36.3% | -37.6% | -24.9% | 23.3% | -1.11 | -44.2% | 46.6% | 0.62 | 0.88 |
| SOL | 2021-09 to 2023-09 | 742 | 38 | 11.4 | -25.6% | -27.3% | -14.5% | 21.4% | -0.62 | -46.6% | 48.8% | 0.73 | 0.77 |
| ADA | 2021-06 to 2023-09 | 833 | 41 | 13.6 | -16.9% | -19.4% | -9.0% | 21.8% | -0.32 | -36.9% | 49.3% | 0.81 | 0.72 |
| DOGE | 2021-09 to 2023-09 | 756 | 52 | 16.1 | -16.1% | -18.9% | -9.6% | 21.5% | -0.36 | -33.3% | 48.4% | 0.81 | 0.64 |
| AVAX | 2021-12 to 2023-09 | 637 | 27 | 9.1 | -10.6% | -12.0% | -7.1% | 21.4% | -0.23 | -34.5% | 49.9% | 0.88 | 0.69 |
| LINK | 2019-09 to 2023-09 | 1,463 | 107 | 14.8 | -47.2% | -50.2% | -16.0% | 21.2% | -0.72 | -55.9% | 47.7% | 0.50 | 0.95 |

Transaction costs paid on $1: BTC $0.41, ETH $0.25, others $0.01 to $0.04.

## Portfolio (equal weight across active sleeves)

Gross +296.4%, net +257.7%, CAGR 17.4%, volatility 18.2%, Sharpe 0.97, maximum drawdown -34.3%, turnover 13.0 per
year, costs $0.32 on $1, final equity $3.58. Bootstrap p = 0.006. 5 bps cost sensitivity: +276.6%.

| Year | 2015* | 2016 | 2017 | 2018 | 2019 | 2020 | 2021 | 2022 | 2023* |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Net | 10.2% | 21.1% | 117.9% | 22.0% | 24.8% | -3.9% | 9.1% | -2.6% | -21.0% |
| Active sleeves | 1 | 1-2 | 2 | 2 | 2-4 | 4 | 3-7 | 7 | 7 |

*Partial years.

Halves (split 2019-10-08): first half **+354.2% (Sharpe 1.93)**; second half **-21.2% (Sharpe -0.33)**.

## Statistical evidence vs economics

The full-period portfolio passes two of three preregistered PASS conditions (Sharpe 0.97 >= 0.5; p = 0.006 < 0.05)
and fails the third: the second half is negative. Under the preregistered rule this is **INCONCLUSIVE**, not PASS.

The concentration is the key finding:

- All the gains come from BTC and ETH before late 2019, with 2017 alone at +118%. In that era the portfolio held only
  one or two assets.
- Every asset whose usable history starts in 2019 or later lost money: XRP, SOL, ADA, DOGE, AVAX and LINK, six of
  eight, all with negative Sharpe.
- From October 2019 to September 2023 the portfolio returned -21% (Sharpe -0.33), and 2023 was the worst year.
- Build 047A's 2024-2026 period (+10%, last 30% flat) is in line with that weaker regime. October 2019 to September
  2026 compounds to roughly -13% net.

So the p-value mostly reflects BTC and ETH trends in 2015-2019, which are exactly the years the literature that
motivated this strategy family describes. On independent evidence from the last seven years, across a broader
universe, the mechanism did not work.

## Limitations

- The portfolio's composition changes over time (1 to 7 sleeves), so the halves also differ in breadth. The early
  period is effectively a two-asset test.
- One cost level (10 bps per unit turnover); no slippage, borrow or short-funding costs. Shorts are assumed available.
- Different assets cover different periods; XRP excludes its 2021 to 2023 Coinbase suspension.
- Literature-level contamination (see audit).

## Bugs discovered

- None in Build 048 code. The backfill log's candle counts include one shared boundary candle per window (ignored on
  write); the integrity table uses de-duplicated database counts.
- Pre-existing, not fixed: `retryController` compares a hypothesis's event count with the total row count (different
  units), so it releases most cooldowns; the new HIST-048 rows are excluded from that count. The `relationshipMatrix`
  test fails because `src/discovery/anomalyScanner.ts` is missing (since before Build 041). There are 13 pre-existing
  TypeScript errors.

## Recommended next action (per the preregistered consequences)

INCONCLUSIVE: no optimization. **No further untouched Coinbase history exists** for these assets (BTC and ETH already
go back to their Coinbase listings). The only way to add independent evidence is prospective: record the frozen
rule's daily decisions going forward without trading (a paper forward log), or test on another lawful venue's
history, which would be a new source needing its own preregistration.

Architect's read (not a classification): on the evidence from October 2019 onward, this specification is not a
credible candidate. The Owner may reasonably choose to close it rather than spend a year on a forward log.
