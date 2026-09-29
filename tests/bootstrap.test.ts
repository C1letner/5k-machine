import assert from "node:assert/strict";
import { blockBootstrapPValue, seedFrom } from "../src/science/bootstrap.js";
import { rng } from "../src/science/rng.js";

const r = rng(5), gauss = () => Math.sqrt(-2 * Math.log(r() || 1e-12)) * Math.cos(2 * Math.PI * r());
const series = (n: number, mu: number, sd: number) => Array.from({ length: n }, () => mu + sd * gauss());
// Clustered series: runs of 10 events share a common shock, like bursts of related triggers.
const clustered = (n: number, mu: number, sd: number) => { const out: number[] = []; let shock = 0; for (let i = 0; i < n; i++) { if (i % 10 === 0) shock = sd * gauss(); out.push(mu + shock + 0.3 * sd * gauss()); } return out; };

// A large real edge well above the 0.50% cost is significant.
const strong = blockBootstrapPValue({ 4: series(400, 0.02, 0.015) }, { resamples: 499 });
assert.ok(strong.p < 0.01, `strong edge p=${strong.p}`);
assert.equal(strong.horizon, 4);

// An edge below cost is not.
assert.ok(blockBootstrapPValue({ 4: series(400, 0.003, 0.015) }, { resamples: 499 }).p > 0.5);

// Too few events: nothing to test.
assert.equal(blockBootstrapPValue({ 4: series(10, 0.05, 0.01) }).p, 1);

// Deterministic for a given seed.
const o = { 1: series(200, 0.006, 0.01), 4: series(200, 0.004, 0.02) };
assert.equal(blockBootstrapPValue(o, { seed: seedFrom("x") }).p, blockBootstrapPValue(o, { seed: seedFrom("x") }).p);

// Size check under clustering: with mean exactly at cost, p < 0.05 should occur ~5% of the time, not far more.
let hits = 0; const trials = 200;
for (let t = 0; t < trials; t++) if (blockBootstrapPValue({ 4: clustered(300, 0.005, 0.015) }, { resamples: 199, seed: t }).p < 0.05) hits++;
assert.ok(hits / trials < 0.12, `false-positive rate under clustering too high: ${hits / trials}`);
console.log("Build 042 bootstrap tests passed", { strongP: strong.p, clusteredFalsePositiveRate: hits / trials });
