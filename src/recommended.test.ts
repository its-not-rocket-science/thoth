import { describe, expect, it } from "vitest";
import { chooseRecommendedSession, replacePick } from "./recommended";

const CANDIDATES = {
  ufov: ["centre-only", "centre-edge", "centre-edge-distractors"],
  "orienting-search": ["spatial-cueing", "visual-search"],
  executive: ["task-switching", "sustained-attention"],
} as const;

describe("chooseRecommendedSession", () => {
  it("picks exactly one exercise per non-empty category, in ufov/orienting-search/executive order", () => {
    const picks = chooseRecommendedSession(CANDIDATES, []);
    expect(picks.map(p => p.category)).toEqual(["ufov", "orienting-search", "executive"]);
  });

  it("skips a category with no candidates rather than erroring", () => {
    const picks = chooseRecommendedSession({ ufov: CANDIDATES.ufov }, []);
    expect(picks).toHaveLength(1);
    expect(picks[0]?.category).toBe("ufov");
  });

  it("avoids repeating the previous session's exact pick when an alternative exists", () => {
    for (let i = 0; i < 30; i++) {
      const picks = chooseRecommendedSession(CANDIDATES, ["centre-edge", "spatial-cueing", "task-switching"]);
      const ufov = picks.find(p => p.category === "ufov");
      const orienting = picks.find(p => p.category === "orienting-search");
      const executive = picks.find(p => p.category === "executive");
      expect(ufov?.exerciseId).not.toBe("centre-edge");
      expect(orienting?.exerciseId).not.toBe("spatial-cueing");
      expect(executive?.exerciseId).not.toBe("task-switching");
    }
  });

  it("reuses the sole candidate in a single-option category even if it was just picked", () => {
    const picks = chooseRecommendedSession({ executive: ["task-switching"] }, ["task-switching"]);
    expect(picks).toEqual([{ category: "executive", exerciseId: "task-switching" }]);
  });

  it("is driven deterministically by an injected rng", () => {
    const a = chooseRecommendedSession(CANDIDATES, [], () => 0);
    const b = chooseRecommendedSession(CANDIDATES, [], () => 0);
    expect(a).toEqual(b);
  });
});

describe("replacePick", () => {
  it("cycles to the next candidate in that slot's category", () => {
    const picks = [{ category: "orienting-search" as const, exerciseId: "spatial-cueing" }];
    const next = replacePick(picks, 0, CANDIDATES);
    expect(next[0]?.exerciseId).toBe("visual-search");
  });

  it("wraps back to the first candidate after the last", () => {
    const picks = [{ category: "orienting-search" as const, exerciseId: "visual-search" }];
    const next = replacePick(picks, 0, CANDIDATES);
    expect(next[0]?.exerciseId).toBe("spatial-cueing");
  });

  it("leaves a single-candidate category's slot unchanged", () => {
    const picks = [{ category: "ufov" as const, exerciseId: "centre-only" }];
    const next = replacePick(picks, 0, { ufov: ["centre-only"] });
    expect(next[0]?.exerciseId).toBe("centre-only");
  });

  it("doesn't touch other slots", () => {
    const picks = [
      { category: "ufov" as const, exerciseId: "centre-only" },
      { category: "orienting-search" as const, exerciseId: "spatial-cueing" },
    ];
    const next = replacePick(picks, 1, CANDIDATES);
    expect(next[0]).toEqual(picks[0]);
  });
});
