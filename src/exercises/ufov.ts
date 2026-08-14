import { createTrial, INITIAL_STATE, scoreTrial, summarizeSession } from "../game";
import type { Exercise, ReadoutCell } from "../exercise";
import type { CentralSymbol, PeripheralPosition, SessionState, Trial } from "../types";

export interface UfovState {
  session: SessionState;
  bestPresentationMs: number | null;
  /** Lowest presentationMs reached this session; the staircase can move it
   *  back up after a miss, so SessionState alone can't answer "how low did
   *  we get". Reset each fresh session. */
  sessionLowestMs: number;
}

interface Answer {
  centralSymbol: CentralSymbol;
  peripheralPosition: PeripheralPosition;
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

function numberOr(value: unknown, fallback: number): number {
  return isFiniteNumber(value) ? value : fallback;
}

// A traced ibis silhouette (potrace, from a reference image) rendered as an
// inline SVG rather than the Unicode ibis glyph (U+1315D, Egyptian
// Hieroglyphs) — that block has essentially no real-world font coverage and
// renders as invisible for most users. fill="currentColor" lets it inherit
// .peripheral's phosphor glow and .distractor's dimmed style, same approach
// as the header's brand-mark icon.
const IBIS_SVG = `<svg viewBox="0 0 800 800" aria-hidden="true" focusable="false">
  <g transform="translate(0,800) scale(0.1,-0.1)" fill="currentColor">
    <path d="M5162 7505 c-29 -8 -67 -22 -84 -31 -45 -23 -122 -99 -158 -154 -95 -149 -125 -414 -69 -627 29 -110 71 -214 196 -488 114 -248 188 -435 199 -502 14 -91 -49 -190 -149 -233 -50 -22 -58 -22 -197 -14 -246 15 -678 10 -815 -10 -558 -80 -991 -268 -1580 -684 -593 -418 -580 -410 -682 -448 -221 -81 -416 -198 -591 -354 -332 -295 -545 -713 -481 -943 15 -56 70 -112 124 -127 61 -17 184 -8 265 19 106 36 277 125 415 216 l129 86 105 -25 c202 -47 244 -51 516 -50 248 1 274 3 559 42 165 23 305 42 311 42 7 0 33 -47 60 -105 102 -224 194 -329 307 -350 99 -19 236 137 323 369 l22 59 96 43 c366 162 702 460 1148 1019 139 174 437 568 496 655 78 114 128 214 167 330 45 137 60 244 53 389 -8 172 -30 237 -237 711 -137 313 -148 351 -109 386 26 24 145 31 233 15 33 -6 61 -9 63 -7 7 7 103 366 103 384 -1 26 -60 137 -100 186 -43 53 -118 111 -186 142 -129 60 -347 89 -452 59z M6096 6973 c-14 -48 -86 -322 -86 -327 0 -3 6 -6 13 -6 22 0 131 -56 202 -105 256 -176 555 -510 945 -1057 46 -65 85 -116 87 -114 7 7 -29 163 -60 256 -35 108 -143 329 -213 440 -200 316 -505 643 -821 883 -52 40 -62 44 -67 30z M2975 2901 c-26 -5 -36 -18 -72 -91 -23 -47 -64 -141 -92 -210 -109 -276 -126 -377 -118 -740 5 -252 24 -483 62 -759 8 -58 15 -108 15 -112 0 -3 -26 -17 -57 -30 -104 -40 -373 -182 -373 -195 0 -2 34 -56 75 -119 l74 -115 93 49 c120 64 199 84 303 79 105 -5 191 -44 271 -122 l57 -55 59 40 c85 58 190 106 288 130 72 18 103 21 220 16 160 -6 271 -32 534 -127 93 -33 170 -59 171 -58 6 9 85 241 85 252 0 11 -335 120 -520 170 -63 17 -199 42 -282 51 -41 5 -59 11 -62 23 -31 101 -123 592 -147 785 -21 175 -1 493 47 723 l6 31 -75 6 c-45 3 -100 15 -138 31 -35 14 -64 24 -65 23 -8 -8 -55 -356 -64 -467 -18 -242 19 -544 126 -1029 18 -84 32 -157 29 -160 -2 -4 -36 -20 -74 -35 l-71 -28 -60 40 c-33 23 -84 52 -113 66 l-53 25 -22 163 c-45 335 -55 477 -56 758 -1 251 1 282 21 360 22 87 87 261 142 383 l30 68 -34 44 c-19 25 -47 68 -62 95 -29 52 -35 55 -98 41z"/>
  </g>
</svg>`;

const DIAL_RADIUS_PCT = 41;

function dialPointsHtml(): string {
  return ([0, 1, 2, 3, 4, 5, 6, 7] as const)
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
}

const SESSION_LENGTH = 20;

export interface UfovConfig {
  id: string;
  number: number;
  name: string;
  instructions: string;
  /** Subtest 1 (centre-only) has no peripheral target at all: no dial, no
   *  ibis, no distractors, response is the shape alone. Subtests 2 and 3
   *  both show the peripheral target and ask for its position. */
  peripheralEnabled: boolean;
  /** Subtest 3 only: selective-attention distractor glyphs, staircase-
   *  controlled via SessionState.distractorCount. Subtests 1 and 2 always
   *  create trials with distractorCount forced to 0 — the distractor
   *  staircase in SessionState still exists and steps under the hood
   *  (scoreTrial doesn't know it's being ignored), it's just never read by
   *  createTrial for these two. */
  distractorsEnabled: boolean;
}

/**
 * Factory for the three official UFOV subtests (Ball & Owsley, 1993):
 * central discrimination alone, central + peripheral localisation (divided
 * attention), and central + peripheral among distractors (selective
 * attention) — see createCentreOnlyExercise / createCentreEdgeExercise /
 * createCentreEdgeDistractorsExercise below. All three share this one
 * implementation, reusing game.ts's createTrial/scoreTrial/staircase logic
 * unchanged; only what's shown and asked for differs.
 */
export function createUfovExercise(config: UfovConfig): Exercise<UfovState, Trial> {
  let field: HTMLElement | null = null;
  let central: HTMLDivElement | null = null;
  let peripheral: HTMLDivElement | null = null;
  let distractors: HTMLDivElement | null = null;

  function fieldOffset(position: PeripheralPosition): { x: number; y: number } {
    if (!field) return { x: 0, y: 0 };
    const angle = ((position * 45 - 90) * Math.PI) / 180;
    const radius = Math.min(field.clientWidth, field.clientHeight) * 0.34;
    return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
  }

  return {
    id: config.id,
    number: config.number,
    name: config.name,
    instructions: config.instructions,
    sessionLength: SESSION_LENGTH,

    initialState: {
      session: { ...INITIAL_STATE },
      bestPresentationMs: null,
      sessionLowestMs: INITIAL_STATE.presentationMs,
    },

    loadState(raw: unknown): UfovState | null {
      if (!raw || typeof raw !== "object") return null;
      const value = raw as Record<string, unknown>;
      // "state" is the pre-multi-exercise field name; loadState tolerates
      // it so a blind key-copy migration (see exercise.ts) needs no
      // bespoke shape transform.
      const s = (value.session ?? value.state) as Partial<SessionState> | undefined;
      if (!s || !isFiniteNumber(s.score) || !isFiniteNumber(s.attempts) || !isFiniteNumber(s.presentationMs)) {
        return null;
      }
      const session: SessionState = {
        score: Math.max(0, s.score),
        attempts: Math.min(SESSION_LENGTH, Math.max(0, s.attempts)),
        presentationMs: Math.max(120, Math.min(1500, s.presentationMs)),
        presentationStreak: Math.max(0, numberOr(s.presentationStreak, 0)),
        distractorCount: Math.max(0, numberOr(s.distractorCount, INITIAL_STATE.distractorCount)),
        distractorStreak: Math.max(0, numberOr(s.distractorStreak, 0)),
      };
      return {
        session,
        bestPresentationMs: isFiniteNumber(value.bestPresentationMs) ? value.bestPresentationMs : null,
        // The true in-session low can predate a reload and isn't persisted;
        // the resumed presentationMs is the best available floor for it.
        sessionLowestMs: isFiniteNumber(value.sessionLowestMs) ? value.sessionLowestMs : session.presentationMs,
      };
    },

    readouts(state: UfovState): ReadoutCell[] {
      const { session, bestPresentationMs } = state;
      return [
        { label: "Correct", value: String(session.score) },
        {
          label: "Accuracy",
          value: session.attempts === 0 ? "—" : `${Math.round((session.score / session.attempts) * 100)}%`,
        },
        { label: "Interval", value: `${session.presentationMs}<span class="unit">ms</span>` },
        { label: "Best", value: bestPresentationMs === null ? "—" : `${bestPresentationMs} ms` },
      ];
    },

    summaryCells(state: UfovState): ReadoutCell[] {
      const summary = summarizeSession(state.session, state.sessionLowestMs);
      return [
        { label: "Score", value: `${summary.score} / ${SESSION_LENGTH}` },
        { label: "Accuracy", value: `${summary.accuracyPct}%` },
        { label: "Lowest interval", value: `${summary.lowestPresentationMs} ms` },
        { label: "Correct / incorrect", value: `${summary.correct} / ${summary.incorrect}` },
      ];
    },

    attempts(state: UfovState): number {
      return state.session.attempts;
    },

    isSessionComplete(state: UfovState): boolean {
      return state.session.attempts >= SESSION_LENGTH;
    },

    pickerSummary(state: UfovState): string {
      if (state.bestPresentationMs === null && state.session.attempts === 0) return "Not played yet";
      const best = state.bestPresentationMs === null ? "—" : `${state.bestPresentationMs}ms`;
      const accuracy =
        state.session.attempts === 0 ? "—" : `${Math.round((state.session.score / state.session.attempts) * 100)}%`;
      return `Best ${best} · Last ${state.session.score}/${SESSION_LENGTH} (${accuracy})`;
    },

    historyEntry(state: UfovState) {
      const summary = summarizeSession(state.session, state.sessionLowestMs);
      return { score: summary.score, accuracyPct: summary.accuracyPct, lowestPresentationMs: summary.lowestPresentationMs };
    },

    mount(fieldContent: HTMLElement, answerControls: HTMLElement): void {
      // fieldContent itself has no intrinsic size (its children are all
      // absolutely positioned); the actual layout box to measure against
      // is its parent, the outer .field element.
      field = fieldContent.closest<HTMLElement>(".field") ?? fieldContent;

      fieldContent.innerHTML = config.peripheralEnabled
        ? `<div id="central" class="central" hidden></div>
           <div id="peripheral" class="peripheral" hidden aria-hidden="true">${IBIS_SVG}</div>
           <div id="distractors" class="distractors" aria-hidden="true"></div>`
        : `<div id="central" class="central" hidden></div>`;
      central = fieldContent.querySelector<HTMLDivElement>("#central");
      peripheral = fieldContent.querySelector<HTMLDivElement>("#peripheral");
      distractors = fieldContent.querySelector<HTMLDivElement>("#distractors");

      const dial = config.peripheralEnabled
        ? `<p class="question">Ibis position</p>
           <div class="position-dial" aria-hidden="false">
             <span class="dial-centre" aria-hidden="true">+</span>
             ${dialPointsHtml()}
           </div>`
        : "";
      answerControls.innerHTML = `
        <legend>What did you see?</legend>

        <p class="question">Centre shape</p>
        <div class="choices">
          <label><input type="radio" name="central" value="circle" required><span class="mini circle"></span>Circle</label>
          <label><input type="radio" name="central" value="diamond" required><span class="mini diamond"></span>Diamond</label>
        </div>

        ${dial}

        <button class="primary submit-answer" type="submit">Submit answer</button>
      `;
    },

    createTrial(state: UfovState): Trial {
      const distractorCount = config.distractorsEnabled ? state.session.distractorCount : 0;
      return createTrial(state.session.presentationMs, distractorCount);
    },

    flashDurationMs(trial: Trial): number {
      return trial.presentationMs;
    },

    showTrial(trial: Trial): void {
      if (!central) return;
      central.className = `central ${trial.centralSymbol}`;
      central.hidden = false;

      if (!config.peripheralEnabled || !peripheral || !distractors) return;
      const { x, y } = fieldOffset(trial.peripheralPosition);
      peripheral.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;
      distractors.innerHTML = trial.distractorPositions
        .map(position => {
          const offset = fieldOffset(position);
          return `<span class="distractor" style="transform: translate(calc(-50% + ${offset.x}px), calc(-50% + ${offset.y}px));">${IBIS_SVG}</span>`;
        })
        .join("");
      peripheral.hidden = false;
    },

    hideTrial(): void {
      if (central) central.hidden = true;
      if (peripheral) peripheral.hidden = true;
      if (distractors) distractors.innerHTML = "";
    },

    readAnswer(response: HTMLFormElement): Partial<Answer> | null {
      const data = new FormData(response);
      const centralAnswer = data.get("central") as CentralSymbol | null;
      if (!centralAnswer) return null;
      if (!config.peripheralEnabled) return { centralSymbol: centralAnswer };
      const positionRaw = data.get("position");
      if (typeof positionRaw !== "string") return null;
      return {
        centralSymbol: centralAnswer,
        peripheralPosition: Number.parseInt(positionRaw, 10) as PeripheralPosition,
      };
    },

    isCorrect(trial: Trial, answer: unknown): boolean {
      const a = answer as Partial<Answer>;
      if (trial.centralSymbol !== a.centralSymbol) return false;
      if (!config.peripheralEnabled) return true;
      return trial.peripheralPosition === a.peripheralPosition;
    },

    feedback(trial: Trial, correct: boolean): string {
      if (correct) return "Correct.";
      return config.peripheralEnabled
        ? `Not quite. It was a ${trial.centralSymbol}, at position ${trial.peripheralPosition + 1}.`
        : `Not quite. It was a ${trial.centralSymbol}.`;
    },

    onMiss(trial: Trial): void {
      if (!config.peripheralEnabled) return;
      const point = document
        .querySelector<HTMLInputElement>(`.dial-point input[value="${trial.peripheralPosition}"]`)
        ?.closest<HTMLElement>(".dial-point");
      point?.classList.add("correct-answer");
    },

    clearMissMarks(): void {
      document.querySelectorAll(".dial-point.correct-answer").forEach(el => el.classList.remove("correct-answer"));
    },

    score(state: UfovState, trial: Trial, answer: unknown): UfovState {
      const a = answer as Partial<Answer>;
      // scoreTrial always compares both fields; centre-only never asks for
      // a position, so supply the trial's own to make that half trivially
      // true and let correctness reduce to the shape alone.
      const fullAnswer: Answer = {
        centralSymbol: a.centralSymbol as CentralSymbol,
        peripheralPosition: config.peripheralEnabled ? (a.peripheralPosition as PeripheralPosition) : trial.peripheralPosition,
      };
      const session = scoreTrial(state.session, trial, fullAnswer);
      const correct = session.score > state.session.score;
      const bestPresentationMs =
        correct && (state.bestPresentationMs === null || session.presentationMs < state.bestPresentationMs)
          ? session.presentationMs
          : state.bestPresentationMs;
      return {
        session,
        bestPresentationMs,
        sessionLowestMs: Math.min(state.sessionLowestMs, session.presentationMs),
      };
    },
  };
}

export function createCentreOnlyExercise(): Exercise<UfovState, Trial> {
  return createUfovExercise({
    id: "centre-only",
    number: 1,
    name: "Centre only",
    instructions:
      "Keep your eyes on the centre. A <strong>circle or diamond</strong> will appear there briefly. " +
      "After it vanishes, choose which shape you saw.",
    peripheralEnabled: false,
    distractorsEnabled: false,
  });
}

export function createCentreEdgeExercise(): Exercise<UfovState, Trial> {
  return createUfovExercise({
    id: "centre-edge",
    number: 2,
    name: "Centre and edge",
    instructions:
      "Keep your eyes on the centre. A <strong>circle or diamond</strong> will appear there " +
      "while an ibis appears at one of eight positions around it. After they vanish, choose the shape and the ibis's position.",
    peripheralEnabled: true,
    distractorsEnabled: false,
  });
}

export function createCentreEdgeDistractorsExercise(): Exercise<UfovState, Trial> {
  return createUfovExercise({
    id: "centre-edge-distractors",
    number: 3,
    name: "Centre and edge, with distractors",
    instructions:
      "Keep your eyes on the centre. A <strong>circle or diamond</strong> will appear there " +
      "while an ibis appears at one of eight positions around it, sometimes alongside a few " +
      "dimmer decoy glyphs elsewhere. After they vanish, choose the shape and the ibis's position.",
    peripheralEnabled: true,
    distractorsEnabled: true,
  });
}
