// Build 047B: exploratory one-year funding analysis. Pure functions.
// Mode: EXPLORATORY / INSUFFICIENT HISTORY / NOT VALIDATION. Figures are RAW FUNDING COMPENSATION to a short
// perpetual per unit notional, never strategy profit. See docs/BUILD-047-PREREGISTRATION.md.
import { assess, completeness, EXPECTED_INTERVAL_MS, SOURCE_TAG } from "./kraken.js";

export const MODE = "EXPLORATORY_INSUFFICIENT_HISTORY_NOT_VALIDATION" as const;
export const PERMANENT_MIN_DAYS = 730;
export type Obs = { t: number; relative: number };
const H = 3600_000, YEAR_H = 8766;

/** Exploratory output can never promote a strategy: requires validation mode AND the permanent history gate. */
export function canPromote(mode: string, coverageDays: number) {
  return mode === "VALIDATION" && coverageDays >= PERMANENT_MIN_DAYS;
}

export type StoredRow = { observed_at: string; asset: string; instrument: string; funding_rate: number | null; source: string | null; sensor_version: string };

/** Data-quality checks on stored rows; `problems` non-empty means stop. */
export function validateStored(rows: StoredRow[], expected: { asset: string; instrument: string }) {
  const problems: string[] = [];
  const obs = rows.filter((r) => r.funding_rate != null).map((r) => ({ t: Date.parse(r.observed_at), relative: Number(r.funding_rate) }));
  const sources = [...new Set(rows.map((r) => r.source))], assets = [...new Set(rows.map((r) => r.asset))], instruments = [...new Set(rows.map((r) => r.instrument))];
  if (sources.length !== 1 || sources[0] !== SOURCE_TAG) problems.push(`source/metadata tag disagrees with documented Kraken semantics: ${JSON.stringify(sources)}`);
  if (assets.length !== 1 || assets[0] !== expected.asset) problems.push(`asset mapping ${JSON.stringify(assets)} != ${expected.asset}`);
  if (instruments.length !== 1 || instruments[0] !== expected.instrument) problems.push(`instrument mapping ${JSON.stringify(instruments)} != ${expected.instrument}`);
  if (rows.length !== obs.length) problems.push(`${rows.length - obs.length} rows with null funding_rate`);
  const c = completeness(obs), s = [...obs].sort((a, b) => a.t - b.t);
  const intervals = new Map<number, number>();
  for (let i = 1; i < s.length; i++) { const d = (s[i].t - s[i - 1].t) / H; intervals.set(d, (intervals.get(d) ?? 0) + 1); }
  const intervalChanges = [...intervals.entries()].filter(([d]) => d !== 1).map(([hours, count]) => ({ hours, count }));
  if (c.duplicates) problems.push(`${c.duplicates} duplicate timestamps`);
  if (c.offGridTimestamps) problems.push(`${c.offGridTimestamps} timestamps off the hour`);
  if (c.outOfBoundsRates) problems.push(`${c.outOfBoundsRates} rates beyond the documented +/-0.5%/h cap`);
  const permanentGate = assess(c, PERMANENT_MIN_DAYS);
  return { ok: problems.length === 0, problems, completeness: c, intervalChanges, permanentGate, obs: s };
}

const median = (a: number[]) => { const s = [...a].sort((x, y) => x - y), m = s.length >> 1; return s.length ? (s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2) : NaN; };
const sd = (a: number[]) => { if (a.length < 2) return 0; const m = a.reduce((x, y) => x + y, 0) / a.length; return Math.sqrt(a.reduce((x, y) => x + (y - m) ** 2, 0) / (a.length - 1)); };
const sumBy = (rows: Obs[], key: (t: number) => string) => { const m = new Map<string, { sum: number; n: number }>(); for (const r of rows) { const k = key(r.t), e = m.get(k) ?? m.set(k, { sum: 0, n: 0 }).get(k)!; e.sum += r.relative; e.n++; } return m; };

export function fundingSummary(rows: Obs[]) {
  const a = [...rows].sort((x, y) => x.t - y.t), v = a.map((x) => x.relative), n = v.length;
  const years = n / YEAR_H; // hourly periods; YEAR_H = 365.25 x 24
  let cum = 0, peak = 0, dd = 0, pos = 0, zero = 0, neg = 0, runP = 0, runN = 0, maxP = 0, maxN = 0, growth = 1;
  for (const x of v) {
    cum += x; peak = Math.max(peak, cum); dd = Math.min(dd, cum - peak); growth *= 1 + x;
    if (x > 0) { pos++; runP++; runN = 0; } else if (x < 0) { neg++; runN++; runP = 0; } else { zero++; runP = 0; runN = 0; }
    maxP = Math.max(maxP, runP); maxN = Math.max(maxN, runN);
  }
  const days = [...sumBy(a, (t) => new Date(t).toISOString().slice(0, 10)).entries()];
  const months = [...sumBy(a, (t) => new Date(t).toISOString().slice(0, 7)).entries()].sort();
  const best = (xs: [string, { sum: number }][], dir: 1 | -1) => xs.reduce((b, x) => (b == null || dir * x[1].sum > dir * b[1].sum ? x : b), null as any);
  const bd = best(days, 1), wd = best(days, -1), bm = best(months, 1), wm = best(months, -1);
  return {
    observations: n, first: n ? new Date(a[0].t).toISOString() : null, last: n ? new Date(a[n - 1].t).toISOString() : null, years: Math.round(years * 1000) / 1000,
    meanPerHour: n ? cum / n : null, medianPerHour: n ? median(v) : null, sdPerHour: sd(v),
    positivePct: n ? pos / n : 0, zeroPct: n ? zero / n : 0, negativePct: n ? neg / n : 0,
    cumulative: cum, simpleAnnualized: years ? cum / years : null,
    compoundedAnnualized: years && growth > 0 ? growth ** (1 / years) - 1 : null, // only meaningful if funding is reinvested hourly
    bestDay: bd && { date: bd[0], funding: bd[1].sum }, worstDay: wd && { date: wd[0], funding: wd[1].sum },
    bestMonth: bm && { month: bm[0], funding: bm[1].sum }, worstMonth: wm && { month: wm[0], funding: wm[1].sum },
    longestPositiveStreakHours: maxP, longestNegativeStreakHours: maxN, maxCumulativeDrawdown: dd,
    monthly: months.map(([month, e]) => ({ month, funding: e.sum, hours: e.n })),
  };
}

export type Rule = "always" | "prevHourPositive" | "trailing24hAbove10pct";
export const THRESHOLD_PER_HOUR = 0.1 / YEAR_H; // 10% per year simple, preregistered

/** Funding collected under a preregistered exposure rule; decisions use only rates settled before the hour. */
export function applyRule(rows: Obs[], rule: Rule) {
  const a = [...rows].sort((x, y) => x.t - y.t), out: Obs[] = [];
  let switches = 0, exposed = 0, prev: boolean | null = null, eligible = 0;
  for (let i = 0; i < a.length; i++) {
    let on: boolean | null;
    if (rule === "always") on = true;
    else if (rule === "prevHourPositive") on = i >= 1 && a[i].t - a[i - 1].t === H ? a[i - 1].relative > 0 : null;
    else { if (i < 24 || a[i].t - a[i - 24].t !== 24 * H) on = null; else { let s = 0; for (let k = i - 24; k < i; k++) s += a[k].relative; on = s / 24 > THRESHOLD_PER_HOUR; } }
    if (on == null) continue; // not enough history to decide: excluded, not counted as flat
    eligible++;
    if (prev != null && on !== prev) switches++;
    prev = on;
    if (on) exposed++;
    out.push({ t: a[i].t, relative: on ? a[i].relative : 0 });
  }
  return { rule, eligibleHours: eligible, exposedHours: exposed, fractionExposed: eligible ? exposed / eligible : 0, switches, series: out };
}

/** Equal-weight portfolio over hours present for every series. */
export function equalWeightFunding(series: Obs[][]) {
  const maps = series.map((s) => new Map(s.map((x) => [x.t, x.relative])));
  const ts = [...maps[0].keys()].filter((t) => maps.every((m) => m.has(t))).sort((a, b) => a - b);
  return { aligned: ts.length, dropped: series.map((s) => s.length - ts.length), series: ts.map((t) => ({ t, relative: maps.reduce((s, m) => s + m.get(t)!, 0) / maps.length })) };
}

/** Preregistered classification on the equal-weight portfolio, rule "always". */
export function classify(summary: ReturnType<typeof fundingSummary>) {
  const ann = summary.simpleAnnualized ?? -Infinity;
  const full = summary.monthly.filter((m) => m.hours >= 20 * 24), positiveShare = full.length ? full.filter((m) => m.funding > 0).length / full.length : 0;
  const label = ann < 0.05 ? "ECONOMICALLY UNINTERESTING" : ann > 0.15 && positiveShare >= 0.75 ? "STRONGLY INTERESTING BUT UNVALIDATED" : "INTERESTING ENOUGH TO CONTINUE COLLECTING";
  return { label, simpleAnnualized: ann, fullMonths: full.length, positiveMonthShare: positiveShare };
}

export { EXPECTED_INTERVAL_MS };
