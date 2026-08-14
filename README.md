# Thoth

An open-source, browser-based visual processing and divided-attention training game.

> [!IMPORTANT]
> Thoth is an experimental software project. It is not a medical device and has not been shown to prevent, diagnose, treat or reduce the risk of dementia, Alzheimer's disease or any other health condition.

## Status

This repository contains an early playable prototype.

The first three exercises mirror the three official subtests of the clinical Useful Field of View (UFOV) instrument (see [Useful field of view](#useful-field-of-view) below), each independently scored and progressed:

1. **Centre only** — briefly identify a central target alone (pure processing speed).
2. **Centre and edge** — identify the central target while simultaneously localising a target in the peripheral visual field (divided attention).
3. **Centre and edge, with distractors** — the same divided-attention task with the peripheral target embedded among decoy glyphs (selective attention).

Two further exercises draw on separate paradigms:

4. **Multiple object tracking** — briefly memorise a subset of identical dots as they're highlighted, then track them by eye as every dot drifts around the field, and pick the original targets back out once they stop (see [Multiple object tracking](#multiple-object-tracking) below).
5. **Spatial cueing** — respond the instant a target appears at one of eight positions, usually (but not always) where a brief cue just brightened; measures raw reaction time and the cost of a misleading cue, not accuracy (see [Spatial cueing](#spatial-cueing) below).

Exercises 1–4 continue at an adaptively adjusted level of difficulty; spatial cueing measures reaction time directly instead and doesn't use a difficulty staircase (see its section below for why). The project is inspired by published research into visual speed-of-processing training, the useful field of view, multiple object tracking, and spatial attention. It will not copy BrainHQ's artwork, source code, progression system, scoring system or proprietary implementation.

## About the name

Thoth was an ancient Egyptian god associated with wisdom, writing, calculation, measurement and learning.

In the account related by Plato in the *Phaedrus*, the Egyptian god Theuth—generally identified with Thoth—is credited with inventions including number, calculation, geometry, astronomy, draughts and dice. The name reflects this project's use of structured play, measurement and adaptive challenge to explore visual processing and divided attention.

Thoth is commonly depicted with the head of an ibis, providing the project with a clear and recognisable visual identity.

The name does not imply medical, diagnostic or therapeutic ability.

## Goals

Thoth aims to explore how an independently designed browser game can train:

- visual processing speed;
- divided attention;
- peripheral target localisation;
- resistance to visual distraction; and
- speed–accuracy control.

The initial priorities are accurate and testable presentation, a transparent adaptive algorithm, suitability for older users, local-first storage, reproducible session data, low software overhead and cautious public claims.

## Non-goals

Thoth is not currently intended to diagnose cognitive impairment, estimate dementia risk, claim equivalence to a studied commercial intervention, provide medical advice, reproduce BrainHQ's Double Decision exercise, collect identifiable health information or replace professional assessment or treatment.

Improvement within the game must not automatically be interpreted as improvement in general cognition or everyday functioning.

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
- [ ] Observed-duration recording
- [ ] Guided practice trials
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

## Contributing

The project is not yet accepting claims of therapeutic benefit, clinical equivalence or diagnostic validity. Please open an issue before implementing a major game mechanic or changing the adaptive model.

## Licence

No licence has yet been selected. Until a licence file is added, normal copyright rules apply and the repository should not be treated as open source merely because its source is publicly visible.

Options for later consideration include AGPL-3.0, GPL-3.0, MPL-2.0 and Apache-2.0. The decision should follow review of the project's patent and commercialisation strategy.

## Disclaimer

Thoth is experimental software for research, education and software-development purposes. It is not medical advice, a diagnostic test, a medical device or a clinically validated intervention.

Anyone concerned about their memory, cognition or neurological health should seek advice from an appropriately qualified healthcare professional.
