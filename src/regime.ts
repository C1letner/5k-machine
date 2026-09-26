export type RegimeLabel =
  | "INSUFFICIENT_DATA"
  | "RANGE"
  | "TREND_UP"
  | "TREND_DOWN"
  | "SHOCK_UP"
  | "SHOCK_DOWN";

export type RegimePoint = {
  observedAt: string;
  priceUsd: number;
};

export type RegimeResult = {
  label: RegimeLabel;
  observations: number;
  change1hPct: number | null;
  change4hPct: number | null;
  change24hPct: number | null;
  medianAbsMovePct: number | null;
  shockThresholdPct: number | null;
  trendThresholdPct: number | null;
  asOf: string | null;
  advisoryOnly: true;
};

const MIN_OBSERVATIONS = 25;
const MIN_SHOCK_THRESHOLD_PCT = 1;
const SHOCK_MEDIAN_MULTIPLIER = 3;
const MIN_TREND_THRESHOLD_PCT = 2;
const TREND_MEDIAN_MULTIPLIER = 4;

function pct(now: number, then: number | null): number | null {
  if (then == null || !Number.isFinite(then) || then <= 0) return null;
  return ((now / then) - 1) * 100;
}

function nearestAtOrBefore(points: RegimePoint[], targetMs: number): number | null {
  let bestTime = -Infinity;
  let bestPrice: number | null = null;

  for (const point of points) {
    const t = Date.parse(point.observedAt);
    if (!Number.isFinite(t) || t > targetMs || t <= bestTime) continue;
    if (!Number.isFinite(point.priceUsd) || point.priceUsd <= 0) continue;
    bestTime = t;
    bestPrice = point.priceUsd;
  }

  return bestPrice;
}

function median(values: number[]): number | null {
  if (!values.length) return null;
  const sorted = values.slice().sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1]! + sorted[mid]!) / 2
    : sorted[mid]!;
}

/**
 * Descriptive market-regime classifier.
 *
 * This function is intentionally advisory only. It does not produce an order,
 * position size, expected return, capital allocation, or trading authorization.
 */
export function classifyRegime(input: RegimePoint[]): RegimeResult {
  const points = input
    .filter(p =>
      Number.isFinite(Date.parse(p.observedAt)) &&
      Number.isFinite(p.priceUsd) &&
      p.priceUsd > 0
    )
    .slice()
    .sort((a, b) => Date.parse(a.observedAt) - Date.parse(b.observedAt));

  const latest = points.at(-1) ?? null;
  if (!latest || points.length < MIN_OBSERVATIONS) {
    return {
      label: "INSUFFICIENT_DATA",
      observations: points.length,
      change1hPct: null,
      change4hPct: null,
      change24hPct: null,
      medianAbsMovePct: null,
      shockThresholdPct: null,
      trendThresholdPct: null,
      asOf: latest?.observedAt ?? null,
      advisoryOnly: true
    };
  }

  const asOfMs = Date.parse(latest.observedAt);
  const change1hPct = pct(
    latest.priceUsd,
    nearestAtOrBefore(points, asOfMs - 60 * 60 * 1000)
  );
  const change4hPct = pct(
    latest.priceUsd,
    nearestAtOrBefore(points, asOfMs - 4 * 60 * 60 * 1000)
  );
  const change24hPct = pct(
    latest.priceUsd,
    nearestAtOrBefore(points, asOfMs - 24 * 60 * 60 * 1000)
  );

  const absMoves: number[] = [];
  for (let i = 1; i < points.length; i++) {
    const prior = points[i - 1]!;
    const current = points[i]!;
    const move = pct(current.priceUsd, prior.priceUsd);
    if (move != null && Number.isFinite(move)) absMoves.push(Math.abs(move));
  }

  const medianAbsMovePct = median(absMoves) ?? 0;
  const shockThresholdPct = Math.max(
    MIN_SHOCK_THRESHOLD_PCT,
    SHOCK_MEDIAN_MULTIPLIER * medianAbsMovePct
  );
  const trendThresholdPct = Math.max(
    MIN_TREND_THRESHOLD_PCT,
    TREND_MEDIAN_MULTIPLIER * medianAbsMovePct
  );

  let label: RegimeLabel = "RANGE";

  if (change1hPct != null && change1hPct >= shockThresholdPct) {
    label = "SHOCK_UP";
  } else if (change1hPct != null && change1hPct <= -shockThresholdPct) {
    label = "SHOCK_DOWN";
  } else if (
    change24hPct != null &&
    change4hPct != null &&
    change24hPct >= trendThresholdPct &&
    change4hPct > 0
  ) {
    label = "TREND_UP";
  } else if (
    change24hPct != null &&
    change4hPct != null &&
    change24hPct <= -trendThresholdPct &&
    change4hPct < 0
  ) {
    label = "TREND_DOWN";
  }

  return {
    label,
    observations: points.length,
    change1hPct,
    change4hPct,
    change24hPct,
    medianAbsMovePct,
    shockThresholdPct,
    trendThresholdPct,
    asOf: latest.observedAt,
    advisoryOnly: true
  };
}
