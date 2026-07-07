# Phase 6 (Balance & Safety) — Design Only, No Code

> **Status: DESIGN, not an implementation plan.** No code is written against this
> document until James reviews and approves it. Once approved, a follow-up
> implementation plan (matching the Phase 1–5.5 format, with real code
> snippets and step-by-step tasks) will be written separately.

**Coaching Engine Version 1.0 is complete** (Phases 1–5.5). This is the first
phase built *on top of* a stable engine, not while constructing one. Every
section below states which specialist skill is being applied, because this
phase sits at the exact seam between software architecture and real coaching
judgement, and the two must not be allowed to blur into each other.

---

## 0. What already exists (read this before anything else)

**Skill: software architecture reasoning.** Before designing anything new, the
first responsibility is to establish what the engine *already does* in this
space — Phase 6 must extend that, not duplicate or route around it.

Programming Philosophy §3.5 ("Balance & Safety") states three things in prose:
injury categories (built, Phase 4), "antagonist balance is tracked
continuously," "weak points earn additional accessory work," and "hard
conditioning is separated appropriately from heavy lower-body work." Reading
the actual shipped code against that prose:

1. **Per-pattern weekly debt already exists and already drives Selection.**
   `WEEKLY_SET_TARGETS` (`index.html:4248`) sets a weekly target per
   movement-pattern (`squat:10, hinge:10, horiz_push:12, horiz_pull:12,
   vert_push:8, vert_pull:10, lunge:6, carry:4, ...`). `computeWeeklyDebt()`
   compares actual completed sets against these targets and produces a
   `ranked` list sorted by debt (highest-debt pattern first). This `ranked`/
   `byPattern` data is already read by `selectComplementary`'s ranker as a
   scoring term — **the antagonist/pattern-balance mechanism §3.5 promises is
   already built and live**, not something Phase 6 invents from nothing.
   Notably `horiz_push`/`horiz_pull` are already equal (12/12) and
   `vert_push`/`vert_pull` already lean posterior (8/10) — i.e. a push:pull
   and horizontal:vertical bias is already encoded in these numbers today.
   The code's own comment at the end of `computeWeeklyDebt` says so directly:
   *"byMuscle carries completed-set counts only; per-muscle TARGETS are a
   documented follow-on (pattern debt is the operative signal for
   antagonist/pattern balance)."* Phase 6 is that documented follow-on.

2. **A weak-point ranking hook already exists and is already wired — it's
   just fed by a stub.** `selectComplementary`'s ranker (`index.html:2510`)
   already applies a real scoring bonus (`s -= 4`) when a candidate's primary
   muscle is in `biasMuscles`. The only thing missing is a real value for
   `biasMuscles` — today it's always `[]`, because `weakPointMuscles()`
   (`index.html:2427`) is a placeholder that always `return []`. **Phase 6's
   weak-point work is therefore a Learning-layer detection task feeding an
   already-built, already-tested Selection-layer hook — not a new ranking
   mechanism.**

3. **Hard-conditioning spacing already exists.** `pickHardConditioningDay`
   (Phase 7.2) already places the week's one hard conditioning session away
   from the heaviest lower-body day. Phase 6's job here is to *audit* this
   existing rule against the newly-explicit categories (does it need to know
   about hinge-heavy days specifically, not just "heavy lower" generically?),
   not to rebuild it.

4. **`is_unilateral` exists on every LIBRARY entry and is currently
   validated but never aggregated.** `libraryIntegrity()` checks the field
   exists; nothing sums it into a weekly total. This is real, already-present
   data with no consumer yet — exactly the kind of gap Phase 6 should close,
   not invent new authoring for.

5. **Anterior:posterior has no existing aggregate at all.** Unlike
   unilateral:bilateral (real field, no consumer) or push:pull (already
   modelled via existing patterns), there is no field or derived grouping
   that already encodes "anterior" or "posterior." This is a genuine new
   judgement call (§3 below), not a gap-filling exercise.

6. **The `purposeSlots`/`accessory_weak_point` system is dead code.** The
   Architecture Freeze Review found `derivePurposeSlots()`'s output is
   computed but never read by `generateSession`/`generateProgram` — including
   the `accessory_weak_point` slot that already exists there, permanently
   `dormant`. **Phase 6 must not build on top of this dead system.** Reviving
   it is a separate, larger, riskier decision than anything in this phase's
   scope — flagged as an explicit non-goal (§7).

7. **Fatigue sensing is already pattern-scoped (Phase 5.5).**
   `computeFatigueState`/`fatigueBandForPatterns`/`degradation` already
   produce a per-pattern red/amber/green read. Balance must compose with
   this, never duplicate or override it (§4, priority hierarchy).

**Conclusion, stated plainly:** Phase 6 is not a new subsystem. It is an
extension of one existing seam — `computeWeeklyDebt` (Learning) →
`selectComplementary`'s ranker (Selection) — to (a) add the categories that
seam doesn't yet cover, (b) make its effect legible/reportable rather than a
silent ranking nudge, and (c) define exactly how it composes with the other
already-built signals (fatigue, safety, progression) it will now sit
alongside.

---

## 1. Architecture ownership (per the frozen contract)

**Skill: software architecture reasoning.**

```
Athlete    → injuries/experience/preferences (unchanged, Phase 6 reads, never writes)
Intent     → unchanged; Phase 6 does not add a new goal/stimulus vocabulary
Blueprint  → owns ONE new decision: conditioning-spacing audit/extension (§3, item 6)
Selection  → owns ALL balance/weak-point ranking bias (extends existing ranker terms)
Prescription → unchanged; Phase 6 never touches sets/reps/rest/RIR
Progression → unchanged; Phase 6 never touches anchor freeze/weight progression
Learning   → owns ALL balance measurement (extends computeWeeklyDebt), and
             owns the real weakPointMuscles() implementation
```

**Hard rule for this phase:** Balance is measured in Learning and consumed in
Selection, exactly like debt/recency/preference already are today. If any
task design requires Blueprint or Prescription to *decide* a balance outcome
(as opposed to Blueprint's one narrow conditioning-spacing exception below),
that is a violation and must be raised, not silently implemented.

---

## 2. What is "balance"? (definition, before any measurement)

**Skill: Strength & Conditioning reasoning.**

Balance is **not** a single number. It is a set of independent ratios between
paired categories of training stress, each tracked over a rolling window,
each capable of nudging Selection's ranker toward the under-served side of
the pair when a slot's constraints allow more than one reasonable candidate.
Balance is never a hard veto on its own — an elite coach corrects imbalance
across weeks, not by refusing to program a session today. (Codified formally
in §4's priority hierarchy.)

**Time window:** every category below uses the **same rolling window
`computeWeeklyDebt` already uses** — the active program week
(`state.program.weeks[state.activeWeek]`) — for architectural consistency: one
Learning-layer read, one time semantic, no second clock living in parallel.
This is itself a judgement call, flagged in §7 (a single week is a short,
noisy window for some ratios; the alternative — a multi-week rolling window —
is real but is a bigger data-modelling change and is deliberately deferred,
not silently assumed).

---

## 3. The ten categories — measurement, storage, timing, ownership, hard/soft

**Skill: Strength & Conditioning reasoning for the coaching classification;
data modelling for storage/measurement; software architecture reasoning for
ownership.**

| # | Category | What is measured | Where stored | When evaluated | Owning layer | Hard or soft? |
|---|---|---|---|---|---|---|
| 1 | Push : Pull | Completed sets summed across `{hpush, vpush, triceps}` vs `{hpull, vpull, biceps}`, via existing `movement_pattern`/`pattern` fields | Derived, not persisted — computed fresh in `computeWeeklyDebt`'s extension, same as `byPattern` today | Every time `computeWeeklyDebt` runs (session/week build, home-screen debt read) | **Learning** measures; **Selection** consumes as ranker bias | **Soft.** Already partially encoded via `WEEKLY_SET_TARGETS`; Phase 6 makes the *ratio* explicit and legible, not a new hard rule |
| 2 | Horizontal : Vertical | Completed sets summed across `{hpush, hpull}` vs `{vpush, vpull}` | Same as #1 | Same as #1 | Learning / Selection | **Soft** |
| 3 | Squat : Hinge | Completed sets, `squat` vs `hinge` patterns directly (already first-class patterns, no new grouping needed) | Same as #1 | Same as #1 | Learning / Selection | **Soft** |
| 4 | Unilateral : Bilateral | Completed sets where the exercise's real `is_unilateral` LIBRARY field is `true` vs `false` | Same as #1 (new field on the same derived structure) | Same as #1 | Learning / Selection | **Soft, and weaker than #1–3** — see judgement call §7.1: this is a presence/threshold check ("did unilateral work happen at all this week"), not a strict target ratio, because no real coaching consensus sets a fixed unilateral:bilateral ratio the way push:pull is roughly 1:1 |
| 5 | Anterior : Posterior | Completed sets summed across a **new** pattern-group mapping (proposed in §7.2, requires sign-off) | Same as #1 | Same as #1 | Learning / Selection | **Soft** |
| 6 | Conditioning spacing | Whether the week's one hard conditioning session lands adjacent to the heaviest lower-body day (existing check) — Phase 6 audits whether "heaviest lower-body day" should specifically mean "highest hinge/spinal-load day" | Not new storage — reads the same `roleList`/`blueprint` already built during `generateProgram` | At program-build time, once per week, exactly as today | **Blueprint** (unchanged owner — this is the one item that stays a Blueprint-level structural decision, not a Selection ranker term) | **Hard** — this is already a deterministic placement rule, not a scored preference, and must stay that way (weakening it to "soft" would be a regression) |
| 7 | Lower-back fatigue management | Sum of completed sets across exercises whose real LIBRARY `joint_stress` includes `"spine"` (existing tag, e.g. hinge/carry/anti-extension work already carries this) | Same as #1 (new field) | Same as #1 | Learning / Selection | **Soft.** No established "spinal MRV" the way muscle MRV (Phase 5) has real numbers — this is a de-prioritization nudge, not a hard cap. Flagged as higher-risk judgement call in §7.3 |
| 8 | Shoulder health | Ratio of vertical-pull-plus-external-rotation work to vertical-press work (reuses the existing `overhead` injury-keyword vocabulary's spirit, not its code) | Same as #1 | Same as #1 | Learning / Selection | **Soft** |
| 9 | Weak-point prioritisation | Real implementation of `weakPointMuscles()`: which primary muscles are *most behind* their weekly target (reuses `ranked`/`byMuscleVolume`, already computed) | No new storage — reads existing `computeWeeklyDebt` output | Same as #1 | **Learning** produces the list; **Selection**'s existing `biasMuscles` hook (already live) consumes it unchanged | **Soft**, and explicitly opportunistic per the Philosophy's own wording ("earns additional accessory work **when time allows**") — never displaces a required slot |
| 10 | Recovery interactions | Not a new measurement — a **composition rule**: any pattern currently fatigue-red/amber (Phase 5.5's `fatigueBandForPatterns`) has its balance-nudge suppressed for that pattern this session | No new storage | At ranking time, per candidate, per session build | **Selection** (reads Learning's existing fatigue output, same as it already does for anchor deload) | **Hard priority ordering between two soft systems** — see §4 |

---

## 4. Conflict resolution — priority hierarchy

**Skill: software architecture reasoning.** The proposed hierarchy in the
brief (Safety → Medical → Programming integrity → Progression → Balance →
Variety) is close, but collapsing it onto the engine's *actual* decision
systems (established across Phases 4–5.5: hard constraints, soft constraints,
prescription, progression are four separate systems that never merge into one
score) gives a cleaner, already-precedented ordering:

```
1. Safety (hard constraint — injury/equipment/skill filtering, Selection layer)
   — medical restrictions ARE safety; not a separate tier, they're the same
   gate (isExerciseInjuryFlagged) already enforced everywhere per Phase 5.5.
2. Prescription integrity (MRV, RIR/stimulus-table honesty — Prescription layer)
   — Balance NEVER causes an unsafe over-prescription; it only ever
   influences WHICH exercise is picked, never how it's dosed.
3. Progression integrity (anchor freeze/weight progression — Progression layer)
   — Balance never swaps, blocks, or re-scores a frozen anchor.
4. Recovery / fatigue easing (Learning → Selection, Phase 5.5)
   — outranks Balance: a fatigued pattern's balance-nudge is suppressed,
   never the reverse (item #10 above).
5. Balance (this phase — Learning → Selection ranker bias)
6. Variety / recency / learned preference (existing ranker terms, Phase 4)
```

This is **not a new arbitration mechanism** — it's the existing weighted
ranker in `selectComplementary`, with Balance added as one more scored term
(same shape as debt/recency/preference/SFR today), evaluated only among
candidates that already survived the hard-constraint filter. Conflicts
resolve exactly the way they resolve today: hard constraints prune first, one
weighted sum picks among survivors, deterministic and reproducible per seed —
no new "if balance says X but variety says Y" special-case logic is needed,
because it was never a separate decision system to begin with.

---

## 5. Judgement calls requiring explicit sign-off before implementation

**Skill: Strength & Conditioning reasoning + safety reasoning.** These are
real coaching decisions, not implementation details — per the standing
guardrail ("never invent coaching behaviour"), each needs your confirmation
before any code is written.

### 5.1 Unilateral:bilateral — threshold, not ratio
Proposed: a soft "did real unilateral work happen this week for
lower/upper" presence check (e.g. flag if zero unilateral sets logged in a
role that had the opportunity), rather than a numeric target ratio. Rationale
above. **Needs confirmation**, or a specific ratio if you'd rather commit to
one.

### 5.2 Anterior:posterior pattern-group mapping
Proposed mapping (draft, not yet approved):
- **Anterior:** `squat, hpush, vpush, lunge, isolation_quads, isolation_chest,
  isolation_shoulders, anti_extension`
- **Posterior:** `hinge, hpull, vpull, isolation_hamstrings, isolation_glutes,
  isolation_back, carry`
- **Deliberately unclassified (neither):** `core` (anti-rotation/lateral-
  flexion variants aren't cleanly anterior or posterior), `biceps/triceps`
  (arm isolation, not trunk-plane), `calf`, `power`.

This mapping directly determines what the ratio measures — a wrong
classification silently biases every athlete's programming. **Needs your
explicit review of the list above before implementation, not just the
category name.**

### 5.3 Lower-back / spinal-load nudge — soft only, confirm the tag source
Proposed: sum sets where LIBRARY's `joint_stress` includes `"spine"` (already
tagged on ~dozens of entries today, verified in the Architecture Freeze
Review). This is real existing data, not new authoring. **Needs confirmation
that a soft de-prioritization nudge (not a hard cap) is the right initial
strength — there's no equivalent to Phase 5's muscle-MRV literature for
"spinal volume," so this is more coach-intuition than evidence-based number,
and should be named as such rather than presented with false precision.**

### 5.4 Rolling window — single week vs multi-week
Proposed: reuse `computeWeeklyDebt`'s existing single-week window for
architectural consistency (§2). Real limitation: a single week is noisy for
coarse ratios (e.g. one heavy squat day can swing squat:hinge for the whole
week). **Needs confirmation this is acceptable for v1**, with a multi-week
rolling window flagged as explicit future work if not (a bigger data-model
change — would need to read `state.archive` the way `computeFatigueState`
already does for its own baseline window, which is a real precedent to reuse
later, not invent fresh).

### 5.5 Whether conditioning-spacing needs to know about hinge specifically
Proposed: audit only, not a change, unless the audit finds a real gap (e.g.
a hinge-heavy day with a light squat day is today read as "not the heaviest
lower day" and could still collide with the hard conditioning session).
**This audit is a Task in §6, not a pre-committed change — outcome unknown
until the audit runs.**

---

## 6. Task breakdown (for the follow-up implementation plan)

**Skill: test engineering**, stated once here since it governs every task
below: every task follows write-failing-tests → implement minimum code →
full regression suite → live browser verification, exactly as every prior
phase. Every row in §3's table gets at least one dedicated regression test
proving the hard/soft classification holds (a "soft" nudge must be provably
overridable by a hard constraint in a test; a "hard" rule must be provably
un-overridable).

| Task | Skill lens | Scope |
|---|---|---|
| 6.1 | Data modelling | Extend `computeWeeklyDebt` with a new `byBalance` (or similarly named) structure covering push:pull, horiz:vert, squat:hinge, unilateral:bilateral (pending 5.1), anterior:posterior (pending 5.2 sign-off), shoulder-health ratio, spinal-load sum (pending 5.3). Additive only — `byPattern`/`byMuscle`/`byMuscleVolume`/`ranked` byte-for-byte unchanged, proven by regression test, exactly like every prior extension of this function. |
| 6.2 | Strength & Conditioning reasoning + behaviour-preserving engineering | Implement real `weakPointMuscles()` reading `ranked`/`byMuscleVolume` debt, replacing the `[]` stub. Wire its output into the *already-existing* `biasMuscles` ranker parameter — no ranker-scoring-logic changes, only supplying real data to an existing, tested hook. |
| 6.3 | Software architecture reasoning + safety reasoning | Add the Balance ranker term to `selectComplementary`, positioned per §4's hierarchy (after hard constraints, composed with — never overriding — the existing fatigue/recovery suppression from Phase 5.5). Test: a candidate favored by Balance must never be selected if fatigue-red for that pattern (proves §3 item 10 / §4 ordering). |
| 6.4 | Software architecture reasoning | Audit (not change, unless the audit finds a real gap — see §5.5) `pickHardConditioningDay` against the hinge-specific question. If a gap is found, raise it as a separate, explicitly-scoped fix before implementing — not folded silently into 6.3. |
| 6.5 | Usability reasoning | Decide, with you, whether any of §3's new balance data should be user-visible (e.g. a "why" line addition, matching the existing per-exercise why-block pattern) or purely an internal ranking signal for v1 — explicitly NOT decided in this design doc, since it's a product/UI question, not an architecture one. |
| 6.6 | Test engineering + usability reasoning | Full regression suite (all prior files pass-count-identical) + live browser verification (build sessions across kits/goals/injury profiles, confirm balance nudges are visible in generated content without breaking any existing invariant) + completion report (template below). |

---

## 7. Explicit non-goals for this phase

**Skill: software architecture reasoning.** Stated to prevent scope drift
during implementation, per the standing guardrail ("every new capability must
belong exclusively to Phase 6"):

- **Not reviving `derivePurposeSlots`/`accessory_weak_point`.** That dead
  system is a separate, larger decision (§0 item 6) — Phase 6 wires weak-point
  detection into the live `biasMuscles` ranker hook instead.
- **Not adding joint_stress metadata to conditioning/endurance LIBRARY
  entries.** Explicit backlog item per your last message — carried forward,
  not touched here.
- **Not building a multi-week rolling window.** Single-week, per §5.4,
  pending your confirmation.
- **Not changing MRV, RIR, the stimulus table, anchor progression, or
  injury filtering.** All untouched, all already correct per Phases 4–5.5.
- **Not adding a UI surface for balance data** unless Task 6.5 concludes one
  is needed — that's a decision to make together, not a default.

---

## 8. Completion report template (for when 6.x is implemented)

Matching every prior phase's format:
- What changed / what deliberately did not change
- Specialist skill used per task
- Exact tests added, and which §3 row each test proves hard-vs-soft for
- Full regression result (byte-for-byte prior-file counts)
- Behaviour changes documented as intentional coaching improvements (which
  sessions now look different, and why that's correct, not a regression)
- Risks
- Judgement calls — resolved per §5, with your actual answers recorded, not
  just the questions
- Scope drift (expected: none)
- Live verification: sessions built across a spread of kits/goals/injury
  profiles, confirming balance nudges are visible in generated content and
  every hard rule (safety, conditioning spacing, progression) is provably
  unweakened

---

## Summary of what needs your decision before any implementation plan is written

1. §5.1 — unilateral:bilateral as a threshold check, not a ratio: agree, or
   specify a ratio?
2. §5.2 — the anterior/posterior pattern-group mapping as drafted: approve,
   or amend?
3. §5.3 — lower-back/spinal-load as a soft nudge only (no hard cap):
   confirm?
4. §5.4 — single-week rolling window for v1: confirm, or require multi-week
   now?
5. §6.5 — should any balance data be user-visible in this phase, or is v1
   purely an internal ranking signal?

No code has been written. Awaiting your review of this design before a
Phase 6 implementation plan (in the Phase 1–5.5 format, with code) is drafted.
