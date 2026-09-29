import assert from "node:assert/strict";
import { assess, completeness, parseResponse } from "../src/funding/kraken.js";
import { byYear, fundingStats, trailingSignFilter } from "../src/funding/carryStats.js";

const H = 3600_000, t0 = Date.UTC(2022, 2, 22);
const iso = (t: number) => new Date(t).toISOString().replace(".000Z", "Z");

// parseResponse: numeric strings accepted, missing relative rate dropped (never zero-filled), sorted.
const body = { result: "success", serverTime: "x", rates: [
  { timestamp: iso(t0 + H), fundingRate: "1.5", relativeFundingRate: "0.00002" },
  { timestamp: iso(t0), fundingRate: 1.2, relativeFundingRate: 0.00001 },
  { timestamp: iso(t0 + 2 * H), fundingRate: 0.9 },
] };
const p = parseResponse(body, "PF_XBTUSD");
assert.equal(p.length, 2);
assert.equal(p[0].t, t0);
assert.equal(p[1].relative, 0.00002);
assert.throws(() => parseResponse({ result: "error", error: "x" }, "PF_X"), /unexpected response/);
assert.throws(() => parseResponse({ result: "success", rates: [{ timestamp: "nope", relativeFundingRate: 0 }] }, "PF_X"), /bad timestamp/);

// completeness: 3 years hourly with one 5-hour hole, one exact duplicate and one conflicting duplicate.
const rows: { t: number; relative: number }[] = [];
const N = 3 * 8766;
for (let i = 0; i < N; i++) if (i < 100 || i > 104) rows.push({ t: t0 + i * H, relative: 0.00001 });
rows.push({ t: t0 + 10 * H, relative: 0.00001 });
rows.push({ t: t0 + 20 * H, relative: 0.00009 });
const c = completeness(rows, t0 + N * H);
assert.equal(c.duplicates, 2);
assert.equal(c.conflictingDuplicates, 1);
assert.equal(c.gaps, 1);
assert.equal(c.missingPeriods, 5);
assert.equal(c.largestGapHours, 6);
assert.equal(c.medianIntervalHours, 1);
assert.ok(c.completenessPct > 99.9 && c.completenessPct < 100);
const v = assess(c);
assert.equal(v.pass, false);
assert.ok(v.problems.some((x) => /conflicting/.test(x)));
assert.equal(assess(completeness(rows.slice(0, 24 * 100))).problems.some((x) => /coverage/.test(x)), true);
assert.equal(assess(completeness(rows.filter((_, i) => i < N - 5).slice(0, N - 5))).pass, true);

// fundingStats: 0.001% per hour for one year ~= 8.766% annualized; drawdown and streaks.
const yr = Array.from({ length: 8766 }, (_, i) => ({ t: t0 + i * H, relative: 0.00001 }));
const s = fundingStats(yr);
assert.ok(Math.abs(s.annualizedFunding! - 0.08766) < 1e-6, String(s.annualizedFunding));
assert.equal(s.positivePct, 1);
assert.equal(s.maxFundingDrawdown, 0);
const dip = yr.map((x, i) => ({ ...x, relative: i >= 1000 && i < 1048 ? -0.0001 : x.relative }));
const d = fundingStats(dip);
assert.equal(d.longestNegativeStreakHours, 48);
assert.ok(Math.abs(d.maxFundingDrawdown - -0.0048) < 1e-12);
assert.ok(d.worst30dFunding! < s.worst30dFunding!);
assert.deepEqual(byYear(yr).map((y) => y.year), [2022, 2023]);

// trailingSignFilter uses only past data: a regime flip is followed, one period late at the earliest.
const flip = Array.from({ length: 400 }, (_, i) => ({ t: t0 + i * H, relative: i < 200 ? 0.00001 : -0.00001 }));
const f = trailingSignFilter(flip, 24);
assert.equal(f.periodsHeld, 200 - 24 + 12);
assert.equal(f.switches, 2);
console.log("Build 046 funding data tests passed", { annualized: s.annualizedFunding, filterHeld: f.periodsHeld });

// Research runs must not contact exchanges: only the ingest job may make network calls.
import { readFileSync } from "node:fs";
for (const f of ["src/fundingCarryFree.ts", "src/funding/carryStats.ts", "src/funding/completenessJob.ts", "src/funding/kraken.ts", "src/funding/krakenAnalytics.ts"]) {
  const src = readFileSync(f, "utf8");
  assert.ok(!/\bfetch\s*\(|https?:\/\/(?!futures\.kraken\.com\/(derivatives\/api\/v3\/historical-funding-rates|api\/charts\/v1\/analytics))/.test(src.replace(/\/\/.*$/gm, "")), `${f} must not make network calls`);
}
console.log("No-network guard passed for research files");

// Analytics series: parsing and validation against settled rates.
import { parseAnalytics, toFundingRows, validate, VALIDATION_GATE } from "../src/funding/krakenAnalytics.js";
const sec = (t: number) => t / 1000;
const settled = Array.from({ length: 24 * 200 }, (_, i) => ({ t: t0 + i * H, relative: 1e-5 * Math.sin(i / 7) + 2e-6 }));
// Simulated feed: the settled rate for period t appears as the CLOSE of the candle one hour earlier; open is noise.
const feed = { result: { timestamp: settled.map((s) => sec(s.t - H)), data: { rate: settled.map(() => [0, 0, 0, 0]), relativeRate: settled.map((s, i) => [Math.cos(i), s.relative + 1e-7, s.relative - 1e-7, s.relative]) }, more: false }, errors: [] };
const { candles, more } = parseAnalytics(feed, "PF_XBTUSD");
assert.equal(more, false);
assert.equal(candles.length, settled.length);
const ranking = validate(candles, settled);
assert.equal(ranking[0].field, "close");
assert.equal(ranking[0].offsetHours, -1);
assert.equal(ranking[0].matchRate, 1);
assert.ok(ranking[0].overlap >= VALIDATION_GATE.minOverlapHours);
const mapped = toFundingRows(candles, ranking[0]);
assert.equal(mapped[5].t, settled[5].t);
assert.equal(mapped[5].relative, settled[5].relative);
// A feed that never matches must fail the gate.
const bad = { ...feed, result: { ...feed.result, data: { ...feed.result.data, relativeRate: settled.map(() => [1, 1, 1, 1]) } } };
assert.ok(validate(parseAnalytics(bad, "PF_X").candles, settled)[0].matchRate < VALIDATION_GATE.minMatchRate);
// Missing values are dropped, not zero-filled; errors and malformed payloads throw.
const holey = { result: { timestamp: [sec(t0), sec(t0 + H)], data: { relativeRate: [[1e-5, 1e-5, 1e-5, 1e-5], [null, null, null, null]] }, more: true }, errors: [] };
assert.equal(parseAnalytics(holey, "PF_X").candles.length, 1);
assert.throws(() => parseAnalytics({ result: {}, errors: [] }, "PF_X"), /unexpected/);
assert.throws(() => parseAnalytics({ ...holey, errors: [{ msg: "bad" }] }, "PF_X"), /errors/);
const ms = parseAnalytics({ result: { timestamp: [t0], data: { relativeRate: [[1e-5, 1e-5, 1e-5, 1e-5]] }, more: false }, errors: [] }, "PF_X").candles;
assert.equal(ms[0].t, t0, "millisecond timestamps must not be scaled again");
console.log("Analytics validation tests passed");
