# Phase 7 (Recovery Session Path) — Implementation Plan

> **Status: plan only. No code has been written.** This follows the Phase 7
> Design Review (approved) and the five judgement calls approved alongside it.
> Wait for explicit approval of this plan before any test or code is written.

**Goal:** Close the two confirmed gaps between `recoverySession()` and
Programming Philosophy §3.8 — a missing light-pump movement and
non-deterministic breathing — entirely inside the existing function, reusing
existing pickers, the existing safety gate, and existing prescription
machinery. No new abstraction, no architecture change.

**Architecture:** Selection and Prescription are the only layers touched, and
only inside `recoverySession()` itself. Learning (`degradation`,
`computeFatigueState`, `getReadinessToday`) is read, never modified. The
Selection ranker, the Prescription table, and every existing entry point's
call to `isExerciseInjuryFlagged` remain byte-for-byte unchanged.

---

## 0. Phase boundary

**Phase 7 owns:**
- Adding one light-pump-style movement pick to `recoverySession()`.
- Making the Box Breathing close deterministic inside `recoverySession()`.
- Threading `unlockedSkillMap()` into `recoverySession()` (a new parameter,
  needed so the light-pump pick can respect skill-tier gating like every
  other picker already does).
- One clarifying comment resolving the old-vs-official "Phase 7" naming
  collision (Tech Debt Register item 9), since this phase is what makes the
  collision concrete.

**Phase 7 explicitly does NOT touch:**
- `degradation()`'s recovery/eased/normal decision logic — untouched.
- The "eased" behaviour (normal-session set-reduction) — untouched.
- The Selection ranker (`selectComplementary`) — untouched.
- The Prescription table (`PRESCRIPTION_TABLE`, `prescription()`) — the new
  light-pump pick is prescribed by the EXISTING `buildEx`/`prescription()`
  path, exactly like every other recovery-session exercise already is. No new
  prescription logic.
- `isExerciseInjuryFlagged` itself, or any of the 12 existing entry points —
  the new light-pump pick becomes a 13th caller of the *existing* gate, not a
  change to the gate.
- `generateProgram()` — confirmed out of scope (judgement call 4); no whole-
  week readiness concept exists to hang this on.
- Any UI file/layout/rendering code — this is pure session-content generation.

**Judgement calls already resolved (restated from your approval, not
re-litigated here):**
1. Light pump: exactly one movement, low-fatigue, non-compound, isolation-
   preferred, safety-gated; omitted honestly if no safe candidate exists.
2. Breathing: deterministic, reusing the existing Box Breathing lookup
   *pattern* (see §2 below for why the pattern is reused rather than the
   `buildWarmupCooldown` function itself).
3. "Extended recovery work": not a new category — out of scope for this
   phase's code (nothing to build; noted only so a future reader knows this
   was a deliberate reading of the spec, not an oversight).
4. Build-a-week boundary: `generateProgram()` untouched.
5. No new abstraction: everything lives inside `recoverySession()`.

---

## 1. Task 7.1 — Light-pump movement

**Skill lens: Strength & conditioning reasoning** (translating "restorative,
not a training stressor" into a concrete, checkable filter) **+ behaviour-
preserving engineering** (reusing the exact filter idiom `pickFiller`'s
`elig()` already established, rather than inventing new criteria).

**File:** `index.html`, `recoverySession()` (currently ~line 4613).

The filter reuses fields every LIBRARY entry already has —
`type`, `compound`, `fatigue_cost`, plus the existing `equipOk`/
`skillAllowed`/`isExerciseInjuryFlagged` gates every other picker in the file
already calls:

```js
// Phase 7: "light pump work" (Programming Philosophy §3.8) -- restorative,
// not a training stressor. Low fatigue_cost + non-compound is the same
// idiom pickFiller's elig() already uses for "won't tax what you just did";
// here there's no "main lift" to avoid, so the filter is simply: real
// strength work, low fatigue cost, not compound, and safe under every gate
// every other picker already enforces. Exactly one movement -- this is a
// light touch, not a training block. If nothing safe exists, omit it
// honestly (guarantees session never contains an unsafe pick; never forces
// one to avoid an "empty" slot).
function pickLightPump(allowed, used, seed, unlocked, injuries) {
  var pool = LIBRARY.filter(function (e) {
    return e.type === "strength" && !e.compound && e.fatigue_cost === "low"
      && equipOk(e, allowed) && !used[e.id] && skillAllowed(e, unlocked)
      && !isExerciseInjuryFlagged(e, injuries);
  });
  return pool.length ? pool[Math.abs(seed) % pool.length] : null;
}
```

Wired into `recoverySession()` after the existing conditioning pick, using
the same `used`-dedup convention already in the function:

```js
function recoverySession(allowed, seed, injuries, unlocked) {
  var used = {}, mobs = [];
  for (var i = 0; i < 4; i++) {
    var m = pickByType("mobility", allowed, used, seed + i * 3, injuries);
    if (m) { used[m.id] = 1; mobs.push(buildEx(m, "general", false, {}, 30, 1, false, {}, false, "Active recovery, prioritising mobility")); }
  }
  var extra = [], con = pickConditioning("z2", allowed, used, seed + 20, injuries);
  if (con) { used[con.id] = 1; extra.push(buildEx(con, "general", false, {}, 30, 1, false, {}, false, "Active recovery, easy effort only")); }
  // Phase 7: one light-pump movement, omitted honestly if none is safe.
  var pump = pickLightPump(allowed, used, seed + 27, unlocked, injuries);
  if (pump) { used[pump.id] = 1; extra.push(buildEx(pump, "general", false, {}, 30, 1, false, {}, false, "A light pump, easy on the joints -- not a training stressor today")); }
  ...
```

Prescription for this exercise runs through the exact same `buildEx(...,
"general", ...)` call every other recovery exercise already uses — no new
prescription code, the existing stimulus table's `general`/isolation row
already produces sensible light-isolation numbers.

**Test-first — write these failing, then implement:**
- `pickLightPump` returns a real exercise when a safe, non-compound,
  low-fatigue candidate exists.
- `pickLightPump` returns `null` when every candidate is injury-flagged (no
  unsafe fallback, matches the honest-omission requirement).
- `pickLightPump` returns `null` when every candidate is skill-locked
  (`unlocked` map excludes them) — proves the new skill-gate threading works.
- `pickLightPump` never returns a `compound: true` or `fatigue_cost !==
  "low"` exercise, across a seed sweep (proves the filter, not luck).
- `recoverySession()` includes exactly one strength-type exercise when a safe
  light-pump candidate exists.
- `recoverySession()` includes **zero** strength-type exercises when every
  candidate is unsafe (regression-proof of honest omission at the
  integration level, not just the unit level).

---

## 2. Task 7.2 — Deterministic Box Breathing close

**Skill lens: behaviour-preserving engineering** (reuse, don't duplicate) +
**software architecture reasoning** (why the *pattern* is reused, not the
`buildWarmupCooldown` function call itself).

**Judgement call, disclosed rather than silently decided:** `recoverySession`
cannot call `buildWarmupCooldown` directly — that function derives its warm-up
*groups* from `strengthPicks`' own patterns (`GENERAL_PREP_MAP`), builds a
pulse-raiser, and produces movement-prep drills that don't fit a recovery
session's shape (no strength picks exist to derive prep groups from, and a
recovery session doesn't want a pulse-raiser or joint-prep drills — it wants
quiet, low-load content). Forcing `recoverySession` through that function
would require passing it fake/empty `strengthPicks` and then discarding most
of its output — more convoluted than reusing the 5-line lookup pattern
directly, and `buildWarmupCooldown`'s own gate on this exact lookup
(`index.html:~2828-2832`) is already exactly this small. Reusing the
*pattern* (same lookup, same gate, same construction) rather than the whole
function is the smaller, more honest form of reuse here — flagging this
explicitly rather than silently picking one interpretation of your approval.

```js
// Phase 7: deterministic breathing close, same lookup + same safety gate
// buildWarmupCooldown already uses for this exact exercise (index.html
// ~2828-2832) -- reused directly rather than duplicated with different
// wording. Recovery sessions don't share buildWarmupCooldown's shape (no
// strengthPicks to derive prep groups from, no pulse-raiser/joint-prep
// content wanted here), so the small lookup is reused on its own rather
// than routing through the whole function.
var breathing = LIBRARY.filter(function (e) { return e.id === "box-breathing"; })[0];
if (breathing && !used[breathing.id] && !isExerciseInjuryFlagged(breathing, injuries)) {
  used[breathing.id] = 1;
  extra.push(buildEx(breathing, "general", false, {}, 30, 1, false, {}, false, "A steady close, heart rate down before you go"));
}
```

**Test-first:**
- `recoverySession()` includes Box Breathing when it's safe and not already
  used.
- `recoverySession()` omits Box Breathing (honestly, no substitute forced)
  when it's injury-flagged — proves the gate applies even to this
  deterministic addition, not just the random-pool pickers.
- Regression: existing mobility (4 draws) and Zone 2 conditioning content
  still appear unchanged in shape and count.

---

## 3. Task 7.3 — Signature/call-site update

**Skill lens: behaviour-preserving engineering.** `recoverySession` gains one
new trailing parameter (`unlocked`), matching the established pattern for
every prior additive parameter in this file (`injuries`, `weeklyVolume`,
`balance` were all added the same way — trailing, optional, backward-
compatible).

**File:** `index.html`, the one real call site (~line 7011):

```js
pendingToday = recoverySession(req.equipment, todaySeed, state.athlete && state.athlete.injuries, unlockedSkillMap());
```

**Test-first:**
- `recoverySession()` called without the new `unlocked` argument (simulating
  every call site that predates this change) still builds successfully —
  `skillAllowed(e, undefined)` must not throw (confirm its existing null-
  safety, don't assume).

---

## 4. Task 7.4 — Naming-collision comment

**Skill lens: maintainability reasoning.** A one-comment fix, no behaviour
change: add a note near the existing `// Phase 7 (2.1b)` markers
(`index.html:~7009`) clarifying that this refers to the pre-Programming-
Philosophy numbering, and that the *official* Phase 7 (Recovery Session Path,
§3.8) is the light-pump/breathing work this plan adds — matching the
clarifying-note treatment already given to the earlier "Phase 5" collision.
Not a functional change; bundled here because this phase is what makes the
collision concrete, per the Tech Debt Register's own suggested handling.

---

## 5. Full verification (Section 5, matching every prior phase's format)

**Skill lens: test engineering + safety engineering.**

Required regression/safety/architecture-boundary tests, all in one new file
(`tools/tests/test-phase7-recovery.js`, following the established harness
pattern):

1. `recoverySession()` includes a light-pump movement when a safe one
   exists.
2. `recoverySession()` omits light pump (zero strength-type exercises) when
   every candidate is unsafe — proves honest omission, not a forced pick.
3. `recoverySession()` includes deterministic Box Breathing when safe.
4. Existing mobility (4 draws) and Zone 2 conditioning content still appear,
   unchanged in shape/count (regression).
5. **Safety invariant:** sweep many seeds with a real injury profile that
   flags the light-pump candidate pool entirely; confirm no injury-flagged
   exercise ever appears anywhere in the returned session (not just the new
   pick — the whole session).
6. **Architecture boundary:** `degradation()` called with the same
   fatigue/readiness/patterns inputs before and after this change returns the
   identical string — proves Phase 7 never touches that decision.
7. **Architecture boundary:** `generateProgram()` called with an identical
   seed/intake before and after this change produces an identical program —
   proves the build-a-week path is genuinely untouched.
8. **Safety invariant, whole-suite:** re-run the existing safety sweep style
   from `test-phase5.5-integrity-patch.js` (every entry point still routes
   through `isExerciseInjuryFlagged`) and add `pickLightPump` to that list as
   entry point #13 — confirmed gated, not exempt.
9. Full 15-file regression suite: every pre-existing file pass-count-
   identical to the current baseline.
10. Live browser verification: trigger a rough-readiness "Just Today" build,
    confirm the recovery session renders with mobility + conditioning +
    (when safe) light pump + breathing, zero console errors; separately
    confirm a normal (non-recovery) build is visually/functionally
    unaffected.

**Do not push or deploy until the completion report is reviewed and
approved** — same standing rule as every prior phase.

---

## 6. Completion report template (for when this is implemented)

Matching every prior phase: what changed / what deliberately did not change
(`degradation`, the ranker, the prescription table, `generateProgram`,
every existing entry point's gate) / specialist skill used per task / exact
tests added / full regression result / behaviour changes disclosed (a rough-
readiness recovery session may now include one additional strength-type
exercise and a guaranteed breathing close — an intentional coaching
improvement, not a regression) / risks / judgement calls (the reuse-the-
pattern-not-the-function decision in §2, restated) / Technical Debt Register
changes / scope drift (expected: none).

---

## Summary of what needs your approval before implementation begins

1. The `pickLightPump` filter definition in §1 (type=strength, !compound,
   fatigue_cost=low, plus the existing equipment/skill/injury gates) — does
   this match your intent for "restorative, not a training stressor," or
   should the filter be narrower/broader?
2. The §2 judgement call: reusing the Box Breathing lookup *pattern* directly
   inside `recoverySession` rather than routing through
   `buildWarmupCooldown` wholesale — confirm this reading of "reuse the
   mechanism or the pattern" is acceptable.
3. Everything else in this plan follows directly from your five approved
   judgement calls with no further invention.

No code has been written. Awaiting your review of this plan before any test
or implementation work begins.
