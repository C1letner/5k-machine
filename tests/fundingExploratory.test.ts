import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { applyRule, canPromote, classify, equalWeightFunding, fundingSummary, MODE, THRESHOLD_PER_HOUR, validateStored, type StoredRow } from "../src/funding/exploratory.js";
import { assess, completeness, SOURCE_TAG } from "../src/funding/kraken.js";
import { toDays } from "../src/mechanisms/trendEconomics.js";

const H = 3600_000, t0 = Date.UTC(2025, 8, 24, 8);
const mk = (i: number, rate: number, extra: Partial<StoredRow> = {}): StoredRow => ({ observed_at: new Date(t0 + i * H).toISOString(), asset: "BTC", instrument: "PF_XBTUSD", funding_rate: rate, source: SOURCE_TAG, sensor_version: "FUND046-KRAKEN", ...extra });
const exp = { asset: "BTC", instrument: "PF_XBTUSD" };

// Sign convention: the stored tag must state positive = received by shorts; any other tag stops the job.
assert.match(SOURCE_TAG, /sign=positive_paid_to_shorts/);
assert.match(SOURCE_TAG, /interval=1h/);
assert.match(SOURCE_TAG, /fraction_per_period/);
const good = Array.from({ length: 48 }, (_, i) => mk(i, 1e-5));
assert.equal(validateStored(good, exp).ok, true);
assert.equal(validateStored(good.map((r) => ({ ...r, source: SOURCE_TAG.replace("positive_paid_to_shorts", "positive_paid_to_longs") })), exp).ok, false);
assert.equal(validateStored(good, { asset: "ETH", instrument: "PF_ETHUSD" }).ok, false, "asset/instrument mapping checked");
// Positive rates are income to the short: cumulative funding is positive.
assert.ok(fundingSummary(validateStored(good, exp).obs).cumulative > 0);

// Duplicate and gap detection.
const dup = [...good, mk(5, 1e-5)];
assert.ok(validateStored(dup, exp).problems.some((p) => /duplicate/.test(p)));
const gap = good.filter((_, i) => i < 10 || i > 13);
const vg = validateStored(gap, exp);
assert.equal(vg.completeness.gaps, 1);
assert.equal(vg.completeness.missingPeriods, 4);
assert.deepEqual(vg.intervalChanges, [{ hours: 5, count: 1 }]);
assert.ok(validateStored([...good, mk(49, 0.006)], exp).problems.some((p) => /cap/.test(p)), "rates above the documented cap are rejected");

// Annualization, frequencies, cumulative, drawdown, streaks.
const year = Array.from({ length: 8766 }, (_, i) => ({ t: t0 + i * H, relative: i % 4 === 0 ? -1e-5 : 2e-5 }));
const s = fundingSummary(year);
assert.ok(Math.abs(s.cumulative - (2192 * -1e-5 + 6574 * 2e-5)) < 1e-9);
assert.ok(Math.abs(s.simpleAnnualized! - s.cumulative) < 1e-9, "one year of hours: simple annualized = cumulative");
assert.ok(Math.abs(s.positivePct - 0.75) < 1e-3 && Math.abs(s.negativePct - 0.25) < 1e-3 && s.zeroPct === 0);
assert.equal(s.longestNegativeStreakHours, 1);
assert.equal(s.longestPositiveStreakHours, 3);
assert.ok(Math.abs(s.maxCumulativeDrawdown - -1e-5) < 1e-15);
assert.ok(s.compoundedAnnualized! > s.simpleAnnualized!);
const dd = fundingSummary([1e-4, 1e-4, -5e-5, -5e-5, 1e-4].map((r, i) => ({ t: t0 + i * H, relative: r })));
assert.ok(Math.abs(dd.maxCumulativeDrawdown - -1e-4) < 1e-15);

// Rules use only past rates; the threshold is the preregistered 10%/yr.
assert.ok(Math.abs(THRESHOLD_PER_HOUR - 0.1 / 8766) < 1e-18);
const alt = Array.from({ length: 10 }, (_, i) => ({ t: t0 + i * H, relative: i % 2 ? -1e-5 : 1e-5 }));
const r2 = applyRule(alt, "prevHourPositive");
assert.equal(r2.eligibleHours, 9);
assert.ok(r2.series.every((x) => x.relative <= 0), "after a positive hour it holds the next (negative) hour: no look-ahead");
assert.equal(applyRule(alt, "always").exposedHours, 10);

// Portfolio aligns hours; classification follows the preregistered cut-offs.
assert.equal(equalWeightFunding([alt, alt.slice(2)]).aligned, 8);
const flat = (annual: number) => fundingSummary(Array.from({ length: 8766 }, (_, i) => ({ t: t0 + i * H, relative: annual / 8766 })));
assert.equal(classify(flat(0.03)).label, "ECONOMICALLY UNINTERESTING");
assert.equal(classify(flat(0.10)).label, "INTERESTING ENOUGH TO CONTINUE COLLECTING");
assert.equal(classify(flat(0.20)).label, "STRONGLY INTERESTING BUT UNVALIDATED");

// The permanent two-year gate stays active, and exploratory mode can never promote.
assert.equal(assess(completeness(year)).pass, false);
assert.ok(assess(completeness(year)).problems.some((p) => /coverage .* < 730/.test(p)));
assert.match(readFileSync("src/funding/completenessJob.ts", "utf8"), /MIN_FUNDING_DAYS \?\? 730/);
assert.equal(canPromote(MODE, 365), false);
assert.equal(canPromote(MODE, 5000), false, "exploratory mode never promotes, whatever the coverage");
assert.equal(canPromote("VALIDATION", 365), false);
assert.equal(canPromote("VALIDATION", 730), true);
// The exploratory job writes nothing to the database.
const job = readFileSync("src/fundingExploratory.ts", "utf8");
assert.ok(!/\.(insert|upsert|update|delete)\(/.test(job), "exploratory job must not write to the database");

// 047A daily construction: signal = last hourly close of the date, exec = next hourly close.
const hrs = Array.from({ length: 72 }, (_, i) => ({ t: Date.UTC(2026, 0, 1) + i * H, p: 100 + i }));
const days = toDays(hrs);
assert.equal(days.length, 2, "the final date has no next close and is dropped");
assert.equal(days[0].signal, 123);
assert.equal(days[0].exec, 124);
console.log("Build 047B exploratory funding tests passed");
