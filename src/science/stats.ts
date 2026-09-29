// Build 041: statistics shared by false-discovery control and the calibration harness.

export function erf(x: number) {
  const s = x < 0 ? -1 : 1,
    a = Math.abs(x),
    t = 1 / (1 + 0.3275911 * a),
    y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-a * a);
  return s * y;
}

export const normalCdf = (z: number) => 0.5 * (1 + erf(z / Math.sqrt(2)));

/**
 * Build 033 (original): two-sided p-value on win rate. A win rate far BELOW 50%
 * produced a small p-value, so hypotheses that mostly lose could pass FDR.
 * Kept only so calibration can report how the old rule behaved.
 */
export function winRatePValueTwoSided(winRate: number, n: number) {
  if (n < 2) return 1;
  const z = (winRate - 0.5) / Math.sqrt(0.25 / n);
  return Math.max(0, Math.min(1, 2 * (1 - normalCdf(Math.abs(z)))));
}

/**
 * Build 041: one-sided p-value. Only evidence in the predicted direction
 * (win rate above 50%) counts as support.
 */
export function winRatePValueOneSided(winRate: number, n: number) {
  if (n < 2) return 1;
  const z = (winRate - 0.5) / Math.sqrt(0.25 / n);
  return Math.max(0, Math.min(1, 1 - normalCdf(z)));
}

/** Benjamini–Hochberg q-values, returned in the input order. */
export function bhQValues(p: number[]): number[] {
  const s = p.map((x, i) => ({ p: x, i })).sort((a, b) => a.p - b.p),
    m = s.length,
    out = Array<number>(m);
  let prev = 1;
  for (let k = m - 1; k >= 0; k--) {
    const q = Math.min(prev, (s[k].p * m) / (k + 1), 1);
    out[s[k].i] = q;
    prev = q;
  }
  return out;
}
