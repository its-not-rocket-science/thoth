import type {
  CentralSymbol,
  PeripheralPosition,
  SessionState,
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
};

function randomItem<T>(items: readonly T[]): T {
  const item = items[Math.floor(Math.random() * items.length)];
  if (item === undefined) throw new Error("Cannot select from an empty collection.");
  return item;
}

export function createTrial(presentationMs: number): Trial {
  return {
    centralSymbol: randomItem(SYMBOLS),
    peripheralPosition: randomItem(POSITIONS),
    presentationMs,
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
  };
}
