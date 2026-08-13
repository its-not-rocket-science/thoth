import type {
  CentralSymbol,
  PeripheralPosition,
  SessionState,
  SessionSummary,
  Trial,
  TrialResponse,
} from "./types";

const POSITIONS: PeripheralPosition[] = [0, 1, 2, 3, 4, 5, 6, 7];
const SYMBOLS: CentralSymbol[] = ["circle", "diamond"];

export const INITIAL_STATE: SessionState = {
  score: 0,
  attempts: 0,
  presentationMs: 850,
  presentationStreak: 0,
  distractorCount: 2,
  distractorStreak: 0,
};

/**
 * A standard 2-down-1-up staircase: two consecutive correct responses step
 * difficulty up one notch (and reset the streak so the *next* step again
 * needs two fresh correct responses); a single incorrect response steps
 * difficulty back down one notch immediately (and also resets the streak).
 * This targets ~70.7% asymptotic accuracy, the classic property of 2-down-1-up
 * (see Levitt 1971, "Transformed Up-Down Methods in Psychoacoustics").
 *
 * "Up"/"down" here means the *difficulty* direction, not the raw number:
 * config.harder/easier map the value in whichever direction that dimension's
 * difficulty actually runs (e.g. shorter presentationMs is harder, but a
 * higher distractorCount is harder), so both dimensions share this one rule.
 */
export interface StaircaseConfig {
  min: number;
  max: number;
  /** Consecutive correct responses required before stepping harder. */
  streakToStep: number;
  harder: (value: number) => number;
  easier: (value: number) => number;
}

export interface StaircaseState {
  value: number;
  streak: number;
}

function clampStep(value: number, config: StaircaseConfig): number {
  return Math.min(config.max, Math.max(config.min, Math.round(value)));
}

export function stepStaircase(state: StaircaseState, correct: boolean, config: StaircaseConfig): StaircaseState {
  if (!correct) {
    return { value: clampStep(config.easier(state.value), config), streak: 0 };
  }

  const streak = state.streak + 1;
  if (streak >= config.streakToStep) {
    return { value: clampStep(config.harder(state.value), config), streak: 0 };
  }
  return { value: state.value, streak };
}

export const PRESENTATION_STAIRCASE: StaircaseConfig = {
  min: 120,
  max: 1500,
  streakToStep: 2,
  harder: value => value * 0.9,
  easier: value => value * 1.15,
};

export const DISTRACTOR_STAIRCASE: StaircaseConfig = {
  min: 0,
  max: 5,
  streakToStep: 2,
  harder: value => value + 1,
  easier: value => value - 1,
};

function randomItem<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) throw new Error("Cannot select from an empty collection.");
  return item;
}

function shuffled<T>(items: readonly T[]): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

/** Picks up to `count` peripheral positions other than `target`, with no
 *  duplicates and no overlap with the target itself. */
export function generateDistractors(target: PeripheralPosition, count: number): PeripheralPosition[] {
  const pool = POSITIONS.filter(position => position !== target);
  const size = Math.max(0, Math.min(count, pool.length));
  return shuffled(pool).slice(0, size);
}

export function createTrial(presentationMs: number, distractorCount = 0): Trial {
  const peripheralPosition = randomItem(POSITIONS);
  return {
    centralSymbol: randomItem(SYMBOLS),
    peripheralPosition,
    presentationMs,
    distractorPositions: generateDistractors(peripheralPosition, distractorCount),
  };
}

export function scoreTrial(
  state: SessionState,
  trial: Trial,
  response: TrialResponse,
): SessionState {
  const correct =
    trial.centralSymbol === response.centralSymbol &&
    trial.peripheralPosition === response.peripheralPosition;

  const presentation = stepStaircase(
    { value: state.presentationMs, streak: state.presentationStreak },
    correct,
    PRESENTATION_STAIRCASE,
  );
  const distractors = stepStaircase(
    { value: state.distractorCount, streak: state.distractorStreak },
    correct,
    DISTRACTOR_STAIRCASE,
  );

  return {
    score: state.score + (correct ? 1 : 0),
    attempts: state.attempts + 1,
    presentationMs: presentation.value,
    presentationStreak: presentation.streak,
    distractorCount: distractors.value,
    distractorStreak: distractors.streak,
  };
}

/** lowestPresentationMs is tracked by the caller across a session, since
 *  SessionState only carries the current interval and the staircase can
 *  move it back up after a miss. */
export function summarizeSession(state: SessionState, lowestPresentationMs: number): SessionSummary {
  return {
    score: state.score,
    attempts: state.attempts,
    accuracyPct: state.attempts === 0 ? 0 : Math.round((state.score / state.attempts) * 100),
    correct: state.score,
    incorrect: state.attempts - state.score,
    lowestPresentationMs,
  };
}
