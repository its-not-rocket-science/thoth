// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { createCentreEdgeDistractorsExercise, createCentreEdgeExercise, createCentreOnlyExercise } from "./ufov";

describe("centre-only", () => {
  const exercise = createCentreOnlyExercise();

  it("never generates distractors, since it forces distractorCount to 0", () => {
    for (let i = 0; i < 20; i++) {
      const trial = exercise.createTrial(exercise.initialState);
      expect(trial.distractorPositions).toEqual([]);
    }
  });

  it("never sets a peripheral answer requirement: a matching shape is correct regardless of position", () => {
    const trial = exercise.createTrial(exercise.initialState);
    const wrongPositionButRightShape = { centralSymbol: trial.centralSymbol };
    expect(exercise.isCorrect(trial, wrongPositionButRightShape)).toBe(true);
  });

  it("scores an incorrect shape as wrong", () => {
    const trial = exercise.createTrial(exercise.initialState);
    const wrongShape = { centralSymbol: trial.centralSymbol === "circle" ? "diamond" : "circle" };
    expect(exercise.isCorrect(trial, wrongShape)).toBe(false);
  });

  it("readAnswer doesn't require a position field", () => {
    document.body.innerHTML = `<form><input type="radio" name="central" value="circle" checked></form>`;
    const form = document.querySelector("form") as HTMLFormElement;
    expect(exercise.readAnswer(form)).toEqual({ centralSymbol: "circle" });
  });
});

describe("centre-edge", () => {
  const exercise = createCentreEdgeExercise();

  it("never generates distractors, since it forces distractorCount to 0", () => {
    for (let i = 0; i < 20; i++) {
      const trial = exercise.createTrial(exercise.initialState);
      expect(trial.distractorPositions).toEqual([]);
    }
  });

  it("requires the peripheral position to match, unlike centre-only", () => {
    const trial = exercise.createTrial(exercise.initialState);
    const wrongPosition = {
      centralSymbol: trial.centralSymbol,
      peripheralPosition: ((trial.peripheralPosition + 1) % 8) as typeof trial.peripheralPosition,
    };
    expect(exercise.isCorrect(trial, wrongPosition)).toBe(false);
  });

  it("scores a fully matching answer as correct", () => {
    const trial = exercise.createTrial(exercise.initialState);
    const answer = { centralSymbol: trial.centralSymbol, peripheralPosition: trial.peripheralPosition };
    expect(exercise.isCorrect(trial, answer)).toBe(true);
  });
});

describe("centre-edge-distractors", () => {
  const exercise = createCentreEdgeDistractorsExercise();

  it("generates distractors when the session's distractorCount is above zero", () => {
    // initialState.distractorCount is 2 (game.ts's INITIAL_STATE default).
    const trials = Array.from({ length: 20 }, () => exercise.createTrial(exercise.initialState));
    expect(trials.some(trial => trial.distractorPositions.length > 0)).toBe(true);
  });

  it("still requires the peripheral position to match", () => {
    const trial = exercise.createTrial(exercise.initialState);
    const wrongPosition = {
      centralSymbol: trial.centralSymbol,
      peripheralPosition: ((trial.peripheralPosition + 1) % 8) as typeof trial.peripheralPosition,
    };
    expect(exercise.isCorrect(trial, wrongPosition)).toBe(false);
  });
});
