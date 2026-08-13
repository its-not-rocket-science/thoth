import { describe, expect, it } from "vitest";
import { createTrial, generateDistractors, INITIAL_STATE, scoreTrial, summarizeSession } from "./game";
import type { PeripheralPosition, Trial } from "./types";

const trial: Trial = {
  centralSymbol: "circle",
  peripheralPosition: 3,
  presentationMs: INITIAL_STATE.presentationMs,
  distractorPositions: [],
};

describe("scoreTrial", () => {
  it("scores a completely correct response", () => {
    const next = scoreTrial(INITIAL_STATE, trial, {
      centralSymbol: "circle",
      peripheralPosition: 3,
    });
    expect(next.score).toBe(1);
    expect(next.attempts).toBe(1);
  });

  it("rejects a partial response", () => {
    const next = scoreTrial(INITIAL_STATE, trial, {
      centralSymbol: "circle",
      peripheralPosition: 4,
    });
    expect(next.score).toBe(0);
    expect(next.presentationMs).toBeGreaterThan(INITIAL_STATE.presentationMs);
  });

  it("shortens presentation after two correct trials", () => {
    const first = scoreTrial(INITIAL_STATE, trial, {
      centralSymbol: "circle",
      peripheralPosition: 3,
    });
    const second = scoreTrial(first, trial, {
      centralSymbol: "circle",
      peripheralPosition: 3,
    });
    expect(second.presentationMs).toBeLessThan(INITIAL_STATE.presentationMs);
  });
});

describe("summarizeSession", () => {
  it("reports zero accuracy and no attempts for a fresh session", () => {
    const summary = summarizeSession(INITIAL_STATE, INITIAL_STATE.presentationMs);
    expect(summary).toEqual({
      score: 0,
      attempts: 0,
      accuracyPct: 0,
      correct: 0,
      incorrect: 0,
      lowestPresentationMs: INITIAL_STATE.presentationMs,
    });
  });

  it("derives accuracy and correct/incorrect counts from state", () => {
    const state = { score: 3, attempts: 4, streak: 1, presentationMs: 700, distractorCount: 2 };
    const summary = summarizeSession(state, 620);
    expect(summary.accuracyPct).toBe(75);
    expect(summary.correct).toBe(3);
    expect(summary.incorrect).toBe(1);
    expect(summary.lowestPresentationMs).toBe(620);
  });

  it("rounds accuracy to the nearest percent", () => {
    const state = { score: 1, attempts: 3, streak: 0, presentationMs: 850, distractorCount: 2 };
    const summary = summarizeSession(state, 850);
    expect(summary.accuracyPct).toBe(33);
  });
});

describe("generateDistractors", () => {
  it("never includes the target position", () => {
    for (let target = 0; target < 8; target++) {
      const distractors = generateDistractors(target as PeripheralPosition, 8);
      expect(distractors).not.toContain(target);
    }
  });

  it("returns the requested count, capped at the remaining pool size", () => {
    expect(generateDistractors(0, 0)).toHaveLength(0);
    expect(generateDistractors(0, 3)).toHaveLength(3);
    expect(generateDistractors(0, 7)).toHaveLength(7);
    expect(generateDistractors(0, 20)).toHaveLength(7);
  });

  it("never produces duplicate positions", () => {
    const distractors = generateDistractors(2, 7);
    expect(new Set(distractors).size).toBe(distractors.length);
  });
});

describe("createTrial with distractors", () => {
  it("wires the requested distractor count into the trial, excluding the target", () => {
    const created = createTrial(INITIAL_STATE.presentationMs, 2);
    expect(created.distractorPositions).toHaveLength(2);
    expect(created.distractorPositions).not.toContain(created.peripheralPosition);
  });

  it("defaults to no distractors when a count isn't given", () => {
    const created = createTrial(INITIAL_STATE.presentationMs);
    expect(created.distractorPositions).toHaveLength(0);
  });
});

describe("scoreTrial with distractors present", () => {
  it("only checks the true target position, ignoring distractors", () => {
    const trialWithDistractors: Trial = {
      centralSymbol: "circle",
      peripheralPosition: 3,
      presentationMs: INITIAL_STATE.presentationMs,
      distractorPositions: [0, 1, 5],
    };
    const next = scoreTrial(INITIAL_STATE, trialWithDistractors, {
      centralSymbol: "circle",
      peripheralPosition: 3,
    });
    expect(next.score).toBe(1);
  });

  it("scores a response matching a distractor position as incorrect", () => {
    const trialWithDistractors: Trial = {
      centralSymbol: "circle",
      peripheralPosition: 3,
      presentationMs: INITIAL_STATE.presentationMs,
      distractorPositions: [0, 1, 5],
    };
    const next = scoreTrial(INITIAL_STATE, trialWithDistractors, {
      centralSymbol: "circle",
      peripheralPosition: 1,
    });
    expect(next.score).toBe(0);
  });
});
