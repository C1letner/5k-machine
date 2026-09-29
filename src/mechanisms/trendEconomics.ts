// Build 047A: position-aware economics for the Build 045 slow volatility-scaled trend. Pure functions.
//
// Strategy rule is unchanged from src/mechanisms/slowTrend.ts (90-day direction, 30-day sample volatility,
// 1% target daily vol, max 1x). What changes is the accounting:
//   - cost = costPerTurnover x |w_t - w_(t-1)|, charged when the position changes (Build 045 charged every day);
//   - execution follows Build 044's next-bar rule: the decision uses the day's signal close, and the position is
//     held between consecutive EXECUTION prices (the next available close after the signal).
import { DEFAULT_TREND, type TrendOptions } from "./slowTrend.js";

export type Day = { t: number; signal: number; exec: number }; // signal = close used to decide; exec = next close, where the trade happens
export type TrendDay = {
  t: number; direction: number; prevDirection: number; exposure: number; prevExposure: number;
  turnover: number; cost: number; grossReturn: number; netReturn: number; equity: number; grossEquity: number;
};
export type Timing = "next-bar (044)" | "same-close (045)";

const ret = (a: number, b: number) => b / a - 1;
function sampleSd(a: number[]) {
  if (a.length < 2) return 0;
  const m = a.reduce((s, x) => s + x, 0) / a.length;
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
}

/** Target exposure decided at day i using signal closes up to and including day i only. Mirrors volScaledTrend. */
export function targetExposure(signal: number[], i: number, o: TrendOptions = DEFAULT_TREND) {
  const mom = ret(signal[i - o.lookbackDays], signal[i]), dir = mom >= 0 ? 1 : -1, rets: number[] = [];
  for (let k = i - o.volDays + 1; k <= i; k++) rets.push(ret(signal[k - 1], signal[k]));
  const v = sampleSd(rets), lev = v ? Math.min(o.maxLeverage, o.targetDailyVol / v) : 0;
  return { direction: dir, exposure: dir * lev };
}

/**
 * Simulate day by day. Position decided at day i is held over period i: from exec[i] to exec[i+1] (next-bar),
 * or from signal[i] to signal[i+1] (Build 045 same-close, reconciliation only).
 */
export function simulateTrend(days: Day[], costPerTurnover = 0.001, timing: Timing = "next-bar (044)", o: TrendOptions = DEFAULT_TREND): TrendDay[] {
  const sig = days.map((d) => d.signal), out: TrendDay[] = [];
  let prevW = 0, prevDir = 0, eq = 1, geq = 1;
  for (let i = Math.max(o.lookbackDays, o.volDays) + 1; i + 1 < days.length; i++) {
    const { direction, exposure } = targetExposure(sig, i, o);
    const turnover = Math.abs(exposure - prevW), cost = turnover * costPerTurnover;
    const r = timing === "next-bar (044)" ? ret(days[i].exec, days[i + 1].exec) : ret(days[i].signal, days[i + 1].signal);
    const gross = exposure * r, net = gross - cost;
    eq *= 1 + net; geq *= 1 + gross;
    out.push({ t: days[i].t, direction, prevDirection: prevDir, exposure, prevExposure: prevW, turnover, cost, grossReturn: gross, netReturn: net, equity: eq, grossEquity: geq });
    prevW = exposure; prevDir = direction;
  }
  return out;
}

export type PerfStats = {
  start: string | null; end: string | null; days: number; years: number;
  directionChanges: number; daysWithTurnover: number; totalTurnover: number; annualTurnover: number;
  grossCumulative: number; netCumulative: number; cagr: number | null; annVol: number; sharpe: number | null;
  maxDrawdown: number; positiveDaysPct: number; costsPaid: number; finalEquity: number;
};

/** Max drawdown of an equity curve (negative fraction; 0 if never below a prior peak). */
export function maxDrawdown(equity: number[]) {
  let peak = 1, dd = 0;
  for (const e of equity) { peak = Math.max(peak, e); dd = Math.min(dd, e / peak - 1); }
  return dd;
}

export function perf(rows: TrendDay[] | { t: number; netReturn: number; grossReturn: number; turnover?: number; cost?: number; direction?: number; prevDirection?: number }[]): PerfStats {
  const n = rows.length, years = n / 365;
  let eq = 1, geq = 1, costsPaid = 0, turn = 0, dirCh = 0, withTurn = 0, pos = 0;
  const curve: number[] = [], nets: number[] = [];
  for (const r of rows as any[]) {
    costsPaid += (r.cost ?? 0) * eq; // dollars of cost on $1 starting capital, at the equity before the day
    eq *= 1 + r.netReturn; geq *= 1 + r.grossReturn; curve.push(eq); nets.push(r.netReturn);
    turn += r.turnover ?? 0; if ((r.turnover ?? 0) > 1e-12) withTurn++;
    if (r.direction != null && r.prevDirection != null && r.prevDirection !== 0 && r.direction !== r.prevDirection) dirCh++;
    if (r.netReturn > 0) pos++;
  }
  const mean = n ? nets.reduce((s, x) => s + x, 0) / n : 0, sd = sampleSd(nets);
  return {
    start: n ? new Date(rows[0].t).toISOString().slice(0, 10) : null, end: n ? new Date(rows[n - 1].t).toISOString().slice(0, 10) : null,
    days: n, years: Math.round(years * 1000) / 1000, directionChanges: dirCh, daysWithTurnover: withTurn,
    totalTurnover: turn, annualTurnover: years ? turn / years : 0,
    grossCumulative: geq - 1, netCumulative: eq - 1, cagr: years && eq > 0 ? eq ** (1 / years) - 1 : null,
    annVol: sd * Math.sqrt(365), sharpe: sd ? (mean / sd) * Math.sqrt(365) : null,
    maxDrawdown: maxDrawdown(curve), positiveDaysPct: n ? pos / n : 0, costsPaid, finalEquity: eq,
  };
}

/** Equal-weight portfolio: each day the average of the sleeves' returns over sleeves active that day. */
export function equalWeight(sleeves: TrendDay[][]) {
  const byT = new Map<number, { g: number[]; n: number[]; turn: number[]; cost: number[] }>();
  for (const s of sleeves) for (const d of s) {
    const e = byT.get(d.t) ?? byT.set(d.t, { g: [], n: [], turn: [], cost: [] }).get(d.t)!;
    e.g.push(d.grossReturn); e.n.push(d.netReturn); e.turn.push(d.turnover); e.cost.push(d.cost);
  }
  const avg = (a: number[]) => a.reduce((s, x) => s + x, 0) / a.length;
  return [...byT.entries()].sort((a, b) => a[0] - b[0]).filter(([, e]) => e.n.length === sleeves.length)
    .map(([t, e]) => ({ t, grossReturn: avg(e.g), netReturn: avg(e.n), turnover: avg(e.turn), cost: avg(e.cost) }));
}

/**
 * Daily records. signal = last hourly close of the UTC date (same as Build 045's daily()).
 * exec = the next hourly close after it (normally the 00:00 candle of the following date, known about 1h later).
 */
export function toDays(h: { t: number; p: number }[]): Day[] {
  const lastIdx = new Map<string, number>();
  h.forEach((x, i) => lastIdx.set(new Date(x.t).toISOString().slice(0, 10), i));
  const out: Day[] = [];
  for (const i of [...lastIdx.values()].sort((a, b) => a - b)) if (i + 1 < h.length) out.push({ t: h[i].t, signal: h[i].p, exec: h[i + 1].p });
  return out;
}
