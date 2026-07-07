# Product Polish Phase 1 — Implementation Plan

> **Status: plan only. No code has been written.** This is a UI/UX-only
> phase against the already-approved Coaching Engine V1. Wait for explicit
> approval before any implementation begins.

**Objective:** the engine is complex; the app should feel simple, calm,
confident, and coach-led. This phase touches trust, clarity, and
coach-led UX only — it does not touch selection, safety filtering,
prescription, progression, anchors, recovery logic, balance, fatigue, or
the dogfood/rubric harness.

---

## 1. Current-code findings (read directly, not assumed)

**Specialist lens: software architecture reasoning.** All six scoped items
live in the UI-rendering script, well outside the `/*__COACH_START__*/` /
`/*__COACH_END__*/` coach span (which ends around line 4673) — confirmed by
line number for every touch point below. Nothing in this plan reaches back
into the coach span.

| # | Item | Current code, verified |
|---|---|---|
| 1 | Onboarding | `#intro` overlay has exactly 2 steps today: `introStep1` (name) and `introStep2` ("how it works"), toggled by `introShowStep(n)` (`index.html:7930`). `introGo` click (`index.html:7972`) calls `openPlan()` directly when `data-build="1"`. No safety/experience step exists. |
| 2 | Injury capture | Settings already has 4 free-text add/remove lists wired through `INJURY_UI_CATS = ["pain","restricted","medical","nogo"]` (`index.html:6717`), each writing `state.athlete.injuries.push({category, target})` (`index.html:7339-7358`) via `renderAthleteSettings()` (`index.html:6718`). This is the exact, only place athlete injuries are mutated. |
| 3 | "Edit sets & swap" label | Hardcoded, identical string for every exercise type at `index.html:6086`: `'...Edit sets &amp; swap</button>'`. The actual "Swap exercise" control only ever renders for `e.type === "conditioning"` (`index.html:6012-6021`, gated on `conditioningAlternatives`). Strength/mobility exercises get the same label with no swap control underneath. |
| 4 | Strength "why" / coach note | **Correction to the original audit finding, verified by reading the code, not assumed:** `showWhy = isInformativeWhy(e.why)` (`index.html:6049`) is **not** type-gated — only the small type-tag pill (`showTag = e.type !== "strength"`, same line) is. `isInformativeWhy` (`index.html:5947`) hides only 4 known-generic strings (`GENERIC_WHY`, `index.html:5946`): `"general accessory work"`, `"mobility work"`, `"conditioning work"`, `"primary lift for today's session"`. Tracing the engine's own reason-priority order (`index.html:2683-2711`, inside `selectComplementary`'s ranker): the anchor slot (`k === 0`) only earns a specific, informative reason (debt-based) if its own pattern happens to be behind this week; otherwise it falls straight through to the literal string `"Primary lift for today's session"` — which is in `GENERIC_WHY` and therefore always hidden. **The real gap is not "strength why is blocked" — it's that the anchor (the one exercise a user most wants a reason for) very often gets exactly the one generic string that the existing, correct declutter logic hides.** See §6 judgement call. |
| 5 | Readiness before scheduled sessions | Readiness (`Rough/So-so/Great`) exists only in the "Just today" tab of the Build sheet, feeding `degradation(fatigue, readinessValue, patterns)` at the moment a fresh session is generated. A **scheduled** week day is generated once, at Build-a-week time (`generateProgram`'s per-week loop, coach span) and its exercises are frozen from then on — there is no existing "regenerate this one day with today's readiness" entry point. `openDay(i)` (`index.html:6512`) is the single function every "open this day" path routes through (hero CTA `index.html:5353`, week-list row `index.html:6521`, post-complete "next day" `index.html:7831`). See §6 judgement call — this is the one item genuinely at risk of needing more than a pure display change. |
| 6 | Exercise counter | `var total_ex = ses.exercises.length;` (`index.html:5962`), rendered as `'Exercise ' + (i+1) + ' of ' + total_ex` (`index.html:6076`) — counts every exercise in the session regardless of block. Each exercise already carries a `.block` field (`"warmup"|"strength"|"conditioning"|"cooldown"`), attached once per session by `attachBlocks()` (Phase A, coach-adjacent but outside the coach span) and used today only for time-budget headers. This field is exactly what's needed to make the counter block-scoped, with no new data. |

---

## 2. Exact functions / UI sections likely to be touched

**Specialist lens: software architecture reasoning** (naming the precise
surface so the eventual diff is auditable against this plan).

- `index.html` intro markup (`#intro`, `#introStep1`, `#introStep2`) + two
  new steps (`#introStep3` safety, `#introStep4` experience) + `introShowStep()`
  / `initIntro()` (`index.html:7930-7982`).
- Settings' existing injury/experience markup and handlers
  (`index.html:1080-1115` inputs, `index.html:6717-6732` render,
  `index.html:7332-7358` wiring) — **reused, not duplicated**, by having the
  new onboarding steps call the same `state.athlete` mutations and the same
  `renderAthleteSettings()` refresh, or by relocating (not copying) the
  existing markup so Settings and onboarding share one implementation.
- `buildCard()` (`index.html:5948-6094`): the `swapHtml`/label construction
  (`index.html:6012-6021`, `6086`), the `subLine`/`showWhy` construction
  (`index.html:6049-6053`), and the `exOverline` construction
  (`index.html:5962`, `6076`).
- `isInformativeWhy()` / `GENERIC_WHY` (`index.html:5946-5947`) — only if the
  §6 judgement call is resolved in favour of un-suppressing the anchor's
  generic string specifically.
- Home hero CTA handler (`index.html:5353`), week-list row open handler
  (`index.html:6521`), and `openDay()` (`index.html:6512`) — the readiness
  prompt's hook point(s).
- A new, small readiness-prompt sheet/dialog (markup + open/close wiring),
  modeled on the existing `#confirmSheet` pattern (`index.html:1194-1202`)
  rather than inventing a new interaction idiom.

---

## 3. What will change

1. Two new, skippable onboarding steps (safety, experience) between the
   existing "how it works" step and the first Build sheet.
2. The Settings injury section gains one simplified primary entry point in
   front of the existing 4 categories (the categories stay, reachable via a
   secondary "more specific?" disclosure).
3. The "Edit sets & swap" label becomes type-aware: conditioning keeps
   "Edit sets & swap"; strength/mobility becomes "Edit sets" (or "Adjust" —
   see §6).
4. Strength cards show an informative `.why` exactly as conditioning/mobility
   already do (this may already be functionally true — see §6 for the
   anchor-specific carve-out decision).
5. A light-touch readiness prompt appears before starting an un-started
   scheduled session; "Rough" reuses the existing recovery pathway; "Okay"/
   "Good"/Skip start the session unchanged.
6. The "Exercise N of total" counter becomes block-scoped ("Strength 2 of 6"
   etc.), using the exercise's existing `.block` field.

## 4. What will not change

- `selectComplementary`, `pickStrength`, any ranker term, `prescription()`,
  `PRESCRIPTION_TABLE`, `buildEx`, anchor freeze/progression logic,
  `computeFatigueState`, `degradation()`'s own decision rule,
  `computeWeeklyDebt`, balance signals, `recoverySession()`'s content logic,
  `isExerciseInjuryFlagged` or any of its 13 verified callers, and the
  Phase 8 rubric/dogfood harness.
- The engine's `.why` strings themselves — no new coaching copy is
  generated; only display logic changes.
- The four internal injury categories (`pain`/`restricted`/`medical`/`nogo`)
  and their data shape — simplification is presentation-layer only.
- Every item explicitly protected in the brief: recovery-flow messaging,
  "Build it anyway," the "Understood: ..." readback, confirm-before-commit
  build preview, inline effort logging, automatic rest timer, home hero
  density, the Settings safety promise, no-login/local-first feel.
- No visual/theme redesign (typography, spacing, colour, card chrome) —
  reserved for the separate visual-polish phase.

## 5. How existing engine behaviour is preserved

**Specialist lens: behaviour-preserving engineering.** Every one of the six
items is either (a) new markup/state that's purely additive and optional
(onboarding steps, simplified injury entry point), or (b) a display-logic
change reading data the engine already produces (`e.why`, `e.block`,
`e.type`) without altering what that data contains. Item 5 is the one item
that risks going further than display — see the judgement call below;
the plan's recommended option reuses `recoverySession()` and `degradation()`
verbatim, calling them from a new trigger point rather than changing what
they do or how they decide.

No task in this phase touches `index.html`'s coach span. A grep-diff check
(`git diff` restricted to the coach-span line range) will be part of the
verification step for every task, the same discipline used in every prior
engine phase.

---

## 6. UX judgement calls needing approval

**Specialist lens: product design + UX writing reasoning.**

**J1 — Onboarding safety question wording and scope.** Recommend using the
brief's suggested copy verbatim: *"Anything we should avoid?"* / *"Add
injuries, painful movements, restricted joints, or anything you don't want
programmed."* / *"You can skip this and change it later."* One single
free-text add list at onboarding time (writing to `category: "pain"` by
default, matching how a first-time user is most likely to describe
something — "my shoulder hurts," not "this is a medical restriction"), with
the other 3 categories only reachable later, in Settings. This mirrors item
2's simplification and avoids introducing a second, different-shaped injury
UI at onboarding time. **Needs your confirmation:** should the onboarding
quick-add default to `category: "pain"`, or should it ask a one-tap
type first?

**J2 — Experience-level step placement and default.** Recommend a single
screen with the same 3 buttons already in Settings (Beginner/Intermediate/
Advanced), skippable, defaulting to leaving `state.athlete.experience`
unset (the engine's own `normalizeAthlete` already defaults unset to
`"intermediate"` — so skipping is genuinely safe and changes nothing).
**Needs your confirmation:** should this step come before or after the
safety question? Recommend safety first (matches a real coach's priority
and the brief's own numbering).

**J3 — "Edit sets & swap" label choice.** The brief offers two options.
Recommend the **type-aware option** ("Edit sets" for strength/mobility,
"Edit sets & swap" for conditioning) over the single neutral "Adjust,"
because it costs nothing extra to implement (the code already branches on
`e.type` at this exact line) and it keeps the label descriptive rather than
vague — "Adjust" doesn't tell a user what's behind the disclosure.
**Needs your confirmation.**

**J4 — Strength "why" / coach note: the real decision.** As found in §1,
`isInformativeWhy` already lets a real, specific strength `.why` through
today — this item's true gap is narrower than the brief assumed. Two
honest options, both satisfying "use the existing `.why` field, no new
copy":
- **Option A (minimal):** no logic change — confirm live that an
  accessory slot with a genuine debt-based reason already shows it on a
  strength card (it should, per the code read), and treat this item as
  "verify and document," not "build." The anchor keeps showing nothing
  when its real reason is the generic fallback, exactly as today.
- **Option B (recommended):** carve the anchor's specific generic string,
  `"Primary lift for today's session"`, out of `GENERIC_WHY` **only when
  `e.type === "strength"` and the exercise is the session's anchor slot**
  (index 0 of the strength block). This is still the engine's own,
  already-existing string — not new copy — and it directly answers the
  brief's own example ("Coach note: Main horizontal push anchor...") in
  spirit: it tells the user this lift leads the day, on the exact card
  where they're most likely to wonder why. Every other generic string stays
  suppressed everywhere, unchanged.
**Needs your decision between A and B before implementation.**

**J5 — Readiness before scheduled sessions: the architecture question.**
This is the item most likely to brush against "stop and report," per your
own instruction, so I'm surfacing it explicitly rather than deciding
silently. A scheduled day's exercises are frozen at Build-a-week time;
there is no existing "re-roll this one day with today's readiness" engine
entry point, because `generateProgram` never re-runs per day. Recommended,
lowest-risk option, using **only already-shipped functions**:
- On tapping Start on an **un-started** scheduled session, show
  *"How are you feeling today?"* (Good / Okay / Rough / Skip).
- **Skip / Good / Okay:** start the existing, already-built session
  unchanged — exactly today's behaviour, just with an extra optional tap.
  (Okay does **not** retroactively ease the already-baked sets; there is no
  existing hook to do that without re-generating, and re-generating would
  risk reshuffling the frozen anchor/accessory picks for that day, which is
  explicitly off-limits.)
- **Rough:** offer to replace *today's instance only* of the scheduled
  session with a freshly-built `recoverySession(allowed, seed, injuries,
  unlocked)` call — the same function, called the same way, that "Just
  Today" already uses. Rough may replace today's scheduled session using
  the existing undo-backed same-slot substitution mechanism. The broader
  week/programme structure is not re-generated, and the change is
  reversible. This mirrors the existing "Build it anyway"/confirm-preview
  pattern exactly, so it stays visually and behaviourally consistent with
  what's already shipped.
**This is the one item where, if you'd rather not touch the scheduled-day
data flow at all in Phase 1, I recommend descoping "Rough" handling to a
follow-up and shipping only the Skip/Good/Okay no-op path plus the prompt
itself this phase.** Needs your explicit decision.

---

## 7. Test plan

**Specialist lens: test engineering.** All tests are UI/state-level
(no coach-span logic is exercised differently); existing Node coach-engine
tests are re-run only to prove zero regression, not because this phase
touches them.

- **Onboarding:** a fresh-state load shows the safety step and the
  experience step, in that order, before the first Build sheet opens;
  skipping either leaves `state.athlete.injuries` empty / `experience`
  unset; entering a value on the safety step produces a real
  `state.athlete.injuries` entry with the correct category, byte-identical
  in shape to what Settings' existing add-flow produces.
- **Injury simplification:** the simplified entry point still calls the
  same underlying write path as today's 4-category flow; a value added via
  the simple entry point is visible (and removable) from the full Settings
  view, and vice versa.
- **Label fix:** a strength/mobility card's disclosure reads "Edit sets"
  (or "Adjust," per J3) and never renders a swap control; a conditioning
  card's disclosure still reads "Edit sets & swap" and still renders its
  swap control exactly as today.
- **Why / coach note:** a hand-built fixture with a genuinely informative
  strength `.why` renders it on the card (proving `showWhy` was never
  actually type-gated); if J4 Option B is chosen, a hand-built anchor
  fixture with the literal generic string renders the coach note, and a
  non-anchor accessory with the same literal string still does not.
- **Readiness prompt:** tapping Start on an un-started scheduled session
  shows the prompt; Skip/Good/Okay open the existing session unchanged
  (exercise list identical before/after); Rough (if J5 is scoped in this
  phase) swaps in a `recoverySession()` build for today only, leaving
  `state.program` untouched, verified by re-reading `state.program` before
  and after.
- **Block-scoped counters:** a session with N warm-up + M strength + P
  conditioning + Q cooldown exercises shows "Warm-up 1 of N," "Strength 1
  of M," etc., summing back to the session's real total.
- **No-engine-change proof:** `git diff` shows zero lines changed inside
  the `/*__COACH_START__*/`/`/*__COACH_END__*/` span; the full existing
  `tools/tests/*.js` suite (19 files) passes with byte-identical assertion
  counts to the pre-Phase-1 baseline.

## 8. Live verification plan

Using the established `/tmp` preview + `preview_*` MCP workflow (reset SW/
caches/localStorage each time):
1. Fresh load → confirm the new safety + experience steps appear, in
   order, before the Build sheet; confirm Skip on both leads straight to
   Build a week working exactly as today.
2. Add an injury via the new simplified onboarding entry point → open
   Settings → confirm it appears in the correct category list.
3. Build a week → open a strength card and a conditioning card → confirm
   the disclosure label difference and confirm swap only appears on
   conditioning.
4. Build a week with a scenario where an accessory has real weekly debt →
   confirm its why/coach-note renders; if J4-B, confirm the anchor's coach
   note renders too.
5. Tap Start on an un-started scheduled day → confirm the readiness prompt
   → test Skip, Okay, and Rough paths → confirm Rough's resulting session
   is recovery-shaped (mobility + light pump + breathing) and the stored
   program is unchanged after returning to the week view.
6. Confirm the Active screen's counters read block-specific values that
   sum correctly against the session's real content.
7. Zero console errors throughout; full regression suite green before any
   commit.

## 9. Risks / possible scope drift

- **J5 (readiness before scheduled sessions)** is the one item that could
  drift into "feels like new engine wiring" if not scoped tightly — the
  recommended option avoids this by reusing `recoverySession()` verbatim
  and never touching `state.program`, but it's still the most structurally
  novel change in this phase and the one most likely to reveal a real gap
  requiring your further input mid-implementation.
- **J4 (why/coach note)** risks scope creep toward "let's just show every
  why" if not held to the narrow, anchor-only carve-out — resist any
  temptation to touch `GENERIC_WHY`'s other 3 entries or the ranker's
  reason-priority order, both explicitly off-limits.
- **Onboarding length:** two new steps risk making onboarding feel like a
  form if not kept visually identical in weight to the existing 2 steps
  (same card, same single-question-per-screen pattern, same skip
  affordance) — explicitly a usability-reasoning constraint on
  implementation, not just copy.
- **Injury simplification (item 2):** must not be allowed to reduce what's
  stored — the underlying 4-category data model and every existing
  Settings entry must keep working exactly as today; the simplification is
  strictly additive (a friendlier front door), never a replacement.

## 10. Completion report template (for when this is implemented)

Matching every prior phase's format: specialist skills used per task /
exact UI sections touched (file:line) / what changed vs. what deliberately
did not (explicitly: zero coach-span diff) / UX decisions made (J1-J5
resolutions) / tests added and their results / full regression result /
live verification results per the 7-step plan above / risks encountered /
any scope drift and how it was handled / deployment status (SW version
bump only if the shipped app actually changed) — held for your review
before any push/deploy.

---

## Judgement calls — RESOLVED (2026-07-09)

1. **J1 — RESOLVED: default to `category: "pain"`.** No type picker at
   onboarding time; one tap, one text field.
2. **J2 — RESOLVED: safety question first**, then experience.
3. **J3 — RESOLVED: type-aware label** — "Edit sets" for strength/mobility,
   "Edit sets & swap" for conditioning.
4. **J4 — RESOLVED: Option B.** Carve `"Primary lift for today's session"`
   out of `GENERIC_WHY` suppression, but only for the anchor slot
   (`k === 0`) of strength exercises. Every other generic string, and every
   non-anchor slot, keeps today's suppression unchanged.
5. **J5 — RESOLVED: full scope.** Ship the readiness prompt on every
   un-started scheduled session; Rough offers a same-day swap to a fresh
   `recoverySession()` build (stored `state.program` untouched); Skip/Good/
   Okay start the existing session unchanged.

No code has been written. Proceeding to implementation per this resolved
plan; the completion report (§10) will confirm each resolution was honored
exactly as decided here.
