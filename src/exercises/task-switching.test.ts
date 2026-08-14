import { describe, expect, it } from "vitest";
import { buildSequence, createTrailTrial, isExpectedNext, summarizeRound, type TrailBounds, type TrailState } from "./task-switching";

const BOUNDS: TrailBounds = { width: 440, height: 440, cellSize: 44 };

const EMPTY_STATE: TrailState = { attempts: 0, completedCount: 0, totalErrors: 0, bestCompletionMs: null };

describe("buildSequence", () => {
  it("alternates numbers and letters starting with 1", () => {
    expect(buildSequence()).toEqual(["1", "A", "2", "B", "3", "C", "4", "D", "5", "E", "6", "F"]);
  });
});

describe("isExpectedNext", () => {
  const sequence = buildSequence();

  it("accepts the correct next label at each step", () => {
    sequence.forEach((label, i) => {
      expect(isExpectedNext(sequence, i, label)).toBe(true);
    });
  });

  it("rejects any label other than the expected next one", () => {
    expect(isExpectedNext(sequence, 0, "A")).toBe(false); // "1" is expected first, not "A"
    expect(isExpectedNext(sequence, 1, "2")).toBe(false); // "A" is expected second
    expect(isExpectedNext(sequence, 5, "D")).toBe(false); // "C" is expected at index 5
  });
});

describe("createTrailTrial", () => {
  it("places exactly one node per sequence label, at distinct positions", () => {
    const trial = createTrailTrial(BOUNDS);
    expect(trial.nodes).toHaveLength(12);
    expect(trial.nodes.map(n => n.label)).toEqual(trial.sequence);
    const positions = trial.nodes.map(n => `${n.x},${n.y}`);
    expect(new Set(positions).size).toBe(12);
  });

  it("keeps every node within the given bounds", () => {
    const trial = createTrailTrial(BOUNDS);
    trial.nodes.forEach(node => {
      expect(node.x).toBeGreaterThanOrEqual(0);
      expect(node.x).toBeLessThanOrEqual(BOUNDS.width);
      expect(node.y).toBeGreaterThanOrEqual(0);
      expect(node.y).toBeLessThanOrEqual(BOUNDS.height);
    });
  });
});

describe("summarizeRound", () => {
  it("counts a completed round and records its time as the best, if it's the first", () => {
    const next = summarizeRound(EMPTY_STATE, { completed: true, completionMs: 15000, errorCount: 2 });
    expect(next).toEqual({ attempts: 1, completedCount: 1, totalErrors: 2, bestCompletionMs: 15000 });
  });

  it("counts a timed-out round without marking it completed or touching the best time", () => {
    const next = summarizeRound(EMPTY_STATE, { completed: false, completionMs: null, errorCount: 4 });
    expect(next).toEqual({ attempts: 1, completedCount: 0, totalErrors: 4, bestCompletionMs: null });
  });

  it("only replaces the best completion time with a faster one", () => {
    const afterFirst = summarizeRound(EMPTY_STATE, { completed: true, completionMs: 20000, errorCount: 0 });
    const slower = summarizeRound(afterFirst, { completed: true, completionMs: 25000, errorCount: 1 });
    expect(slower.bestCompletionMs).toBe(20000);

    const faster = summarizeRound(afterFirst, { completed: true, completionMs: 12000, errorCount: 0 });
    expect(faster.bestCompletionMs).toBe(12000);
  });

  it("accumulates errors and attempts across multiple rounds", () => {
    let state = EMPTY_STATE;
    state = summarizeRound(state, { completed: true, completionMs: 18000, errorCount: 1 });
    state = summarizeRound(state, { completed: false, completionMs: null, errorCount: 3 });
    state = summarizeRound(state, { completed: true, completionMs: 16000, errorCount: 0 });
    expect(state.attempts).toBe(3);
    expect(state.completedCount).toBe(2);
    expect(state.totalErrors).toBe(4);
    expect(state.bestCompletionMs).toBe(16000);
  });
});
