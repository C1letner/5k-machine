# Run request 2026-09-28-multiyear-calibration

Requested at commit 007577aacbd9cd1941abd4d6f25bda058c5f5f40.

Note: Build 043 first run. Prices were already backfilled to 3 years (Historical Data Backfill, 2026-09-29 03:47 UTC). Backfill 3 years of volume, check data integrity, then calibrate the funnel on the full history.

| Job | Days | Result | Minutes |
|---|---:|---|---:|
| backfill-volume | 1095 | success | 4.2 |
| diagnose |  | success | 0.7 |
| calibrate |  | success | 5.4 |

## Funnel calibration (build 043)

Data: Supabase HIST-028, 26270 hours × 8 assets, 153 distinct hypotheses (55 exact duplicates merged, e.g. A->B and B->A of the same trade). Read-only; nothing was written to the database.

### Positive control: share of planted edges that survive each stage

Edge = extra return added to every event of one hypothesis, before 50 bps costs.

| Edge per trade | p-value rule | Discovery | FDR | Prosecutor |
|---:|---|---:|---:|---:|
| 0% | block bootstrap (042) | 80% | 0% | 0% |
| 0.1% | block bootstrap (042) | 100% | 0% | 0% |
| 0.25% | block bootstrap (042) | 100% | 0% | 0% |
| 0.5% | block bootstrap (042) | 100% | 0% | 0% |
| 0.75% | block bootstrap (042) | 100% | 93% | 72% |
| 1% | block bootstrap (042) | 100% | 100% | 87% |
| 1.5% | block bootstrap (042) | 100% | 100% | 100% |
| 2% | block bootstrap (042) | 100% | 100% | 100% |
| 3% | block bootstrap (042) | 100% | 100% | 100% |

### Negative control: scrambled data with no edge

Zero = no edge at all. Equal to cost = gross edge exactly 0.50%, so nothing is left after costs: the hardest worthless case.

| Null edge | Sign-flip block | p-value rule | Mean FDR survivors | Mean final survivors | Runs with any final survivor |
|---|---:|---|---:|---:|---:|
| zero | 1 events | block bootstrap (042) | 0.00 | 0.00 | 0% |
| zero | 10 events | block bootstrap (042) | 0.00 | 0.00 | 0% |
| zero | 25 events | block bootstrap (042) | 0.00 | 0.00 | 0% |
| equal to cost | 1 events | block bootstrap (042) | 0.27 | 0.13 | 13% |
| equal to cost | 10 events | block bootstrap (042) | 0.17 | 0.03 | 3% |
| equal to cost | 25 events | block bootstrap (042) | 0.35 | 0.17 | 12% |

### Real data

| p-value rule | Discovery PASS | FDR PASS | Prosecutor PASS | Survivors |
|---|---:|---:|---:|---|
| block bootstrap (042) | 136 | 0 | 0 | none |

### Strongest candidates under the block-bootstrap test (real data)

p is for a net-of-cost edge at the best horizon. With this many hypotheses, a lone real edge needs p well below 0.001 to pass FDR.

| Hypothesis | p | Horizon | Net mean per trade | Events |
|---|---:|---:|---:|---:|
| MOMENTUM_REVERSAL:BTC | 0.4008 | 24h | 0.280% | 225 |
| CORRELATION_BREAKDOWN:DOGE->SOL | 0.8080 | 24h | -0.057% | 654 |
| CORRELATION_BREAKDOWN:ADA->AVAX | 0.8860 | 24h | -0.154% | 699 |
| RELATIVE_STRENGTH_DIVERGENCE:ETH->XRP | 0.8938 | 24h | -0.115% | 1853 |
| RELATIVE_STRENGTH_DIVERGENCE:DOGE->XRP | 0.9182 | 24h | -0.168% | 2505 |
| CORRELATION_BREAKDOWN:DOGE->LINK | 0.9182 | 24h | -0.188% | 622 |
| MOMENTUM_REVERSAL:LINK | 0.9439 | 24h | -0.120% | 1055 |
| VOLATILITY_EXPANSION:LINK | 0.9528 | 24h | -0.208% | 553 |

### Minimum detectable edge at 4h

Median 0.11% per trade (middle half 0.07–0.13%). 0% of hypotheses cannot detect an edge as small as the 0.50% cost. Treats overlapping events as independent, so the true minimum detectable edge is larger than shown.
