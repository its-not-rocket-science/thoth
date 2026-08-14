import { describe, expect, it } from "vitest";
import { createCueingTrial, meanInvalidRt, meanValidRt, recordRt, validityEffect, type CueingState } from "./spatial-cueing";

const EMPTY_STATE: CueingState = {
  attempts: 0,
  validCount: 0,
  validRtSum: 0,
  invalidCount: 0,
  invalidRtSum: 0,
  timeouts: 0,
};

describe("createCueingTrial", () => {
  it("marks valid trials with the target at the cued position", () => {
    for (let i = 0; i < 50; i++) {
      const trial = createCueingTrial();
      if (trial.valid) expect(trial.targetPosition).toBe(trial.cuedPosition);
    }
  });

  it("marks invalid trials with the target away from the cued position", () => {
    for (let i = 0; i < 50; i++) {
      const trial = createCueingTrial();
      if (!trial.valid) expect(trial.targetPosition).not.toBe(trial.cuedPosition);
    }
  });

  it("produces roughly an 80/20 valid/invalid split over many trials", () => {
    const n = 3000;
    let validCount = 0;
    for (let i = 0; i < n; i++) {
      if (createCueingTrial().valid) validCount++;
    }
    const rate = validCount / n;
    expect(rate).toBeGreaterThan(0.75);
    expect(rate).toBeLessThan(0.85);
  });

  it("is deterministic given a fixed rng, for exact reproducibility", () => {
    const rng = () => 0;
    const trial = createCueingTrial(rng);
    // rng()=0 always: cuedPosition = POSITIONS[0] = 0, valid = 0 < 0.8 = true.
    expect(trial.cuedPosition).toBe(0);
    expect(trial.valid).toBe(true);
    expect(trial.targetPosition).toBe(0);
  });
});

describe("recordRt / meanValidRt / meanInvalidRt / validityEffect", () => {
  it("accumulates valid-trial RTs into a correct running mean", () => {
    let state = EMPTY_STATE;
    for (const rt of [200, 300, 400]) state = recordRt(state, true, rt);
    expect(meanValidRt(state)).toBe(300);
    expect(state.attempts).toBe(3);
  });

  it("accumulates invalid-trial RTs separately", () => {
    let state = EMPTY_STATE;
    state = recordRt(state, true, 200);
    state = recordRt(state, false, 500);
    state = recordRt(state, false, 600);
    expect(meanValidRt(state)).toBe(200);
    expect(meanInvalidRt(state)).toBe(550);
    expect(state.attempts).toBe(3);
  });

  it("computes the validity effect as invalid mean minus valid mean", () => {
    let state = EMPTY_STATE;
    state = recordRt(state, true, 200);
    state = recordRt(state, true, 300);
    state = recordRt(state, false, 500);
    state = recordRt(state, false, 600);
    // valid mean = 250, invalid mean = 550, effect = 300.
    expect(validityEffect(state)).toBe(300);
  });

  it("returns null for means/effect until each condition has a sample", () => {
    expect(meanValidRt(EMPTY_STATE)).toBeNull();
    expect(meanInvalidRt(EMPTY_STATE)).toBeNull();
    expect(validityEffect(EMPTY_STATE)).toBeNull();

    const onlyValid = recordRt(EMPTY_STATE, true, 250);
    expect(meanValidRt(onlyValid)).toBe(250);
    expect(validityEffect(onlyValid)).toBeNull();
  });

  it("records a timeout (null rt) as an attempt without affecting either mean", () => {
    let state = recordRt(EMPTY_STATE, true, 200);
    state = recordRt(state, false, 500);
    const beforeValid = meanValidRt(state);
    const beforeInvalid = meanInvalidRt(state);

    state = recordRt(state, true, null);

    expect(state.timeouts).toBe(1);
    expect(state.attempts).toBe(3);
    expect(meanValidRt(state)).toBe(beforeValid);
    expect(meanInvalidRt(state)).toBe(beforeInvalid);
  });
});
