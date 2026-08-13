import type { SessionHistoryEntry } from "./types";

export const HISTORY_STORAGE_KEY = "thoth-history-v1";

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

function validEntry(candidate: unknown): candidate is SessionHistoryEntry {
  if (!candidate || typeof candidate !== "object") return false;
  const value = candidate as Partial<SessionHistoryEntry>;
  return [value.timestamp, value.score, value.accuracyPct, value.lowestPresentationMs]
    .every(item => typeof item === "number" && Number.isFinite(item));
}

/** Reads and validates the saved history, discarding anything malformed
 *  (mirrors validState's approach in main.ts: reject bad data rather than
 *  let it crash the app, and clear storage only when it's unparsable). */
export function loadHistory(storage: StorageLike): SessionHistoryEntry[] {
  const raw = storage.getItem(HISTORY_STORAGE_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(validEntry);
  } catch {
    storage.removeItem(HISTORY_STORAGE_KEY);
    return [];
  }
}

export function saveHistory(entries: SessionHistoryEntry[], storage: StorageLike): void {
  storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(entries));
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
export function recordSession(entry: SessionHistoryEntry, storage: StorageLike): SessionHistoryEntry[] {
  const updated = appendHistory(loadHistory(storage), entry);
  saveHistory(updated, storage);
  return updated;
}
