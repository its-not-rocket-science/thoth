import { describe, expect, it } from "vitest";
import {
  createTrial,
  DISTRACTOR_STAIRCASE,
  generateDistractors,
  INITIAL_STATE,
  PRESENTATION_STAIRCASE,
  scoreTrial,
  stepStaircase,
  summarizeSession,
} from "./game";
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
    const state = {
      score: 3,
      attempts: 4,
      presentationMs: 700,
      presentationStreak: 1,
      distractorCount: 2,
      distractorStreak: 1,
    };
    const summary = summarizeSession(state, 620);
    expect(summary.accuracyPct).toBe(75);
    expect(summary.correct).toBe(3);
    expect(summary.incorrect).toBe(1);
    expect(summary.lowestPresentationMs).toBe(620);
  });

  it("rounds accuracy to the nearest percent", () => {
    const state = {
      score: 1,
      attempts: 3,
      presentationMs: 850,
      presentationStreak: 0,
      distractorCount: 2,
      distractorStreak: 0,
    };
    const summary = summarizeSession(state, 850);
    expect(summary.accuracyPct).toBe(33);
  });
});

describe("stepStaircase", () => {
  it("holds steady on a single correct response (streak below threshold)", () => {
    expect(stepStaircase({ value: 850, streak: 0 }, true, PRESENTATION_STAIRCASE)).toEqual({
      value: 850,
      streak: 1,
    });
  });

  it("steps harder and resets the streak on the second consecutive correct response", () => {
    expect(stepStaircase({ value: 850, streak: 1 }, true, PRESENTATION_STAIRCASE)).toEqual({
      value: 765, // round(850 * 0.9)
      streak: 0,
    });
  });

  it("steps easier and resets the streak on any incorrect response, regardless of streak", () => {
    expect(stepStaircase({ value: 850, streak: 1 }, false, PRESENTATION_STAIRCASE)).toEqual({
      value: 977, // round(850 * 1.15)
      streak: 0,
    });
    expect(stepStaircase({ value: 850, streak: 0 }, false, PRESENTATION_STAIRCASE)).toEqual({
      value: 977,
      streak: 0,
    });
  });

  it("clamps the presentation interval at its floor and ceiling", () => {
    expect(stepStaircase({ value: 125, streak: 1 }, true, PRESENTATION_STAIRCASE)).toEqual({
      value: 120, // round(125 * 0.9) = 113, clamped to the 120ms floor
      streak: 0,
    });
    expect(stepStaircase({ value: 1400, streak: 0 }, false, PRESENTATION_STAIRCASE)).toEqual({
      value: 1500, // round(1400 * 1.15) = 1610, clamped to the 1500ms ceiling
      streak: 0,
    });
  });

  it("steps the distractor count up (harder) and down (easier) by whole distractors", () => {
    expect(stepStaircase({ value: 2, streak: 1 }, true, DISTRACTOR_STAIRCASE)).toEqual({
      value: 3,
      streak: 0,
    });
    expect(stepStaircase({ value: 2, streak: 0 }, false, DISTRACTOR_STAIRCASE)).toEqual({
      value: 1,
      streak: 0,
    });
  });

  it("clamps the distractor count at its floor and ceiling", () => {
    expect(stepStaircase({ value: 0, streak: 0 }, false, DISTRACTOR_STAIRCASE)).toEqual({
      value: 0,
      streak: 0,
    });
    expect(stepStaircase({ value: 5, streak: 1 }, true, DISTRACTOR_STAIRCASE)).toEqual({
      value: 5,
      streak: 0,
    });
  });

  it("replays an exact 2-down-1-up step pattern for a known correct/incorrect sequence", () => {
    const sequence = [true, true, false, true, true, true, false, true, true];
    let staircase = { value: 850, streak: 0 };
    const trace: number[] = [];
    for (const correct of sequence) {
      staircase = stepStaircase(staircase, correct, PRESENTATION_STAIRCASE);
      trace.push(staircase.value);
    }
    // 850 -(hold)-> 850 -(2nd correct, step)-> 765 -(miss, step)-> 880
    //   -(hold)-> 880 -(2nd correct, step)-> 792 -(hold)-> 792 -(miss, step)-> 911
    //   -(hold)-> 911 -(2nd correct, step)-> 820
    expect(trace).toEqual([850, 765, 880, 880, 792, 792, 911, 911, 820]);
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
