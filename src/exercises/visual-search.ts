import { SEARCH_SET_SIZE_STAIRCASE, stepStaircase } from "../game";
import type { Exercise, ReadoutCell } from "../exercise";
import type { MetricDescriptor } from "../types";

const SEARCH_METRICS: MetricDescriptor[] = [
  { key: "conjunctionSlope", label: "Conjunction slope", unit: "ms/item", direction: "lower", showInPicker: true, showInSummary: true },
  { key: "featureSlope", label: "Feature slope", unit: "ms/item", direction: "lower", showInPicker: true, showInSummary: true },
  { key: "accuracyPct", label: "Accuracy", unit: "%", direction: "higher", showInSummary: true },
];

type Shape = "circle" | "diamond";
type Color = "brass" | "phosphor";
export type SearchTrialType = "feature" | "conjunction";

export interface SearchGridItem {
  shape: Shape;
  color: Color;
  x: number;
  y: number;
}

export interface SearchTrial {
  type: SearchTrialType;
  setSize: number;
  targetIndex: number;
  items: SearchGridItem[];
}

export interface SearchBounds {
  width: number;
  height: number;
  /** Grid cell size in px — reuses .field's own 44px background grid, so
   *  items land on the same lines the field already draws. */
  cellSize: number;
}

/** Running least-squares sums for a reaction-time-by-set-size regression,
 *  tracked incrementally so it doesn't need to retain every sample. */
export interface RtSizeStats {
  n: number;
  sumSetSize: number;
  sumRt: number;
  sumSetSizeRt: number;
  sumSetSizeSq: number;
}

const EMPTY_STATS: RtSizeStats = { n: 0, sumSetSize: 0, sumRt: 0, sumSetSizeRt: 0, sumSetSizeSq: 0 };

export function addRtSample(stats: RtSizeStats, setSize: number, rt: number): RtSizeStats {
  return {
    n: stats.n + 1,
    sumSetSize: stats.sumSetSize + setSize,
    sumRt: stats.sumRt + rt,
    sumSetSizeRt: stats.sumSetSizeRt + setSize * rt,
    sumSetSizeSq: stats.sumSetSizeSq + setSize * setSize,
  };
}

/** ms of RT per additional set-size item — a flat (near-zero) slope
 *  indicates efficient parallel "pop-out" search, a steep positive slope
 *  indicates effortful serial search. Null until there are at least two
 *  differently-sized samples to fit a line through. */
export function slope(stats: RtSizeStats): number | null {
  if (stats.n < 2) return null;
  const denom = stats.n * stats.sumSetSizeSq - stats.sumSetSize * stats.sumSetSize;
  if (denom === 0) return null;
  return (stats.n * stats.sumSetSizeRt - stats.sumSetSize * stats.sumRt) / denom;
}

/** Pure: builds the shape/colour makeup of a trial (no positions). Feature
 *  trials vary exactly one of {shape, colour} for the target, so it's the
 *  only item differing from all distractors in that one dimension (pop-
 *  out). Conjunction trials have the target share its shape with some
 *  distractors and its colour with others, but no single distractor
 *  shares both — nothing pops out, forcing serial search. */
function buildContent(
  kind: SearchTrialType,
  setSize: number,
  rng: () => number,
): { targetIndex: number; items: Array<{ shape: Shape; color: Color }> } {
  const targetShape: Shape = "diamond";
  const targetColor: Color = "brass";
  const distractorCount = Math.max(0, setSize - 1);
  const distractors: Array<{ shape: Shape; color: Color }> = [];

  if (kind === "feature") {
    const varyShape = rng() < 0.5;
    const distractor = varyShape
      ? { shape: "circle" as Shape, color: targetColor }
      : { shape: targetShape, color: "phosphor" as Color };
    for (let i = 0; i < distractorCount; i++) distractors.push({ ...distractor });
  } else {
    const shareColor = { shape: "circle" as Shape, color: targetColor };
    const shareShape = { shape: targetShape, color: "phosphor" as Color };
    for (let i = 0; i < distractorCount; i++) distractors.push(rng() < 0.5 ? { ...shareColor } : { ...shareShape });
  }

  const targetIndex = Math.floor(rng() * (distractorCount + 1));
  const items = [...distractors];
  items.splice(targetIndex, 0, { shape: targetShape, color: targetColor });
  return { targetIndex, items };
}

/** Pure: shuffles the bounds' grid cells and returns the first `count`
 *  centres, so items land on distinct, non-overlapping-by-construction
 *  positions. */
export function randomGridPositions(bounds: SearchBounds, count: number, rng: () => number = Math.random): Array<{ x: number; y: number }> {
  const cols = Math.max(1, Math.floor(bounds.width / bounds.cellSize));
  const rows = Math.max(1, Math.floor(bounds.height / bounds.cellSize));
  const cells: Array<{ x: number; y: number }> = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      cells.push({ x: c * bounds.cellSize + bounds.cellSize / 2, y: r * bounds.cellSize + bounds.cellSize / 2 });
    }
  }
  for (let i = cells.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [cells[i], cells[j]] = [cells[j] as { x: number; y: number }, cells[i] as { x: number; y: number }];
  }
  return cells.slice(0, Math.min(count, cells.length));
}

export function createSearchTrial(
  kind: SearchTrialType,
  setSize: number,
  bounds: SearchBounds,
  rng: () => number = Math.random,
): SearchTrial {
  const content = buildContent(kind, setSize, rng);
  const positions = randomGridPositions(bounds, content.items.length, rng);
  const items = content.items.map((item, i) => ({
    ...item,
    x: positions[i]?.x ?? 0,
    y: positions[i]?.y ?? 0,
  }));
  return { type: kind, setSize: items.length, targetIndex: content.targetIndex, items };
}

export interface SearchState {
  attempts: number;
  correctCount: number;
  setSize: number;
  setSizeStreak: number;
  feature: RtSizeStats;
  conjunction: RtSizeStats;
}

const SESSION_LENGTH = 20;
const CELL_SIZE_PX = 44; // matches .field's own background-size grid
const RESPONSE_TIMEOUT_MS = 8000;

const INITIAL_STATE: SearchState = {
  attempts: 0,
  correctCount: 0,
  setSize: 6,
  setSizeStreak: 0,
  feature: EMPTY_STATS,
  conjunction: EMPTY_STATS,
};

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function numberOr(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}

function loadStats(raw: unknown): RtSizeStats {
  if (!raw || typeof raw !== "object") return EMPTY_STATS;
  const v = raw as Partial<RtSizeStats>;
  return {
    n: Math.max(0, numberOr(v.n, 0)),
    sumSetSize: Math.max(0, numberOr(v.sumSetSize, 0)),
    sumRt: Math.max(0, numberOr(v.sumRt, 0)),
    sumSetSizeRt: Math.max(0, numberOr(v.sumSetSizeRt, 0)),
    sumSetSizeSq: Math.max(0, numberOr(v.sumSetSizeSq, 0)),
  };
}

function slopeCell(stats: RtSizeStats): string {
  const value = slope(stats);
  return value === null ? "—" : `${value.toFixed(1)}<span class="unit">ms/item</span>`;
}

/** "Visual search": Treisman & Gelade (1980)'s feature-integration theory
 *  paradigm. Distinct construct from every other exercise: efficiency of
 *  finding one item among many, as a function of set size — the RT-by-
 *  set-size slope is the scientifically meaningful number here (flat =
 *  parallel "pop-out", steep = serial search), not raw average RT, so
 *  that's what's surfaced instead of the usual correct/accuracy/interval/
 *  best readouts. Like MOT and spatial-cueing, the response is clicking
 *  the (still-visible, not-yet-hidden) stimulus itself, captured mid-
 *  "showing" via the same early-submit path spatial-cueing established. */
export function createVisualSearchExercise(): Exercise<SearchState, SearchTrial> {
  let field: HTMLElement | null = null;
  let grid: HTMLDivElement | null = null;
  let answerControlsEl: HTMLFieldSetElement | null = null;
  let itemEls: HTMLDivElement[] = [];
  let onsetTime: number | null = null;
  let responded = false;
  let clickedIndex: number | null = null;
  let capturedRt: number | null = null;

  function bounds(): SearchBounds {
    return {
      width: field?.clientWidth || 400,
      height: field?.clientHeight || 300,
      cellSize: CELL_SIZE_PX,
    };
  }

  function handleClick(index: number): void {
    if (responded || onsetTime === null) return;
    responded = true;
    clickedIndex = index;
    capturedRt = performance.now() - onsetTime;
    answerControlsEl?.form?.requestSubmit();
  }

  return {
    id: "visual-search",
    number: 6,
    name: "Visual search",
    instructions:
      "A grid of shapes will appear. One is the target — the only <strong>brass diamond</strong>. " +
      "Click it as fast as you can. Sometimes it stands out at a glance; sometimes you'll need to check each one.",
    sessionLength: SESSION_LENGTH,
    // Set size adapts via the same staircase as the training exercises
    // (a training element), but the scientifically meaningful output —
    // the RT-by-set-size slope — is a measurement construct, not a score
    // to maximise. See README's "Exercise classification" section.
    mode: "mixed",
    metrics: SEARCH_METRICS,
    primaryMetricKey: "conjunctionSlope",
    recommendedCategory: "orienting-search",
    expectedSessionMinutes: 3,
    practiceNote: "Practice starts at the smallest set size, so the target is easy to spot.",

    practiceState(state: SearchState): SearchState {
      return { ...state, setSize: SEARCH_SET_SIZE_STAIRCASE.min, setSizeStreak: 0 };
    },

    initialState: INITIAL_STATE,

    loadState(raw: unknown): SearchState | null {
      if (!raw || typeof raw !== "object") return null;
      const v = raw as Partial<SearchState>;
      if (!isFiniteNumber(v.attempts)) return null;
      return {
        attempts: Math.min(SESSION_LENGTH, Math.max(0, v.attempts)),
        correctCount: Math.max(0, numberOr(v.correctCount, 0)),
        setSize: Math.max(
          SEARCH_SET_SIZE_STAIRCASE.min,
          Math.min(SEARCH_SET_SIZE_STAIRCASE.max, numberOr(v.setSize, INITIAL_STATE.setSize)),
        ),
        setSizeStreak: Math.max(0, numberOr(v.setSizeStreak, 0)),
        feature: loadStats(v.feature),
        conjunction: loadStats(v.conjunction),
      };
    },

    readouts(state: SearchState): ReadoutCell[] {
      return [
        { label: "Feature slope", value: slopeCell(state.feature) },
        { label: "Conjunction slope", value: slopeCell(state.conjunction) },
        {
          label: "Accuracy",
          value: state.attempts === 0 ? "—" : `${Math.round((state.correctCount / state.attempts) * 100)}%`,
        },
        { label: "Trials", value: String(state.attempts) },
      ];
    },

    summaryCells(state: SearchState): ReadoutCell[] {
      return [
        { label: "Trials", value: `${state.attempts} / ${SESSION_LENGTH}` },
        { label: "Accuracy", value: state.attempts === 0 ? "—" : `${Math.round((state.correctCount / state.attempts) * 100)}%` },
        { label: "Feature slope", value: slopeCell(state.feature) },
        { label: "Conjunction slope", value: slopeCell(state.conjunction) },
      ];
    },

    attempts(state: SearchState): number {
      return state.attempts;
    },

    isSessionComplete(state: SearchState): boolean {
      return state.attempts >= SESSION_LENGTH;
    },

    pickerSummary(state: SearchState): string {
      if (state.attempts === 0) return "Not played yet";
      const f = slope(state.feature);
      const c = slope(state.conjunction);
      const fmt = (v: number | null) => (v === null ? "—" : `${v.toFixed(1)}ms/item`);
      return `Feature ${fmt(f)} · Conjunction ${fmt(c)}`;
    },

    historyEntry(state: SearchState) {
      if (state.attempts === 0) return null;
      return {
        featureSlope: slope(state.feature),
        conjunctionSlope: slope(state.conjunction),
        accuracyPct: Math.round((state.correctCount / state.attempts) * 100),
      };
    },

    mount(fieldContent: HTMLElement, answerControls: HTMLElement): void {
      field = fieldContent.closest<HTMLElement>(".field") ?? fieldContent;
      fieldContent.innerHTML = `<div id="search-grid" class="search-grid"></div>`;
      grid = fieldContent.querySelector<HTMLDivElement>("#search-grid");
      grid?.addEventListener("click", event => {
        const el = (event.target as HTMLElement).closest<HTMLElement>(".search-item");
        if (!el) return;
        handleClick(Number(el.dataset.index));
      });

      answerControlsEl = answerControls as HTMLFieldSetElement;
      answerControls.innerHTML = `
        <legend>Find the target</legend>
        <p class="question">Click the target shape in the field as soon as you spot it.</p>
      `;
    },

    createTrial(state: SearchState): SearchTrial {
      const type: SearchTrialType = Math.random() < 0.5 ? "feature" : "conjunction";
      return createSearchTrial(type, state.setSize, bounds());
    },

    flashDurationMs(): number {
      return RESPONSE_TIMEOUT_MS;
    },

    showTrial(trial: SearchTrial): void {
      if (!grid) return;
      responded = false;
      clickedIndex = null;
      capturedRt = null;

      grid.innerHTML = trial.items
        .map(
          (item, i) =>
            `<div class="search-item ${item.shape} color-${item.color}" data-index="${i}" style="left:${item.x}px; top:${item.y}px;"></div>`,
        )
        .join("");
      itemEls = Array.from(grid.querySelectorAll<HTMLDivElement>(".search-item"));
      onsetTime = performance.now();
    },

    hideTrial(): void {
      onsetTime = null;
      if (grid) grid.innerHTML = "";
      itemEls = [];
    },

    beginResponse(): void {
      if (responded) return;
      responded = true;
      clickedIndex = null;
      capturedRt = null;
      answerControlsEl?.form?.requestSubmit();
    },

    readAnswer(): { clickedIndex: number | null; rt: number | null } {
      return { clickedIndex, rt: capturedRt };
    },

    isCorrect(trial: SearchTrial, answer: unknown): boolean {
      const a = answer as { clickedIndex: number | null };
      return a.clickedIndex === trial.targetIndex;
    },

    feedback(trial: SearchTrial, correct: boolean): string {
      if (correct) return `Found it — ${Math.round(capturedRt ?? 0)}ms (${trial.type}, set size ${trial.setSize}).`;
      return capturedRt === null ? "No response recorded — too slow." : "Not quite — that wasn't the target.";
    },

    onMiss(trial: SearchTrial): void {
      itemEls[trial.targetIndex]?.classList.add("correct-answer");
    },

    clearMissMarks(): void {
      itemEls.forEach(el => el.classList.remove("correct-answer"));
    },

    score(state: SearchState, trial: SearchTrial, answer: unknown): SearchState {
      const a = answer as { clickedIndex: number | null; rt: number | null };
      const correct = a.clickedIndex === trial.targetIndex;
      const staircase = stepStaircase(
        { value: state.setSize, streak: state.setSizeStreak },
        correct,
        SEARCH_SET_SIZE_STAIRCASE,
      );

      let feature = state.feature;
      let conjunction = state.conjunction;
      if (correct && a.rt !== null) {
        if (trial.type === "feature") feature = addRtSample(feature, trial.setSize, a.rt);
        else conjunction = addRtSample(conjunction, trial.setSize, a.rt);
      }

      return {
        attempts: state.attempts + 1,
        correctCount: state.correctCount + (correct ? 1 : 0),
        setSize: staircase.value,
        setSizeStreak: staircase.streak,
        feature,
        conjunction,
      };
    },
  };
}
