import assert from "node:assert/strict";
import { volScaledTrend } from "../src/mechanisms/slowTrend.js";
import { equalWeight, maxDrawdown, perf, simulateTrend, targetExposure, type Day } from "../src/mechanisms/trendEconomics.js";

const D = 86400_000;
let seed = 3; const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const walk = (n: number) => { let p = 100; return Array.from({ length: n }, (_, i) => { p *= Math.exp((rnd() - 0.5) * 0.06); return { t: i * D, p }; }); };

// 1. Same-close timing with zero cost reproduces Build 045's volScaledTrend exactly: the rule itself is unchanged.
const px = walk(400);
const days: Day[] = px.map((x, i) => ({ t: x.t, signal: x.p, exec: px[Math.min(i + 1, px.length - 1)].p }));
const old = volScaledTrend(px), sim = simulateTrend(days, 0, "same-close (045)");
assert.equal(sim.length, old.length);
sim.forEach((s, i) => { assert.equal(s.t, old[i].t); assert.ok(Math.abs(s.grossReturn - old[i].scaled) < 1e-15); });

// 2. Zero turnover -> zero cost: a steady uptrend with constant volatility holds the same exposure.
const steady: Day[] = Array.from({ length: 200 }, (_, i) => { const p = 100 * 1.01 ** i * (i % 2 ? 1.001 : 1); return { t: i * D, signal: p, exec: p }; });
const st = simulateTrend(steady, 0.001);
assert.ok(st[0].turnover > 0, "entry from flat is turnover");
const later = st.slice(5);
const constExposure = later.filter((d) => Math.abs(d.exposure - d.prevExposure) < 1e-12);
assert.ok(constExposure.length > 0);
constExposure.forEach((d) => { assert.equal(d.turnover < 1e-12, true); assert.ok(d.cost < 1e-15, "unchanged position must not pay cost"); });

// 3. Cost is proportional to turnover (+0.75 -> +0.80 costs 0.05 x rate), and +1 -> -1 is 2 units.
const cost = (a: number, b: number, rate: number) => Math.abs(b - a) * rate;
assert.ok(Math.abs(cost(0.75, 0.8, 0.001) - 0.00005) < 1e-15);
assert.equal(cost(1, -1, 0.001), 0.002);
// And inside the simulator: every day's cost equals |w - w_prev| x rate, and flips show turnover ~2 at full leverage.
const s2 = simulateTrend(days, 0.001);
s2.forEach((d) => assert.ok(Math.abs(d.cost - Math.abs(d.exposure - d.prevExposure) * 0.001) < 1e-15));
const flipDays: Day[] = [...Array.from({ length: 100 }, (_, i) => 100 + i), ...Array.from({ length: 150 }, (_, i) => 199 - 2 * i)].map((p, i) => ({ t: i * D, signal: p, exec: p }));
const flip = simulateTrend(flipDays, 0.001, "next-bar (044)", { lookbackDays: 90, volDays: 30, targetDailyVol: 1, maxLeverage: 1 });
const f = flip.find((d) => d.direction !== d.prevDirection && d.prevDirection !== 0)!;
assert.ok(Math.abs(f.turnover - 2) < 1e-12, `flip turnover ${f.turnover}`);

// 4. Build 045's accounting (cost every day) is far more expensive than turnover-based accounting.
const every = s2.reduce((s, d) => s + 0.001, 0), actual = s2.reduce((s, d) => s + d.cost, 0);
assert.ok(actual < every / 3, `turnover cost ${actual} vs daily charge ${every}`);

// 5. Equity and drawdown.
assert.ok(Math.abs(s2.at(-1)!.equity - s2.reduce((e, d) => e * (1 + d.netReturn), 1)) < 1e-12);
assert.equal(maxDrawdown([1.1, 1.2, 0.9, 1.3, 1.17]), 0.9 / 1.2 - 1);
assert.equal(maxDrawdown([1, 1.1, 1.2]), 0);
const p = perf(s2);
assert.ok(Math.abs(p.finalEquity - s2.at(-1)!.equity) < 1e-12);
assert.ok(p.maxDrawdown <= 0 && p.days === s2.length);

// 6. Exposure never exceeds 1x; equal-weight averages aligned sleeves.
assert.ok(s2.every((d) => Math.abs(d.exposure) <= 1 + 1e-12));
const ew = equalWeight([s2, s2]);
assert.equal(ew.length, s2.length);
assert.ok(Math.abs(ew[10].netReturn - s2[10].netReturn) < 1e-15);
assert.equal(targetExposure(flipDays.map((d) => d.signal), 95, { lookbackDays: 90, volDays: 30, targetDailyVol: 1, maxLeverage: 1 }).direction, 1);
console.log("Build 047A trend economics tests passed", { turnoverCost: actual, oldDailyCharge: every });
