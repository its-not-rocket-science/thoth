import { describe, expect, it } from "vitest";
import { appendTimingRecord, loadTimingRecords, saveTimingRecords, TIMING_STORAGE_KEY, type StorageLike, type TimingRecord } from "./timing";

class FakeStorage implements StorageLike {
  private store = new Map<string, string>();
  getItem(key: string): string | null {
    return this.store.has(key) ? (this.store.get(key) as string) : null;
  }
  setItem(key: string, value: string): void {
    this.store.set(key, value);
  }
}

function record(overrides: Partial<TimingRecord> = {}): TimingRecord {
  return {
    exerciseId: "centre-edge",
    timestamp: 1000,
    requestedMs: 850,
    observedMs: 861,
    valid: true,
    invalidReason: null,
    ...overrides,
  };
}

describe("loadTimingRecords", () => {
  it("returns an empty array when nothing is saved", () => {
    expect(loadTimingRecords(new FakeStorage())).toEqual([]);
  });

  it("returns an empty array for unparsable JSON", () => {
    const storage = new FakeStorage();
    storage.setItem(TIMING_STORAGE_KEY, "{not json");
    expect(loadTimingRecords(storage)).toEqual([]);
  });

  it("filters out malformed entries", () => {
    const storage = new FakeStorage();
    storage.setItem(TIMING_STORAGE_KEY, JSON.stringify([record(), { requestedMs: 1 }, null]));
    expect(loadTimingRecords(storage)).toHaveLength(1);
  });
});

describe("appendTimingRecord / saveTimingRecords round-trip", () => {
  it("prepends new records and caps the list", () => {
    const storage = new FakeStorage();
    let records = loadTimingRecords(storage);
    records = appendTimingRecord(records, record({ timestamp: 1 }), 3);
    records = appendTimingRecord(records, record({ timestamp: 2 }), 3);
    records = appendTimingRecord(records, record({ timestamp: 3 }), 3);
    records = appendTimingRecord(records, record({ timestamp: 4 }), 3);
    saveTimingRecords(records, storage);

    const reloaded = loadTimingRecords(storage);
    expect(reloaded).toHaveLength(3);
    expect(reloaded.map(r => r.timestamp)).toEqual([4, 3, 2]);
  });

  it("records an interrupted presentation as invalid with a reason, distinct from a valid one", () => {
    const valid = record({ valid: true, invalidReason: null, observedMs: 850 });
    const invalid = record({ valid: false, invalidReason: "tab hidden", observedMs: 210 });
    const records = appendTimingRecord(appendTimingRecord([], valid), invalid);
    expect(records.find(r => r.invalidReason === "tab hidden")?.valid).toBe(false);
    expect(records.find(r => r.invalidReason === null)?.valid).toBe(true);
  });
});
