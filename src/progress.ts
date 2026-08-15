import type { MetricDirection } from "./types";

export type TrendDirection = "up" | "down" | "flat" | "unknown";

/**
 * Pure: compares `current` against `previous` given which raw direction
 * counts as improvement for this metric, and returns a trend direction —
 * "up" always means "reads as improvement", "down" always means "reads as
 * decline", regardless of whether the underlying number went up or down
 * numerically (a "lower is better" metric getting smaller is an "up"
 * trend). Null values (metric not recorded that session) yield "unknown"
 * rather than guessing.
 */
export function trend(current: number | null, previous: number | null, direction: MetricDirection): TrendDirection {
  if (current === null || previous === null) return "unknown";
  if (current === previous || direction === "neutral") return "flat";
  const improved = direction === "higher" ? current > previous : current < previous;
  return improved ? "up" : "down";
}

export function trendSymbol(value: TrendDirection): string {
  if (value === "up") return "▲";
  if (value === "down") return "▼";
  if (value === "flat") return "▬";
  return "—";
}

/** Pure: builds an SVG <polyline> `points` attribute plotting `values`
 *  (oldest first) across a width×height box. The line always shows what
 *  the raw number did over time — a numerically higher value plots higher
 *  on screen — regardless of whether "higher" or "lower" is this metric's
 *  "better" direction; direction is communicated separately (trendSymbol/
 *  a "lower is better" label), not by inverting the axis, so the chart
 *  itself never has to be read two different ways for two different
 *  metrics. Returns null when there are fewer than two numeric points to
 *  plot a line through (a flat single dot isn't a trend). */
export function sparklinePoints(
  values: Array<number | null>,
  width: number,
  height: number,
  padding = 4,
): string | null {
  const numeric = values.filter((v): v is number => v !== null);
  if (numeric.length < 2) return null;

  const min = Math.min(...numeric);
  const max = Math.max(...numeric);
  const span = max - min;
  const usableWidth = width - padding * 2;
  const usableHeight = height - padding * 2;
  const step = values.length > 1 ? usableWidth / (values.length - 1) : 0;

  const points: string[] = [];
  values.forEach((value, i) => {
    if (value === null) return;
    const x = padding + step * i;
    const y = span === 0 ? padding + usableHeight / 2 : padding + usableHeight - ((value - min) / span) * usableHeight;
    points.push(`${x.toFixed(1)},${y.toFixed(1)}`);
  });
  return points.join(" ");
}
