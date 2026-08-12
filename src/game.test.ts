import { describe, expect, it } from "vitest";
import { INITIAL_STATE, scoreTrial, summarizeSession } from "./game";
import type { Trial } from "./types";

const trial: Trial = {
  centralSymbol: "circle",
  peripheralPosition: 3,
  presentationMs: INITIAL_STATE.presentationMs,
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
    const state = { score: 3, attempts: 4, streak: 1, presentationMs: 700 };
    const summary = summarizeSession(state, 620);
    expect(summary.accuracyPct).toBe(75);
    expect(summary.correct).toBe(3);
    expect(summary.incorrect).toBe(1);
    expect(summary.lowestPresentationMs).toBe(620);
  });

  it("rounds accuracy to the nearest percent", () => {
    const state = { score: 1, attempts: 3, streak: 0, presentationMs: 850 };
    const summary = summarizeSession(state, 850);
    expect(summary.accuracyPct).toBe(33);
  });
});
