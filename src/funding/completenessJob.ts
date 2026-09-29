// Build 046 data: completeness check of STORED Kraken funding history (reads Supabase only).
// Exits non-zero if any instrument fails the research gate, so a following carry job does not run
// on inadequate data. MIN_FUNDING_DAYS overrides the 730-day minimum.
import { db } from "../db.js";
import { INSTRUMENTS, SENSOR_VERSION, VENUE, assess, completeness } from "./kraken.js";

const PAGE = 1000, MIN_DAYS = Number(process.env.MIN_FUNDING_DAYS ?? 730);

export async function loadStored(instrument: string) {
  const rows: { t: number; relative: number }[] = [];
  for (let f = 0; ; f += PAGE) {
    const { data, error } = await db.from("derivatives_observations").select("observed_at,funding_rate")
      .eq("venue", VENUE).eq("instrument", instrument).eq("sensor_version", SENSOR_VERSION)
      .order("observed_at", { ascending: true }).range(f, f + PAGE - 1);
    if (error) throw error;
    for (const r of data ?? []) if (r.funding_rate != null) rows.push({ t: Date.parse(r.observed_at), relative: Number(r.funding_rate) });
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}

async function main() {
  const out: any[] = [];
  let pass = true;
  for (const { asset, instrument } of INSTRUMENTS) {
    const c = completeness(await loadStored(instrument)), v = assess(c, MIN_DAYS);
    if (!v.pass) pass = false;
    out.push({ asset, instrument, ...c, gate: v });
  }
  console.log(JSON.stringify({ ok: pass, build: "046-data", check: "funding completeness (stored data)", minCoverageDays: MIN_DAYS, results: out, authorizedToTrade: false }, null, 2));
  if (!pass) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("completenessJob.ts")) main().catch((e) => { console.error(e); process.exitCode = 1; });
