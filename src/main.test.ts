// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const STORAGE_KEY = "thoth-progress-v1";
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

    screen.getByRole("button", { name: "Start trial" }).click();
    await advanceThroughFlash();

    submitAnswer("circle", 0);

    expect(screen.getByText("1", { selector: "#score" })).toBeTruthy();
    expect(document.querySelector("#accuracy")?.textContent).toBe("100%");
  });

  it("updates score and accuracy after an incorrect simulated submission", async () => {
    mockDeterministicTrial();
    await loadApp();

    screen.getByRole("button", { name: "Start trial" }).click();
    await advanceThroughFlash();

    submitAnswer("diamond", 1);

    expect(document.querySelector("#score")?.textContent).toBe("0");
    expect(document.querySelector("#accuracy")?.textContent).toBe("0%");
  });
});

describe("localStorage round-trip", () => {
  it("persists progress across a reload", async () => {
    mockDeterministicTrial();
    await loadApp();

    screen.getByRole("button", { name: "Start trial" }).click();
    await advanceThroughFlash();
    submitAnswer("circle", 0);

    expect(document.querySelector("#score")?.textContent).toBe("1");

    await loadApp();
    expect(document.querySelector("#score")?.textContent).toBe("1");
    expect(document.querySelector("#progress-text")?.textContent).toBe("1 of 20");
  });

  it("rejects unparsable saved data instead of throwing", async () => {
    localStorage.setItem(STORAGE_KEY, "{not json");
    await expect(loadApp()).resolves.not.toThrow();
    expect(document.querySelector("#score")?.textContent).toBe("0");
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });

  it("rejects a saved state with the wrong shape", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({ state: { score: "not-a-number", attempts: 2, presentationMs: 850 } }),
    );
    await loadApp();
    expect(document.querySelector("#score")?.textContent).toBe("0");
    expect(document.querySelector("#progress-text")?.textContent).toBe("0 of 20");
  });
});

describe("pause during the flash", () => {
  it("discards the in-flight trial when paused mid-showing", async () => {
    mockDeterministicTrial();
    await loadApp();

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
      STORAGE_KEY,
      JSON.stringify({
        state: { score: 15, attempts: SESSION_LENGTH - 1, presentationMs: 850 },
        bestPresentationMs: null,
      }),
    );
    await loadApp();

    screen.getByRole("button", { name: "Next trial" }).click();
    await advanceThroughFlash();
    submitAnswer("circle", 0);

    expect(document.querySelector("#field-message")?.textContent).toBe("Session complete");
    expect(screen.getByRole("button", { name: "Start new session" })).toBeTruthy();
    expect(document.querySelector("#summary")?.hasAttribute("hidden")).toBe(false);
    expect(document.querySelector("#summary-score")?.textContent).toBe(`16 / ${SESSION_LENGTH}`);
  });
});
