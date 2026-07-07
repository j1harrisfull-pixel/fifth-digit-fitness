# Programming Philosophy — the coaching logic spec

**Status:** approved design (2026-07-07). This is the *why/what* of the coach
engine. Implementation happens phase-by-phase, test-first, off a separate plan.

## 0. The goal (north star — hold this while building)

Every generated session must read as though **a great coach wrote it**. That
means four things, all non-negotiable (the rubric James set):

1. **Reasoned** — every exercise has a clear purpose; nothing is filler or a
   coin-toss pick.
2. **Right hard** — effort, volume, intensity precisely matched to the goal and
   the athlete's readiness. No junk volume; no sandbagging.
3. **Balanced & injury-smart** — antagonists/weak points covered over time,
   nothing that aggravates injury history, sane sequencing; worked not wrecked.
4. **Goes somewhere** — loads climb, a coherent arc week to week; progress is
   intentional, not luck.

> **Contradiction rule.** If any implementation choice would violate one of
> these four, stop and raise it before shipping. "Valid and varied" is NOT the
> bar; "purposeful" is.

## 1. Locked decisions (from the brainstorm)

| # | Decision | Choice |
|---|----------|--------|
| 1 | Progression arc | **Hybrid** — the anchor lift per pattern progresses from logged history; supporting work stays fresh. |
| 2 | Design engine | **Richer offline rules.** No LLM in the hot path. 100% offline, instant, private. Encode the philosophy in the engine. |
| 3 | Coach assertiveness | **Coach the request against the week.** Take the request as the theme; shape specifics with weekly-debt / recent training / readiness. Honor intent, don't override. |
| 4 | Variation doctrine | **Curated variety, no accessory arc.** Anchor stable + climbing; accessories rotate from a small best-in-class pool per muscle/goal, never repeating last session, each with a reason. |
| 5 | Athlete model | **Light profile + learn over time.** One-time experience level + injuries/no-go list; learn preferences from behavior. |
| 6 | Elite rubric | **All four** dimensions above are non-negotiable. |

## 2. Build on what already exists (do not rewrite from scratch)

The engine already has the scaffolding this philosophy needs. Reuse it; extend,
don't replace:

- **Library with Section-C tags** — `movement_pattern`, `primary_muscles`,
  `secondary_muscles`, `plane`, `fatigue_cost`, `stability_demand`,
  `is_unilateral`, `progression_policy`, `variations`, plus the old `pattern`.
- **`selectComplementary` / `pickStrength`** — slot-filling with pattern caps,
  fatigue budget, 4-level pool-widening fallback (never-empty guarantee).
- **Weekly debt** (`computeWeeklyDebt`) — completed sets per pattern/muscle vs a
  target table; already feeds selection bias.
- **Fatigue + readiness** (`computeFatigueState`, `degradation`) — est-1RM
  decline + rising RPE → recovery/eased/normal, with the "build it anyway"
  escape.
- **Per-set prescription curves** (`buildSetPlan`, `prescription`) — ramp-to-top
  for anchors, straight elsewhere; per-set targets persisted.
- **Time-budgeted blocks** (`attachBlocks`, `computeBlockBudgets`) +
  **mandatory warm-up/cool-down** (`buildWarmupCooldown`).
- **Per-exercise `why` strings** (`selectComplementary` `.why[]`) — the seam the
  "reasoned" rubric plugs into.
- **The Node test suite** (`tools/tests/`) — where the rubric harness lives.

New work is mostly: an **intent object**, a **frozen-anchor progression**, a
**curated pool + intent-weighted ranker**, **stimulus-keyed prescription**, an
**athlete profile**, and the **rubric checks**.

## 3. Components

### 3.1 Session Blueprint — intent before exercises
A request resolves to an explicit **intent object** *before any lift is chosen*:

```
intent = {
  primary:   { target: <muscle|pattern>, stimulus: strength|tension|pump|power|conditioning },
  secondary: [ { target, stimulus }, ... ],
  constraints: { minutes, equipment, readiness, injuries, experience }
}
```

The blueprint maps intent → an ordered list of **purpose slots**, each with a
`role` and a to-be-filled `reason`:

`prep · power/skill? · anchor · secondary-compound · accessory(weak-point|balance) · isolation · finisher/conditioning? · cooldown`

This replaces "pattern slot → any legal move" with "purpose slot → the right
move." *Serves: reasoned, right-hard.*

**Stimulus inference** (coach-the-request, decision 3): the parsed request sets
the theme (e.g. "pump" → `tension`/`pump`); weekly-debt biases *which* targets
fill the secondary slots; readiness/fatigue tunes volume. Intent is never
overridden silently — the existing readiness→recovery + "build it anyway" flow
stays the only path that changes what was asked.

### 3.2 Anchor & Arc — progression (decision 1)
- One **anchor** per session = the primary strength driver for the primary
  target (a loadable compound of the right pattern; the existing tiered
  `RAMP_ANCHORS`/`ANCHOR_T1` money-lift logic picks it).
- The anchor is **chosen once per pattern and frozen**. A later session hitting
  that pattern reuses the same anchor and progresses it from logged history:
  **double progression** — all working sets at the top of the rep range → add
  the smallest load increment; else hold load and chase reps. Stored per athlete
  keyed by pattern (survives reload; opaque-id safe).
- **Auto-deload:** when `computeFatigueState` for the anchor's pattern crosses
  the red threshold (or an every-Nth-exposure counter trips), that session drops
  ~40% volume and pulls intensity back one RIR. Reuses the existing degradation
  machinery.

*Serves: goes-somewhere.* Only the anchor carries the arc (decision 4).

### 3.3 Selection with intent — the reason per pick (decisions 3, 4)
Each non-anchor slot fills by:

`role → candidate pool → rank → pick (never last session's pick for this slot)`

- **Candidate pool** = a hand-tagged **"best for {muscle|goal}" shortlist**, not
  the whole library. New tag, e.g. `tier: "core" | "quality" | "fringe"`; slots
  draw from `core`+`quality` only. This is what makes variety *curated*.
- **Hard filters:** equipment, **injury/no-go** (§3.5), skill-gate (existing).
- **Rank** = fit-to-intent (matches the slot's target + stimulus) + weekly-debt
  (fills the lagging side) + **recency penalty** (down-rank anything done in the
  last N sessions) + **learned preference** (§3.6). Rotation is deliberate, not
  random.
- **Reason string** is written from *why it won* ("rear delts behind this week,"
  "balances today's pressing," "deep-stretch hypertrophy for hamstrings"),
  extending the existing `.why[]`. Every exercise must carry a **non-generic**
  reason — the "reasoned" rubric check fails on filler strings.

### 3.4 Prescription matched to stimulus — the right hard (proposed, evidence-based)
Sets/reps/load/rest/RIR keyed to **stimulus × experience**. Proposed defaults
(approve/adjust):

| Stimulus | Reps | Rest | RIR (intermediate) | Notes |
|---|---|---|---|---|
| Strength | 3–5 (anchor: ramp to a top set) | 3–5 min | 1–2 | Anchors/heavy compounds only |
| Tension (hypertrophy compound) | 6–12 | 2–3 min | 1–3 | Primary muscle-building |
| Tension (isolation) | 10–15 | 60–120 s | 1–2 | |
| Pump/metabolite | 15–20 | 30–60 s | 0–2 | Higher density, finishers |
| Power | 2–5 @ low % | full | leave speed | Explosive intent |

- **Experience scaling:** beginners → lower volume, +1 RIR, simpler movements,
  more reps; advanced → more volume, closer to failure, more specialization.
- **Weekly volume landmarks** (guardrails, per muscle per week; Renaissance
  Periodization–style): MEV ≈ 8–10 sets, MAV ≈ 12–18, **MRV ≈ 20–22 (cap).**
  Session volume is scaled to the time budget *and* clipped so the rolling
  weekly total per muscle never exceeds MRV.

*Serves: right-hard.*

### 3.5 Balance & safety — injury-smart (decision 5)
- **Injuries / no-go movements hard-filter** the pool — never prescribed, at any
  fallback level (the never-empty guarantee must respect this floor).
- **Antagonist balance** over a rolling window (push:pull, quad:hinge,
  horizontal:vertical) — the coach fills the lagging side first.
- **Weak points** the athlete flags earn an extra accessory slot when time
  allows.
- **Interference:** hard conditioning stays spaced from heavy lower-body work
  (extend the existing `pickHardConditioningDay`).

*Serves: balanced & injury-smart.*

### 3.6 Athlete model (cross-cutting, decision 5)
A light persistent profile on `state`:

```
athlete = {
  experience: "beginner" | "intermediate" | "advanced",
  injuries:   [ <region|movement_pattern|exercise-id> ],   // hard exclusions
  prefs:      { <exercise-id>: score }                      // learned, not asked
}
```

- **Captured once:** experience + injuries/no-go (a short, skippable step — not a
  wall of forms; honors the no-forms ethos).
- **Learned, never asked:** `prefs` nudges up/down from behavior — swapped-out
  or skipped → down; kept + rated hard/enjoyed → up. Feeds the §3.3 ranker as a
  soft term (never overrides intent/safety).

### 3.7 Sequencing doctrine
`prep → power/skill → primary compound (anchor) → secondary compound →
accessories (most demanding first) → isolation → finisher/conditioning →
cooldown`. Antagonist supersets paired deliberately on time-capped days.
(Warm-up/cool-down already mandatory + bracketed; density formats already
handle ≤30-min.)

### 3.8 The rubric as a live test harness
The four non-negotiables become **automated checks** run over large batches of
generated sessions (new `tools/tests/test-elite-rubric.js`):

- **Reasoned** — every exercise carries a non-generic reason; 0 filler strings.
- **Right hard** — prescription matches the slot's stimulus; rolling weekly
  volume per muscle within MEV…MRV.
- **Balanced/injury-smart** — no injury-flagged movement ever appears; antagonist
  ratios within bounds over the window; no movement repeats within N sessions.
- **Goes somewhere** — the anchor is frozen per pattern across sessions; anchor
  load/reps progress when earned; deload fires when fatigue says so.

Plus a **standing dogfood battery**: after *any* engine change, generate a spread
of realistic requests ("30 min pump", "heavy legs 45", "quick full body no kit",
"upper hypertrophy 60") and read them as a coach. This is the explicit fix for
"James keeps catching everything" — the tests check the engine; the battery
checks the experience.

## 4. Proposed build order (each its own test-first, shippable phase)

1. **Athlete model** — profile schema + capture step + learned-prefs plumbing.
2. **Intent blueprint** — the intent object + purpose-slot mapping (behind the
   existing generators; no behavior change until wired).
3. **Anchor & arc** — frozen-per-pattern anchor + double progression + auto-deload.
4. **Curated pools + intent ranker** — `tier` tags + recency penalty + reason
   strings; this is the "curated variety" the user feels most.
5. **Stimulus prescription + volume landmarks** — the right-hard layer.
6. **Balance & safety** — injury hard-filter, antagonist window, weak-point slot.
7. **Rubric harness + dogfood battery** — lock the whole thing against regression.

Ship, verify (Node + live browser), deploy per phase — same discipline as the
Gold-Standard plan. Bump `sw.js` each shell change.

## 5. Open decisions to confirm during the plan (not blockers)
- Exact recency window N (proposed: don't repeat a movement within 2 sessions).
- Exact MRV caps per muscle (proposed RP-style table above).
- Whether experience level is asked or inferred first-run then confirmable.
- How the injury list is entered (region picker vs. free-tag) — a UX call for the
  writing-plans stage.
