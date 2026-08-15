/**
 * Observed stimulus-timing diagnostics (roadmap item: "observed-duration
 * recording"). For every timed presentation the host shows, this records
 * not just the *requested* duration (what the exercise asked for) but the
 * *observed* one (performance.now() around the actual show/hide calls),
 * so a browser hiccup, a paused tab or a genuinely slow device shows up in
 * the data instead of being silently reported as if the requested timing
 * always held. See main.ts's presentTrial/finalizeTiming for where this
 * gets populated, and the README's "Timing diagnostics" section for the
 * caveats (this is browser-timer precision, not lab-grade frame timing).
 */
export interface TimingRecord {
  exerciseId: string;
  timestamp: number;
  /** What the exercise's flashDurationMs() asked for. */
  requestedMs: number;
  /** performance.now() delta between the host calling showTrial() and
   *  hideTrial() for this presentation; null if hideTrial() was never
   *  reached (shouldn't normally happen, but a record isn't dropped just
   *  because it couldn't be measured). */
  observedMs: number | null;
  /** False if anything (a paused/hidden tab, a manual pause, a replay)
   *  interrupted this presentation before its natural end — such records
   *  are kept for visibility but must not be treated as valid timing
   *  data. */
  valid: boolean;
  invalidReason: string | null;
}

export const TIMING_STORAGE_KEY = "thoth-timing-diagnostics-v1";
const MAX_TIMING_RECORDS = 200;

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function isTimingRecord(candidate: unknown): candidate is TimingRecord {
  if (!candidate || typeof candidate !== "object") return false;
  const v = candidate as Partial<TimingRecord>;
  return (
    typeof v.exerciseId === "string" &&
    typeof v.timestamp === "number" &&
    typeof v.requestedMs === "number" &&
    typeof v.valid === "boolean"
  );
}

export function loadTimingRecords(storage: StorageLike, key: string = TIMING_STORAGE_KEY): TimingRecord[] {
  const raw = storage.getItem(key);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isTimingRecord) : [];
  } catch {
    return [];
  }
}

/** Pure: prepends `record` and caps the result, same MAX_ENTRIES-style
 *  policy as history.ts's appendHistory, so diagnostics can't grow
 *  localStorage without bound either. */
export function appendTimingRecord(
  records: TimingRecord[],
  record: TimingRecord,
  max: number = MAX_TIMING_RECORDS,
): TimingRecord[] {
  return [record, ...records].slice(0, max);
}

export function saveTimingRecords(records: TimingRecord[], storage: StorageLike, key: string = TIMING_STORAGE_KEY): void {
  storage.setItem(key, JSON.stringify(records));
}
