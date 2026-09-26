export type ReliabilityState = "GREEN" | "YELLOW" | "RED";

export type ReliabilitySnapshot = {
  sensorAgeMinutes: number | null;
  pending: number;
  claimed: number;
  failure: number;
  staleClaims: number;
  oldestBacklogAgeMinutes: number | null;
  completed24h: number;
  failed24h: number;
  latestWorkerAgeMinutes: number | null;
};

const RED_SENSOR_AGE_MINUTES = 90;
const YELLOW_SENSOR_AGE_MINUTES = 70;
const RED_BACKLOG_AGE_MINUTES = 120;
const YELLOW_BACKLOG_AGE_MINUTES = 70;
const RED_WORKER_AGE_MINUTES = 180;
const YELLOW_WORKER_AGE_MINUTES = 90;

export function classifyReliability(s: ReliabilitySnapshot): ReliabilityState {
  const backlog = s.pending + s.claimed;
  const backlogIsRed =
    s.oldestBacklogAgeMinutes != null &&
    s.oldestBacklogAgeMinutes > RED_BACKLOG_AGE_MINUTES;
  const workerIsRed =
    s.latestWorkerAgeMinutes != null &&
    s.latestWorkerAgeMinutes > RED_WORKER_AGE_MINUTES;

  if (
    s.sensorAgeMinutes == null ||
    s.sensorAgeMinutes > RED_SENSOR_AGE_MINUTES ||
    s.staleClaims > 0 ||
    s.failure > 0 ||
    backlogIsRed ||
    workerIsRed
  ) return "RED";

  const backlogIsYellow =
    s.oldestBacklogAgeMinutes != null &&
    s.oldestBacklogAgeMinutes > YELLOW_BACKLOG_AGE_MINUTES;
  const workerIsYellow =
    s.latestWorkerAgeMinutes != null &&
    s.latestWorkerAgeMinutes > YELLOW_WORKER_AGE_MINUTES;

  if (
    s.sensorAgeMinutes > YELLOW_SENSOR_AGE_MINUTES ||
    backlog > 1 ||
    backlogIsYellow ||
    workerIsYellow ||
    (backlog > 0 && s.latestWorkerAgeMinutes == null)
  ) return "YELLOW";

  return "GREEN";
}

export function ageMinutes(iso: string | null | undefined, nowMs = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (nowMs - t) / 60000);
}
