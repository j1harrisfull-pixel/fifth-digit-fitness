# Gold-Standard Program Delivery — Working Plan

Handover document. Written 2026-07-06 for a fresh Claude session (Sonnet 5) to execute.
Owner: James. The app is his personal training log, live and in daily use — treat it as production.

---

## 1. The problem (why this plan exists)

The app's **selection engine is good** (movement patterns, weekly debt, fatigue budget, frozen
4-week blocks, per-set ramp curves — all real and Node-tested). But what it *delivers* is a flat
exercise list. A real coach — and a plain Claude-chat answer James compared against — delivers a
**session**: arrive → prepare → work → condition → down-shift, with time blocks that sum to the
duration the user picked.

Concrete failures observed (2026-07-06, hybrid / 45 min / full gym, seed-dependent):

- Session = `Floor Press, Chin-Up + Lateral Raise (superset), Dumbbell Shrug, 16-min jog, Cat-Cow`.
  - Floor Press (a specialty lockout variation) won the PRIMARY slot over flat Bench Press,
    because `RAMP_ANCHORS` treats flagship lifts and their variations as equal.
  - An "Upper · chest/back/shoulders" day had **no vertical press**.
  - No general warm-up (only per-lift ramp sets on the loaded anchor, behind a Settings toggle).
  - No cool-down at all. Mobility appears as just another list row.
  - Nothing shows the time math; at 30 min the session thins to almost nothing and the
    "hybrid" promise (conditioning) can get squeezed.

The reference standard (what a chat-Claude produced for "30-min hybrid"):

```
Warm-up (4 min)     — 1 min easy cardio + 10x bodyweight squats, arm circles, hip openers
Block 1 (12 min)    — Strength EMOM: min 1 = 8-10 goblet/back squats, min 2 = 8-10 push-ups/bench, x6 rounds
Block 2 (10 min)    — Conditioning AMRAP: 10 KB swings, 10 mountain climbers/side, 200m row/run
Cool-down (4 min)   — hip flexor + hamstring stretch, thoracic rotations, 1 min box breathing
```

Blocks sum to 30. That skeleton — **prepare / work / condition / down-shift, time-budgeted** — is
the gap. This plan closes it.

---

## 2. Non-negotiables (read before writing any code)

These come from PRODUCT.md / DESIGN.md (repo root — read both first) and standing decisions:

1. **Honesty over encouragement.** Never fake praise, never invent numbers. Every prescribed
   number carries a plain-language reason. If something can't be delivered (e.g. conditioning
   won't fit), say so, don't silently drop it.
2. **One accent per screen.** Orange (#FF4A1C) marks exactly one action. Phase headers etc. are
   quiet (mono overlines, ink-dim), never accent.
3. **Zero corner radius, no shadows/gradients, tabular-nums for every number.** Match existing CSS.
4. **Terminology is locked:** Program › Week › Session. The 6-10 effort scale is called
   **Effort** everywhere user-facing (never RPE except the one explainer bridge "some call it
   RPE"). "Reps in reserve" not "RIR" in user copy. Middot "·" as separator, never em dash.
5. **Coach-standard exercise names.** Never rename a movement into a description. Clarity goes in
   the cue/form note. (James corrected this once; don't repeat it.)
6. **Data safety.** Users have stored programs + logged history in localStorage
   (`training-log:v2`). Old programs (flat exercise lists, no phases) MUST keep working —
   migrate-on-read or feature-detect; never orphan logged sets. There is a quarantine-corrupt-state
   mechanism; don't fight it.
7. **The engine is versioned by markers.** All coach logic lives between `/*__COACH_START__*/`
   and `/*__COACH_END__*/` in index.html. The Node test harness extracts exactly that span —
   new engine code must stay inside the markers; new UI code stays outside.
8. **Offline-first.** No network calls, no CDNs. Everything ships in index.html.
9. **prefers-reduced-motion** must cover any new animation (see the existing reduce block).
10. **Dialogs open via `openSheetNoKb()`** (kills auto-keyboard). Any new dialog uses it.

---

## 3. Codebase primer

- **One file:** `index.html` (~6,300 lines). CSS in `<style>`, one IIFE `<script>`. `sw.js` is the
  service worker — **bump `CACHE_VERSION` on every shipped change** or users never get it.
- Find things by grep, not line number (they drift):
  - `generateProgram` / `generateSession` — program/week generation. Sessions are built per-day;
    strength selection is FROZEN across the 4-week block (blueprint computed once); conditioning +
    mobility rotate weekly; deload = week 4 with reduced volume.
  - `selectComplementary` — the accessory/slot-filling engine (patterns, debt, fatigue budget).
  - `RAMP_ANCHORS` — the "money lift" id set that biases anchor choice (Phase D edits this).
  - `prescription(ex, goal, isAnchor, minutes, weekNum, isDeload)` — sets/reps/target/rest.
  - `buildEx` — turns a library entry into a session exercise object
    `{name, type, equipment, group, sets, reps, weight, target, rest, notes, curve, setPlan, why}`.
  - `LIBRARY` — ~238 entries with Section-C tags (`movement_pattern`, `primary_muscles`, `plane`,
    `fatigue_cost`, `joint_stress`, `is_unilateral`, `stability_demand`, `variations`,
    `progression_policy`) + `cue` ("Setup: … Key: … Fault: …"). `libraryIntegrity()` validates.
  - `sessionItemsFor(ses)` / `sessionProgress` / `firstIncompleteId` — completion model
    (skipped exercises excluded from totals).
  - `renderList` / `buildCard` / `setRowsInner` — the day-view UI. Set logging via delegated
    handlers `onListClick` (buttons: setdone/set/rep±/wt±/setrpe/skipex…) and `onListInput`.
  - `warmupSets(e, weight, unit, full)` — existing PER-LIFT ramp sets (keep; Phase B adds the
    GENERAL warm-up, a different thing).
  - `showSessionComplete` / `endSession` — manual finish (deliberate End/Finish tap; the receipt
    is honest: "complete" vs "ended · Banked").
  - `effortifyTarget()` — display-time normaliser rewriting legacy "N RIR · RPE M" targets to
    "Effort M · N reps left". New target strings should be born in the new vocabulary.
  - `normalizeProgram` / `migrateV1toV2` — import + schema migration paths. Anything added to the
    session shape must be handled in `normalizeProgram` (Claude-import path) too.

### Workflow (how to build & verify)

- Preview: `rsync -a --delete ~/Desktop/training-log-app/ /tmp/training-log-preview/` then serve
  `/tmp/training-log-preview` (macOS TCC blocks serving from Desktop). `.claude/launch.json` has a
  "training-log" server on port 4178. The SW caches aggressively — reload via
  `fetch('/index.html',{cache:'no-store'})` then `location.reload()`.
- Tests: `node tools/tests/test-coach-fixes.js && node tools/tests/test-progression.js &&
  node tools/tests/test-stress.js && node tools/tests/test-coach-hardening.js`
  (Node ≥18; they read index.html directly; the stress suite sweeps 60k+ generated sessions).
  ALL must stay green. Extend them per phase (Phase E formalises this).
- Ship: commit to `main`, push (repo `j1harrisfull-pixel/fifth-digit-fitness`), GitHub Pages
  deploys from main. **Gotcha:** Pages sometimes fails with "Deployment failed, try again later" —
  an identical retry keeps failing; push a genuinely new artifact (the SW bump usually suffices,
  or an empty commit after a wait). Verify live with
  `curl -s https://j1harrisfull-pixel.github.io/fifth-digit-fitness/sw.js | grep CACHE_VERSION`.
- Verify in the real browser before claiming done — logging sets, finishing a session, both paths.

---

## 4. The phases (build in this order: D → A → B → E → C)

Ship each phase separately (own commit, own SW bump, own verification). Don't batch.

### Phase D — Anchor tiering + coverage guarantees  (small, immediate quality win)

**Objective:** flagship lifts lead sessions; no billed muscle group goes untrained.

1. **Tier RAMP_ANCHORS.** Split into `ANCHOR_T1` (flagships: `bench-press`, `back-squat`,
   `overhead-press`, `deadlift`, `barbell-row`, `pull-up`, `chin-up`, `trap-bar-deadlift`) and
   `ANCHOR_T2` (variations: pause/floor/incline/banded/front-squat/pendlay/deficit etc.).
   In anchor scoring, T1 outranks T2 for the PRIMARY slot whenever a T1 lift matching the day's
   pattern + equipment is available. T2 remains fully eligible for accessory slots and as anchor
   when T1 is unavailable (equipment) — and deliberate variation is fine **later in a training
   history** (if you implement rotation, it must be explainable in the why-line: "variation block
   after 8 weeks of bench" — otherwise default to the flagship).
2. **Vertical-press guarantee:** any upper/push day whose focus includes shoulders must contain a
   vertical press (OHP/DB shoulder press/press variant) among its strength slots. Implement as a
   coverage check in the day's slot plan (like the existing role floors), not a post-hoc patch.
3. Extend tests: ≥90% of full-gym anchors are T1 (test-progression already checks money-lift %;
   tighten it); zero upper days without a vertical press across the sweep.

**Acceptance:** stress sweep green with the new assertions; a fresh hybrid/4-day/full-gym build
leads Upper with Bench Press (not Floor Press) across seeds.

### Phase A — Session architecture (the core fix)

**Objective:** a generated session is four phases with a visible time budget that sums to the
user's duration. This is a data-shape change + a renderer change; selection logic mostly stays.

1. **Data shape.** Each generated session gains
   `blocks: [{kind: "warmup"|"strength"|"conditioning"|"cooldown", minutes: N}]` and each
   exercise gains `block: kind`. Keep `exercises` a flat array (everything downstream — logging,
   progress, receipts — iterates it); `block` is an annotation, exactly like `group` is for
   supersets. **Old programs without `block` must render exactly as today** (feature-detect:
   `ses.blocks ? phased : legacy`).
2. **Time budgeting.** Budget = user minutes. Defaults (tune, don't hardcode blindly):
   - 30 min: 4 warm-up / 16 strength / 7 conditioning / 3 cool-down
   - 45 min: 5 / 25 / 10 / 5
   - 60 min: 6 / 34 / 14 / 6
   - Strength-goal sessions may zero the conditioning block (goal-dependent); hybrid NEVER does —
     if conditioning doesn't fit, shrink strength, and the why-line says so.
   - The existing time model (`prescription` durations, slot counts vs minutes) feeds the strength
     block only. Conditioning duration comes from its block budget (today's "16 min jog" becomes
     the conditioning block's budget).
3. **Renderer.** Day view groups by block with quiet mono overline headers:
   `WARM-UP · 4 MIN`, `STRENGTH · 25 MIN`, `CONDITIONING · 10 MIN`, `COOL-DOWN · 5 MIN`.
   No new accent. Progress (`N/M exercises`) unchanged (counts all blocks). The receipt's honest
   read stays exercise-based.
4. **Completion semantics.** Warm-up/cool-down items are tappable like mobility today (simple
   tick rows) but are **excluded from the fatigue/progression signals** (they're not training
   volume). Check `computeFatigueState` and history/1RM readers ignore them (they key off
   strength entries, so mostly free — verify).
5. `normalizeProgram` (Claude-import): accept sessions with or without blocks; synthesise
   `blocks` for imports that lack them (all exercises → strength block) so imported programs
   render in the new UI without lying about time.

**Acceptance:** new build renders 4 phase headers whose minutes sum to the chosen duration;
old stored program still renders and logs identically (test with a copied v2 state blob);
full Node suite + new structure assertions green; live smoke on the preview (build → open day →
log sets across blocks → Finish → receipt correct).

### Phase B — Real warm-up + cool-down content

**Objective:** the warm-up/cool-down blocks contain genuinely coached content matched to the day.

1. **General warm-up generator:** 1 pulse-raiser (easy cardio 1-2 min; bodyweight fallback:
   jumping jacks / high knees) + 2-3 movement-prep drills chosen by the day's movement patterns:
   - squat/hinge day → hip openers, bodyweight squats, leg swings, Cat-Cow
   - push/pull day → arm circles, band pull-aparts, shoulder dislocates, scap pull-ups
   - Use existing LIBRARY mobility entries where they exist; add a handful of new
     `type:"warmup"`-suitable entries only if needed (author real cues in Setup/Key/Fault voice;
     coach-standard names). Tag additions must pass `libraryIntegrity()`.
2. **Cool-down generator:** 2-3 stretches matching trained muscles (hip flexor/hamstring after
   lower; chest/lat/thoracic after upper) + 1 min box breathing as the standard closer.
3. **Per-lift ramp sets stay** as-is (they're load-specific preparation, not the general warm-up).
   The Settings "Warm-up sets" toggle keeps meaning ramp sets only.
4. Keep it deterministic per seed (same variety machinery as conditioning rotation: rotate
   weekly, don't freeze).
5. **Why-lines:** warm-up block items get a one-line reason ("preps hips + ankles for squatting").

**Acceptance:** warm-ups visibly match the day's patterns across goals in a seed sweep; no
duplicate of a main lift in its own warm-up; cool-down reflects what was trained; suite green.

### Phase E — Validation harness (before the big C build)

**Objective:** make program quality regression-proof, like the cue audit did for language.

1. **Structural assertions** (extend `tools/tests/`): every generated session has the four blocks;
   minutes sum to duration ±1; hybrid keeps conditioning at every duration; upper days have a
   vertical press; anchors are T1-dominant; warm-up patterns match day patterns. Run across the
   existing 60k-session sweep matrix.
2. **Research-agent grading pass** (the driving human/Claude does this, not CI): generate ~20
   representative sessions (goals × 30/45/60 × full-gym/dumbbell/bodyweight), export as text, and
   have research agents grade each against S&C gold standards (NSCA guidelines, established
   hybrid-programming practice), flagging anything a competent coach would change. Fix what's
   confirmed; re-run. This is how the cue audit worked (5 parallel agents, flag-only, verify
   against sources) — reuse that pattern.

**Acceptance:** new assertions green in the sweep; grading pass produces zero high-confidence
structural flags (or each remaining flag is a documented, deliberate choice).

### Phase C — Density formats for short sessions  (biggest lift, do last)

**Objective:** 30-minute sessions use time-efficient formats (EMOM strength pairing, AMRAP
conditioning) so short hybrid is potent, not thin.

1. **Formats as block modes:** `block.mode: "straight" | "emom" | "amrap"`.
   - 30 min hybrid: strength block becomes a 2-exercise EMOM pairing (alternate minutes,
     ~6 rounds; pick the anchor + one complementary non-competing pattern); conditioning block
     becomes an AMRAP of 2-3 moves (existing conditioning/power library entries; respect
     equipment).
   - 45/60 min: keep straight sets (current behaviour). Optionally offer density later; do NOT
     default to it.
2. **Logging UI:** an EMOM/AMRAP block renders as a block card: the movement list, the time cap,
   and a "rounds completed" counter (one number, steppers, mono) instead of per-set rows.
   Rounds persist into the log (`{block:"conditioning", mode:"amrap", rounds:N, minutes:M}`) so
   history/receipt can state "AMRAP 10 min · 7 rounds" honestly. Est-1RM/progression logic must
   simply ignore these entries (verify readers).
3. **Rest timer:** EMOM work is clocked by the minute, not the rest timer — the block card gets
   its own minute-cadence timer (reuse the rest-timer plumbing; it already persists across
   lock/reload). AMRAP gets a countdown of the block budget.
4. **Progression for density blocks:** more rounds at same load = progress; the why-line states
   it ("beat 7 rounds").
5. This phase touches the most UI. Ship behind the 30-min duration only, verify hard on a real
   phone (timers + lock screen + resume), then consider exposing wider.

**Acceptance:** 30-min hybrid build produces warm-up → EMOM strength → AMRAP conditioning →
cool-down summing to 30; rounds log and persist across a mid-block reload; 45/60-min behaviour
unchanged; full suite green; real-device smoke.

---

## 5. Definition of done (whole plan)

- A fresh 30-min hybrid build reads like the reference session in §1 — a coach's whiteboard, not
  a list — and a 60-min strength build still reads like a strength day (straight sets, ramped
  anchor, flagships first).
- Old programs and all logged history untouched and fully functional.
- `tools/tests/` all green including the new structural assertions; grading pass clean.
- Every shipped phase: SW bumped, deployed, verified live (curl the SW version), and smoke-tested
  in the preview browser (and on-device for Phase C).
- No design-system violations (accent discipline, radius, typography, terminology, honesty).

## 6. Open decisions for James (ask, don't assume)

- Phase A time-budget splits per duration/goal (defaults above are a starting proposal).
- Phase B: whether warm-up/cool-down blocks are collapsible or always expanded.
- Phase C: whether 45-min hybrid ever gets density formats (plan says no by default).
- Any new exercise/warm-up library entries: names + cues reviewed by James before shipping
  (standing rule: collaborate on copy, don't guess).
- Present decisions as clickable options (AskUserQuestion), not prose — James' explicit preference.
