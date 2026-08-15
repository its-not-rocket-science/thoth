import type { LegacySessionHistoryEntry, SessionHistoryEntry } from "./types";

/** Pre-multi-exercise storage key, kept only so main.ts can migrate an
 *  existing player's history into the namespaced key for "centre-edge". */
export const LEGACY_HISTORY_STORAGE_KEY = "thoth-history-v1";

export function historyStorageKey(exerciseId: string): string {
  return `thoth-history-${exerciseId}-v1`;
}

/** Past this many entries, older sessions are dropped rather than kept
 *  growing localStorage without bound. */
const MAX_ENTRIES = 20;

/** The subset of the Storage interface these helpers need, so tests can pass
 *  a small in-memory fake instead of requiring a DOM/localStorage. */
export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

function isLegacyEntry(candidate: unknown): candidate is LegacySessionHistoryEntry {
  if (!candidate || typeof candidate !== "object") return false;
  const value = candidate as Partial<LegacySessionHistoryEntry>;
  return [value.timestamp, value.score, value.accuracyPct, value.lowestPresentationMs].every(
    item => typeof item === "number" && Number.isFinite(item),
  );
}

function isCurrentEntry(candidate: unknown): candidate is SessionHistoryEntry {
  if (!candidate || typeof candidate !== "object") return false;
  const value = candidate as Partial<SessionHistoryEntry>;
  return (
    typeof value.timestamp === "number" &&
    Number.isFinite(value.timestamp) &&
    typeof value.exerciseId === "string" &&
    typeof value.schemaVersion === "number" &&
    !!value.metrics &&
    typeof value.metrics === "object"
  );
}

/** Converts a pre-generalised-schema entry (score/accuracyPct/
 *  lowestPresentationMs, keyed only by which per-exercise storage key it
 *  lived under) into the current metrics-record shape, so an existing
 *  player's UFOV history survives the schema change rather than being
 *  discarded. `exerciseId` comes from the caller, since the legacy shape
 *  never stored it — it was implicit in which namespaced key held it. */
function migrateLegacyEntry(entry: LegacySessionHistoryEntry, exerciseId: string): SessionHistoryEntry {
  return {
    exerciseId,
    timestamp: entry.timestamp,
    schemaVersion: 1,
    metrics: {
      score: entry.score,
      accuracyPct: entry.accuracyPct,
      lowestPresentationMs: entry.lowestPresentationMs,
    },
  };
}

/** Reads and validates the saved history for one exercise, migrating any
 *  pre-generalised-schema entries found and discarding anything else
 *  malformed (mirrors validState's approach in main.ts: reject bad data
 *  rather than let it crash the app, and clear storage only when it's
 *  unparsable). */
export function loadHistory(storage: StorageLike, key: string, exerciseId: string): SessionHistoryEntry[] {
  const raw = storage.getItem(key);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.flatMap((candidate): SessionHistoryEntry[] => {
      if (isCurrentEntry(candidate)) return [candidate];
      if (isLegacyEntry(candidate)) return [migrateLegacyEntry(candidate, exerciseId)];
      return [];
    });
  } catch {
    storage.removeItem(key);
    return [];
  }
}

export function saveHistory(entries: SessionHistoryEntry[], storage: StorageLike, key: string): void {
  storage.setItem(key, JSON.stringify(entries));
}

/** Pure: prepends `entry` (newest first) and caps the result at
 *  MAX_ENTRIES, dropping the oldest entries first. */
export function appendHistory(
  history: SessionHistoryEntry[],
  entry: SessionHistoryEntry,
): SessionHistoryEntry[] {
  return [entry, ...history].slice(0, MAX_ENTRIES);
}

/** Convenience wrapper for the common case: load, append, save, return the
 *  updated (newest-first) history in one call. */
export function recordSession(
  entry: SessionHistoryEntry,
  storage: StorageLike,
  key: string,
): SessionHistoryEntry[] {
  const updated = appendHistory(loadHistory(storage, key, entry.exerciseId), entry);
  saveHistory(updated, storage, key);
  return updated;
}
