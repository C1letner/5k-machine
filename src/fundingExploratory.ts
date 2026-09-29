// Build 047B: EXPLORATORY one-year Kraken funding analysis (see docs/BUILD-047-PREREGISTRATION.md).
// Reads stored FUND046-KRAKEN rows only; never contacts Kraken; writes nothing to the database; cannot promote
// any strategy. Figures are RAW FUNDING COMPENSATION to a short perpetual, not delta-neutral profit.
import { writeFileSync } from "node:fs";
import { db } from "./db.js";
import { applyRule, canPromote, classify, equalWeightFunding, fundingSummary, MODE, PERMANENT_MIN_DAYS, THRESHOLD_PER_HOUR, validateStored, type Obs, type Rule, type StoredRow } from "./funding/exploratory.js";
import { INSTRUMENTS, SENSOR_VERSION, SOURCE_TAG, VENUE } from "./funding/kraken.js";

const PAGE = 1000, RULES: Rule[] = ["always", "prevHourPositive", "trailing24hAbove10pct"];

async function stored(instrument: string): Promise<StoredRow[]> {
  const rows: StoredRow[] = [];
  for (let f = 0; ; f += PAGE) {
    const { data, error } = await db.from("derivatives_observations").select("observed_at,asset,instrument,funding_rate,source,sensor_version")
      .eq("venue", VENUE).eq("instrument", instrument).eq("sensor_version", SENSOR_VERSION).order("observed_at", { ascending: true }).range(f, f + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as StoredRow[]));
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}

const noSeries = ({ series, ...rest }: any) => rest;

async function main() {
  const quality: any[] = [], perAsset: any[] = [], obsBy: Record<string, Obs[]> = {};
  for (const inst of INSTRUMENTS) {
    const v = validateStored(await stored(inst.instrument), inst);
    quality.push({ ...inst, ok: v.ok, problems: v.problems, completeness: v.completeness, intervalChanges: v.intervalChanges, permanentGate: v.permanentGate });
    obsBy[inst.asset] = v.obs;
  }
  if (quality.some((q) => !q.ok)) {
    console.log(JSON.stringify({ ok: false, build: "047B", mode: MODE, stopped: "data-quality or metadata discrepancy; no returns computed", quality, authorizedToTrade: false }, null, 2));
    process.exitCode = 1;
    return;
  }
  for (const inst of INSTRUMENTS) {
    const rules = Object.fromEntries(RULES.map((r) => { const x = applyRule(obsBy[inst.asset], r); return [r, { ...noSeries(x), summary: noSeries(fundingSummary(x.series)) }]; }));
    perAsset.push({ ...inst, rawFundingCompensation: fundingSummary(obsBy[inst.asset]), rules });
  }
  const ew = equalWeightFunding(INSTRUMENTS.map((i) => obsBy[i.asset]));
  const ewRules = Object.fromEntries(RULES.map((r) => {
    const parts = INSTRUMENTS.map((i) => applyRule(obsBy[i.asset], r));
    const p = equalWeightFunding(parts.map((x) => x.series));
    return [r, { alignedHours: p.aligned, meanFractionExposed: parts.reduce((s, x) => s + x.fractionExposed, 0) / parts.length, totalSwitches: parts.reduce((s, x) => s + x.switches, 0), summary: noSeries(fundingSummary(p.series)) }];
  }));
  const portfolio = { alignedHours: ew.aligned, droppedHoursPerAsset: ew.dropped, rawFundingCompensation: fundingSummary(ew.series), rules: ewRules };
  const cls = classify(portfolio.rawFundingCompensation);
  const coverage = Math.min(...quality.map((q) => q.completeness.coverageDays));

  const report = {
    ok: true, build: "047B", mode: MODE, preregistration: "docs/BUILD-047-PREREGISTRATION.md",
    eligibleForPromotion: canPromote(MODE, coverage), permanentMinimumDays: PERMANENT_MIN_DAYS, coverageDays: coverage,
    data: { venue: VENUE, sensorVersion: SENSOR_VERSION, sourceTag: SOURCE_TAG,
      semantics: "relativeFundingRate: fraction of notional per 1-hour period; timestamp = period start (UTC); positive = paid by longs, received by shorts (Kraken linear multi-collateral contract specifications). Units independently checked: |fundingRate / relativeFundingRate| equals the coin price (see docs/BUILD-047B-KRAKEN-FUNDING-CARRY.md)." },
    label: "RAW FUNDING COMPENSATION to a short perpetual per unit notional. NOT realizable delta-neutral return.",
    notModeled: ["spot/perpetual basis and its convergence/divergence", "entry and exit prices", "trading fees, spread and slippage on both legs", "hedge rebalancing", "collateral, margin and liquidation risk", "exchange, counterparty and stablecoin risk", "capital efficiency (margin plus spot capital)", "taxes"],
    rules: { always: "always short the perpetual", prevHourPositive: "exposed in hour t only if hour t-1 settled > 0", trailing24hAbove10pct: `exposed in hour t only if mean of hours t-24..t-1 > ${THRESHOLD_PER_HOUR.toExponential(4)} per hour (10%/yr simple)` },
    quality, perAsset, portfolio, classification: cls, authorizedToTrade: false,
  };
  writeFileSync("funding-exploratory-report.json", JSON.stringify(report, null, 2));
  writeFileSync("funding-exploratory-report.md", markdown(report));
  console.log(JSON.stringify({ ok: true, build: "047B", mode: MODE, classification: cls, eligibleForPromotion: report.eligibleForPromotion, authorizedToTrade: false }, null, 2));
}

const pc = (x: number | null | undefined, d = 2) => (x == null ? "" : (x * 100).toFixed(d) + "%");
function markdown(r: any) {
  const L = [`# Build 047B — Kraken funding carry (EXPLORATORY, one year, NOT VALIDATION)`, "", `Classification: **${r.classification.label}** (preregistered; equal-weight, always exposed).`, `Eligible for promotion: ${r.eligibleForPromotion} (coverage ${r.coverageDays} days < ${r.permanentMinimumDays}).`, "", r.label, "",
    "## Data quality", "", "| Asset | Rows | First | Last | Duplicates | Gaps | Missing hours | Other intervals | OK |", "|---|---:|---|---|---:|---:|---:|---|---|"];
  for (const q of r.quality) L.push(`| ${q.asset} | ${q.completeness.observations} | ${q.completeness.first} | ${q.completeness.last} | ${q.completeness.duplicates} | ${q.completeness.gaps} | ${q.completeness.missingPeriods} | ${JSON.stringify(q.intervalChanges)} | ${q.ok} |`);
  L.push("", "## Raw funding compensation (always short)", "", "| Series | Mean/h | Median/h | SD/h | % pos | % zero | % neg | Cumulative | Simple ann. | Compounded ann. | Best day | Worst day | Best month | Worst month | Longest + streak (h) | Longest - streak (h) | Max cum. DD |", "|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---|---|---|---|---:|---:|---:|");
  const row = (n: string, s: any) => `| ${n} | ${s.meanPerHour.toExponential(2)} | ${s.medianPerHour.toExponential(2)} | ${s.sdPerHour.toExponential(2)} | ${pc(s.positivePct, 1)} | ${pc(s.zeroPct, 1)} | ${pc(s.negativePct, 1)} | ${pc(s.cumulative)} | ${pc(s.simpleAnnualized)} | ${pc(s.compoundedAnnualized)} | ${s.bestDay.date} ${pc(s.bestDay.funding, 3)} | ${s.worstDay.date} ${pc(s.worstDay.funding, 3)} | ${s.bestMonth.month} ${pc(s.bestMonth.funding)} | ${s.worstMonth.month} ${pc(s.worstMonth.funding)} | ${s.longestPositiveStreakHours} | ${s.longestNegativeStreakHours} | ${pc(s.maxCumulativeDrawdown)} |`;
  for (const a of r.perAsset) L.push(row(a.asset, a.rawFundingCompensation));
  L.push(row("**Equal weight**", r.portfolio.rawFundingCompensation), "", "## Monthly raw funding", "", "| Month | " + r.perAsset.map((a: any) => a.asset).join(" | ") + " | Equal weight |", "|---|" + r.perAsset.map(() => "---:|").join("") + "---:|");
  for (const m of r.portfolio.rawFundingCompensation.monthly) L.push(`| ${m.month} | ` + r.perAsset.map((a: any) => pc(a.rawFundingCompensation.monthly.find((x: any) => x.month === m.month)?.funding)).join(" | ") + ` | ${pc(m.funding)} |`);
  L.push("", "## Preregistered exposure rules (equal weight)", "", "| Rule | Fraction exposed | Switches (all assets) | Cumulative | Simple ann. | Max cum. DD |", "|---|---:|---:|---:|---:|---:|");
  for (const [k, v] of Object.entries<any>(r.portfolio.rules)) L.push(`| ${k} | ${pc(v.meanFractionExposed, 1)} | ${v.totalSwitches} | ${pc(v.summary.cumulative)} | ${pc(v.summary.simpleAnnualized)} | ${pc(v.summary.maxCumulativeDrawdown)} |`);
  L.push("", "Not modeled: " + r.notModeled.join("; ") + ".");
  return L.join("\n");
}

if (process.argv[1]?.endsWith("fundingExploratory.ts")) main().catch((e) => { console.error(e); process.exitCode = 1; });
