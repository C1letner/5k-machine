// Build 042: dependence-aware significance test for a hypothesis's net-of-cost edge.
//
// Replaces the win-rate p-value (builds 033/041), which treated clustered events as
// independent and did not account for costs. Build 041 calibration: with clustered
// events, most scrambled runs produced at least one false survivor; with every edge set
// exactly at cost (worthless), ~80 hypotheses per run survived the whole funnel.
//
// Null hypothesis: at every horizon tested, the mean return per event is no better than
// the round-trip cost. Test statistic: the largest studentized net mean across horizons,
//     T = max_h (mean_h - cost) / se_h,
// so choosing the best horizon is accounted for. se_h uses non-overlapping block (batch)
// means, so runs of related events are not counted as independent evidence.
// Null distribution: studentized circular moving-block bootstrap (bootstrap-t),
//     T* = max_h (mean*_h - mean_h) / se*_h,
// with the same block draws across horizons (the k-th event is the same trigger at every
// horizon). Studentizing keeps the extreme tail accurate, which matters because FDR across
// ~150 hypotheses turns on p-values below 0.001. (The plain bootstrap of the mean gave
// roughly 1.5-3x too many p < 0.01 in calibration.)
import { rng } from "./rng.js";

// resamples: with ~150 hypotheses at FDR 10%, a lone discovery needs p below ~0.0007,
// so the test must be able to report p that small: 4,999 resamples gives a floor of 0.0002.
// stopAbove: once the running p-value is clearly above this (100+ exceedances), stop early.
// Such a hypothesis cannot pass FDR at 10% (q >= p), so the exact value does not matter.
export type BootstrapOptions = { costBps: number; minEvents: number; block: number; resamples: number; seed: number; stopAbove: number };
export const BOOTSTRAP_DEFAULTS: BootstrapOptions = { costBps: 50, minEvents: 30, block: 20, resamples: 4999, seed: 42, stopAbove: 0.2 };

export type BootstrapResult = {
  p: number;
  statistic: number | null; // max studentized net mean
  horizon: number | null; // horizon achieving it
  netMean: number | null; // mean return minus cost at that horizon (fraction, e.g. 0.004 = 0.4%)
  horizonsTested: number[];
  resamples: number;
  stoppedEarly: boolean;
};

/** Stable 32-bit seed from a string (e.g. a hypothesis key) so results are reproducible. */
export function seedFrom(text: string, base = 0) {
  let h = 2166136261 ^ base;
  for (let i = 0; i < text.length; i++) h = Math.imul(h ^ text.charCodeAt(i), 16777619);
  return h >>> 0;
}

const MIN_BLOCKS = 8;

export function blockBootstrapPValue(outcomes: Record<number, number[]>, options: Partial<BootstrapOptions> = {}): BootstrapResult {
  const o = { ...BOOTSTRAP_DEFAULTS, ...options };
  const cost = o.costBps / 10000;
  // A horizon is testable only with enough events for MIN_BLOCKS full blocks. With fewer, clustered
  // events leave too few independent observations to judge (build 042 calibration: shrinking blocks
  // to fit small samples let ~20% of scrambled runs through when events arrived in runs of 25).
  const needed = Math.max(o.minEvents, MIN_BLOCKS * o.block);
  const hs = Object.keys(outcomes).map(Number).filter((h) => (outcomes[h]?.length ?? 0) >= needed).sort((a, b) => a - b);
  const none: BootstrapResult = { p: 1, statistic: null, horizon: null, netMean: null, horizonsTested: [], resamples: 0, stoppedEarly: false };
  if (!hs.length) return none;

  // Per horizon: batch-means standard error over full blocks, and prefix sums for resampling.
  const per = hs.map((h) => {
    const x = outcomes[h], n = x.length, b = o.block, k = Math.floor(n / b);
    const P = new Float64Array(n + 1);
    for (let i = 0; i < n; i++) P[i + 1] = P[i] + x[i];
    const m = P[n] / n;
    let ss = 0;
    for (let j = 0; j < k; j++) { const bm = (P[(j + 1) * b] - P[j * b]) / b; ss += (bm - m) ** 2; }
    const se = Math.sqrt(ss / (k - 1) / k);
    return { h, n, m, b, k, P, se };
  }).filter((q) => q.se > 0);
  if (!per.length) return { ...none, horizonsTested: hs };

  let statistic = -Infinity, best = per[0];
  for (const q of per) { const t = (q.m - cost) / q.se; if (t > statistic) { statistic = t; best = q; } }

  const r = rng(o.seed), kMax = Math.max(...per.map((q) => q.k)), starts = new Float64Array(kMax);
  const means = new Float64Array(kMax);
  let atLeast = 0;
  for (let rep = 0; rep < o.resamples; rep++) {
    for (let j = 0; j < kMax; j++) starts[j] = r();
    let tMax = -Infinity;
    for (const q of per) {
      let sum = 0;
      for (let j = 0; j < q.k; j++) {
        const s = Math.floor(starts[j] * q.n), e = s + q.b;
        const bs = e <= q.n ? q.P[e] - q.P[s] : q.P[q.n] - q.P[s] + q.P[e - q.n];
        means[j] = bs / q.b;
        sum += means[j];
      }
      const mStar = sum / q.k;
      let ss = 0;
      for (let j = 0; j < q.k; j++) ss += (means[j] - mStar) ** 2;
      const seStar = Math.sqrt(ss / (q.k - 1) / q.k);
      if (seStar > 0) { const t = (mStar - q.m) / seStar; if (t > tMax) tMax = t; }
    }
    if (tMax >= statistic) atLeast++;
    if (atLeast >= 100 && atLeast / (rep + 1) > o.stopAbove)
      return { p: (1 + atLeast) / (rep + 2), statistic, horizon: best.h, netMean: best.m - cost, horizonsTested: hs, resamples: rep + 1, stoppedEarly: true };
  }
  return { p: (1 + atLeast) / (o.resamples + 1), statistic, horizon: best.h, netMean: best.m - cost, horizonsTested: hs, resamples: o.resamples, stoppedEarly: false };
}
