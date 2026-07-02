---
target: Training Log PWA index.html — feature-gap focus
total_score: 35
p0_count: 0
p1_count: 2
timestamp: 2026-07-01T10-46-18Z
slug: desktop-training-log-app-index-html
---
# Critique — Training Log PWA (index.html) — v34, feature-gap focus

Register: product. Personal offline gym tracker, single user, mid-workout on a phone.
Two independent assessments (isolated): (A) UX/heuristics critique, (B) feature-completeness
review against the shared research doc's principles for elite workout apps. Automated
`npx impeccable detect` skipped (network blocked in this sandbox, established gotcha).

## Standout Missing Piece

**No history/trend view of any kind.** The app correctly computes an estimated 1RM
(Epley) every session and a "ready to add weight" double-progression flag — then
discards both the moment you move on. There is zero chart, zero per-exercise session
list, zero PR tracker anywhere in the code (grep-confirmed empty for history/trend/
chart/PR). For an app explicitly built around progressive overload, this is the
largest gap between what it computes and what it lets you see accumulate over time.

Runners-up:
1. RPE is captured per set but never read back anywhere — deload is a fixed
   week-4-of-4 rule, not driven by logged fatigue/RPE.
2. No saved/named routine library — every program is generated fresh or pasted from
   Claude; a shape you liked can't be saved and reused as a template.
3. No set-type granularity (AMRAP, drop sets, PR-attempt flag) — structurally blocked
   by the data model (a "set" is a positional array index, not an object with a type).

## Design Health Score

| # | Heuristic | Score | Key note |
|---|---|:---:|---|
| 1 | Visibility of system status | 4 | Progress bar, DONE badge, live rest timer, persistence dot. |
| 2 | Match real world | 4 | "each/per hand" vs "total," real plate sizes, RPE scale, gym vocabulary. |
| 3 | User control & freedom | 3 | Undo on Reset-day; but sets- truncates a logged set with no undo. |
| 4 | Consistency and standards | 4 | One chip/pill/step/seg vocabulary reused everywhere, incl. the new shared equipment picker. |
| 5 | Error prevention | 3 | Robust JSON/program validation; numeric inputs clamp silently with no feedback. |
| 6 | Recognition rather than recall | 4 | Reps/weight pre-fill from last session; plate math removes mental arithmetic. |
| 7 | Flexibility and efficiency | 3 | Swipe + arrow-key day nav, quick "Just today" mode; no bulk-log action. |
| 8 | Aesthetic and minimalist design | 4 | "Adjust" disclosure, collapsed notes/warm-up, restrained accent use. |
| 9 | Error recovery | 3 | Specific load/import error copy; storage-full toast has no recovery action. |
| 10 | Help and documentation | 3 | Replayable intro; the "Ready to add weight" mechanic is never explained in-app. |
| **Total** | | **35/40** | Excellent band. |

## Anti-Patterns Verdict

Does not read as AI-generated. No side-stripe borders, no gradient text, no
glassmorphism-as-default (the two blur uses are both functional), no hero-metric
template, no identical card grids. The strongest tell against "slop": domain-specific
modeling a template wouldn't invent (antagonist-pattern supersets, per-equipment load
notes, warm-up ramping only for barbell/smith/machine/cable/kettlebell compounds).

## What's Working

1. Double progression is genuinely load-bearing, not decorative — one shared
   predicate (`allSetsAtTop`) drives both the visible "Ready" badge and the actual
   next-session weight bump, so they can't silently disagree.
2. The rest-timer filler suggestion is well-scoped delight: only strength sets with
   real rest, excludes the pattern you just trained, never repeats back-to-back, one
   optional tap.
3. Progressive disclosure is systematic, not spot-fixed: notes, warm-up, swap, and
   the build sheet's "Adjust" section all follow one collapsed-by-default pattern.

## Priority Issues

**[P1] The primary completion tap and both set-editing controls sit below the app's own tap-target standard.**
`--tap: 48px` is declared as the minimum, but `.setrow__done` (the done circle) is
34px, `.rstep` (rep steppers) is 32px, `.setrow__rpe` is 32px min-height — all three
packed into one row. For the actual persona (sweaty, one-handed, mid-set), this is
the single most concrete, fixable finding in the whole review.
*Fix*: bump these three to 44-48px, or widen their hit-slop via padding without
changing the visual chip size.

**[P1] Est-1RM and progression data disappear after the session — no history/trend view.**
Covered above as the standout gap. *Fix*: even a minimal per-exercise "last 5
sessions" list (weight × reps × est-1RM) would close most of the value gap without
needing a chart.

**[P2] Decreasing set count destroys that set's logged reps/RPE with no undo.**
Unlike Reset-day (which snapshots before mutating), `sets-` truncates immediately.
*Fix*: reuse the existing `toastUndo` pattern already built for Reset-day.

**[P2] RPE is write-only.** Captured every set, never read back by deload, readiness,
or anything else. *Fix*: at minimum, let 2-3 consecutive high-RPE sessions nudge the
deload timing instead of a fixed week-4 rule.

**[P3] The confirm-sheet for irreversible actions (Erase, Import-overwrite) shares
identical visual weight with routine Build/Settings sheets** — same surface, same
grip handle, only the red button differs. *Fix*: a distinct visual register (danger
top border, warning icon) for destructive variants.

## Persona Red Flags

**Mid-set, one-handed, sweaty:** the done-circle/rep-stepper/RPE-pill row directly
violates the app's own 48px tap-target rule (see P1) — exactly the persona this
would bite hardest.

**First-time setup:** goal labels ("Hybrid"/"Strength"/"Endurance") aren't explained
before building, so understanding what each produces requires a guess-and-rebuild
loop. Equipment defaults to near-full-gym; a dumbbells-and-pullup-bar-only user gets
an irrelevant first program unless they discover the collapsed "Adjust" section.

## Minor Observations

- Plate math only fires for `equipment === "barbell"`, not Smith machine, though
  Smith gets warm-up-ramp treatment elsewhere — a small inconsistency between two
  related features.
- Storage-full toast auto-dismisses in ~2.3s with no action button, in an app whose
  only recovery path (Export/Erase) is exactly the kind of thing a rushed toast
  should point to directly.
- Supersets are generator-only and gated to sessions ≤45 min — a 60-minute session
  never gets paired, even though the data model (`group` field) supports it broadly.

## Feature-Completeness vs. the Research Doc (full table)

| Principle | Status | Evidence |
|---|---|---|
| Layered data spine (Exercise→Program→Workout→WorkoutExercise→Set) | Partial | Set is a positional array index, not an object; no per-set type field |
| Double progression | Yes | `allSetsAtTop`/`suggestedWeight`, surfaced as "Ready · add weight" |
| Set types (AMRAP/drop/myo/cluster/PR flag) | No | Only 3 top-level exercise types exist; zero matches for amrap/dropset/myo-rep |
| Est-1RM | Yes | Epley formula, correct, shown live per card |
| History/trend view | **No — standout gap** | Zero history/chart/PR UI anywhere in the app |
| Data-driven recovery/deload | Partial | RPE captured but never read back; deload is a fixed week-4-of-4 rule |
| Pre-fill last session's numbers | Yes | `readLog` prefills reps/weight, with a real-vs-guessed flag |
| 5-part session flow | Partial | Warm-up vs. working sets genuinely distinct; session-level phases are just a flat ordered list |
| Plate math | Yes | Full per-side plate breakdown, bar-weight aware |
| Supersets | Partial | Auto-only, gated to ≤45 min sessions |
| Rest-timer intelligence | Partial | Auto-starts, live countdown; not adjustable per-instance |
| Saved/named routine library | No | Every program is generated fresh or pasted; no template save/reuse |
| Bodyweight / measurements / photos | No | Zero fields anywhere in the data model |
| Social/sharing | No (deliberate) | Consistent with the app's private single-user design intent, not a gap |
