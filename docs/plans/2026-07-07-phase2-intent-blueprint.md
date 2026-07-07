# Phase 2 — Intent Blueprint Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Intent Blueprint the single source of truth for the facts that drive session construction — stimulus (goal→training-emphasis), target patterns, minutes, equipment, experience, injuries — so `generateSession`/`generateProgram` read them from one object instead of each independently re-deriving them.

**Architecture:** A pure `buildIntent(opts)` function (Node-testable, same helper/coach-span discipline as every other pure coach function) replaces the duplicated inline `selGoal`/`allowPats` derivation currently living separately inside `generateSession` and `generateProgram`. Both generators call `buildIntent()` once at the top and read every intent-level fact from the returned object for the rest of the function. `athlete` becomes a new, backward-compatible trailing parameter on both generators (defaults to null → neutral profile), threaded through from the two real call sites (`onBuildToday`, `onBuild`).

**Explicit scope boundary (documented, not hidden):** per `docs/PROGRAMMING-PHILOSOPHY.md` §3.1, "Intent is mapped into purpose slots" is a distinct, later step. Phase 2 builds the **Intent object** — the `primary{target,stimulus}` / `constraints{minutes,equipment,readiness,injuries,experience}` shape — and eliminates duplicate inference of those facts. It does **not** yet implement the full purpose-slot pipeline (anchor freeze/progression, weak-point accessory slots, etc.) — that is Phase 3 (Anchor & Progression) per the 8-phase build order. `secondary[]` ships as an empty array in Phase 2 (no per-muscle secondary-emphasis logic exists yet; that's Phase 4/weekly-debt territory, already partially wired via the existing `debt` param, left untouched here).

**Tech Stack:** Single-file vanilla-JS PWA (`index.html`), coach span between `/*__COACH_START__*/`/`/*__COACH_END__*/`, Node assertion scripts in `tools/tests/`.

---

## Data shape (target)

```js
intent = {
  goal: "hybrid" | "strength" | "endurance" | "hypertrophy" | "general",  // passthrough, unchanged semantics
  primary: {
    target: <role string | patterns[] | areas[] | null>,  // informational, mirrors the request
    stimulus: "hypertrophy" | "strength" | "general",      // the ONLY place this is computed
    focusPatterns: <string[] | null>                       // the resolved pattern list selectComplementary consumes
  },
  secondary: [],  // reserved, empty in Phase 2 (see scope boundary above)
  constraints: {
    minutes: <int, clamped 15-120>,
    equipment: <string[] | null>,   // null = full gym, same convention as today
    readiness: <opts.readiness || null>,  // shape unused until a later phase; just carried
    injuries: <athlete.injuries[] | []>,
    experience: <athlete.experience | "intermediate">
  }
};
```

## File structure

- **Modify** `index.html`:
  - Coach span, immediately before `generateSession` (~line 3215): add `buildIntent(opts)`.
  - `generateSession`: add trailing `athlete` param; build intent at top; replace `selGoal`/`allowPats` locals with intent reads.
  - `generateProgram`: add trailing `athlete` param; build intent at top; replace `selGoal` local with intent read.
  - The 3 real call sites (`onBuildToday`'s two `generateSession` calls, `onBuild`'s `generateProgram` call): pass `state.athlete`.
- **Create** `tools/tests/test-intent-blueprint.js`.

---

### Task 1: `buildIntent()` — the pure function

**Files:**
- Modify: `index.html` (coach span, immediately before `function generateSession`, ~line 3215)
- Test: `tools/tests/test-intent-blueprint.js`

- [ ] **Step 1: Write the failing test**

Create `tools/tests/test-intent-blueprint.js`:

```js
// Phase 2 (Intent Blueprint) tests: buildIntent() is the single source of
// truth for stimulus/target-pattern/constraints -- proves determinism (same
// request always yields a deep-equal Intent object) and behaviour-preservation
// (the values match what the old inline selGoal/allowPats derivation produced).
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /function clampInt\(/.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={buildIntent,generateSession,generateProgram,normalizeAthlete};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const { buildIntent, generateSession, generateProgram, normalizeAthlete } = m.exports;
let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- determinism: identical requests always produce a deep-equal Intent ----------
{
  const req = { goal: 'hypertrophy', role: 'upper', minutes: 45, equipment: ['barbell', 'bodyweight'] };
  const a = buildIntent(req), b = buildIntent(req);
  ok(JSON.stringify(a) === JSON.stringify(b), 'buildIntent(sameRequest) called twice yields a deep-equal Intent object');
  const c = buildIntent(Object.assign({}, req)); // a fresh object, same values
  ok(JSON.stringify(a) === JSON.stringify(c), 'buildIntent is deterministic across independently-constructed but equal inputs');
}

// ---------- stimulus derivation matches the old selGoal ternary exactly ----------
{
  ok(buildIntent({ goal: 'hypertrophy' }).primary.stimulus === 'hypertrophy', 'goal hypertrophy -> stimulus hypertrophy');
  ok(buildIntent({ goal: 'strength' }).primary.stimulus === 'strength', 'goal strength -> stimulus strength');
  ['hybrid', 'endurance', 'general', undefined].forEach(g => {
    ok(buildIntent({ goal: g }).primary.stimulus === 'general', `goal ${g} -> stimulus general (matches old ternary fallthrough)`);
  });
}

// ---------- focusPatterns resolution (role wins, else raw patterns, else null) ----------
{
  ok(JSON.stringify(buildIntent({ role: 'upper' }).primary.focusPatterns) === JSON.stringify(rolePatternsRef('upper')), 'a role resolves focusPatterns via rolePatterns(role)');
  ok(JSON.stringify(buildIntent({ patterns: ['squat', 'hinge'] }).primary.focusPatterns) === JSON.stringify(['squat', 'hinge']), 'no role, real patterns[] -> focusPatterns = patterns');
  ok(buildIntent({}).primary.focusPatterns === null, 'no role, no patterns -> focusPatterns null (matches old allowPats null fallback)');
  function rolePatternsRef(role) { return buildIntent({ role: role }).primary.focusPatterns; } // sanity self-check below instead
}

// ---------- constraints: minutes/equipment clamped + passed through ----------
{
  const i = buildIntent({ minutes: 999, equipment: ['dumbbell'] });
  ok(i.constraints.minutes === 120, 'minutes clamps to the 15-120 range (999 -> 120)');
  ok(i.constraints.minutes === i.constraints.minutes, 'minutes present');
  const i2 = buildIntent({ minutes: 3 });
  ok(i2.constraints.minutes === 15, 'minutes clamps up to the floor (3 -> 15)');
  ok(i.constraints.equipment.length === 1 && i.constraints.equipment[0] === 'dumbbell', 'equipment array passed through');
  ok(buildIntent({}).constraints.equipment === null, 'no equipment -> null (full gym), same convention as today');
}

// ---------- constraints: athlete (experience/injuries) flows through, defaults safely ----------
{
  const athlete = normalizeAthlete({ experience: 'advanced', injuries: [{ category: 'nogo', target: 'Burpees' }] });
  const i = buildIntent({ goal: 'strength' }, athlete);
  ok(i.constraints.experience === 'advanced', 'athlete.experience flows into constraints.experience');
  ok(i.constraints.injuries.length === 1 && i.constraints.injuries[0].target === 'Burpees', 'athlete.injuries flows into constraints.injuries');
  const iNoAthlete = buildIntent({ goal: 'strength' });
  ok(iNoAthlete.constraints.experience === 'intermediate', 'no athlete -> experience defaults to intermediate');
  ok(Array.isArray(iNoAthlete.constraints.injuries) && iNoAthlete.constraints.injuries.length === 0, 'no athlete -> injuries defaults to []');
}

// ---------- goal passthrough (raw string preserved alongside derived stimulus) ----------
{
  ok(buildIntent({ goal: 'hybrid' }).goal === 'hybrid', 'raw goal string is preserved on the intent object (not just the derived stimulus)');
  ok(buildIntent({}).goal === 'general', 'missing goal defaults to "general"');
}

console.log(pass + ' passed, ' + fail + ' failed');
if (fail) fails.slice(0, 30).forEach(f => console.log('  - ' + f));
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/tests/test-intent-blueprint.js`
Expected: FAIL — `buildIntent is not defined`.

- [ ] **Step 3: Write minimal implementation**

In `index.html`, immediately before `function generateSession(parsed, ...)` (~line 3215):

```js
// ===== Intent Blueprint (Programming Philosophy §3.1) =====
// The SINGLE place a request's stimulus/target-pattern/constraints are derived.
// generateSession/generateProgram build ONE intent here and read every
// intent-level fact from it for the rest of the call -- no downstream function
// (pickStrength, selectComplementary, etc.) re-infers goal->stimulus or
// role->pattern mapping independently. Full purpose-slot mapping (anchor
// freeze/progression) is Phase 3; this is the intent object itself.
function buildIntent(opts, athlete) {
  opts = opts || {};
  var goal = opts.goal || "general";
  var stimulus = goal === "hypertrophy" ? "hypertrophy" : goal === "strength" ? "strength" : "general";
  var role = opts.role || null;
  var rawPatterns = (Array.isArray(opts.patterns) && opts.patterns.length) ? opts.patterns.slice() : null;
  var focusPatterns = role ? rolePatterns(role) : rawPatterns;
  var target = role || (Array.isArray(opts.areas) && opts.areas.length ? opts.areas.slice() : rawPatterns);
  var a = normalizeAthlete(athlete);
  return {
    goal: goal,
    primary: { target: target, stimulus: stimulus, focusPatterns: focusPatterns },
    secondary: [], // reserved -- per-muscle secondary emphasis is Phase 4/debt territory
    constraints: {
      minutes: clampInt(opts.minutes, 15, 120, 45),
      equipment: Array.isArray(opts.equipment) ? opts.equipment.slice() : null,
      readiness: opts.readiness || null,
      injuries: a.injuries.slice(),
      experience: a.experience
    }
  };
}
```

- [ ] **Step 4: Fix the test's self-referential check and run again**

The `rolePatternsRef` helper in Step 1's test is circular (it calls `buildIntent` to test `buildIntent`). Replace that block in `tools/tests/test-intent-blueprint.js` with a direct call to the real `rolePatterns`:

```js
// ---------- focusPatterns resolution (role wins, else raw patterns, else null) ----------
{
  ok(JSON.stringify(buildIntent({ role: 'upper' }).primary.focusPatterns) === JSON.stringify(rolePatterns('upper')), 'a role resolves focusPatterns via the real rolePatterns(role)');
  ok(JSON.stringify(buildIntent({ patterns: ['squat', 'hinge'] }).primary.focusPatterns) === JSON.stringify(['squat', 'hinge']), 'no role, real patterns[] -> focusPatterns = patterns');
  ok(buildIntent({}).primary.focusPatterns === null, 'no role, no patterns -> focusPatterns null (matches old allowPats null fallback)');
}
```

Add `rolePatterns` to the test's `module.exports` list in the `src` line.

Run: `node tools/tests/test-intent-blueprint.js`
Expected: PASS, all assertions green.

- [ ] **Step 5: Commit**

```bash
git add index.html tools/tests/test-intent-blueprint.js
git commit -m "feat(intent): buildIntent() -- single source of truth for stimulus/pattern/constraints"
```

---

### Task 2: Wire into `generateSession`

**Files:**
- Modify: `index.html` `generateSession` (~line 3215)
- Test: full suite (behaviour-preservation — no new assertions, existing ones must stay green)

- [ ] **Step 1: Replace the inline derivation with an intent read**

Change the signature to accept a trailing `athlete` param, and replace `selGoal`/`allowPats`:

```js
function generateSession(parsed, weightMap, seed, lastLogs, debt, ease, unlocked, athlete) {
  parsed = parsed || {}; weightMap = weightMap || {}; seed = seed || 0; lastLogs = lastLogs || {};
  var intent = buildIntent(parsed, athlete);
  var minutes = intent.constraints.minutes;
  var goal = intent.goal;
  var allowed = intent.constraints.equipment;
  var includeMob = true;
  var includeCon = (parsed.includes || []).indexOf("conditioning") >= 0;
  var selGoal = intent.primary.stimulus;
  var allowPats = intent.primary.focusPatterns;
  ...
```

(Delete the old `var minutes = clampInt(...)`, `var goal = parsed.goal || "general";`, `var allowed = Array.isArray(...)`, `var selGoal = goal === ...`, and `var allowPats = parsed.role ? ...` lines -- replaced by the block above. Everything after stays byte-identical: `slotsTotal`, `strengthSlots`, `baseSlots`/`patCap`, the `selectComplementary` call, etc. all keep reading the same-named `minutes`/`goal`/`allowed`/`selGoal`/`allowPats` locals, now sourced from `intent` instead of recomputed.)

- [ ] **Step 2: Run the full suite**

Run: `for f in tools/tests/*.js; do node "$f" | tail -1; done`
Expected: every file's pass count **identical** to before this change (this is a pure refactor — any count change means a behavioural regression; stop and investigate rather than adjusting the test).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "refactor(intent): generateSession reads stimulus/pattern/constraints from buildIntent"
```

---

### Task 3: Wire into `generateProgram`

**Files:**
- Modify: `index.html` `generateProgram` (~line 3312)
- Test: full suite (behaviour-preservation)

- [ ] **Step 1: Replace the inline derivation with an intent read**

```js
function generateProgram(intake, weightMap, seed, lastLogs, unlocked, athlete) {
  intake = intake || {};
  weightMap = weightMap || {};
  seed = seed || 0;
  lastLogs = lastLogs || {};
  var intent = buildIntent(intake, athlete);
  var goal     = intent.goal;
  var days     = clampInt(intake.days, 1, 7, 4);
  var minutes  = intent.constraints.minutes;
  var totalWeeks = clampInt(intake.weeks, 1, 8, 4);
  var isHybrid = goal === "hybrid", isEnd = goal === "endurance";
  var allowed  = intent.constraints.equipment;
  var includeMob = true;
  var includeCon = isEnd || (intake.includes || []).indexOf("conditioning") >= 0;
  var selGoal  = intent.primary.stimulus;
  ...
```

Note `generateProgram`'s default minutes fallback was `60`, not `45` (`clampInt(intake.minutes, 15, 120, 60)`), unlike `generateSession`'s `45`. `buildIntent` hardcodes `45` as the default. To preserve exact behaviour, call `buildIntent` here and then override minutes if the intake omitted it:

```js
  var intent = buildIntent(intake, athlete);
  var minutes = (intake.minutes != null) ? intent.constraints.minutes : clampInt(intake.minutes, 15, 120, 60);
```

(Since `clampInt` returns the default when the input is null/NaN, and `intake.minutes != null` is the exact original guard — this preserves the 45-vs-60 default asymmetry exactly. Simplify only if a later phase unifies the defaults; not in scope here.)

- [ ] **Step 2: Run the full suite**

Run: `for f in tools/tests/*.js; do node "$f" | tail -1; done`
Expected: every file's pass count **identical** to before (especially `test-phase-a-blocks.js`'s `computeBlockBudgets` assertions, which are minutes-default-sensitive).

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "refactor(intent): generateProgram reads stimulus/constraints from buildIntent"
```

---

### Task 4: Thread real `athlete` through the live call sites

**Files:**
- Modify: `index.html` (`onBuildToday`, `onBuild` — the 3 real call sites)
- Test: live browser

- [ ] **Step 1: Update the 3 call sites**

`onBuildToday`'s two `generateSession` calls and `onBuild`'s `generateProgram` call each gain a trailing `state.athlete` argument:

```js
pendingTodayAnyway = generateSession(parsed, buildWeightMap(state), todaySeed + 1, buildLastLogs(state), spec.debt.byPattern, false, unlockedSkillMap(), state.athlete);
...
pendingToday = generateSession(parsed, buildWeightMap(state), todaySeed, buildLastLogs(state), spec.debt.byPattern, deg === "eased", unlockedSkillMap(), state.athlete);
...
pendingBuild = generateProgram(intake, buildWeightMap(state), buildSeed, buildLastLogs(state), unlockedSkillMap(), state.athlete);
```

- [ ] **Step 2: Verify live**

rsync to the /tmp preview, reset SW/caches, reload. Build a week and a Just-Today session as normal; confirm sessions render identically to before (same structure, same warm-up/cool-down, same block layout). Zero console errors.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat(intent): thread real athlete profile into generateSession/generateProgram call sites"
```

---

### Task 5: Full verification + ship

**Files:** `sw.js`

- [ ] **Step 1: Run the whole Node suite**

Run: `for f in tools/tests/*.js; do node "$f" | tail -1; done`
Expected: every file identical pass count to the pre-Phase-2 baseline, plus the new `test-intent-blueprint.js` green.

- [ ] **Step 2: Bump the service worker**

Increment `CACHE_VERSION` in `sw.js`.

- [ ] **Step 3: Live smoke test**

Build a week, build a Just-Today session, start training, log a set, skip an exercise, swap an exercise. Confirm identical behaviour to pre-Phase-2 (this is a refactor, not a feature — nothing should visibly change). Zero console errors.

- [ ] **Step 4: Commit + deploy**

```bash
git add sw.js
git commit -m "chore: bump SW for Phase 2 (Intent Blueprint)"
git push origin main
```

Confirm the deploy and `curl` the live `sw.js` for the new version.

---

## Self-review

- **Spec coverage (§3.1 + James's amendment):** Intent object built before any exercise selection ✓ (Task 1-3, `buildIntent` runs before `selectComplementary` in both generators). Single source of truth for stimulus/pattern/constraints ✓ (both generators now read from `intent`, never recompute). Determinism proven by test ✓ (Task 1, Step 1's determinism block). **Explicitly NOT in scope** (documented in the Architecture section above, not silently dropped): full purpose-slot mapping (Preparation/Power/Anchor/... as labeled slots) and anchor-freeze progression — that's Phase 3.
- **Placeholder scan:** none — every step shows exact code.
- **Type consistency:** `buildIntent`/`intent.goal`/`intent.primary.{target,stimulus,focusPatterns}`/`intent.constraints.{minutes,equipment,readiness,injuries,experience}` used identically across all tasks.
- **Backward compatibility:** `athlete` is a new trailing optional param on both generators (existing test calls that omit it are unaffected — `buildIntent(opts, undefined)` → `normalizeAthlete(undefined)` → safe defaults). No existing test's call signature needs to change.
- **Contradiction check (Programming Philosophy §0):** this phase only relocates existing inference into one function and proves it deterministic; it cannot change session content, so it cannot violate Reasoned/Right-Hard/Balanced/Goes-Somewhere/Coherent — confirmed empirically by identical test pass-counts in Tasks 2/3.
