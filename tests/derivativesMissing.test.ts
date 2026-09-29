import assert from "node:assert/strict";
import { scanDerivatives, type DerivPoint } from "../src/discovery/derivativesLibrary.js";

// 25 hours where OI is present but funding was never reported, then one real funding reading.
const mk = (funding: number, i: number): DerivPoint => ({ ts: new Date(i * 3600e3).toISOString(), mark: 0, index: 0, funding, oi: 1e9 });
const realLast = 0.0001; // an ordinary 0.01% funding rate

const zeroFilled = [...Array.from({ length: 25 }, (_, i) => mk(0, i)), mk(realLast, 25)];
const nanFilled = [...Array.from({ length: 25 }, (_, i) => mk(NaN, i)), mk(realLast, 25)];

const fake = scanDerivatives({ BTC: zeroFilled }).filter((h) => h.family === "FUNDING_EXTREME");
const safe = scanDerivatives({ BTC: nanFilled }).filter((h) => h.family === "FUNDING_EXTREME");

// With zeros, the prior window has zero variance, so z falls back to 0 and no event fires here;
// add a single tiny nonzero reading to show how zero-fill manufactures an extreme.
zeroFilled[10] = mk(0.000001, 10);
const fake2 = scanDerivatives({ BTC: zeroFilled }).filter((h) => h.family === "FUNDING_EXTREME");
nanFilled[10] = mk(0.000001, 10);
const safe2 = scanDerivatives({ BTC: nanFilled }).filter((h) => h.family === "FUNDING_EXTREME");

assert.equal(fake2.length, 1, "zero-filled history should manufacture an extreme from an ordinary reading");
assert.equal(safe.length + safe2.length, 0, "missing history must not produce FUNDING_EXTREME events");
console.log("Build 041 derivatives missing-data tests passed", { zeroFillFakeEvents: fake.length + fake2.length, nanEvents: safe.length + safe2.length });
