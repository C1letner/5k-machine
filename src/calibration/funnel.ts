// Build 041: funnel calibration core. Pure functions, no database access.
//
// Question answered: if a real edge of size X existed in our data, would the funnel
// (Discovery Test -> Benjamini–Hochberg FDR -> Prosecutor) let it through? And when
// no edge exists, how often does something get through anyway?
//
// The stages below mirror production:
//   Discovery  = hypothesisTester.ts   (best horizon with n >= 30, PASS if best mean > 0)
//   FDR        = falseDiscoveryControl.ts (win-rate p-value on best horizon, BH over PASS set, alpha 10%)
//   Prosecutor = scientificPipeline.ts + adversarialScientist.ts (50 bps, at the discovery horizon)
import { adversarialReview } from "../discovery/adversarialScientist.js";
import { HORIZONS, PAIR_FAMILIES, SINGLE_FAMILIES, mean, pairEvents, sd, singleEvents, type Pt } from "../science/priceEvents.js";
import { bhQValues, winRatePValueOneSided, winRatePValueTwoSided } from "../science/stats.js";

export type Config = { id: string; family: string; a: string; b?: string };
export type Outcomes = Record<number, number[]>; // horizon (hours) -> directional returns per event
export type PValueRule = "two-sided (pre-041)" | "one-sided (041)";

export const DEFAULTS = { minEvents: 30, fdrAlpha: 0.1, costBps: 50 };

/** Deterministic PRNG so every run of the report is reproducible. */
export function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function buildConfigs(assets: string[]): Config[] {
  const out: Config[] = [];
  for (const f of SINGLE_FAMILIES) for (const a of assets) out.push({ id: `${f}:${a}`, family: f, a });
  for (const f of PAIR_FAMILIES) for (const a of assets) for (const b of assets) if (a !== b) out.push({ id: `${f}:${a}->${b}`, family: f, a, b });
  return out;
}

export function computeOutcomes(series: Record<string, Pt[]>, c: Config): Outcomes {
  const o: Outcomes = {};
  for (const h of HORIZONS) o[h] = c.b ? pairEvents(c.family, series[c.a], series[c.b], h) : singleEvents(c.family, series[c.a], h);
  return o;
}

export type Discovery = { verdict: "PASS" | "FAIL" | "INCONCLUSIVE"; horizon?: number; n: number; mean?: number; winRate?: number };

export function discovery(o: Outcomes, minEvents = DEFAULTS.minEvents): Discovery {
  let best: Discovery | null = null;
  for (const h of HORIZONS) {
    const v = o[h] ?? [], mu = mean(v);
    if (v.length >= minEvents && mu != null && (!best || mu > best.mean!)) best = { verdict: "PASS", horizon: h, n: v.length, mean: mu, winRate: v.filter((x) => x > 0).length / v.length };
  }
  if (!best) return { verdict: "INCONCLUSIVE", n: 0 };
  return { ...best, verdict: best.mean! > 0 ? "PASS" : "FAIL" };
}

export const pValue = (d: Discovery, rule: PValueRule) =>
  d.n < 2 ? 1 : rule === "one-sided (041)" ? winRatePValueOneSided(d.winRate!, d.n) : winRatePValueTwoSided(d.winRate!, d.n);

export type StageResult = { discovery: boolean; fdr: boolean; prosecutor: boolean };

/** Run the whole funnel over a set of hypotheses. Returns per-hypothesis stage results. */
export function runFunnel(items: { id: string; o: Outcomes }[], rule: PValueRule, opts = DEFAULTS): Map<string, StageResult> {
  const disc = items.map((x) => ({ id: x.id, o: x.o, d: discovery(x.o, opts.minEvents) }));
  const passing = disc.filter((x) => x.d.verdict === "PASS");
  const q = bhQValues(passing.map((x) => pValue(x.d, rule)));
  const out = new Map<string, StageResult>();
  for (const x of disc) out.set(x.id, { discovery: x.d.verdict === "PASS", fdr: false, prosecutor: false });
  passing.forEach((x, i) => {
    if (q[i] > opts.fdrAlpha) return;
    const r = out.get(x.id)!;
    r.fdr = true;
    const v = x.o[x.d.horizon!];
    r.prosecutor = adversarialReview({ sampleSize: v.length, returns: v, costBps: opts.costBps }).verdict === "PASS";
  });
  return out;
}

export const plant = (o: Outcomes, edge: number): Outcomes =>
  Object.fromEntries(Object.entries(o).map(([h, v]) => [h, v.map((x) => x + edge)]));

/**
 * Null data with the same event magnitudes and clustering: flip the sign of events
 * in blocks of `block` consecutive events. The same flips apply at every horizon,
 * because the k-th event at each horizon is the same trigger.
 */
export function scramble(o: Outcomes, block: number, r: () => number): Outcomes {
  const maxN = Math.max(0, ...Object.values(o).map((v) => v.length));
  const signs = Array.from({ length: Math.ceil(maxN / block) }, () => (r() < 0.5 ? -1 : 1));
  return Object.fromEntries(Object.entries(o).map(([h, v]) => [h, v.map((x, k) => x * signs[Math.floor(k / block)])]));
}

export type CalibrationReport = {
  hypotheses: number;
  realData: Record<PValueRule, { discoveryPass: number; fdrPass: number; prosecutorPass: number; survivors: string[] }>;
  detection: { edgePct: number; trials: number; rule: PValueRule; discovery: number; fdr: number; prosecutor: number }[];
  nullControl: { block: number; runs: number; rule: PValueRule; meanFdrSurvivors: number; meanProsecutorSurvivors: number; runsWithAnyFinalSurvivor: number }[];
  minimumDetectableEdge: { medianPct: number; p25Pct: number; p75Pct: number; shareAboveCostPct: number; note: string };
};

export function calibrate(
  series: Record<string, Pt[]>,
  opts: { edgesPct?: number[]; trialsPerEdge?: number; nullRuns?: number; blocks?: number[]; seed?: number } = {},
): CalibrationReport {
  const edgesPct = opts.edgesPct ?? [0, 0.1, 0.25, 0.5, 0.75, 1, 1.5, 2, 3];
  const trials = opts.trialsPerEdge ?? 60, nullRuns = opts.nullRuns ?? 200, blocks = opts.blocks ?? [1, 10], seed = opts.seed ?? 41;
  const rules: PValueRule[] = ["two-sided (pre-041)", "one-sided (041)"];

  const configs = buildConfigs(Object.keys(series).sort());
  const items = configs.map((c) => ({ id: c.id, o: computeOutcomes(series, c) }));

  // 1. What the funnel says about the real data under each p-value rule.
  const realData = {} as CalibrationReport["realData"];
  for (const rule of rules) {
    const res = runFunnel(items, rule);
    const v = [...res.entries()];
    realData[rule] = {
      discoveryPass: v.filter(([, r]) => r.discovery).length,
      fdrPass: v.filter(([, r]) => r.fdr).length,
      prosecutorPass: v.filter(([, r]) => r.prosecutor).length,
      survivors: v.filter(([, r]) => r.prosecutor).map(([id]) => id),
    };
  }

  // 2. Positive control: plant an edge in ONE hypothesis at a time; everything else stays real.
  const detection: CalibrationReport["detection"] = [];
  const eligible = items.filter((x) => Object.values(x.o).some((v) => v.length >= DEFAULTS.minEvents));
  for (const rule of rules) {
    const r = rng(seed);
    for (const e of edgesPct) {
      let d = 0, f = 0, p = 0;
      for (let t = 0; t < trials; t++) {
        const target = eligible[Math.floor(r() * eligible.length)];
        const trialItems = items.map((x) => (x.id === target.id ? { id: x.id, o: plant(x.o, e / 100) } : x));
        const s = runFunnel(trialItems, rule).get(target.id)!;
        d += +s.discovery; f += +s.fdr; p += +s.prosecutor;
      }
      detection.push({ edgePct: e, trials, rule, discovery: d / trials, fdr: f / trials, prosecutor: p / trials });
    }
  }

  // 3. Negative control: scrambled signs, so no hypothesis has a real edge.
  const nullControl: CalibrationReport["nullControl"] = [];
  for (const rule of rules) for (const block of blocks) {
    const r = rng(seed + block);
    let fdrSum = 0, proSum = 0, any = 0;
    for (let k = 0; k < nullRuns; k++) {
      const res = [...runFunnel(items.map((x) => ({ id: x.id, o: scramble(x.o, block, r) })), rule).values()];
      const nf = res.filter((x) => x.fdr).length, np = res.filter((x) => x.prosecutor).length;
      fdrSum += nf; proSum += np; any += np > 0 ? 1 : 0;
    }
    nullControl.push({ block, runs: nullRuns, rule, meanFdrSurvivors: fdrSum / nullRuns, meanProsecutorSurvivors: proSum / nullRuns, runsWithAnyFinalSurvivor: any / nullRuns });
  }

  // 4. Minimum detectable edge at 4h: ~2.49 standard errors (one-sided 5%, 80% power), ignoring overlap.
  const mde = items.map((x) => x.o[4]).filter((v) => v.length >= DEFAULTS.minEvents).map((v) => (2.49 * sd(v)) / Math.sqrt(v.length)).sort((a, b) => a - b);
  const q = (p: number) => (mde.length ? mde[Math.min(mde.length - 1, Math.floor(p * mde.length))] * 100 : NaN);
  const minimumDetectableEdge = {
    medianPct: q(0.5), p25Pct: q(0.25), p75Pct: q(0.75),
    shareAboveCostPct: mde.length ? (mde.filter((m) => m > DEFAULTS.costBps / 10000).length / mde.length) * 100 : NaN,
    note: "Treats overlapping events as independent, so the true minimum detectable edge is larger than shown.",
  };

  return { hypotheses: items.length, realData, detection, nullControl, minimumDetectableEdge };
}
