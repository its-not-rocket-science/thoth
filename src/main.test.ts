// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const LEGACY_PROGRESS_KEY = "thoth-progress-v1";
const CENTRE_EDGE_PROGRESS_KEY = "thoth-progress-centre-edge-v1";
const LEGACY_HISTORY_KEY = "thoth-history-v1";
const SESSION_LENGTH = 20;

async function loadApp(): Promise<void> {
  document.body.innerHTML = '<div id="app"></div>';
  vi.resetModules();
  await import("./main");
}

/** With Math.random mocked to 0, createTrial always yields the first item
 *  of each pool: centralSymbol "circle" at peripheralPosition 0. */
function mockDeterministicTrial(): void {
  vi.spyOn(Math, "random").mockReturnValue(0);
}

async function advanceThroughFlash(presentationMs = 850): Promise<void> {
  await vi.advanceTimersByTimeAsync(650 + presentationMs + 10);
}

function submitAnswer(central: "circle" | "diamond", position: number): void {
  const centralInput = document.querySelector<HTMLInputElement>(`input[name="central"][value="${central}"]`);
  const positionInput = document.querySelector<HTMLInputElement>(`.dial-point input[value="${position}"]`);
  if (!centralInput || !positionInput) throw new Error("Answer inputs not found");
  centralInput.checked = true;
  positionInput.checked = true;
  const form = document.querySelector<HTMLFormElement>("#response");
  form?.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
}

/** Reads a readout's value by its label (e.g. "Correct", "Accuracy"), since
 *  readouts are now exercise-supplied label/value pairs rather than fixed
 *  IDs — the DOM structure is <dl><div class="readout"><dt>label</dt>
 *  <dd>value</dd></div>...</dl>. */
function readoutValue(scope: string, label: string): string | null {
  const cells = document.querySelectorAll(`${scope} .readout`);
  for (const cell of cells) {
    if (cell.querySelector("dt")?.textContent === label) {
      return cell.querySelector("dd")?.textContent ?? null;
    }
  }
  return null;
}

function selectCentreAndEdge(): void {
  document.querySelector<HTMLButtonElement>('[data-exercise-id="centre-edge"]')?.click();
}

beforeEach(() => {
  localStorage.clear();
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  document.body.innerHTML = "";
});

describe("trial completion", () => {
  it("updates score and accuracy after a correct simulated submission", async () => {
    mockDeterministicTrial();
    await loadApp();
    selectCentreAndEdge();

    screen.getByRole("button", { name: "Start trial" }).click();
    await advanceThroughFlash();

    submitAnswer("circle", 0);

    expect(readoutValue("#readouts", "Correct")).toBe("1");
    expect(readoutValue("#readouts", "Accuracy")).toBe("100%");
  });

  it("updates score and accuracy after an incorrect simulated submission", async () => {
    mockDeterministicTrial();
    await loadApp();
    selectCentreAndEdge();

    screen.getByRole("button", { name: "Start trial" }).click();
    await advanceThroughFlash();

    submitAnswer("diamond", 1);

    expect(readoutValue("#readouts", "Correct")).toBe("0");
    expect(readoutValue("#readouts", "Accuracy")).toBe("0%");
  });
});

describe("localStorage round-trip", () => {
  it("persists progress across a reload", async () => {
    mockDeterministicTrial();
    await loadApp();
    selectCentreAndEdge();

    screen.getByRole("button", { name: "Start trial" }).click();
    await advanceThroughFlash();
    submitAnswer("circle", 0);

    expect(readoutValue("#readouts", "Correct")).toBe("1");

    await loadApp();
    selectCentreAndEdge();
    expect(readoutValue("#readouts", "Correct")).toBe("1");
    expect(document.querySelector("#progress-text")?.textContent).toBe("1 of 20");
  });

  it("rejects unparsable saved data instead of throwing", async () => {
    localStorage.setItem(CENTRE_EDGE_PROGRESS_KEY, "{not json");
    await expect(loadApp()).resolves.not.toThrow();
    selectCentreAndEdge();
    expect(readoutValue("#readouts", "Correct")).toBe("0");
    expect(localStorage.getItem(CENTRE_EDGE_PROGRESS_KEY)).toBeNull();
  });

  it("rejects a saved state with the wrong shape", async () => {
    localStorage.setItem(
      CENTRE_EDGE_PROGRESS_KEY,
      JSON.stringify({ session: { score: "not-a-number", attempts: 2, presentationMs: 850 } }),
    );
    await loadApp();
    selectCentreAndEdge();
    expect(readoutValue("#readouts", "Correct")).toBe("0");
    expect(document.querySelector("#progress-text")?.textContent).toBe("0 of 20");
  });
});

describe("legacy storage migration", () => {
  it("migrates a pre-multi-exercise save into the namespaced centre-edge key and removes the old one", async () => {
    localStorage.setItem(
      LEGACY_PROGRESS_KEY,
      JSON.stringify({
        state: { score: 7, attempts: 9, presentationMs: 700, presentationStreak: 1, distractorCount: 2, distractorStreak: 0 },
        bestPresentationMs: 620,
      }),
    );
    localStorage.setItem(
      LEGACY_HISTORY_KEY,
      JSON.stringify([{ timestamp: 1, score: 15, accuracyPct: 75, lowestPresentationMs: 700 }]),
    );

    await loadApp();
    selectCentreAndEdge();

    expect(localStorage.getItem(LEGACY_PROGRESS_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_HISTORY_KEY)).toBeNull();
    expect(localStorage.getItem(CENTRE_EDGE_PROGRESS_KEY)).not.toBeNull();

    expect(readoutValue("#readouts", "Correct")).toBe("7");
    expect(document.querySelector("#progress-text")?.textContent).toBe("9 of 20");
  });

  it("never overwrites an existing namespaced save with older legacy data", async () => {
    localStorage.setItem(
      LEGACY_PROGRESS_KEY,
      JSON.stringify({ state: { score: 1, attempts: 1, presentationMs: 850 }, bestPresentationMs: null }),
    );
    localStorage.setItem(
      CENTRE_EDGE_PROGRESS_KEY,
      JSON.stringify({
        session: { score: 5, attempts: 5, presentationMs: 700, presentationStreak: 0, distractorCount: 2, distractorStreak: 0 },
        bestPresentationMs: 700,
        sessionLowestMs: 700,
      }),
    );

    await loadApp();
    selectCentreAndEdge();

    expect(localStorage.getItem(LEGACY_PROGRESS_KEY)).toBeNull();
    expect(readoutValue("#readouts", "Correct")).toBe("5");
  });
});

describe("pause during the flash", () => {
  it("discards the in-flight trial when paused mid-showing", async () => {
    mockDeterministicTrial();
    await loadApp();
    selectCentreAndEdge();

    screen.getByRole("button", { name: "Start trial" }).click();
    // Past the 650ms "preparing" delay, still inside the presentation window.
    await vi.advanceTimersByTimeAsync(700);

    screen.getByRole("button", { name: "Pause" }).click();

    expect(document.querySelector("#feedback")?.textContent).toMatch(/discarded/);
    expect(document.querySelector("#field-message")?.textContent).toBe("Paused");
    expect(document.querySelector<HTMLFieldSetElement>("#answer-controls")?.disabled).toBe(true);
  });
});

describe("session completion", () => {
  it("transitions to the complete phase once SESSION_LENGTH is reached", async () => {
    mockDeterministicTrial();
    localStorage.setItem(
      CENTRE_EDGE_PROGRESS_KEY,
      JSON.stringify({
        session: { score: 15, attempts: SESSION_LENGTH - 1, presentationMs: 850, presentationStreak: 0, distractorCount: 2, distractorStreak: 0 },
        bestPresentationMs: null,
        sessionLowestMs: 850,
      }),
    );
    await loadApp();
    selectCentreAndEdge();

    screen.getByRole("button", { name: "Next trial" }).click();
    await advanceThroughFlash();
    submitAnswer("circle", 0);

    expect(document.querySelector("#field-message")?.textContent).toBe("Session complete");
    expect(screen.getByRole("button", { name: "Start new session" })).toBeTruthy();
    expect(document.querySelector("#summary")?.hasAttribute("hidden")).toBe(false);
    expect(readoutValue("#summary-readouts", "Score")).toBe(`16 / ${SESSION_LENGTH}`);
  });
});
