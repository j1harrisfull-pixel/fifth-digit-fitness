# Phase 4: Curated Pools & Ranking -- Implementation Plan (Revision 2 -- safety-hardened)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not begin implementation until James has explicitly approved this plan.**

**Revision note:** Revision 1 gave `pain`/`restricted` injuries a last-resort fallback (allowed back in only if nothing else fit). James rejected this: **never trade safety for a filled slot.** Revision 2 removes that fallback entirely. All four injury categories (`medical`, `nogo`, `pain`, `restricted`) are now hard, unconditional exclusions with zero bypass. If filtering leaves a slot with no safe candidate, the slot is returned unfilled with an honest explanation -- never silently, never with a flagged substitute.

**Goal:** Give every non-anchor slot a real `Role -> Curated Pool -> Ranking -> Selection` pipeline (Programming Philosophy §3.3): hard-filtered by equipment, skill, and injuries (all four categories, no exceptions); ranked by fit-to-intent, weekly debt, recency, and learned preference; never repeating the previous session's variation.

**Architecture:** Extends `pickStrength`'s existing progressive-widening filter/fallback ladder with two new hard-filter tiers (pool tier, injury) and extends `selectComplementary`'s ranker with two new scoring terms (learned preference, recency). The frozen anchor slot is walled off from ranking/preference/recency exactly as in Revision 1, but Phase 4 also extends the anchor's own *availability* check to include injuries -- an injury-flagged frozen anchor must report `needs-substitute`, and that substitute is subject to the identical hard injury filter as every other pick (never a flagged movement, anywhere, for any slot).

**Tech Stack:** Vanilla JS inside `index.html` (coach engine span), Node test harness pattern already used by the other 12 files in `tools/tests/`.

---

## 0. Phase boundary (read this before writing any code)

**Phase 4 may touch:**
- Curated pool tiers (Core / Quality / Fringe).
- Non-anchor ranking (the `ranker()` closure in `selectComplementary`).
- Learned preference consumption (`athlete.prefs`).
- Recency penalty (never repeat the previous session's variation).
- Injury filtering (hard exclusion, all four categories).
- The anchor's *availability check only* (`anchorIsAvailable`), extended to also fail on injury -- this is the one narrow, explicitly-authorized touch to anchor-adjacent code, and it only ever produces `needs-substitute`, never a re-ranking or re-selection of the frozen identity itself.

**Phase 4 must NOT touch:**
- Anchor progression (double progression, exposure recording).
- Prescription math, volume landmarks, set/rep logic.
- Deload logic.
- Weak-point logic (`accessory_weak_point` stays dormant -- Phase 2's marking is untouched).
- Permanent anchor reassignment (still doesn't exist; still not built here).

**Non-negotiable safety rule (verbatim, governs every task below):** if an athlete has marked a movement, joint, region, or exercise as painful, restricted, medical, or no-go, the app must not knowingly prescribe it just to avoid an empty slot. All four categories are **hard blocks** in Phase 4:

| Category | Phase 4 treatment |
|---|---|
| `medical` | hard block, no fallback |
| `nogo` | hard block, no fallback |
| `pain` | hard block, no fallback |
| `restricted` | hard block, no fallback |

There is **no last-resort fallback** for any category. If every candidate for a slot is filtered out, the slot is returned **unfilled**, with an honest reason attached -- a reduced or incomplete session is the correct, safe outcome, never a flagged substitute dressed up as a normal pick. Coach/therapist-approved regressions with structured severity/range-of-motion/safe-substitution logic are explicitly future work, not Phase 4.

**The frozen anchor is protected from ranking, preference, and recency, but not from safety.** Phase 3 already force-selects a frozen anchor without running the ranker. Phase 4 must not weaken that shield against *ranking* -- but it must extend the anchor's *availability* gate to also check injuries, exactly like equipment/skill already do. An injury-flagged frozen anchor is not "available" and must report `needs-substitute`, falling through to the same hard-filtered picker as every other slot. It must never be blindly force-selected onto a flagged exercise.

**Injury-filtering architecture note (temporary bridge, per James's explicit direction):** the matching hierarchy, most to least authoritative:
1. Structured injury tags on the athlete -- **future**, not built now (injuries stay free-text `{category, target}` in Phase 4).
2. Structured exercise metadata tags -- **already exist** in `LIBRARY` (`joint_stress`, `primary_muscles`, `secondary_muscles`, `movement_pattern`, `is_unilateral`) and are reused as-is.
3. Normalised keyword/synonym matching against those existing tags -- **the bridge this phase builds.**
4. Exact exercise-name substring match -- lowest priority, existing-data fallback for named-movement injuries.

`isExerciseFlaggedByInjury(exercise, injury)` is the only function that knows about this hierarchy. Every caller just asks "is this exercise flagged for this athlete, yes or no" -- when structured injury objects and richer exercise tags eventually exist, only this function's internals change.

---

## 1. Curated Pool Tiers

**Skill lens: data-modelling discipline.** Introducing a new classification field on 200 existing records is exactly the kind of change that has bitten this codebase before (the `normalizeProgram`/`session.blocks` whitelist-drop class of bug). The rule applied here: never require a backfill to preserve today's behaviour -- an absent field must resolve to the SAME eligibility every exercise already has, and the new field must be additive-only (explicit override always wins over any derived default).

### Task 1.1: `pool_tier` -- derived default, no 200-entry reclassification

**File:** `index.html`, near `ANCHOR_T1`/`ANCHOR_T2` and `libraryIntegrity()`.

```js
// Pool tier (Programming Philosophy §3.3): Core/Quality/Fringe. Only Core and
// Quality are eligible in normal programming. Every exercise WITHOUT an
// explicit pool_tier defaults to "quality" -- identical eligibility to today,
// zero reclassification risk. Fringe is derived only from two signals that
// were ALREADY the app's "specialist, opt-in" markers (skillAllowed's
// skill_tier gate; opts.avoidAcc's accommodating-resistance gate) -- naming an
// existing distinction, not inventing a new content audit.
function poolTierOf(exercise) {
  if (exercise.pool_tier) return exercise.pool_tier; // explicit override always wins
  if (ANCHOR_T1[exercise.id]) return "core";
  if (exercise.skill_tier === "advanced" || exercise.accommodating) return "fringe";
  return "quality";
}
```

- [ ] **Skill lens: test-first engineering.** Write the failing tests first: every LIBRARY entry resolves to exactly one of `"core"/"quality"/"fringe"`; a known advanced-skill move resolves to `"fringe"`; a known ANCHOR_T1 id resolves to `"core"`; an ordinary untagged accessory resolves to `"quality"`.
- [ ] Implement `poolTierOf`, confirm tests pass.
- [ ] Extend `libraryIntegrity()` to assert `poolTierOf(e)` is always one of the three valid strings, for every entry (structural sanity, not a content audit).
- [ ] Commit.

### Task 1.2: Wire pool tier into `pickStrength`'s filter

**Skill lens: behaviour-preserving engineering.** This touches the shared `ok()` predicate every existing filter tier depends on -- the new condition must be provably a no-op for every exercise that isn't explicitly Fringe, verified by re-running the full pre-existing suite (Phase-A/progression/stress) for an EXACT pass-count match before and after.

Fringe is excluded by default but is still the last, most-permissive rung in the existing widening ladder (never worse than an empty slot when the ONLY reason nothing fits is the Fringe exclusion itself -- this is a pool-tier concession, not a safety concession, and is unaffected by the injury hard-block below):

```js
var pool = LIBRARY.filter(function (e) { return ok(e, pats, slot.compound, true); });
if (!pool.length) pool = LIBRARY.filter(function (e) { return ok(e, pats, slot.compound, false); });
if (!pool.length) pool = LIBRARY.filter(function (e) { return ok(e, pats, null, false); });
if (!pool.length) pool = LIBRARY.filter(function (e) { return ok(e, ALL_PATTERNS, null, false); });
if (!pool.length) pool = LIBRARY.filter(function (e) { return ok(e, ALL_PATTERNS, null, false, /*allowFringe*/ true); });
if (!pool.length) return null;
```

- [ ] Node test: a slot whose only Quality/Core candidates are exhausted by equipment still finds a Fringe candidate.
- [ ] Node test: a slot with any Core/Quality candidate available NEVER returns a Fringe pick.
- [ ] Node test (regression): full pre-existing suite (`test-progression.js` 369, `test-phase-a-blocks.js` 22988, `test-stress.js` 44, etc.) is pass-count-identical before/after this task, proving the new condition is a behavioural no-op for every non-Fringe exercise.
- [ ] Commit.

---

## 2. Injury Hard-Filtering (all four categories, no fallback)

**Skill lens: conservative coaching / safety reasoning, throughout this entire section.** The governing question for every line here is not "does this fill the slot" but "would an elite, liability-aware coach ever put this in front of an athlete who flagged it." When those two answers conflict, safety wins, unconditionally.

### Task 2.1: Keyword/synonym normalisation + dictionary

```js
// Bridge-tier injury matching (see plan Section 0 for the full hierarchy this
// sits inside). Normalises free-text injury targets so "L shoulder", "left
// shoulder", "shoulders" all resolve the same way.
function normalizeInjuryText(s) {
  return String(s || "").toLowerCase().trim()
    .replace(/\bl\b/g, "left").replace(/\br\b/g, "right")
    .replace(/shoulders?/g, "shoulder").replace(/knees?/g, "knee")
    .replace(/(lower\s*)?backs?|lumbar/g, "spine").replace(/necks?|cervical/g, "neck")
    .replace(/wrists?/g, "wrist").replace(/hips?/g, "hip").replace(/ankles?/g, "ankle")
    .replace(/overheads?|ohp/g, "overhead");
}
// Keyword -> the exercise METADATA fields it should be checked against.
// Reuses LIBRARY's existing structured tags (joint_stress/movement_pattern) --
// no new exercise-side authoring required for this tier.
var INJURY_KEYWORD_TAGS = {
  shoulder: { joints: ["shoulder"] }, knee: { joints: ["knee"] }, spine: { joints: ["spine"] },
  neck: { joints: ["neck"] }, wrist: { joints: ["wrist"] }, hip: { joints: ["hip"] }, ankle: { joints: ["ankle"] },
  overhead: { patterns: ["vpush"] }
};
```

- [ ] **Test-first:** `normalizeInjuryText("L Shoulder")`/`"shoulders"`/`"left shoulder"` all normalize identically; `"lower back"`/`"lumbar"` both normalize to include `"spine"`; an unrecognised phrase passes through unchanged (fails safe -- never throws, never silently matches everything).
- [ ] Implement, confirm pass.
- [ ] Commit.

### Task 2.2: `isExerciseFlaggedByInjury(exercise, injury)` -- one function, one hierarchy, replaceable later

```js
function isExerciseFlaggedByInjury(exercise, injury) {
  var norm = normalizeInjuryText(injury.target);
  if (norm && exercise.name.toLowerCase().indexOf(norm) >= 0) return true; // Tier 4: named movement
  var tokens = norm.split(/\s+/);
  for (var i = 0; i < tokens.length; i++) {
    var tags = INJURY_KEYWORD_TAGS[tokens[i]]; if (!tags) continue;        // Tier 2/3: metadata + keyword
    if (tags.joints && exercise.joint_stress && tags.joints.some(function (j) { return exercise.joint_stress.indexOf(j) >= 0; })) return true;
    if (tags.patterns && tags.patterns.indexOf(exercise.movement_pattern) >= 0) return true;
    if (tags.patterns && tags.patterns.indexOf(exercise.pattern) >= 0) return true;
  }
  return false;
}
// Phase 4: ALL FOUR categories are hard, unconditional exclusions. No soft tier.
var INJURY_CATEGORIES_ALL_HARD = ["pain", "restricted", "medical", "nogo"];
function isExerciseInjuryFlagged(exercise, injuries) {
  return (injuries || []).some(function (inj) {
    return INJURY_CATEGORIES_ALL_HARD.indexOf(inj.category) >= 0 && isExerciseFlaggedByInjury(exercise, inj);
  });
}
```

(`isExerciseInjuryFlagged` is the ONLY entry point every caller in this plan uses -- `pickStrength`'s filter, the anchor availability check, and the diagnostic "why is this slot empty" check in Task 2.4 all call this one function, so a future swap to structured injury data changes exactly one place.)

- [ ] **Test-first:** a `"shoulder"` injury flags an overhead-press-family exercise via `joint_stress` but not an unrelated leg exercise; a named-movement injury ("Overhead Press") flags that exact exercise via the name-match tier; an injury with unrecognised text flags nothing; **all four categories (`pain`, `restricted`, `medical`, `nogo`) are treated identically by `isExerciseInjuryFlagged`** -- one test per category, same exercise, same result (flagged).
- [ ] Implement, confirm pass.
- [ ] Commit.

### Task 2.3: Wire into `pickStrength`'s filter -- hard block, zero fallback, unfilled-with-reason on exhaustion

```js
function ok(e, pats, comp, useGoal, allowFringe) {
  return e.type === "strength"
    && pats.indexOf(e.pattern) >= 0
    && (useGoal ? e.goals.indexOf(selGoal) >= 0 : true)
    && (!e.accommodating || (selGoal === "strength" && !!(opts.unlocked && Object.keys(opts.unlocked).length)))
    && equipOk(e, allowed)
    && skillAllowed(e, opts.unlocked)
    && !ctx.used[e.id]
    && (ctx.pat[e.pattern] || 0) < patCap
    && !(DEADLIFT_FAMILY.indexOf(e.id) >= 0 && ctx.dl >= dlCap)
    && (comp === null ? true : (comp ? e.compound : !e.compound))
    && (allowFringe || poolTierOf(e) !== "fringe")
    && !isExerciseInjuryFlagged(e, opts.injuries); // hard block, EVERY tier, no bypass, no exceptions
}
```

The injury check is written into `ok()` itself (not a separate ladder rung), so it applies at **every** widening step including the Fringe-allowed rung -- there is no tier of the ladder where an injury-flagged exercise can appear. The ladder's existing terminal `if (!pool.length) return null;` is therefore already the correct "unfilled" behaviour; **Revision 1's extra last-resort rung is deleted, not modified.**

- [ ] **Test-first**, one test per required case:
  - [ ] a `medical` injury on the pool's only candidate -> `pickStrength` returns `null` (slot unfilled), never that exercise.
  - [ ] a `nogo` injury on the pool's only candidate -> returns `null`, never that exercise.
  - [ ] a `pain` injury on the pool's only candidate -> returns `null`, never that exercise, **even though Revision 1 would have allowed it back as a last resort.**
  - [ ] a `restricted` injury on the pool's only candidate -> returns `null`, same as above.
  - [ ] a slot with a `pain`/`restricted`/`medical`/`nogo` injury on ONE candidate, but a second, unflagged candidate available -> the unflagged candidate is returned; the flagged one never appears even as a lower-ranked option.
  - [ ] **no flagged movement is ever returned as a fallback, at any widening tier** -- run every widening tier's `ok()` call directly against a fully-flagged single-candidate pool and confirm every tier returns false, not just the terminal one.
- [ ] Implement, confirm pass.
- [ ] Commit.

### Task 2.4: Honest "unfilled, here's why" reporting

**Skill lens: conservative coaching / safety reasoning** (the reporting must never imply the slot was skipped for an ordinary reason when safety was actually the cause -- "a reduced session is better than unsafe confidence" includes being honest about *why* it's reduced).

A slot that comes back empty needs to say WHY when the reason is safety, not go silent. `selectComplementary` already does `if (!ex) continue;` for an unfillable slot (existing, correct "unfilled" behaviour) -- Phase 4 adds a **diagnostic-only** check (never a re-selection) to attach a reason when injury filtering was the actual cause:

```js
// Diagnostic only -- re-runs the SAME ladder with the injury check removed,
// purely to explain an empty slot. Never selects anything from this result;
// if it finds a candidate, that only means "this slot is empty BECAUSE OF
// safety filtering", which becomes an honest note, not a pick.
function wasSlotEmptiedBySafety(slot, selGoal, allowed, ctx, seedK, patCap, dlCap, opts) {
  var withoutInjuries = Object.assign({}, opts, { injuries: null });
  return pickStrength(slot, selGoal, allowed, ctx, seedK, patCap, dlCap, withoutInjuries) !== null;
}
```

When a slot ends up unfilled AND `wasSlotEmptiedBySafety(...)` is true, push a session-level note (parallel structure to the existing `why`/`anchorPattern`/`isSubstitute` arrays, e.g. `session.unfilledSlots.push({ role: slot role/pattern, reason: "Skipped for safety -- every option for this slot matched a flagged injury/restriction." })`) so the session honestly reports a gap rather than presenting a thinner session with no explanation.

- [ ] **Test-first:** a slot that is empty purely because of equipment (no injury involved) produces NO safety note; a slot that is empty because injury filtering removed the only candidate(s) DOES produce a safety note with an honest, non-alarming explanation.
- [ ] Implement, confirm pass.
- [ ] Commit.

### Task 2.5: Thread `athlete.injuries` through the real call sites

`selectComplementary` already receives `o.athlete` (Phase 3); read `o.athlete.injuries` and pass as `opts.injuries` into every `pickStrength` call it makes, for both ordinary slots and the anchor-substitute path.

- [ ] Node test: end-to-end via `generateSession` -- an athlete with a `nogo` injury on a specific accessory exercise never sees it appear anywhere in a generated session.
- [ ] Commit.

---

## 3. Protecting the Frozen Anchor Boundary (ranking-safe, but not safety-exempt)

**Skill lens: behaviour-preserving engineering for the ranking/preference/recency shield; conservative coaching / safety reasoning for the availability extension.** These are different concerns and must not be conflated in one function: "the anchor is immune to ranking" and "the anchor is immune to safety checks" are NOT the same claim, and only the first one is true.

### Task 3.1: Extend `anchorIsAvailable` to check injuries

**File:** `index.html`, `anchorIsAvailable` (Phase 3).

```js
// Phase 4 extends Phase 3's availability gate with the SAME hard injury check
// every other slot now uses. This does not touch resolveTodaysAnchor's logic
// at all -- it only changes what counts as "available" for the frozen
// identity to be force-selected. An injury-flagged frozen anchor is not
// available; resolveTodaysAnchor already knows what to do with that (report
// "needs-substitute"), because Phase 3 built that path for equipment/skill
// unavailability -- injury is just one more reason the same path exists for.
function anchorIsAvailable(exerciseId, slot, allowed, unlocked, ctx, injuries) {
  var e = LIBRARY.filter(function (x) { return x.id === exerciseId; })[0];
  if (!e || e.type !== "strength") return false;
  if (slot.compound !== null && slot.compound !== undefined && !!e.compound !== !!slot.compound) return false;
  if (!equipOk(e, allowed)) return false;
  if (!skillAllowed(e, unlocked)) return false;
  if (ctx.used[e.id]) return false;
  if (isExerciseInjuryFlagged(e, injuries)) return false; // NEW
  return true;
}
```

The one call site (`selectComplementary`'s anchor branch, Phase 3 Task 4.2) passes `o.athlete.injuries` through to this call, alongside its existing arguments.

- [ ] **Test-first**, exactly the required cases:
  - [ ] frozen anchor normally bypasses ranking (regression -- already covered by Phase 3's tests; re-asserted here so Phase 4's changes can't silently break it).
  - [ ] a negative learned preference on the frozen anchor's exercise does NOT cause it to be replaced.
  - [ ] a recency exclusion (the frozen anchor was also "last session's variation") does NOT cause it to be replaced -- the anchor is exempt from the recency rule entirely, since recency is a ranking/variety concern and the anchor isn't ranked.
  - [ ] an injury flag (any of the four categories) on the frozen anchor's exercise -> `resolveTodaysAnchor` reports `source: "needs-substitute"`, not `"frozen"`.
  - [ ] the temporary substitute chosen for an injury-unavailable anchor does NOT overwrite the frozen identity (`getAnchorState` unchanged, exact same assertion pattern as Phase 3's equipment-unavailability test).
  - [ ] progression history (`exposureCount`/`consecutiveStalls`/`weight`) stays attached to the frozen anchor's id -- unaffected by a substitute session, same as Phase 3.
  - [ ] the substitute itself is never a flagged exercise (it goes through the same hard-filtered `pickStrength`, so this should already hold -- an explicit end-to-end test proves it rather than assuming it).
- [ ] Implement, confirm pass.
- [ ] Commit.

---

## 4. Ranker: Learned Preference + Recency

**Skill lens: strength & conditioning reasoning.** Both additions are soft, tie-breaking signals layered onto an already-safety-and-equipment-filtered pool -- neither should ever be strong enough to override a harder coaching fact (weekly debt, the anchor's own tiering), and neither has any interaction with the injury hard-filter (which has already run by the time the ranker sees a candidate pool at all).

### Task 4.1: Consume `athlete.prefs` in the ranker

```js
var PREF_WEIGHT = 1.5; // a full +/-3 preference swings ~4.5 points -- real, but
                        // never override-strength against debt's up-to-24-point
                        // swing or the anchor-tier bonus, both harder facts.
if (athlete && athlete.prefs) {
  var prefScore = athlete.prefs[canonicalExName(e.name)];
  if (typeof prefScore === "number") s -= prefScore * PREF_WEIGHT;
}
```

- [ ] **Test-first:** given two otherwise-tied candidates, the one with a higher learned preference ranks first; a strongly negative preference does not override a real weekly-debt signal.
- [ ] Implement, confirm pass.
- [ ] Commit.

### Task 4.2: Recency -- never repeat the previous session's variation

```js
// Recency: the exercise most recently logged for THIS pattern, if any --
// excluded from today's candidates for the same pattern, never globally.
// Falls back (never empties a slot for a RECENCY reason -- recency is a
// variety preference, not a safety rule, so it may yield) if it's the only
// real, SAFE candidate.
function mostRecentByPattern(lastLogs) {
  var byName = {}; LIBRARY.forEach(function (e) { byName[e.name.toLowerCase()] = e; });
  var out = {};
  Object.keys(lastLogs || {}).forEach(function (name) {
    var lib = byName[name.toLowerCase()]; if (!lib) return;
    out[lib.pattern] = lib.id;
  });
  return out;
}
```

Wired as one more `ok()` exclusion, on the existing widening ladder -- but positioned so it can NEVER be the reason a slot ends up with a flagged exercise; recency only ever chooses among exercises that already passed the injury hard-filter.

- [ ] **Test-first:** the exercise logged last time for a pattern is excluded from today's candidates for that pattern when a safe alternative exists; allowed back in when it's the only real, unflagged candidate (recency yields before safety ever would, and before the slot would otherwise go unfilled for a mere variety reason).
- [ ] Implement, confirm pass.
- [ ] Commit.

---

## 5. Full Verification + Report

**Skill lens: usability and regression checking** for this entire section.

- [ ] Run the new test file (`tools/tests/test-phase4-pools-ranking.js`) -- confirm all pass, including every required case enumerated above:
  - pool tier (Task 1.1-1.2)
  - injury keyword/synonym normalisation (Task 2.1)
  - `isExerciseFlaggedByInjury`/`isExerciseInjuryFlagged` including all-four-categories-identical (Task 2.2)
  - hard block + zero fallback + no-flagged-fallback-at-any-tier (Task 2.3)
  - honest unfilled-with-reason reporting (Task 2.4)
  - end-to-end injury threading (Task 2.5)
  - frozen anchor: bypasses ranking / preference / recency; injury-flagged anchor reports needs-substitute; substitute never overwrites frozen identity; progression history stays on the frozen id; substitute is never itself flagged (Task 3.1)
  - learned preference + recency ranking terms (Task 4.1-4.2)
- [ ] Run the full suite (`for f in tools/tests/*.js; do node "$f" | tail -1; done`) -- confirm every pre-existing file is pass-count-identical to the Phase 3 baseline (33/5/4/13/213/22988/12/11/54/369/44).
- [ ] Live-verify: reset SW/caches, reload, boot-check, zero console errors; add a `pain` injury against a real accessory exercise in Settings, build a session, confirm it never appears anywhere (not as a pick, not as a fallback); add a `pain` (or any category) injury against the athlete's actual frozen anchor exercise, build a session, confirm the anchor slot uses a genuine substitute (or is honestly reported unfilled if no safe substitute exists) and never the flagged movement.
- [ ] Commit locally. **Do not push/deploy or start Phase 5 until James reviews the completion report and approves.**
- [ ] Write the completion report covering exactly:
  - what changed
  - what did NOT change
  - exact tests added (full list, by task)
  - full test suite result
  - whether generated workout behaviour changed for athletes with NO injuries flagged (should be as close to Phase 3 as possible -- only pool-tier/preference/recency should ever move a pick, never a phantom safety change)
  - anchor-boundary verification (ranking-immune, but injury-availability-extended)
  - injury-filtering verification (all four categories, zero fallback, honest unfilled reporting)
  - any unfilled-slot cases observed during testing/live-verification
  - risks or scope drift
