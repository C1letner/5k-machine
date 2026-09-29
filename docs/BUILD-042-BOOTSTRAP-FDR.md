# Build 042 — Dependence-Aware, Cost-Aware Significance

Status: research only. Nothing in this build grants or changes trading authority.

## Why

Build 041 calibration on real HIST-028 data showed the funnel could catch planted edges
comfortably above cost, but its false-discovery control leaked:

- The win-rate p-value treated clustered events as independent. With scrambled data in
  runs of 10 events, 92% of runs let at least one fake edge through the whole funnel.
- It ignored costs. With every edge set exactly at cost (worthless), about 80 hypotheses
  per run survived, because the Prosecutor only checks that the net mean is above zero,
  which a worthless edge achieves about half the time by luck.
- On the full six months, the two survivors (relative-strength divergence AVAX->LINK and
  LINK->AVAX) are the same trade counted twice, and fewer than the scrambled data produced.

## What changed

**New test** (`src/science/bootstrap.ts`): studentized circular moving-block bootstrap.

- Null: at every horizon, mean return per event is no better than the 50 bps cost.
- Statistic: the largest t-statistic of the net mean across horizons, so picking the best
  horizon is accounted for.
- Standard errors from non-overlapping blocks of 20 events; resampling in blocks of 20,
  with the same draws at every horizon, so runs of related events count as one piece of
  evidence rather than many.
- Studentizing keeps small p-values accurate. A plain bootstrap of the mean gave 1.5–3x
  too many p < 0.01; the studentized version is on target at 0.05 and 0.01.
- 4,999 resamples (p floor 0.0002), because with ~150 hypotheses at FDR 10% a lone real
  edge needs p below about 0.0007. Resampling stops early once p is clearly above 0.2,
  which can never pass FDR.
- A horizon is only testable with at least 160 events (8 full blocks). With fewer,
  clustered events leave too few independent observations; shrinking the blocks to fit
  let about 20% of heavily clustered null runs through.

**Discovery Test**: stores the bootstrap result. A hypothesis with a positive mean but too
few independent events is now INCONCLUSIVE and goes through the existing retry cooldown.

**FDR**: uses the bootstrap p-value. Discovery PASS results from before build 042 are not
judged under the old rule; their hypotheses are returned to PROPOSED for retest.

**Calibration**: adds the new rule, a harder null (edge exactly equal to cost), heavier
clustering (runs of 25), merges exact-duplicate hypotheses (mirror-image pair hypotheses
produce identical outcomes: 56 of 208), and lists the strongest real-data candidates.

## Calibration on synthetic data (no edge), block 20

| Check | Old rules (033/041) | Build 042 |
|---|---:|---:|
| Worthless edges (= cost): runs with any final survivor | 100% | 2.5–7.5% |
| Planted 0.75% gross edge caught | 73–85% | ~50–58% |
| Planted 1% gross edge caught | 93% | ~70–82% |
| Planted 1.5% gross edge caught | 95–98% | ~78–100% |

The new test is stricter: it requires evidence that an edge beats costs, not just a
positive average. Some planted edges are missed because their hypothesis has fewer than
160 events and is inconclusive. More history (several years of hourly candles are
available from Coinbase) is the main way to recover power.

## Known limitations

- The Prosecutor still uses point estimates (net mean, median, trimmed mean) at 50 bps.
- Hypotheses previously rejected on 42 days of data (pre-041) are not retested automatically.
- The holdout redesign from build 041 is still outstanding.
