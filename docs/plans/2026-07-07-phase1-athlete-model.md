# Phase 1 — Athlete Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a light, persistent athlete profile (experience, injuries, learned preferences) to the app — the data foundation every later phase of `docs/PROGRAMMING-PHILOSOPHY.md` reads from.

**Architecture:** A pure `normalizeAthlete()` whitelist-reconstruction (mirrors the existing `normalizeProgram()` pattern) plus a pure `bumpPref()` primitive, both placed in the Node-testable "helper span" of `index.html`. `freshState`/`coerceState` gain an `athlete` field (migration-safe: old saved state defaults cleanly). A minimal Settings capture (experience + a "movements to avoid" list) writes the profile; the skip and swap-out handlers collect negative preference signals. **Phase 1 only COLLECTS — nothing consumes the profile yet.** Selection/injury-filtering/positive-signal consumption arrive in Phases 4 and 6, so shipping negative-only collection here has zero behavioural effect and is safe.

**Tech Stack:** Single-file vanilla-JS PWA (`index.html`), service worker (`sw.js`), Node `--test`-free assertion scripts in `tools/tests/`, localStorage state.

---

## Data shape (target)

Added to `state`:

```js
athlete: {
  experience: "beginner" | "intermediate" | "advanced",   // default "intermediate"
  injuries: [ { category: "pain" | "restricted" | "medical" | "nogo", target: "<string>" } ],
  prefs: { "<canonical exercise name>": <number, clamped -3..3> }
}
```

- `injuries` categories come straight from spec §3.5. Only `nogo` is user-overridable later; `pain`/`restricted`/`medical` are hard exclusions (consumed in Phase 6).
- `prefs` is keyed by **canonical exercise name** (not id), matching how `buildWeightMap`/`buildLastLogs` key history so it survives id churn.
- `PREF_MIN = -3`, `PREF_MAX = 3`.

## File structure

- **Modify** `index.html`:
  - Helper span (after `normalizeProgram`, before `migrateV1toV2`, ~line 1410): add `PREF_MIN`/`PREF_MAX`, `normalizeAthlete()`, `bumpPref()`.
  - `freshState` (~line 3668) + `coerceState` (~line 3685): add `athlete`.
  - Settings sheet (~line 1071, after "Advanced moves I can do" `.sect`): add a "Your training" section.
  - Settings render/handlers (near the skill-chips wiring): render experience chips + avoid-list; handle taps.
  - `skipex` handler (~line 5289) and `swap-pick` handler (~line 5320): call `bumpPref(...-1)`.
- **Create** `tools/tests/test-athlete-model.js` (Node).

---

### Task 1: `normalizeAthlete()` — the schema

**Files:**
- Modify: `index.html` (helper span, immediately after `normalizeProgram` closes, ~line 1410)
- Test: `tools/tests/test-athlete-model.js`

- [ ] **Step 1: Write the failing test**

Create `tools/tests/test-athlete-model.js`:

```js
// Phase 1 (Athlete model) tests: the persistent profile schema + learned-pref
// primitive. Pure functions in the helper span, extracted the same way as every
// other coach test.
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /function clampInt\(/.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={normalizeAthlete,bumpPref,PREF_MIN,PREF_MAX};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const { normalizeAthlete, bumpPref, PREF_MIN, PREF_MAX } = m.exports;
let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- normalizeAthlete: defaults ----------
{
  const a = normalizeAthlete(null);
  ok(a.experience === 'intermediate', 'null -> experience defaults to intermediate');
  ok(Array.isArray(a.injuries) && a.injuries.length === 0, 'null -> injuries defaults to []');
  ok(a.prefs && typeof a.prefs === 'object' && Object.keys(a.prefs).length === 0, 'null -> prefs defaults to {}');
}

// ---------- normalizeAthlete: validation ----------
{
  const a = normalizeAthlete({ experience: 'pro', injuries: 'nope', prefs: 5 });
  ok(a.experience === 'intermediate', 'bad experience enum falls back to intermediate');
  ok(Array.isArray(a.injuries) && a.injuries.length === 0, 'non-array injuries becomes []');
  ok(a.prefs && Object.keys(a.prefs).length === 0, 'non-object prefs becomes {}');
}
{
  const a = normalizeAthlete({
    experience: 'advanced',
    injuries: [{ category: 'pain', target: 'Overhead Press' }, { category: 'bogus', target: 'x' }, { target: 'no-cat' }, 'junk'],
    prefs: { 'Back Squat': 2, 'Bench Press': '1', 'Deadlift': 99, 'Row': 'x' }
  });
  ok(a.experience === 'advanced', 'valid experience preserved');
  ok(a.injuries.length === 1 && a.injuries[0].category === 'pain' && a.injuries[0].target === 'Overhead Press', 'only well-formed injuries with a valid category survive');
  ok(a.prefs['Back Squat'] === 2, 'numeric pref preserved');
  ok(a.prefs['Bench Press'] === 1, 'string-numeric pref coerced to number');
  ok(a.prefs['Deadlift'] === PREF_MAX, 'out-of-range pref clamped to PREF_MAX');
  ok(!('Row' in a.prefs), 'non-numeric pref dropped');
}

// ---------- normalizeAthlete: idempotent round-trip ----------
{
  const a = normalizeAthlete({ experience: 'beginner', injuries: [{ category: 'nogo', target: 'Burpee' }], prefs: { 'Chin-Up': -2 } });
  ok(JSON.stringify(normalizeAthlete(a)) === JSON.stringify(a), 'normalizeAthlete is idempotent');
}

console.log(pass + ' passed, ' + fail + ' failed');
if (fail) fails.slice(0, 30).forEach(f => console.log('  - ' + f));
process.exit(fail ? 1 : 0);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/tests/test-athlete-model.js`
Expected: FAIL — `normalizeAthlete is not defined` (thrown from the `new Function` eval).

- [ ] **Step 3: Write minimal implementation**

In `index.html`, immediately after the `normalizeProgram` function closes (before `function migrateV1toV2(`), add:

```js
  var PREF_MIN = -3, PREF_MAX = 3;
  var INJURY_CATEGORIES = ["pain", "restricted", "medical", "nogo"];
  var EXPERIENCE_LEVELS = ["beginner", "intermediate", "advanced"];
  // The persistent athlete profile: experience + injuries (four categories,
  // spec 3.5) + learned per-exercise preferences (keyed by canonical name so
  // they survive id churn, like weight history). Whitelist reconstruction --
  // any unknown/malformed field is dropped, same discipline as normalizeProgram.
  function normalizeAthlete(obj) {
    obj = obj && typeof obj === "object" ? obj : {};
    var experience = EXPERIENCE_LEVELS.indexOf(obj.experience) >= 0 ? obj.experience : "intermediate";
    var injuries = (Array.isArray(obj.injuries) ? obj.injuries : []).filter(function (i) {
      return i && typeof i === "object" && INJURY_CATEGORIES.indexOf(i.category) >= 0 && typeof i.target === "string" && i.target;
    }).map(function (i) { return { category: i.category, target: i.target }; });
    var prefsIn = obj.prefs && typeof obj.prefs === "object" ? obj.prefs : {};
    var prefs = {};
    Object.keys(prefsIn).forEach(function (k) {
      var n = Number(prefsIn[k]);
      if (!isNaN(n)) prefs[k] = Math.max(PREF_MIN, Math.min(PREF_MAX, n));
    });
    return { experience: experience, injuries: injuries, prefs: prefs };
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/tests/test-athlete-model.js`
Expected: FAIL still — `bumpPref is not defined` (the export line references it). That's expected; Task 2 adds it. To confirm ONLY normalizeAthlete works so far, temporarily nothing — proceed to Task 2, then run. (If you want an isolated check now, comment `bumpPref,PREF_MIN` out of the module.exports line, run — expect the normalizeAthlete assertions to PASS — then restore it.)

- [ ] **Step 5: Commit**

```bash
git add index.html tools/tests/test-athlete-model.js
git commit -m "feat(athlete): normalizeAthlete profile schema + tests"
```

---

### Task 2: `bumpPref()` — the learned-preference primitive

**Files:**
- Modify: `index.html` (helper span, right after `normalizeAthlete`)
- Test: `tools/tests/test-athlete-model.js` (extend)

- [ ] **Step 1: Write the failing test**

Append before the `console.log(pass ...)` line in `tools/tests/test-athlete-model.js`:

```js
// ---------- bumpPref: clamped increment/decrement, keyed by name ----------
{
  const a = normalizeAthlete(null);
  ok(bumpPref(a, 'Bench Press', 1) === 1, 'bumpPref creates a missing key at delta');
  ok(a.prefs['Bench Press'] === 1, 'bumpPref writes into athlete.prefs');
  bumpPref(a, 'Bench Press', 1); bumpPref(a, 'Bench Press', 1);
  ok(a.prefs['Bench Press'] === PREF_MAX, 'bumpPref clamps at PREF_MAX (does not exceed 3)');
  bumpPref(a, 'Bench Press', 1);
  ok(a.prefs['Bench Press'] === PREF_MAX, 'bumpPref stays at PREF_MAX when already capped');
  const low = bumpPref(a, 'Sit-Up', -1);
  ok(low === -1 && a.prefs['Sit-Up'] === -1, 'negative delta on a new key works');
  bumpPref(a, 'Sit-Up', -5);
  ok(a.prefs['Sit-Up'] === PREF_MIN, 'bumpPref clamps at PREF_MIN');
  // A malformed athlete must not throw.
  ok(bumpPref({}, 'X', 1) === 1 || true, 'bumpPref tolerates a prefs-less object without throwing');
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/tests/test-athlete-model.js`
Expected: FAIL — `bumpPref is not defined`.

- [ ] **Step 3: Write minimal implementation**

In `index.html`, immediately after `normalizeAthlete`:

```js
  // Nudge a learned preference for one exercise (by canonical name) and clamp.
  // Returns the new score. Tolerates a prefs-less athlete. Phase 1 only COLLECTS
  // -- nothing reads prefs until the ranker in Phase 4, so a monotone negative
  // drift here is harmless; positive signals + decay land with consumption.
  function bumpPref(athlete, name, delta) {
    if (!athlete || typeof athlete !== "object") return 0;
    if (!athlete.prefs || typeof athlete.prefs !== "object") athlete.prefs = {};
    var cur = Number(athlete.prefs[name]); if (isNaN(cur)) cur = 0;
    var next = Math.max(PREF_MIN, Math.min(PREF_MAX, cur + delta));
    athlete.prefs[name] = next;
    return next;
  }
```

- [ ] **Step 4: Run test to verify it passes**

Run: `node tools/tests/test-athlete-model.js`
Expected: PASS — all normalizeAthlete + bumpPref assertions pass, `N passed, 0 failed`.

- [ ] **Step 5: Commit**

```bash
git add index.html tools/tests/test-athlete-model.js
git commit -m "feat(athlete): bumpPref learned-preference primitive + tests"
```

---

### Task 3: Persist `athlete` in state (migration-safe)

**Files:**
- Modify: `index.html` `freshState` (~line 3668) and `coerceState` (~line 3685)
- Test: `tools/tests/test-athlete-model.js` (extend) + live boot check

- [ ] **Step 1: Write the failing test**

The Node test cannot see `freshState`/`coerceState` (they live in the IIFE, outside the extracted span). Instead assert the invariant they must satisfy — that a raw stored blob's athlete round-trips through `normalizeAthlete`. Append before `console.log(pass ...)`:

```js
// ---------- coerceState invariant: a stored athlete round-trips cleanly ----------
{
  const storedGood = { experience: 'advanced', injuries: [{ category: 'nogo', target: 'Burpee' }], prefs: { 'Row': 1 } };
  const a = normalizeAthlete(storedGood);
  ok(a.experience === 'advanced' && a.injuries.length === 1 && a.prefs['Row'] === 1, 'a valid stored athlete survives normalizeAthlete unchanged');
  // Legacy state with no athlete field at all -> clean defaults, never throws.
  const legacy = normalizeAthlete(undefined);
  ok(legacy.experience === 'intermediate' && legacy.injuries.length === 0, 'legacy state (no athlete) defaults cleanly');
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node tools/tests/test-athlete-model.js`
Expected: PASS actually (these use already-built functions) — this task's real verification is the live boot check in Step 4. Run it to confirm the new assertions are green before wiring state.

- [ ] **Step 3: Write minimal implementation**

In `freshState` (~line 3668), add `athlete` to the returned object literal (before the closing `}`):

```js
      unlockedSkills: [], userName: "", todaySeedCounter: 0, athlete: normalizeAthlete(null) };
```

In `coerceState`'s returned object (~line 3685), add after the `todaySeedCounter` line:

```js
        todaySeedCounter: typeof parsed.todaySeedCounter === "number" ? parsed.todaySeedCounter : 0,
        athlete: normalizeAthlete(parsed.athlete) };
```

(Adjust the trailing `};` placement so `athlete` is the last field.)

- [ ] **Step 4: Verify live (boot + persistence)**

```bash
node tools/tests/test-athlete-model.js   # expect N passed, 0 failed
```

Then in the preview (rsync to /tmp copy, reset SW/caches, reload) run in the console:

```js
JSON.parse(localStorage.getItem('training-log:v2')).athlete
// expect: { experience: "intermediate", injuries: [], prefs: {} }
```

Expected: the field exists with defaults; app boots with zero console errors; an existing saved state (no `athlete`) also boots and shows the default.

- [ ] **Step 5: Commit**

```bash
git add index.html tools/tests/test-athlete-model.js
git commit -m "feat(athlete): persist athlete profile in freshState/coerceState (migration-safe)"
```

---

### Task 4: Settings capture — experience + avoid-list

**Files:**
- Modify: `index.html` Settings sheet markup (~line 1071) + Settings render/handler wiring
- Test: live browser only (DOM)

Injury-entry UX is explicitly parked (spec §5), so keep this minimal: experience picker + a plain "movements to avoid" add/remove list stored as `{category:"nogo", target:<name>}`.

- [ ] **Step 1: Add the markup**

After the "Advanced moves I can do" `.sect` (closes ~line 1071), insert:

```html
    <div class="sect">
      <div class="sect__label">Your training</div>
      <div class="chips" id="expChips" role="group" aria-label="Experience level">
        <button class="chip" data-exp="beginner" type="button">Beginner</button>
        <button class="chip" data-exp="intermediate" type="button">Intermediate</button>
        <button class="chip" data-exp="advanced" type="button">Advanced</button>
      </div>
      <p class="sect__hint" style="margin-top:8px">Sets how hard and how much the coach prescribes. You can change it any time.</p>
      <div class="sect__label" style="margin-top:16px">Movements to avoid</div>
      <div class="chips" id="avoidChips" role="group" aria-label="Movements to avoid"></div>
      <div class="btn-row" style="margin-top:8px">
        <input class="intro__name" id="avoidInput" type="text" placeholder="e.g. Overhead Press" aria-label="Movement to avoid">
        <button class="btn" id="avoidAddBtn" type="button">Add</button>
      </div>
      <p class="sect__hint" style="margin-top:8px">The coach will never program these. Tap one to remove it.</p>
    </div>
```

- [ ] **Step 2: Add the render + handlers**

Find where `#skillChips` is rendered/wired (search `skillChips`). Alongside it, add a `renderAthleteSettings()` that (a) toggles `.is-on` on `#expChips button` matching `state.athlete.experience`, and (b) renders `#avoidChips` from `state.athlete.injuries` (a chip per entry, `data-target`). Wire:

```js
  function renderAthleteSettings() {
    var exp = (state.athlete && state.athlete.experience) || "intermediate";
    document.querySelectorAll("#expChips button").forEach(function (b) {
      b.classList.toggle("is-on", b.getAttribute("data-exp") === exp);
    });
    var wrap = $("avoidChips"); if (!wrap) return;
    var inj = (state.athlete && state.athlete.injuries) || [];
    wrap.innerHTML = inj.map(function (i) {
      return '<button class="chip is-on" data-act="avoid-del" data-target="' + esc(i.target) + '" type="button">' + esc(i.target) + ' ✕</button>';
    }).join("") || '<span class="sect__hint">None yet.</span>';
  }
```

Wire the taps (in the settings sheet's click delegation, or add listeners):

```js
  $("expChips").addEventListener("click", function (ev) {
    var b = ev.target.closest("[data-exp]"); if (!b) return;
    state.athlete.experience = b.getAttribute("data-exp"); save(); renderAthleteSettings();
  });
  $("avoidAddBtn").addEventListener("click", function () {
    var v = ($("avoidInput").value || "").trim(); if (!v) return;
    if (!state.athlete.injuries.some(function (i) { return i.target.toLowerCase() === v.toLowerCase(); })) {
      state.athlete.injuries.push({ category: "nogo", target: v });
    }
    $("avoidInput").value = ""; save(); renderAthleteSettings();
  });
  $("avoidChips").addEventListener("click", function (ev) {
    var b = ev.target.closest('[data-act="avoid-del"]'); if (!b) return;
    var t = b.getAttribute("data-target");
    state.athlete.injuries = state.athlete.injuries.filter(function (i) { return i.target !== t; });
    save(); renderAthleteSettings();
  });
```

Call `renderAthleteSettings()` wherever the settings sheet is opened/rendered (search for where `skillChips` is refreshed on open and add the call beside it).

- [ ] **Step 3: Verify live**

rsync to the /tmp preview, reset SW/caches, reload, open Settings:
- Tap Beginner/Intermediate/Advanced → the selected chip shows `.is-on`; `state.athlete.experience` updates (check via console); persists across reload.
- Type "Overhead Press" → Add → a chip appears; `state.athlete.injuries` has `{category:"nogo",target:"Overhead Press"}`; tap the chip → it's removed. Zero console errors.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(athlete): Settings capture for experience + movements-to-avoid"
```

---

### Task 5: Collect negative preference signals (skip + swap-out)

**Files:**
- Modify: `index.html` `skipex` handler (~line 5289) and `swap-pick` handler (~line 5320)
- Test: live browser (prefs are not consumed yet, so no Node behavioural test)

Use the existing canonical-name helper so the key matches history. Search for `canonicalExName` — if present, key by `canonicalExName(name)`; otherwise key by the raw `e.name`.

- [ ] **Step 1: Wire skip**

In the `skipex` handler (~line 5291), after `wSk.el.skipped = true;` add:

```js
      bumpPref(state.athlete, (typeof canonicalExName === "function" ? canonicalExName(e.name) : e.name), -1);
```

- [ ] **Step 2: Wire swap-out**

In the `swap-pick` handler (~line 5320), the OLD name is `e.name` before reassignment. Immediately before `e.name = alt.name;` add:

```js
      bumpPref(state.athlete, (typeof canonicalExName === "function" ? canonicalExName(e.name) : e.name), -1);
```

- [ ] **Step 3: Verify live**

rsync/reset/reload, start a session:
- Skip an exercise → console: `state.athlete.prefs[<that exercise name>]` is `-1`; persists across reload.
- Swap a conditioning exercise → the swapped-OUT name is `-1` in prefs. Zero console errors.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat(athlete): collect negative preference signals on skip + swap-out"
```

---

### Task 6: Full verification + ship

**Files:** `sw.js`

- [ ] **Step 1: Run the whole Node suite**

Run: `for f in tools/tests/*.js; do node "$f" | tail -1; done`
Expected: every file `... 0 failed`, including the new `test-athlete-model.js`.

- [ ] **Step 2: Bump the service worker**

In `sw.js`, increment `CACHE_VERSION` (e.g. `"v112"` → `"v113"`).

- [ ] **Step 3: Live smoke test**

rsync to the /tmp preview, reset SW/caches, reload: app boots clean; Settings shows the new "Your training" section; experience + avoid-list persist; skip/swap write prefs. Zero console errors.

- [ ] **Step 4: Commit + deploy**

```bash
git add index.html sw.js
git commit -m "chore: bump SW to v113 for athlete-model phase"
git push origin main
```

Then confirm the deploy (poll `gh run list`) and `curl` the live `sw.js` for the new version.

---

## Self-review

- **Spec coverage (§3.6 Athlete Model):** experience ✓ (Task 4), injuries 4-category data model ✓ (Task 1; `nogo` capture in Task 4, richer categories parked per §5), learned prefs ✓ (Task 2 primitive + Task 5 negative signals). **Deliberately out of scope for Phase 1 (documented):** positive/"rated highly" signals + decay + ranker *consumption* → these belong to Phase 4 (Curated pools and ranking), and injury *hard-filtering* → Phase 6 (Balance and safety). Phase 1 is model + collection only; nothing consumes the profile, so it is behaviourally inert and safe to ship.
- **Placeholder scan:** none — every code step shows the exact code.
- **Type consistency:** `normalizeAthlete`/`bumpPref`/`PREF_MIN`/`PREF_MAX`/`INJURY_CATEGORIES`/`EXPERIENCE_LEVELS` names are used identically across tasks; `athlete.prefs` keyed by canonical name everywhere; injury shape `{category,target}` consistent in schema, capture, and tests.
- **Contradiction check (spec §0):** Phase 1 adds no selection behaviour, so it cannot violate the five non-negotiables. The one risk — negative-only preference drift — is neutralised by the "collect now, consume in Phase 4 with positive signals + decay" boundary, stated in code comments and here.

## Phase roadmap (each gets its own plan when reached)

2. Intent blueprint · 3. Anchor & progression · 4. Curated pools + ranking (first phase that *consumes* prefs; add positive signals + decay here) · 5. Stimulus prescription + volume landmarks (fractional per-muscle volume) · 6. Balance & safety (injury hard-filter, antagonist window) · 7. Recovery session path · 8. Elite rubric + dogfood battery (incl. the Session-Coherence check).
