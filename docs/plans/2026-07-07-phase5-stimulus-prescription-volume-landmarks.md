# Phase 5: Stimulus Prescription & Volume Landmarks -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not begin implementation until James has explicitly approved this plan.**

**Note on naming collision:** the codebase already has code comments referring to an earlier, pre-Programming-Philosophy "Phase 5" (`curveFor`/`buildSetPlan`, the per-set ramp-curve mechanism, already shipped). That is unrelated prior work. Everything in this plan is the Programming Philosophy's own Phase 5 ("Stimulus prescription and volume landmarks," §3.4). New code comments in this phase say "Programming Philosophy Phase 5" explicitly to avoid confusion with the existing comments.

**Goal:** Make `prescription()` genuinely stimulus-driven (reps/rest/RIR matched to intent, compound vs. isolation, per §3.4's table) instead of today's ad-hoc per-`goal` branching, and add real weekly volume-landmark tracking (MEV/MAV/MRV per muscle) that quietly caps a set count before it would push a muscle's rolling weekly total past MRV.

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

**Skill lens: coaching reasoning** for the table itself (would an elite coach actually prescribe these rep/rest/RIR combinations for this stimulus + compound/isolation pairing); **behaviour-preserving engineering** for the refactor of `prescription()`, which has several real, already-tested branches (mobility/conditioning/static-hold/carry/Turkish-get-up) that must not change at all.

### Task 2.1: `PRESCRIPTION_TABLE` -- named, stimulus x compound/isolation matrix

**File:** `index.html`, near `prescription()` (~line 2775).

```js
// Programming Philosophy Phase 5, §3.4. Keyed by [stimulus][compound ? "compound" : "isolation"].
// "strength" only has a compound row -- true strength work is never prescribed
// as isolation (matches the existing RAMP_ANCHORS/rampAnchor gate, unchanged).
// Values are the RESTING-STATE, non-deload, non-eased defaults; the existing
// per-exercise RPE-autoregulation and Phase-7 easing layers (buildEx, already
// shipped) still apply AFTER this table runs, exactly as they do today.
var PRESCRIPTION_TABLE = {
  strength:    { compound: { reps: "3-5",   rest: "3 min",   rir: 2 } },
  hypertrophy: { compound: { reps: "6-12",  rest: "2-3 min", rir: 2 },
                 isolation:{ reps: "10-15", rest: "90 s",    rir: 1 } },
  general:     { compound: { reps: "8-10",  rest: "2 min",   rir: 2 },
                 isolation:{ reps: "10-12", rest: "75 s",    rir: 2 } }
};
```

- [ ] **Test-first:** every stimulus present in `PRESCRIPTION_TABLE` has at least a `compound` row; `strength` deliberately has no `isolation` row (asserted explicitly, not just absent by omission).
- [ ] Implement, confirm pass, commit.

### Task 2.2: Refactor `prescription()`'s strength-training branch to consume the table

Only the FINAL branch (the `rirMap`/`anchorSets`/`goal===...` block, ~line 2824-2861) changes. Every earlier branch (mobility, conditioning, static_hold, carry, Turkish-get-up) is **untouched, byte-for-byte** -- those are already correct, already tested, and outside Phase 5's remit (they're not "stimulus-driven strength prescription," they're fixed-format special cases).

```js
// existing anchorSets/accSets week-progression logic (RAMP volume-per-week
// wave) is PRESERVED exactly -- Phase 5 changes reps/rest/RIR, not the
// existing set-count progression across weekNum/isDeload.
var row = (PRESCRIPTION_TABLE[goal] || PRESCRIPTION_TABLE.general);
var isCompoundSlot = anchor || ex.compound;
var stimRow = isCompoundSlot ? row.compound : (row.isolation || row.compound);
var sets = anchor ? anchorSets : accSets;
// rampAnchor (true strength anchor, 3-5) still wins over the table's own
// compound reps for a strength-goal ramping anchor -- unchanged gate from
// before this task, just re-expressed through stimRow instead of a literal.
var reps = rampAnchor ? "3-5" : stimRow.reps;
return { sets: sets, reps: reps, target: target, rest: stimRow.rest };
```

- [ ] **Test-first (regression, run BEFORE any implementation change to prove the baseline):** capture `prescription()`'s exact output for a representative matrix of (goal x anchor x compound x weekNum x isDeload) combinations against the CURRENT code, save as fixtures.
- [ ] Implement the refactor.
- [ ] **Test-first (post-refactor):** re-run the exact same fixture matrix; every value must match the pre-refactor capture EXACTLY (this task is a pure refactor -- it changes HOW the numbers are produced, not WHAT they are, for every case the current table already covers correctly). Any intentional deviation (a genuinely fixed error in the old ad-hoc branching) must be called out explicitly here, not silently changed.
- [ ] Commit.

---

## 3. MRV Trimming (quiet capacity limit)

**Skill lens: coaching reasoning** for the decision itself (an elite coach caps volume before overtraining a muscle, they don't refuse to program legs day); **architecture reasoning** for keeping this strictly a prescription-layer concern, never a selection-layer one (guardrail #2: prescription must never change exercise selection).

### Task 3.1: `trimSetsForVolumeLandmark(sets, muscle, weeklyVolume)`

**File:** `index.html`, near `prescription()`.

```js
// Quiet capacity limit, same idiom as the existing fatigue-budget/deload
// adjustments: reduces SETS ONLY, never touches which exercise was selected
// (that question is already closed -- Phase 4's job, not this one's).
// Never trims below 1 set -- a capped exercise still happens, just lighter,
// exactly like the existing "never leave a session hollow" principle applied
// to volume instead of selection.
function trimSetsForVolumeLandmark(sets, muscle, weeklyVolume) {
  if (!muscle || !weeklyVolume || !weeklyVolume[muscle]) return sets;
  var remaining = weeklyVolume[muscle].remainingToMrv;
  if (remaining >= sets) return sets; // plenty of headroom, no trim needed
  return Math.max(1, Math.floor(remaining));
}
```

- [ ] **Test-first:** a muscle already at MRV trims a would-be 5-set prescription down to 1 (the floor), never to 0; a muscle with 3 sets of headroom trims 5 sets down to 3; a muscle with full headroom (fresh week) is untouched; a muscle absent from `weeklyVolume` (not in `MUSCLE_VOLUME_LANDMARKS`, e.g. "wrists") is untouched -- landmarks only apply where they were deliberately defined.
- [ ] Implement, confirm pass, commit.

### Task 3.2: Wire into `buildEx()`

**File:** `index.html`, `buildEx()` (~line 2928). Add an optional trailing `weeklyVolume` parameter (backward-compatible, defaults to no trimming when absent -- every existing call site keeps working unchanged until explicitly updated).

```js
// after p = prescription(...) is computed:
var primaryMuscle = ex.primary_muscles && ex.primary_muscles[0];
if (weeklyVolume && primaryMuscle) {
  p = Object.assign({}, p, { sets: trimSetsForVolumeLandmark(p.sets, primaryMuscle, weeklyVolume) });
}
```

Real call sites (`generateSession`, `generateProgram`) pass `computeWeeklyDebt(state).byMuscleVolume` through, the same way `debt`/`fatigueSnapshot` are already threaded as optional trailing context.

- [ ] **Test-first:** end-to-end via `generateSession` -- an athlete whose logged history already has a muscle at MRV gets a visibly reduced set count for an exercise targeting that muscle, compared to an identical athlete with no history; an athlete with no history (fresh week) sees no reduction (regression -- current behaviour preserved when there's nothing to trim).
- [ ] Implement, confirm pass, commit.

---

## 4. Full Verification + Report

**Skill lens: usability and regression checking.**

- [ ] Run the new test file (`tools/tests/test-phase5-prescription-volume.js`) -- confirm all pass, including every required case above.
- [ ] Run the full suite -- confirm every pre-existing file is pass-count-identical to the Phase 4 baseline (33/5/4/13/213/22988/12/11/54/288/369/44), **with special attention to `test-progression.js` (369) and `test-phase-a-blocks.js` (22988)**, since those exercise `prescription()`/`buildEx()` most heavily -- any drift there is the first sign the "pure refactor" claim in Task 2.2 is false.
- [ ] Live-verify: reset SW/caches, boot-check, zero console errors; build a session and confirm displayed sets/reps/rest read sensibly for a compound vs. an isolation accessory at the same goal; log enough sets against one muscle to approach MRV, rebuild, and confirm that muscle's next prescribed exercise shows a visibly reduced set count.
- [ ] Commit locally. **Do not push/deploy or start Phase 6 until James reviews the completion report and approves.**
- [ ] Write the completion report covering: what changed / what deliberately did not change / specialist skill used per task / exact tests added / full regression result / behaviour changes (explicitly: does an injury-free, preference-free, fresh-week athlete see IDENTICAL sessions to Phase 4, proving Task 2.2 was a true refactor) / risks / judgement calls (the 3 above, plus any found during implementation) / architectural observations / scope drift.
