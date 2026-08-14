import type { Exercise, ReadoutCell } from "../exercise";
import type { PeripheralPosition } from "../types";

const POSITIONS: PeripheralPosition[] = [0, 1, 2, 3, 4, 5, 6, 7];
const SESSION_LENGTH = 20;

/**
 * Posner (1980)'s validity ratio is traditionally fixed at 80% valid / 20%
 * invalid rather than staircased — the manipulation of interest is the RT
 * *cost* of an invalid cue, not accuracy at some difficulty level, so
 * there's no natural "harder/easier" direction to adapt. A fixed split is
 * also simpler and is explicitly an acceptable v1 per the brief; adapting
 * the cue-target delay (SOA) instead would be the natural next step if a
 * difficulty curve is wanted later.
 */
const VALIDITY_RATE = 0.8;
const CUE_DURATION_MS = 150;
const MIN_SOA_MS = 200;
const MAX_SOA_MS = 800;
const RESPONSE_TIMEOUT_MS = 2000;

export interface CueingTrial {
  cuedPosition: PeripheralPosition;
  targetPosition: PeripheralPosition;
  valid: boolean;
  /** Stimulus onset asynchrony: delay between the cue vanishing and the
   *  target appearing, randomised per trial. */
  soaMs: number;
}

export interface CueingState {
  attempts: number;
  validCount: number;
  validRtSum: number;
  invalidCount: number;
  invalidRtSum: number;
  timeouts: number;
}

const INITIAL_STATE: CueingState = {
  attempts: 0,
  validCount: 0,
  validRtSum: 0,
  invalidCount: 0,
  invalidRtSum: 0,
  timeouts: 0,
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function numberOr(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}

/** Pure trial generator — takes an injectable rng (defaulting to
 *  Math.random) purely so the 80/20 ratio can be tested statistically
 *  without depending on the real RNG. */
export function createCueingTrial(rng: () => number = Math.random): CueingTrial {
  const cuedPosition = POSITIONS[Math.floor(rng() * POSITIONS.length)] as PeripheralPosition;
  const valid = rng() < VALIDITY_RATE;
  let targetPosition = cuedPosition;
  if (!valid) {
    const others = POSITIONS.filter(position => position !== cuedPosition);
    targetPosition = others[Math.floor(rng() * others.length)] as PeripheralPosition;
  }
  const soaMs = MIN_SOA_MS + rng() * (MAX_SOA_MS - MIN_SOA_MS);
  return { cuedPosition, targetPosition, valid, soaMs };
}

/** Pure: folds one trial's outcome into running per-condition sums. A null
 *  rt records a timeout (no response within the window) without touching
 *  either condition's mean. */
export function recordRt(state: CueingState, valid: boolean, rt: number | null): CueingState {
  if (rt === null) {
    return { ...state, attempts: state.attempts + 1, timeouts: state.timeouts + 1 };
  }
  return valid
    ? { ...state, attempts: state.attempts + 1, validCount: state.validCount + 1, validRtSum: state.validRtSum + rt }
    : {
        ...state,
        attempts: state.attempts + 1,
        invalidCount: state.invalidCount + 1,
        invalidRtSum: state.invalidRtSum + rt,
      };
}

export function meanValidRt(state: CueingState): number | null {
  return state.validCount === 0 ? null : state.validRtSum / state.validCount;
}

export function meanInvalidRt(state: CueingState): number | null {
  return state.invalidCount === 0 ? null : state.invalidRtSum / state.invalidCount;
}

/** The "validity effect": how much slower invalid-cue trials are than
 *  valid-cue ones. This cost, not raw RT, is the paradigm's actual
 *  measure of attentional orienting. */
export function validityEffect(state: CueingState): number | null {
  const valid = meanValidRt(state);
  const invalid = meanInvalidRt(state);
  return valid === null || invalid === null ? null : invalid - valid;
}

function fieldOffset(field: HTMLElement | null, position: PeripheralPosition): { x: number; y: number } {
  if (!field) return { x: 0, y: 0 };
  const angle = ((position * 45 - 90) * Math.PI) / 180;
  const radius = Math.min(field.clientWidth, field.clientHeight) * 0.34;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function msCell(value: number | null): string {
  return value === null ? "—" : `${Math.round(value)}<span class="unit">ms</span>`;
}

/** "Spatial cueing": Posner (1980)'s classic reaction-time paradigm for
 *  attentional orienting. Unlike every other exercise, this measures raw
 *  reaction time rather than accuracy at a given presentation duration —
 *  a deliberate, documented exception (see the module comment above
 *  VALIDITY_RATE and historyEntry() below). The response *is* a keypress/
 *  click the instant the target appears, captured mid-"showing" rather
 *  than through the normal post-flash answer form. */
export function createSpatialCueingExercise(): Exercise<CueingState, CueingTrial> {
  let field: HTMLElement | null = null;
  let marker: HTMLDivElement | null = null;
  let answerControlsEl: HTMLFieldSetElement | null = null;
  let internalTimers: number[] = [];
  let targetOnsetTime: number | null = null;
  let responded = false;
  let rt: number | null = null;

  function clearInternalTimers(): void {
    internalTimers.forEach(id => window.clearTimeout(id));
    internalTimers = [];
  }

  function handleResponse(): void {
    if (responded || targetOnsetTime === null) return;
    responded = true;
    rt = performance.now() - targetOnsetTime;
    answerControlsEl?.form?.requestSubmit();
  }

  function onKeydown(event: KeyboardEvent): void {
    if (event.code !== "Space") return;
    if (targetOnsetTime === null || responded) return;
    event.preventDefault();
    handleResponse();
  }

  return {
    id: "spatial-cueing",
    number: 5,
    name: "Spatial cueing",
    instructions:
      "Watch the centre. A brief cue will brighten one of the eight positions, then — after a short pause — " +
      "a target will appear at a position (usually the cued one). Press <strong>Space</strong> or click " +
      "the response button the instant you see the target.",
    sessionLength: SESSION_LENGTH,

    initialState: INITIAL_STATE,

    loadState(raw: unknown): CueingState | null {
      if (!raw || typeof raw !== "object") return null;
      const v = raw as Partial<CueingState>;
      if (!isFiniteNumber(v.attempts)) return null;
      return {
        attempts: Math.min(SESSION_LENGTH, Math.max(0, v.attempts)),
        validCount: Math.max(0, numberOr(v.validCount, 0)),
        validRtSum: Math.max(0, numberOr(v.validRtSum, 0)),
        invalidCount: Math.max(0, numberOr(v.invalidCount, 0)),
        invalidRtSum: Math.max(0, numberOr(v.invalidRtSum, 0)),
        timeouts: Math.max(0, numberOr(v.timeouts, 0)),
      };
    },

    readouts(state: CueingState): ReadoutCell[] {
      return [
        { label: "Valid RT", value: msCell(meanValidRt(state)) },
        { label: "Invalid RT", value: msCell(meanInvalidRt(state)) },
        { label: "Validity effect", value: msCell(validityEffect(state)) },
        { label: "Trials", value: String(state.attempts) },
      ];
    },

    summaryCells(state: CueingState): ReadoutCell[] {
      return [
        { label: "Trials", value: `${state.attempts} / ${SESSION_LENGTH}` },
        { label: "Valid RT", value: msCell(meanValidRt(state)) },
        { label: "Invalid RT", value: msCell(meanInvalidRt(state)) },
        { label: "Validity effect", value: msCell(validityEffect(state)) },
      ];
    },

    attempts(state: CueingState): number {
      return state.attempts;
    },

    isSessionComplete(state: CueingState): boolean {
      return state.attempts >= SESSION_LENGTH;
    },

    pickerSummary(state: CueingState): string {
      if (state.attempts === 0) return "Not played yet";
      const ve = validityEffect(state);
      return `Validity effect ${ve === null ? "—" : `${Math.round(ve)}ms`} · ${state.attempts}/${SESSION_LENGTH} trials`;
    },

    // Doesn't fit history.ts's score/accuracy/interval shape — this is a
    // reaction-time task, not scored right/wrong at a presentation
    // duration — so it opts out of session history, like the other
    // documented-exception exercises.
    historyEntry(): null {
      return null;
    },

    mount(fieldContent: HTMLElement, answerControls: HTMLElement): void {
      field = fieldContent.closest<HTMLElement>(".field") ?? fieldContent;
      fieldContent.innerHTML = `
        <div id="cueing-marker" class="cueing-marker" hidden></div>
        <button type="button" id="cueing-respond" class="cueing-respond-button">Respond</button>
      `;
      marker = fieldContent.querySelector<HTMLDivElement>("#cueing-marker");
      fieldContent.querySelector<HTMLButtonElement>("#cueing-respond")?.addEventListener("click", handleResponse);

      answerControlsEl = answerControls as HTMLFieldSetElement;
      answerControls.innerHTML = `
        <legend>Respond to the target</legend>
        <p class="question">Press Space or click the button above the instant the target appears. There's nothing to fill in here.</p>
      `;

      // Idempotent: re-mounting (switching back to this exercise) must not
      // accumulate duplicate document-level listeners.
      document.removeEventListener("keydown", onKeydown);
      document.addEventListener("keydown", onKeydown);
    },

    createTrial(): CueingTrial {
      return createCueingTrial();
    },

    flashDurationMs(trial: CueingTrial): number {
      return CUE_DURATION_MS + trial.soaMs + RESPONSE_TIMEOUT_MS;
    },

    showTrial(trial: CueingTrial): void {
      clearInternalTimers();
      responded = false;
      rt = null;
      targetOnsetTime = null;
      if (!marker) return;

      marker.className = "cueing-marker cue";
      const cue = fieldOffset(field, trial.cuedPosition);
      marker.style.transform = `translate(calc(-50% + ${cue.x}px), calc(-50% + ${cue.y}px))`;
      marker.hidden = false;

      internalTimers.push(
        window.setTimeout(() => {
          if (marker) marker.hidden = true;
          internalTimers.push(
            window.setTimeout(() => {
              if (!marker) return;
              targetOnsetTime = performance.now();
              marker.className = "cueing-marker target";
              const target = fieldOffset(field, trial.targetPosition);
              marker.style.transform = `translate(calc(-50% + ${target.x}px), calc(-50% + ${target.y}px))`;
              marker.hidden = false;
            }, trial.soaMs),
          );
        }, CUE_DURATION_MS),
      );
    },

    hideTrial(): void {
      clearInternalTimers();
      if (marker) marker.hidden = true;
    },

    beginResponse(): void {
      // Reached only on a genuine timeout — an early response already
      // submitted (and cancelled the pending flash timer) before the host
      // could get here.
      if (responded) return;
      responded = true;
      rt = null;
      answerControlsEl?.form?.requestSubmit();
    },

    readAnswer(): { rt: number | null } {
      return { rt };
    },

    isCorrect(): boolean {
      return rt !== null;
    },

    feedback(trial: CueingTrial, correct: boolean): string {
      if (!correct) return "No response recorded — too slow.";
      return `Recorded — ${Math.round(rt ?? 0)}ms (${trial.valid ? "valid" : "invalid"} cue).`;
    },

    onMiss(): void {
      // No presentation-only miss indicator beyond the feedback text —
      // there's no "correct position" to ring the way the dial-based
      // exercises do.
    },

    clearMissMarks(): void {
      // Nothing persists between trials to clear.
    },

    score(state: CueingState, trial: CueingTrial, answer: unknown): CueingState {
      const a = answer as { rt: number | null };
      return recordRt(state, trial.valid, a.rt);
    },
  };
}
