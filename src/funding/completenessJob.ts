// Build 046 data: completeness check of STORED Kraken funding history (reads Supabase only).
// Two series per instrument:
//   FUND046-KRAKEN     settled rates (authoritative; ~last year only)
//   FUND046-KRAKEN-AN  analytics series, stored only after validation against the settled rates
// The research series is the analytics series if it passes the gate, else the settled series if that passes.
// Exits non-zero if no series passes for some instrument, so the carry job does not run on inadequate data.
import { db } from "../db.js";
import { ANALYTICS_SENSOR } from "./krakenAnalytics.js";
import { INSTRUMENTS, SENSOR_VERSION, VENUE, assess, completeness } from "./kraken.js";

const PAGE = 1000, MIN_DAYS = Number(process.env.MIN_FUNDING_DAYS ?? 730);
export const SERIES = [ANALYTICS_SENSOR, SENSOR_VERSION];

export async function loadStored(instrument: string, sensor = SENSOR_VERSION) {
  const rows: { t: number; relative: number }[] = [];
  for (let f = 0; ; f += PAGE) {
    const { data, error } = await db.from("derivatives_observations").select("observed_at,funding_rate")
      .eq("venue", VENUE).eq("instrument", instrument).eq("sensor_version", sensor)
      .order("observed_at", { ascending: true }).range(f, f + PAGE - 1);
    if (error) throw error;
    for (const r of data ?? []) if (r.funding_rate != null) rows.push({ t: Date.parse(r.observed_at), relative: Number(r.funding_rate) });
    if ((data ?? []).length < PAGE) break;
  }
  return rows;
}

/** The first series (analytics, then settled) that passes the gate, with checks for all series. */
export async function researchSeries(instrument: string, minDays = MIN_DAYS) {
  const checks: any[] = [];
  let chosen: { sensor: string; rows: { t: number; relative: number }[] } | null = null;
  for (const sensor of SERIES) {
    const rows = await loadStored(instrument, sensor), c = completeness(rows), gate = assess(c, minDays);
    checks.push({ sensor, ...c, gate });
    if (!chosen && gate.pass) chosen = { sensor, rows };
  }
  return { chosen, checks };
}

async function main() {
  const out: any[] = [];
  let pass = true;
  for (const { asset, instrument } of INSTRUMENTS) {
    const { chosen, checks } = await researchSeries(instrument);
    if (!chosen) pass = false;
    out.push({ asset, instrument, researchSeries: chosen?.sensor ?? null, series: checks });
  }
  console.log(JSON.stringify({ ok: pass, build: "046-data", check: "funding completeness (stored data)", minCoverageDays: MIN_DAYS, results: out, authorizedToTrade: false }, null, 2));
  if (!pass) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("completenessJob.ts")) main().catch((e) => { console.error(e); process.exitCode = 1; });
