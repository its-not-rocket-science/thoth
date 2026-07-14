import "./styles.css";
import { createTrial, INITIAL_STATE, scoreTrial } from "./game";
import type { CentralSymbol, PeripheralPosition, SessionState, Trial } from "./types";

const STORAGE_KEY = "thoth-progress-v1";
const SESSION_LENGTH = 20;

type Phase = "ready" | "preparing" | "showing" | "responding" | "paused" | "complete";

interface SavedProgress {
  state: SessionState;
  bestPresentationMs: number | null;
}

const app = document.querySelector<HTMLDivElement>("#app");
if (!app) throw new Error("Application root not found.");

app.innerHTML = `
  <main class="shell">
    <header class="masthead">
      <div class="brand-mark" aria-hidden="true">𓅝</div>
      <div>
        <p class="eyebrow">Experimental attention game</p>
        <h1>Thoth</h1>
        <p class="tagline">A game for the edges of your attention.</p>
      </div>
    </header>

    <aside class="notice"><strong>Research prototype:</strong> not a medical device and not shown to prevent or treat dementia.</aside>

    <section class="game-card" aria-labelledby="game-heading">
      <div class="heading-row">
        <div>
          <p class="eyebrow">Prototype exercise</p>
          <h2 id="game-heading">Centre and edge</h2>
        </div>
        <div class="session-label"><strong id="progress-text">0 of ${SESSION_LENGTH}</strong> trials completed</div>
      </div>

      <div class="progress-track" role="progressbar" aria-label="Session progress" aria-valuemin="0" aria-valuemax="${SESSION_LENGTH}" aria-valuenow="0">
        <div id="progress-fill" class="progress-fill"></div>
      </div>

      <p class="instructions">
        Keep your eyes on the centre. A <strong>circle or diamond</strong> will appear there
        while an ibis appears at one of eight positions around it. After they vanish, choose both answers.
      </p>

      <div class="stats" aria-live="polite">
        <span><strong id="score">0</strong> correct</span>
        <span><strong id="accuracy">—</strong> accuracy</span>
        <span><strong id="speed">850</strong> ms</span>
        <span>best <strong id="best">—</strong></span>
      </div>

      <div class="game-layout">
        <div class="field-column">
          <div id="field" class="field" aria-label="Visual stimulus field">
            <div class="fixation" aria-hidden="true">+</div>
            <div id="central" class="central" hidden></div>
            <div id="peripheral" class="peripheral" hidden aria-hidden="true">𓅝</div>
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
          <fieldset id="answer-controls" disabled>
            <legend>What did you see?</legend>

            <p class="question">Centre shape</p>
            <div class="choices">
              <label><input type="radio" name="central" value="circle" required><span class="mini circle"></span>Circle</label>
              <label><input type="radio" name="central" value="diamond" required><span class="mini diamond"></span>Diamond</label>
            </div>

            <p class="question">Ibis position</p>
            <div class="position-grid">
              ${[7,0,1,6,null,2,5,4,3].map(value =>
                value === null
                  ? '<span class="grid-centre">+</span>'
                  : `<label><input type="radio" name="position" value="${value}" required><span>${value + 1}</span></label>`
              ).join("")}
            </div>

            <button class="primary submit-answer" type="submit">Submit answer</button>
          </fieldset>
        </form>
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

const field = find<HTMLDivElement>("#field");
const central = find<HTMLDivElement>("#central");
const peripheral = find<HTMLDivElement>("#peripheral");
const fieldMessage = find<HTMLDivElement>("#field-message");
const response = find<HTMLFormElement>("#response");
const answerControls = find<HTMLFieldSetElement>("#answer-controls");
const start = find<HTMLButtonElement>("#start");
const replay = find<HTMLButtonElement>("#replay");
const pause = find<HTMLButtonElement>("#pause");
const reset = find<HTMLButtonElement>("#reset");
const feedback = find<HTMLParagraphElement>("#feedback");
const score = find<HTMLElement>("#score");
const accuracy = find<HTMLElement>("#accuracy");
const speed = find<HTMLElement>("#speed");
const best = find<HTMLElement>("#best");
const progressText = find<HTMLElement>("#progress-text");
const progressTrack = find<HTMLDivElement>(".progress-track");
const progressFill = find<HTMLDivElement>("#progress-fill");

let state: SessionState = { ...INITIAL_STATE };
let bestPresentationMs: number | null = null;
let trial: Trial | null = null;
let phase: Phase = "ready";
let timers: number[] = [];

function validState(candidate: unknown): candidate is SessionState {
  if (!candidate || typeof candidate !== "object") return false;
  const value = candidate as Partial<SessionState>;
  return [value.score, value.attempts, value.streak, value.presentationMs]
    .every(item => typeof item === "number" && Number.isFinite(item));
}

function loadProgress(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<SavedProgress>;
    if (validState(saved.state)) {
      state = {
        score: Math.max(0, saved.state.score),
        attempts: Math.min(SESSION_LENGTH, Math.max(0, saved.state.attempts)),
        streak: Math.max(0, saved.state.streak),
        presentationMs: Math.max(120, Math.min(1500, saved.state.presentationMs)),
      };
    }
    if (typeof saved.bestPresentationMs === "number" && Number.isFinite(saved.bestPresentationMs)) {
      bestPresentationMs = saved.bestPresentationMs;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function saveProgress(): void {
  const saved: SavedProgress = { state, bestPresentationMs };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(saved));
}

function clearTimers(): void {
  timers.forEach(timer => window.clearTimeout(timer));
  timers = [];
}

function schedule(callback: () => void, delay: number): void {
  timers.push(window.setTimeout(callback, delay));
}

function updateStats(): void {
  score.textContent = String(state.score);
  accuracy.textContent = state.attempts === 0
    ? "—"
    : `${Math.round((state.score / state.attempts) * 100)}%`;
  speed.textContent = String(state.presentationMs);
  best.textContent = bestPresentationMs === null ? "—" : `${bestPresentationMs} ms`;

  const completed = Math.min(state.attempts, SESSION_LENGTH);
  progressText.textContent = `${completed} of ${SESSION_LENGTH}`;
  progressFill.style.width = `${(completed / SESSION_LENGTH) * 100}%`;
  progressTrack.setAttribute("aria-valuenow", String(completed));
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

  if (complete) {
    start.textContent = "Start new session";
    fieldMessage.textContent = "Session complete";
  } else if (phase === "ready") {
    start.textContent = state.attempts === 0 ? "Start trial" : "Next trial";
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

function positionPeripheral(position: PeripheralPosition): void {
  const angle = (position * 45 - 90) * Math.PI / 180;
  const radius = Math.min(field.clientWidth, field.clientHeight) * 0.34;
  const x = Math.cos(angle) * radius;
  const y = Math.sin(angle) * radius;
  peripheral.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
}

function hideStimuli(): void {
  central.hidden = true;
  peripheral.hidden = true;
}

function showTrial(activeTrial: Trial): void {
  central.className = `central ${activeTrial.centralSymbol}`;
  positionPeripheral(activeTrial.peripheralPosition);
  central.hidden = false;
  peripheral.hidden = false;
}

function presentTrial(activeTrial: Trial): void {
  clearTimers();
  hideStimuli();
  setPhase("preparing");

  schedule(() => {
    if (phase !== "preparing") return;
    setPhase("showing");
    showTrial(activeTrial);

    schedule(() => {
      if (phase !== "showing") return;
      hideStimuli();
      response.reset();
      setPhase("responding");
      response.querySelector<HTMLInputElement>("input")?.focus();
    }, activeTrial.presentationMs);
  }, 650);
}

function beginTrial(): void {
  if (phase === "complete") {
    state = { ...INITIAL_STATE };
    trial = null;
    feedback.textContent = "";
    saveProgress();
    updateStats();
    setPhase("ready");
  }

  if (phase !== "ready") return;
  feedback.textContent = "";
  delete feedback.dataset.result;
  trial = createTrial(state.presentationMs);
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
  saveProgress();
  setPhase("paused");
}

start.addEventListener("click", beginTrial);
replay.addEventListener("click", replayTrial);
pause.addEventListener("click", pauseOrResume);

response.addEventListener("submit", event => {
  event.preventDefault();
  if (phase !== "responding" || !trial) return;

  const data = new FormData(response);
  const centralAnswer = data.get("central") as CentralSymbol | null;
  const positionRaw = data.get("position");
  if (!centralAnswer || typeof positionRaw !== "string") {
    feedback.textContent = "Choose both answers.";
    return;
  }

  const positionAnswer = Number.parseInt(positionRaw, 10) as PeripheralPosition;
  const correct =
    centralAnswer === trial.centralSymbol &&
    positionAnswer === trial.peripheralPosition;

  state = scoreTrial(state, trial, {
    centralSymbol: centralAnswer,
    peripheralPosition: positionAnswer,
  });

  if (correct) {
    feedback.textContent = "Correct.";
    feedback.dataset.result = "correct";
    if (bestPresentationMs === null || state.presentationMs < bestPresentationMs) {
      bestPresentationMs = state.presentationMs;
    }
  } else {
    feedback.textContent = `Not quite. It was a ${trial.centralSymbol}, at position ${trial.peripheralPosition + 1}.`;
    feedback.dataset.result = "incorrect";
  }

  trial = null;
  saveProgress();
  updateStats();
  setPhase(state.attempts >= SESSION_LENGTH ? "complete" : "ready");
  start.focus();
});

reset.addEventListener("click", () => {
  clearTimers();
  localStorage.removeItem(STORAGE_KEY);
  state = { ...INITIAL_STATE };
  bestPresentationMs = null;
  trial = null;
  hideStimuli();
  response.reset();
  feedback.textContent = "Progress reset.";
  delete feedback.dataset.result;
  updateStats();
  setPhase("ready");
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && ["preparing", "showing"].includes(phase)) {
    clearTimers();
    hideStimuli();
    trial = null;
    feedback.textContent = "The flash was interrupted, so that trial was discarded.";
    saveProgress();
    setPhase("ready");
  } else if (document.hidden) {
    saveProgress();
  }
});

window.addEventListener("beforeunload", saveProgress);

loadProgress();
updateStats();
setPhase(state.attempts >= SESSION_LENGTH ? "complete" : "ready");
