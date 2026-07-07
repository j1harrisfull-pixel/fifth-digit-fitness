# Technical Debt Register

Persistent, cross-phase record of known issues that are real but deliberately
not being fixed right now. The point of this file is that these stop being
*rediscovered* in every architecture review — read this first, then only
re-verify an item if you have reason to think it's changed.

**Do not action any item here unless it is explicitly and separately scoped.**
Being on this list is not an invitation to fix it opportunistically.

---

### 1. Epley 1RM formula duplicated ~4 times
- **Where:** `index.html` — independently re-implemented inside `computeFatigueState`, `computeWeekRecap`, a lifetime-stats block, and once more as `est1RM` (adds `Math.round`).
- **Risk:** Low.
- **Architecture impact:** Maintainability only — one formula, four copies to keep in sync.
- **Coaching impact:** None — all four compute the identical formula today.
- **Why deferred:** Not required for correctness of any shipped phase.
- **Suggested handling:** Consolidate into one shared helper the next time any of the four sites is touched for an unrelated reason.

### 2. LIBRARY name-lookup duplicated (grew from ~4 to 6 sites)
- **Where:** `libEntryByName` (canonical) plus independent inline `LIBRARY.forEach` / lowercase-map builds in `mostRecentByPattern`, `topUpThinDay`, `computeWeeklyDebt`, `computeFatigueState`, and a UI-layer `libByName`.
- **Risk:** Low.
- **Architecture impact:** Maintainability only.
- **Coaching impact:** None.
- **Why deferred:** Not required for any shipped phase; growth has been incidental, not from any one phase's negligence.
- **Suggested handling:** Consolidate opportunistically; worth noting the count is trending up, not down — watch it doesn't keep growing silently.

### 3. Documentation drift (§3.5 stale re: Phase 6 specifics; no committed Phase 6 completion doc)
- **Where:** `docs/PROGRAMMING-PHILOSOPHY.md` §3.5 still reads as pre-Phase-6; the Phase 6 DESIGN doc's Task 6.1 still lists categories (push:pull, shoulder-health) that were explicitly dropped as redundant during implementation.
- **Risk:** Low.
- **Architecture impact:** None — code is correct, only the doc trails it.
- **Coaching impact:** None directly, but a future reader relying only on docs (not git history) would be misled about what Phase 6 actually built.
- **Why deferred:** Not blocking any phase.
- **Suggested handling:** Update §3.5 and add a short Phase 6 completion note opportunistically.

### 4. `isHeavyLowerRole` checks role name, not actual selected pattern content
- **Where:** `index.html`, `isHeavyLowerRole(role)` / `pickHardConditioningDay` — keys off `role === "lower" || role === "legs"`, not what patterns actually landed in that day.
- **Risk:** Low-Medium.
- **Architecture impact:** Blueprint-layer correctness gap — a `"full"`-role day with a squat-heavy lead isn't flagged as heavy-lower-adjacent; a `"lower"`-role day that ended up hinge-light still is.
- **Coaching impact:** Could occasionally misplace the week's one hard-conditioning day relative to true heavy-lower load.
- **Why deferred:** Changing a working, tested, deterministic hard rule needs its own explicit sign-off — found during a Phase 5.5 audit, correctly reported rather than silently patched.
- **Suggested handling:** Scope as its own small phase if real-world conditioning-spacing complaints ever surface.

### 5. `generateProgram`'s `balance: null` — Balance signals never apply to whole-week builds
- **Where:** `index.html`, `generateProgram`'s `selectComplementary` call hardcodes `balance: null`, mirroring the pre-existing `debt: null` choice there.
- **Risk:** Low.
- **Architecture impact:** None — deliberate and consistent with existing precedent (frozen block-wide picks don't use in-progress weekly signals).
- **Coaching impact:** Balance (unilateral-presence, anterior:posterior, spinal-load) only ever nudges "Just Today" single-session builds, never whole-week program builds.
- **Why deferred:** Intentional architectural consistency, not an oversight — recorded so it's not mistaken for a bug later.
- **Suggested handling:** Revisit only if Balance's coaching value is judged worth extending to weekly builds.

### 6. Conditioning/endurance LIBRARY entries lack real `joint_stress` metadata
- **Where:** Every `type: "conditioning"` LIBRARY entry (and the `RUN_PLAN` templates) carries `joint_stress: []`.
- **Risk:** Low (no safety failure — injury filtering still runs, it just can only match by name-substring for this content type, never by real joint tags).
- **Architecture impact:** None.
- **Coaching impact:** Injury filtering is less precise for conditioning/running work specifically than for strength/mobility work.
- **Why deferred:** Requires a content-authoring pass (tagging real joint stress per conditioning modality), not a code change.
- **Suggested handling:** Schedule as a content task, independent of any coaching-engine phase.

### 7. Parallel `WEEKLY_SET_TARGETS` (pattern-keyed) / `MUSCLE_VOLUME_LANDMARKS` (muscle-keyed) tables, no cross-check
- **Where:** `index.html`, both tables near each other, both real and both used correctly today, never reconciled against each other.
- **Risk:** Low.
- **Architecture impact:** Two sources of truth for "how much volume is enough," expressed in two different taxonomies (movement pattern vs. muscle).
- **Coaching impact:** None observed — the two tables haven't been found to disagree in a way that produces a bad session.
- **Why deferred:** Reconciling them is a bigger data-modelling project than any single phase has needed so far.
- **Suggested handling:** Revisit only if the two tables are ever found to disagree in practice.

### 8. Stale `"Phase 9"` reference in `stubBlockWeek()`/`resolveSpec()` comments
- **Where:** `index.html`, `stubBlockWeek()` comment: *"block-week remains a stub until Phase 9"*, and `resolveSpec()`'s adjacent comment.
- **Risk:** Low (comment-only).
- **Architecture impact:** None.
- **Coaching impact:** None.
- **Why deferred:** The official build order (`PROGRAMMING-PHILOSOPHY.md §4`) only has 8 phases, ending at "Elite rubric and dogfood battery" — there is no "Phase 9." This is a leftover from an earlier, different numbering.
- **Suggested handling:** Correct the comment the next time `stubBlockWeek` is touched for any reason.

### 9. Old ad-hoc "Phase 7" numbering collision — **RESOLVED in Phase 7 (Recovery Session Path)**
- **Where:** `index.html` comments like `// Phase 7 (2.1b)` near `recoverySession`/`degradation`/the readiness UI flow.
- **Resolution:** A clarifying comment was added at the `deg === "recovery"` UI branch (near the old `// Phase 7 (2.1b)` marker) explaining the numbering collision and pointing to the real official-Phase-7 work inside `recoverySession()` itself. No further action needed.

### 10. `INJURY_KEYWORD_TAGS` has no `"elbow"` entry
- **Where:** `index.html`, `INJURY_KEYWORD_TAGS` (near `normalizeInjuryText`/`isExerciseFlaggedByInjury`) — covers shoulder, knee, spine, neck, wrist, hip, ankle, overhead. No `elbow` key exists.
- **Discovered:** While writing Phase 7's test-first work (`test-phase7-recovery.js`) — a real, reproducible gap, not fixed as part of Phase 7 per the "no new safety logic" guardrail.
- **Risk:** Low-Medium. Every elbow-only-tagged exercise (curls, pushdowns, wrist work, most arm isolation — roughly 15+ LIBRARY entries) can only be excluded from a candidate pool via an exact tier-4 name match, never via joint-tag matching, unlike every other tracked joint region.
- **Architecture impact:** None — this is a data/vocabulary gap in the existing bridge-tier matcher (Phase 4), not a structural issue.
- **Coaching impact:** An athlete who tags an "elbow" injury (rather than naming a specific exercise) will not have elbow-stressing isolation work filtered out.
- **Why deferred:** Extending `INJURY_KEYWORD_TAGS` is itself new safety logic — explicitly out of scope for Phase 7, and not something to patch opportunistically without its own review.
- **Suggested handling:** Add an `elbow: { joints: ["elbow"] }` entry to `INJURY_KEYWORD_TAGS` as a small, explicitly-scoped safety task — should get the same test-first + safety-reasoning treatment as any other injury-filtering change, not be folded into an unrelated phase.

### 11. `normalizeInjuryText`'s back→spine replacement has no word boundary
- **Where:** `index.html`, `normalizeInjuryText`, the `.replace(/(lower\s*)?backs?|lumbar/g, "spine")` line.
- **Discovered:** While writing Phase 7's test-first work — confirmed directly: `normalizeInjuryText("Triceps Kickback")` corrupts to `"...kickspine"` (the regex matches "back" inside "Kickback" with no word-boundary guard), so a full-name tier-4 injury match against "Triceps Kickback" silently fails.
- **Risk:** Medium. This is the same class of bug the project already found and fixed once before for "L-Sit" (the `l`/`r` single-letter replacement was made whitespace-bounded specifically because it was corrupting real exercise names) — the back/spine replacement was never given the same treatment.
- **Architecture impact:** None — contained entirely within `normalizeInjuryText`.
- **Coaching impact:** Any exercise whose name contains "back" as a raw substring of a longer word (currently known: "Triceps Kickback"; there may be others not yet audited) silently fails to match a same-name injury target, the same way "L-Sit" once did before that fix.
- **Why deferred:** Fixing this is new safety logic (a change to the injury-matching bridge itself) — explicitly out of scope for Phase 7's two approved judgement calls.
- **Suggested handling:** Apply the same word-boundary fix already used for the `l`/`r` replacement (e.g. `\bbacks?\b` with a `lower\s+` prefix allowance) as its own small, explicitly-scoped safety task, with a full audit of LIBRARY names for any other substring collisions (not just "kickback") before shipping the fix.

---

## Future retrospective audits (recorded, not scheduled)

After the coaching engine reaches Version 1 (i.e., after Phase 8 — Elite Rubric — ships), perform retrospective Architecture Freeze Reviews of:
- **Phase 1 — Athlete model**
- **Phase 2 — Intent blueprint**

using the same stricter method developed for Phases 5.5/6. These two phases predate that discipline and have never been audited to it.
