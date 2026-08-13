import { describe, expect, it } from "vitest";
import { appendHistory, HISTORY_STORAGE_KEY, loadHistory, recordSession, saveHistory, type StorageLike } from "./history";
import type { SessionHistoryEntry } from "./types";

class FakeStorage implements StorageLike {
  private store = new Map<string, string>();

  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }

  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }

  removeItem(key: string): void {
    this.store.delete(key);
  }
}

function entry(overrides: Partial<SessionHistoryEntry> = {}): SessionHistoryEntry {
  return { timestamp: 1000, score: 15, accuracyPct: 75, lowestPresentationMs: 620, ...overrides };
}

describe("loadHistory", () => {
  it("returns an empty array when nothing is saved", () => {
    expect(loadHistory(new FakeStorage())).toEqual([]);
  });

  it("returns an empty array and clears storage for unparsable JSON", () => {
    const storage = new FakeStorage();
    storage.setItem(HISTORY_STORAGE_KEY, "{not json");
    expect(loadHistory(storage)).toEqual([]);
    expect(storage.getItem(HISTORY_STORAGE_KEY)).toBeNull();
  });

  it("returns an empty array for valid JSON that isn't an array", () => {
    const storage = new FakeStorage();
    storage.setItem(HISTORY_STORAGE_KEY, JSON.stringify({ not: "an array" }));
    expect(loadHistory(storage)).toEqual([]);
  });

  it("filters out malformed entries while keeping valid ones", () => {
    const storage = new FakeStorage();
    storage.setItem(
      HISTORY_STORAGE_KEY,
      JSON.stringify([
        entry({ timestamp: 1 }),
        { score: "not-a-number" },
        null,
        entry({ timestamp: 2 }),
        "just a string",
      ]),
    );
    const loaded = loadHistory(storage);
    expect(loaded).toHaveLength(2);
    expect(loaded.map(e => e.timestamp)).toEqual([1, 2]);
  });
});

describe("saveHistory", () => {
  it("round-trips through loadHistory", () => {
    const storage = new FakeStorage();
    const entries = [entry({ timestamp: 1 }), entry({ timestamp: 2 })];
    saveHistory(entries, storage);
    expect(loadHistory(storage)).toEqual(entries);
  });
});

describe("appendHistory", () => {
  it("puts the new entry first (newest-first ordering)", () => {
    const existing = [entry({ timestamp: 1 }), entry({ timestamp: 2 })];
    const updated = appendHistory(existing, entry({ timestamp: 3 }));
    expect(updated.map(e => e.timestamp)).toEqual([3, 1, 2]);
  });

  it("preserves the relative order of existing entries", () => {
    const existing = [entry({ timestamp: 5 }), entry({ timestamp: 4 }), entry({ timestamp: 3 })];
    const updated = appendHistory(existing, entry({ timestamp: 6 }));
    expect(updated.map(e => e.timestamp)).toEqual([6, 5, 4, 3]);
  });

  it("caps the result at 20 entries, dropping the oldest", () => {
    const existing = Array.from({ length: 20 }, (_, i) => entry({ timestamp: i }));
    const updated = appendHistory(existing, entry({ timestamp: 999 }));
    expect(updated).toHaveLength(20);
    expect(updated[0]?.timestamp).toBe(999);
    expect(updated.map(e => e.timestamp)).not.toContain(19);
    expect(updated.map(e => e.timestamp)).toContain(18);
  });

  it("does not mutate the input array", () => {
    const existing = [entry({ timestamp: 1 })];
    appendHistory(existing, entry({ timestamp: 2 }));
    expect(existing).toHaveLength(1);
  });
});

describe("recordSession", () => {
  it("loads, appends, saves, and returns the updated history in one call", () => {
    const storage = new FakeStorage();
    saveHistory([entry({ timestamp: 1 })], storage);

    const result = recordSession(entry({ timestamp: 2 }), storage);

    expect(result.map(e => e.timestamp)).toEqual([2, 1]);
    expect(loadHistory(storage).map(e => e.timestamp)).toEqual([2, 1]);
  });
});
