export type CentralSymbol = "circle" | "diamond";
export type PeripheralPosition = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 7;

export interface Trial {
  centralSymbol: CentralSymbol;
  peripheralPosition: PeripheralPosition;
  presentationMs: number;
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
}
