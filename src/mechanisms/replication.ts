// Build 048: helpers for the untouched-history replication of the frozen slow trend. Pure functions.
// Rules are fixed in docs/BUILD-048-PREREGISTRATION.md (commit cf7f5f67).
import { DEFAULT_TREND } from "./slowTrend.js";
import { perf, type Day, type TrendDay } from "./trendEconomics.js";

export const CUTOFF_MS = Date.parse("2023-09-30T00:00:00Z");
export const WARMUP = Math.max(DEFAULT_TREND.lookbackDays, DEFAULT_TREND.volDays) + 1; // 91, as in simulateTrend
export const MIN_DECISIONS = 365;
const DAY = 86400_000;
const dateOf = (t: number) => new Date(t).toISOString().slice(0, 10);
const nextDate = (d: string) => dateOf(Date.parse(d + "T00:00:00Z") + DAY);

/**
 * Daily records from hourly candles (candle-start timestamps), restricted to before the cutoff.
 * signal = last close of the UTC date; exec = the next candle's close, which must fall on the following date
 * (otherwise the day is invalid: its execution would cross a data gap).
 */
export function dailyRecords(hourly: { t: number; p: number }[], cutoffMs = CUTOFF_MS): Day[] {
  const h = hourly.filter((x) => x.t < cutoffMs).sort((a, b) => a.t - b.t);
  const lastIdx = new Map<string, number>();
  h.forEach((x, i) => lastIdx.set(dateOf(x.t), i));
  const out: Day[] = [];
  for (const [d, i] of [...lastIdx.entries()].sort()) if (i + 1 < h.length && dateOf(h[i + 1].t) === nextDate(d)) out.push({ t: h[i].t, signal: h[i].p, exec: h[i + 1].p });
  return out;
}

/** Split into runs of consecutive UTC dates; a missing date ends a run. */
export function segments(days: Day[]): Day[][] {
  const out: Day[][] = [];
  for (const d of days) {
    const cur = out.at(-1);
    if (cur && dateOf(d.t) === nextDate(dateOf(cur.at(-1)!.t))) cur.push(d); else out.push([d]);
  }
  return out;
}

/** Longest segment (earliest on ties) and the preregistered eligibility decision. */
export function eligibility(days: Day[]) {
  const segs = segments(days), longest = segs.reduce((b, s) => (s.length > b.length ? s : b), [] as Day[]);
  const decisions = Math.max(0, longest.length - WARMUP - 1); // simulateTrend decides for i in [WARMUP, len-2]
  return {
    segmentCount: segs.length, longest, longestDates: longest.length, decisions,
    first: longest.length ? dateOf(longest[0].t) : null, last: longest.length ? dateOf(longest.at(-1)!.t) : null,
    eligible: decisions >= MIN_DECISIONS,
    otherSegments: segs.filter((s) => s !== longest).map((s) => ({ first: dateOf(s[0].t), last: dateOf(s.at(-1)!.t), dates: s.length })),
  };
}

/** Equal weight across sleeves ACTIVE on each date (preregistered for staggered listings). */
export function equalWeightActive(sleeves: TrendDay[][]) {
  const byT = new Map<string, { g: number[]; n: number[]; turn: number[]; cost: number[] }>();
  for (const s of sleeves) for (const d of s) {
    const k = dateOf(d.t), e = byT.get(k) ?? byT.set(k, { g: [], n: [], turn: [], cost: [] }).get(k)!;
    e.g.push(d.grossReturn); e.n.push(d.netReturn); e.turn.push(d.turnover); e.cost.push(d.cost);
  }
  const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  return [...byT.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([k, e]) => ({ t: Date.parse(k + "T00:00:00Z"), active: e.n.length, grossReturn: avg(e.g), netReturn: avg(e.n), turnover: avg(e.turn), cost: avg(e.cost) }));
}

/** Compounded net and gross return by calendar year. */
export function calendarYears(rows: { t: number; netReturn: number; grossReturn: number }[]) {
  const m = new Map<number, { n: number; g: number; days: number }>();
  for (const r of rows) { const y = new Date(r.t).getUTCFullYear(), e = m.get(y) ?? m.set(y, { n: 1, g: 1, days: 0 }).get(y)!; e.n *= 1 + r.netReturn; e.g *= 1 + r.grossReturn; e.days++; }
  return [...m.entries()].sort((a, b) => a[0] - b[0]).map(([year, e]) => ({ year, days: e.days, net: e.n - 1, gross: e.g - 1 }));
}

/** Preregistered classification on the portfolio. */
export function classify(rows: { t: number; netReturn: number; grossReturn: number }[], p: number) {
  const all = perf(rows as any), mid = rows.length ? rows[0].t + (rows.at(-1)!.t - rows[0].t) / 2 : 0;
  const h1 = perf(rows.filter((r) => r.t < mid) as any), h2 = perf(rows.filter((r) => r.t >= mid) as any);
  const sharpe = all.sharpe ?? -Infinity, cagr = all.cagr ?? -Infinity, bothHalves = h1.netCumulative > 0 && h2.netCumulative > 0;
  const label = sharpe >= 0.5 && p < 0.05 && bothHalves ? "REPLICATION PASS" : cagr <= 0 || sharpe < 0.2 ? "REPLICATION FAIL" : "REPLICATION INCONCLUSIVE";
  return { label, sharpe: all.sharpe, cagr: all.cagr, p, bothHalvesPositive: bothHalves, splitAt: dateOf(mid), firstHalf: h1, secondHalf: h2 };
}

const H = 3600_000;
/** Hourly integrity: duplicates, missing hours, gaps > 24h, and any row at/after the cutoff (must be zero). */
export function integrity(rows: { t: number; p: number }[]) {
  const s = [...rows].sort((a, b) => a.t - b.t);
  let dup = 0, missing = 0, afterCutoff = 0, offGrid = 0, badPrice = 0;
  const gaps: { after: string; before: string; hours: number }[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i].t >= CUTOFF_MS) afterCutoff++;
    if (s[i].t % H) offGrid++;
    if (!(s[i].p > 0)) badPrice++;
    if (!i) continue;
    const d = (s[i].t - s[i - 1].t) / H;
    if (d === 0) dup++; else if (d > 1) { missing += d - 1; if (d > 24) gaps.push({ after: new Date(s[i - 1].t).toISOString(), before: new Date(s[i].t).toISOString(), hours: d }); }
  }
  const span = s.length ? (s.at(-1)!.t - s[0].t) / H + 1 : 0;
  return { first: s[0] ? new Date(s[0].t).toISOString() : null, last: s.at(-1) ? new Date(s.at(-1)!.t).toISOString() : null, observations: s.length, duplicates: dup, missingHours: missing,
    completenessPct: span ? Math.round(((s.length - dup) / span) * 10000) / 100 : 0, majorGapsOver24h: gaps.length, largestGaps: [...gaps].sort((a, b) => b.hours - a.hours).slice(0, 5),
    rowsAtOrAfterCutoff: afterCutoff, offGridTimestamps: offGrid, nonPositivePrices: badPrice };
}

/** Page through a query 1,000 rows at a time until a short page (Supabase's default cap is 1,000 rows). */
export async function pageAll<T>(fetchPage: (from: number, to: number) => Promise<T[]>, page = 1000): Promise<T[]> {
  const out: T[] = [];
  for (let f = 0; ; f += page) {
    const rows = await fetchPage(f, f + page - 1);
    out.push(...rows);
    if (rows.length < page) return out;
  }
}
