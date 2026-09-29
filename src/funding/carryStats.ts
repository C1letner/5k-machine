// Build 046: funding-leg statistics for a short-perpetual position. Pure functions, no I/O.
//
// RAW FUNDING ONLY. These numbers are the funding a short perpetual would have received per unit of
// notional. They are NOT the return of a delta-neutral carry trade, which also depends on spot/perp basis
// changes, trading fees and spread on both legs, rebalancing as the hedge drifts, collateral haircuts and
// idle cash, and exchange/stablecoin risk. None of those are modeled here.
export type Obs = { t: number; relative: number }; // relative = fraction of notional per period, + = shorts receive
const YEAR_MS = 365.25 * 86400_000, DAY = 86400_000;

export type FundingStats = {
  observations: number; first: string | null; last: string | null; years: number;
  cumulativeFunding: number; annualizedFunding: number | null; meanPerPeriod: number | null;
  positivePct: number; negativePct: number; zeroPct: number;
  maxFundingDrawdown: number; maxDrawdownDays: number; longestNegativeStreakHours: number;
  worst30dFunding: number | null; best30dFunding: number | null;
};

export function fundingStats(rows: Obs[]): FundingStats {
  const a = [...rows].sort((x, y) => x.t - y.t), n = a.length;
  const first = a[0]?.t, last = a.at(-1)?.t;
  // Each observation covers one period starting at t, so the covered span ends one period after the last start.
  const period = n > 1 ? medianStep(a) : 3600_000;
  const years = n ? (last! - first! + period) / YEAR_MS : 0;
  let sum = 0, pos = 0, neg = 0, zero = 0, peak = 0, maxDD = 0, maxDDdays = 0, peakT = first ?? 0, streak = 0, maxStreak = 0;
  for (const x of a) {
    sum += x.relative;
    if (x.relative > 0) pos++; else if (x.relative < 0) neg++; else zero++;
    streak = x.relative < 0 ? streak + 1 : 0; maxStreak = Math.max(maxStreak, streak);
    if (sum >= peak) { peak = sum; peakT = x.t; }
    const dd = sum - peak;
    if (dd < maxDD) maxDD = dd;
    if (dd < 0) maxDDdays = Math.max(maxDDdays, (x.t - peakT) / DAY);
  }
  // Rolling 30-day funding (by time, not count, so gaps do not distort it).
  let worst: number | null = null, best: number | null = null, j = 0, win = 0;
  for (let i = 0; i < n; i++) {
    win += a[i].relative;
    while (a[i].t - a[j].t >= 30 * DAY) { win -= a[j].relative; j++; }
    if (a[i].t - first! >= 30 * DAY - period) { worst = worst == null ? win : Math.min(worst, win); best = best == null ? win : Math.max(best, win); }
  }
  return {
    observations: n, first: n ? new Date(first!).toISOString() : null, last: n ? new Date(last!).toISOString() : null,
    years: Math.round(years * 1000) / 1000, cumulativeFunding: sum, annualizedFunding: years ? sum / years : null, meanPerPeriod: n ? sum / n : null,
    positivePct: n ? pos / n : 0, negativePct: n ? neg / n : 0, zeroPct: n ? zero / n : 0,
    maxFundingDrawdown: maxDD, maxDrawdownDays: Math.round(maxDDdays * 10) / 10, longestNegativeStreakHours: maxStreak,
    worst30dFunding: worst, best30dFunding: best,
  };
}

function medianStep(a: Obs[]) {
  const d: number[] = [];
  for (let i = 1; i < a.length; i++) if (a[i].t > a[i - 1].t) d.push(a[i].t - a[i - 1].t);
  d.sort((x, y) => x - y);
  return d.length ? d[Math.floor(d.length / 2)] : 3600_000;
}

export function byYear(rows: Obs[]) {
  const m = new Map<number, Obs[]>();
  for (const x of rows) { const y = new Date(x.t).getUTCFullYear(); (m.get(y) ?? m.set(y, []).get(y)!).push(x); }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([year, r]) => {
    const s = fundingStats(r);
    return { year, observations: s.observations, cumulativeFunding: s.cumulativeFunding, annualizedFunding: s.annualizedFunding, positivePct: s.positivePct, maxFundingDrawdown: s.maxFundingDrawdown };
  });
}

/**
 * A simple no-look-ahead filter: hold the short only when the trailing mean funding over the previous
 * `lookbackHours` periods (strictly before t) is positive. Reports funding collected and how often the
 * position would switch, since each switch costs fees on both legs in reality (not deducted here).
 */
export function trailingSignFilter(rows: Obs[], lookbackHours = 168) {
  const a = [...rows].sort((x, y) => x.t - y.t);
  let held = 0, switches = 0, prev = false, sum = 0;
  const heldRows: Obs[] = [];
  for (let i = 0; i < a.length; i++) {
    // Sum the window directly each step: a running sum drifts and can turn an exact zero positive.
    let win = 0;
    if (i >= lookbackHours) for (let k = i - lookbackHours; k < i; k++) win += a[k].relative;
    const on = i >= lookbackHours && win > 1e-15;
    if (i >= lookbackHours && on !== prev) switches++;
    if (on) { held++; sum += a[i].relative; heldRows.push(a[i]); }
    prev = on;
  }
  const eligible = Math.max(0, a.length - lookbackHours);
  const s = fundingStats(a.slice(lookbackHours));
  return {
    lookbackHours, eligiblePeriods: eligible, periodsHeld: held, fractionHeld: eligible ? held / eligible : 0, switches,
    fundingCollected: sum, annualizedOverFullPeriod: s.years ? sum / s.years : null,
    alwaysOnFundingSamePeriod: s.cumulativeFunding, heldPeriodStats: fundingStats(heldRows),
  };
}
