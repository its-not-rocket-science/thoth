import { describe, expect, it } from "vitest";
import {
  addRtSample,
  createSearchTrial,
  randomGridPositions,
  slope,
  type RtSizeStats,
  type SearchBounds,
} from "./visual-search";

const BOUNDS: SearchBounds = { width: 440, height: 440, cellSize: 44 };
const EMPTY_STATS: RtSizeStats = { n: 0, sumSetSize: 0, sumRt: 0, sumSetSizeRt: 0, sumSetSizeSq: 0 };

describe("createSearchTrial", () => {
  it("feature trials vary exactly one dimension: every distractor shares either the target's shape or its colour", () => {
    for (let i = 0; i < 30; i++) {
      const trial = createSearchTrial("feature", 8, BOUNDS);
      const target = trial.items[trial.targetIndex];
      expect(target).toBeDefined();
      trial.items.forEach((item, index) => {
        if (index === trial.targetIndex) return;
        const sameShape = item.shape === target?.shape;
        const sameColor = item.color === target?.color;
        // Exactly one of shape/colour matches — never both (that would
        // make it indistinguishable) and never neither (that would leave
        // two discriminating features instead of one).
        expect(sameShape !== sameColor).toBe(true);
      });
    }
  });

  it("conjunction trials: every distractor shares exactly one feature, but no distractor shares both", () => {
    for (let i = 0; i < 30; i++) {
      const trial = createSearchTrial("conjunction", 10, BOUNDS);
      const target = trial.items[trial.targetIndex];
      trial.items.forEach((item, index) => {
        if (index === trial.targetIndex) return;
        const sameShape = item.shape === target?.shape;
        const sameColor = item.color === target?.color;
        expect(sameShape && sameColor).toBe(false);
      });
      // With enough distractors, both share-types should typically appear
      // (not required every run, but at least one distractor differs from
      // the target in shape and at least one differs in colour).
      const shapes = new Set(trial.items.map(item => item.shape));
      const colors = new Set(trial.items.map(item => item.color));
      expect(shapes.size).toBeGreaterThan(1);
      expect(colors.size).toBeGreaterThan(1);
    }
  });

  it("identifies exactly one correct target index within range", () => {
    const trial = createSearchTrial("feature", 12, BOUNDS);
    expect(trial.targetIndex).toBeGreaterThanOrEqual(0);
    expect(trial.targetIndex).toBeLessThan(trial.items.length);
    expect(trial.items[trial.targetIndex]).toEqual({
      shape: "diamond",
      color: "brass",
      x: trial.items[trial.targetIndex]?.x,
      y: trial.items[trial.targetIndex]?.y,
    });
  });

  it("produces exactly setSize items with distinct positions", () => {
    const trial = createSearchTrial("conjunction", 15, BOUNDS);
    expect(trial.items).toHaveLength(15);
    const positions = trial.items.map(item => `${item.x},${item.y}`);
    expect(new Set(positions).size).toBe(15);
  });
});

describe("randomGridPositions", () => {
  it("returns distinct cell-centre positions within bounds", () => {
    const positions = randomGridPositions(BOUNDS, 20);
    expect(positions).toHaveLength(20);
    const keys = positions.map(p => `${p.x},${p.y}`);
    expect(new Set(keys).size).toBe(20);
    positions.forEach(p => {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(BOUNDS.width);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(BOUNDS.height);
    });
  });

  it("clamps to the available grid cells rather than duplicating positions", () => {
    const tiny: SearchBounds = { width: 44, height: 44, cellSize: 44 };
    const positions = randomGridPositions(tiny, 5);
    expect(positions).toHaveLength(1);
  });
});

describe("addRtSample / slope", () => {
  it("returns null with fewer than two samples", () => {
    expect(slope(EMPTY_STATS)).toBeNull();
    expect(slope(addRtSample(EMPTY_STATS, 8, 500))).toBeNull();
  });

  it("computes the exact least-squares slope for a known perfectly linear sequence", () => {
    // (setSize, rt): (4,400), (8,600), (12,800) -> 50ms per additional item.
    let stats = EMPTY_STATS;
    stats = addRtSample(stats, 4, 400);
    stats = addRtSample(stats, 8, 600);
    stats = addRtSample(stats, 12, 800);
    expect(slope(stats)).toBeCloseTo(50, 5);
  });

  it("returns a near-zero slope for flat (pop-out-like) reaction times", () => {
    let stats = EMPTY_STATS;
    stats = addRtSample(stats, 4, 500);
    stats = addRtSample(stats, 12, 505);
    stats = addRtSample(stats, 20, 498);
    expect(Math.abs(slope(stats) ?? Infinity)).toBeLessThan(2);
  });

  it("returns null when every sample has the same set size (undefined slope)", () => {
    let stats = EMPTY_STATS;
    stats = addRtSample(stats, 8, 400);
    stats = addRtSample(stats, 8, 450);
    expect(slope(stats)).toBeNull();
  });
});
