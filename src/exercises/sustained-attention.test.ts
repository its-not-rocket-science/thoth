import { describe, expect, it } from "vitest";
import { isNoGoEvent, meanGoRt, summarizeStream, type CptState } from "./sustained-attention";

const EMPTY_STATE: CptState = {
  attempts: 0,
  commissionErrors: 0,
  omissionErrors: 0,
  goHitCount: 0,
  goRtSum: 0,
  isi: 1200,
  isiStreak: 0,
  bestIsi: null,
};

describe("isNoGoEvent", () => {
  it("lands on no-go at roughly the configured rate over many draws", () => {
    let noGoCount = 0;
    const trials = 20_000;
    for (let i = 0; i < trials; i++) {
      if (isNoGoEvent(Math.random, 0.15)) noGoCount++;
    }
    const rate = noGoCount / trials;
    expect(rate).toBeGreaterThan(0.13);
    expect(rate).toBeLessThan(0.17);
  });

  it("is driven deterministically by an injected rng", () => {
    expect(isNoGoEvent(() => 0.1, 0.15)).toBe(true);
    expect(isNoGoEvent(() => 0.2, 0.15)).toBe(false);
  });
});

describe("summarizeStream", () => {
  it("folds a stream's outcome into running totals", () => {
    const next = summarizeStream(EMPTY_STATE, {
      commissionErrors: 1,
      omissionErrors: 2,
      goHitCount: 17,
      goRtSum: 5100,
      finalIsi: 900,
      finalIsiStreak: 1,
    });
    expect(next).toEqual({
      attempts: 1,
      commissionErrors: 1,
      omissionErrors: 2,
      goHitCount: 17,
      goRtSum: 5100,
      isi: 900,
      isiStreak: 1,
      bestIsi: 900,
    });
  });

  it("accumulates errors and RT sums across multiple streams", () => {
    const first = summarizeStream(EMPTY_STATE, {
      commissionErrors: 1,
      omissionErrors: 0,
      goHitCount: 10,
      goRtSum: 3000,
      finalIsi: 1000,
      finalIsiStreak: 0,
    });
    const second = summarizeStream(first, {
      commissionErrors: 0,
      omissionErrors: 1,
      goHitCount: 12,
      goRtSum: 3600,
      finalIsi: 850,
      finalIsiStreak: 1,
    });
    expect(second.attempts).toBe(2);
    expect(second.commissionErrors).toBe(1);
    expect(second.omissionErrors).toBe(1);
    expect(second.goHitCount).toBe(22);
    expect(second.goRtSum).toBe(6600);
    expect(second.isi).toBe(850);
  });

  it("only replaces bestIsi with a faster (lower) one", () => {
    const first = summarizeStream(EMPTY_STATE, {
      commissionErrors: 0,
      omissionErrors: 0,
      goHitCount: 10,
      goRtSum: 3000,
      finalIsi: 800,
      finalIsiStreak: 0,
    });
    const slower = summarizeStream(first, {
      commissionErrors: 0,
      omissionErrors: 0,
      goHitCount: 10,
      goRtSum: 3000,
      finalIsi: 950,
      finalIsiStreak: 0,
    });
    expect(slower.bestIsi).toBe(800);

    const faster = summarizeStream(first, {
      commissionErrors: 0,
      omissionErrors: 0,
      goHitCount: 10,
      goRtSum: 3000,
      finalIsi: 650,
      finalIsiStreak: 0,
    });
    expect(faster.bestIsi).toBe(650);
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
