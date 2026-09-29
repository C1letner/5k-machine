// Build 041: read-only data-integrity diagnostic.
// Answers: what data does each stage actually see? Writes nothing to the database.
import { appendFileSync } from "node:fs";
import { db } from "../db.js";

const PAGE = 1000;
const HOUR = 3600_000;

async function pageAll(table: string, columns: string, filter?: (q: any) => any) {
  const rows: any[] = [];
  for (let from = 0; ; from += PAGE) {
    let q = db.from(table).select(columns);
    if (filter) q = filter(q);
    // Order on a unique key so pages neither skip nor repeat rows.
    const { data, error } = await q.order("observed_at", { ascending: true }).order("asset", { ascending: true }).order("sensor_version", { ascending: true }).range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...(data ?? []));
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}

function minuteHistogram(ts: string[]) {
  const h = new Map<number, number>();
  for (const t of ts) {
    const m = new Date(t).getUTCMinutes();
    h.set(m, (h.get(m) ?? 0) + 1);
  }
  return [...h.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([minute, count]) => ({ minute, count }));
}

function gaps(ts: string[]) {
  const t = ts.map((x) => Date.parse(x)).sort((a, b) => a - b);
  let missingHours = 0, largestGapHours = 0, duplicates = 0;
  for (let i = 1; i < t.length; i++) {
    const d = (t[i] - t[i - 1]) / HOUR;
    if (d === 0) duplicates++;
    if (d > 1) { missingHours += Math.round(d) - 1; largestGapHours = Math.max(largestGapHours, d); }
  }
  return { missingHours, largestGapHours, duplicates };
}

async function main() {
  const snaps = await pageAll("crypto_universe_snapshots", "observed_at,asset,sensor_version");
  const vols = await pageAll("market_volume_observations", "observed_at,asset,sensor_version", (q) => q.eq("sensor_version", "VOL035"));

  // 1. What is in the price table, by asset and sensor version.
  const groups = new Map<string, string[]>();
  for (const r of snaps) {
    const k = `${r.asset}|${r.sensor_version}`;
    (groups.get(k) ?? groups.set(k, []).get(k)!).push(r.observed_at);
  }
  const priceTable = [...groups.entries()].map(([k, ts]) => {
    const [asset, sensor] = k.split("|");
    return { asset, sensor, rows: ts.length, first: ts[0], last: ts.at(-1), topMinutesPastHour: minuteHistogram(ts), ...(sensor === "HIST-028" ? gaps(ts) : {}) };
  }).sort((a, b) => a.asset.localeCompare(b.asset) || a.sensor.localeCompare(b.sensor));

  // 2. Where historical backfill and live snapshots overlap in time (mixing risk).
  const overlap = [...new Set(snaps.map((r) => r.asset))].sort().map((asset) => {
    const h = groups.get(`${asset}|HIST-028`) ?? [], u = groups.get(`${asset}|U1`) ?? [];
    if (!h.length || !u.length) return { asset, overlappingLiveRows: 0 };
    const lo = Date.parse(h[0]), hi = Date.parse(h.at(-1)!);
    return { asset, overlappingLiveRows: u.filter((t) => { const x = Date.parse(t); return x >= lo && x <= hi; }).length };
  });

  // 3. Exactly what the pre-041 Discovery Test query returned: no pagination, no source filter.
  const end = new Date().toISOString(), start = new Date(Date.now() - 180 * 24 * HOUR).toISOString();
  const oldTesterQuery = [];
  for (const asset of [...new Set(snaps.map((r) => r.asset))].sort()) {
    const { data, error } = await db.from("crypto_universe_snapshots").select("observed_at,sensor_version").eq("asset", asset).gte("observed_at", start).lte("observed_at", end).order("observed_at", { ascending: true });
    if (error) throw error;
    const d = data ?? [];
    const first = d[0]?.observed_at, last = d.at(-1)?.observed_at;
    const available = snaps.filter((r) => r.asset === asset && r.observed_at >= start && r.observed_at <= end).length;
    oldTesterQuery.push({
      asset, rowsReturned: d.length, rowsAvailableInWindow: available, first, last,
      daysCovered: first && last ? Math.round((Date.parse(last) - Date.parse(first)) / (24 * HOUR)) : 0,
      sensorsMixed: [...new Set(d.map((x) => x.sensor_version))],
    });
  }

  // 4. Price/volume alignment for the backfilled series.
  const hist = new Set(snaps.filter((r) => r.sensor_version === "HIST-028").map((r) => `${r.asset}|${r.observed_at}`));
  const volAligned = vols.filter((r) => hist.has(`${r.asset}|${r.observed_at}`)).length;

  // 5. Which code versions produced existing Discovery Test results.
  const { data: tests, error: te } = await db.from("hypothesis_tests").select("code_version,verdict,sample_size").eq("test_type", "DISCOVERY");
  if (te) throw te;
  const byVersion: Record<string, Record<string, number>> = {};
  for (const t of tests ?? []) { const v = (byVersion[t.code_version] ??= {}); v[t.verdict] = (v[t.verdict] ?? 0) + 1; }

  const report = {
    ok: true, build: "041-diagnostic", generatedAt: end, readOnly: true, authorizedToTrade: false,
    priceTable, historicalVsLiveOverlap: overlap, oldDiscoveryTestQuery: oldTesterQuery,
    volume: { vol035Rows: vols.length, alignedWithHist028: volAligned },
    discoveryTestsByCodeVersion: byVersion,
    timestampConvention: "HIST-028 and VOL035 rows are labeled with the candle START time but hold the candle CLOSE price / full-hour volume, which is only known at observed_at + 1h. U1 live rows are labeled with the actual observation time.",
  };
  console.log(JSON.stringify(report, null, 2));

  const summary = process.env.GITHUB_STEP_SUMMARY;
  if (summary) {
    const lines = ["## Data integrity (build 041)", "", "### What the pre-041 Discovery Test query returned", "", "| Asset | Rows returned | Rows available (180d) | Days covered | Sources mixed |", "|---|---:|---:|---:|---|",
      ...oldTesterQuery.map((r) => `| ${r.asset} | ${r.rowsReturned} | ${r.rowsAvailableInWindow} | ${r.daysCovered} | ${r.sensorsMixed.join(", ")} |`),
      "", "### Price table by source", "", "| Asset | Source | Rows | First | Last | Missing hours |", "|---|---|---:|---|---|---:|",
      ...priceTable.map((r: any) => `| ${r.asset} | ${r.sensor} | ${r.rows} | ${r.first} | ${r.last} | ${r.missingHours ?? ""} |`),
      "", `Volume rows (VOL035): ${vols.length}; aligned with HIST-028 timestamps: ${volAligned}`, ""];
    appendFileSync(summary, lines.join("\n"));
  }
}

main().catch((e) => { console.error(e); process.exitCode = 1; });
