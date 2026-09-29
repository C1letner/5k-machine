// Build 046 data: Kraken Futures market-analytics funding series, validated against settled rates.
// Pure functions (no I/O) for parsing and validation.
//
// Source: GET https://futures.kraken.com/api/charts/v1/analytics/{symbol}/funding?since=&to=&interval=3600
// Public, no authentication (docs.kraken.com/api-reference/analytics/market-analytics). Returns hourly OHLC
// candles of `rate` (absolute) and `relativeRate` (fraction per hour), timestamps (documented as seconds, returned
// as milliseconds), and
// `more` when further candles exist.
//
// The settled-rate endpoint (kraken.ts) is authoritative but only returns about the last year. The analytics
// series may go back further, but it is a sampled feed, so which OHLC value (and which hour alignment)
// equals the settled rate must be established empirically on the overlapping year before older values are
// trusted. validate() does exactly that and nothing is stored unless it passes.
// Finding (2026-09-29): the CLOSE of the candle at t equals the settled rate for the period starting at t
// (100% of ~5,500 hours for BTC/ETH/SOL), but hourly analytics history only reaches back to 2026-02-12,
// which is shorter than the settled endpoint, so it cannot extend history.
export const ANALYTICS_BASE = "https://futures.kraken.com/api/charts/v1/analytics";
export const ANALYTICS_SENSOR = "FUND046-KRAKEN-AN";
export const FIELDS = ["open", "high", "low", "close"] as const;
export type Field = (typeof FIELDS)[number];
export type Candle = { t: number; o: number; h: number; l: number; c: number };

export function parseAnalytics(body: any, symbol: string): { candles: Candle[]; more: boolean } {
  const r = body?.result;
  if (!r || !Array.isArray(r.timestamp) || !r.data || !Array.isArray(r.data.relativeRate)) throw new Error(`${symbol}: unexpected analytics response ${JSON.stringify(body)?.slice(0, 300)}`);
  if (Array.isArray(body.errors) && body.errors.length) throw new Error(`${symbol}: analytics errors ${JSON.stringify(body.errors).slice(0, 300)}`);
  if (r.timestamp.length !== r.data.relativeRate.length) throw new Error(`${symbol}: timestamp/relativeRate length mismatch`);
  const candles: Candle[] = [];
  r.timestamp.forEach((ts: number, i: number) => {
    const v = r.data.relativeRate[i];
    if (!Array.isArray(v) || v.length !== 4 || v.some((x: unknown) => x == null || !Number.isFinite(Number(x)))) return; // missing -> gap, never zero
    // Docs say epoch seconds, but the live API returns milliseconds (observed 2026-09-29). Accept both.
    const n = Number(ts), t = n > 1e12 ? n : n * 1000;
    candles.push({ t, o: Number(v[0]), h: Number(v[1]), l: Number(v[2]), c: Number(v[3]) });
  });
  return { candles, more: Boolean(r.more) };
}

const pick = (c: Candle, f: Field) => (f === "open" ? c.o : f === "high" ? c.h : f === "low" ? c.l : c.c);

/** Values agree if equal to 12 decimal places (the database column's precision) or within 1e-6 relative. */
export const agrees = (a: number, b: number) => Math.abs(a - b) <= 1e-12 || Math.abs(a - b) <= 1e-6 * Math.max(Math.abs(a), Math.abs(b));

export type Validation = { field: Field; offsetHours: number; overlap: number; matches: number; matchRate: number; medianAbsDiff: number };

/**
 * For each OHLC field and each hour offset in [-2, 2], compare analytics value at (t + offset) with the
 * settled rate for the period starting at t. Returns all combinations, best first.
 */
export function validate(candles: Candle[], settled: { t: number; relative: number }[]): Validation[] {
  const byT = new Map(candles.map((c) => [c.t, c]));
  const out: Validation[] = [];
  for (const field of FIELDS) for (let off = -2; off <= 2; off++) {
    let overlap = 0, matches = 0;
    const diffs: number[] = [];
    for (const s of settled) {
      const c = byT.get(s.t + off * 3600_000);
      if (!c) continue;
      overlap++;
      const v = pick(c, field);
      if (agrees(v, s.relative)) matches++;
      diffs.push(Math.abs(v - s.relative));
    }
    diffs.sort((a, b) => a - b);
    out.push({ field, offsetHours: off, overlap, matches, matchRate: overlap ? matches / overlap : 0, medianAbsDiff: diffs.length ? diffs[Math.floor(diffs.length / 2)] : NaN });
  }
  return out.sort((a, b) => b.matchRate - a.matchRate || b.overlap - a.overlap);
}

/** Analytics rows mapped onto funding periods using the validated field and offset. */
export function toFundingRows(candles: Candle[], v: Validation) {
  return candles.map((c) => ({ t: c.t - v.offsetHours * 3600_000, relative: pick(c, v.field) }));
}

export const VALIDATION_GATE = { minOverlapHours: 24 * 180, minMatchRate: 0.99 };
