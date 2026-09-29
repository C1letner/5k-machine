// Build 043: run requests. Executes an allow-listed sequence of research jobs described in
// ops/run-requests/<id>.json and writes a report per request to reports-out/<id>/.
// The run-requests workflow then publishes reports-out/ to the `reports` branch.
//
// Only the jobs below can run. None of them places trades, changes trading authority,
// or touches credentials; the backfills write market data only.
//
// Request format:
//   { "note": "why this run", "jobs": [ { "job": "backfill-prices", "days": 1095 }, { "job": "calibrate" } ] }
import { spawnSync } from "node:child_process";
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";

type Job = { job: string; days?: number };
type JobSpec = { script: string; needsDays?: boolean; outputs?: string[]; stdoutTo?: string };

export const JOBS: Record<string, JobSpec> = {
  "backfill-prices": { script: "backfill", needsDays: true },
  "backfill-volume": { script: "backfill:volume", needsDays: true },
  "diagnose": { script: "diagnose:data", stdoutTo: "data-integrity.json" },
  "calibrate": { script: "calibrate", outputs: ["calibration-report.md", "calibration-report.json"] },
  "temporal-audit": { script: "audit:temporal", stdoutTo: "temporal-integrity.json" },
  "mechanisms": { script: "research:mechanisms", stdoutTo: "mechanism-research.json" },
};

const MAX_LOG = 200_000;

export function validate(req: any): Job[] {
  if (!req || !Array.isArray(req.jobs) || !req.jobs.length) throw new Error("request needs a non-empty jobs array");
  if (req.jobs.length > 10) throw new Error("at most 10 jobs per request");
  return req.jobs.map((j: any) => {
    if (!j || typeof j.job !== "string" || !(j.job in JOBS)) throw new Error(`job not allowed: ${JSON.stringify(j?.job)} (allowed: ${Object.keys(JOBS).join(", ")})`);
    if (JOBS[j.job].needsDays) {
      const d = Number(j.days ?? 1095);
      if (!Number.isInteger(d) || d < 1 || d > 3650) throw new Error(`${j.job}: days must be an integer 1-3650`);
      return { job: j.job, days: d };
    }
    return { job: j.job };
  });
}

function runOne(j: Job, dir: string) {
  const spec = JOBS[j.job], started = Date.now();
  const env = { ...process.env, ...(j.days ? { BACKFILL_DAYS: String(j.days) } : {}) };
  const r = spawnSync("npm", ["run", "-s", spec.script], { env, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 });
  const out = r.stdout ?? "", err = r.stderr ?? "";
  if (spec.stdoutTo) writeFileSync(join(dir, spec.stdoutTo), out);
  writeFileSync(join(dir, `${j.job}.log`), (out + (err ? "\n--- stderr ---\n" + err : "")).slice(-MAX_LOG));
  for (const f of spec.outputs ?? []) if (existsSync(f)) copyFileSync(f, join(dir, f));
  return { job: j.job, days: j.days, ok: r.status === 0, exitCode: r.status, minutes: Math.round((Date.now() - started) / 6000) / 10 };
}

function main() {
  const files = process.argv.slice(2).filter((f) => f.endsWith(".json"));
  if (!files.length) { console.log("No new run requests."); return; }
  let failed = false;
  for (const file of files) {
    const id = basename(file, ".json"), dir = join("reports-out", id);
    mkdirSync(dir, { recursive: true });
    const lines = [`# Run request ${id}`, "", `Requested at commit ${process.env.GITHUB_SHA ?? "local"}.`, ""];
    let results: ReturnType<typeof runOne>[] = [];
    try {
      const req = JSON.parse(readFileSync(file, "utf8"));
      if (req.note) lines.push(`Note: ${String(req.note).slice(0, 500)}`, "");
      for (const j of validate(req)) {
        const res = runOne(j, dir);
        results.push(res);
        console.log(JSON.stringify(res));
        if (!res.ok) break; // later jobs usually depend on earlier ones
      }
    } catch (e) {
      lines.push(`**Request rejected:** ${(e as Error).message}`, "");
      failed = true;
    }
    if (results.length) {
      lines.push("| Job | Days | Result | Minutes |", "|---|---:|---|---:|", ...results.map((r) => `| ${r.job} | ${r.days ?? ""} | ${r.ok ? "success" : `FAILED (exit ${r.exitCode})`} | ${r.minutes} |`), "");
      if (results.some((r) => !r.ok)) failed = true;
    }
    if (existsSync(join(dir, "calibration-report.md"))) lines.push(readFileSync(join(dir, "calibration-report.md"), "utf8"));
    writeFileSync(join(dir, "summary.md"), lines.join("\n"));
    writeFileSync(join(dir, "status.json"), JSON.stringify({ id, commit: process.env.GITHUB_SHA ?? null, finishedAt: new Date().toISOString(), ok: !failed, results }, null, 2));
  }
  writeFileSync(join("reports-out", "LATEST.txt"), files.map((f) => basename(f, ".json")).join("\n") + "\n");
  if (failed) process.exitCode = 1;
}

if (process.argv[1]?.endsWith("runRequests.ts")) main();
