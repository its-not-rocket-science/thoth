import type { Exercise, ReadoutCell } from "../exercise";
import type { MetricDescriptor } from "../types";

const SESSION_LENGTH = 1;
/**
 * Standardised measurement design (see README's "Sustained attention" and
 * "Exercise classification" sections for the full rationale). The brief's
 * roadmap item asked for training-mode/measurement-mode CPT behaviour to be
 * separated; this exercise took the brief's documented fallback instead —
 * "if supporting two modes would add too much complexity, prefer
 * standardisation over adaptation" — because a *second* CPT mode with its
 * own adaptive staircase would double the surface area of the app's most
 * fatiguing exercise for a training benefit no other exercise here relies
 * on this heavily to deliver. So there is exactly one CPT protocol, and
 * it's the standardised one:
 *
 *   - a fixed EVENT_COUNT of events per stream (not "however many fit in a
 *     wall-clock duration"), so every session has the same denominator;
 *   - a fixed inter-stimulus interval (FIXED_ISI_MS) — no staircase, no
 *     adaptation, so timing is identical across every session;
 *   - a fixed go/no-go ratio, realised as an exact NO_GO_COUNT drawn into a
 *     shuffled deck (see buildEventDeck) rather than a per-event
 *     probability draw, so the *ratio* doesn't merely average out over a
 *     long stream but is exactly the same count every time.
 *
 * The commission/omission/mean-RT numbers this produces are therefore
 * directly comparable session to session, the way a fixed experimental
 * protocol's would be — this exercise is classified "measurement", not
 * "training" or "mixed", on that basis.
 */
const EVENT_COUNT = 54;
const NO_GO_RATE = 0.15;
const NO_GO_COUNT = Math.round(EVENT_COUNT * NO_GO_RATE);
const FIXED_ISI_MS = 1200;
const GLYPH_VISIBLE_MS = 400;
/** Safety margin above EVENT_COUNT * FIXED_ISI_MS, the stream's own exact
 *  natural duration — finalizeStream() below always finishes (and early-
 *  submits) well before this; it's only a fallback if that loop somehow
 *  got stuck. */
const FLASH_SAFETY_MARGIN_MS = 3000;
const STREAM_DURATION_MS = EVENT_COUNT * FIXED_ISI_MS;

const CPT_METRICS: MetricDescriptor[] = [
  { key: "commissionErrors", label: "Commission errors", direction: "lower", showInPicker: true, showInSummary: true },
  { key: "omissionErrors", label: "Omission errors", direction: "lower", showInPicker: true, showInSummary: true },
  { key: "meanGoRt", label: "Mean go RT", unit: "ms", direction: "lower", showInSummary: true },
  { key: "eventCount", label: "Events", direction: "neutral", showInSummary: false },
];

export interface CptState {
  attempts: number;
  commissionErrors: number;
  omissionErrors: number;
  goHitCount: number;
  goRtSum: number;
}

const INITIAL_STATE: CptState = {
  attempts: 0,
  commissionErrors: 0,
  omissionErrors: 0,
  goHitCount: 0,
  goRtSum: 0,
};

export interface CptOutcome {
  commissionErrors: number;
  omissionErrors: number;
  goHitCount: number;
  goRtSum: number;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function numberOr(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}

/** Pure: builds one stream's exact sequence of go/no-go events — precisely
 *  `noGoCount` no-go events among `eventCount` total, in random order, so
 *  the go/no-go ratio is exact rather than merely probable over a long
 *  stream (the standardisation this exercise's measurement design depends
 *  on — see the module comment above). Takes an injectable rng purely so
 *  the shuffle can be tested deterministically. */
export function buildEventDeck(eventCount: number, noGoCount: number, rng: () => number = Math.random): boolean[] {
  const clampedNoGo = Math.max(0, Math.min(eventCount, noGoCount));
  const deck = Array.from({ length: eventCount }, (_, i) => i < clampedNoGo);
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [deck[i], deck[j]] = [deck[j] as boolean, deck[i] as boolean];
  }
  return deck;
}

/** Pure: folds one full stream's outcome into the running session
 *  totals. */
export function summarizeStream(state: CptState, outcome: CptOutcome): CptState {
  return {
    attempts: state.attempts + 1,
    commissionErrors: state.commissionErrors + outcome.commissionErrors,
    omissionErrors: state.omissionErrors + outcome.omissionErrors,
    goHitCount: state.goHitCount + outcome.goHitCount,
    goRtSum: state.goRtSum + outcome.goRtSum,
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
 * flash-judgment exercise above. A stream of exactly EVENT_COUNT go/no-go
 * central glyphs runs at a fixed pace (see the module comment above); the
 * player responds to "go" glyphs (circles) and withholds on "no-go" glyphs
 * (diamonds, NO_GO_COUNT of the stream). Doesn't fit the UFOV exercises'
 * score/accuracy/interval shape (there's no single presentation duration —
 * the stream contains dozens of discrete events — and commission/omission/
 * RT don't collapse into one score), so it defines its own metric set (see
 * CPT_METRICS above) the way the app's other reaction-time-based exercises
 * do.
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
  let eventDeck: boolean[] = [];
  let eventIndex = 0;

  let commissionErrors = 0;
  let omissionErrors = 0;
  let goHitCount = 0;
  let goRtSum = 0;

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
    if (eventIndex >= eventDeck.length) {
      finalizeStream();
      return;
    }

    currentEventIsNoGo = eventDeck[eventIndex] ?? false;
    eventIndex++;
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
        if (!currentEventResponded && !currentEventIsNoGo) omissionErrors++;
        eventOnsetTime = null;
        scheduleNextEvent();
      }, FIXED_ISI_MS),
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
      `Circles and diamonds will stream past the centre at a fixed pace, ${EVENT_COUNT} events in all. Press <strong>Space</strong> or click ` +
      "the response button for every <strong>circle</strong> — but withhold for the rare <strong>diamond</strong>.",
    sessionLength: SESSION_LENGTH,
    mode: "measurement",
    metrics: CPT_METRICS,
    primaryMetricKey: "meanGoRt",
    recommendedCategory: "executive",
    expectedSessionMinutes: Math.round(STREAM_DURATION_MS / 60_000) || 1,
    // The fixed event count/ISI that make this exercise a standardised
    // measurement (see the module comment above) leave no per-session knob
    // for practiceState to ease — practice runs the same full-length
    // stream, just unscored and unsaved.
    practiceNote: "Practice runs the same full-length stream as a scored session, just unscored.",

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
      };
    },

    readouts(state: CptState): ReadoutCell[] {
      return [
        { label: "Commission errors", value: String(state.commissionErrors) },
        { label: "Omission errors", value: String(state.omissionErrors) },
        { label: "Mean go RT", value: msCell(meanGoRt(state)) },
        { label: "ISI", value: msCell(FIXED_ISI_MS) },
      ];
    },

    summaryCells(state: CptState): ReadoutCell[] {
      return [
        { label: "Commission errors", value: String(state.commissionErrors) },
        { label: "Omission errors", value: String(state.omissionErrors) },
        { label: "Mean go RT", value: msCell(meanGoRt(state)) },
        { label: "Events", value: String(EVENT_COUNT) },
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

    historyEntry(state: CptState) {
      if (state.attempts === 0) return null;
      return {
        commissionErrors: state.commissionErrors,
        omissionErrors: state.omissionErrors,
        meanGoRt: meanGoRt(state),
        eventCount: EVENT_COUNT,
      };
    },

    mount(fieldContent: HTMLElement, answerControls: HTMLElement): void {
      fieldContent.innerHTML = `
        <div id="cpt-glyph" class="central" hidden></div>
        <div class="cpt-timer" aria-hidden="true">
          <div id="cpt-timer-fill" class="cpt-timer-fill"></div>
        </div>
        <span id="cpt-timer-label" class="cpt-timer-label" role="status"></span>
      `;
      glyph = fieldContent.querySelector<HTMLDivElement>("#cpt-glyph");
      timerFill = fieldContent.querySelector<HTMLDivElement>("#cpt-timer-fill");
      if (timerFill) timerFill.style.width = "0%";
      timerLabel = fieldContent.querySelector<HTMLSpanElement>("#cpt-timer-label");

      answerControlsEl = answerControls as HTMLFieldSetElement;
      // Respond button lives in the answer-controls panel rather than as an
      // overlay on the field, so it can never sit on top of the centred
      // circle/diamond glyph (see the same fix in spatial-cueing.ts).
      answerControls.innerHTML = `
        <legend>Go, or no-go</legend>
        <p class="question">Respond to every circle. Let diamonds pass without responding.</p>
        <button type="button" id="cpt-respond" class="primary submit-answer">Respond</button>
      `;
      answerControls.querySelector<HTMLButtonElement>("#cpt-respond")?.addEventListener("click", handleResponse);

      // Idempotent: re-mounting (switching back to this exercise) must not
      // accumulate duplicate document-level listeners.
      document.removeEventListener("keydown", onKeydown);
      document.addEventListener("keydown", onKeydown);
    },

    createTrial(): Record<string, never> {
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
      eventDeck = buildEventDeck(EVENT_COUNT, NO_GO_COUNT);
      eventIndex = 0;
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
      return { commissionErrors, omissionErrors, goHitCount, goRtSum };
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
