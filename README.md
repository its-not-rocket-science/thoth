# Thoth

An open-source, browser-based suite of adaptive visual-attention and cognitive-performance exercises.

> [!IMPORTANT]
> Thoth is an experimental software project. It is not a medical device and has not been shown to prevent, diagnose, treat or reduce the risk of dementia, Alzheimer's disease or any other health condition.

## Status

This repository has grown from a single UFOV-style prototype into an eight-exercise suite with a shared `Exercise` abstraction, per-exercise persistence and longitudinal progress history, guided practice, observed-timing diagnostics, a recommended-session rotation, and Playwright e2e/visual-regression/accessibility tests.

The first three exercises mirror the three official subtests of the clinical Useful Field of View (UFOV) instrument (see [Useful field of view](#useful-field-of-view) below), each independently scored and progressed:

1. **Centre only** — briefly identify a central target alone (pure processing speed).
2. **Centre and edge** — identify the central target while simultaneously localising a target in the peripheral visual field (divided attention).
3. **Centre and edge, with distractors** — the same divided-attention task with the peripheral target embedded among decoy glyphs (selective attention).

Five further exercises draw on separate paradigms:

4. **Multiple object tracking** — briefly memorise a subset of identical dots as they're highlighted, then track them by eye as every dot drifts around the field, and pick the original targets back out once they stop (see [Multiple object tracking](#multiple-object-tracking) below).
5. **Spatial cueing** — respond the instant a target appears at one of eight positions, usually (but not always) where a brief cue just brightened; measures raw reaction time and the cost of a misleading cue, not accuracy (see [Spatial cueing](#spatial-cueing) below).
6. **Visual search** — find one target shape among a grid of distractors as fast as possible; measures how reaction time scales with the number of distractors, not raw speed (see [Visual search](#visual-search) below).
7. **Task switching** — connect alternating numbered and lettered nodes (1-A-2-B-3-C…) in order as fast as possible; a Trail-Making-Test-style paradigm scored on completion time and error count, structured as a handful of complete-the-trail rounds rather than short flash trials (see [Task switching](#task-switching) below).
8. **Sustained attention** — respond to a fixed-length stream of central glyphs, pressing for the frequent "go" shape and withholding for the rare "no-go" shape; a continuous performance test (CPT) paradigm scored on commission errors, omission errors, and mean reaction time, not accuracy at a single presentation (see [Sustained attention](#sustained-attention) below).

Exercises 1–4 continue at an adaptively adjusted level of difficulty; spatial cueing, task switching and sustained attention measure time/errors directly instead against a fixed protocol, and visual search does some of both (see [Exercise classification](#exercise-classification) below for the full breakdown and rationale). The project is inspired by published research into visual speed-of-processing training, the useful field of view, multiple object tracking, spatial attention, visual search, task switching and sustained attention. It will not copy BrainHQ's artwork, source code, progression system, scoring system or proprietary implementation.

## About the name

Thoth was an ancient Egyptian god associated with wisdom, writing, calculation, measurement and learning.

In the account related by Plato in the *Phaedrus*, the Egyptian god Theuth—generally identified with Thoth—is credited with inventions including number, calculation, geometry, astronomy, draughts and dice. The name reflects this project's use of structured play, measurement and adaptive challenge to explore visual processing and divided attention.

Thoth is commonly depicted with the head of an ibis, providing the project with a clear and recognisable visual identity.

The name does not imply medical, diagnostic or therapeutic ability.

## Goals

Thoth aims to explore how an independently designed browser suite can train and/or measure:

- visual processing speed;
- divided attention;
- peripheral target localisation;
- selective attention / distractor resistance;
- multiple-object tracking;
- spatial attentional orienting;
- visual search efficiency;
- task switching;
- sustained attention;
- response inhibition; and
- speed–accuracy control.

The initial priorities are accurate and testable presentation, a transparent adaptive algorithm, suitability for older users, local-first storage, reproducible session data, low software overhead and cautious public claims.

## Non-goals

Thoth is not currently intended to diagnose cognitive impairment, estimate dementia risk, claim equivalence to a studied commercial intervention, provide medical advice, reproduce BrainHQ's Double Decision exercise, collect identifiable health information or replace professional assessment or treatment.

Improvement within the game must not automatically be interpreted as improvement in general cognition or everyday functioning.

## Exercise classification

Every exercise declares a `mode` on the shared `Exercise` abstraction (`src/exercise.ts`): `"training"`, `"measurement"`, or `"mixed"`. This isn't cosmetic — it says how to read that exercise's numbers, and it's shown as a small badge on its picker card:

| # | Exercise | Mode | Why |
| --- | --- | --- | --- |
| 1 | Centre only | Training | Adaptive presentation-interval staircase runs on every scored trial; no fixed protocol underlies the numbers, so they're a training curve, not a standardised score. |
| 2 | Centre and edge | Training | Same staircase, same reasoning. |
| 3 | Centre and edge, with distractors | Training | Same staircase (plus a second, distractor-count staircase), same reasoning. |
| 4 | Multiple object tracking | Training | Object count adapts continuously via the same 2-down-1-up rule; no fixed protocol. |
| 5 | Spatial cueing | Measurement | Fixed 80/20 valid/invalid ratio, no staircase — the manipulation of interest (the RT cost of an invalid cue) is measured, not trained. |
| 6 | Visual search | Mixed | Set size adapts via a staircase (a training element), but the scientifically meaningful output — the RT-by-set-size slope — is a measurement construct, not a score to maximise. |
| 7 | Task switching | Measurement | Fixed 12-node trail every round, no staircase — mirrors the standardised Trail Making Test B protocol it's derived from. |
| 8 | Sustained attention | Measurement | Standardised protocol (see [Sustained attention](#sustained-attention) below) — no staircase, fixed event count, fixed ISI, fixed go/no-go ratio. |

"Training" exercises are the ones to keep replaying to build a curve; "measurement" exercises are the ones whose session-to-session numbers are most directly comparable, the way a repeated experimental measure's would be; "mixed" sits in between. None of this is a claim of clinical validity — see [Scientific caution](#scientific-caution).

### Progress tracking

Every exercise defines its own `metrics` (label, unit, and whether lower or higher counts as improvement) and a `primaryMetricKey` for its longitudinal chart — there is deliberately no single unified "brain score" across exercises with very different underlying constructs. A **Progress** button on the exercise screen opens a small inline SVG line chart plus a table of the metric's last few sessions with a ▲/▼ direction indicator, always labelled with which direction is "better" for that specific metric. Given how few sessions most players will have, the panel always shows a caution:

> Session-to-session changes may reflect familiarity, fatigue, device conditions or normal variability — especially over just a few sessions.

Session history is stored per exercise (`src/history.ts`) as `{ exerciseId, timestamp, metrics, schemaVersion }`, capped at the 20 most recent sessions. A pre-generalised-schema save (score/accuracy/lowest-interval only, from before this consolidation pass) is transparently migrated into the current shape the first time it's read, so existing UFOV history survives the change.

### Guided practice

Every exercise offers a **Practise** button. Practice runs the exercise's real mechanics — the same `createTrial`/`showTrial`/scoring code as a scored session — but seeded from an eased starting state (an exercise-supplied `practiceState()` hook: e.g. the slowest presentation interval for the UFOV exercises, the fewest objects for multiple-object tracking, the smallest set size for visual search) and never calls into saved progress, session history, or the adaptive staircase's persisted state. A first-time player (never practised, never played) sees an inline prompt suggesting practice; anyone else can skip straight to a scored session, or return to practice at any time.

### Timing diagnostics

For every timed presentation, the host (not each exercise individually) records both the *requested* duration an exercise asked for and the *observed* one — `performance.now()` immediately around the `showTrial()`/`hideTrial()` calls it already makes for every exercise uniformly. A presentation interrupted by a paused/hidden tab, a manual pause, or a reset is flagged `valid: false` with a reason, rather than silently counted as if the requested timing held. This is browser-timer precision, not laboratory-grade frame timing — coordinating onset/offset with `requestAnimationFrame` was considered and deliberately not done (see [Follow-up work not implemented](#follow-up-work-not-implemented)). Diagnostics are kept locally (capped at 200 records) and can be exported as a plain JSON file from the button in the footer; they're not shown in the normal play UI.

### Recommended session

A **Recommended session** button on the picker builds a short queue — one UFOV exercise, one attentional-orienting/search exercise, one executive/sustained-attention exercise, roughly 10–15 minutes total — rotating away from whichever exercises were picked last time a different option exists (`src/recommended.ts`). It's explicitly a software-designed rotation for variety, not a clinically validated prescription; every slot can be started, replaced with another candidate in its category, or skipped, and each exercise keeps its own independent progression and history regardless of how it was reached.

## Vision dependency

Every exercise is inherently a timed visual task: each asks the player to briefly perceive a central shape, in most cases along with a peripheral glyph, within a fraction of a second. That cannot be made screen-reader navigable without defeating its purpose — a non-visual equivalent would be a different task, not an accessible version of this one. Thoth is checked against automated accessibility rules (see `e2e/a11y.spec.ts`) for the parts of the interface that are not the timed stimulus itself — labelling, contrast, keyboard operability, focus order — but the core exercise will remain unavailable to players who cannot see the screen.

## Research background

### ACTIVE trial

The Advanced Cognitive Training for Independent and Vital Elderly trial was a large randomised study comparing memory, reasoning and speed-of-processing interventions in older adults.

- Ball K, Berch DB, Helmers KF, et al. **Effects of cognitive training interventions with older adults: a randomized controlled trial.** *JAMA*. 2002;288(18):2271–2281.  
  https://doi.org/10.1001/jama.288.18.2271

- Jobe JB, Smith DM, Ball K, et al. **ACTIVE: a cognitive intervention trial to promote independence in older adults.** *Controlled Clinical Trials*. 2001;22(4):453–479.  
  https://doi.org/10.1016/S0197-2456(01)00139-8

### Dementia analysis

- Edwards JD, Xu H, Clark DO, Ross LA, Unverzagt FW. **Speed of processing training results in lower risk of dementia.** *Alzheimer's & Dementia: Translational Research & Clinical Interventions*. 2017;3(4):603–611.  
  https://doi.org/10.1016/j.trci.2017.09.002

This result concerns the particular intervention studied in ACTIVE. It does not establish that every superficially similar game has the same effects.

### Longer-term follow-up and biomarkers

- Johns Hopkins Medicine overview:  
  https://www.hopkinsmedicine.org/news/newsroom/news-releases/2026/02/cognitive-speed-training-linked-to-lower-dementia-incidence-up-to-20-years-later

- New Scientist article that prompted this project:  
  https://www.newscientist.com/article/2578806-game-that-reduces-dementia-risk-clears-amyloid-from-mens-brains/

The biomarker findings reported in news coverage should be treated as preliminary until their methods, statistical analysis and full peer-reviewed publication can be examined.

### Useful field of view

The useful field of view is the visual area from which information can be acquired during a brief glance without moving the eyes or head. The clinical UFOV instrument has three official subtests — central discrimination alone, central discrimination with simultaneous peripheral localisation, and the same task with the peripheral target embedded among distractors — and Thoth's three exercises deliberately mirror that structure rather than blending it into one task:

- Ball K, Owsley C. **The Useful Field of View Test: a new technique for evaluating age-related declines in visual function.** *Journal of the American Optometric Association*. 1993;64(1):71–79.

Background reading:

- Visual Awareness Research Group, University of Alabama at Birmingham:  
  https://www.uab.edu/medicine/ophthalmology/research/visual-awareness

- BrainHQ description of its commercial Double Decision exercise:  
  https://www.brainhq.com/why-brainhq/about-the-brainhq-exercises/attention/double-decision/

The BrainHQ page is included to document the commercial exercise associated with the ACTIVE research, not as an implementation specification.

### Multiple object tracking

"Multiple object tracking" (Exercise No. 04) is a separate paradigm from UFOV, grounded in the classic sustained divided-attention literature:

- Pylyshyn ZW, Storm RW. **Tracking multiple independent targets: evidence for a parallel tracking mechanism.** *Spatial Vision*. 1988;3(3):179–197.

### Spatial cueing

"Spatial cueing" (Exercise No. 05) is a reaction-time paradigm for attentional orienting, not a UFOV subtest — it measures raw response speed and the cost of an invalid cue, not accuracy at a given presentation duration:

- Posner MI. **Orienting of attention.** *Quarterly Journal of Experimental Psychology*. 1980;32(1):3–25.

### Visual search

"Visual search" (Exercise No. 06) is a distinct construct from every exercise above: the efficiency of finding one item among many, as a function of how many distractors surround it — measured as the slope of reaction time against set size, not accuracy or raw speed:

- Treisman AM, Gelade G. **A feature-integration theory of attention.** *Cognitive Psychology*. 1980;12(1):97–136.

### Task switching

"Task switching" (Exercise No. 07) is not a UFOV subtest, but Trail Making Test B is one of the standard secondary outcome measures used alongside UFOV in the same speed-of-processing trial literature this project already cites above (ACTIVE). Connect alternating numbered and lettered nodes (1-A-2-B-3-C…) in order; completion time and error count are both scored, since switching cost and error rate are the two standard outcome measures for this paradigm. Halved to 6 numbers + 6 letters (12 nodes) from the real test's 13+12, and structured as a handful of complete-the-trail rounds per session rather than 20 short flash trials, since a single round already takes as long as several of the app's other trials combined:

- Reitan RM. **Validity of the Trail Making Test as an indicator of organic brain damage.** *Perceptual and Motor Skills*. 1958;8(3):271–276.

### Sustained attention

"Sustained attention" (Exercise No. 08) is grounded in the continuous performance test (CPT) literature, and is the app's only exercise built around vigilance over an extended period rather than a single brief presentation. A stream of circles ("go") and diamonds ("no-go") passes the centre of the field; the player responds to every circle and withholds on every diamond. Scored on commission errors (responding to a no-go), omission errors (missing a go), and mean reaction time on correct go trials.

Unlike every other exercise in this list, sustained attention runs a **standardised measurement protocol rather than an adaptive one**: a fixed 54 events per stream, a fixed inter-stimulus interval (1200ms, never adapted during the stream), and an exact fixed no-go count (8 of the 54, dealt into a shuffled deck rather than drawn per event at random) — so the go/no-go ratio is exact, not merely probable over a long stream. This was a deliberate consolidation-phase decision: an earlier version adapted inter-stimulus interval via the same 2-down-1-up staircase used elsewhere, which complicates interpreting commission errors, omission errors and mean RT, and makes sessions hard to compare to each other. Rather than build and maintain a *second*, separately-adaptive CPT protocol alongside this standardised one — extra surface area on the app's most fatiguing exercise, for a training benefit no other exercise here depends on this heavily to deliver — this exercise took the simpler of the two options the brief allowed: standardise fully, and document the choice here. See [Exercise classification](#exercise-classification) for why this makes it a "measurement", not "training", exercise.

- Rosvold HE, Mirsky AF, Sarason I, Bransome ED Jr, Beck LH. **A continuous performance test of brain damage.** *Journal of Consulting Psychology*. 1956;20(5):343–350.

## Scientific caution

Several questions must remain separate:

1. Can players improve at the Thoth task?
2. Does that improvement transfer to untrained cognitive tests?
3. Does it transfer to everyday activities?
4. Does it persist after training stops?
5. Does it affect biomarkers?
6. Does it alter the incidence or timing of clinical dementia?

Success at one level does not prove success at the next.

Before making health-related claims, Thoth would require appropriate independent studies, preregistered outcomes, suitable control conditions, adequate statistical power and relevant ethical and regulatory review.

## Intellectual property

This project will implement general ideas from cognitive psychology using an original design. Contributors must not copy proprietary assets, reproduce a commercial product screen-for-screen, derive code from closed-source software, describe Thoth as a clone, or assume that an open-source implementation is outside relevant patent claims.

A professional freedom-to-operate review would be required before commercialisation or formal clinical use.

## Data and privacy

The initial version works without an account, stores progress locally, uses no analytics, does not collect names or health histories, and allows local progress to be reset.

Any future collection or transmission of trial results will require a separate privacy and governance design.

## Development

Use a current Node.js LTS release.

```bash
npm install
npm run dev
```

Checks and production build:

```bash
npm run typecheck
npm test
npm run build
npm run preview
```

### Visual regression tests

`e2e/visual.spec.ts` screenshots the built app in each major UI phase (ready,
showing, responding, complete) and compares against the committed baseline
PNGs in `e2e/visual.spec.ts-snapshots/`, failing the build on an unexpected
diff. CI runs this after `npm run build` and before deploying, inside the
same `mcr.microsoft.com/playwright` Docker image the baselines were recorded
in — comparing screenshots taken on different operating systems produces
false failures from font/anti-aliasing differences alone, so recording and
comparing must happen in the same environment.

To run it locally against the same image CI uses:

```bash
docker run --rm -v "$PWD:/work" -w /work mcr.microsoft.com/playwright:v1.62.1-noble \
  bash -lc "npm install --no-audit --no-fund && npm run build && npx playwright test"
```

When a change is deliberately supposed to look different, regenerate the
baselines the same way (add `--update-snapshots`, or run
`npm run test:visual:update` inside the container) and commit the updated
PNGs alongside the change. Keep the Docker image tag here, in
`playwright.config.ts`'s comment, and in `.github/workflows/deploy.yml`'s
`container:` in sync with the `@playwright/test` version in `package.json`.

## Deployment

The project is configured for:

```text
https://its-not-rocket-science.github.io/thoth/
```

After pushing to GitHub:

1. Open **Settings → Pages**.
2. Under **Build and deployment**, select **GitHub Actions**.
3. Push to `main`, or run the workflow manually from **Actions**.
4. Keep **Enforce HTTPS** enabled.

The deployment workflow is stored at `.github/workflows/deploy.yml`.

Documentation:

- https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages
- https://vite.dev/guide/static-deploy.html#github-pages

If the repository name changes, update `base` in `vite.config.ts`.

## Roadmap

### Phase 0 — research and specification

- [ ] Review the intervention literature
- [ ] Document claims the project may and may not make
- [ ] Review relevant patents and intellectual-property risks
- [ ] Define the first trial protocol
- [ ] Define browser-support, usability and accessibility requirements

### Phase 1 — technical prototype

- [x] Central fixation and discrimination target
- [x] Simultaneous peripheral target
- [x] Two-part response collection
- [x] Simple adaptive presentation duration
- [x] Local best result
- [x] Observed-duration recording
- [x] Guided practice trials
- [ ] Seeded sessions
- [x] Broader unit and browser tests

### Phase 2 — adaptation

- [x] Define and document a validated staircase algorithm
- [x] Separate difficulty dimensions
- [x] Add session summaries and progress history
- [x] Test floor and ceiling behaviour

Both adaptive dimensions use a standard **2-down-1-up** staircase
(`stepStaircase` in `src/game.ts`): two consecutive correct responses step
difficulty up one notch and reset the streak, so the *next* step again needs
two fresh correct responses; a single incorrect response steps difficulty
back down immediately and also resets the streak. This is the classic
transformed up-down rule (Levitt, 1971) and targets roughly 70.7% asymptotic
accuracy.

Each dimension is tracked independently in `SessionState` (its own value and
its own streak), even though both currently react to the same correct/
incorrect stream:

| Dimension | State fields | Range | Harder step | Easier step |
| --- | --- | --- | --- | --- |
| Presentation interval | `presentationMs` / `presentationStreak` | 120–1500ms | ×0.9 (shorter) | ×1.15 (longer) |
| Distractor count | `distractorCount` / `distractorStreak` | 0–5 | +1 | −1 |

`scoreTrial` (src/game.ts) just wires each dimension's current
`{ value, streak }` through `stepStaircase` with its own config
(`PRESENTATION_STAIRCASE`, `DISTRACTOR_STAIRCASE`) — it holds no staircase
logic itself. Saved sessions from before a dimension existed fall back to
that dimension's default rather than being discarded.

### Phase 3 — evaluation

- [ ] Conduct usability testing
- [ ] Test common displays and browsers
- [ ] Assess test–retest reliability
- [ ] Compare adaptive rules
- [ ] Develop a preregistered validation proposal

## Unresolved scientific-design decisions

- **Visual search's "mixed" classification.** Its set-size staircase adapts (a training property) while the slope it produces is the actually-meaningful measurement; the brief allowed either "measurement" or "mixed" and this project picked "mixed" without a strong argument either way.
- **Spatial cueing's validity-effect direction.** `validityEffect` (invalid RT − valid RT) is deliberately labelled `"neutral"`, not `"lower is better"` — a smaller cueing cost could mean a more efficient orienting response, but could equally mean a weak or noisy cueing effect over only 20 trials. Which reading is correct isn't resolved here.
- **Sustained attention's fixed parameters** (54 events, 1200ms ISI, 15% no-go) were chosen to land close to the previous adaptive version's typical stream length, not derived from a specific published CPT protocol.
- **CPT's requested-duration timing diagnostic is inflated.** Its `flashDurationMs()` returns a generous safety-margin ceiling (the stream almost always ends itself first, well before the host's own fallback timer would), so its timing-diagnostic records will show `observedMs` consistently well under `requestedMs` — accurate, but not the useful "did this run at protocol length" comparison the other exercises' records give.

## Follow-up work not implemented

- **`requestAnimationFrame`-aligned onset/offset.** The brief asked for this "where practical"; it was judged impractical here because jsdom (this project's unit-test environment) doesn't reliably support `requestAnimationFrame`, and wiring it into the one host code path every exercise shares risked breaking the whole suite for a precision gain `performance.now()` timestamps around the existing `showTrial()`/`hideTrial()` calls already mostly capture.
- **Bespoke per-exercise practice tutorials.** The brief's practice examples (e.g. "highlight possible peripheral positions" for centre-and-edge, "show one feature-search and one conjunction-search example" for visual search) describe custom guided walkthroughs. What's implemented instead is one generic mechanism — real trials, eased via `practiceState()`, never scored or saved — reused by every exercise. It demonstrates the real mechanic at an easier difficulty rather than adding a bespoke tutorial overlay per exercise.
- **Seeded sessions**, carried over unimplemented from the previous roadmap.
- **New Playwright e2e coverage for the new UI** (practice mode, the progress panel, the recommended-session panel). The existing e2e/a11y/visual-regression suites were re-run against every change in this pass (see the project's own Docker-based `npm run test:visual` instructions above) and still pass, and the visual-regression baselines were regenerated for the new UI elements, but no *new* spec files were added to exercise practice/progress/recommended-session interaction end-to-end — only unit-level coverage (`src/*.test.ts`) exists for those.

## Contributing

The project is not yet accepting claims of therapeutic benefit, clinical equivalence or diagnostic validity. Please open an issue before implementing a major game mechanic or changing the adaptive model.

## Licence

No licence has yet been selected. Until a licence file is added, normal copyright rules apply and the repository should not be treated as open source merely because its source is publicly visible.

Options for later consideration include AGPL-3.0, GPL-3.0, MPL-2.0 and Apache-2.0. The decision should follow review of the project's patent and commercialisation strategy.

## Disclaimer

Thoth is experimental software for research, education and software-development purposes. It is not medical advice, a diagnostic test, a medical device or a clinically validated intervention.

Anyone concerned about their memory, cognition or neurological health should seek advice from an appropriately qualified healthcare professional.
