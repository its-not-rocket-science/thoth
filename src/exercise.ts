import type { ExerciseMode, MetricDescriptor } from "./types";

/** Which slot a "recommended session" (see recommended.ts) can fill this
 *  exercise into. Not every exercise needs one — an exercise with no
 *  category is simply never picked by the rotation, e.g. multiple-object-
 *  tracking, which doesn't fit any of the three slots the brief specifies. */
export type RecommendedCategory = "ufov" | "orienting-search" | "executive";

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

  /** training / measurement / mixed — see ExerciseMode in types.ts and the
   *  README's "Exercise classification" section for what each means and
   *  why this exercise got the label it did. Shown as a small badge on the
   *  exercise-picker card. */
  readonly mode: ExerciseMode;
  /** Every metric this exercise can report, for the picker card, session-
   *  complete panel and progress tracker to render generically instead of
   *  main.ts special-casing each exercise's own fields. */
  readonly metrics: MetricDescriptor[];
  /** Which entry in `metrics` the progress tracker charts by default —
   *  must be a key present in `metrics`. */
  readonly primaryMetricKey: string;
  /** Which recommended-session slot this exercise can fill (see
   *  recommended.ts); omit for exercises the rotation shouldn't pick. */
  readonly recommendedCategory?: RecommendedCategory;
  /** Rough wall-clock length of one full session, for the recommended-
   *  session time estimate. Not measured — a planning estimate only. */
  readonly expectedSessionMinutes?: number;
  /** One or two sentences shown on this exercise's practice intro screen,
   *  in addition to the exercise's own `instructions`. Optional — plain
   *  instructions are enough for most exercises. */
  readonly practiceNote?: string;
  /** Optional: given the player's real (persisted) state, returns a state
   *  to seed *practice* trials with instead — e.g. forcing a long
   *  presentation duration or a small object count, so practice starts
   *  easy regardless of where the player's real staircase currently sits.
   *  Practice trials are otherwise generated and shown exactly like scored
   *  ones (createTrial/showTrial/etc. all run unchanged); only the state
   *  fed in differs, and the result is never scored or saved (see
   *  main.ts's practice mode). Exercises without a staircase, or whose
   *  default difficulty is already practice-appropriate, can omit this. */
  practiceState?(state: TState): TState;

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
  /** Reduces this session's state to the metrics history.ts should record —
   *  a plain key/value record matching this exercise's own `metrics`
   *  descriptors (see types.ts's SessionHistoryEntry). The host stamps on
   *  exerciseId/timestamp/schemaVersion; this only supplies the values.
   *  Return null for a session that shouldn't be recorded at all (e.g.
   *  still empty/fresh state) rather than recording zeros/nulls. */
  historyEntry(state: TState): Record<string, number | string | null> | null;

  /** Builds this exercise's stimulus placeholders and answer controls
   *  once, into the shared #field content slot and #answer-controls
   *  fieldset. Called every time this exercise becomes the active one;
   *  the host clears both containers first, so mount() can assume a
   *  blank slate and doesn't need a matching teardown. */
  mount(fieldContent: HTMLElement, answerControls: HTMLElement): void;

  createTrial(state: TState): TTrial;
  flashDurationMs(trial: TTrial): number;
  showTrial(trial: TTrial): void;
  /** Called when leaving the "showing" phase, for any reason (the flash's
   *  natural end, or an interruption — pause, tab hidden, reset): stop any
   *  pending internal timers/animation and clear the stimulus. Must be
   *  idempotent and safe to call on an already-interrupted trial. */
  hideTrial(): void;
  /** Optional: called once, right after entering "responding", once
   *  hideTrial() has already cleared the flash. Exercises whose response
   *  is a separate form (the common case) don't need this. Exercises whose
   *  response *is* interacting with the stimulus itself (e.g. clicking
   *  objects that were just tracked) use it to reveal the frozen stimulus
   *  for interaction, from state they retained across hideTrial(). */
  beginResponse?(trial: TTrial): void;

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
