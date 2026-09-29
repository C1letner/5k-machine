# Build 041 — Data Integrity Fixes and Funnel Calibration

Status: research only. Nothing in this build grants or changes trading authority.

## Why

The first two industrial campaigns produced zero survivors. That result cannot be
interpreted until two things are known: (1) that each stage actually saw the data it
claims to have seen, and (2) that the funnel can detect a real edge of tradeable size
when one exists. Review of the code found several defects affecting (1), and nothing
measured (2).

## Defects fixed

1. **Discovery Test and Prosecutor loaded at most 1,000 rows per asset.**
   `series()` in `hypothesisTester.ts` and `scientificPipeline.ts` had no pagination.
   Supabase returns at most 1,000 rows per request by default, so for a 180-day window
   (~4,300 hourly rows per asset) these stages likely saw only the oldest ~41 days.
   The data-integrity diagnostic measures what the old query actually returned.
   Fix: page through results, as `historicalMiner.ts` already does.

2. **Discovery Test and Prosecutor mixed timestamp conventions.**
   The same queries had no source filter, so live snapshots (`U1`, stamped at the true
   observation time, ~:12 past the hour) could interleave with backfilled candles
   (`HIST-028`, stamped at the candle *start* but holding the candle *close*).
   Fix: read `HIST-028` only, matching the miners.

3. **FDR counted losing hypotheses as significant.** Build 033 used a two-sided p-value
   (`|z|`), so a win rate far *below* 50% produced a small p-value. Fix: one-sided test in
   the predicted direction (`src/science/stats.ts`).

4. **Prosecutor always judged at 4 hours.** A hypothesis that passed Discovery at 1h, 8h,
   12h or 24h was prosecuted at 4h. Fix: use the Discovery Test's selected horizon.

5. **Prosecutor crashed on volume hypotheses.** It reassigned a `const` (`vals = []`),
   which throws at runtime. Never triggered because no volume hypothesis passed FDR.

6. **Missing derivatives readings were treated as zero.** `historicalDerivativesMiner.ts`
   zero-filled missing funding/OI, which can turn an ordinary reading into a 2σ
   "FUNDING_EXTREME" against a run of fake zeros. Fix: missing = `NaN`, which fails closed.

## Known defects NOT fixed in this build (need an Owner decision)

- **The holdout is not held out.** `replicationLab.ts` evaluates the last 30% of history,
  but the Discovery Test and Prosecutor already used the full 180 days, including that
  30%. The record says `discoveryExcluded: true`, which is not true. The holdout stage
  also applies lead/lag logic at a fixed 12h to every family and skips single-asset
  hypotheses. It needs a redesign: discovery restricted to the first 70% of history, and
  the holdout reusing each hypothesis's own family, horizon and costs.
- **Timestamp convention.** `HIST-028` and `VOL035` rows are labeled with the candle start
  time but hold values only known one hour later. This is internally consistent within
  backfilled data, but any join with true-time data (live snapshots, CoinGlass
  derivatives) must shift backfilled rows by +1h first. Verify CoinGlass's convention
  before Phase B.
- **Entry at the signal price.** Outcomes are measured from the same close that produced
  the signal. Next-bar entry would be more conservative.
- Pre-existing type errors, including `src/discovery/anomalyScanner.ts`, which several
  modules import but which is not in the repository.

## Funnel calibration

`npm run calibrate` (or the manual **Funnel Calibration** workflow) reproduces the price-only
funnel on real `HIST-028` data for 208 hypotheses (5 single-asset families × 8 assets,
3 pair families × 56 ordered pairs), using the same event code as production
(`src/science/priceEvents.ts`).

- **Positive control:** add a known edge to one hypothesis at a time (0–3% per trade,
  before 50 bps costs) and record how often it survives Discovery, FDR and the Prosecutor.
- **Negative control:** flip event signs at random, individually and in blocks of 10
  consecutive events (to keep clustering), so no edge exists. Record how often anything
  survives anyway.
- **Real data:** the funnel's verdict under the old and new p-value rules.
- **Minimum detectable edge** at 4h per hypothesis.

It is read-only: it writes `calibration-report.json`/`.md` and a workflow summary, and
nothing to the database. `npm run diagnose:data` is likewise read-only.

## Interpreting results

If the funnel cannot recover planted edges comfortably above the 0.50% cost, the zero
survivors so far say little. If it recovers them and the negative control stays near
zero, the zero is meaningful evidence that these price families contain no tradeable edge.
If the negative control shows frequent survivors, false-discovery control is leaking and
must be replaced (block bootstrap or permutation p-values on net returns) before any
survivor is trusted.
