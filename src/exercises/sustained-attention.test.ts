import { describe, expect, it } from "vitest";
import { buildEventDeck, meanGoRt, summarizeStream, type CptState } from "./sustained-attention";

const EMPTY_STATE: CptState = {
  attempts: 0,
  commissionErrors: 0,
  omissionErrors: 0,
  goHitCount: 0,
  goRtSum: 0,
};

describe("buildEventDeck", () => {
  it("contains exactly noGoCount no-go events, whatever the rng", () => {
    for (const seed of [0, 0.25, 0.5, 0.75, 0.999]) {
      const deck = buildEventDeck(60, 9, () => seed);
      expect(deck.filter(Boolean)).toHaveLength(9);
      expect(deck).toHaveLength(60);
    }
  });

  it("is driven deterministically by an injected rng", () => {
    const a = buildEventDeck(20, 3, () => 0.5);
    const b = buildEventDeck(20, 3, () => 0.5);
    expect(a).toEqual(b);
  });

  it("varies event order across different rng streams", () => {
    let call = 0;
    const seq = [0.9, 0.1, 0.9, 0.1, 0.9, 0.1, 0.9, 0.1];
    const rngA = () => seq[call++ % seq.length] as number;
    call = 0;
    const rngB = () => Math.random();
    const a = buildEventDeck(20, 5, rngA);
    const b = buildEventDeck(20, 5, rngB);
    // Not a strict guarantee, but with 20 items and two very different rng
    // sources, an identical order would be a coincidence worth failing on.
    expect(a).not.toEqual(b);
  });

  it("clamps noGoCount to the deck size rather than overflowing", () => {
    const deck = buildEventDeck(5, 99);
    expect(deck).toHaveLength(5);
    expect(deck.every(Boolean)).toBe(true);
  });

  it("clamps a negative noGoCount to zero", () => {
    const deck = buildEventDeck(5, -3);
    expect(deck.some(Boolean)).toBe(false);
  });
});

describe("summarizeStream", () => {
  it("folds a stream's outcome into running totals", () => {
    const next = summarizeStream(EMPTY_STATE, {
      commissionErrors: 1,
      omissionErrors: 2,
      goHitCount: 17,
      goRtSum: 5100,
    });
    expect(next).toEqual({
      attempts: 1,
      commissionErrors: 1,
      omissionErrors: 2,
      goHitCount: 17,
      goRtSum: 5100,
    });
  });

  it("accumulates errors and RT sums across multiple streams", () => {
    const first = summarizeStream(EMPTY_STATE, {
      commissionErrors: 1,
      omissionErrors: 0,
      goHitCount: 10,
      goRtSum: 3000,
    });
    const second = summarizeStream(first, {
      commissionErrors: 0,
      omissionErrors: 1,
      goHitCount: 12,
      goRtSum: 3600,
    });
    expect(second.attempts).toBe(2);
    expect(second.commissionErrors).toBe(1);
    expect(second.omissionErrors).toBe(1);
    expect(second.goHitCount).toBe(22);
    expect(second.goRtSum).toBe(6600);
  });
});

describe("meanGoRt", () => {
  it("is null when there are no go hits yet", () => {
    expect(meanGoRt(EMPTY_STATE)).toBeNull();
  });

  it("averages the accumulated RT sum over go hit count", () => {
    const state: CptState = { ...EMPTY_STATE, goHitCount: 4, goRtSum: 1200 };
    expect(meanGoRt(state)).toBe(300);
  });
});
