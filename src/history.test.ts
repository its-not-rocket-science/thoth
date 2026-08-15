import { describe, expect, it } from "vitest";
import { appendHistory, historyStorageKey, loadHistory, recordSession, saveHistory, type StorageLike } from "./history";
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

const EXERCISE_ID = "centre-edge";
const KEY = historyStorageKey(EXERCISE_ID);

function entry(overrides: Partial<SessionHistoryEntry> = {}): SessionHistoryEntry {
  return {
    exerciseId: EXERCISE_ID,
    timestamp: 1000,
    schemaVersion: 1,
    metrics: { score: 15, accuracyPct: 75, lowestPresentationMs: 620 },
    ...overrides,
  };
}

describe("historyStorageKey", () => {
  it("namespaces the key per exercise id", () => {
    expect(historyStorageKey("centre-edge")).toBe("thoth-history-centre-edge-v1");
    expect(historyStorageKey("centre-only")).toBe("thoth-history-centre-only-v1");
  });
});

describe("loadHistory", () => {
  it("returns an empty array when nothing is saved", () => {
    expect(loadHistory(new FakeStorage(), KEY, EXERCISE_ID)).toEqual([]);
  });

  it("returns an empty array and clears storage for unparsable JSON", () => {
    const storage = new FakeStorage();
    storage.setItem(KEY, "{not json");
    expect(loadHistory(storage, KEY, EXERCISE_ID)).toEqual([]);
    expect(storage.getItem(KEY)).toBeNull();
  });

  it("returns an empty array for valid JSON that isn't an array", () => {
    const storage = new FakeStorage();
    storage.setItem(KEY, JSON.stringify({ not: "an array" }));
    expect(loadHistory(storage, KEY, EXERCISE_ID)).toEqual([]);
  });

  it("filters out malformed entries while keeping valid ones", () => {
    const storage = new FakeStorage();
    storage.setItem(
      KEY,
      JSON.stringify([
        entry({ timestamp: 1 }),
        { score: "not-a-number" },
        null,
        entry({ timestamp: 2 }),
        "just a string",
      ]),
    );
    const loaded = loadHistory(storage, KEY, EXERCISE_ID);
    expect(loaded).toHaveLength(2);
    expect(loaded.map(e => e.timestamp)).toEqual([1, 2]);
  });

  it("keeps different exercises' histories independent", () => {
    const storage = new FakeStorage();
    saveHistory([entry({ timestamp: 1 })], storage, historyStorageKey("centre-edge"));
    saveHistory(
      [entry({ timestamp: 2, exerciseId: "centre-only" }), entry({ timestamp: 3, exerciseId: "centre-only" })],
      storage,
      historyStorageKey("centre-only"),
    );
    expect(loadHistory(storage, historyStorageKey("centre-edge"), "centre-edge")).toHaveLength(1);
    expect(loadHistory(storage, historyStorageKey("centre-only"), "centre-only")).toHaveLength(2);
  });

  it("migrates pre-generalised-schema entries (score/accuracyPct/lowestPresentationMs, no metrics) into the metrics-record shape", () => {
    const storage = new FakeStorage();
    storage.setItem(KEY, JSON.stringify([{ timestamp: 5, score: 15, accuracyPct: 75, lowestPresentationMs: 620 }]));
    const loaded = loadHistory(storage, KEY, EXERCISE_ID);
    expect(loaded).toEqual([
      {
        exerciseId: EXERCISE_ID,
        timestamp: 5,
        schemaVersion: 1,
        metrics: { score: 15, accuracyPct: 75, lowestPresentationMs: 620 },
      },
    ]);
  });

  it("keeps current-schema and legacy-schema entries side by side in one array", () => {
    const storage = new FakeStorage();
    storage.setItem(
      KEY,
      JSON.stringify([entry({ timestamp: 2 }), { timestamp: 1, score: 10, accuracyPct: 50, lowestPresentationMs: 900 }]),
    );
    const loaded = loadHistory(storage, KEY, EXERCISE_ID);
    expect(loaded.map(e => e.timestamp)).toEqual([2, 1]);
    expect(loaded[1]?.metrics).toEqual({ score: 10, accuracyPct: 50, lowestPresentationMs: 900 });
  });
});

describe("saveHistory", () => {
  it("round-trips through loadHistory", () => {
    const storage = new FakeStorage();
    const entries = [entry({ timestamp: 1 }), entry({ timestamp: 2 })];
    saveHistory(entries, storage, KEY);
    expect(loadHistory(storage, KEY, EXERCISE_ID)).toEqual(entries);
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
    saveHistory([entry({ timestamp: 1 })], storage, KEY);

    const result = recordSession(entry({ timestamp: 2 }), storage, KEY);

    expect(result.map(e => e.timestamp)).toEqual([2, 1]);
    expect(loadHistory(storage, KEY, EXERCISE_ID).map(e => e.timestamp)).toEqual([2, 1]);
  });
});
