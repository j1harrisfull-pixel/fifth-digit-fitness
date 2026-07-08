# Visual Redesign Master Plan — Fifth Digit Fitness

**Status:** Plan only. No code, no edits, nothing deployed. This supersedes the ad-hoc "Reset Phase 3 onward" micro-phase sequence pending your decision.

**Frame:** visual language only. The coaching engine, flows, data shape, safety/readiness/recovery logic, and every interaction mechanic are fixed and protected. This document decides *how* the app should look and *how the remaining visual work should be structured* — not what it should do.

---

## 1. Executive recommendation

**Choose C — Hybrid: keep the approved foundations, consolidate the remaining work into three larger redesign passes.**

Not A: the visual language is *partly wrong*, provably so, on the highest-traffic screen (active workout). Continuing 3-selector micro-phases there would take a dozen more review cycles to fix a screen that needs to be redesigned as one coherent surface, and micro-phases can't fix a *composition* problem — they can only soften individual elements while the overall grammar stays console-like.

Not B: a from-scratch visual reset would throw away genuinely correct, already-approved foundations (the brass token, the 10px radius/clip-path hybrid, the named type scale, the coach-note treatment, the quiet-aside pattern, the tinted status tags) and would force re-touching markup that sits close to the engine — raising behaviour risk for no gain.

C is the honest gold-standard answer: **the foundations are right, the chrome is wrong, and the remaining chrome should be redesigned in whole-screen passes, not atom by atom.** The micro-phase cadence was correct for the shared-token work (Phases A/B/1/2) because those genuinely were small, safe, cross-cutting changes. It becomes the wrong tool the moment the work is "redesign one screen's composition," which is what's left.

**What changes operationally:** instead of "one 3-selector phase → review → repeat," we do "one whole-screen redesign → screenshot-gated review → next screen." Fewer, larger, screenshot-approved passes. Same discipline, bigger units.

---

## 2. Specialist skills used

Each major section names its lens inline. Summary of where each is load-bearing:
- **Product design** — §1 (micro-phase vs redesign decision), §3 (what to keep/not over-protect), §6 (per-screen "what improves for a paying user").
- **Visual design** — §4 (what's wrong), §5 (replacement language), §7 (component system).
- **Usability** — §6 (logging speed, scan speed, next-action clarity per screen), §11 (speed/data-visibility risks).
- **UX writing** — §5 (dialog/label tone), §6 (readiness/recovery/onboarding copy read).
- **Brand systems** — §4, §5 (avoiding console/soft-SaaS/luxury; the Fifth Digit "quiet confidence" target).
- **Accessibility** — §5, §6, §11 (contrast, state visibility, tap targets, daylight legibility — grounded in the contrast math from Phase 2).
- **Behaviour-preserving engineering** — §8 (per-phase guardrails), §9 (out of scope), §11 (logic-bleed risk).
- **Test engineering** — §8 (regression per phase), §10 (screenshot gates).

---

## 3. What the previous visual phases proved

**Product design + visual design lens** — an honest audit of A/B/C/D + Reset 1/2, including where I should *not* over-defend my own prior work.

**What genuinely helped and must be kept:**
- **Phase A** — `--accent: #C79A43` (contrast-validated) and the radius/clip-path hybrid (10px cards, clipped CTAs). This is the correct brand-accurate foundation; nothing here revisits it.
- **Phase B** — named type scale (`--fs-display/h1/h2/body/small/label`) and the `--surface-3` elevation tier. The hierarchy vocabulary is right.
- **Phase C** — the coach-note treatment (brass overline + brass left-rule + italic). **This is the single most successful thing done so far** — it's the one element that already reads "coach's voice, not system label." It should become the *template* the redesign extends, not a one-off.
- **Reset Phase 1** — the quiet-aside pattern (coachhint/subbanner) and numeric-only mono discipline. Correct grammar, reusable.
- **Reset Phase 2** — the elevated-hero rim (evidence-based, not fill-only) and tinted status tags. Right calls, and the contrast math established there is a reusable standard.

**What did NOT go far enough (be honest):**
- Every phase so far has softened *individual elements*. None has changed the **composition** of the active-workout screen — which is where the "console/checklist" read actually lives. Softening a border on a set row doesn't stop a *grid of bordered rows* from reading as a spreadsheet. The problem is structural, and structural problems can't be micro-phased away.
- Phase D (home) and Phase 2 (tags/hero) improved home meaningfully, but the active workout — the screen a paying user spends 95% of their time in — is essentially untouched in *composition* terms.

**What should NOT be over-protected:**
- The set-row grid layout (`24px 54px 88px 1fr 44px` + per-row border + dashed weight input). It works and tests pass — but "works + tests pass" is not "feels like a paid coach." This is the thing most in need of a genuine rethink, and I should not defend it just because it's functional.
- The livebar's "LIVE • CHEST • BACK • SHOULDERS" tactical top bar. It's the first thing you see in a session and it reads instrument-panel.

---

## 4. What visual language is wrong

**Visual design + brand lens** — the repeated patterns that produce the "technical console" read, each tied to concrete selectors.

1. **Border-first containers on the workout screen.** `.card`, `.setrow`, stat cells — every unit is an outlined box. A screen full of outlined boxes reads wireframe/spec-sheet. (Home/week already fixed in Phase 2; the workout screen is not.)
2. **Checklist/grid set rows.** `.setrow` is a fixed-column data grid with a dashed placeholder input — literally spreadsheet-cell grammar. This is the strongest single "checklist not coaching" signal.
3. **Console/livebar.** `.livebar` — uppercase tracked-out label + status dot + hard bottom border + bordered "End" button = instrument cluster.
4. **Rest timer as a device.** `.resttimer` — a fixed card with nested borders (card → track → fill) reads countdown-console, not coach cue.
5. **Uppercase density on one screen.** Block headers + livebar label + stat labels + set-column headers all uppercase at once = military signage. (The *technique* is fine — Phase 2 kept legitimate overlines — the *stacking on the workout screen* is the fault.)
6. **Destructive-dialog bleed.** The readiness prompt inherits the `.confirm__title` red + warning-triangle dialog family built for "Erase all data." A calm daily check-in should never borrow alarm chrome. (Logged as debt since Phase A.)
7. **Residual mono adjacency.** Numbers-as-mono is correct, but on the workout screen the sheer quantity of mono numerals next to uppercase labels tips the whole screen toward "terminal."

None of these are logic. All are markup/CSS. But 1–3 are *compositional* — they can't be fixed by softening tokens; the screens must be re-laid-out.

---

## 5. What visual language should replace it

**Visual design + brand + accessibility lens** — the target language, anchored to the Phase C coach-note as the north star and the mockup as finish-level reference (not layout).

- **Surfaces:** surface-first, not border-first. Separation via fill/elevation (`--surface` → `--surface-2` → `--surface-3`) + spacing + radius; borders reserved for interaction/state/safety (the Phase 2 border policy, extended to the workout screen). Elevation carried by fill + a tuned rim, never a drop shadow (`--shadow` stays `none` — flat graphite identity).
- **Hierarchy:** one clear focus per screen. In a session: the current exercise is the hero, everything else recedes. The eye should land on "what am I doing now," then "what's the target," then "log it."
- **Typography:** the Phase B scale, applied so size/weight carry hierarchy — reducing the need for uppercase labels to do that job. Uppercase becomes a rare editorial overline, not the default label style.
- **Card system:** the coach-note treatment (calm surface, brass rule, human voice) generalised into the app's card language, so cards feel *authored*, not *bordered*.
- **Set logging:** a guided row that keeps every datum (set #, prev, weight, reps, effort-on-complete) and every tap, but rendered as a calm coached line rather than a spreadsheet cell — no dashed input, no per-row hard box, clear "next set" focus, generous touch targets.
- **Rest timer:** one calm surface with a single progress indicator and the existing controls (±15s, skip) — de-nested, reads as "your coach is counting you down," not a device.
- **Dialogs:** a *neutral coaching dialog* pattern (warm heading, no alarm iconography) distinct from the destructive-confirm pattern (which stays serious, correctly). Readiness/recovery use the neutral one.
- **Home/session preview:** already close after Phase D/2 — light consolidation only.
- **Brand moments:** unchanged and protected — monogram crossfade, thumbprint restraint (footer/completion only), boot splash. No new brand moments.

**Copy (UX writing lens):** the redesign is visual, but where a container changes from "notice" to "aside," the copy should be re-read for tone (it's mostly already good — coachhint, subbanner, recovery copy are human). No copy rewrites are *required*; any that surface are flagged, not silently changed.

---

## 6. Screen-level redesign map

**Product + usability lens** — each screen classified by intervention, with the paying-user justification and risk. "Improves for paying user" is the mandatory test.

| Screen | Verdict | Why | What improves for the paying user | Risk |
|---|---|---|---|---|
| **Active workout (overall composition)** | **Heavy redesign** | The composition, not just elements, reads console/checklist. This is the 95%-of-time screen. | The screen they live in stops feeling like a data-entry tool and starts feeling like a coach walking them through the session. | **High** — most interactive, closest to logging mechanics. |
| **Set logging (`.setrow`)** | **Heavy redesign** (visual only, same data/taps) | Spreadsheet-cell grammar is the worst offender. | Logging feels guided and calm, not like filling a form — while staying just as fast. | **High** — must not add taps or shrink targets. |
| **Rest timer** | **Redesign** | Nested-border console. | The rest cue feels like a coach counting them down, not an alarm panel. | **Medium** — mechanics (persistence/Wake Lock/±15s) must be untouched. |
| **Livebar / session top bar** | **Redesign** | Tactical instrument read on entry. | First impression of a session becomes calm and premium. | **Medium** — sticky/timer/End-safety behaviour must hold. |
| **Home / session preview** | **Polish** | Already strong post D/2. | Minor consolidation; already premium. | **Low.** |
| **Readiness / recovery dialogs** | **Redesign** (dialog family split) | Alarm-chrome bleed on a calm check-in. | A daily check-in feels like care, not a warning. | **Medium** — same 3-value mechanic, new chrome. |
| **Onboarding** | **Polish** | Copy/pacing already good; container language only. | Consistent premium feel with the rest. | **Low.** |
| **Build / Just Today sheets** | **Polish** | Chip/segment controls are fine; light surface pass. | Cohesive with the new card language. | **Low.** |
| **Settings / About** | **Polish** | Section+control based; no heavy card. | Cohesive, calm. | **Low.** |
| **Completion / recap** | **Redesign (light)** | Cream/thumbprint moment is on-brand; recap stat rows should inherit the new surface language. | The end-of-session payoff feels considered, reinforcing "worth paying for." | **Low–medium.** |
| **Empty states** | **Keep** | Already restrained (thumbprint watermark, honest copy). | — | **None.** |

---

## 7. Reusable design-system components

**Visual design lens** — the redesign should produce a small, named component vocabulary (CSS classes/patterns) so screens agree with each other and future work composes instead of reinventing:

1. **Primary session card** — the home hero (`.today-card`, done: surface-3 + rim).
2. **Active exercise card** — the in-session hero card; surface-first, coach-note-native.
3. **Guided set row** — replaces the grid `.setrow`; same data, calm line.
4. **Coach aside** — generalised from Phase 1 coachhint (calm surface + brass rule).
5. **Neutral coaching dialog** — warm check-in chrome, distinct from destructive-confirm.
6. **Rest cue** — de-nested timer surface + progress + controls.
7. **Status tag** — done (Phase 2 tinted-fill pills).
8. **Sheet section** — build/Just Today/settings section rhythm.
9. **Completion card** — recap surface inheriting the system.

The first two and #3 are the heart of the redesign; the rest are mostly already done or light.

---

## 8. Proposed new implementation plan (three consolidated passes)

**Behaviour-preserving engineering + test engineering lens** — larger passes, each whole-screen, each screenshot-gated, each with a full regression + coach-span diff. All CSS + presentational markup only; no logic, no data.

### Pass 1 — Active workout redesign (the heavy lift)
- **Objective:** turn the session screen from console/checklist into a guided coaching surface.
- **Scope:** livebar/session top bar; active exercise card composition; **guided set row** (replacing the grid `.setrow` layout); effort picker presentation; block headers/counters presentation; coachhint (already done, verify it fits). Rest timer is Pass 2.
- **Selectors likely affected:** `.livebar*`, `.card` (+ `.card__*` on the day view), `.setrow*`, `.setcolhead`, `.card__stats*`, `.phasehead*`, `.blabel`, `.supertag`/superset markup, `.field-label`. Possibly minimal render-string markup changes in `buildCard()`/set-row builder — **flagged and reported before any such change**, CSS-first always.
- **Behaviour guardrails:** every tap that logs a set, edits sets, swaps conditioning, nudges weight, captures effort must be byte-identical in behaviour; touch targets ≥ current (44–52px); no added taps; no data-shape or `__COACH__` change.
- **Visual target:** calm surface-first exercise card; the current exercise is the clear hero; set logging reads as a guided line, not a form; block sections quiet; one focus at a time.
- **Screenshot states required:** all of §10's active-workout states.
- **Regression:** full Node suite; coach-span zero diff; live-verify every logging interaction; console clean.
- **Stop/review gate:** screenshot-approved before Pass 2.

### Pass 2 — Rest cue, dialogs, completion
- **Objective:** the moments around the sets — rest, check-ins, payoff — match the new language.
- **Scope:** rest timer (de-nest); dialog family split → neutral coaching dialog for readiness + recovery (fixes the Phase A/E debt at its root); completion/recap surfaces.
- **Selectors:** `.resttimer*`, `.confirm*`/new neutral-dialog class, `#readinessPromptSheet` markup, `.today-subbanner` (already Phase 1), `.recap*`, `.complete*`.
- **Guardrails:** timer persistence/Wake Lock/vibration/±15s untouched; destructive-confirm pattern stays serious for genuine destructive actions; readiness 3-value mechanic unchanged; completion logic untouched.
- **Visual target:** rest reads as a coach cue; check-ins feel like care; completion feels considered.
- **Screenshots:** rest timer running; readiness prompt; recovery swap; session completion.
- **Regression + gate:** as Pass 1.

### Pass 3 — Consolidation polish
- **Objective:** make every remaining screen agree with the new system.
- **Scope:** onboarding, build/Just Today sheets, settings/about surface pass; home/session-preview final consolidation; verify the component vocabulary is consistent app-wide.
- **Guardrails:** polish only; no structural change.
- **Screenshots:** onboarding steps; build sheet; settings/about; home.
- **Regression + gate:** as above, plus a final full-app screenshot walkthrough.

**Deploy discipline:** the reviewed-but-unpushed backlog (A/B/C/D + Reset 1/2 + these passes) should be committed and shipped in deliberate batches with SW bumps — see §11 risk and §12 Q.

### Continuity with prior planning docs
This master plan **replaces** the old "Reset Phase 3–7" sequence in `2026-07-07-product-feel-audit.md`. Passes 1/2/3 here map onto (audit Phase 3) + (audit Phases 4+5) + (audit Phase 6), with audit Phase 7 (final QA) folded into Pass 3's gate.

---

## 9. What is explicitly out of scope

- All coaching-engine code (`__COACH__` span): selection, prescription, progression, anchors, injury filtering, readiness/recovery logic, build-a-week, Just Today, conditioning swap, block-scoped counters, undo-backed substitution, session-completion logic.
- All interaction mechanics: set logging, effort picker, rest-timer persistence/Wake Lock/vibration/±15s, exercise editing, End/reset safety.
- Data shape, localStorage keys, backup format.
- Brand moments (monogram/thumbprint/splash) beyond ensuring surfaces around them fit.
- The grid background (`--grid`) — leave as-is.
- No new features, flows, settings, dashboards, gamification, photography, icons, or AI.

---

## 10. Screenshot approval gates (must be reviewed before any deploy)

**Test engineering lens** — the exact states to capture and approve. Active workout (Pass 1):
1. Active workout initial state (session just opened)
2. First strength exercise (hero card)
3. Coach note visible
4. Coachhint (RPE/1RM explainer) visible
5. Set not logged
6. Set logged (completed row)
7. Effort picker open
8. Rest timer running *(Pass 2 too)*
9. Edit sets open
10. Conditioning swap open
11. Superset visible

Around-the-session (Pass 2):
12. Home / session preview
13. Readiness prompt
14. Recovery swap
15. Session completion

Consolidation (Pass 3):
16. Settings / About
17. Onboarding steps
18. Build / Just Today sheet
19. Empty state

Each pass ships only after its states are screenshot-approved.

---

## 11. Risks and mitigations

**Product + usability + test + engineering lens.**
- **Losing logging speed** — the redesign must not add taps, add confirmations, or shrink targets. *Mitigation:* Pass 1 live-verifies every logging interaction against current behaviour; targets measured, not assumed.
- **Hiding useful data** — prev-set context, targets, effort, counts must all survive. *Mitigation:* the guided set row is a re-*layout*, not a data cull; §9 lists protected data explicitly.
- **Making the app generic (soft-SaaS)** — removing borders can slide to formless. *Mitigation:* anchor to the coach-note language + tuned rims + brass restraint, not "remove all borders."
- **Making it too soft / overcorrecting into luxury** — *Mitigation:* judged against "private coach," not "expensive"; no shadows, no gold-on-black, no ornament.
- **Breaking state visibility** — done/current/skipped/next must stay obvious. *Mitigation:* Phase 2's tinted-tag + state-border policy carries into the workout screen; contrast-checked.
- **Touching logic accidentally** — the workout screen's markup is engine-adjacent. *Mitigation:* CSS-first; any render-string markup change is flagged and reported *before* editing; coach-span zero-diff enforced every pass.
- **Accumulating too much unpushed visual work** — real and growing (A/B/C/D + Reset 1/2 already uncommitted). *Mitigation:* decide a deploy cadence now (§12 Q4) — batch-commit + SW bump per pass, or one consolidated ship.

---

## 12. Approval questions

1. **Approach:** approve **C (Hybrid)** — keep foundations, consolidate remaining work into the three whole-screen passes (Active workout → Rest/dialogs/completion → Consolidation)? Or do you want A (more micro-phases) or B (full reset)?
2. **Set-row redesign depth:** approve a **full visual rebuild of the set row** (new calm-line layout, identical data + taps), accepting it's the highest-risk item — or a constrained retrofit (keep the grid, only de-border/de-dash)? (Master plan recommends full rebuild; it's the core of the console→coach shift.)
3. **Markup latitude:** Pass 1 may need small presentational markup changes in the set-row/exercise-card render strings (not just CSS). Approve me making them **only when unavoidable, flagged and shown before editing**, with coach-span zero-diff enforced?
4. **Deploy cadence for the backlog:** ship the reviewed-but-unpushed work as **one batched deploy after Pass 1** (foundations + active workout together), per-pass deploys, or hold everything until all three passes are approved?
5. **Dialog split confirm:** approve creating a distinct neutral-coaching-dialog pattern in Pass 2 (fixing the readiness alarm-chrome bleed at its root) rather than continuing to patch `.confirm__title`?

No code until you decide. Nothing is deployed.
