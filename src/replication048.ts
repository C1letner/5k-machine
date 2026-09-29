// Build 048: untouched-history replication of the FROZEN slow trend (docs/BUILD-048-PREREGISTRATION.md, commit cf7f5f67).
// Reads HIST-048 only (Coinbase hourly candles before 2023-09-30). Writes nothing to the database. Research only.
// Order: integrity -> mechanical eligibility -> frozen strategy via the Build 047A simulator -> preregistered classification.
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { db } from "./db.js";
import { DEFAULT_TREND } from "./mechanisms/slowTrend.js";
import { perf, simulateTrend, type TrendDay } from "./mechanisms/trendEconomics.js";
import { calendarYears, classify, dailyRecords, eligibility, equalWeightActive, integrity, MIN_DECISIONS, pageAll, WARMUP } from "./mechanisms/replication.js";
import { blockBootstrapPValue, seedFrom } from "./science/bootstrap.js";

const ASSETS = ["BTC", "ETH", "XRP", "SOL", "ADA", "DOGE", "AVAX", "LINK"], PAGE = 1000, SENSOR = "HIST-048";
const COST = 0.001, COST_SENS = 0.0005;

async function hourly(asset: string) {
  const rows = await pageAll(async (from, to) => {
    const { data, error } = await db.from("crypto_universe_snapshots").select("observed_at,price_usd").eq("asset", asset).eq("sensor_version", SENSOR)
      .order("observed_at", { ascending: true }).range(from, to);
    if (error) throw error;
    return data ?? [];
  }, PAGE);
  return rows.map((r: any) => ({ t: Date.parse(r.observed_at), p: Number(r.price_usd) }));
}

const bootP = (xs: number[], key: string) => blockBootstrapPValue({ 1: xs }, { costBps: 0, minEvents: 160, block: 10, resamples: 4999, seed: seedFrom(key) });

async function main() {
  const quality: any[] = [], elig: any[] = [], sims: Record<string, { primary: TrendDay[]; sens: TrendDay[] }> = {};
  for (const a of ASSETS) {
    const h = await hourly(a), q = integrity(h);
    quality.push({ asset: a, ...q });
    if (q.rowsAtOrAfterCutoff) throw new Error(`${a}: ${q.rowsAtOrAfterCutoff} HIST-048 rows at or after the cutoff; untouched boundary violated`);
    const e = eligibility(dailyRecords(h));
    elig.push({ asset: a, eligible: e.eligible, longestSegment: { first: e.first, last: e.last, dates: e.longestDates, decisions: e.decisions }, segmentCount: e.segmentCount, otherSegments: e.otherSegments.slice(0, 5),
      reason: e.eligible ? null : `${e.decisions} decisions < ${MIN_DECISIONS} required (longest run ${e.longestDates} dates incl. ${WARMUP}-day warm-up)` });
    if (e.eligible) sims[a] = { primary: simulateTrend(e.longest, COST, "next-bar (044)"), sens: simulateTrend(e.longest, COST_SENS, "next-bar (044)") };
  }
  const eligibleAssets = Object.keys(sims);
  if (!eligibleAssets.length) throw new Error("no eligible assets; nothing to replicate");
  // Eligibility is fixed above, from data alone, before any return is computed or read.

  const assets = eligibleAssets.map((a) => {
    const b = bootP(sims[a].primary.map((d) => d.netReturn), "048-" + a);
    return { asset: a, primary: perf(sims[a].primary), bootstrap: { p: b.p, tStat: b.statistic }, calendarYears: calendarYears(sims[a].primary), costSensitivity5bps: { netCumulative: perf(sims[a].sens).netCumulative, sharpe: perf(sims[a].sens).sharpe } };
  });
  const port = equalWeightActive(eligibleAssets.map((a) => sims[a].primary)), portSens = equalWeightActive(eligibleAssets.map((a) => sims[a].sens));
  const pb = bootP(port.map((d) => d.netReturn), "048-PORTFOLIO"), cls = classify(port, pb.p);
  const activeByYear = calendarYears(port).map((y) => { const rs = port.filter((r) => new Date(r.t).getUTCFullYear() === y.year); return { year: y.year, minActive: Math.min(...rs.map((r) => r.active)), maxActive: Math.max(...rs.map((r) => r.active)) }; });
  const portfolio = { primary: perf(port as any), bootstrap: { p: pb.p, tStat: pb.statistic }, calendarYears: calendarYears(port), activeSleevesByYear: activeByYear, costSensitivity5bps: { netCumulative: perf(portSens as any).netCumulative, sharpe: perf(portSens as any).sharpe } };

  const report = {
    ok: true, build: "048", program: "UNTOUCHED_REPLICATION_FROZEN_SLOW_TREND", preregistration: { file: "docs/BUILD-048-PREREGISTRATION.md", commit: "cf7f5f67be519be0f3e98afc2c96b3d0a08829dd" },
    codeCommit: process.env.GITHUB_SHA ?? null,
    data: { sensorVersion: SENSOR, source: "Coinbase Exchange public hourly candles; ts = candle start (UTC); value = close", window: "2015-01-01T00:00Z to <2023-09-30T00:00Z" },
    specification: { ...DEFAULT_TREND, costPerUnitTurnover: COST, timing: "next-bar (044)", note: "frozen; unchanged from Build 045/047A" },
    requestedUniverse: ASSETS, eligibleUniverse: eligibleAssets, quality, eligibility: elig, assets, portfolio,
    classification: cls.label, classificationInputs: { sharpe: cls.sharpe, cagr: cls.cagr, p: cls.p, bothHalvesPositive: cls.bothHalvesPositive, splitAt: cls.splitAt, firstHalfNet: cls.firstHalf.netCumulative, secondHalfNet: cls.secondHalf.netCumulative, firstHalfSharpe: cls.firstHalf.sharpe, secondHalfSharpe: cls.secondHalf.sharpe },
    authorizedToTrade: false,
  };
  writeFileSync("replication-048-report.json", JSON.stringify(report, null, 2));
  const csv = ["asset,date,direction,prev_direction,exposure,prev_exposure,turnover,cost,gross_return,net_return,equity"];
  for (const a of eligibleAssets) for (const d of sims[a].primary) csv.push([a, new Date(d.t).toISOString().slice(0, 10), d.direction, d.prevDirection, d.exposure, d.prevExposure, d.turnover, d.cost, d.grossReturn, d.netReturn, d.equity].join(","));
  writeFileSync("replication-048-daily.csv.gz", gzipSync(csv.join("\n")));
  writeFileSync("replication-048-report.md", markdown(report));
  console.log(JSON.stringify({ ok: true, build: "048", classification: cls.label, eligibleUniverse: eligibleAssets, portfolio: { sharpe: cls.sharpe, cagr: cls.cagr, p: pb.p }, authorizedToTrade: false }, null, 2));
}

const pc = (x: number | null | undefined) => (x == null ? "" : (x * 100).toFixed(1) + "%"), f2 = (x: number | null | undefined) => (x == null ? "" : x.toFixed(2));
function markdown(r: any) {
  const L = [`# Build 048 — untouched replication of the frozen slow trend`, "", `Classification: **${r.classification}** (preregistered, commit ${r.preregistration.commit.slice(0, 8)}).`, "",
    "## Data integrity (HIST-048)", "", "| Asset | First | Last | Obs | Dups | Missing h | Complete | Gaps >24h |", "|---|---|---|---:|---:|---:|---:|---:|"];
  for (const q of r.quality) L.push(`| ${q.asset} | ${q.first ?? ""} | ${q.last ?? ""} | ${q.observations} | ${q.duplicates} | ${q.missingHours} | ${q.completenessPct}% | ${q.majorGapsOver24h} |`);
  L.push("", "## Eligibility (mechanical)", "", "| Asset | Eligible | Longest run | Dates | Decisions | Reason |", "|---|---|---|---:|---:|---|");
  for (const e of r.eligibility) L.push(`| ${e.asset} | ${e.eligible} | ${e.longestSegment.first ?? ""} to ${e.longestSegment.last ?? ""} | ${e.longestSegment.dates} | ${e.longestSegment.decisions} | ${e.reason ?? ""} |`);
  L.push("", "## Results (net of 10 bps per unit turnover, next-bar)", "", "| Asset | Start | End | Days | Dir. changes | Turnover | /yr | Gross cum | Net cum | CAGR | Vol | Sharpe | Max DD | % up | Costs $ | Final $ | p |", "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|");
  const row = (n: string, s: any, p: number) => `| ${n} | ${s.start} | ${s.end} | ${s.days} | ${s.directionChanges} | ${s.totalTurnover.toFixed(1)} | ${s.annualTurnover.toFixed(1)} | ${pc(s.grossCumulative)} | ${pc(s.netCumulative)} | ${pc(s.cagr)} | ${pc(s.annVol)} | ${f2(s.sharpe)} | ${pc(s.maxDrawdown)} | ${pc(s.positiveDaysPct)} | ${s.costsPaid.toFixed(3)} | ${s.finalEquity.toFixed(3)} | ${p.toFixed(3)} |`;
  for (const a of r.assets) L.push(row(a.asset, a.primary, a.bootstrap.p));
  L.push(row("**Equal weight (active)**", r.portfolio.primary, r.portfolio.bootstrap.p), "", "## Portfolio by calendar year", "", "| Year | Days | Net | Gross | Active sleeves |", "|---|---:|---:|---:|---|");
  for (const y of r.portfolio.calendarYears) { const a = r.portfolio.activeSleevesByYear.find((x: any) => x.year === y.year); L.push(`| ${y.year} | ${y.days} | ${pc(y.net)} | ${pc(y.gross)} | ${a.minActive}-${a.maxActive} |`); }
  const c = r.classificationInputs;
  L.push("", `Halves (split ${c.splitAt}): first ${pc(c.firstHalfNet)} (Sharpe ${f2(c.firstHalfSharpe)}), second ${pc(c.secondHalfNet)} (Sharpe ${f2(c.secondHalfSharpe)}). 5 bps cost sensitivity: ${pc(r.portfolio.costSensitivity5bps.netCumulative)}.`);
  return L.join("\n");
}

if (process.argv[1]?.endsWith("replication048.ts")) main().catch((e) => { console.error(e); process.exitCode = 1; });
