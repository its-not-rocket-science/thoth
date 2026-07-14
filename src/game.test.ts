import { describe, expect, it } from "vitest";
import { INITIAL_STATE, scoreTrial } from "./game";
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
