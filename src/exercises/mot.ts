import { createMotTrial, MOT_OBJECT_COUNT_STAIRCASE, stepMotion, stepStaircase } from "../game";
import type { Exercise, ReadoutCell } from "../exercise";
import type { MotionBounds, MotionState, MotTrial } from "../types";

export interface MotState {
  score: number;
  attempts: number;
  objectCount: number;
  /** Consecutive correct responses since objectCount last stepped. */
  objectCountStreak: number;
  /** Highest objectCount ever tracked correctly (more objects = harder,
   *  the opposite direction from Centre-and-edge's "lower is better"
   *  presentation interval). */
  bestObjectCount: number | null;
}

const SESSION_LENGTH = 20;
/** Pylyshyn & Storm (1988) used 3-5 targets among more distractors; this
 *  keeps the target count fixed and lets the staircase (below) grow the
 *  total object count instead, per the "and/or" choice the brief allows. */
const TARGET_COUNT = 3;
const HIGHLIGHT_MS = 1500;
const TRACKING_MS = 4000;
const OBJECT_RADIUS_PX = 13;
const DRIFT_SPEED_PX_PER_S = 70;
const REDUCED_MOTION_JUMP_MS = 750;
const MAX_FRAME_DT_S = 0.05;

const INITIAL_STATE: MotState = {
  score: 0,
  attempts: 0,
  objectCount: 6,
  objectCountStreak: 0,
  bestObjectCount: null,
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function numberOr(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}

function randomPositionInBounds(bounds: MotionBounds): MotionState {
  return {
    x: bounds.radius + Math.random() * (bounds.width - 2 * bounds.radius),
    y: bounds.radius + Math.random() * (bounds.height - 2 * bounds.radius),
    vx: 0,
    vy: 0,
  };
}

function motCorrect(trial: MotTrial, answer: unknown): boolean {
  const a = answer as { selectedIndices?: number[] };
  const target = [...trial.targetIndices].sort((x, y) => x - y);
  const selected = [...(a.selectedIndices ?? [])].sort((x, y) => x - y);
  return target.length === selected.length && target.every((value, i) => value === selected[i]);
}

/** "Multiple object tracking": Pylyshyn & Storm (1988)'s classic divided-
 *  attention paradigm — track a subset of identical moving objects among
 *  identical distractors. Unlike the other exercises, the response *is*
 *  clicking the (now-frozen) stimulus rather than a separate form, hence
 *  this leans on the optional Exercise.beginResponse() hook. */
export function createMotExercise(): Exercise<MotState, MotTrial> {
  let field: HTMLElement | null = null;
  let objectsContainer: HTMLDivElement | null = null;
  let objectEls: HTMLDivElement[] = [];
  let currentPositions: MotionState[] = [];
  let lastPositions: MotionState[] = [];
  let selected = new Set<number>();
  let rafHandle: number | null = null;
  let internalTimers: number[] = [];

  function clearInternalTimers(): void {
    internalTimers.forEach(id => window.clearTimeout(id));
    internalTimers = [];
    if (rafHandle !== null) {
      window.cancelAnimationFrame(rafHandle);
      rafHandle = null;
    }
  }

  function bounds(): MotionBounds {
    return {
      width: field?.clientWidth || 300,
      height: field?.clientHeight || 300,
      radius: OBJECT_RADIUS_PX,
    };
  }

  function renderPositions(): void {
    objectEls.forEach((el, i) => {
      const p = currentPositions[i];
      if (!p) return;
      el.style.left = `${p.x}px`;
      el.style.top = `${p.y}px`;
    });
  }

  function reducedMotion(): boolean {
    return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
  }

  function startDrift(): void {
    const box = bounds();

    if (reducedMotion()) {
      const jump = () => {
        currentPositions = currentPositions.map(() => randomPositionInBounds(box));
        renderPositions();
        internalTimers.push(window.setTimeout(jump, REDUCED_MOTION_JUMP_MS));
      };
      internalTimers.push(window.setTimeout(jump, REDUCED_MOTION_JUMP_MS));
      return;
    }

    let last = performance.now();
    const frame = (now: number) => {
      const dt = Math.min(MAX_FRAME_DT_S, (now - last) / 1000);
      last = now;
      currentPositions = currentPositions.map(p => stepMotion(p, dt, box));
      renderPositions();
      rafHandle = window.requestAnimationFrame(frame);
    };
    rafHandle = window.requestAnimationFrame(frame);
  }

  return {
    id: "multiple-object-tracking",
    number: 4,
    name: "Multiple object tracking",
    instructions:
      "A handful of identical dots will appear. A few will briefly turn <strong>brass</strong> — those are your targets. " +
      "Then every dot goes neutral and drifts around the field. When they stop, click every dot you believe was a target.",
    sessionLength: SESSION_LENGTH,

    initialState: INITIAL_STATE,

    loadState(raw: unknown): MotState | null {
      if (!raw || typeof raw !== "object") return null;
      const v = raw as Partial<MotState>;
      if (!isFiniteNumber(v.score) || !isFiniteNumber(v.attempts)) return null;
      return {
        score: Math.max(0, v.score),
        attempts: Math.min(SESSION_LENGTH, Math.max(0, v.attempts)),
        objectCount: Math.max(
          MOT_OBJECT_COUNT_STAIRCASE.min,
          Math.min(MOT_OBJECT_COUNT_STAIRCASE.max, numberOr(v.objectCount, INITIAL_STATE.objectCount)),
        ),
        objectCountStreak: Math.max(0, numberOr(v.objectCountStreak, 0)),
        bestObjectCount: isFiniteNumber(v.bestObjectCount) ? v.bestObjectCount : null,
      };
    },

    readouts(state: MotState): ReadoutCell[] {
      return [
        { label: "Correct", value: String(state.score) },
        {
          label: "Accuracy",
          value: state.attempts === 0 ? "—" : `${Math.round((state.score / state.attempts) * 100)}%`,
        },
        { label: "Objects", value: String(state.objectCount) },
        { label: "Best", value: state.bestObjectCount === null ? "—" : String(state.bestObjectCount) },
      ];
    },

    summaryCells(state: MotState): ReadoutCell[] {
      const accuracyPct = state.attempts === 0 ? 0 : Math.round((state.score / state.attempts) * 100);
      return [
        { label: "Score", value: `${state.score} / ${SESSION_LENGTH}` },
        { label: "Accuracy", value: `${accuracyPct}%` },
        { label: "Most objects tracked", value: state.bestObjectCount === null ? "—" : String(state.bestObjectCount) },
        { label: "Correct / incorrect", value: `${state.score} / ${state.attempts - state.score}` },
      ];
    },

    attempts(state: MotState): number {
      return state.attempts;
    },

    isSessionComplete(state: MotState): boolean {
      return state.attempts >= SESSION_LENGTH;
    },

    pickerSummary(state: MotState): string {
      if (state.attempts === 0 && state.bestObjectCount === null) return "Not played yet";
      const best = state.bestObjectCount === null ? "—" : `${state.bestObjectCount} objects`;
      const accuracy = state.attempts === 0 ? "—" : `${Math.round((state.score / state.attempts) * 100)}%`;
      return `Best ${best} · Last ${state.score}/${SESSION_LENGTH} (${accuracy})`;
    },

    // Doesn't fit history.ts's score/accuracy/interval shape — object count
    // isn't a presentation interval — so, like the app's RT-based
    // exercises, it opts out of session history rather than misreporting.
    historyEntry(): null {
      return null;
    },

    mount(fieldContent: HTMLElement, answerControls: HTMLElement): void {
      field = fieldContent.closest<HTMLElement>(".field") ?? fieldContent;
      fieldContent.innerHTML = `<div id="mot-objects" class="mot-objects"></div>`;
      objectsContainer = fieldContent.querySelector<HTMLDivElement>("#mot-objects");

      objectsContainer?.addEventListener("click", event => {
        if (!objectsContainer?.classList.contains("respond-active")) return;
        const el = (event.target as HTMLElement).closest<HTMLElement>(".mot-object");
        if (!el) return;
        const index = Number(el.dataset.index);
        if (selected.has(index)) {
          selected.delete(index);
          el.classList.remove("selected");
        } else {
          selected.add(index);
          el.classList.add("selected");
        }
      });

      answerControls.innerHTML = `
        <legend>Which were targets?</legend>
        <p class="question">Click every dot you remember being highlighted, then submit.</p>
        <button class="primary submit-answer" type="submit">Submit answer</button>
      `;
    },

    createTrial(state: MotState): MotTrial {
      return createMotTrial(state.objectCount, TARGET_COUNT, bounds(), DRIFT_SPEED_PX_PER_S);
    },

    flashDurationMs(): number {
      return HIGHLIGHT_MS + TRACKING_MS;
    },

    showTrial(trial: MotTrial): void {
      clearInternalTimers();
      selected = new Set();
      if (!objectsContainer) return;

      currentPositions = trial.objects.map(o => ({ ...o }));
      objectsContainer.classList.remove("respond-active");
      objectsContainer.innerHTML = trial.objects
        .map((_, i) => `<div class="mot-object${trial.targetIndices.includes(i) ? " target-highlight" : ""}" data-index="${i}"></div>`)
        .join("");
      objectEls = Array.from(objectsContainer.querySelectorAll<HTMLDivElement>(".mot-object"));
      renderPositions();

      internalTimers.push(
        window.setTimeout(() => {
          objectEls.forEach(el => el.classList.remove("target-highlight"));
          startDrift();
        }, HIGHLIGHT_MS),
      );
    },

    hideTrial(): void {
      clearInternalTimers();
      lastPositions = currentPositions.map(p => ({ ...p }));
      if (objectsContainer) {
        objectsContainer.innerHTML = "";
        objectsContainer.classList.remove("respond-active");
      }
      objectEls = [];
    },

    beginResponse(trial: MotTrial): void {
      if (!objectsContainer) return;
      objectsContainer.innerHTML = trial.objects.map((_, i) => `<div class="mot-object" data-index="${i}"></div>`).join("");
      objectEls = Array.from(objectsContainer.querySelectorAll<HTMLDivElement>(".mot-object"));
      currentPositions = lastPositions;
      renderPositions();
      objectsContainer.classList.add("respond-active");
    },

    readAnswer(): { selectedIndices: number[] } {
      return { selectedIndices: [...selected].sort((a, b) => a - b) };
    },

    isCorrect(trial: MotTrial, answer: unknown): boolean {
      return motCorrect(trial, answer);
    },

    feedback(trial: MotTrial, correct: boolean): string {
      if (correct) return "Correct — you tracked every target.";
      // Dots aren't individually labelled (unlike the position dial), so
      // naming *which* ones doesn't help after the fact; onMiss() below
      // rings the actual targets in the field to show what was missed.
      return `Not quite. There were ${trial.targetIndices.length} targets to track.`;
    },

    onMiss(trial: MotTrial): void {
      trial.targetIndices.forEach(i => objectEls[i]?.classList.add("correct-answer"));
    },

    clearMissMarks(): void {
      objectEls.forEach(el => el.classList.remove("correct-answer"));
    },

    score(state: MotState, trial: MotTrial, answer: unknown): MotState {
      const correct = motCorrect(trial, answer);
      const staircase = stepStaircase(
        { value: state.objectCount, streak: state.objectCountStreak },
        correct,
        MOT_OBJECT_COUNT_STAIRCASE,
      );
      const bestObjectCount =
        correct && (state.bestObjectCount === null || trial.objectCount > state.bestObjectCount)
          ? trial.objectCount
          : state.bestObjectCount;
      return {
        score: state.score + (correct ? 1 : 0),
        attempts: state.attempts + 1,
        objectCount: staircase.value,
        objectCountStreak: staircase.streak,
        bestObjectCount,
      };
    },
  };
}
