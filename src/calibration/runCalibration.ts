// Build 041: funnel calibration runner. READ-ONLY: loads HIST-028 prices, writes nothing to the database.
//   npm run calibrate              -> real data from Supabase
//   npm run calibrate -- --synthetic -> random-walk data, no database needed (pipeline smoke test)
import { appendFileSync, writeFileSync } from "node:fs";
import { ALL_RULES, calibrate, rng, type CalibrationReport, type PValueRule } from "./funnel.js";
import type { Pt } from "../science/priceEvents.js";

const ASSETS = ["ADA", "AVAX", "BTC", "DOGE", "ETH", "LINK", "SOL", "XRP"];
const PAGE = 1000;

async function loadHist028(): Promise<Record<string, Pt[]>> {
  const { db } = await import("../db.js");
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from("crypto_universe_snapshots").select("observed_at,asset,price_usd").eq("sensor_version", "HIST-028")
      .order("observed_at", { ascending: true }).order("asset", { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) break;
  }
  const out: Record<string, Pt[]> = {};
  for (const r of rows) (out[r.asset] ??= []).push({ t: Date.parse(r.observed_at), p: Number(r.price_usd) });
  return out;
}

/** Correlated random walks with crypto-like hourly volatility; contains no edge by construction. */
export function syntheticSeries(hours = Number(process.env.CAL_SYNTH_HOURS ?? 4315), seed = 7): Record<string, Pt[]> {
  const r = rng(seed), gauss = () => Math.sqrt(-2 * Math.log(r() || 1e-12)) * Math.cos(2 * Math.PI * r());
  const out: Record<string, Pt[]> = {};
  const market = Array.from({ length: hours }, () => gauss());
  ASSETS.forEach((a, k) => {
    let p = 100;
    const vol = 0.005 + 0.001 * k;
    out[a] = market.map((m, i) => { p *= Math.exp(vol * (0.8 * m + 0.6 * gauss())); return { t: Date.UTC(2026, 0, 1) + i * 3600_000, p }; });
  });
  return out;
}

const pct = (x: number) => `${(x * 100).toFixed(0)}%`;

function markdown(rep: CalibrationReport, meta: Record<string, unknown>) {
  const L: string[] = ["## Funnel calibration (build 043)", "", `Data: ${meta.source}, ${meta.hours} hours × ${meta.assets} assets, ${rep.hypotheses} distinct hypotheses (${rep.duplicatesMerged.reduce((n, d) => n + d.duplicates.length, 0)} exact duplicates merged, e.g. A->B and B->A of the same trade). Read-only; nothing was written to the database.`, ""];
  L.push("### Positive control: share of planted edges that survive each stage", "", "Edge = extra return added to every event of one hypothesis, before 50 bps costs.", "",
    "| Edge per trade | p-value rule | Discovery | FDR | Prosecutor |", "|---:|---|---:|---:|---:|");
  for (const d of rep.detection) L.push(`| ${d.edgePct}% | ${d.rule} | ${pct(d.discovery)} | ${pct(d.fdr)} | ${pct(d.prosecutor)} |`);
  L.push("", "### Negative control: scrambled data with no edge", "", "Zero = no edge at all. Equal to cost = gross edge exactly 0.50%, so nothing is left after costs: the hardest worthless case.", "",
    "| Null edge | Sign-flip block | p-value rule | Mean FDR survivors | Mean final survivors | Runs with any final survivor |", "|---|---:|---|---:|---:|---:|");
  for (const n of rep.nullControl) L.push(`| ${n.nullEdge} | ${n.block} events | ${n.rule} | ${n.meanFdrSurvivors.toFixed(2)} | ${n.meanProsecutorSurvivors.toFixed(2)} | ${pct(n.runsWithAnyFinalSurvivor)} |`);
  L.push("", "### Real data", "", "| p-value rule | Discovery PASS | FDR PASS | Prosecutor PASS | Survivors |", "|---|---:|---:|---:|---|");
  for (const [rule, r] of Object.entries(rep.realData)) L.push(`| ${rule} | ${r.discoveryPass} | ${r.fdrPass} | ${r.prosecutorPass} | ${r.survivors.join(", ") || "none"} |`);
  L.push("", "### Strongest candidates under the block-bootstrap test (real data)", "", "p is for a net-of-cost edge at the best horizon. With this many hypotheses, a lone real edge needs p well below 0.001 to pass FDR.", "",
    "| Hypothesis | p | Horizon | Net mean per trade | Events |", "|---|---:|---:|---:|---:|");
  for (const c of rep.strongestCandidates) L.push(`| ${c.id} | ${c.p.toFixed(4)} | ${c.horizon ?? ""}h | ${c.netMeanPct == null ? "" : c.netMeanPct.toFixed(3) + "%"} | ${c.events} |`);
  const m = rep.minimumDetectableEdge;
  L.push("", "### Minimum detectable edge at 4h", "", `Median ${m.medianPct.toFixed(2)}% per trade (middle half ${m.p25Pct.toFixed(2)}–${m.p75Pct.toFixed(2)}%). ${m.shareAboveCostPct.toFixed(0)}% of hypotheses cannot detect an edge as small as the 0.50% cost. ${m.note}`, "");
  return L.join("\n");
}

async function main() {
  const synthetic = process.argv.includes("--synthetic");
  const series = synthetic ? syntheticSeries() : await loadHist028();
  const assets = Object.keys(series).sort();
  const hours = Math.min(...assets.map((a) => series[a].length));
  if (assets.length < 2 || hours < 500) throw new Error(`Not enough HIST-028 data to calibrate (assets=${assets.length}, hours=${hours})`);

  const started = Date.now();
  // Build 043: by default calibrate only the rule production uses; CAL_RULES=all adds the retired
// pre-042 rules for comparison (slow on multi-year data).
  const rules: PValueRule[] = process.env.CAL_RULES === "all" ? ALL_RULES : ["block bootstrap (042)"];
  const rep = calibrate(series, { rules, trialsPerEdge: Number(process.env.CAL_TRIALS ?? 60), nullRuns: Number(process.env.CAL_NULL_RUNS ?? 200), bootstrapNullRuns: Number(process.env.CAL_BOOT_NULL_RUNS ?? 100) });
  const meta = { source: synthetic ? "synthetic random walks (no edge)" : "Supabase HIST-028", assets: assets.length, hours, seconds: Math.round((Date.now() - started) / 1000) };
  const full = { ok: true, build: "043-calibration", readOnly: true, authorizedToTrade: false, meta, ...rep };

  writeFileSync("calibration-report.json", JSON.stringify(full, null, 2));
  const md = markdown(rep, meta);
  writeFileSync("calibration-report.md", md);
  if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, md);
  console.log(md);
}

if (process.argv[1]?.endsWith("runCalibration.ts")) main().catch((e) => { console.error(e); process.exitCode = 1; });
