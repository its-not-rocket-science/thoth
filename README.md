# Thoth

An open-source, browser-based visual processing and divided-attention training game.

> [!IMPORTANT]
> Thoth is an experimental software project. It is not a medical device and has not been shown to prevent, diagnose, treat or reduce the risk of dementia, Alzheimer's disease or any other health condition.

## Status

This repository contains an early playable prototype.

The first exercise asks the player to:

1. focus on the centre of the screen;
2. briefly identify a central target;
3. simultaneously detect a target in the peripheral visual field;
4. report both answers; and
5. continue at an adaptively adjusted level of difficulty.

The project is inspired by published research into visual speed-of-processing training and the useful field of view. It will not copy BrainHQ's artwork, source code, progression system, scoring system or proprietary implementation.

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

The useful field of view is the visual area from which information can be acquired during a brief glance without moving the eyes or head. Relevant tasks can combine central discrimination, peripheral target localisation, brief presentation times and visual distractors.

Background reading:

- Visual Awareness Research Group, University of Alabama at Birmingham:  
  https://www.uab.edu/medicine/ophthalmology/research/visual-awareness

- BrainHQ description of its commercial Double Decision exercise:  
  https://www.brainhq.com/why-brainhq/about-the-brainhq-exercises/attention/double-decision/

The BrainHQ page is included to document the commercial exercise associated with the ACTIVE research, not as an implementation specification.

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
- [ ] Broader unit and browser tests

### Phase 2 — adaptation

- [ ] Define and document a validated staircase algorithm
- [ ] Separate difficulty dimensions
- [ ] Add session summaries and progress history
- [ ] Test floor and ceiling behaviour

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
