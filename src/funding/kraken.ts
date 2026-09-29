// Build 046 data: Kraken Futures historical funding rates. Pure functions (no I/O) so they can be tested offline.
//
// Source: Kraken Futures public REST, GET /derivatives/api/v3/historical-funding-rates?symbol=<PF_...>
// (no authentication). Kraken is a US-headquartered exchange; this is a published public-data endpoint,
// not scraping. Documented semantics (docs.kraken.com, support.kraken.com linear multi-collateral specs):
//   - timestamp            = START of the one-hour period the rate applies to (UTC, ISO 8601)
//   - relativeFundingRate  = funding as a FRACTION of spot price PER HOUR; bounded to +/-0.5% per hour
//   - fundingRate          = absolute USD per contract per hour (relative rate x spot price)
//   - sign: a positive rate is RECEIVED by shorts (paid by longs)
//   - settlement: hourly, at the end of the hour
// Linear perpetual launch dates (Kraken): PF_XBTUSD and PF_ETHUSD 2022-03-22, PF_SOLUSD 2022-06-13.

export const KRAKEN_BASE = "https://futures.kraken.com/derivatives/api/v3/historical-funding-rates";
export const SENSOR_VERSION = "FUND046-KRAKEN";
export const VENUE = "KRAKEN_FUTURES";
export const INSTRUMENTS = [
  { asset: "BTC", instrument: "PF_XBTUSD" },
  { asset: "ETH", instrument: "PF_ETHUSD" },
  { asset: "SOL", instrument: "PF_SOLUSD" },
] as const;
export const EXPECTED_INTERVAL_MS = 3600_000;
/** Provenance recorded on every stored row: source, units, timestamp convention and funding interval. */
export const SOURCE_TAG = "kraken_futures_v3_historical_funding_rates|rate=relativeFundingRate,fraction_per_period|interval=1h|ts=period_start_utc|sign=positive_paid_to_shorts";
export const HOUR = 3600_000, DAY = 86400_000;

export type RawRate = { timestamp: string; fundingRate?: number | string; relativeFundingRate?: number | string };
export type FundingRow = { t: number; iso: string; relative: number; absolute: number | null };

/** Validate and normalize one API response. Throws on anything that is not a successful rates list. */
export function parseResponse(body: any, symbol: string): FundingRow[] {
  if (!body || body.result !== "success" || !Array.isArray(body.rates)) throw new Error(`${symbol}: unexpected response ${JSON.stringify(body)?.slice(0, 300)}`);
  const out: FundingRow[] = [];
  for (const r of body.rates as RawRate[]) {
    const t = Date.parse(r.timestamp), rel = Number(r.relativeFundingRate), abs = r.fundingRate == null ? null : Number(r.fundingRate);
    if (!Number.isFinite(t)) throw new Error(`${symbol}: bad timestamp ${JSON.stringify(r)}`);
    // Missing or non-numeric relative rate is dropped, never zero-filled; it will show up as a gap.
    if (r.relativeFundingRate == null || !Number.isFinite(rel)) continue;
    out.push({ t, iso: new Date(t).toISOString(), relative: rel, absolute: Number.isFinite(abs as number) ? (abs as number) : null });
  }
  return out.sort((a, b) => a.t - b.t);
}

export type Completeness = {
  observations: number; first: string | null; last: string | null; coverageDays: number;
  medianIntervalHours: number | null; expectedIntervalHours: number;
  duplicates: number; conflictingDuplicates: number; offGridTimestamps: number;
  gaps: number; missingPeriods: number; largestGapHours: number;
  expectedObservations: number; completenessPct: number;
  outOfBoundsRates: number; // |rate| > 0.5% per hour (Kraken's documented cap)
  staleHours: number | null; // hours between the last observation and `now`
};

/** Completeness checks on one instrument's rows (any order). */
export function completeness(rows: { t: number; relative: number }[], now = Date.now()): Completeness {
  const s = [...rows].sort((a, b) => a.t - b.t);
  let duplicates = 0, conflicting = 0, gaps = 0, missing = 0, largest = 0, offGrid = 0, oob = 0;
  const diffs: number[] = [];
  for (let i = 0; i < s.length; i++) {
    if (s[i].t % EXPECTED_INTERVAL_MS !== 0) offGrid++;
    if (Math.abs(s[i].relative) > 0.005) oob++;
    if (i === 0) continue;
    const d = s[i].t - s[i - 1].t;
    if (d === 0) { duplicates++; if (s[i].relative !== s[i - 1].relative) conflicting++; continue; }
    diffs.push(d);
    if (d > EXPECTED_INTERVAL_MS) { gaps++; missing += Math.round(d / EXPECTED_INTERVAL_MS) - 1; largest = Math.max(largest, d / HOUR); }
  }
  diffs.sort((a, b) => a - b);
  const first = s[0]?.t, last = s.at(-1)?.t;
  const span = first != null && last != null ? last - first : 0;
  const expected = first != null ? Math.floor(span / EXPECTED_INTERVAL_MS) + 1 : 0;
  const unique = s.length - duplicates;
  return {
    observations: s.length, first: first != null ? new Date(first).toISOString() : null, last: last != null ? new Date(last).toISOString() : null,
    coverageDays: Math.round((span / DAY) * 10) / 10,
    medianIntervalHours: diffs.length ? diffs[Math.floor(diffs.length / 2)] / HOUR : null, expectedIntervalHours: EXPECTED_INTERVAL_MS / HOUR,
    duplicates, conflictingDuplicates: conflicting, offGridTimestamps: offGrid, gaps, missingPeriods: missing, largestGapHours: largest,
    expectedObservations: expected, completenessPct: expected ? Math.round((unique / expected) * 10000) / 100 : 0,
    outOfBoundsRates: oob, staleHours: last != null ? Math.round(((now - last) / HOUR) * 10) / 10 : null,
  };
}

export type Verdict = { pass: boolean; problems: string[] };
/** Gate for research use. Default: at least 2 years, >= 99% complete, hourly grid, no conflicting duplicates. */
export function assess(c: Completeness, minDays = 730): Verdict {
  const p: string[] = [];
  if (c.coverageDays < minDays) p.push(`coverage ${c.coverageDays} days < ${minDays}`);
  if (c.medianIntervalHours !== 1) p.push(`median interval ${c.medianIntervalHours}h, expected 1h`);
  if (c.completenessPct < 99) p.push(`completeness ${c.completenessPct}% < 99%`);
  if (c.conflictingDuplicates > 0) p.push(`${c.conflictingDuplicates} conflicting duplicate timestamps`);
  if (c.offGridTimestamps > 0) p.push(`${c.offGridTimestamps} timestamps not on the hour`);
  if (c.outOfBoundsRates > 0) p.push(`${c.outOfBoundsRates} rates outside Kraken's +/-0.5%/h cap`);
  return { pass: p.length === 0, problems: p };
}
