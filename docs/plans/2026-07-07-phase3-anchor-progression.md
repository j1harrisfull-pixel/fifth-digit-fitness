# Phase 3: Anchor & Progression -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not begin implementation until James has explicitly approved this plan.**

**Goal:** Give each athlete exactly one frozen anchor lift per movement pattern, with a real double-progression + deload decision engine driving that anchor's working weight -- replacing the generic flat-STEP weight bump currently shared by every exercise, for the anchor only.

**Architecture:** "The athlete owns the anchor." A movement pattern's anchor is chosen once, frozen into `athlete.metrics.anchors[pattern]`, and every later session *consumes* that identity rather than re-selecting it. A pure decision function (`anchorProgressionDecision`) reads the anchor's progression state + this pattern's fatigue band and returns exactly one of `increase | hold | deload`, following a fixed priority hierarchy (fatigue first, then stalled progression, then a 6th-exposure calendar backstop -- never the reverse). The existing per-set curve/prescription math, the existing whole-program deload-week mechanism, and the existing accessory-selection ranker are all left untouched; this phase only changes *which weight the anchor uses* and *when a per-pattern deload is due*.

**Tech Stack:** Vanilla JS inside `index.html` (coach engine span), Node test harness pattern already used by the other 10 files in `tools/tests/`.

---

## 0. Phase boundary (read this before writing any code)

**Phase 3 owns:**
- Frozen anchor identity per movement pattern, persisted on the athlete.
- The freeze-once / consume-thereafter selection rule for the anchor slot only.
- Temporary substitution when the frozen anchor is unavailable for one session (equipment/injury/skill), without altering the frozen identity or its progression state.
- The double-progression decision (increase / hold / deload) for the anchor, including a real smallest-available-increment calculation.
- Recording each anchor exposure (did every working set hit the top of the rep range) after a session is logged.
- Triggering a per-pattern deload (fatigue-red, stalled-progression, or 6th-exposure backstop) and flagging it so the *existing* deload prescription math (already implements the spec's "-40% volume, +1 RIR" via `isDeload`) applies to that one exercise.

**Phase 3 explicitly does NOT touch:**
- Curated pool tiers (Core/Quality/Fringe) or the accessory ranker -- Phase 4.
- Volume-landmark prescription, set/rep/rest curve math itself -- Phase 5 (this phase only supplies a different *weight number* into the existing math for the anchor).
- Block periodisation / mobility-loop / 1RM re-anchoring -- Phase 9/later.
- Anything about non-anchor exercises. Accessories keep today's flat-STEP `suggestedWeight` behaviour exactly as-is.

If implementation reveals a case that seems to require crossing one of these lines, **stop and raise it** rather than quietly proceeding.

**Three concepts that must stay explicit and never blur into one another (James's amendment, approved before coding began):**

| # | Concept | What it is | Lifetime | Where it lives |
|---|---|---|---|---|
| 1 | **Frozen Anchor Identity** | The athlete's long-term chosen anchor for a movement pattern (e.g. `horizontal_push -> bench-press`). | Permanent until an explicit, deliberate reassignment (not built in this phase -- see below). | `athlete.metrics.anchors[pattern].exerciseId`, via `getAnchorState()` / `freezeAnchor()`. |
| 2 | **Today's Anchor Assignment** | The actual exercise object placed in *this* session's anchor slot. Usually equals concept 1. | One session. | The return value of `resolveTodaysAnchor()` (new, Task 4.1) -- never written back into athlete state except through concept 1's own recording path. |
| 3 | **Temporary Substitute** | A one-session-only stand-in used when concept 1 is unavailable (equipment/injury/skill). | One session. Discarded afterward. | Only ever a *value* returned by `resolveTodaysAnchor()`, tagged `source: "substitute"`. It is never written to `athlete.metrics.anchors`, never passed to `recordAnchorExposure`, and never seen by `anchorProgressionDecision`. |

The function that produces concept 2 (`resolveTodaysAnchor`) must return which of concept 1 or concept 3 it used (`source: "frozen" | "substitute"`), so every downstream consumer -- exposure recording, weight suggestion, the per-exercise "why" line -- can tell them apart without re-deriving availability itself. Progression state (exposure count, stall streak, weight) is **only ever read or written keyed by the frozen identity (concept 1)**; a substitute session contributes nothing to it, in either direction.

**Reassignment is explicitly out of scope for Phase 3.** `freezeAnchor()` is freeze-once and there is no `reassignAnchor()` in this phase. If a real need to permanently change an athlete's frozen anchor ever arises (new equipment access, injury retiring a lift for good), that is a deliberate future feature -- almost certainly a Settings-level user action -- never a side effect of any automatic selection or substitution logic. This phase's tests include an explicit assertion that no code path silently overwrites an existing frozen identity.

**Known data gap, disclosed up front:** the ideal "smallest available increment" (tier 1 of the increment rule) would come from per-exercise/equipment metadata (microplate size, machine stack increment, dumbbell jump) that does not exist anywhere in `LIBRARY` today. This plan builds the mechanism to be metadata-driven (checks for it first) but, since the metadata doesn't exist yet, every real exercise will resolve through tier 2 (compound-type default) or tier 3 (existing app fallback) until a future content pass adds it. That follow-up content task is out of scope here and will be flagged as a candidate for a separate task, not silently done inline.

---

## 1. Data Model

**File:** `index.html` (helper span, immediately after `bumpPref`, ~line 1494)

Movement patterns reuse the app's existing short pattern vocabulary (`ALL_PATTERNS`, line 2099) restricted to the six the spec names as anchor-bearing patterns:

```js
var ANCHOR_PATTERNS = ["squat", "hinge", "hpush", "vpush", "hpull", "vpull"];
```

Per-pattern progression state, stored at `athlete.metrics.anchors[pattern]` (the `metrics` field was reserved for exactly this in Phase 1 and is already preserved as-is by `normalizeAthlete`, so no changes to `normalizeAthlete` itself are required):

```js
// athlete.metrics.anchors[pattern] shape:
// {
//   exerciseId: "back-squat",   // frozen identity -- set once, changed only via reassignAnchor()
//   weight: 60,                 // current working weight for this anchor
//   exposureCount: 3,           // exposures since the last deload (resets to 0 after a deload)
//   consecutiveStalls: 1,       // consecutive exposures that did NOT hit the top of the rep range
//   lastResult: "hold"          // "increase" | "hold" | "deload" | null (nothing logged yet)
// }
```

### Task 1.1: Write failing tests for anchor state helpers

**Test file:** `tools/tests/test-phase3-anchor.js` (new file, follows the exact extraction pattern used by every other file in `tools/tests/` -- read `index.html`, slice the helper span `clampInt`..`migrateV1toV2` and the coach span `__COACH_START__`..`__COACH_END__`, concatenate, `new Function('module','exports', src)`).

```js
const { getAnchorState, freezeAnchor, recordAnchorExposure, ANCHOR_PATTERNS, normalizeAthlete } = load();

// getAnchorState returns null when nothing is frozen yet
{
  const a = normalizeAthlete({});
  ok(getAnchorState(a, "squat") === null, "no frozen anchor yet -> null");
}

// freezeAnchor sets identity + starting weight, exactly once
{
  const a = normalizeAthlete({});
  freezeAnchor(a, "squat", "back-squat", 60);
  const s = getAnchorState(a, "squat");
  ok(s.exerciseId === "back-squat" && s.weight === 60 && s.exposureCount === 0 && s.consecutiveStalls === 0, "freezeAnchor sets identity + weight + zeroed counters");
}

// freezeAnchor is a no-op if a pattern already has a frozen anchor -- freeze-ONCE
{
  const a = normalizeAthlete({});
  freezeAnchor(a, "squat", "back-squat", 60);
  freezeAnchor(a, "squat", "front-squat", 40); // should NOT overwrite
  ok(getAnchorState(a, "squat").exerciseId === "back-squat", "freezeAnchor never overwrites an existing frozen anchor");
}

// recordAnchorExposure updates weight/counters and never touches other patterns
{
  const a = normalizeAthlete({});
  freezeAnchor(a, "squat", "back-squat", 60);
  recordAnchorExposure(a, "squat", { hitTop: true, newWeight: 62.5, action: "increase" });
  const s = getAnchorState(a, "squat");
  ok(s.weight === 62.5 && s.exposureCount === 1 && s.consecutiveStalls === 0 && s.lastResult === "increase", "a hit-top exposure bumps weight, increments exposureCount, resets stall streak");
  ok(getAnchorState(a, "hinge") === null, "recording a squat exposure does not create a hinge anchor state");
}

// consecutiveStalls accumulates across non-hit exposures, resets on a hit
{
  const a = normalizeAthlete({});
  freezeAnchor(a, "hinge", "deadlift", 100);
  recordAnchorExposure(a, "hinge", { hitTop: false, newWeight: 100, action: "hold" });
  recordAnchorExposure(a, "hinge", { hitTop: false, newWeight: 100, action: "hold" });
  ok(getAnchorState(a, "hinge").consecutiveStalls === 2, "two consecutive non-hit exposures -> consecutiveStalls 2");
  recordAnchorExposure(a, "hinge", { hitTop: true, newWeight: 105, action: "increase" });
  ok(getAnchorState(a, "hinge").consecutiveStalls === 0, "a hit-top exposure resets the stall streak");
}

// a deload resets exposureCount (the 6th-exposure backstop counts SINCE the last deload)
{
  const a = normalizeAthlete({});
  freezeAnchor(a, "vpush", "overhead-press", 30);
  for (let i = 0; i < 3; i++) recordAnchorExposure(a, "vpush", { hitTop: true, newWeight: 30 + i, action: "increase" });
  recordAnchorExposure(a, "vpush", { hitTop: false, newWeight: 32, action: "deload" });
  ok(getAnchorState(a, "vpush").exposureCount === 0, "a deload exposure resets exposureCount to 0");
}
```

- [ ] **Step 1: Write the failing test file above**
- [ ] **Step 2: Run it, confirm it fails with "getAnchorState is not defined" (or similar)**

Run: `node tools/tests/test-phase3-anchor.js`

- [ ] **Step 3: Implement the three helpers in `index.html`, immediately after `bumpPref` (~line 1494)**

```js
var ANCHOR_PATTERNS = ["squat", "hinge", "hpush", "vpush", "hpull", "vpull"];
function getAnchorState(athlete, pattern) {
  if (!athlete || !athlete.metrics || !athlete.metrics.anchors) return null;
  var s = athlete.metrics.anchors[pattern];
  return (s && typeof s === "object") ? s : null;
}
// Freeze-once: the athlete owns the anchor. Silently ignored if this pattern
// already has a frozen identity -- reassignment is a deliberate future action
// (e.g. a Settings control), never an automatic side effect of a later session.
function freezeAnchor(athlete, pattern, exerciseId, startingWeight) {
  if (!athlete || typeof athlete !== "object") return;
  if (!athlete.metrics || typeof athlete.metrics !== "object") athlete.metrics = {};
  if (!athlete.metrics.anchors || typeof athlete.metrics.anchors !== "object") athlete.metrics.anchors = {};
  if (athlete.metrics.anchors[pattern]) return; // freeze-once
  athlete.metrics.anchors[pattern] = { exerciseId: exerciseId, weight: startingWeight, exposureCount: 0, consecutiveStalls: 0, lastResult: null };
}
function recordAnchorExposure(athlete, pattern, result) {
  var s = getAnchorState(athlete, pattern); if (!s) return;
  s.weight = result.newWeight;
  s.lastResult = result.action;
  s.consecutiveStalls = result.hitTop ? 0 : (s.consecutiveStalls + 1);
  s.exposureCount = (result.action === "deload") ? 0 : (s.exposureCount + 1);
}
```

- [ ] **Step 4: Run the test file again, confirm all assertions pass**
- [ ] **Step 5: Commit**

```bash
git add index.html tools/tests/test-phase3-anchor.js
git commit -m "feat(anchor): frozen per-pattern anchor identity + progression state"
```

---

## 2. Increment Calculation

### Task 2.1: `anchorIncrementKg(exercise)`

Implements the tiered rule James specified: real equipment metadata first (does not exist in `LIBRARY` yet, so this branch is always a documented no-op today, never fabricated), then a compound-type default, then the app's existing generic `STEP`/unit fallback.

```js
// Tier 1: real per-exercise/equipment increment metadata (e.g. e.load_increment_kg).
// Not present in LIBRARY today -- this branch exists so a future content pass can
// populate it WITHOUT touching this function again.
// Tier 2: sensible compound-type defaults.
// Tier 3: the app's existing generic step (kept last, never first, so it never
// silently overrides a smaller/more honest real increment once one exists).
var LOWER_BODY_ANCHOR_PATTERNS = ["squat", "hinge"];
function anchorIncrementKg(exercise) {
  if (exercise && typeof exercise.load_increment_kg === "number" && exercise.load_increment_kg > 0) {
    return exercise.load_increment_kg; // Tier 1 (unpopulated today, see plan note)
  }
  var pattern = exercise && (exercise.movement_pattern === undefined ? exercise.pattern : null);
  if (exercise && exercise.compound) {
    return LOWER_BODY_ANCHOR_PATTERNS.indexOf(exercise.pattern) >= 0 ? 5 : 2.5; // Tier 2
  }
  return 1.25; // Tier 2, isolation/smaller lifts -- smallest common plate total
}
```

Tests (`tools/tests/test-phase3-anchor.js`, appended):

```js
{
  ok(anchorIncrementKg({ compound: true, pattern: "squat" }) === 5, "lower-body compound anchor -> +5kg");
  ok(anchorIncrementKg({ compound: true, pattern: "vpush" }) === 2.5, "upper-body compound anchor -> +2.5kg");
  ok(anchorIncrementKg({ compound: false, pattern: "vpush" }) === 1.25, "isolation/smaller lift -> smallest increment (+1.25kg)");
  ok(anchorIncrementKg({ compound: true, pattern: "squat", load_increment_kg: 1 }) === 1, "real per-exercise metadata (Tier 1), when present, wins over the compound default");
}
```

- [ ] Write the failing tests, confirm failure, implement, confirm pass, commit (same TDD rhythm as Task 1.1).

---

## 3. Progression Decision Hierarchy

### Task 3.1: `anchorProgressionDecision(anchorState, fatigueBandForPattern, hitTopThisExposure)`

Implements James's exact hierarchy: fatigue-red first, stalled progression second, 6th-exposure backstop third, otherwise the ordinary hit/miss double-progression call. `STALL_LIMIT` and `EXPOSURE_BACKSTOP` are named constants so a later phase can make them athlete-specific (experience/age/recovery/injury history) without touching this function's logic, per James's explicit "keep this layered" instruction.

```js
var ANCHOR_STALL_LIMIT = 3;      // consecutive non-hit exposures = "genuinely stalled"
var ANCHOR_EXPOSURE_BACKSTOP = 6; // fixed safety net, lowest priority

function anchorProgressionDecision(anchorState, fatigueBandForPattern, hitTopThisExposure) {
  if (fatigueBandForPattern === "red") {
    return { action: "deload", reason: "This movement pattern is showing high accumulated fatigue." };
  }
  if (anchorState.consecutiveStalls >= ANCHOR_STALL_LIMIT) {
    return { action: "deload", reason: "Progression on this lift has genuinely stalled -- time to reset, not push harder." };
  }
  if (anchorState.exposureCount >= ANCHOR_EXPOSURE_BACKSTOP) {
    return { action: "deload", reason: "Scheduled reset after a sustained run without one." };
  }
  if (hitTopThisExposure) {
    return { action: "increase", reason: "Every working set hit the top of the rep range -- time to add load." };
  }
  return { action: "hold", reason: "Still earning reps at the current weight." };
}
```

Tests -- one per branch, checked in priority order (a case engineered to trigger two rules at once must resolve to the higher-priority one):

```js
{
  var base = { exposureCount: 2, consecutiveStalls: 1 };
  ok(anchorProgressionDecision(base, "red", true).action === "deload", "red fatigue overrides even a hit-top exposure");
  ok(anchorProgressionDecision({ exposureCount: 1, consecutiveStalls: 3 }, "green", true).action === "deload", "3 consecutive stalls trigger deload even when fatigue is green and this exposure hit top (the STREAK already happened; a later hit doesn't erase it until recorded)");
  ok(anchorProgressionDecision({ exposureCount: 6, consecutiveStalls: 0 }, "green", true).action === "deload", "6th exposure backstop fires even with green fatigue and a hit-top result");
  ok(anchorProgressionDecision({ exposureCount: 2, consecutiveStalls: 0 }, "green", true).action === "increase", "green fatigue, no stall streak, under the backstop, hit top -> increase");
  ok(anchorProgressionDecision({ exposureCount: 2, consecutiveStalls: 0 }, "amber", false).action === "hold", "amber fatigue alone does not force a deload (only red does); a miss without a stall streak just holds");
}
```

- [ ] TDD rhythm as above, commit.

---

## 4. Wire Selection: `resolveTodaysAnchor()` -- consume the frozen anchor, substitute or freeze on first use

**File:** `index.html`, new function near `getAnchorState`/`freezeAnchor` (~line 1494), consumed by `selectComplementary()` (~line 2236) and its caller in `generateSession`/`generateProgram` (~line 3550s).

### Task 4.1: `resolveTodaysAnchor(athlete, pattern, isAvailable)`

This is the one function that is allowed to blur concepts 1-3 together -- everything else must consume its output, never re-derive availability itself. `isAvailable(exerciseId)` is a caller-supplied predicate (wraps the existing `pickStrength` `ok()` filters: equipment/injury/skill/dedup) so this function stays pure and Node-testable without needing the full LIBRARY/ctx machinery.

```js
// Concept 2 producer: resolves what goes in TODAY's anchor slot. Concept 1
// (frozen identity) is read-only here -- this function NEVER calls freezeAnchor
// or recordAnchorExposure itself; callers do that explicitly, so the "who is
// allowed to freeze/record" responsibility stays in exactly one place (Task 4.2
// / Section 5), not scattered across every call site that happens to resolve a
// session.
function resolveTodaysAnchor(athlete, pattern, isAvailable) {
  var frozen = getAnchorState(athlete, pattern);
  if (frozen && isAvailable(frozen.exerciseId)) {
    return { exerciseId: frozen.exerciseId, source: "frozen" };
  }
  if (frozen) {
    // Frozen anchor exists but isn't usable today (equipment/injury/skill).
    // Concept 3: caller must pick a substitute via its normal ranker and pass
    // it back in -- this function only reports that a substitute is needed,
    // it does not choose one (it has no access to the exercise pool).
    return { exerciseId: null, source: "needs-substitute" };
  }
  // No frozen anchor yet at all -- caller runs the normal ranker and must
  // freeze whatever it picks (Task 4.2), a decision this function does not make.
  return { exerciseId: null, source: "unset" };
}
```

### Task 4.2: Wire into `selectComplementary`

`selectComplementary` already receives `o.ctx`, `o.baseSlots`, etc. Add `o.athlete`. Before the `k === 0` (anchor) slot is filled by the existing ranker:

1. Determine the day's anchor pattern from `slots[0].patterns` (existing data -- the day's own movement family, already computed as `roleFamily`).
2. Call `resolveTodaysAnchor(o.athlete, pattern, isAvailable)` where `isAvailable` wraps `pickStrength`'s existing `ok()` filters for that exact exercise id.
3. `source === "frozen"` -> force-select that exact exercise into slot 0. Do **not** call `freezeAnchor` or `recordAnchorExposure` here (Task 4.2 only assigns; Section 5 records the outcome after the session is logged).
4. `source === "needs-substitute"` -> run the existing ranker exactly as today to fill slot 0 (concept 3, temporary substitute). Tag the placed exercise `isSubstitute: true` in the `placed`/`why` bookkeeping so downstream code (weight suggestion, exposure recording) can see it never touches concept 1's state.
5. `source === "unset"` -> run the existing ranker exactly as today, then call `freezeAnchor(athlete, pattern, chosen.id, startingWeight)` where `startingWeight` is whatever `suggestedWeight`/`weightMap` already resolves for that exercise (reuse, don't reinvent). This is the ONLY call site anywhere in Phase 3 that ever creates a new frozen identity.

**Required tests (Node, `tools/tests/test-phase3-anchor.js`) -- every one below must exist before this task is considered done:**

- [ ] Frozen anchor is created once per pattern (already covered in Task 1.1 -- cross-reference, don't duplicate).
- [ ] A second, later `resolveTodaysAnchor` call for the same pattern returns `source: "frozen"` with the SAME `exerciseId` -- future sessions reuse the same frozen anchor, they don't re-roll it.
- [ ] When `isAvailable(frozen.exerciseId)` is false, `resolveTodaysAnchor` returns `source: "needs-substitute"`, never forcing the unavailable exercise into the result -- the unavailable/injured frozen anchor is never forced into the session.
- [ ] After a `needs-substitute` session runs end-to-end through `selectComplementary` with a substitute placed, `getAnchorState(athlete, pattern)` is **byte-for-byte unchanged** from before that session -- the substitute never overwrites the frozen anchor.
- [ ] A substitute session's `placed` entry is tagged `isSubstitute: true`, and calling `recordAnchorExposure` is skippable/no-op-checked for that entry -- progression history (exposureCount/consecutiveStalls/weight) remains attached to the frozen anchor only, never to a temporary substitute's id.
- [ ] Calling `freezeAnchor` a second time for a pattern that already has a frozen identity is a no-op (already covered in Task 1.1) -- re-asserted here in the context of `resolveTodaysAnchor`'s `"unset"` path to prove the wiring never calls it twice for the same pattern across two sessions.
- [ ] Grep-level/structural check: no function introduced in this phase is named or behaves like a silent `reassignAnchor` -- permanent anchor change stays an explicit, unbuilt future feature, not a side effect of selection or substitution.

- [ ] Implement, confirm pass, confirm the **existing** `test-progression.js` (369 assertions) and `test-phase-a-blocks.js` (22988 assertions) are unaffected when no athlete/frozen-anchor is passed (backward compatibility -- `o.athlete` optional, identical behaviour to today when absent).
- [ ] Commit.

---

## 5. Wire Weight Suggestion + Exposure Recording

**File:** `index.html`, `suggestedWeight()`/`buildLastLogs()` (~line 2824, ~line 4036) and the session-complete path (`showSessionComplete`, where Phase 1's `bumpPref` calls already live).

### Task 5.1: Anchor-aware weight suggestion

When the exercise being weighted is the athlete's frozen anchor for its pattern, use `anchorState.weight` (already advanced by the last `recordAnchorExposure` call) instead of the generic `lr.ready ? weight + STEP : weight` bump. Non-anchor exercises are completely unaffected -- same flat-STEP path as today.

### Task 5.2: Record exposure at session-complete

In `showSessionComplete`, alongside the existing `bumpPref` loop, for the exercise(s) that were today's frozen anchors: compute `hitTop` via the *existing* `allSetsAtTop` helper (already shared with `buildLastLogs`, so "hit top" can never drift between the suggestion and the recording), compute the decision via `anchorProgressionDecision`, apply `anchorIncrementKg` when the decision is `increase`, and call `recordAnchorExposure`.

- [ ] Node tests for the wiring (deterministic fixture: a logged session where every set hits top -> next suggested weight equals old weight + `anchorIncrementKg`; a miss -> weight unchanged and `hold` recorded).
- [ ] Live-verify in the browser preview: log a fabricated squat session at the top of its rep range, confirm the next Just-Today build suggests the bumped weight for that exact lift (not a different variation).
- [ ] Commit.

---

## 6. Wire Per-Pattern Deload Flag

**File:** `index.html`, the `buildEx(...)` call sites inside `generateSession`/`generateProgram` (~line 3558).

### Task 6.1

When `anchorProgressionDecision` returns `deload` for the pattern being built this session, OR that exercise's call with `isDeload = true` for that one exercise, independent of whether the whole week/program is in its own calendar deload. This reuses the existing deload prescription math verbatim (already implements "-40% volume, +1 RIR") -- no new prescription logic is written in this phase.

- [ ] Node test: a pattern flagged for anchor-deload produces the same `anchorSets`/target-RIR numbers as the existing whole-program deload branch, for that exercise only, while a sibling exercise in the same session is unaffected.
- [ ] Commit.

---

## 7. Full Verification + Report

- [ ] Run `node tools/tests/test-phase3-anchor.js` -- confirm all pass.
- [ ] Run the full suite (`for f in tools/tests/*.js; do node "$f" | tail -1; done`) -- confirm every pre-existing file is pass-count-identical to the Phase 2 baseline (33/5/4/13/213/22988/12/11/369/44), proving zero behavioural drift for anything except the anchor-consuming path.
- [ ] Live-verify: rsync to the `/tmp` preview copy, reset SW/caches, boot-check, zero console errors; walk through one full squat-anchor session end to end (build -> log a top-of-range set -> complete -> rebuild -> confirm the bumped weight and correct exercise identity).
- [ ] Commit locally. **Do not push/deploy or start Phase 4 until James reviews the completion report and approves.**
- [ ] Write the completion report in the same format as Phases 1-2 (what changed / what did not change / tests added / full suite result / behaviour changes / risks / judgement calls / architectural concerns / scope drift), explicitly covering: the freeze-once mechanism and its temporary-substitution fallback; the three-tier increment rule and the disclosed equipment-metadata gap; the exact deload-priority hierarchy as implemented; and confirmation that accessory selection, curated pools, and prescription/volume math were not touched.
