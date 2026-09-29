// Build 041: pure event logic shared by the Discovery Test (hypothesisTester.ts)
// and the funnel calibration harness. Moved verbatim from hypothesisTester.ts so
// both use exactly the same trigger and outcome definitions. No database access.

export type Pt = { t: number; p: number };

export const ret = (a: number, b: number) => b / a - 1;
export const mean = (a: number[]) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : null);
export const sd = (a: number[]) => {
  const m = mean(a);
  return m == null ? 0 : Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / a.length);
};

export const SINGLE_FAMILIES = [
  "SHORT_MOMENTUM",
  "MOMENTUM_REVERSAL",
  "RETURN_OUTLIER",
  "VOLATILITY_EXPANSION",
  "VOLATILITY_COMPRESSION",
] as const;

export const PAIR_FAMILIES = [
  "LEAD_LAG_UNDERREACTION",
  "RELATIVE_STRENGTH_DIVERGENCE",
  "CORRELATION_BREAKDOWN",
] as const;

export const HORIZONS = [1, 4, 8, 12, 24] as const;

/** Directional outcomes for a single-asset family at one horizon. */
export function singleEvents(family: string, a: Pt[], horizon: number): number[] {
  const vals: number[] = [];
  const rs = a.slice(1).map((x, i) => ret(a[i].p, x.p));
  for (let i = 24; i + horizon < a.length; i++) {
    const r1 = ret(a[i - 1].p, a[i].p),
      r4 = i >= 4 ? ret(a[i - 4].p, a[i].p) : 0,
      r12 = i >= 12 ? ret(a[i - 12].p, a[i].p) : 0,
      prior = rs.slice(Math.max(0, i - 24), i),
      m = mean(prior.map(Math.abs)) ?? 0,
      s = sd(prior.map(Math.abs)),
      z = s ? (Math.abs(r1) - m) / s : 0,
      v6 = sd(rs.slice(Math.max(0, i - 6), i)),
      v24 = sd(prior),
      ratio = v24 ? v6 / v24 : 1;
    let trig = false,
      dir = 1;
    if (family === "SHORT_MOMENTUM") {
      trig = Math.abs(r4) >= 0.015;
      dir = r4 > 0 ? 1 : -1;
    } else if (family === "MOMENTUM_REVERSAL") {
      trig = Math.sign(r4) !== Math.sign(r12) && Math.abs(r4) >= 0.01 && Math.abs(r12) >= 0.015;
      dir = r4 > 0 ? 1 : -1;
    } else if (family === "RETURN_OUTLIER") {
      trig = Math.abs(z) >= 2;
      dir = r1 > 0 ? 1 : -1;
    } else if (family === "VOLATILITY_EXPANSION") {
      trig = ratio >= 1.6;
      dir = r4 >= 0 ? 1 : -1;
    } else if (family === "VOLATILITY_COMPRESSION") {
      trig = ratio <= 0.55;
      dir = r4 >= 0 ? 1 : -1;
    }
    if (trig) vals.push(ret(a[i].p, a[i + horizon].p) * dir);
  }
  return vals;
}

export function corr(a: number[], b: number[]) {
  const n = Math.min(a.length, b.length);
  if (n < 3) return 0;
  const x = a.slice(-n),
    y = b.slice(-n),
    mx = mean(x) ?? 0,
    my = mean(y) ?? 0,
    sx = sd(x),
    sy = sd(y);
  return sx && sy ? x.reduce((s, v, i) => s + (v - mx) * (y[i] - my), 0) / n / (sx * sy) : 0;
}

/** Directional outcomes for a two-asset family at one horizon. */
export function pairEvents(family: string, a: Pt[], b: Pt[], horizon: number): number[] {
  const bm = new Map(b.map((x) => [x.t, x.p])),
    r = a.filter((x) => bm.has(x.t)).map((x) => ({ t: x.t, a: x.p, b: bm.get(x.t)! })),
    vals: number[] = [];
  for (let i = 25; i + horizon < r.length; i++) {
    const a1 = ret(r[i - 1].a, r[i].a),
      b1 = ret(r[i - 1].b, r[i].b),
      a4 = ret(r[i - 4].a, r[i].a),
      b4 = ret(r[i - 4].b, r[i].b);
    let trig = false,
      dir = 1;
    if (family === "LEAD_LAG_UNDERREACTION") {
      trig = Math.abs(a1) >= 0.005 && Math.abs(b1) <= Math.abs(a1) * 0.75;
      dir = a1 > 0 ? 1 : -1;
    } else if (family === "RELATIVE_STRENGTH_DIVERGENCE") {
      trig = Math.abs(a4 - b4) >= 0.02;
      dir = a4 - b4 > 0 ? 1 : -1;
    } else if (family === "CORRELATION_BREAKDOWN") {
      const ar = [],
        br = [];
      for (let j = i - 24; j < i; j++) {
        ar.push(ret(r[j - 1].a, r[j].a));
        br.push(ret(r[j - 1].b, r[j].b));
      }
      const c24 = corr(ar, br),
        c6 = corr(ar.slice(-6), br.slice(-6));
      trig = Math.abs(c24) >= 0.6 && Math.abs(c6 - c24) >= 0.6;
      dir = a4 - b4 > 0 ? 1 : -1;
    }
    if (trig) {
      const target =
        family === "LEAD_LAG_UNDERREACTION"
          ? ret(r[i].b, r[i + horizon].b) * dir
          : (ret(r[i].b, r[i + horizon].b) - ret(r[i].a, r[i + horizon].a)) * dir * -1;
      vals.push(target);
    }
  }
  return vals;
}
