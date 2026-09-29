# Build 043 — Multi-Year History

Status: research only. Nothing in this build grants or changes trading authority.

## Why

Build 042 calibration on six months of data: no hypothesis showed a real edge after
costs, but about 40% of hypotheses had fewer than 160 events at any horizon, so the
significance test correctly called them inconclusive. Even planted 3% edges were only
caught about 57% of the time for that reason. Six months also covers only one market regime.

## What changed

- `npm run backfill` and `npm run backfill:volume` take `BACKFILL_DAYS` (default 1095 = 3 years).
  The **Historical Data Backfill** and **Historical Volume Backfill** workflows ask for the
  number of days when run. Rows keep the HIST-028 / VOL035 conventions, so old and new rows form
  one series; existing rows are left as they are. Coinbase rate limits and server errors are
  retried with backoff. The price backfill reports each asset's earliest available candle.
- Discovery Test and Prosecutor look back `RESEARCH_WINDOW_DAYS` (default 1095) instead of a
  hard-coded 180 days. With less history they use what exists. Their time limits rise from
  5 to 15 minutes.
- Calibration tests only the production rule (block bootstrap) by default; `CAL_RULES=all`
  adds the retired pre-042 rules. Workflow time limit 60 minutes.

## Synthetic check (3 years, no edge)

| Planted edge before costs | Caught (6 months) | Caught (3 years) |
|---:|---:|---:|
| 0.75% | ~50% | 85% |
| 1% | ~70–80% | 90% |
| 1.5–3% | ~80–100% | 92–97% |

Worthless edges (equal to cost): 5–10% of runs with any false survivor.

## Run order

1. Historical Data Backfill (days: 1095)
2. Historical Volume Backfill (days: 1095), for the volume families
3. Funnel Calibration

## Not in this build

- Hypotheses previously rejected on 42 days of data are not requeued automatically.
  Calibration evaluates every price hypothesis on the full history read-only, which answers
  the research question without changing their records.
- Rerunning the walk-forward miner over 3 years is optional and slower; it is only needed
  to generate new hypotheses.

## Run requests and reports

So research jobs can run and be read back without manual clicks and screenshots:

- Adding a file to `ops/run-requests/` on `main` starts the **Run Requests** workflow, which
  runs the listed jobs in order and stops at the first failure.
- Only allow-listed jobs can run (`src/ops/runRequests.ts`): `backfill-prices`,
  `backfill-volume`, `diagnose`, `calibrate`. None places trades, changes trading authority,
  or touches credentials. Anything else is rejected and reported.
- Each request's report (summary, logs, calibration and diagnostic output) is published to the
  `reports` branch under its request id. The workflow has repository write permission only so
  it can push that branch; its code only pushes `reports`.

Working agreement (Owner, 2026-09-28): research-only changes (data, statistics, reports) may be
merged and run by Claude, with a summary to the Owner. Anything touching trading, risk limits,
credentials or capital stays a pull request that only the Owner merges.

Example request:

```json
{ "note": "why", "jobs": [ { "job": "backfill-prices", "days": 1095 }, { "job": "calibrate" } ] }
```
