import assert from "node:assert/strict";
import { calibrate, discovery, plant, rng, scramble, type Outcomes } from "../src/calibration/funnel.js";
import { syntheticSeries } from "../src/calibration/runCalibration.js";

// plant() adds the edge to every event at every horizon.
const o: Outcomes = { 1: [0.01, -0.02], 4: [0.03], 8: [], 12: [], 24: [] };
assert.deepEqual(plant(o, 0.001)[1], [0.011, -0.019]);

// scramble() keeps magnitudes and applies the same sign to the k-th event at every horizon.
const s = scramble({ 1: [1, 2, 3, 4], 4: [5, 6, 7, 8], 8: [], 12: [], 24: [] }, 2, rng(1));
assert.deepEqual(s[1].map(Math.abs), [1, 2, 3, 4]);
assert.deepEqual(s[1].map(Math.sign), s[4].map(Math.sign));
assert.equal(Math.sign(s[1][0]), Math.sign(s[1][1]));

// discovery() needs 30 events and picks the best-mean horizon.
const many = (m: number) => Array.from({ length: 40 }, (_, i) => m + (i % 2 ? 0.001 : -0.001));
assert.equal(discovery({ 1: many(-0.01), 4: many(0.002), 8: many(0.001), 12: [], 24: [] }).horizon, 4);
assert.equal(discovery({ 1: [0.1], 4: [], 8: [], 12: [], 24: [] }).verdict, "INCONCLUSIVE");

// End to end on random walks (no real edge): a large planted edge is caught, no planted edge is not.
const rep = calibrate(syntheticSeries(1500, 3), { edgesPct: [0, 3], trialsPerEdge: 12, nullRuns: 10, blocks: [1] });
const at = (e: number) => rep.detection.find((d) => d.edgePct === e && d.rule === "one-sided (041)")!;
assert.ok(at(3).prosecutor >= 0.9, `3% edge should be detected, got ${at(3).prosecutor}`);
assert.ok(at(0).prosecutor <= 0.1, `no edge should not be detected, got ${at(0).prosecutor}`);
console.log("Build 041 calibration tests passed", { detect3pct: at(3).prosecutor, detect0pct: at(0).prosecutor, hypotheses: rep.hypotheses });
