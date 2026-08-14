import "./styles.css";
import { LEGACY_PROGRESS_STORAGE_KEY, migrateLegacyStorage, progressStorageKey, type Exercise, type ReadoutCell } from "./exercise";
import { createMotExercise } from "./exercises/mot";
import { createCentreEdgeDistractorsExercise, createCentreEdgeExercise, createCentreOnlyExercise } from "./exercises/ufov";
import { historyStorageKey, LEGACY_HISTORY_STORAGE_KEY, loadHistory, recordSession } from "./history";

type Phase = "ready" | "preparing" | "showing" | "responding" | "paused" | "complete";

/** Every exercise Thoth currently offers. Order here is picker order. */
const exercises: Exercise[] = [
  createCentreOnlyExercise(),
  createCentreEdgeExercise(),
  createCentreEdgeDistractorsExercise(),
  createMotExercise(),
];

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Application root not found.");

app.innerHTML = `
  <main class="shell">
    <header class="masthead">
      <div class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 40 40" width="34" height="34" aria-hidden="true">
          <path d="M20 6v28M6 20h28" stroke="currentColor" stroke-width="1.4" />
          <circle cx="20" cy="20" r="3.2" fill="currentColor" />
        </svg>
      </div>
      <div>
        <p class="eyebrow">Visual attention instrument</p>
        <h1>Thoth</h1>
        <p class="tagline">A game for the edges of your attention.</p>
      </div>
    </header>

    <aside class="notice"><strong>Research prototype —</strong> not a medical device and not shown to prevent or treat dementia.</aside>

    <section class="exercise-picker" aria-label="Choose an exercise">
      <div class="exercise-cards" id="exercise-cards"></div>
    </section>

    <section class="game-card" aria-labelledby="game-heading" aria-describedby="vision-note">
      <div class="heading-row">
        <div>
          <p class="eyebrow" id="exercise-eyebrow">Exercise No.&nbsp;01</p>
          <h2 id="game-heading">Centre and edge</h2>
        </div>
        <div class="session-label"><strong id="progress-text">0 of 0</strong> trials completed</div>
      </div>

      <p id="vision-note" class="vision-note">This is a timed visual exercise and requires sight to play; it is not screen-reader navigable.</p>

      <div class="progress-track" role="progressbar" aria-label="Session progress" aria-valuemin="0" aria-valuemax="0" aria-valuenow="0">
        <div id="progress-fill" class="progress-fill"></div>
      </div>

      <p class="instructions" id="instructions"></p>

      <dl class="readouts" id="readouts" aria-live="polite"></dl>

      <div id="game-layout" class="game-layout">
        <div class="field-column">
          <div id="field" class="field" role="group" aria-label="Visual stimulus field">
            <div class="fixation" aria-hidden="true">+</div>
            <div id="field-content"></div>
            <div id="field-message" class="field-message">Ready</div>
          </div>

          <div class="action-bar" aria-label="Game controls">
            <button id="start" class="primary" type="button">Start trial</button>
            <button id="replay" class="secondary" type="button" disabled>Replay flash</button>
            <button id="pause" class="secondary" type="button">Pause</button>
            <button id="reset" class="quiet" type="button">Reset progress</button>
          </div>
        </div>

        <form id="response" class="response-panel">
          <fieldset id="answer-controls" disabled></fieldset>
        </form>

        <section id="summary" class="summary-panel" hidden aria-labelledby="summary-heading">
          <p class="eyebrow" id="summary-heading">Session complete</p>
          <dl class="readouts" id="summary-readouts"></dl>
          <div id="summary-history" class="history"></div>
        </section>
      </div>

      <p id="feedback" class="feedback" aria-live="assertive"></p>
    </section>

    <footer>Progress is saved in this browser using web storage. No analytics or account required.</footer>
  </main>
`;

function find<T extends Element>(selector: string): T {
  const element = document.querySelector<T>(selector);
  if (!element) throw new Error(`Missing element: ${selector}`);
  return element;
}

const exerciseCards = find<HTMLDivElement>("#exercise-cards");
const exerciseEyebrow = find<HTMLElement>("#exercise-eyebrow");
const gameHeading = find<HTMLHeadingElement>("#game-heading");
const instructions = find<HTMLParagraphElement>("#instructions");
const readouts = find<HTMLDListElement>("#readouts");
const summaryPanel = find<HTMLElement>("#summary");
const summaryReadouts = find<HTMLDListElement>("#summary-readouts");
const summaryHistory = find<HTMLDivElement>("#summary-history");
const field = find<HTMLDivElement>("#field");
const fieldContent = find<HTMLDivElement>("#field-content");
const fieldMessage = find<HTMLDivElement>("#field-message");
const response = find<HTMLFormElement>("#response");
const answerControls = find<HTMLFieldSetElement>("#answer-controls");
const start = find<HTMLButtonElement>("#start");
const replay = find<HTMLButtonElement>("#replay");
const pause = find<HTMLButtonElement>("#pause");
const reset = find<HTMLButtonElement>("#reset");
const feedback = find<HTMLParagraphElement>("#feedback");
const progressText = find<HTMLElement>("#progress-text");
const progressTrack = find<HTMLDivElement>(".progress-track");
const progressFill = find<HTMLDivElement>("#progress-fill");

// Pre-multi-exercise saves were unnamespaced; every one of them was always
// "centre-edge" progress, since that was the only exercise that existed.
// Migrate once per key, per exercise that could plausibly own legacy data.
migrateLegacyStorage(localStorage, LEGACY_PROGRESS_STORAGE_KEY, progressStorageKey("centre-edge"));
migrateLegacyStorage(localStorage, LEGACY_HISTORY_STORAGE_KEY, historyStorageKey("centre-edge"));

function loadExerciseState(exercise: Exercise): unknown {
  const key = progressStorageKey(exercise.id);
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return exercise.initialState;
    return exercise.loadState(JSON.parse(raw)) ?? exercise.initialState;
  } catch {
    localStorage.removeItem(key);
    return exercise.initialState;
  }
}

function saveExerciseState(exercise: Exercise, state: unknown): void {
  localStorage.setItem(progressStorageKey(exercise.id), JSON.stringify(state));
}

let activeExercise: Exercise = exercises[0] as Exercise;
let state: unknown = null;
let trial: unknown = null;
let phase: Phase = "ready";
let timers: number[] = [];

function clearTimers(): void {
  timers.forEach(timer => window.clearTimeout(timer));
  timers = [];
}

function schedule(callback: () => void, delay: number): void {
  timers.push(window.setTimeout(callback, delay));
}

function renderReadoutCells(container: HTMLDListElement, cells: ReadoutCell[]): void {
  container.innerHTML = cells
    .map(cell => `<div class="readout"><dt>${cell.label}</dt><dd>${cell.value}</dd></div>`)
    .join("");
}

function updateStats(): void {
  renderReadoutCells(readouts, activeExercise.readouts(state));

  const completed = Math.min(activeExercise.attempts(state), activeExercise.sessionLength);
  progressText.textContent = `${completed} of ${activeExercise.sessionLength}`;
  progressFill.style.width = `${(completed / activeExercise.sessionLength) * 100}%`;
  progressTrack.setAttribute("aria-valuenow", String(completed));
}

function renderHistory(): void {
  const history = loadHistory(localStorage, historyStorageKey(activeExercise.id));
  if (history.length === 0) {
    summaryHistory.innerHTML = `<p class="history-empty">No past sessions yet.</p>`;
    return;
  }

  const rows = history
    .map(entry => {
      const date = new Date(entry.timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
      return `<li class="history-row">
        <span class="history-date">${date}</span>
        <span class="history-accuracy">${entry.accuracyPct}%</span>
        <span class="history-interval">${entry.lowestPresentationMs}<span class="unit">ms</span></span>
      </li>`;
    })
    .join("");
  summaryHistory.innerHTML = `
    <p class="eyebrow">Recent sessions</p>
    <ul class="history-list">${rows}</ul>
  `;
}

function renderSummary(): void {
  renderReadoutCells(summaryReadouts, activeExercise.summaryCells(state));
  renderHistory();
}

function renderPicker(): void {
  exerciseCards.innerHTML = exercises
    .map(exercise => {
      const exerciseState = exercise.id === activeExercise.id ? state : loadExerciseState(exercise);
      const active = exercise.id === activeExercise.id;
      return `<button type="button" class="exercise-card${active ? " active" : ""}" data-exercise-id="${exercise.id}" aria-pressed="${active}">
        <span class="eyebrow">Exercise No.&nbsp;${String(exercise.number).padStart(2, "0")}</span>
        <span class="exercise-card-name">${exercise.name}</span>
        <span class="exercise-card-summary">${exercise.pickerSummary(exerciseState)}</span>
      </button>`;
    })
    .join("");
}

function setPhase(next: Phase): void {
  phase = next;
  const paused = phase === "paused";
  const complete = phase === "complete";
  const canAnswer = phase === "responding";

  answerControls.disabled = !canAnswer;
  pause.textContent = paused ? "Resume" : "Pause";
  pause.disabled = complete;
  replay.disabled = !(phase === "responding" && trial !== null);
  start.disabled = !["ready", "complete"].includes(phase);
  response.hidden = complete;
  summaryPanel.hidden = !complete;
  field.classList.toggle("field--idle", phase === "ready" && activeExercise.attempts(state) === 0);

  if (complete) {
    start.textContent = "Start new session";
    fieldMessage.textContent = "Session complete";
    renderSummary();
  } else if (phase === "ready") {
    start.textContent = activeExercise.attempts(state) === 0 ? "Start trial" : "Next trial";
    fieldMessage.textContent = "Ready";
  } else if (phase === "preparing") {
    fieldMessage.textContent = "Focus on +";
  } else if (phase === "showing") {
    fieldMessage.textContent = "";
  } else if (phase === "responding") {
    fieldMessage.textContent = "Choose both answers";
  } else if (phase === "paused") {
    fieldMessage.textContent = "Paused";
  }
}

function hideStimuli(): void {
  activeExercise.hideTrial();
}

function presentTrial(activeTrial: unknown): void {
  clearTimers();
  hideStimuli();
  activeExercise.clearMissMarks();
  setPhase("preparing");

  schedule(() => {
    if (phase !== "preparing") return;
    setPhase("showing");
    activeExercise.showTrial(activeTrial);

    schedule(() => {
      if (phase !== "showing") return;
      hideStimuli();
      response.reset();
      setPhase("responding");
      activeExercise.beginResponse?.(activeTrial);
      response.querySelector<HTMLInputElement>("input")?.focus();
    }, activeExercise.flashDurationMs(activeTrial));
  }, 650);
}

function beginTrial(): void {
  if (phase === "complete") {
    state = activeExercise.initialState;
    trial = null;
    feedback.textContent = "";
    saveExerciseState(activeExercise, state);
    updateStats();
    setPhase("ready");
  }

  if (phase !== "ready") return;
  feedback.textContent = "";
  delete feedback.dataset.result;
  trial = activeExercise.createTrial(state);
  presentTrial(trial);
}

function replayTrial(): void {
  if (phase !== "responding" || !trial) return;
  feedback.textContent = "Replaying the same flash. This does not count as another attempt.";
  presentTrial(trial);
}

function pauseOrResume(): void {
  if (phase === "complete") return;

  if (phase === "paused") {
    feedback.textContent = "Resumed. Start the trial again when ready.";
    setPhase("ready");
    return;
  }

  const interruptedFlash = phase === "showing" || phase === "preparing";
  clearTimers();
  hideStimuli();
  response.reset();
  feedback.textContent = interruptedFlash
    ? "Paused during the flash. That trial was discarded; restart it when ready."
    : "Progress saved. Resume when ready.";
  trial = null;
  saveExerciseState(activeExercise, state);
  setPhase("paused");
}

function selectExercise(exercise: Exercise): void {
  if (exercise.id === activeExercise.id && state !== null) {
    renderPicker();
    return;
  }

  clearTimers();
  activeExercise = exercise;
  state = loadExerciseState(exercise);
  trial = null;

  exerciseEyebrow.textContent = `Exercise No. ${String(exercise.number).padStart(2, "0")}`;
  gameHeading.textContent = exercise.name;
  instructions.innerHTML = exercise.instructions;
  progressTrack.setAttribute("aria-valuemax", String(exercise.sessionLength));

  fieldContent.innerHTML = "";
  answerControls.innerHTML = "";
  exercise.mount(fieldContent, answerControls);

  feedback.textContent = "";
  delete feedback.dataset.result;
  response.reset();

  updateStats();
  renderPicker();
  setPhase(exercise.isSessionComplete(state) ? "complete" : "ready");
}

start.addEventListener("click", beginTrial);
replay.addEventListener("click", replayTrial);
pause.addEventListener("click", pauseOrResume);

exerciseCards.addEventListener("click", event => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("[data-exercise-id]");
  if (!button) return;
  const exercise = exercises.find(candidate => candidate.id === button.dataset.exerciseId);
  if (exercise) selectExercise(exercise);
});

response.addEventListener("submit", event => {
  event.preventDefault();
  if (phase !== "responding" || !trial) return;

  const answer = activeExercise.readAnswer(response);
  if (answer === null) {
    feedback.textContent = "Choose both answers.";
    return;
  }

  const correct = activeExercise.isCorrect(trial, answer);
  state = activeExercise.score(state, trial, answer);

  if (correct) {
    feedback.textContent = activeExercise.feedback(trial, true);
    feedback.dataset.result = "correct";
  } else {
    feedback.textContent = activeExercise.feedback(trial, false);
    feedback.dataset.result = "incorrect";
    activeExercise.onMiss(trial);
  }

  trial = null;
  saveExerciseState(activeExercise, state);
  updateStats();

  const sessionJustCompleted = activeExercise.isSessionComplete(state);
  if (sessionJustCompleted) {
    const entry = activeExercise.historyEntry(state);
    if (entry) {
      recordSession({ timestamp: Date.now(), ...entry }, localStorage, historyStorageKey(activeExercise.id));
    }
  }
  setPhase(sessionJustCompleted ? "complete" : "ready");
  start.focus();
});

reset.addEventListener("click", () => {
  clearTimers();
  localStorage.removeItem(progressStorageKey(activeExercise.id));
  state = activeExercise.initialState;
  trial = null;
  hideStimuli();
  activeExercise.clearMissMarks();
  response.reset();
  feedback.textContent = "Progress reset.";
  delete feedback.dataset.result;
  updateStats();
  renderPicker();
  setPhase("ready");
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && ["preparing", "showing"].includes(phase)) {
    clearTimers();
    hideStimuli();
    trial = null;
    feedback.textContent = "The flash was interrupted, so that trial was discarded.";
    saveExerciseState(activeExercise, state);
    setPhase("ready");
  } else if (document.hidden) {
    saveExerciseState(activeExercise, state);
  }
});

window.addEventListener("beforeunload", () => saveExerciseState(activeExercise, state));

selectExercise(exercises[0] as Exercise);
