import { CPT_ISI_STAIRCASE, stepStaircase } from "../game";
import type { Exercise, ReadoutCell } from "../exercise";

const SESSION_LENGTH = 1;
/** "At least 60-90 seconds of continuous trials" per the brief; 65s sits
 *  at the low end of that range given this is also the app's most
 *  fatiguing exercise by design. */
const STREAM_DURATION_MS = 65_000;
const GLYPH_VISIBLE_MS = 400;
const NO_GO_RATE = 0.15;
const INITIAL_ISI_MS = 1200;
/** Safety margin above the internal stream loop's own natural completion
 *  time — finalizeStream() below always finishes (and early-submits) well
 *  before this; it's only a fallback if that loop somehow got stuck. */
const FLASH_SAFETY_MARGIN_MS = 3000;

export interface CptState {
  attempts: number;
  commissionErrors: number;
  omissionErrors: number;
  goHitCount: number;
  goRtSum: number;
  isi: number;
  isiStreak: number;
  /** Fastest ISI ever reached at the end of a stream — lower is harder. */
  bestIsi: number | null;
}

const INITIAL_STATE: CptState = {
  attempts: 0,
  commissionErrors: 0,
  omissionErrors: 0,
  goHitCount: 0,
  goRtSum: 0,
  isi: INITIAL_ISI_MS,
  isiStreak: 0,
  bestIsi: null,
};

export interface CptOutcome {
  commissionErrors: number;
  omissionErrors: number;
  goHitCount: number;
  goRtSum: number;
  finalIsi: number;
  finalIsiStreak: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function numberOr(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}

/** Pure: whether a given random draw lands on a no-go event, wrapped so
 *  the stream's mix can be tested statistically without depending on the
 *  real RNG. */
export function isNoGoEvent(rng: () => number = Math.random, noGoRate: number = NO_GO_RATE): boolean {
  return rng() < noGoRate;
}

/** Pure: folds one full stream's outcome into the running session
 *  totals. */
export function summarizeStream(state: CptState, outcome: CptOutcome): CptState {
  const bestIsi = state.bestIsi === null || outcome.finalIsi < state.bestIsi ? outcome.finalIsi : state.bestIsi;
  return {
    attempts: state.attempts + 1,
    commissionErrors: state.commissionErrors + outcome.commissionErrors,
    omissionErrors: state.omissionErrors + outcome.omissionErrors,
    goHitCount: state.goHitCount + outcome.goHitCount,
    goRtSum: state.goRtSum + outcome.goRtSum,
    isi: outcome.finalIsi,
    isiStreak: outcome.finalIsiStreak,
    bestIsi,
  };
}

export function meanGoRt(state: CptState): number | null {
  return state.goHitCount === 0 ? null : state.goRtSum / state.goHitCount;
}

function msCell(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}<span class="unit">ms</span>`;
}

/**
 * "Sustained attention": grounded in the continuous performance test (CPT)
 * literature (e.g. Rosvold et al. 1956) — vigilance and response
 * inhibition over an extended period, a distinct construct from every
 * flash-judgment exercise above. A rapid stream of go/no-go central
 * glyphs runs for ~65s; the player responds to "go" glyphs (circles) and
 * withholds on rare "no-go" glyphs (diamonds, ~15% of the stream).
 * Doesn't fit history.ts's score/accuracy/interval shape (there's no
 * single presentation duration — the stream contains one adapting ISI
 * across dozens of events, and commission/omission/RT don't collapse
 * into a single score), so — like the app's other reaction-time-based
 * exercises — it uses its own readouts and opts out of session history.
 */
export function createSustainedAttentionExercise(): Exercise<CptState, Record<string, never>> {
  let glyph: HTMLDivElement | null = null;
  let timerFill: HTMLDivElement | null = null;
  let timerLabel: HTMLSpanElement | null = null;
  let answerControlsEl: HTMLFieldSetElement | null = null;

  let timers: number[] = [];
  let timerUpdateHandle: number | null = null;
  let streamStart: number | null = null;
  let eventOnsetTime: number | null = null;
  let currentEventIsNoGo = false;
  let currentEventResponded = false;
  let submitted = false;

  let commissionErrors = 0;
  let omissionErrors = 0;
  let goHitCount = 0;
  let goRtSum = 0;
  let isi = INITIAL_ISI_MS;
  let isiStreak = 0;

  function clearAllTimers(): void {
    timers.forEach(id => window.clearTimeout(id));
    timers = [];
    if (timerUpdateHandle !== null) {
      window.clearInterval(timerUpdateHandle);
      timerUpdateHandle = null;
    }
  }

  function finalizeStream(): void {
    if (submitted) return;
    submitted = true;
    clearAllTimers();
    answerControlsEl?.form?.requestSubmit();
  }

  function updateRemainingTime(): void {
    if (!timerFill || !timerLabel || streamStart === null) return;
    const elapsed = performance.now() - streamStart;
    const remaining = Math.max(0, STREAM_DURATION_MS - elapsed);
    timerFill.style.width = `${Math.max(0, Math.min(100, (remaining / STREAM_DURATION_MS) * 100))}%`;
    timerLabel.textContent = `${Math.ceil(remaining / 1000)}s remaining`;
  }

  function scheduleNextEvent(): void {
    if (streamStart === null) return;
    if (performance.now() - streamStart >= STREAM_DURATION_MS) {
      finalizeStream();
      return;
    }

    currentEventIsNoGo = isNoGoEvent();
    currentEventResponded = false;
    eventOnsetTime = performance.now();
    if (glyph) {
      glyph.className = `central ${currentEventIsNoGo ? "diamond" : "circle"}`;
      glyph.hidden = false;
    }

    timers.push(
      window.setTimeout(() => {
        if (glyph) glyph.hidden = true;
      }, GLYPH_VISIBLE_MS),
    );

    timers.push(
      window.setTimeout(() => {
        const eventCorrect = currentEventIsNoGo ? !currentEventResponded : currentEventResponded;
        if (!currentEventResponded && !currentEventIsNoGo) omissionErrors++;
        const staircase = stepStaircase({ value: isi, streak: isiStreak }, eventCorrect, CPT_ISI_STAIRCASE);
        isi = staircase.value;
        isiStreak = staircase.streak;
        eventOnsetTime = null;
        scheduleNextEvent();
      }, isi),
    );
  }

  function handleResponse(): void {
    if (currentEventResponded || eventOnsetTime === null) return;
    currentEventResponded = true;
    const rt = performance.now() - eventOnsetTime;
    if (currentEventIsNoGo) {
      commissionErrors++;
    } else {
      goHitCount++;
      goRtSum += rt;
    }
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.code !== "Space") return;
    if (eventOnsetTime === null || currentEventResponded) return;
    event.preventDefault();
    handleResponse();
  }

  return {
    id: "sustained-attention",
    number: 8,
    name: "Sustained attention",
    instructions:
      "Circles and diamonds will stream past the centre for about a minute. Press <strong>Space</strong> or click " +
      "the response button for every <strong>circle</strong> — but withhold for the rare <strong>diamond</strong>.",
    sessionLength: SESSION_LENGTH,

    initialState: INITIAL_STATE,

    loadState(raw: unknown): CptState | null {
      if (!raw || typeof raw !== "object") return null;
      const v = raw as Partial<CptState>;
      if (!isFiniteNumber(v.attempts)) return null;
      return {
        attempts: Math.min(SESSION_LENGTH, Math.max(0, v.attempts)),
        commissionErrors: Math.max(0, numberOr(v.commissionErrors, 0)),
        omissionErrors: Math.max(0, numberOr(v.omissionErrors, 0)),
        goHitCount: Math.max(0, numberOr(v.goHitCount, 0)),
        goRtSum: Math.max(0, numberOr(v.goRtSum, 0)),
        isi: Math.max(CPT_ISI_STAIRCASE.min, Math.min(CPT_ISI_STAIRCASE.max, numberOr(v.isi, INITIAL_ISI_MS))),
        isiStreak: Math.max(0, numberOr(v.isiStreak, 0)),
        bestIsi: isFiniteNumber(v.bestIsi) ? v.bestIsi : null,
      };
    },

    readouts(state: CptState): ReadoutCell[] {
      return [
        { label: "Commission errors", value: String(state.commissionErrors) },
        { label: "Omission errors", value: String(state.omissionErrors) },
        { label: "Mean go RT", value: msCell(meanGoRt(state)) },
        { label: "ISI", value: msCell(state.isi) },
      ];
    },

    summaryCells(state: CptState): ReadoutCell[] {
      return [
        { label: "Commission errors", value: String(state.commissionErrors) },
        { label: "Omission errors", value: String(state.omissionErrors) },
        { label: "Mean go RT", value: msCell(meanGoRt(state)) },
        { label: "Fastest ISI", value: msCell(state.bestIsi) },
      ];
    },

    attempts(state: CptState): number {
      return state.attempts;
    },

    isSessionComplete(state: CptState): boolean {
      return state.attempts >= SESSION_LENGTH;
    },

    pickerSummary(state: CptState): string {
      if (state.attempts === 0) return "Not played yet";
      const rt = meanGoRt(state);
      return `Commission ${state.commissionErrors} · Omission ${state.omissionErrors} · ${rt === null ? "—" : `${Math.round(rt)}ms`} avg go RT`;
    },

    // Doesn't fit history.ts's score/accuracy/interval shape — see the
    // module comment above. Same documented-exception pattern as the
    // app's other reaction-time-based exercises.
    historyEntry(): null {
      return null;
    },

    mount(fieldContent: HTMLElement, answerControls: HTMLElement): void {
      fieldContent.innerHTML = `
        <div id="cpt-glyph" class="central" hidden></div>
        <div class="cpt-timer" aria-hidden="true">
          <div id="cpt-timer-fill" class="cpt-timer-fill"></div>
        </div>
        <span id="cpt-timer-label" class="cpt-timer-label" role="status"></span>
        <button type="button" id="cpt-respond" class="cueing-respond-button">Respond</button>
      `;
      glyph = fieldContent.querySelector<HTMLDivElement>("#cpt-glyph");
      timerFill = fieldContent.querySelector<HTMLDivElement>("#cpt-timer-fill");
      if (timerFill) timerFill.style.width = "0%";
      timerLabel = fieldContent.querySelector<HTMLSpanElement>("#cpt-timer-label");
      fieldContent.querySelector<HTMLButtonElement>("#cpt-respond")?.addEventListener("click", handleResponse);

      answerControlsEl = answerControls as HTMLFieldSetElement;
      answerControls.innerHTML = `
        <legend>Go, or no-go</legend>
        <p class="question">Respond to every circle. Let diamonds pass without responding.</p>
      `;

      // Idempotent: re-mounting (switching back to this exercise) must not
      // accumulate duplicate document-level listeners.
      document.removeEventListener("keydown", onKeydown);
      document.addEventListener("keydown", onKeydown);
    },

    createTrial(state: CptState): Record<string, never> {
      isi = state.isi;
      isiStreak = state.isiStreak;
      return {};
    },

    flashDurationMs(): number {
      return STREAM_DURATION_MS + FLASH_SAFETY_MARGIN_MS;
    },

    showTrial(): void {
      clearAllTimers();
      commissionErrors = 0;
      omissionErrors = 0;
      goHitCount = 0;
      goRtSum = 0;
      submitted = false;
      streamStart = performance.now();
      timerUpdateHandle = window.setInterval(updateRemainingTime, 250);
      updateRemainingTime();
      scheduleNextEvent();
    },

    hideTrial(): void {
      clearAllTimers();
      streamStart = null;
      eventOnsetTime = null;
      if (glyph) glyph.hidden = true;
    },

    beginResponse(): void {
      // Fallback only — finalizeStream() above always early-submits once
      // the stream's own duration has elapsed, well before the host's
      // safety-margin timer could fire.
      finalizeStream();
    },

    readAnswer(): CptOutcome {
      return { commissionErrors, omissionErrors, goHitCount, goRtSum, finalIsi: isi, finalIsiStreak: isiStreak };
    },

    isCorrect(_trial: Record<string, never>, answer: unknown): boolean {
      const a = answer as CptOutcome;
      return a.commissionErrors === 0 && a.omissionErrors === 0;
    },

    feedback(_trial: Record<string, never>, correct: boolean): string {
      if (correct) return "Clean run — no commission or omission errors.";
      return `${commissionErrors} commission error${commissionErrors === 1 ? "" : "s"}, ${omissionErrors} omission error${omissionErrors === 1 ? "" : "s"}.`;
    },

    onMiss(): void {
      // No single "correct answer" to mark for a whole stream's outcome.
    },

    clearMissMarks(): void {
      // Nothing persists between streams to clear.
    },

    score(state: CptState, _trial: Record<string, never>, answer: unknown): CptState {
      return summarizeStream(state, answer as CptOutcome);
    },
  };
}
