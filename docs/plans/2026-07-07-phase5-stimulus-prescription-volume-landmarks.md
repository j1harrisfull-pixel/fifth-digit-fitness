# Phase 5: Stimulus Prescription & Volume Landmarks -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not begin implementation until James has explicitly approved this plan.**

**Note on naming collision:** the codebase already has code comments referring to an earlier, pre-Programming-Philosophy "Phase 5" (`curveFor`/`buildSetPlan`, the per-set ramp-curve mechanism, already shipped). That is unrelated prior work. Everything in this plan is the Programming Philosophy's own Phase 5 ("Stimulus prescription and volume landmarks," §3.4). New code comments in this phase say "Programming Philosophy Phase 5" explicitly to avoid confusion with the existing comments.

**Goal:** Make `prescription()` genuinely stimulus-driven (reps/rest/RIR matched to intent, compound vs. isolation, per §3.4's table) instead of today's ad-hoc per-`goal` branching, and add real weekly volume-landmark tracking (MEV/MAV/MRV per muscle) that quietly caps a set count before it would push a muscle's rolling weekly total past MRV. **Where today's existing strength-training numbers conflict with the approved Programming Philosophy, the Philosophy wins -- this is a deliberate coaching improvement, not a byte-for-byte refactor.** Only the fixed-format special cases (mobility, conditioning, static holds, carries, Turkish get-up) are preserved unchanged, because those sit outside stimulus-driven prescription entirely, not because "preserve behaviour" is the default for this phase.

**Architecture:** Prescription is a pure consumer of an already-fully-selected exercise (Programming Philosophy layering: Athlete → Intent → Blueprint → Selection → **Prescription** → Progression → Learning). It reads `intent.primary.stimulus`, the exercise's own compound/isolation nature, and a rolling weekly-volume snapshot -- and produces sets/reps/rest/RIR. It never selects, re-ranks, or replaces an exercise. Hard constraints (injuries/equipment/skill), soft constraints (recency/preference/debt), ranking, and prescription remain four distinct decision types that never merge into one scoring system.

---

## 0. Phase boundary (read this before writing any code)

**Phase 5 owns:**
- The reps/rest/RIR table itself, driven by `intent.primary.stimulus` + exercise compound/isolation, replacing today's per-`goal` ad-hoc branching in `prescription()`.
- Weekly volume-landmark tracking (MEV/MAV/MRV) per muscle, extending `computeWeeklyDebt`'s existing (primary-muscle-only, target-less) `doneMus` counter.
- Secondary-muscle set crediting (a compound lift counts toward its secondary muscles too, at a documented fractional weight).
- Quietly trimming a prescribed set count when it would push a muscle's rolling weekly total past MRV.

**Phase 5 explicitly does NOT touch:**
- Exercise selection, ranking, pool tiers, recency, learned preference (Phase 4, already shipped). Prescription runs strictly AFTER an exercise is already chosen -- it is never a reason to change WHICH exercise was picked.
- Anchor identity, freezing, progression, or deload (Phase 3). The anchor's own weight-progression mechanism is untouched; Phase 5 only touches the SETS/REPS/REST/RIR numbers around it, using the exact same inputs (stimulus, compound-ness) as every other exercise.
- Injury/equipment/skill hard filtering (Phase 4) -- prescription never re-evaluates whether an exercise is safe or available; that question is already closed by the time prescription runs.
- The per-set ramp-curve mechanism (`curveFor`/`buildSetPlan`, pre-existing) -- Phase 5 changes the SOURCE numbers (sets/reps/rest string) that feed into that mechanism, not the curve math itself.

If implementation reveals a case that seems to require touching exercise selection to satisfy a volume landmark, **stop and raise it** -- Phase 5 must trim/adjust prescription, never swap exercises.

**Judgement calls resolved before this plan was finalised (asked, not guessed):**

1. **Stimulus vocabulary scope.** The spec's table has 5 stimulus rows (Strength / Tension-compound / Tension-isolation / Pump / Power), but `buildIntent()` (Phase 2, already shipped) only derives 3 real stimulus values today (`strength` / `hypertrophy` / `general`) -- "Pump" and a first-class "Power" stimulus don't exist in Intent yet, only a `wantsPower` boolean used for purpose-slot routing. **Decision: Phase 5 stays inside today's 3 real stimuli** and builds a genuine compound/isolation-aware rest+RIR table for them; the existing `wantsPower`/`velocity_or_load` signal is used only as a narrow override for power-pattern lifts (unchanged from today's `curveFor` power handling). Extending Intent's own stimulus vocabulary to add real Pump/Power stimuli is flagged as **future Intent work**, not built here -- doing it now would mean Phase 5 reaching back into Phase 2's already-approved function.
2. **Secondary-muscle volume credit.** A compound lift's secondary muscle (e.g. Bench Press → triceps) credits **0.5 sets** toward that muscle's weekly volume, not 0 (spec: "compound lifts should contribute intelligently to multiple muscle groups") and not 1.0 (would over-credit incidental work as equal to a direct set).
3. **MRV enforcement.** When a muscle's rolling weekly volume would exceed MRV if an exercise's full prescribed sets were logged, prescription **quietly trims the set count** to fit under the landmark -- the same quiet-adjustment idiom the app already uses for fatigue budget and deload, not a new visible UI surface.
4. **Non-ramp-anchor default reps for `strength`, and the accessory table redirect (discovered during implementation, reported here rather than silently coded around).** The true 3-5 rep max is a property of a RAMP ANCHOR specifically (a lift genuinely being worked up to a top set), not of the `strength` stimulus in general -- a non-ramp compound anchor (e.g. a goblet squat leading a day, or a lift not in `RAMP_ANCHORS`) was never 3-5 reps even before this phase. So `PRESCRIPTION_TABLE.strength.compound.reps` is **`"6-8"`** (the non-ramp-anchor default), and the genuine 3-5 max is supplied ONLY by the existing `rampAnchor` override in Task 2.2, scoped to `goal === "strength"` exactly as it was pre-Phase-5. Separately, because `strength` has no `isolation` row (judgement call: true strength work is never isolation), a non-anchor (accessory) slot in a strength-goal session has no bracket of its own to read -- it borrows the `hypertrophy` bracket via a `tableGoal` redirect (`goal === "strength" && !anchor ? "hypertrophy" : goal`), matching real coaching practice: accessories in a strength block are hypertrophy-style assistance work, not more max-effort work. Getting either of these wrong (a flat `"3-5"` in the table, or no redirect) reintroduces a real bug: every strength-goal accessory and every non-ramp strength anchor would wrongly get 3-5 reps. This was caught during implementation by the full regression suite, not the new test file alone -- see Section 4.

---

## 1. Weekly Volume Landmarks (data modelling + strength & conditioning reasoning)

**Skill lens: data-modelling discipline** for the tracking structure (extending an existing, working function without breaking its current callers); **strength & conditioning reasoning** for the landmark numbers and secondary-credit weighting themselves.

### Task 1.1: `MUSCLE_VOLUME_LANDMARKS` -- named constants, not magic numbers

**File:** `index.html`, near `WEEKLY_SET_TARGETS` (~line 4041).

Landmarks only apply to muscles where weekly-set-count programming is a real, established practice (major hypertrophy-relevant muscle groups). Joint/stabiliser tags that already exist in `primary_muscles`/`secondary_muscles` (`ankles`, `wrists`, `neck`, `spine`, `hips`, `shins`, `forearms`, `full body`) are deliberately NOT given landmarks -- inventing MEV/MAV/MRV numbers for "ankles" would be exactly the kind of silently-invented coaching behaviour the guardrails prohibit.

```js
// Programming Philosophy Phase 5, §3.4: weekly volume targets, sets per muscle.
// MEV = minimum effective volume, MAV = maximum adaptive volume, MRV = maximum
// recoverable volume. Named constants (not inlined numbers) so a later phase
// can make these athlete-specific (experience, recovery, age) without
// touching the functions that consume them.
var MUSCLE_VOLUME_LANDMARKS = {
  chest:      { mev: 8,  mav: 14, mrv: 20 },
  back:       { mev: 10, mav: 16, mrv: 22 },
  shoulders:  { mev: 8,  mav: 14, mrv: 20 },
  biceps:     { mev: 8,  mav: 14, mrv: 20 },
  triceps:    { mev: 8,  mav: 14, mrv: 20 },
  quads:      { mev: 8,  mav: 16, mrv: 22 },
  hamstrings: { mev: 8,  mav: 14, mrv: 20 },
  glutes:     { mev: 8,  mav: 14, mrv: 20 },
  calves:     { mev: 8,  mav: 14, mrv: 20 },
  core:       { mev: 8,  mav: 14, mrv: 20 }
};
var SECONDARY_MUSCLE_CREDIT = 0.5; // judgement call #2 -- see plan header
```

- [ ] **Test-first:** every key in `MUSCLE_VOLUME_LANDMARKS` satisfies `mev < mav < mrv` (a structural sanity check preventing a future typo from inverting the landmarks).
- [ ] Implement, confirm pass, commit.

### Task 1.2: Extend `computeWeeklyDebt`'s muscle crediting (primary + secondary)

**File:** `index.html`, `computeWeeklyDebt()` (~line 4074). **Skill lens: behaviour-preserving engineering** -- this function already has real callers (the debt-hint banner, the ranker's debt term); the existing `byPattern`/`ranked`/`byMuscle` (primary-only) outputs must not change shape or values for anything that already reads them. This is purely additive: a new `byMuscleVolume` key on the return object.

```js
// existing per-exercise loop, inside the `if (!done) return;` guard, alongside
// the existing primary-muscle crediting:
var pm = lib.primary_muscles && lib.primary_muscles[0];
if (pm) doneMus[pm] = (doneMus[pm] || 0) + done;
// NEW: secondary muscles credit at SECONDARY_MUSCLE_CREDIT (0.5), never full --
// "compound lifts contribute intelligently to multiple muscle groups" (§3.4),
// without over-crediting incidental work as equal to a direct working set.
(lib.secondary_muscles || []).forEach(function (sm) {
  doneMusSecondary[sm] = (doneMusSecondary[sm] || 0) + done * SECONDARY_MUSCLE_CREDIT;
});
```

```js
// after the existing byPattern/ranked construction:
var byMuscleVolume = {};
Object.keys(MUSCLE_VOLUME_LANDMARKS).forEach(function (m) {
  var landmarks = MUSCLE_VOLUME_LANDMARKS[m];
  var done = (doneMus[m] || 0) + (doneMusSecondary[m] || 0);
  var band = done >= landmarks.mrv ? "at-or-over-mrv" : done >= landmarks.mav ? "in-mav" : done >= landmarks.mev ? "in-mev" : "under-mev";
  byMuscleVolume[m] = { done: done, mev: landmarks.mev, mav: landmarks.mav, mrv: landmarks.mrv, band: band, remainingToMrv: Math.max(0, landmarks.mrv - done) };
});
return { byPattern: byPattern, byMuscle: doneMus, byMuscleVolume: byMuscleVolume, ranked: ranked };
```

- [ ] **Test-first:** a session logging a compound bench-press-family lift credits its secondary muscle (triceps) at exactly 0.5x the completed-set count, while its primary muscle (chest) still credits at the existing 1.0x (regression: unchanged from before this task); `byMuscleVolume` bands correctly as `under-mev`/`in-mev`/`in-mav`/`at-or-over-mrv` at the exact boundary values; a muscle with zero logged sets reads `under-mev` with `done: 0` (never `undefined`, never a crash); the EXISTING `byPattern`/`byMuscle`/`ranked` outputs are byte-for-byte unchanged for a fixture that predates this task (regression proof this is additive-only).
- [ ] Implement, confirm pass, commit.

---

## 2. Stimulus-Driven Prescription Table

**Skill lens: coaching / S&C reasoning** for the table itself and for identifying exactly where today's ad-hoc branching conflicts with the approved Programming Philosophy; **architecture reasoning** for keeping the improvement strictly inside the Prescription layer (it changes HOW WELL an already-chosen exercise is prescribed, never WHICH exercise was chosen).

> **Revision note (post-review):** this section originally framed Task 2.2 as a byte-for-byte "pure refactor." That was wrong and has been corrected. **Phase 5 exists to make prescription genuinely stimulus-driven, and where today's ad-hoc branching conflicts with the approved Programming Philosophy, the Philosophy wins.** Only the special-case branches (mobility, conditioning, static holds, carries, Turkish get-up) stay byte-for-byte unchanged -- those are fixed-format cases outside stimulus prescription entirely, not the part of `prescription()` this phase is improving. The strength-training branch is explicitly allowed, and expected, to change.

### Identified conflicts between today's code and the approved Philosophy (coaching reasoning)

Read against §3.4's table, today's strength-training branch has three real conflicts, not just a different code shape:

1. **Accessories get a flat bracket regardless of their own compound/isolation nature.** Today, EVERY strength-goal accessory gets `8-10 reps / 90s rest`, whether it's a compound movement (e.g. a secondary Romanian Deadlift) or an isolation movement (e.g. a Bicep Curl). The Philosophy's table prescribes accessories by their OWN role: a compound accessory should train in the Tension-compound band (6-12 reps, 2-3 min rest), an isolation accessory in the Tension-isolation band (10-15 reps, 60-120s rest). Today's flat middle-ground under-reps isolation work and under-rests compound work. **This is the central fix Phase 5 makes.**
2. **Hypertrophy compound anchors are pinned at a narrow 6-8 reps**, never using the rest of the Philosophy's 6-12 Tension-compound band. Phase 5 lets compound work move across the full band (still tightened by the existing week-wave RIR progression), rather than a single fixed bracket regardless of where the block sits.
3. **RIR is not a real field.** Today it only exists baked into a display string (`"Effort 8 · 2 reps left"`) driven by a `weekNum`-keyed `rirMap` that has no connection to stimulus at all -- a beginner's isolation Bicep Curl and an advanced lifter's heavy Back Squat get the exact same RIR wording purely because they're in the same week number. Per guardrail #5, RIR is part of prescription and must be surfaced as a genuine numeric field, not an implicit string.

These three deltas are the intentional coaching improvements this task makes; they are documented here, and must be documented again, explicitly, in the Section 4 completion report -- not silently absorbed into "refactor."

### Task 2.1: `PRESCRIPTION_TABLE` -- named, stimulus x compound/isolation matrix

**File:** `index.html`, near `prescription()` (~line 2775).

```js
// Programming Philosophy Phase 5, §3.4. Keyed by [stimulus][compound ? "compound" : "isolation"].
// "strength" only has a compound row -- true strength work is never prescribed
// as isolation (matches the existing RAMP_ANCHORS/rampAnchor gate, unchanged).
// rirRange is the STIMULUS BASELINE band (§3.4); the existing week-wave
// progression (Task 2.3) tightens WITHIN this band across weekNum/isDeload --
// the two mechanisms compose, neither replaces the other.
//
// strength.compound.reps is "6-8" -- the NON-ramp-anchor default (see
// judgement call #4, plan header). The genuine 3-5 rep max is a property of
// a true ramp anchor specifically, and is applied ONLY via the `rampAnchor`
// override in Task 2.2, exactly as it was before this phase. Putting "3-5"
// directly in this table would apply it to every strength-goal anchor
// (including non-ramp ones) and, via the tableGoal redirect below, was the
// exact bug caught by the full regression suite during implementation --
// see Section 4.
var PRESCRIPTION_TABLE = {
  strength:    { compound: { reps: "6-8",   rest: "3-5 min", rirRange: [1, 2] } },
  hypertrophy: { compound: { reps: "6-12",  rest: "2-3 min", rirRange: [1, 3] },
                 isolation:{ reps: "10-15", rest: "60-120s", rirRange: [1, 2] } },
  general:     { compound: { reps: "8-10",  rest: "2 min",   rirRange: [1, 2] },
                 isolation:{ reps: "10-12", rest: "75 s",    rirRange: [1, 2] } }
};
```

- [ ] **Test-first:** every stimulus present in `PRESCRIPTION_TABLE` has at least a `compound` row; `strength` deliberately has no `isolation` row (asserted explicitly, not just absent by omission); every `rirRange` is a real `[low, high]` pair with `low <= high`; `strength.compound.reps` is `"6-8"`, NOT `"3-5"` (the true rep-max lives only in the `rampAnchor` override, Task 2.2 -- asserted explicitly so a future edit can't silently reintroduce the table-level bug).
- [ ] Implement, confirm pass, commit.

### Task 2.2: Rebuild `prescription()`'s strength-training branch to be genuinely stimulus-driven (coaching improvement, not a refactor)

**File:** `index.html`, the FINAL branch of `prescription()` (`rirMap`/`anchorSets`/`goal===...`, ~line 2824-2861). Every earlier branch (mobility, conditioning, static_hold, carry, Turkish-get-up) stays untouched -- those are fixed-format special cases, not stimulus prescription, and remain outside this task's remit.

```js
// Accessories now read their OWN stimulus row by their OWN compound/isolation
// nature -- fixing conflict #1 above. The anchor still reads the compound row
// (true strength work is never isolation), and a genuine ramp anchor still
// earns the tightest reps in-band, same coaching intent as before, now
// expressed through the table instead of a bypass literal.
//
// tableGoal redirect (judgement call #4, plan header): "strength" has no
// isolation row, and a non-anchor (accessory) slot in a strength-goal
// session isn't itself a ramp/strength effort -- it's assistance work, so it
// borrows the hypertrophy bracket. Only a true ANCHOR slot stays on the
// strength row.
var tableGoal = (goal === "strength" && !anchor) ? "hypertrophy" : goal;
var row = (PRESCRIPTION_TABLE[tableGoal] || PRESCRIPTION_TABLE.general);
var slotIsCompound = anchor ? true : !!ex.compound;
var stimRow = slotIsCompound ? row.compound : (row.isolation || row.compound);
var sets = anchor ? anchorSets : accSets;
// fixing conflict #2: hypertrophy anchors now use the full compound band via
// stimRow.reps, not a fixed 6-8. The true 3-5 rep max applies ONLY when this
// IS a ramp anchor in a strength-goal session -- matching pre-Phase-5 gating
// exactly (the old code's hypertrophy/hybrid/endurance branches never
// consulted rampAnchor at all; only the old "strength" branch did).
var reps = (goal === "strength" && rampAnchor) ? "3-5" : stimRow.reps;
```

(RIR is computed in Task 2.3, not here -- see that task for how the stimulus `rirRange` and the existing week-wave progression compose into one real number.)

- [ ] **Test-first:** a strength-goal ISOLATION accessory now gets Tension-isolation numbers via the hypertrophy-bracket redirect (10-15 reps / 60-120s), not the old flat 8-10/90s (this assertion must FAIL against the current code before implementation, proving it's a real behaviour change, not a no-op); a strength-goal COMPOUND accessory now gets Tension-compound numbers (6-12 reps / 2-3 min) via the same redirect; a strength-goal NON-RAMP anchor gets 6-8 reps (the table's own default), not 3-5; a strength-goal RAMP anchor still gets 3-5 reps via the `rampAnchor` override, unchanged from before this phase; a hypertrophy-goal compound anchor's reps now come from the full 6-12 band rather than a fixed 6-8, and are NOT affected by `rampAnchor` (matching the old code, which never checked `rampAnchor` outside the strength branch); the anchor/rampAnchor gating logic itself (which exercise counts as the day's anchor, and which anchors are true ramp anchors) is completely unchanged -- Phase 5 only changes how a slot's stimulus is translated to reps/rest/RIR, never which slot is the anchor.
- [ ] Implement.
- [ ] Confirm the new tests pass, and confirm the special-case branches (mobility/conditioning/static_hold/carry/Turkish-get-up) are provably untouched via their own existing passing tests (`test-phase-b-warmup-cooldown.js`, `test-phase-c-density.js`, etc.).
- [ ] Commit.

### Task 2.3: Surface RIR as a genuine structured field (fixing conflict #3)

**Skill lens: exercise programming reasoning.** RIR must compose two real, separate coaching signals rather than replace one with the other: the stimulus's baseline RIR band (`PRESCRIPTION_TABLE[...].rirRange`, "how hard should this KIND of work generally be") and the existing week-wave progression (weekNum 1/2/3+ and isDeload, "how hard should THIS block's week be, given planned overload"). The week-wave is real, already-correct coaching logic (progressive overload tightening effort across a block) -- Phase 5 does not discard it, it gives it a real numeric home instead of an opaque string.

```js
// Week-wave position WITHIN the stimulus's own baseline band, not a fixed
// rirMap disconnected from stimulus. weekNum 1 = easiest (top of band, i.e.
// the HIGHER rir number = more reps in reserve), progressing to the tightest
// (bottom of band) by week 3+; deload returns to the easiest point, eased by
// one full point beyond the band's own top for genuine recovery intent.
function ririForWeek(rirRange, weekNum, isDeload) {
  var low = rirRange[0], high = rirRange[1];
  if (isDeload) return high + 1;
  var step = Math.min(Math.max(weekNum, 1), 3) - 1; // 0, 1, 2 for week 1/2/3+
  var span = high - low;
  return Math.max(low, high - Math.round((span * step) / 2));
}
// rir is the new, real field; `target` becomes a DERIVED display string (one
// source of truth -- no more independent rirMap wording that could drift
// from the actual number).
var rir = ririForWeek(stimRow.rirRange, weekNum, isDeload);
var target = "Effort " + (10 - rir) + " · " + rir + (rir === 1 ? " rep" : " reps") + " left";
return { sets: sets, reps: reps, rir: rir, target: target, rest: stimRow.rest };
```

- [ ] **Test-first:** `ririForWeek` at week 1 returns the top (easiest) of the band; at week 3+ returns the bottom (tightest); deload returns easier than the band's own top; the derived `target` string always matches the numeric `rir` exactly (never two independently-computed values that could disagree); every existing caller that reads `p.target` (the display string) still gets a valid, correctly-worded string -- the field is additive (`rir`), not a breaking rename.
- [ ] Implement, confirm pass, commit.

---

## 3. MRV Trimming (quiet capacity limit, physiologically honest)

**Skill lens: coaching reasoning** for the decision itself (an elite coach caps volume before overtraining a muscle, they don't refuse to program legs day); **architecture reasoning** for keeping this strictly a prescription-layer concern, never a selection-layer one (guardrail #2: prescription must never change exercise selection).

> **Revision note (post-review):** the original draft trimmed against the PRIMARY muscle only. Per guardrail #6, MRV must remain physiologically honest -- a compound lift's secondary-muscle credit (0.5/set, Section 1) can ALSO push a muscle over its own MRV even when the exercise's primary muscle still has headroom (e.g. a triceps-heavy pressing accessory, secondary-credited into an already-near-MRV triceps week). Trimming now evaluates every credited muscle (primary at full credit, each secondary at `SECONDARY_MUSCLE_CREDIT`), not just the primary.

### Task 3.1: `trimSetsForVolumeLandmark(sets, exercise, weeklyVolume)`

**File:** `index.html`, near `prescription()`.

```js
// Quiet capacity limit, same idiom as the existing fatigue-budget/deload
// adjustments: reduces SETS ONLY, never touches which exercise was selected
// (that question is already closed -- Phase 4's job, not this one's).
// Evaluates EVERY muscle this exercise credits (primary at full weight, each
// secondary at SECONDARY_MUSCLE_CREDIT) -- the MOST restrictive muscle wins,
// so a secondary-muscle ceiling can trim an exercise even when its primary
// muscle still has headroom. Never trims below 1 set -- a capped exercise
// still happens, just lighter, exactly like the existing "never leave a
// session hollow" principle applied to volume instead of selection.
function trimSetsForVolumeLandmark(sets, exercise, weeklyVolume) {
  if (!exercise || !weeklyVolume) return sets;
  var affordable = sets;
  var primary = exercise.primary_muscles && exercise.primary_muscles[0];
  if (primary && weeklyVolume[primary]) {
    affordable = Math.min(affordable, weeklyVolume[primary].remainingToMrv);
  }
  (exercise.secondary_muscles || []).forEach(function (sm) {
    if (!weeklyVolume[sm]) return;
    // each SET of this exercise only spends SECONDARY_MUSCLE_CREDIT (0.5)
    // against this muscle, so more exercise-sets fit before its own MRV --
    // divide the muscle's remaining headroom by the credit rate to get how
    // many EXERCISE sets it can actually absorb.
    var affordableForThisMuscle = weeklyVolume[sm].remainingToMrv / SECONDARY_MUSCLE_CREDIT;
    affordable = Math.min(affordable, affordableForThisMuscle);
  });
  if (affordable >= sets) return sets; // plenty of headroom everywhere, no trim needed
  return Math.max(1, Math.floor(affordable));
}
```

- [ ] **Test-first:** a muscle already at MRV (as the exercise's PRIMARY) trims a would-be 5-set prescription down to 1 (the floor), never to 0; a muscle with 3 sets of headroom trims 5 sets down to 3; a SECONDARY muscle near its own MRV trims the exercise even when the primary muscle has full headroom (the physiologically-honest case guardrail #6 requires -- must be a real, passing test, not just asserted in comments); a muscle with full headroom everywhere is untouched; a muscle absent from `weeklyVolume` (not in `MUSCLE_VOLUME_LANDMARKS`, e.g. "wrists") is untouched -- landmarks only apply where they were deliberately defined.
- [ ] Implement, confirm pass, commit.

### Task 3.2: Wire into `buildEx()`

**File:** `index.html`, `buildEx()` (~line 2928). Add an optional trailing `weeklyVolume` parameter (backward-compatible, defaults to no trimming when absent -- every existing call site keeps working unchanged until explicitly updated).

```js
// after p = prescription(...) is computed:
if (weeklyVolume) {
  p = Object.assign({}, p, { sets: trimSetsForVolumeLandmark(p.sets, ex, weeklyVolume) });
}
```

Real call sites (`generateSession`, `generateProgram`) pass `computeWeeklyDebt(state).byMuscleVolume` through, the same way `debt`/`fatigueSnapshot` are already threaded as optional trailing context.

- [ ] **Test-first:** end-to-end via `generateSession` -- an athlete whose logged history already has a muscle at MRV (as either a primary OR a secondary credit) gets a visibly reduced set count for an exercise touching that muscle, compared to an identical athlete with no history; an athlete with no history (fresh week) sees no reduction (regression -- current behaviour preserved when there's nothing to trim).
- [ ] Implement, confirm pass, commit.

---

## 4. Full Verification + Report

**Skill lens: usability and regression checking.**

- [ ] Run the new test file (`tools/tests/test-phase5-prescription-volume.js`) -- confirm all pass, including every required case above.
- [ ] Run the full suite. The bar is NOT "every file must match the Phase 4 baseline exactly" -- Phase 5 deliberately changes strength-training prescription numbers, so a file that directly asserts the OLD reps/rest brackets is EXPECTED to need its assertions rewritten to the new, Philosophy-aligned numbers, and any such rewrite must be listed explicitly in the completion report as an intentional coaching-behaviour change, never silently absorbed. Conversely, a file's pass COUNT staying identical to the Phase 4 baseline is not itself a requirement to preserve -- it is simply the expected result for any file that tests progression/session-structure mechanics rather than the specific numeric brackets this phase changes (e.g. `test-progression.js`, `test-phase-a-blocks.js`), and should be reported as an observation, not treated as a target. The special-case branches (mobility/conditioning/static-hold/carry/Turkish-get-up) must remain byte-for-byte unaffected in every file.
- [ ] Live-verify: reset SW/caches, boot-check, zero console errors; build a session and confirm displayed sets/reps/rest/RIR read sensibly for a compound vs. an isolation accessory at the same goal, and that RIR is now visibly a real number driving the effort text rather than an opaque wording; log enough sets against one muscle to approach MRV (test both as an exercise's primary AND as a secondary credit), rebuild, and confirm that muscle's next prescribed exercise shows a visibly reduced set count. If a case can only be proven via the automated end-to-end test rather than manual UI interaction (e.g. reproducing enough real logged history through the click-driven UI to reach MRV), say so explicitly in the report rather than implying full manual coverage.
- [ ] Check every OTHER place in the codebase that reconstructs an exercise object from a fixed field list (not just `buildEx`) for the same whitelist-drop failure mode that has bitten this codebase before (`session.blocks`, athlete `metrics`/`history`) -- any such site must carry the new `rir` field through explicitly, the same way every other real field is carried through. Report every site found and fixed.
- [ ] Commit locally. **Do not push/deploy or start Phase 6 until James reviews the completion report and approves.**
- [ ] Write the completion report covering: what changed / what deliberately did NOT change (the special-case branches, the anchor/rampAnchor selection gating itself, the week-progression set-count wave) / specialist skill used per task / exact tests added / full regression result, reported as actual observed outcomes (not a pre-committed target) with every intentional numeric behaviour change (the three identified conflicts, plus judgement call #4's non-ramp-anchor default and tableGoal redirect) listed explicitly as coaching improvements, not bugs / whether an injury-free, preference-free, fresh-week athlete now sees DIFFERENT strength-training numbers than Phase 4 (expected: yes, for accessories and hypertrophy-compound anchors specifically -- that is the intended outcome of this phase, not a regression) / every whitelist-drop site found and fixed / risks / judgement calls (the 4 in the header, plus any found during implementation, plus the RIR week-wave formula in Task 2.3) / architectural observations / scope drift.
