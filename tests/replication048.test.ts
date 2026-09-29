import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { calendarYears, classify, CUTOFF_MS, dailyRecords, eligibility, equalWeightActive, integrity, pageAll, segments, WARMUP } from "../src/mechanisms/replication.js";
import { simulateTrend, type TrendDay } from "../src/mechanisms/trendEconomics.js";

const H = 3600_000, D = 86400_000, t0 = Date.UTC(2019, 0, 1);
const hours = (n: number, start = t0, price = (i: number) => 100 + i * 0.01) => Array.from({ length: n }, (_, i) => ({ t: start + i * H, p: price(i) }));

(async () => {
  // Pagination: stops only on a short page; an exact multiple of 1,000 triggers one extra (empty) request.
  const src = Array.from({ length: 2000 }, (_, i) => i); let calls = 0;
  const got = await pageAll(async (f, t) => { calls++; return src.slice(f, t + 1); });
  assert.equal(got.length, 2000); assert.equal(calls, 3);
  calls = 0; assert.equal((await pageAll(async (f, t) => { calls++; return src.slice(0, 1005).slice(f, t + 1); })).length, 1005); assert.equal(calls, 2);

  // Integrity: duplicates, missing hours, gaps > 24h, and rows at/after the cutoff.
  const h = hours(200); h.push({ ...h[10] }); const gapped = [...h.filter((_, i) => i < 50 || i > 90)];
  const q = integrity(gapped);
  assert.equal(q.duplicates, 1); assert.equal(q.missingHours, 41); assert.equal(q.majorGapsOver24h, 1); assert.equal(q.largestGaps[0].hours, 42);
  assert.equal(integrity([{ t: CUTOFF_MS, p: 1 }]).rowsAtOrAfterCutoff, 1);
  assert.equal(integrity([{ t: CUTOFF_MS - H, p: 1 }]).rowsAtOrAfterCutoff, 0);

  // Temporal convention: signal = last close of the UTC date; exec = next candle (next date); nothing at/after cutoff.
  const three = hours(72);
  const dr = dailyRecords(three);
  assert.equal(dr.length, 2);
  assert.equal(dr[0].t, t0 + 23 * H); assert.equal(dr[0].signal, three[23].p); assert.equal(dr[0].exec, three[24].p);
  const nearCut = hours(72, CUTOFF_MS - 48 * H).concat(hours(5, CUTOFF_MS));
  assert.ok(dailyRecords(nearCut).every((d) => d.t < CUTOFF_MS && d.t + H < CUTOFF_MS + H));
  assert.equal(dailyRecords(nearCut).length, 1, "the last pre-cutoff date has no pre-cutoff execution candle and is dropped");
  // A day whose next candle is days later (gap) is invalid rather than executing across the gap.
  const withGap = hours(48).concat(hours(24, t0 + 5 * D));
  assert.equal(dailyRecords(withGap).length, 1);

  // Segments and eligibility: 457 consecutive dates -> exactly 365 decisions (eligible); 456 -> not.
  const mkDays = (n: number, start = t0) => Array.from({ length: n }, (_, i) => ({ t: start + i * D + 23 * H, signal: 100 + i, exec: 100.5 + i }));
  assert.equal(WARMUP, 91);
  assert.equal(eligibility(mkDays(457)).decisions, 365); assert.equal(eligibility(mkDays(457)).eligible, true);
  assert.equal(eligibility(mkDays(456)).eligible, false);
  const split = [...mkDays(100), ...mkDays(500, t0 + 200 * D)];
  assert.equal(segments(split).length, 2);
  assert.equal(eligibility(split).longestDates, 500, "longest run is used");
  assert.equal(simulateTrend(mkDays(457)).length, 365, "decision count matches the simulator");

  // No same-close regression: default timing uses execution prices.
  const sd = mkDays(200).map((d, i) => ({ ...d, exec: d.signal * (i % 2 ? 1.02 : 1) }));
  const nb = simulateTrend(sd, 0), sc = simulateTrend(sd, 0, "same-close (045)");
  assert.notDeepEqual(nb.map((x) => x.grossReturn), sc.map((x) => x.grossReturn));
  assert.ok(Math.abs(nb[0].grossReturn - nb[0].exposure * (sd[92].exec / sd[91].exec - 1)) < 1e-15);

  // Portfolio weighting: average over sleeves active that date; count reported.
  const sl = (start: number, n: number, r: number): TrendDay[] => Array.from({ length: n }, (_, i) => ({ t: start + i * D, direction: 1, prevDirection: 1, exposure: 1, prevExposure: 1, turnover: 0, cost: 0, grossReturn: r, netReturn: r, equity: 1, grossEquity: 1 }));
  const ew = equalWeightActive([sl(t0, 10, 0.01), sl(t0 + 5 * D, 10, 0.03)]);
  assert.equal(ew.length, 15); assert.equal(ew[0].active, 1); assert.equal(ew[0].netReturn, 0.01);
  assert.equal(ew[6].active, 2); assert.ok(Math.abs(ew[6].netReturn - 0.02) < 1e-15); assert.equal(ew[14].netReturn, 0.03);

  // Calendar years compound; classification follows the preregistered rules.
  const cy = calendarYears([{ t: Date.UTC(2020, 11, 31), netReturn: 0.1, grossReturn: 0.1 }, { t: Date.UTC(2021, 0, 1), netReturn: 0.1, grossReturn: 0.1 }, { t: Date.UTC(2021, 0, 2), netReturn: 0.1, grossReturn: 0.1 }]);
  assert.deepEqual(cy.map((y) => y.year), [2020, 2021]); assert.ok(Math.abs(cy[1].net - 0.21) < 1e-12);
  let s = 11; const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648);
  const series = (mu: number) => Array.from({ length: 2000 }, (_, i) => ({ t: t0 + i * D, netReturn: mu + (rnd() - 0.5) * 0.02, grossReturn: 0 }));
  assert.equal(classify(series(0.002), 0.001).label, "REPLICATION PASS");
  assert.equal(classify(series(0.002), 0.2).label, "REPLICATION INCONCLUSIVE", "strong economics without statistical evidence is not a pass");
  assert.equal(classify(series(-0.001), 0.9).label, "REPLICATION FAIL");

  // Frozen parameters, and the untouched data is isolated from every other research stage.
  assert.match(readFileSync("src/mechanisms/slowTrend.ts", "utf8"), /lookbackDays:90,volDays:30,targetDailyVol:\.01,maxLeverage:1/);
  const readers = ["src/hypothesisTester.ts", "src/scientificPipeline.ts", "src/replicationLab.ts", "src/historicalMiner.ts", "src/priceVolumeMiner.ts", "src/calibration/runCalibration.ts", "src/temporalIntegrity.ts", "src/trendEconomicsLab.ts", "src/mechanismLab.ts"];
  for (const f of readers) assert.ok(!readFileSync(f, "utf8").includes("HIST-048"), `${f} must not read HIST-048`);
  assert.match(readFileSync("src/retryController.ts", "utf8"), /neq\("sensor_version","HIST-048"\)/);
  assert.ok(!/\.(insert|upsert|update|delete)\(/.test(readFileSync("src/replication048.ts", "utf8")), "replication job must not write");
  console.log("Build 048 replication tests passed");
})().catch((e) => { console.error(e); process.exit(1); });
