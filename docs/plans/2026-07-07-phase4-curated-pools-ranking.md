# Phase 4: Curated Pools & Ranking -- Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. **Do not begin implementation until James has explicitly approved this plan.**

**Goal:** Give every non-anchor slot a real `Role -> Curated Pool -> Ranking -> Selection` pipeline (Programming Philosophy §3.3): hard-filtered by equipment, skill, and -- newly -- injuries; ranked by fit-to-intent, weekly debt, recency, and learned preference; never repeating the previous session's variation.

**Architecture:** Extends `pickStrength`'s existing progressive-widening filter/fallback ladder (the same idiom already used for equipment/goal/pattern widening) with two new hard-filter tiers (pool tier, injury), and extends `selectComplementary`'s ranker with two new scoring terms (learned preference, recency). The anchor slot (`k === 0` when a frozen anchor is in play) is explicitly walled off from every change in this phase -- Phase 3's `resolveTodaysAnchor` already bypasses the ranker for a frozen anchor, and nothing here is allowed to weaken that.

**Tech Stack:** Vanilla JS inside `index.html` (coach engine span), Node test harness pattern already used by the other 12 files in `tools/tests/`.

---

## 0. Phase boundary (read this before writing any code)

**Phase 4 owns:**
- Curated pool tiers (Core / Quality / Fringe) for non-anchor exercises, and the "only Core+Quality eligible in normal programming" rule.
- Injury hard-filtering (the bridge-tier keyword/metadata matcher James specified), including the medical/nogo-absolute vs. pain/restricted-last-resort severity split.
- Ranker additions: learned preference (`athlete.prefs`, collected since Phase 1, never consumed until now) and a recency penalty ("previous session's variation is never repeated").

**Phase 4 explicitly does NOT touch:**
- Anchor identity, freezing, progression, or deload (Phase 3, already shipped). **Non-negotiable, per James's explicit instruction:** the frozen anchor slot (`k === 0` whenever `resolveTodaysAnchor` reports `source: "frozen"`) must never be re-ranked, re-filtered, or replaced by anything built in this phase. Every new filter/ranking term in this plan applies ONLY to slots `pickStrength`/`selectComplementary`'s ranker actually decides -- which already excludes the frozen-anchor slot structurally (Phase 3's `if (res.source === "frozen") { ex = ...; }` branch returns before the ranker ever runs). This plan adds nothing that could weaken that branch; Task 4 includes an explicit regression test proving a frozen anchor still bypasses every new filter/ranker term added here.
- Prescription/volume-landmark math (Phase 5).
- Anything about the substitute path beyond what Phase 3 already built (a substitute still goes through `pickStrength`, so it DOES pick up Phase 4's new filters/ranking automatically -- that's correct and intended, not a boundary violation, since a substitute is an ordinary non-anchor-frozen pick for that one session).

If implementation reveals a case that seems to require touching the anchor path, **stop and raise it** rather than quietly proceeding.

**Injury-filtering architecture note (per James's explicit direction):** this is being built as a deliberate bridge, not a final system. The matching hierarchy, from most to least authoritative:
1. Structured injury tags on the athlete -- **future**, not built now (athlete injuries stay free-text `{category, target}` in Phase 4).
2. Structured exercise metadata tags -- **already exist** in `LIBRARY` (`joint_stress`, `primary_muscles`, `secondary_muscles`, `movement_pattern`, `is_unilateral`) and are reused as-is; Phase 4 does not invent a new exercise-tagging pass.
3. Normalised keyword/synonym matching against those existing tags -- **the bridge this phase builds.**
4. Exact exercise-name substring match -- lowest priority, existing-data fallback for named-movement injuries ("no burpees") the keyword map can't infer.

The interface (`isExerciseFlaggedByInjury(exercise, injury)`) is designed so that when structured injury objects and richer exercise tags eventually replace the free-text/keyword layers, only the inside of that one function changes -- every caller (`pickStrength`'s hard filter) stays the same.

---

## 1. Curated Pool Tiers

### Task 1.1: `pool_tier` field + a pragmatic default (no 200-entry reclassification)

**File:** `index.html`, `LIBRARY` array (~line 1600+) and `libraryIntegrity()`.

Rather than hand-authoring a tier for all ~200 existing entries in one pass (a large, error-prone content task with no test oracle), Phase 4 introduces the field with a **safe, minimal-footprint default**: every exercise without an explicit `pool_tier` defaults to `"quality"` (eligible, exactly like today -- zero behaviour change for anything not explicitly tagged). Only a small, explicit hand-picked list is tagged `"fringe"` (excluded from normal programming): highly specialised/narrow-transfer movements already flagged by existing fields -- `skill_tier === "advanced"` moves and `accommodating` (band+barbell) variants are the two existing signals that already identify "specialist, not default" content, so Fringe starts as exactly that set, expressed as a derived default rather than 200 hand-typed literals:

```js
// Pool tier (Programming Philosophy §3.3): Core/Quality/Fringe. Only Core and
// Quality are eligible in normal programming. Rather than hand-authoring all
// ~200 LIBRARY entries (untestable, error-prone), everything defaults to
// "quality" (identical to today's behaviour) except a small, principled
// derived set: advanced-skill and accommodating-resistance moves were ALREADY
// the app's two "specialist, opt-in" signals (skillAllowed / opts.avoidAcc) --
// Fringe simply names that existing distinction instead of duplicating it.
// A real anchor's canonical T1 lift is explicitly Core (the flagship pick);
// everything else stays Quality unless hand-promoted later.
function poolTierOf(exercise) {
  if (exercise.pool_tier) return exercise.pool_tier; // explicit override always wins
  if (ANCHOR_T1[exercise.id]) return "core";
  if (exercise.skill_tier === "advanced" || exercise.accommodating) return "fringe";
  return "quality";
}
```

- [ ] Write a Node test: every LIBRARY entry resolves to exactly one of `"core"/"quality"/"fringe"`; a known advanced-skill move (e.g. `muscle-up`) resolves to `"fringe"`; a known ANCHOR_T1 id resolves to `"core"`; an ordinary accessory (e.g. `leg-curl` or similar non-flagged entry) resolves to `"quality"`.
- [ ] Extend `libraryIntegrity()` to assert `poolTierOf(e)` is always one of the three valid strings for every entry (a structural sanity check, not a content audit).
- [ ] Commit.

### Task 1.2: Wire pool tier into `pickStrength`'s filter

Add a `poolTierOf(e) !== "fringe"` condition to `ok()`, positioned as the **last** widening step (a Fringe move is better than an empty slot -- never leave a session hollow):

```js
var pool = LIBRARY.filter(function (e) { return ok(e, pats, slot.compound, true); });
if (!pool.length) pool = LIBRARY.filter(function (e) { return ok(e, pats, slot.compound, false); });
if (!pool.length) pool = LIBRARY.filter(function (e) { return ok(e, pats, null, false); });
if (!pool.length) pool = LIBRARY.filter(function (e) { return ok(e, ALL_PATTERNS, null, false); });
// NEW: Fringe is the last, most-permissive fallback, not a hard wall.
if (!pool.length) pool = LIBRARY.filter(function (e) { return ok(e, ALL_PATTERNS, null, false, /*allowFringe*/ true); });
if (!pool.length) return null;
```

(`ok()` gains a 5th parameter `allowFringe`, defaulting falsy, gating the new `poolTierOf` check.)

- [ ] Node test: a slot whose only Quality/Core candidates are exhausted by equipment still finds a Fringe candidate rather than returning null.
- [ ] Node test: a slot with any Core/Quality candidate available NEVER returns a Fringe pick (Fringe is strictly last-resort).
- [ ] Commit.

---

## 2. Injury Hard-Filtering

### Task 2.1: Keyword/synonym normalisation + dictionary

**File:** `index.html`, helper span (near `normalizeAthlete`).

```js
// Bridge-tier injury matching (see plan Section 0 for the full matching
// hierarchy this sits inside). Normalises free-text injury targets so
// "L shoulder", "left shoulder", "shoulders" all resolve the same way.
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

- [ ] Node tests: `normalizeInjuryText("L Shoulder")`/`"shoulders"`/`"left shoulder"` all normalize identically; `"lower back"`/`"lumbar"` both normalize to include `"spine"`; an unrecognised phrase passes through unchanged (never throws, never silently empties).
- [ ] Commit.

### Task 2.2: `isExerciseFlaggedByInjury(exercise, injury)`

```js
function isExerciseFlaggedByInjury(exercise, injury) {
  var norm = normalizeInjuryText(injury.target);
  // Tier 4: exact exercise-name substring match (named-movement injuries).
  if (norm && exercise.name.toLowerCase().indexOf(norm) >= 0) return true;
  // Tier 2/3: keyword -> exercise metadata tags (joint_stress / movement_pattern).
  var tokens = norm.split(/\s+/);
  for (var i = 0; i < tokens.length; i++) {
    var tags = INJURY_KEYWORD_TAGS[tokens[i]]; if (!tags) continue;
    if (tags.joints && exercise.joint_stress && tags.joints.some(function (j) { return exercise.joint_stress.indexOf(j) >= 0; })) return true;
    if (tags.patterns && tags.patterns.indexOf(exercise.movement_pattern) >= 0) return true;
    if (tags.patterns && tags.patterns.indexOf(exercise.pattern) >= 0) return true;
  }
  return false;
}
var INJURY_HARD_CATEGORIES = ["medical", "nogo"];   // absolute -- never touched, even as a last resort
var INJURY_SOFT_CATEGORIES = ["pain", "restricted"]; // strongly excluded, allowed back only if nothing else fits
```

- [ ] Node tests: a "shoulder" injury flags an overhead-press-family exercise (via `joint_stress`) but not an unrelated leg exercise; a named-movement injury ("Overhead Press") flags that exact exercise via the name-match tier even though it wouldn't otherwise match a keyword; an injury with unrecognised text flags nothing (fails safe -- never over-broad, never crashes).
- [ ] Commit.

### Task 2.3: Wire into `pickStrength`'s filter, with the medical/nogo-vs-pain/restricted severity split

Add two new fallback tiers to the existing widening ladder, positioned **after** equipment/pool-tier widening but the hard (`medical`/`nogo`) exclusion applies at every tier including the Fringe fallback -- it is never dropped, full stop:

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
    && !hardInjuryFlagged(e, opts.injuries)                          // medical/nogo: ALWAYS excluded
    && (opts.allowSoftInjuryFlagged || !softInjuryFlagged(e, opts.injuries)); // pain/restricted: last-resort only
}
function hardInjuryFlagged(e, injuries) {
  return (injuries || []).some(function (inj) { return INJURY_HARD_CATEGORIES.indexOf(inj.category) >= 0 && isExerciseFlaggedByInjury(e, inj); });
}
function softInjuryFlagged(e, injuries) {
  return (injuries || []).some(function (inj) { return INJURY_SOFT_CATEGORIES.indexOf(inj.category) >= 0 && isExerciseFlaggedByInjury(e, inj); });
}
```

`pickStrength` gains `opts.injuries` (passed through from `athlete.injuries`), and one final ladder rung:

```js
if (!pool.length) pool = LIBRARY.filter(function (e) { return ok(e, ALL_PATTERNS, null, false, true); }); // allow Fringe
// Last resort: nothing works even with Fringe allowed -- let a pain/restricted-
// flagged exercise back in rather than leave the slot hollow. medical/nogo is
// NEVER included here; hardInjuryFlagged has no bypass anywhere in the ladder.
if (!pool.length) pool = LIBRARY.filter(function (e) { return ok(e, ALL_PATTERNS, null, false, true) || (!hardInjuryFlagged(e, opts.injuries) && equipOk(e, allowed) && skillAllowed(e, opts.unlocked)); });
if (!pool.length) return null;
```

- [ ] Node test: an athlete with a `"nogo"` injury targeting a specific exercise never gets that exercise, even when it is the ONLY candidate for an otherwise-unfillable slot (the slot may come back empty/null in that extreme case -- confirmed as the correct, honest outcome, not silently substituting something dishonest).
- [ ] Node test: an athlete with a `"restricted"` injury does not get the flagged exercise under normal conditions, but DOES get it when it is genuinely the only way to avoid leaving the slot empty (last-resort fallback fires).
- [ ] Node test: a `"pain"`/`"restricted"` flag on the exercise the frozen anchor slot would otherwise pick has **no effect on the anchor slot** -- the frozen anchor is still force-selected exactly as Phase 3 built it (this is the explicit regression test for the non-negotiable boundary in Section 0).
- [ ] Commit.

### Task 2.4: Thread `athlete.injuries` through the real call sites

`selectComplementary` already receives `o.athlete` (Phase 3); read `o.athlete.injuries` and pass as `opts.injuries` into every `pickStrength` call it makes (for both the anchor-substitute path and ordinary accessory slots).

- [ ] Node test: end-to-end via `generateSession` -- an athlete with a `"nogo"` injury on a specific accessory exercise never sees it appear anywhere in a generated session's accessory slots.
- [ ] Commit.

---

## 3. Ranker: Learned Preference + Recency

### Task 3.1: Consume `athlete.prefs` in the ranker

**File:** `index.html`, `selectComplementary`'s `ranker()` closure.

`bumpPref` has been collecting a `-3..+3` score per canonical exercise name since Phase 1; nothing has read it until now.

```js
// Learned preference (Programming Philosophy §3.6): a real term now, not just
// collected. Weighted comparably to the existing debt/muscle-spread terms
// (a full +/-3 preference swings ~4.5 points -- meaningful, but never
// override-strength against debt's up-to-24-point swing or the anchor-tier
// bonus, both of which represent harder coaching facts than a soft preference).
var PREF_WEIGHT = 1.5;
if (athlete && athlete.prefs) {
  var prefScore = athlete.prefs[canonicalExName(e.name)];
  if (typeof prefScore === "number") s -= prefScore * PREF_WEIGHT;
}
```

- [ ] Node test: given two otherwise-tied candidates, the one with a higher learned preference score is ranked first; a strongly negative preference does not override a real weekly-debt signal (debt still wins when both are present).
- [ ] Commit.

### Task 3.2: Recency -- never repeat the previous session's variation

**File:** `index.html`, `selectComplementary`.

"The previous session's variation is never repeated" (§3.3) -- a hard exclusion, not a soft ranking nudge, scoped to the SAME slot/pattern across consecutive sessions (not a global history ban, which would fight variety in the other direction). Needs the most recently *placed* exercise per movement pattern, read from `lastLogs` (already threaded into `selectComplementary` since Phase 1) via each entry's associated LIBRARY lookup.

```js
// Recency: the exercise most recently logged for THIS pattern, if any --
// excluded from today's candidates for the same pattern, never globally.
// Falls back (never empties a slot) if it's the only real candidate.
function mostRecentByPattern(lastLogs) {
  var byName = {}; LIBRARY.forEach(function (e) { byName[e.name.toLowerCase()] = e; });
  var out = {};
  Object.keys(lastLogs || {}).forEach(function (name) {
    var lib = byName[name.toLowerCase()]; if (!lib) return;
    out[lib.pattern] = lib.id; // last write wins; lastLogs has no per-pattern timestamp ordering today
  });
  return out;
}
```

Wired as one more `ok()` exclusion (`e.id !== recentIdForThisPattern`), with the SAME "widen if it would otherwise empty the slot" ladder placement as every other soft preference already uses.

- [ ] Node test: the exercise logged last time for a pattern is excluded from today's candidates for that same pattern when an alternative exists; it is allowed back in when it is the only real candidate (never leaves a slot hollow).
- [ ] Commit.

---

## 4. Full Verification + Report

- [ ] Run the new test file (`tools/tests/test-phase4-pools-ranking.js`) -- confirm all pass.
- [ ] Run the full suite (`for f in tools/tests/*.js; do node "$f" | tail -1; done`) -- confirm every pre-existing file is pass-count-identical to the Phase 3 baseline.
- [ ] **Explicit anchor-boundary regression check**, run and reported on its own: build several sessions with a frozen anchor in play, injuries flagged against that exact anchor exercise, and a negative learned preference against it -- confirm the frozen anchor is STILL force-selected every time, completely unaffected by every filter/ranking term this phase adds.
- [ ] Live-verify: rsync to the `/tmp` preview copy, reset SW/caches, reload, boot-check, zero console errors; add a "nogo" injury against a real accessory exercise in Settings, build a session, confirm it never appears.
- [ ] Commit locally. **Do not push/deploy or start Phase 5 until James reviews the completion report and approves.**
- [ ] Write the completion report in the same format as Phases 1-3, explicitly covering: the pragmatic (non-200-entry) pool-tier default and why; the injury-matching bridge architecture and its explicitly temporary nature; the medical/nogo-absolute vs. pain/restricted-last-resort split as implemented; confirmation the anchor boundary was never crossed; and any scope drift.
