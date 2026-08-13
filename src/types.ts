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
  streak: number;
  presentationMs: number;
  /** Not yet adjusted by the staircase; a fixed value for now. */
  distractorCount: number;
}

export interface SessionSummary {
  score: number;
  attempts: number;
  accuracyPct: number;
  correct: number;
  incorrect: number;
  lowestPresentationMs: number;
}
