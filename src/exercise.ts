import type { SessionHistoryEntry } from "./types";

/** One label/value pair in the live readouts bar or session-complete
 *  summary panel. `value` is inserted as trusted inline HTML (matching the
 *  rest of the codebase's approach to its own generated markup), so an
 *  exercise can include e.g. a `<span class="unit">ms</span>` the way the
 *  original Centre-and-edge readouts did. */
export interface ReadoutCell {
  label: string;
  value: string;
}

/**
 * Everything main.ts needs from an exercise to drive the shared phase
 * state machine (ready → preparing → showing → responding → paused/
 * complete) and render into the shared shell — masthead, notice, readouts
 * bar, progress bar, action bar, and session-complete summary all stay
 * host-owned; only the stimulus inside #field and the answer controls
 * inside #answer-controls are exercise-owned, built once by mount() and
 * then driven via showTrial/hideTrial/readAnswer.
 *
 * TState is the exercise's own persisted per-session shape (JSON-
 * serialisable), opaque to the host beyond loadState's validation.
 * TTrial is likewise opaque — the host only ever hands it back to the
 * same exercise that created it.
 */
export interface Exercise<TState = unknown, TTrial = unknown> {
  readonly id: string;
  readonly number: number;
  readonly name: string;
  readonly instructions: string;
  /** Trials per session, for the progress bar. */
  readonly sessionLength: number;

  readonly initialState: TState;
  /** Validates a JSON.parse() result from storage; null if unusable, in
   *  which case the host falls back to initialState rather than crash. */
  loadState(raw: unknown): TState | null;

  readouts(state: TState): ReadoutCell[];
  summaryCells(state: TState): ReadoutCell[];
  /** Trials completed so far this session, for the progress bar. */
  attempts(state: TState): number;
  isSessionComplete(state: TState): boolean;
  /** One-line "your last/best result" string for the exercise-picker
   *  card; a sensible default like "Not played yet" when state is fresh. */
  pickerSummary(state: TState): string;
  /** Reduces this session's state to the fields history.ts needs; return
   *  null for exercises that don't fit the score/accuracy/interval shape
   *  (a documented exception, same as the app's other RT-based exercises). */
  historyEntry(state: TState): Omit<SessionHistoryEntry, "timestamp"> | null;

  /** Builds this exercise's stimulus placeholders and answer controls
   *  once, into the shared #field content slot and #answer-controls
   *  fieldset. Called every time this exercise becomes the active one;
   *  the host clears both containers first, so mount() can assume a
   *  blank slate and doesn't need a matching teardown. */
  mount(fieldContent: HTMLElement, answerControls: HTMLElement): void;

  createTrial(state: TState): TTrial;
  flashDurationMs(trial: TTrial): number;
  showTrial(trial: TTrial): void;
  hideTrial(): void;

  /** Reads the submitted form; null if the answer is incomplete. */
  readAnswer(response: HTMLFormElement): unknown | null;
  isCorrect(trial: TTrial, answer: unknown): boolean;
  feedback(trial: TTrial, correct: boolean): string;
  /** Presentation-only reaction to a miss (e.g. highlighting the correct
   *  dial position); no-op default is fine for exercises without one. */
  onMiss(trial: TTrial): void;
  clearMissMarks(): void;

  score(state: TState, trial: TTrial, answer: unknown): TState;
}

export function progressStorageKey(exerciseId: string): string {
  return `thoth-progress-${exerciseId}-v1`;
}

/** Pre-multi-exercise storage key, kept only for the one-time migration
 *  into progressStorageKey("centre-edge"). */
export const LEGACY_PROGRESS_STORAGE_KEY = "thoth-progress-v1";

/**
 * Copies an existing player's pre-multi-exercise save (a single
 * unnamespaced localStorage entry) into the namespaced key for
 * "centre-edge" — the exercise that entry always represented, since
 * Thoth had only one exercise before this refactor — and removes the old
 * key. A no-op if there's nothing to migrate or the namespaced key is
 * already present (never overwrites newer data). Safe to call on every
 * startup.
 */
export function migrateLegacyStorage(
  storage: Pick<Storage, "getItem" | "setItem" | "removeItem">,
  legacyKey: string,
  namespacedKey: string,
): void {
  const legacy = storage.getItem(legacyKey);
  if (legacy === null) return;
  if (storage.getItem(namespacedKey) === null) {
    storage.setItem(namespacedKey, legacy);
  }
  storage.removeItem(legacyKey);
}
