import "./styles.css";
import { createTrial, INITIAL_STATE, scoreTrial } from "./game";
import type { CentralSymbol, PeripheralPosition, SessionState, Trial } from "./types";

const STORAGE_KEY = "thoth-best-presentation-ms";
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
        <div><p class="eyebrow">Prototype exercise</p><h2 id="game-heading">Centre and edge</h2></div>
        <button id="reset" class="quiet" type="button">Reset progress</button>
      </div>

      <p class="instructions">
        Keep your eyes on the centre. A <strong>circle or diamond</strong> will appear there
        while an ibis appears at one of eight positions around it. After they vanish, choose both answers.
      </p>

      <div class="stats" aria-live="polite">
        <span><strong id="score">0</strong> correct</span>
        <span><strong id="attempts">0</strong> attempts</span>
        <span><strong id="speed">850</strong> ms</span>
        <span>best <strong id="best">—</strong></span>
      </div>

      <div id="field" class="field" aria-label="Visual stimulus field">
        <div class="fixation" aria-hidden="true">+</div>
        <div id="central" class="central" hidden></div>
        <div id="peripheral" class="peripheral" hidden aria-hidden="true">𓅝</div>
      </div>

      <div id="start-panel" class="panel">
        <button id="start" class="primary" type="button">Start trial</button>
      </div>

      <form id="response" class="panel" hidden>
        <fieldset>
          <legend>What appeared in the centre?</legend>
          <div class="choices">
            <label><input type="radio" name="central" value="circle" required><span class="mini circle"></span>Circle</label>
            <label><input type="radio" name="central" value="diamond" required><span class="mini diamond"></span>Diamond</label>
          </div>
        </fieldset>

        <fieldset>
          <legend>Where did the ibis appear?</legend>
          <div class="position-grid">
            ${[7,0,1,6,null,2,5,4,3].map(value =>
              value === null
                ? '<span class="grid-centre">+</span>'
                : `<label><input type="radio" name="position" value="${value}" required><span>${value + 1}</span></label>`
            ).join("")}
          </div>
        </fieldset>

        <button class="primary" type="submit">Submit answer</button>
      </form>

      <p id="feedback" class="feedback" aria-live="assertive"></p>
    </section>

    <footer>All results stay in this browser. No analytics or account required.</footer>
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
const startPanel = find<HTMLDivElement>("#start-panel");
const response = find<HTMLFormElement>("#response");
const start = find<HTMLButtonElement>("#start");
const reset = find<HTMLButtonElement>("#reset");
const feedback = find<HTMLParagraphElement>("#feedback");
const score = find<HTMLElement>("#score");
const attempts = find<HTMLElement>("#attempts");
const speed = find<HTMLElement>("#speed");
const best = find<HTMLElement>("#best");

let state: SessionState = { ...INITIAL_STATE };
let trial: Trial | null = null;
let running = false;

function storedBest(): number | null {
  const raw = localStorage.getItem(STORAGE_KEY);
  const value = raw ? Number.parseInt(raw, 10) : Number.NaN;
  return Number.isFinite(value) ? value : null;
}

function updateStats(): void {
  score.textContent = String(state.score);
  attempts.textContent = String(state.attempts);
  speed.textContent = String(state.presentationMs);
  const value = storedBest();
  best.textContent = value === null ? "—" : `${value} ms`;
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

function beginTrial(): void {
  if (running) return;
  running = true;
  feedback.textContent = "";
  response.hidden = true;
  startPanel.hidden = true;
  trial = createTrial(state.presentationMs);

  window.setTimeout(() => {
    if (!trial) return;
    central.className = `central ${trial.centralSymbol}`;
    positionPeripheral(trial.peripheralPosition);
    central.hidden = false;
    peripheral.hidden = false;

    window.setTimeout(() => {
      hideStimuli();
      running = false;
      response.reset();
      response.hidden = false;
      response.querySelector<HTMLInputElement>("input")?.focus();
    }, trial.presentationMs);
  }, 650);
}

start.addEventListener("click", beginTrial);

response.addEventListener("submit", event => {
  event.preventDefault();
  if (!trial) return;

  const data = new FormData(response);
  const centralAnswer = data.get("central") as CentralSymbol | null;
  const positionRaw = data.get("position");
  if (!centralAnswer || typeof positionRaw !== "string") return;

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
    const previous = storedBest();
    if (previous === null || state.presentationMs < previous) {
      localStorage.setItem(STORAGE_KEY, String(state.presentationMs));
    }
  } else {
    feedback.textContent = `Not quite. It was a ${trial.centralSymbol}, at position ${trial.peripheralPosition + 1}.`;
    feedback.dataset.result = "incorrect";
  }

  trial = null;
  updateStats();
  response.hidden = true;
  startPanel.hidden = false;
  start.textContent = "Next trial";
  start.focus();
});

reset.addEventListener("click", () => {
  localStorage.removeItem(STORAGE_KEY);
  state = { ...INITIAL_STATE };
  trial = null;
  hideStimuli();
  response.hidden = true;
  startPanel.hidden = false;
  start.textContent = "Start trial";
  feedback.textContent = "Progress reset.";
  delete feedback.dataset.result;
  updateStats();
});

document.addEventListener("visibilitychange", () => {
  if (document.hidden && running) window.location.reload();
});

updateStats();
