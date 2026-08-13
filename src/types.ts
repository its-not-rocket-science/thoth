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
