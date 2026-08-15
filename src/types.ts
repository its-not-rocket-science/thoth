export type CentralSymbol = "circle" | "diamond";
export type PeripheralPosition = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Trial {
  centralSymbol: CentralSymbol;
  peripheralPosition: PeripheralPosition;
  presentationMs: number;
  /** Peripheral positions other than peripheralPosition that also show a
   *  glyph, to compete for attention. Never contains peripheralPosition. */
  distractorPositions: PeripheralPosition[];
}

export interface TrialResponse {
  centralSymbol: CentralSymbol;
  peripheralPosition: PeripheralPosition;
}

export interface SessionState {
  score: number;
  attempts: number;
  presentationMs: number;
  /** Consecutive correct responses since presentationMs last stepped. */
  presentationStreak: number;
  distractorCount: number;
  /** Consecutive correct responses since distractorCount last stepped. */
  distractorStreak: number;
}

export interface SessionSummary {
  score: number;
  attempts: number;
  accuracyPct: number;
  correct: number;
  incorrect: number;
  lowestPresentationMs: number;
}

/** Whether an exercise is intended to be interpreted as a training task
 *  (adaptive, session-to-session performance is a training curve, not a
 *  score you'd compare like a fixed test), a measurement task (fixed
 *  protocol, no adaptive staircase during scoring, session-to-session
 *  numbers are directly comparable in the way an experimental measure
 *  would be), or both. See README's "Exercise classification" section for
 *  the rationale behind each exercise's assignment. */
export type ExerciseMode = "training" | "measurement" | "mixed";

/** Which direction of change in a metric represents improvement — "lower"
 *  for e.g. reaction time or error counts, "higher" for e.g. accuracy or
 *  objects tracked, "neutral" for metrics with no simple better/worse
 *  reading (e.g. a raw event count kept only for context). */
export type MetricDirection = "higher" | "lower" | "neutral";

/** Describes one metric an exercise can record, independent of any given
 *  session's value for it — the exercise's own historyEntry() supplies the
 *  values; this is the metadata a generic host (picker card, session-
 *  complete panel, progress tracker) needs to label and interpret them
 *  without hard-coding per-exercise knowledge. */
export interface MetricDescriptor {
  /** Key into the Record<string, ...> historyEntry()/metrics returns. */
  key: string;
  label: string;
  unit?: string;
  direction: MetricDirection;
  /** Shown in the exercise-picker card's one-line summary. */
  showInPicker?: boolean;
  /** Shown in the session-complete summary panel. */
  showInSummary?: boolean;
}

/** A single exercise/session's recorded outcome. `metrics` is exercise-
 *  defined (see Exercise.metrics/historyEntry in exercise.ts) rather than
 *  a fixed score/accuracy/interval shape, so every exercise — including
 *  the reaction-time and slope-based ones that previously opted out
 *  entirely — can keep session history. */
export interface SessionHistoryEntry {
  exerciseId: string;
  timestamp: number;
  metrics: Record<string, number | string | null>;
  schemaVersion: number;
}

/** Pre-generalised-schema history entry shape (score/accuracyPct/
 *  lowestPresentationMs, no exerciseId/metrics/schemaVersion) — kept only
 *  so history.ts can recognise and migrate it. */
export interface LegacySessionHistoryEntry {
  timestamp: number;
  score: number;
  accuracyPct: number;
  lowestPresentationMs: number;
}

/** A single tracked object's kinematic state for the multiple-object-
 *  tracking exercise: position and velocity in field-relative pixels. */
export interface MotionState {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

/** The rectangle motion is confined to, plus the tracked object's own
 *  radius so bounce reflection accounts for its size rather than treating
 *  it as a point. */
export interface MotionBounds {
  width: number;
  height: number;
  radius: number;
}

export interface MotTrial {
  objectCount: number;
  /** Indices into `objects` that are the targets to remember; always
   *  sorted ascending. */
  targetIndices: number[];
  objects: MotionState[];
}
