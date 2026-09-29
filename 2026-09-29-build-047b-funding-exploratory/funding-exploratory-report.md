# Build 047B — Kraken funding carry (EXPLORATORY, one year, NOT VALIDATION)

Classification: **ECONOMICALLY UNINTERESTING** (preregistered; equal-weight, always exposed).
Eligible for promotion: false (coverage 370.3 days < 730).

RAW FUNDING COMPENSATION to a short perpetual per unit notional. NOT realizable delta-neutral return.

## Data quality

| Asset | Rows | First | Last | Duplicates | Gaps | Missing hours | Other intervals | OK |
|---|---:|---|---|---:|---:|---:|---|---|
| BTC | 8881 | 2025-09-24T08:00:00.000Z | 2026-09-29T16:00:00.000Z | 0 | 7 | 8 | [{"hours":3,"count":1},{"hours":2,"count":6}] | true |
| ETH | 8881 | 2025-09-24T08:00:00.000Z | 2026-09-29T16:00:00.000Z | 0 | 7 | 8 | [{"hours":3,"count":1},{"hours":2,"count":6}] | true |
| SOL | 8882 | 2025-09-24T08:00:00.000Z | 2026-09-29T16:00:00.000Z | 0 | 6 | 7 | [{"hours":3,"count":1},{"hours":2,"count":5}] | true |

## Raw funding compensation (always short)

| Series | Mean/h | Median/h | SD/h | % pos | % zero | % neg | Cumulative | Simple ann. | Compounded ann. | Best day | Worst day | Best month | Worst month | Longest + streak (h) | Longest - streak (h) | Max cum. DD |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|---|---:|---:|---:|
| BTC | 3.63e-6 | 3.50e-6 | 8.34e-6 | 69.2% | 0.0% | 30.8% | 3.22% | 3.18% | 3.23% | 2026-08-22 0.070% | 2026-04-20 -0.033% | 2026-01 0.65% | 2026-04 -0.28% | 362 | 94 | -0.50% |
| ETH | 3.65e-6 | 3.59e-6 | 1.15e-5 | 68.3% | 0.0% | 31.7% | 3.24% | 3.20% | 3.25% | 2026-09-16 0.050% | 2025-10-10 -0.082% | 2026-09 0.66% | 2026-02 -0.14% | 176 | 86 | -0.33% |
| SOL | -3.72e-7 | 5.81e-7 | 2.68e-5 | 51.8% | 0.0% | 48.2% | -0.33% | -0.33% | -0.33% | 2026-08-23 0.152% | 2025-10-11 -0.238% | 2026-08 0.52% | 2026-02 -0.75% | 125 | 117 | -1.76% |
| **Equal weight** | 2.30e-6 | 2.45e-6 | 1.31e-5 | 63.3% | 0.0% | 36.7% | 2.04% | 2.02% | 2.04% | 2026-08-23 0.083% | 2025-10-10 -0.094% | 2026-08 0.54% | 2026-02 -0.32% | 245 | 70 | -0.67% |

## Monthly raw funding

| Month | BTC | ETH | SOL | Equal weight |
|---|---:|---:|---:|---:|
| 2025-09 | 0.10% | 0.02% | 0.04% | 0.05% |
| 2025-10 | 0.54% | 0.21% | -0.35% | 0.14% |
| 2025-11 | 0.48% | 0.21% | 0.06% | 0.25% |
| 2025-12 | 0.43% | 0.28% | 0.28% | 0.33% |
| 2026-01 | 0.65% | 0.45% | 0.26% | 0.45% |
| 2026-02 | -0.06% | -0.14% | -0.75% | -0.32% |
| 2026-03 | -0.09% | -0.02% | -0.43% | -0.18% |
| 2026-04 | -0.28% | -0.13% | 0.03% | -0.13% |
| 2026-05 | 0.04% | 0.45% | 0.05% | 0.18% |
| 2026-06 | 0.02% | 0.18% | -0.48% | -0.10% |
| 2026-07 | 0.47% | 0.43% | 0.00% | 0.30% |
| 2026-08 | 0.45% | 0.64% | 0.52% | 0.54% |
| 2026-09 | 0.47% | 0.66% | 0.43% | 0.52% |

## Preregistered exposure rules (equal weight)

| Rule | Fraction exposed | Switches (all assets) | Cumulative | Simple ann. | Max cum. DD |
|---|---:|---:|---:|---:|---:|
| always | 100.0% | 0 | 2.04% | 2.02% | -0.67% |
| prevHourPositive | 63.1% | 4073 | 4.39% | 4.34% | -0.01% |
| trailing24hAbove10pct | 9.5% | 275 | 1.04% | 1.05% | -0.05% |

Not modeled: spot/perpetual basis and its convergence/divergence; entry and exit prices; trading fees, spread and slippage on both legs; hedge rebalancing; collateral, margin and liquidation risk; exchange, counterparty and stablecoin risk; capital efficiency (margin plus spot capital); taxes.