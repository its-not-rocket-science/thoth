import "./styles.css";
import { createTrial, INITIAL_STATE, scoreTrial, summarizeSession } from "./game";
import { loadHistory, recordSession } from "./history";
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

// A traced ibis silhouette (potrace, from a reference image) rendered as an
// inline SVG rather than the Unicode ibis glyph (U+1315D, Egyptian
// Hieroglyphs) it replaces — that block has essentially no real-world font
// coverage and rendered as invisible for most users. fill="currentColor"
// lets it inherit .peripheral's phosphor glow and .distractor's dimmed
// style, same approach as the header's brand-mark icon.
const IBIS_SVG = `<svg viewBox="0 0 800 800" aria-hidden="true" focusable="false">
  <g transform="translate(0,800) scale(0.1,-0.1)" fill="currentColor">
    <path d="M5162 7505 c-29 -8 -67 -22 -84 -31 -45 -23 -122 -99 -158 -154 -95 -149 -125 -414 -69 -627 29 -110 71 -214 196 -488 114 -248 188 -435 199 -502 14 -91 -49 -190 -149 -233 -50 -22 -58 -22 -197 -14 -246 15 -678 10 -815 -10 -558 -80 -991 -268 -1580 -684 -593 -418 -580 -410 -682 -448 -221 -81 -416 -198 -591 -354 -332 -295 -545 -713 -481 -943 15 -56 70 -112 124 -127 61 -17 184 -8 265 19 106 36 277 125 415 216 l129 86 105 -25 c202 -47 244 -51 516 -50 248 1 274 3 559 42 165 23 305 42 311 42 7 0 33 -47 60 -105 102 -224 194 -329 307 -350 99 -19 236 137 323 369 l22 59 96 43 c366 162 702 460 1148 1019 139 174 437 568 496 655 78 114 128 214 167 330 45 137 60 244 53 389 -8 172 -30 237 -237 711 -137 313 -148 351 -109 386 26 24 145 31 233 15 33 -6 61 -9 63 -7 7 7 103 366 103 384 -1 26 -60 137 -100 186 -43 53 -118 111 -186 142 -129 60 -347 89 -452 59z M6096 6973 c-14 -48 -86 -322 -86 -327 0 -3 6 -6 13 -6 22 0 131 -56 202 -105 256 -176 555 -510 945 -1057 46 -65 85 -116 87 -114 7 7 -29 163 -60 256 -35 108 -143 329 -213 440 -200 316 -505 643 -821 883 -52 40 -62 44 -67 30z M2975 2901 c-26 -5 -36 -18 -72 -91 -23 -47 -64 -141 -92 -210 -109 -276 -126 -377 -118 -740 5 -252 24 -483 62 -759 8 -58 15 -108 15 -112 0 -3 -26 -17 -57 -30 -104 -40 -373 -182 -373 -195 0 -2 34 -56 75 -119 l74 -115 93 49 c120 64 199 84 303 79 105 -5 191 -44 271 -122 l57 -55 59 40 c85 58 190 106 288 130 72 18 103 21 220 16 160 -6 271 -32 534 -127 93 -33 170 -59 171 -58 6 9 85 241 85 252 0 11 -335 120 -520 170 -63 17 -199 42 -282 51 -41 5 -59 11 -62 23 -31 101 -123 592 -147 785 -21 175 -1 493 47 723 l6 31 -75 6 c-45 3 -100 15 -138 31 -35 14 -64 24 -65 23 -8 -8 -55 -356 -64 -467 -18 -242 19 -544 126 -1029 18 -84 32 -157 29 -160 -2 -4 -36 -20 -74 -35 l-71 -28 -60 40 c-33 23 -84 52 -113 66 l-53 25 -22 163 c-45 335 -55 477 -56 758 -1 251 1 282 21 360 22 87 87 261 142 383 l30 68 -34 44 c-19 25 -47 68 -62 95 -29 52 -35 55 -98 41z"/>
  </g>
</svg>`;

// The answer dial mirrors the stimulus field's own geometry exactly, so the
// control a player uses to answer looks like the instrument that produced
// the stimulus. Position 0 sits at 12 o'clock; positions advance clockwise,
// matching positionPeripheral() below.
const DIAL_RADIUS_PCT = 41;
const dialPoints = ([0, 1, 2, 3, 4, 5, 6, 7] as const)
  .map(value => {
    const angle = ((value * 45 - 90) * Math.PI) / 180;
    const x = 50 + DIAL_RADIUS_PCT * Math.cos(angle);
    const y = 50 + DIAL_RADIUS_PCT * Math.sin(angle);
    return `<label class="dial-point" style="left:${x.toFixed(2)}%; top:${y.toFixed(2)}%;">
      <input type="radio" name="position" value="${value}" required>
      <span>${value + 1}</span>
    </label>`;
  })
  .join("");

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

    <section class="game-card" aria-labelledby="game-heading" aria-describedby="vision-note">
      <div class="heading-row">
        <div>
          <p class="eyebrow">Exercise No.&nbsp;01</p>
          <h2 id="game-heading">Centre and edge</h2>
        </div>
        <div class="session-label"><strong id="progress-text">0 of ${SESSION_LENGTH}</strong> trials completed</div>
      </div>

      <p id="vision-note" class="vision-note">This is a timed visual exercise and requires sight to play; it is not screen-reader navigable.</p>

      <div class="progress-track" role="progressbar" aria-label="Session progress" aria-valuemin="0" aria-valuemax="${SESSION_LENGTH}" aria-valuenow="0">
        <div id="progress-fill" class="progress-fill"></div>
      </div>

      <p class="instructions">
        Keep your eyes on the centre. A <strong>circle or diamond</strong> will appear there
        while an ibis appears at one of eight positions around it, sometimes alongside a few
        dimmer decoy glyphs elsewhere. After they vanish, choose the shape and the ibis's position.
      </p>

      <dl class="readouts" aria-live="polite">
        <div class="readout"><dt>Correct</dt><dd id="score">0</dd></div>
        <div class="readout"><dt>Accuracy</dt><dd id="accuracy">—</dd></div>
        <div class="readout"><dt>Interval</dt><dd id="speed">850<span class="unit">ms</span></dd></div>
        <div class="readout"><dt>Best</dt><dd id="best">—</dd></div>
      </dl>

      <div id="game-layout" class="game-layout">
        <div class="field-column">
          <div id="field" class="field" role="group" aria-label="Visual stimulus field">
            <div class="fixation" aria-hidden="true">+</div>
            <div id="central" class="central" hidden></div>
            <div id="peripheral" class="peripheral" hidden aria-hidden="true">${IBIS_SVG}</div>
            <div id="distractors" class="distractors" aria-hidden="true"></div>
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
            <div class="position-dial" aria-hidden="false">
              <span class="dial-centre" aria-hidden="true">+</span>
              ${dialPoints}
            </div>

            <button class="primary submit-answer" type="submit">Submit answer</button>
          </fieldset>
        </form>

        <section id="summary" class="summary-panel" hidden aria-labelledby="summary-heading">
          <p class="eyebrow" id="summary-heading">Session complete</p>
          <dl class="readouts">
            <div class="readout"><dt>Score</dt><dd id="summary-score">0 / ${SESSION_LENGTH}</dd></div>
            <div class="readout"><dt>Accuracy</dt><dd id="summary-accuracy">—</dd></div>
            <div class="readout"><dt>Lowest interval</dt><dd id="summary-lowest">—</dd></div>
            <div class="readout"><dt>Correct / incorrect</dt><dd id="summary-counts">0 / 0</dd></div>
          </dl>
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

const summaryPanel = find<HTMLElement>("#summary");
const summaryScore = find<HTMLElement>("#summary-score");
const summaryAccuracy = find<HTMLElement>("#summary-accuracy");
const summaryLowest = find<HTMLElement>("#summary-lowest");
const summaryCounts = find<HTMLElement>("#summary-counts");
const summaryHistory = find<HTMLDivElement>("#summary-history");
const field = find<HTMLDivElement>("#field");
const central = find<HTMLDivElement>("#central");
const peripheral = find<HTMLDivElement>("#peripheral");
const distractors = find<HTMLDivElement>("#distractors");
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
let sessionLowestMs: number = INITIAL_STATE.presentationMs;
let trial: Trial | null = null;
let phase: Phase = "ready";
let timers: number[] = [];

function validState(candidate: unknown): candidate is SessionState {
  if (!candidate || typeof candidate !== "object") return false;
  const value = candidate as Partial<SessionState>;
  return [value.score, value.attempts, value.presentationMs]
    .every(item => typeof item === "number" && Number.isFinite(item));
}

/** Reads a field the schema may not have had yet, falling back rather than
 *  invalidating the whole save when an older version's save is loaded. */
function numberOr(value: unknown, fallback: number): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}

function loadProgress(): void {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return;
    const saved = JSON.parse(raw) as Partial<SavedProgress>;
    if (validState(saved.state)) {
      const savedState = saved.state as Partial<SessionState>;
      state = {
        score: Math.max(0, saved.state.score),
        attempts: Math.min(SESSION_LENGTH, Math.max(0, saved.state.attempts)),
        presentationMs: Math.max(120, Math.min(1500, saved.state.presentationMs)),
        presentationStreak: Math.max(0, numberOr(savedState.presentationStreak, 0)),
        distractorCount: Math.max(0, numberOr(savedState.distractorCount, INITIAL_STATE.distractorCount)),
        distractorStreak: Math.max(0, numberOr(savedState.distractorStreak, 0)),
      };
      // The true in-session low can predate a reload and isn't persisted;
      // the resumed presentationMs is the best available floor for it.
      sessionLowestMs = state.presentationMs;
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

function renderHistory(): void {
  const history = loadHistory(localStorage);
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
  const summary = summarizeSession(state, sessionLowestMs);
  summaryScore.textContent = `${summary.score} / ${SESSION_LENGTH}`;
  summaryAccuracy.textContent = `${summary.accuracyPct}%`;
  summaryLowest.textContent = `${summary.lowestPresentationMs} ms`;
  summaryCounts.textContent = `${summary.correct} / ${summary.incorrect}`;
  renderHistory();
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
  field.classList.toggle("field--idle", phase === "ready" && state.attempts === 0);

  if (complete) {
    start.textContent = "Start new session";
    fieldMessage.textContent = "Session complete";
    renderSummary();
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

function fieldOffset(position: PeripheralPosition): { x: number; y: number } {
  const angle = (position * 45 - 90) * Math.PI / 180;
  const radius = Math.min(field.clientWidth, field.clientHeight) * 0.34;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

function positionPeripheral(position: PeripheralPosition): void {
  const { x, y } = fieldOffset(position);
  peripheral.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
}

function renderDistractors(positions: PeripheralPosition[]): void {
  distractors.innerHTML = positions
    .map(position => {
      const { x, y } = fieldOffset(position);
      return `<span class="distractor" style="transform: translate(calc(-50% + ${x}px), calc(-50% + ${y}px));">${IBIS_SVG}</span>`;
    })
    .join("");
}

function hideStimuli(): void {
  central.hidden = true;
  peripheral.hidden = true;
  distractors.innerHTML = "";
}

function clearDialFeedback(): void {
  document.querySelectorAll(".dial-point.correct-answer").forEach(el => el.classList.remove("correct-answer"));
}

function markCorrectPosition(position: PeripheralPosition): void {
  const point = document
    .querySelector<HTMLInputElement>(`.dial-point input[value="${position}"]`)
    ?.closest<HTMLElement>(".dial-point");
  point?.classList.add("correct-answer");
}

function showTrial(activeTrial: Trial): void {
  central.className = `central ${activeTrial.centralSymbol}`;
  positionPeripheral(activeTrial.peripheralPosition);
  renderDistractors(activeTrial.distractorPositions);
  central.hidden = false;
  peripheral.hidden = false;
}

function presentTrial(activeTrial: Trial): void {
  clearTimers();
  hideStimuli();
  clearDialFeedback();
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
    sessionLowestMs = INITIAL_STATE.presentationMs;
    trial = null;
    feedback.textContent = "";
    saveProgress();
    updateStats();
    setPhase("ready");
  }

  if (phase !== "ready") return;
  feedback.textContent = "";
  delete feedback.dataset.result;
  trial = createTrial(state.presentationMs, state.distractorCount);
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
  sessionLowestMs = Math.min(sessionLowestMs, state.presentationMs);

  if (correct) {
    feedback.textContent = "Correct.";
    feedback.dataset.result = "correct";
    if (bestPresentationMs === null || state.presentationMs < bestPresentationMs) {
      bestPresentationMs = state.presentationMs;
    }
  } else {
    feedback.textContent = `Not quite. It was a ${trial.centralSymbol}, at position ${trial.peripheralPosition + 1}.`;
    feedback.dataset.result = "incorrect";
    markCorrectPosition(trial.peripheralPosition);
  }

  trial = null;
  saveProgress();
  updateStats();

  const sessionJustCompleted = state.attempts >= SESSION_LENGTH;
  if (sessionJustCompleted) {
    const summary = summarizeSession(state, sessionLowestMs);
    recordSession(
      {
        timestamp: Date.now(),
        score: summary.score,
        accuracyPct: summary.accuracyPct,
        lowestPresentationMs: summary.lowestPresentationMs,
      },
      localStorage,
    );
  }
  setPhase(sessionJustCompleted ? "complete" : "ready");
  start.focus();
});

reset.addEventListener("click", () => {
  clearTimers();
  localStorage.removeItem(STORAGE_KEY);
  state = { ...INITIAL_STATE };
  bestPresentationMs = null;
  sessionLowestMs = INITIAL_STATE.presentationMs;
  trial = null;
  hideStimuli();
  clearDialFeedback();
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
