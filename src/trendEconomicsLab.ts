// Build 047A: corrected economics of the Build 045 slow volatility-scaled trend (see docs/BUILD-047-PREREGISTRATION.md).
// Reads HIST-028 from Supabase; writes nothing to the database. Research only; no trading authority.
import { writeFileSync } from "node:fs";
import { gzipSync } from "node:zlib";
import { db } from "./db.js";
import { equalWeight, perf, simulateTrend, toDays, type Timing, type TrendDay } from "./mechanisms/trendEconomics.js";
import { DEFAULT_TREND } from "./mechanisms/slowTrend.js";
import { blockBootstrapPValue, seedFrom } from "./science/bootstrap.js";
import { splitBounds } from "./science/split.js";

const ASSETS = ["BTC", "ETH", "XRP", "SOL", "ADA", "DOGE", "AVAX", "LINK"], PAGE = 1000;
const COST_PRIMARY = 0.001, COST_SENSITIVITY = 0.0005; // 10 bps per unit turnover; 5 bps if 045's "round trip" label is taken literally

async function hourly(asset: string) {
  const rows: { t: number; p: number }[] = [];
  for (let f = 0; ; f += PAGE) {
    const { data, error } = await db.from("crypto_universe_snapshots").select("observed_at,price_usd").eq("asset", asset).eq("sensor_version", "HIST-028")
      .order("observed_at", { ascending: true }).range(f, f + PAGE - 1);
    if (error) throw error;
    for (const r of data ?? []) rows.push({ t: Date.parse(r.observed_at), p: Number(r.price_usd) });
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}

const bootP = (xs: number[], key: string) => blockBootstrapPValue({ 1: xs }, { costBps: 0, minEvents: 160, block: 10, resamples: 4999, seed: seedFrom(key) });

function segments(rows: { t: number; netReturn: number; grossReturn: number }[]) {
  if (!rows.length) return null;
  const b = splitBounds(rows[0].t, rows.at(-1)!.t);
  const d = rows.filter((r) => r.t < b.holdoutStartMs), h = rows.filter((r) => r.t >= b.holdoutStartMs);
  return { splitAt: new Date(b.holdoutStartMs).toISOString().slice(0, 10), first70: perf(d as any), last30: perf(h as any) };
}

async function main() {
  const sims: Record<string, Record<string, TrendDay[]>> = {};
  const assets: any[] = [];
  for (const a of ASSETS) {
    const days = toDays(await hourly(a));
    const run = (c: number, t: Timing) => simulateTrend(days, c, t);
    const primary = run(COST_PRIMARY, "next-bar (044)");
    sims[a] = { primary, sens: run(COST_SENSITIVITY, "next-bar (044)"), sameClose: run(COST_PRIMARY, "same-close (045)"), noCost: run(0, "next-bar (044)") };
    const b = bootP(primary.map((d) => d.netReturn), "047A-" + a);
    const old045 = sims[a].sameClose.map((d) => d.grossReturn - 0.001); // Build 045 accounting: 10 bps every day
    assets.push({
      asset: a, primary: perf(primary), bootstrap: { p: b.p, tStat: b.statistic },
      costSensitivity5bps: { netCumulative: perf(sims[a].sens).netCumulative, sharpe: perf(sims[a].sens).sharpe },
      sameCloseTiming045: { netCumulative: perf(sims[a].sameClose).netCumulative, sharpe: perf(sims[a].sameClose).sharpe },
      build045AccountingForComparison: { meanDailyNet: old045.reduce((s, x) => s + x, 0) / old045.length },
      segments: segments(primary),
    });
  }
  const pf = (k: string) => equalWeight(ASSETS.map((a) => sims[a][k]));
  const port = pf("primary"), pb = bootP(port.map((d) => d.netReturn), "047A-PORTFOLIO"), pp = perf(port as any), seg = segments(port);
  const portfolio = { primary: pp, bootstrap: { p: pb.p, tStat: pb.statistic }, costSensitivity5bps: perf(pf("sens") as any), sameCloseTiming045: perf(pf("sameClose") as any), grossNoCost: perf(pf("noCost") as any), segments: seg };

  // Preregistered classification (equal-weight portfolio, primary timing and cost).
  const sharpe = pp.sharpe ?? -Infinity, cagr = pp.cagr ?? -Infinity;
  const bothPositive = !!seg && seg.first70.netCumulative > 0 && seg.last30.netCumulative > 0;
  const classification = sharpe >= 0.5 && pb.p < 0.05 && bothPositive ? "PROMISING" : cagr <= 0 || sharpe < 0.2 ? "NEGATIVE" : "INCONCLUSIVE";

  const report = {
    ok: true, build: "047A", program: "SLOW_VOL_SCALED_TREND_CORRECTED_ECONOMICS",
    specification: { ...DEFAULT_TREND, note: "unchanged from Build 045" },
    accounting: { costPerUnitTurnover: COST_PRIMARY, sensitivityCostPerUnitTurnover: COST_SENSITIVITY, timing: "next-bar (044): decide on the day's last hourly close, trade at the next hourly close", endOfData: "open position marked to market, not liquidated", portfolio: "equal-weight average of the eight sleeves' daily returns (sleeve rebalancing costs not modeled)", annualization: "365 days" },
    preregistration: "docs/BUILD-047-PREREGISTRATION.md", classification, classificationInputs: { portfolioSharpe: pp.sharpe, portfolioCagr: pp.cagr, portfolioBootstrapP: pb.p, bothSegmentsPositive: bothPositive },
    holdoutNote: "The last 30% is not a pristine holdout: Build 045 already evaluated the full period with this specification.",
    assets, portfolio, authorizedToTrade: false,
  };
  writeFileSync("trend-economics-report.json", JSON.stringify(report, null, 2));
  const csv = ["asset,date,direction,prev_direction,exposure,prev_exposure,turnover,cost,gross_return,net_return,equity"];
  for (const a of ASSETS) for (const d of sims[a].primary) csv.push([a, new Date(d.t).toISOString().slice(0, 10), d.direction, d.prevDirection, d.exposure, d.prevExposure, d.turnover, d.cost, d.grossReturn, d.netReturn, d.equity].join(","));
  writeFileSync("trend-economics-daily.csv.gz", gzipSync(csv.join("\n")));
  writeFileSync("trend-economics-report.md", markdown(report));
  console.log(JSON.stringify({ ok: true, build: "047A", classification, portfolio: { netCagr: pp.cagr, sharpe: pp.sharpe, p: pb.p }, authorizedToTrade: false }, null, 2));
}

const pc = (x: number | null) => (x == null ? "" : (x * 100).toFixed(1) + "%"), f2 = (x: number | null) => (x == null ? "" : x.toFixed(2));
function markdown(r: any) {
  const L = [`# Build 047A — slow trend, corrected economics`, "", `Classification: **${r.classification}** (preregistered rule, equal-weight portfolio).`, "",
    `Cost ${r.accounting.costPerUnitTurnover * 1e4} bps per unit turnover; ${r.accounting.timing}.`, "",
    "| Asset | Start | End | Days | Dir. changes | Turnover | Turnover/yr | Gross cum | Net cum | CAGR | Vol | Sharpe | Max DD | % up days | Costs ($) | Final $ | p |",
    "|---|---|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|"];
  const row = (n: string, s: any, p: number | null) => `| ${n} | ${s.start} | ${s.end} | ${s.days} | ${s.directionChanges} | ${s.totalTurnover.toFixed(1)} | ${s.annualTurnover.toFixed(1)} | ${pc(s.grossCumulative)} | ${pc(s.netCumulative)} | ${pc(s.cagr)} | ${pc(s.annVol)} | ${f2(s.sharpe)} | ${pc(s.maxDrawdown)} | ${pc(s.positiveDaysPct)} | ${s.costsPaid.toFixed(4)} | ${s.finalEquity.toFixed(3)} | ${p == null ? "" : p.toFixed(3)} |`;
  for (const a of r.assets) L.push(row(a.asset, a.primary, a.bootstrap.p));
  L.push(row("**Equal weight**", r.portfolio.primary, r.portfolio.bootstrap.p), "");
  L.push("Portfolio checks: " + [`no-cost gross ${pc(r.portfolio.grossNoCost.netCumulative)}`, `5 bps cost ${pc(r.portfolio.costSensitivity5bps.netCumulative)}`, `045 same-close timing ${pc(r.portfolio.sameCloseTiming045.netCumulative)}`, `first 70% ${pc(r.portfolio.segments.first70.netCumulative)}`, `last 30% ${pc(r.portfolio.segments.last30.netCumulative)} (split ${r.portfolio.segments.splitAt})`].join("; "), "", r.holdoutNote);
  return L.join("\n");
}

if (process.argv[1]?.endsWith("trendEconomicsLab.ts")) main().catch((e) => { console.error(e); process.exitCode = 1; });
