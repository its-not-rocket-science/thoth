import type { Exercise, ReadoutCell } from "../exercise";
import type { MetricDescriptor } from "../types";

const TRAIL_METRICS: MetricDescriptor[] = [
  { key: "bestCompletionMs", label: "Best time", unit: "ms", direction: "lower", showInPicker: true, showInSummary: true },
  { key: "totalErrors", label: "Total errors", direction: "lower", showInPicker: true, showInSummary: true },
  { key: "completedCount", label: "Completed", direction: "higher", showInSummary: true },
];

const NUMBERS = ["1", "2", "3", "4", "5", "6"];
const LETTERS = ["A", "B", "C", "D", "E", "F"];

/**
 * Real Trail Making Test B uses 1-13 and A-L (25 nodes) — a lot for a
 * mouse/touch web control on a small field. Halved to 6+6 (12 nodes) so a
 * round takes roughly as long as a handful of the app's other exercises
 * combined, keeping SESSION_LENGTH (below) reasonable.
 */
export function buildSequence(): string[] {
  const sequence: string[] = [];
  for (let i = 0; i < NUMBERS.length; i++) {
    sequence.push(NUMBERS[i] as string, LETTERS[i] as string);
  }
  return sequence;
}

export interface TrailNode {
  label: string;
  x: number;
  y: number;
}

export interface TrailTrial {
  sequence: string[];
  nodes: TrailNode[];
}

export interface TrailBounds {
  width: number;
  height: number;
  cellSize: number;
}

/** Pure: shuffles the bounds' grid cells and returns the first `count`
 *  centres — same approach as visual-search.ts's randomGridPositions,
 *  duplicated locally rather than imported since the two exercises have
 *  no other reason to depend on each other. */
function randomGridPositions(bounds: TrailBounds, count: number, rng: () => number = Math.random): Array<{ x: number; y: number }> {
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

export function createTrailTrial(bounds: TrailBounds, rng: () => number = Math.random): TrailTrial {
  const sequence = buildSequence();
  const positions = randomGridPositions(bounds, sequence.length, rng);
  const nodes = sequence.map((label, i) => ({ label, x: positions[i]?.x ?? 0, y: positions[i]?.y ?? 0 }));
  return { sequence, nodes };
}

/** Pure: is `label` the next node the player should click, given how many
 *  they've already gotten right? */
export function isExpectedNext(sequence: string[], progressIndex: number, label: string): boolean {
  return sequence[progressIndex] === label;
}

export interface TrailOutcome {
  completed: boolean;
  completionMs: number | null;
  errorCount: number;
}

export interface TrailState {
  attempts: number;
  completedCount: number;
  totalErrors: number;
  bestCompletionMs: number | null;
}

const INITIAL_STATE: TrailState = { attempts: 0, completedCount: 0, totalErrors: 0, bestCompletionMs: null };

/**
 * Each round is one full trail (~12 nodes), not a short flash judgment, so
 * a session here is a handful of complete-the-trail rounds rather than 20
 * short trials — restructuring the session shape per the brief, while
 * still using the Exercise interface's existing sessionLength/attempts/
 * isSessionComplete hooks unchanged. 5 rounds keeps total session length
 * in the same rough ballpark (a minute or two) as the app's other
 * exercises, given each round itself takes a nontrivial amount of time.
 */
const SESSION_LENGTH = 5;
// Matches .field's own background-size grid, in rem (not a fixed px), so
// the grid cell a node is centred in scales the same way the node's own
// rem-sized diameter does. If these two drifted apart (e.g. a hardcoded
// px cell against a rem-sized node), browser/OS text-size-adjustment would
// grow the node past its cell without growing its spacing, letting
// neighbouring nodes visually overlap.
const CELL_SIZE_REM = 2.75;
const ROUND_TIMEOUT_MS = 60_000;
const ERROR_FLASH_MS = 400;

function rootFontSizePx(): number {
  const parsed = parseFloat(getComputedStyle(document.documentElement).fontSize);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 16;
}

/** Pure: folds one round's outcome into the running session totals. */
export function summarizeRound(state: TrailState, outcome: TrailOutcome): TrailState {
  const bestCompletionMs =
    outcome.completed && outcome.completionMs !== null && (state.bestCompletionMs === null || outcome.completionMs < state.bestCompletionMs)
      ? outcome.completionMs
      : state.bestCompletionMs;
  return {
    attempts: state.attempts + 1,
    completedCount: state.completedCount + (outcome.completed ? 1 : 0),
    totalErrors: state.totalErrors + outcome.errorCount,
    bestCompletionMs,
  };
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function numberOr(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}

function formatSeconds(ms: number | null): string {
  return ms === null ? "—" : `${(ms / 1000).toFixed(1)}<span class="unit">s</span>`;
}

/** "Task-switching": not a UFOV subtest, but Trail Making Test B is one of
 *  the standard secondary outcome measures used alongside UFOV in the same
 *  speed-of-processing trial literature this project already cites (e.g.
 *  Reitan 1958's original validation) — see README. A single continuous
 *  round per trial rather than a flash-and-respond judgment: the player
 *  connects alternating numbers and letters (1-A-2-B-3-C...) in order,
 *  errors are counted but don't end the round (matching the real test's
 *  protocol of continuing from the mistake), and the round only ends on
 *  full completion or a generous timeout. */
export function createTaskSwitchingExercise(): Exercise<TrailState, TrailTrial> {
  let field: HTMLElement | null = null;
  let container: HTMLDivElement | null = null;
  let linesSvg: SVGSVGElement | null = null;
  let nodeEls: HTMLDivElement[] = [];
  let answerControlsEl: HTMLFieldSetElement | null = null;

  let currentTrial: TrailTrial | null = null;
  let sequence: string[] = [];
  let progressIndex = 0;
  let errorCount = 0;
  let roundStart: number | null = null;
  let completed = false;
  let submitted = false;

  function bounds(): TrailBounds {
    return {
      width: field?.clientWidth || 400,
      height: field?.clientHeight || 300,
      cellSize: CELL_SIZE_REM * rootFontSizePx(),
    };
  }

  function finish(): void {
    if (submitted) return;
    submitted = true;
    answerControlsEl?.form?.requestSubmit();
  }

  function drawLine(from: TrailNode, to: TrailNode): void {
    if (!linesSvg) return;
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", String(from.x));
    line.setAttribute("y1", String(from.y));
    line.setAttribute("x2", String(to.x));
    line.setAttribute("y2", String(to.y));
    line.setAttribute("class", "trail-line");
    linesSvg.appendChild(line);
  }

  function handleNodeClick(index: number): void {
    if (submitted || roundStart === null || !currentTrial) return;
    const node = currentTrial.nodes[index];
    const el = nodeEls[index];
    if (!node || !el) return;

    if (isExpectedNext(sequence, progressIndex, node.label)) {
      el.classList.add("visited");
      if (progressIndex > 0) {
        const previous = currentTrial.nodes.find(n => n.label === sequence[progressIndex - 1]);
        if (previous) drawLine(previous, node);
      }
      progressIndex++;
      if (progressIndex >= sequence.length) {
        completed = true;
        finish();
      }
    } else {
      errorCount++;
      el.classList.add("error-flash");
      window.setTimeout(() => el.classList.remove("error-flash"), ERROR_FLASH_MS);
    }
  }

  return {
    id: "task-switching",
    number: 7,
    name: "Task switching",
    instructions:
      "Nodes numbered 1–6 and lettered A–F are scattered across the field. Connect them in alternating order — " +
      "<strong>1, A, 2, B, 3, C…</strong> — by clicking each one as fast as you can. A wrong click counts as an " +
      "error but doesn't stop the round; just find the right node and carry on.",
    sessionLength: SESSION_LENGTH,
    // Fixed 12-node trail, no staircase — mirrors the standardised
    // protocol Trail Making Test B itself uses, so completion time and
    // error count are directly comparable session to session.
    mode: "measurement",
    metrics: TRAIL_METRICS,
    primaryMetricKey: "bestCompletionMs",
    recommendedCategory: "executive",
    expectedSessionMinutes: 4,

    initialState: INITIAL_STATE,

    loadState(raw: unknown): TrailState | null {
      if (!raw || typeof raw !== "object") return null;
      const v = raw as Partial<TrailState>;
      if (!isFiniteNumber(v.attempts)) return null;
      return {
        attempts: Math.min(SESSION_LENGTH, Math.max(0, v.attempts)),
        completedCount: Math.max(0, numberOr(v.completedCount, 0)),
        totalErrors: Math.max(0, numberOr(v.totalErrors, 0)),
        bestCompletionMs: isFiniteNumber(v.bestCompletionMs) ? v.bestCompletionMs : null,
      };
    },

    readouts(state: TrailState): ReadoutCell[] {
      return [
        { label: "Rounds", value: `${state.attempts} / ${SESSION_LENGTH}` },
        { label: "Completed", value: String(state.completedCount) },
        { label: "Errors", value: String(state.totalErrors) },
        { label: "Best time", value: formatSeconds(state.bestCompletionMs) },
      ];
    },

    summaryCells(state: TrailState): ReadoutCell[] {
      return [
        { label: "Rounds", value: `${state.attempts} / ${SESSION_LENGTH}` },
        { label: "Completed", value: String(state.completedCount) },
        { label: "Total errors", value: String(state.totalErrors) },
        { label: "Best time", value: formatSeconds(state.bestCompletionMs) },
      ];
    },

    attempts(state: TrailState): number {
      return state.attempts;
    },

    isSessionComplete(state: TrailState): boolean {
      return state.attempts >= SESSION_LENGTH;
    },

    pickerSummary(state: TrailState): string {
      if (state.attempts === 0) return "Not played yet";
      return `Best ${formatSeconds(state.bestCompletionMs).replace(/<[^>]+>/g, "")} · ${state.completedCount}/${state.attempts} completed`;
    },

    historyEntry(state: TrailState) {
      if (state.attempts === 0) return null;
      return { bestCompletionMs: state.bestCompletionMs, totalErrors: state.totalErrors, completedCount: state.completedCount };
    },

    mount(fieldContent: HTMLElement, answerControls: HTMLElement): void {
      field = fieldContent.closest<HTMLElement>(".field") ?? fieldContent;
      fieldContent.innerHTML = `
        <svg class="trail-lines"></svg>
        <div id="trail-nodes" class="trail-nodes"></div>
      `;
      linesSvg = fieldContent.querySelector<SVGSVGElement>(".trail-lines");
      container = fieldContent.querySelector<HTMLDivElement>("#trail-nodes");
      container?.addEventListener("click", event => {
        const el = (event.target as HTMLElement).closest<HTMLElement>(".trail-node");
        if (!el) return;
        handleNodeClick(Number(el.dataset.index));
      });

      answerControlsEl = answerControls as HTMLFieldSetElement;
      answerControls.innerHTML = `
        <legend>Connect the trail</legend>
        <p class="question">Click 1, then A, then 2, then B… in order. Errors are fine, just keep going.</p>
      `;
    },

    createTrial(): TrailTrial {
      return createTrailTrial(bounds());
    },

    flashDurationMs(): number {
      return ROUND_TIMEOUT_MS;
    },

    showTrial(trial: TrailTrial): void {
      currentTrial = trial;
      sequence = trial.sequence;
      progressIndex = 0;
      errorCount = 0;
      completed = false;
      submitted = false;

      if (linesSvg) {
        linesSvg.innerHTML = "";
        const box = bounds();
        linesSvg.setAttribute("width", String(box.width));
        linesSvg.setAttribute("height", String(box.height));
      }
      if (!container) return;
      container.innerHTML = trial.nodes
        .map(
          (node, i) =>
            `<div class="trail-node" data-index="${i}" style="left:${node.x}px; top:${node.y}px;">${node.label}</div>`,
        )
        .join("");
      nodeEls = Array.from(container.querySelectorAll<HTMLDivElement>(".trail-node"));

      roundStart = performance.now();
    },

    hideTrial(): void {
      roundStart = null;
      if (container) container.innerHTML = "";
      if (linesSvg) linesSvg.innerHTML = "";
      nodeEls = [];
    },

    beginResponse(): void {
      // Reached only on a genuine round timeout — completion already
      // submitted early (see finish()) before the host could get here.
      if (submitted) return;
      submitted = true;
      completed = false;
      answerControlsEl?.form?.requestSubmit();
    },

    readAnswer(): TrailOutcome {
      return {
        completed,
        completionMs: completed && roundStart !== null ? performance.now() - roundStart : null,
        errorCount,
      };
    },

    isCorrect(): boolean {
      return completed;
    },

    feedback(_trial: TrailTrial, correct: boolean): string {
      if (correct) {
        const seconds = roundStart !== null ? ((performance.now() - roundStart) / 1000).toFixed(1) : "—";
        return `Trail complete in ${seconds}s, with ${errorCount} error${errorCount === 1 ? "" : "s"}.`;
      }
      return `Ran out of time before completing the trail (${errorCount} error${errorCount === 1 ? "" : "s"} so far).`;
    },

    onMiss(): void {
      // The field itself already shows exactly how far the trail got
      // (visited nodes + drawn lines); no separate miss indicator needed.
    },

    clearMissMarks(): void {
      nodeEls.forEach(el => el.classList.remove("error-flash"));
    },

    score(state: TrailState, _trial: TrailTrial, answer: unknown): TrailState {
      return summarizeRound(state, answer as TrailOutcome);
    },
  };
}
