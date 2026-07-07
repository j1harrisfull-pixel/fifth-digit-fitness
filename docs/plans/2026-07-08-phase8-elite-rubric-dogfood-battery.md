# Phase 8 (Elite Rubric + Dogfood Battery) — Design Review & Implementation Plan

> **Status: plan only. No code has been written.** Phase 8 is the final
> phase in the Programming Philosophy's build order. Wait for explicit
> approval before any test or implementation work begins.

**Core question this phase must answer:** *can this system reliably prove
that a generated session reads like it was written by a great coach?*
Phase 8 is a quality-control layer, not a feature. It observes the engine;
it never changes what the engine decides.

---

## 1. Specialist skills used, and why

- **Test engineering** — the harness itself is the deliverable; every
  assertion must be deterministic, explainable, and resistant to snapshot
  brittleness. This is the dominant lens for §§2–4 and §9.
- **Software architecture reasoning** — confirming, by reading the actual
  code, that every rubric check can be built by *observing* existing return
  values (already-computed data) rather than reaching into or changing
  Selection/Prescription/Progression/Learning. This is the dominant lens for
  §2 and the phase-boundary sections.
- **Strength & conditioning reasoning** — translating five prose rubric
  dimensions into checkable, non-subjective coaching facts. Dominant lens
  for §5.
- **Safety engineering** — re-verifying, not assuming, that the harness's
  safety sweep actually reaches all 12 known entry points. Dominant lens for
  §9.

Usability reasoning appears only in §10 (the manual checklist is written for
a human reader). Data modelling appears only where a scenario fixture's
shape needs to be precise. Maintainability reasoning governs the Technical
Debt Register reference in §11. No other lens is reached for.

---

## 2. Current-code findings (read directly, not assumed)

Every rubric dimension below is checkable using data the engine **already
produces on every build** — confirmed by reading the actual return shapes:

| Data needed | Where it already exists | Confirmed by |
|---|---|---|
| Per-exercise reason | `buildEx(...)` always sets `.why` (falls back to `defaultWhy(ex)`, never empty) | `index.html:3165` |
| RIR / reps / rest / sets | `prescription()`'s return `{sets, reps, rir, target, rest}`, carried onto every built exercise | `index.html: prescription()` return statement |
| Injury safety | `isExerciseInjuryFlagged(exercise, injuries)` — the ONE shared gate, 12 verified callers (Phase 5.5) | `index.html:1511-1523` header comment, kept current through Phase 7 |
| Weekly volume / MRV | `computeWeeklyDebt(state).byMuscleVolume[m]` → `{done, mev, mav, mrv, band, remainingToMrv}` | Phase 5 |
| Balance signals | `computeWeeklyDebt(state).byBalance` → unilateral/bilateral, anterior/posterior, spinal-load | Phase 6 |
| Fatigue | `computeFatigueState(state)` → `{percent, band, byPattern, byMuscle, hasData}` | Phase 7 (2.1a) |
| Anchor identity | `getAnchorState(athlete, pattern)` → `{exerciseId, weight, ...}` or `null` | `index.html:1577-1581` |
| Honest gaps | `unfilledSlots`/`session.unfilledSlots` — `{patterns, reason}` (Phase 4/5.5) | already-established idiom |
| Session structure | `session.blocks` (Phase A), `session.exercises[].block` | Phase A |

**Conclusion:** Phase 8 needs **zero new engine data**. Every assertion in
§7 below reads a field that already exists on the output of
`generateSession`/`generateProgram`/`recoverySession`/`computeWeeklyDebt`/
`computeFatigueState`. This is the single most important finding — it's why
Phase 8 can be built as pure observation.

---

## 3. What Phase 8 owns

- A deterministic **rubric assertion library** (plain functions, one per
  rubric dimension, each taking an already-built session/program/state and
  returning `{pass, reason}` or a list of violations with explanations).
- A **dogfood scenario fixture set** (fixed requests/athlete profiles/seeds)
  and a script that regenerates sessions for all of them.
- **Failure-message formatting** — turning a rubric violation into a
  specific, actionable sentence (§8).
- A **safety-invariant sweep** across all 12 known entry points, generation
  paths, and swap/filler live-UI functions (§9).
- A **manual dogfood checklist** document (§10) — human-facing, not code.
- Its own completion report (§14).

## 4. What Phase 8 explicitly does not own

- No change to `selectComplementary`, `pickStrength`, or any ranker term.
- No change to `prescription()`, `PRESCRIPTION_TABLE`, or `buildEx`'s
  prescription logic.
- No change to `anchorProgressionDecision`, `freezeAnchor`, or any
  progression/deload decision.
- No change to `isExerciseInjuryFlagged`, `INJURY_KEYWORD_TAGS`, or
  `normalizeInjuryText` (the two known bugs there are Technical Debt Register
  items 10–11 — Phase 8 **tests around** them, documenting current behaviour,
  and does not fix them unless they block the harness itself — see §11).
- No change to `computeFatigueState`, `degradation`, or the balance/spinal-
  load ranker terms.
- No change to `recoverySession`'s content logic (Phase 7, already shipped).
- **No LLM, no subjective grading, no fuzzy "looks good" pass/fail anywhere
  in the automated path.** If a rubric dimension cannot be reduced to a
  deterministic, rule-based check, it is moved to the manual checklist
  (§10), never faked as an automated test.
- No UI, no dashboard, no product analytics.

If implementing any rubric check is found to require changing engine
behaviour, that is a **stop-and-report** event per the standing guardrail,
not a silent workaround.

---

## 5. Proposed elite rubric dimensions

**Skill lens: strength & conditioning reasoning**, translating each prose
dimension from `PROGRAMMING-PHILOSOPHY.md §3.9` into a checkable fact.

### 5.1 Reasoned
- **What is measured:** every exercise in a generated session has a
  non-empty `.why`, and that `.why` is not a hardcoded generic string when a
  real reason was available.
- **Functions/data inspected:** `session.exercises[].why`, cross-checked
  against `defaultWhy(ex)`'s known generic strings ("General accessory
  work", "Conditioning work", "Mobility work") — a real `.why` should only
  equal one of these for exercise TYPES that genuinely have no ranker-
  computed reason (conditioning/mobility, which don't go through
  `selectComplementary`'s ranker), never for a strength-type Selection pick
  that should have a real, specific reason.
- **Pass:** every exercise has `.why.length > 0`; every strength-type,
  ranker-selected exercise has a `.why` that is NOT one of the generic
  fallback strings.
- **Fail:** any exercise with an empty/missing `.why`, or a strength pick
  reduced to a generic fallback (would indicate the "why" pipeline silently
  broke for that pick).
- **Failure message:** `"<Exercise name> in <session name> has no specific
  reason (why="<value>") -- expected a real ranker-derived reason for a
  strength-type Selection pick."`

### 5.2 Right Hard
- **What is measured:** prescription matches the stimulus/goal actually
  requested, and RIR is coherent with the week/deload state.
- **Functions/data inspected:** `PRESCRIPTION_TABLE[stimulus]` cross-checked
  against each exercise's actual `.reps`/`.rest`/`.rir`; `ririForWeek`'s
  known monotonic property (week 1 = easiest RIR, week 3+ = tightest,
  deload = easier than the band's own top).
- **Pass:** every strength exercise's reps/rest fall within the band its own
  stimulus+compound/isolation classification predicts (per §3.4's table);
  RIR decreases (tightens) monotonically from week 1 → week 3 for the same
  anchor pattern in a multi-week program build; a deload week's RIR is
  looser than week 3's.
- **Fail:** a hypertrophy isolation exercise prescribed strength-band reps;
  RIR that doesn't tighten across weeks; a deload week that isn't looser
  than the week before it.
- **Failure message:** `"<Exercise> (stimulus=<x>, compound=<bool>)
  prescribed <reps> reps -- expected <table-defined band> per
  PRESCRIPTION_TABLE."`

### 5.3 Balanced & Injury-Smart
- **What is measured:** the global safety invariant (§9) plus balance
  signals never override safety, and MRV is genuinely respected across a
  full generation pass (Phase 5's per-exercise accumulation, re-verified
  here at the whole-session/whole-week level, not just per-call).
- **Functions/data inspected:** `isExerciseInjuryFlagged` sweep (§9);
  `computeWeeklyDebt(state).byMuscleVolume[m].done` summed across every
  exercise actually placed in a generated week, compared against `.mrv`.
- **Pass:** zero flagged exercises anywhere; no muscle's actual placed
  volume (summed from the real output, not re-derived from internal
  counters) exceeds its `.mrv` by more than the documented floor-of-1
  rounding (Technical Debt Register-adjacent, not a new invariant).
- **Fail:** any flagged exercise appears anywhere; any muscle's real,
  summed placed volume exceeds MRV beyond the floor-of-1 tolerance.
- **Failure message:** `"<Muscle> received <N> total sets across the
  generated week, exceeding MRV of <mrv> by more than the floor-of-1
  tolerance."` / `"<Exercise> appears in <session> despite matching
  athlete's flagged injury <injury.target>."`

### 5.4 Goes Somewhere
- **What is measured:** anchor stability across repeated exposures, and
  progression/deload firing only when the engine's own decision logic says
  it should (never asserting a NEW decision rule — only that the existing
  one is self-consistent across two calls).
- **Functions/data inspected:** `getAnchorState(athlete, pattern).exerciseId`
  before and after a second `generateProgram`/`generateSession` call with
  the SAME athlete object; `anchorProgressionDecision`'s own documented
  action set (`increase`/`hold`/`deload`).
- **Pass:** the frozen anchor's `exerciseId` is byte-identical across two
  consecutive builds for the same athlete/pattern (never silently
  reassigned); a program's deload week (`isDeload === true`, `wn ===
  totalWeeks` per the existing rule) shows measurably eased RIR relative to
  week 3.
- **Fail:** anchor `exerciseId` changes between two builds with no explicit
  reassignment action; a deload week's RIR doesn't ease.
- **Failure message:** `"Anchor for pattern <p> changed from <idA> to <idB>
  across two builds with the same athlete object -- no explicit
  reassignment occurred."`

### 5.5 Session Coherence
- **What is measured:** the session reads as one coaching decision — every
  exercise belongs to the day's declared role/theme (already enforced at
  generation time by `roleFamily` exclusion, re-verified here as an
  OBSERVATION, not a new rule), and `unfilledSlots` is present and
  non-misleading whenever the session came up short.
- **Functions/data inspected:** `session.name`/`session.focus` vs. each
  exercise's real `pattern`/`movement_pattern` (cross-checked against
  `ROLE_PRIMARY`, the same mapping already used by `topUpThinDay`);
  `session.unfilledSlots`.
- **Pass:** every exercise's pattern is a member of the day's own role
  family (or is a mobility/conditioning/finisher exercise, which are
  exempt from role-family membership by design); if `unfilledSlots` is
  non-empty, at least one exercise or block is genuinely short, never a
  false-positive gap report.
- **Fail:** an off-theme exercise present (would indicate the existing
  `roleFamily` exclusion silently broke); an `unfilledSlots` entry with no
  corresponding real gap.
- **Failure message:** `"<Exercise> (pattern=<p>) appears in a <role> day
  but <p> is not in that role's family <ROLE_PRIMARY[role]>."`

---

## 6. Proposed dogfood scenarios

**Skill lens: strength & conditioning reasoning** (choosing realistic,
maximally-informative requests) **+ test engineering** (making each
scenario's fixture precise enough to regenerate deterministically).

Twelve scenarios, matching your list exactly, each defined by: request text
(or Request Object), athlete profile (experience/injuries/prefs/history),
equipment, readiness, and — critically — **expected coaching properties**
(what must be true) and **forbidden outcomes** (what must never be true),
not an exact exercise list.

| # | Scenario | Request | Athlete | Equipment | Readiness | Expected properties | Forbidden |
|---|---|---|---|---|---|---|---|
| 1 | Beginner full-body, 30 min | `{role:"full", minutes:30, goal:"general"}` | `experience:"beginner"`, no history | full gym | none tapped | ≤6 exercises (Phase A time-budget), warm-up+cool-down present, no advanced-skill-tier picks | any `skill_tier==="advanced"` exercise |
| 2 | Intermediate upper strength | `{role:"upper", minutes:60, goal:"strength"}` | `experience:"intermediate"`, 4 weeks of upper history | full gym | none | anchor is a T1/T2 strength lift, rampAnchor gets 3-5 reps, accessories get Tension-band reps | anchor changes across repeated builds |
| 3 | Lower hypertrophy | `{role:"lower", minutes:60, goal:"hypertrophy"}` | intermediate | full gym | none | compound anchor uses full 6-12 band, isolation accessories 10-15 | any 3-5-rep isolation pick |
| 4 | Short 20-min pump | `{role:"upper", minutes:20, goal:"hypertrophy"}` (or density-eligible) | any | full gym | none | density format applied (EMOM/AMRAP) OR a reduced-slot straight session — never a slot count that can't fit the time budget | session exceeding its own Phase-A time budget |
| 5 | Rough-readiness recovery | Just Today, any text | any | full gym | readiness tap = "rough" | `degradation()` returns `"recovery"`; session is `recoverySession()` output: mobility present, Zone 2 present, breathing present (or honestly reported absent), no strength-type exercise unless `pickLightPump` found one safely | any exercise flagged for the athlete's injuries |
| 6 | Shoulder-restricted | any upper/full request | `injuries:[{category:"pain", target:"shoulder"}]` | full gym | none | zero shoulder-flagged exercises anywhere (strength, mobility, conditioning, filler) | any `joint_stress` including "shoulder" or name-matched "shoulder" appears |
| 7 | Knee-restricted lower | any lower/full request | `injuries:[{category:"pain", target:"knee"}]` | full gym | none | zero knee-flagged exercises; honest `unfilledSlots` if the lower day genuinely can't be filled | any knee-flagged exercise, including in the fallback floor path |
| 8 | Equipment-limited home | any request | any | `["bodyweight"]` only | none | every exercise's `equipment==="bodyweight"`; absolute-floor circuit reachable and still safety-gated | any exercise requiring unavailable equipment |
| 9 | Advanced anchor-progression | multi-week `generateProgram` | intermediate/advanced, 4+ weeks logged history with hit-top sets | full gym | none | anchor weight increases week-over-week per `anchorIncrementKg`; deload fires on the final week of a 4-week block | anchor weight increasing on a deload week |
| 10 | Conditioning + strength | `{role:"full", minutes:45, includes:["conditioning"]}` | any | full gym | none | exactly one conditioning piece present, placed away from the heaviest lower day (existing `pickHardConditioningDay` rule, observed not re-tested) | two hard conditioning pieces in one week |
| 11 | Full week build | `generateProgram({days:4, goal:"hypertrophy", weeks:4})` | any | full gym | none | 4 weeks × N sessions, anchors frozen across the block, `balance:null` at block-blueprint time (documented, Technical Debt Register item 5) | any anchor reassignment mid-block |
| 12 | Just Today build | `generateSession` via the live UI path | any | full gym | none | `resolveSpec`→`degradation`→session pipeline produces a valid session; `spec.debt.byBalance` correctly threaded | `generateSession` called with a stale/mismatched `balance` object shape |

**Judgement call (flagged, not decided here):** should dogfood athlete
profiles include a FIXED, versioned set of synthetic logged history (so
"4 weeks of upper history" is a real, reproducible fixture), or should each
scenario start from a fresh athlete every time? I recommend fixed, versioned
fixtures (deterministic, reviewable, diffable) — see §12.

---

## 7. Deterministic assertions per scenario (structure, not snapshots)

**Skill lens: test engineering.** Every scenario in §6 is checked against
the SAME rubric assertion library from §5 (Reasoned / Right-Hard / Balanced /
Goes-Somewhere / Coherence), plus scenario-specific structural assertions.
None of these assert exact exercise names, exact ordering, or exact IDs
unless the scenario's own purpose is anchor identity (scenarios 2, 9) or
safety exclusion (scenarios 6, 7) — matching your explicit instruction.

Representative structural assertions (illustrative, not exhaustive — the
full list is a Phase 8 implementation-time task, not decided here):
- `session.exercises.every(e => typeof e.why === "string" && e.why.length > 0)`
- `session.exercises.every(e => e.type !== "strength" || (typeof e.rir === "number"))`
- `session.exercises.every(e => !isExerciseInjuryFlagged(libEntryFor(e), athlete.injuries))`
- `computeWeeklyDebt(state).byMuscleVolume[m].done <= byMuscleVolume[m].mrv` (within floor-of-1 tolerance) for every tracked muscle
- `getAnchorState(athlete, pattern).exerciseId` unchanged across two builds
- session's own declared time budget (`session.blocks`) sums to within a documented tolerance of `minutes`
- `Array.isArray(session.unfilledSlots) === false || session.unfilledSlots.every(g => g.reason && g.reason.length > 0)`

---

## 8. Failure-reporting approach

**Skill lens: test engineering + usability reasoning** (the reader is a
future engineer, not a machine — the message must be immediately
actionable). Every rubric/structural check returns, on failure, a plain
object `{ dimension, scenario, exercise, expected, actual, message }` rather
than a boolean. The harness's runner collects every failure across every
scenario and prints one line per failure in the exact style your examples
specified:

```
"Shoulder-restricted athlete received Overhead Press via pickConditioning."
"Hypertrophy isolation received 6-8 reps instead of 10-15."
"Recovery session did not include a breathing close."
"Anchor changed from Bench Press to Dumbbell Press without explicit reassignment."
```

No failure is ever reported as a bare "scenario failed" — every message
names the exercise/pattern/muscle, the dimension violated, and the
expected-vs-actual values.

---

## 9. Safety-invariant coverage

**Skill lens: safety engineering.** Re-verifying, not assuming, coverage of
all 12 known entry points (per the Phase 5.5 amendment and its own header
comment at `index.html:1511-1523`, unchanged through Phase 7):

`pickStrength`, `anchorIsAvailable`, `roleFloorMoves`/`absoluteFloorExercises`/
`topUpThinDay` (via `floorMoveSafe`), `pickByType`, `pickMobilityByPatterns`,
`pickPulseRaiser`, `buildWarmupCooldown`'s Box Breathing lookup,
`pickFunctional`, `pickConditioning`, `conditioningAlternatives` (live swap),
`pickFiller` (live rest-time suggestion), `runWorkout`, **plus the Phase 7
addition `pickLightPump`** (13th, already covered by its own Phase 7 tests —
re-swept here as part of the whole-battery invariant, not newly proven).

The Phase 8 safety sweep runs across:
- generation-time sessions (`generateSession`, `generateProgram`)
- recovery sessions (`recoverySession`, all three of its content types)
- warm-up/cool-down (`buildWarmupCooldown`)
- conditioning swaps (`conditioningAlternatives`)
- filler suggestions (`pickFiller`)
- full week builds and Just Today builds (both live-flow entry paths)

**This section explicitly does NOT re-derive the 12(13)-entry-point list
from scratch** — it reuses the already-verified, already-current list,
consistent with "never duplicate a system that already exists."

---

## 10. Manual coach review checklist (not automated, not a pass/fail dependency)

**Skill lens: usability reasoning.** A standalone document
(`docs/DOGFOOD-MANUAL-CHECKLIST.md`, to be created as part of Phase 8's
deliverables, not now), containing exactly the nine questions you specified,
unmodified:

- Does this session feel purposeful?
- Does it match the request?
- Is it the right level of hard?
- Does anything feel random?
- Would I give this to a real athlete?
- Is anything missing?
- Is anything unnecessary?
- Does the flow make sense?
- Would the user understand why they are doing this?

This checklist is run manually against the dogfood battery's OUTPUT (the
same 12 scenarios from §6) after any engine change judged significant enough
to warrant it. It never gates a commit automatically and is never referenced
by any automated test's pass/fail logic.

---

## 11. Technical Debt Register — reference, not action

Per your instruction, Phase 8 does not fix any of the following unless the
harness cannot function without it (none currently block the harness — the
harness tests the CURRENT, documented behaviour of each item, which is
itself valid coverage):

- Epley duplication, LIBRARY lookup duplication — no harness dependency.
- Documentation drift — no harness dependency.
- `isHeavyLowerRole` role-name/content gap — scenario 10's conditioning-
  placement check observes current behaviour; does not assert the
  content-aware behavior the debt item describes as missing.
- `generateProgram`'s `balance:null` — scenario 11 explicitly asserts this
  as CURRENT, documented behaviour (not a bug the harness should catch).
- Conditioning/endurance `joint_stress` gap — scenario 6/7's safety sweep
  will only catch name-substring matches for conditioning content, exactly
  as documented; this is a known, accepted limitation of the sweep for that
  content type, not a harness failure.
- `INJURY_KEYWORD_TAGS` missing `elbow`, `normalizeInjuryText`'s back→spine
  bug — the safety sweep's assertions are written against joint-tag
  matching for the regions that ARE covered, and the harness does not
  claim elbow-region or "back"-substring name coverage it can't provide.
  This is worth a comment in the harness code itself (not a fix) so a
  future reader isn't surprised the sweep doesn't catch these two cases.
- Phase 1/2 retrospective audit — unrelated to Phase 8's scope.

No new Technical Debt Register items were found while producing this plan.

---

## 12. Risks and judgement calls

1. **Fixed vs. fresh athlete history fixtures for scenarios 2/9** (§6) — I
   recommend fixed, versioned fixtures for reproducibility. Needs your
   confirmation.
2. **MRV tolerance for the floor-of-1 rounding** (§5.3) — Phase 5's
   `trimSetsForVolumeLandmark` floors at 1 set even when headroom is 0,
   meaning a muscle can go up to (1 set's worth) over its literal MRV number
   by design. The harness must encode this AS a tolerance, not flag it as a
   failure — confirming this reading is correct, not inventing a new
   tolerance number.
3. **What counts as "off-theme" for Session Coherence** (§5.5) — reusing
   `ROLE_PRIMARY` (already used by `topUpThinDay`) as the source of truth for
   "which patterns belong to this role," rather than inventing a new
   mapping. Needs confirmation this is the right existing system to observe
   against, since `ROLE_PRIMARY` was built for a different purpose (topping
   up thin days) and its coverage of roles is not exhaustive (only push/
   upper/pull/lower/legs/full are keyed — a free-text, role-less request has
   no `ROLE_PRIMARY` entry and this check should simply not apply there,
   not fail).
4. **Whether the dogfood battery runs as its own Node script or as another
   `tools/tests/*.js` file** — I recommend a dedicated
   `tools/dogfood/run-battery.js` (distinct from the existing per-phase
   `tools/tests/*.js` unit/integration suite), since it's conceptually a
   different kind of check (broad scenario sweep + human-readable report)
   rather than a pass/fail unit test — but this is a structural choice
   worth your confirmation before implementation.

---

## 13. Exact test-first implementation tasks (for the future implementation
plan — not started now)

1. **Task 8.1 — Rubric assertion library.** Write failing tests for each of
   the five `assertReasoned`/`assertRightHard`/`assertBalancedInjurySmart`/
   `assertGoesSomewhere`/`assertSessionCoherence` functions against small,
   hand-built fixtures (not full scenarios yet) proving each returns the
   correct pass/fail + message shape. Implement. Regression: none possible
   yet (new file). Live verification: not applicable (pure data functions).
2. **Task 8.2 — Dogfood scenario fixtures.** Write the 12 scenario
   definitions (request/athlete/equipment/readiness) as data, with a
   regeneration script. Test-first: each fixture must actually produce a
   valid, buildable session/program before any rubric assertion runs against
   it (a basic "does it build" smoke test per scenario).
3. **Task 8.3 — Wire rubric assertions to all 12 scenarios.** Failing tests
   first (assert on the CURRENT engine's real output, since Phase 8 doesn't
   change behaviour — a "failing" test here would indicate the fixture or
   assertion is wrong, not the engine, and must be fixed before proceeding).
4. **Task 8.4 — Safety-invariant sweep across all entry points** (§9),
   reusing the Phase 5.5 entry-point list verbatim.
5. **Task 8.5 — Failure-reporting formatter** (§8), tested against
   deliberately-broken fixtures (e.g. a fixture with a manually-flagged
   exercise inserted) to prove the message format, then removed once proven
   (never left as a permanent "expects a bug" test unless it documents a
   real, accepted current limitation like items in §11).
6. **Task 8.6 — Manual checklist document** (§10), a docs-only deliverable.
7. **Task 8.7 — Full regression suite + live browser verification** (build
   at least 2–3 of the 12 scenarios through the real UI, confirm the harness
   agrees with what's visually rendered) + completion report.

Every task follows: failing test → implement → full 16-file regression
suite → (live verification where applicable) → commit. **Do not push or
deploy until the completion report is reviewed and approved** — same
standing rule as every prior phase.

---

## 14. Completion report template (for when this is implemented)

Matching every prior phase: what changed / what deliberately did not change
(explicitly: no Selection/Prescription/Progression/Safety/Fatigue/Balance/
Recovery logic touched) / specialist skill used per task / exact tests
added / full regression result / any engine bugs the dogfood battery
exposed (reported, not fixed, per your explicit instruction) / Technical
Debt Register changes (expected: none, or additions only if the battery
finds something new) / risks / judgement calls (§12, resolved) / scope
drift (expected: none) / live verification results.

---

## Summary of what needs your approval before implementation begins

1. §6/§12.1 — fixed, versioned athlete-history fixtures vs. fresh-per-run.
2. §5.3/§12.2 — the floor-of-1 MRV tolerance reading.
3. §5.5/§12.3 — reusing `ROLE_PRIMARY` as the coherence source-of-truth,
   with role-less requests exempted rather than failed.
4. §12.4 — a dedicated `tools/dogfood/` location vs. folding into
   `tools/tests/`.
5. The five rubric-dimension definitions in §5 themselves, and the twelve
   scenario definitions in §6 — the substance of the whole plan.

No code has been written. Awaiting your review before any test or
implementation work begins.
