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
  streak: 0,
  presentationMs: 850,
  distractorCount: 2,
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

  const streak = correct ? state.streak + 1 : 0;
  let presentationMs = state.presentationMs;

  if (correct && streak >= 2) {
    presentationMs = Math.max(120, Math.round(presentationMs * 0.9));
  } else if (!correct) {
    presentationMs = Math.min(1500, Math.round(presentationMs * 1.15));
  }

  return {
    score: state.score + (correct ? 1 : 0),
    attempts: state.attempts + 1,
    streak,
    presentationMs,
    distractorCount: state.distractorCount,
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
