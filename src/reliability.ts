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

export function classifyReliability(s: ReliabilitySnapshot): ReliabilityState {
  const backlog = s.pending + s.claimed;
  if (
    s.sensorAgeMinutes == null ||
    s.sensorAgeMinutes > 90 ||
    s.staleClaims > 0 ||
    s.failure > 0
  ) return "RED";

  if (s.sensorAgeMinutes > 70 || backlog > 1) return "YELLOW";
  return "GREEN";
}

export function ageMinutes(iso: string | null | undefined, nowMs = Date.now()): number | null {
  if (!iso) return null;
  const t = Date.parse(iso);
  if (!Number.isFinite(t)) return null;
  return Math.max(0, (nowMs - t) / 60000);
}
