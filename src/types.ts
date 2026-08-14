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

export interface SessionHistoryEntry {
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
