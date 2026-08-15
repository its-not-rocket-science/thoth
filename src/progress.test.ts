import { describe, expect, it } from "vitest";
import { sparklinePoints, trend, trendSymbol } from "./progress";

describe("trend", () => {
  it("reads a 'lower is better' metric getting smaller as an improvement", () => {
    expect(trend(800, 900, "lower")).toBe("up");
  });

  it("reads a 'lower is better' metric getting larger as a decline", () => {
    expect(trend(950, 900, "lower")).toBe("down");
  });

  it("reads a 'higher is better' metric getting larger as an improvement", () => {
    expect(trend(18, 15, "higher")).toBe("up");
  });

  it("reads a 'higher is better' metric getting smaller as a decline", () => {
    expect(trend(12, 15, "higher")).toBe("down");
  });

  it("is flat when the value hasn't changed", () => {
    expect(trend(500, 500, "lower")).toBe("flat");
  });

  it("is always flat for a neutral-direction metric, regardless of change", () => {
    expect(trend(10, 5, "neutral")).toBe("flat");
    expect(trend(5, 10, "neutral")).toBe("flat");
  });

  it("is unknown when either value is missing", () => {
    expect(trend(null, 900, "lower")).toBe("unknown");
    expect(trend(900, null, "lower")).toBe("unknown");
    expect(trend(null, null, "lower")).toBe("unknown");
  });
});

describe("trendSymbol", () => {
  it("maps each trend to a distinct glyph", () => {
    expect(trendSymbol("up")).toBe("▲");
    expect(trendSymbol("down")).toBe("▼");
    expect(trendSymbol("flat")).toBe("▬");
    expect(trendSymbol("unknown")).toBe("—");
  });
});

describe("sparklinePoints", () => {
  it("returns null with fewer than two numeric points", () => {
    expect(sparklinePoints([], 100, 40)).toBeNull();
    expect(sparklinePoints([5], 100, 40)).toBeNull();
    expect(sparklinePoints([null, 5, null], 100, 40)).toBeNull();
  });

  it("produces one coordinate pair per value", () => {
    const points = sparklinePoints([10, 20, 15], 100, 40);
    expect(points).not.toBeNull();
    expect(points?.split(" ")).toHaveLength(3);
  });

  it("plots a numerically higher value higher on screen (a smaller y)", () => {
    const points = sparklinePoints([0, 100], 100, 40, 0);
    const [first, second] = (points as string).split(" ").map(p => p.split(",").map(Number));
    expect((first as number[])[1]).toBeGreaterThan((second as number[])[1] as number);
  });

  it("skips null values but keeps chronological x-spacing for the ones it plots", () => {
    const points = sparklinePoints([10, null, 20, 30], 120, 40, 0);
    expect(points?.split(" ")).toHaveLength(3);
  });

  it("centres a flat series (zero span) rather than dividing by zero", () => {
    const points = sparklinePoints([50, 50, 50], 100, 40);
    expect(points).not.toBeNull();
    expect(points).not.toContain("NaN");
  });
});
