// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import type { Exercise } from "../exercise";
import { createMotExercise } from "./mot";
import { createSpatialCueingExercise } from "./spatial-cueing";
import { createSustainedAttentionExercise } from "./sustained-attention";
import { createTaskSwitchingExercise } from "./task-switching";
import { createCentreEdgeDistractorsExercise, createCentreEdgeExercise, createCentreOnlyExercise } from "./ufov";
import { createVisualSearchExercise } from "./visual-search";

const exercises: Exercise[] = [
  createCentreOnlyExercise(),
  createCentreEdgeExercise(),
  createCentreEdgeDistractorsExercise(),
  createMotExercise(),
  createSpatialCueingExercise(),
  createVisualSearchExercise(),
  createTaskSwitchingExercise(),
  createSustainedAttentionExercise(),
];

const VALID_MODES = ["training", "measurement", "mixed"];
const VALID_DIRECTIONS = ["higher", "lower", "neutral"];
const VALID_CATEGORIES = ["ufov", "orienting-search", "executive"];

describe.each(exercises.map(exercise => [exercise.id, exercise] as const))("%s metadata", (_id, exercise) => {
  it("declares a recognised mode", () => {
    expect(VALID_MODES).toContain(exercise.mode);
  });

  it("declares at least one metric, each with a recognised direction", () => {
    expect(exercise.metrics.length).toBeGreaterThan(0);
    exercise.metrics.forEach(metric => {
      expect(VALID_DIRECTIONS).toContain(metric.direction);
      expect(metric.key.length).toBeGreaterThan(0);
    });
  });

  it("declares a primaryMetricKey that is one of its own metrics", () => {
    expect(exercise.metrics.map(m => m.key)).toContain(exercise.primaryMetricKey);
  });

  it("declares a recognised recommendedCategory, or none at all", () => {
    if (exercise.recommendedCategory !== undefined) {
      expect(VALID_CATEGORIES).toContain(exercise.recommendedCategory);
    }
  });

  it("declares a positive expectedSessionMinutes, or none at all", () => {
    if (exercise.expectedSessionMinutes !== undefined) {
      expect(exercise.expectedSessionMinutes).toBeGreaterThan(0);
    }
  });

  it("records no history for a completely fresh (never-played) session", () => {
    expect(exercise.historyEntry(exercise.initialState)).toBeNull();
  });

  it("practiceState, when provided, returns the same shape of state unchanged in its keys", () => {
    if (!exercise.practiceState) return;
    const eased = exercise.practiceState(exercise.initialState);
    expect(Object.keys(eased as object).sort()).toEqual(Object.keys(exercise.initialState as object).sort());
  });
});
