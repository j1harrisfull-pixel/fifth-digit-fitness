# Implementation Plan — Active Workout: Guided Coaching Progression

**Status:** Plan only. No code, no edits, nothing deployed. Implements the approved "one coached movement at a time; sets as a guided progression, not a table" redesign (J1–J7 approved). Behaviour, data shape, and the `__COACH__` span are fixed and protected.

---

## 1. Specialist skills used
Stated inline before each section. Load-bearing: **product** (§2 structure serves the training goal), **visual** (§2/§3/§4 the progression + step language), **usability** (§3/§6 the tap/edit model — the crux), **UX writing** (§3/§4 self-describing lines, killing "SEPREV"), **brand** (§2/§4 quiet-coach not table), **accessibility** (§7 targets, non-colour state), **behaviour-preserving engineering** (§5/§6 markup-only, coach-span safe), **test engineering** (§8 the screenshot gate + regression).

---

## 2. Exact proposed active workout structure
**Product + visual + brand lens.** Plain-text wireframe (current strength exercise, mid-session):

```
┌ Session header ───────────────────────────────
│  • Chest · back · shoulders        6:24   [End]
├ Block context ────────────────────────────────
│  Strength · 25 min
├ CURRENT EXERCISE (the coached moment) ─────────
│  Strength 1 of 4
│  Bench Press                          ← display
│  COACH NOTE
│  ▏ Primary lift for today's session   ← brass rule
│  4 sets · 5–6 reps · 2 min rest       ← coached line
│
│  Working weight   [ − ]  60 kg  [ + ]  ← one primary control
│
│  ── Guided set progression ────────────
│  ✓ Set 1    60 × 6      effort 7       ← confirmed step (quiet)
│  ● Set 2    the coached FOCUS          ← current, foregrounded
│      [ − 60 kg + ]   [ − 6 + ]   ( ✓ done )
│  ○ Set 3    · 6 reps                   ← pending, calm
│  ○ Set 4    · 6 reps                   ← pending, calm
│
│  Est. 1RM —   Hit 6 reps to add weight    History ›
│  ▸ Edit sets
├ UPCOMING SESSION STEPS (quiet, no checkboxes) ─
│  Chin-Up            3 × 8–12
│  ─ Superset A ─
│    A1 Dumbbell Shoulder Press   3 × 8–12
│    A2 Dumbbell Shrug            3 × 8–12
│  Zone 2 Row         10 min             ← conditioning
│  Sleeper Stretch    2 sets             ← cooldown
└───────────────────────────────────────────────
[ Log set 2 · 60 kg ]                    ← sticky CTA (kept)
```

No column header anywhere. Each set states its own numbers. The current set is the single focus; done sets confirm; pending sets wait. Upcoming exercises are named session steps, not ticked tasks.

---

## 3. Guided set row / state model
**Visual + usability + UX-writing lens.** The set list drops the shared column grid; each set renders by its state:

- **Pending set:** `○ Set 3 · 6 reps` — hollow step marker, dimmed, target reps only, no controls. Reads "coming up."
- **Next set (current):** the foreground. Full-ink `● Set 2`, an inset surface, and the inline controls: weight stepper (`− 60 kg +`), reps stepper (`− 6 +`), and the done control (44px). Self-labelled ("kg"/"reps" inline) so no header is needed. Unmistakably "do this now."
- **Completed set:** `✓ Set 1   60 × 6` — a confirmed step: real tick (not a square), the numbers you did, quiet/receded, still legible. Tapping it re-opens it for edit (see §6 — the one tap-model decision).
- **Completed + effort selected:** `✓ Set 1   60 × 6   · effort 7` — the chosen effort appended inline to the confirmed step (replaces today's separate revealed RPE strip; same `setrpe` mechanic, shown as a quiet suffix; tapping re-opens the effort pills).
- **Overridden weight:** the set's own weight shown full-ink + brass marker on that confirmed/current step only (Pass 1 signal); ordinary sets inherit the working weight and don't repeat it (J2).
- **Skipped set (if applicable):** quiet struck step, recessed (kept semantics).
- **Multiple completed:** the top of the list fills with confirmed ticks; the eye counts them at a glance; the "N of M" caption stays as quiet secondary support (J4), not the primary proof.

---

## 4. Collapsed exercise row model
**Visual + brand + UX-writing lens.** The square checkbox is removed everywhere (J3). Each non-current exercise becomes a **session step**:

- **Upcoming exercise:** `Chin-Up   3 × 8–12` — name + quiet plan hint + a small hollow step marker (dot), tappable to make current. No checkbox, no "0/2 sets" admin count as the lead (the plan hint replaces it).
- **Completed exercise:** name faded/receded + a filled confirmed mark (tick/dot in the completion tone); reads "done," not "ticked task."
- **Current exercise:** expanded to the hero card (not a collapsed row).
- **Superset A1/A2:** grouped under a quiet "Superset A" label with small A1/A2 brass tags; the pairing reads as coaching structure, steps indented together.
- **Conditioning:** self-describing step (`Zone 2 Row · 10 min`), same language, with its swap affordance kept.
- **Cooldown / mobility:** same quiet timed step (`Sleeper Stretch · 2 sets` or duration), recessive.

---

## 5. What markup changes are required
**Behaviour-preserving engineering lens.** Presentational render changes (all outside the coach span, all flagged + shown before editing):

- **`setRowsInner(e, lg, ...)` (~`:5997`)** — the per-set loop: emit a **state-classed step** (`.setstep--pending / --current / --done`) instead of the column-grid `.setrow`. Same `e.sets` loop, same `s.completed`/`s.reps`/`s.weight`/prev data, same `data-act`/`data-ex`/`data-set` hooks on the controls (so every event handler binds unchanged).
- **`rpeStripHtml(...)` (~`:5991`)** — render the effort pills as the current/tapped set's inline affordance / the confirmed step's quiet suffix; same `setrpe` action + values.
- **`buildCard()` (~`:6125`)** — drop the `.setcolhead` column-header emission entirely (this alone kills "SEPREV"); compose the working-weight control + progression as one block; keep coach note, `.card__rx`, foot, Edit sets.
- **Collapsed-row render (`.card__collapsed*`)** — replace the `□` checkbox element with the step marker; keep the same tap-to-open `data-act`/`data-ex` binding.
- **CSS:** new `.setstep*` step classes replacing `.setrow*` grid; `.setcolhead*` removed; `.card__collapsed-check` → step-marker; `.setrpe*`, `.startweight*`, `.warm-pill`, superset markup aligned.

**No** change to: event handlers, `data-*` action wiring, `e.sets`/set schema, `writeLog`/`readLog`, or any coach-span function. The redesign re-templates what the existing data renders into; the click targets keep their existing `data-act`/`data-ex`/`data-set` attributes so behaviour is identical.

---

## 6. Same-data / same-taps proof plan
**Usability + behaviour-preserving engineering lens.**

| Guarantee | How held |
|---|---|
| Set number visible | Every step shows `Set N` |
| Previous-set info visible | Kept — surfaced on the set as a reference (`prev`), not a column |
| Weight entry available | Current set's stepper + the shared working-weight control; per-set override editable |
| Reps entry available | Current set's reps stepper |
| Effort / RPE available | Inline effort pills on the current/completed step (same `setrpe`) |
| Rest still triggers | Done control keeps its `data-act="setdone"` → existing rest wiring untouched |
| Logging still one tap | Current set's done control = one tap, same as today |
| Edit sets still opens | `Edit sets` disclosure unchanged |
| Conditioning swap works | Swap control kept, same binding |

**The one tap-model decision (surfaced honestly, approval Q1):** in the current *table*, every set's steppers are always live, so editing a *completed* set's weight/reps is a direct interaction. In the *progression*, completed sets collapse to a confirmed line. Two ways to keep parity:
- **Option A (recommended, J7-boldest):** tapping a completed step re-opens it (steppers inline) — this is consistent with today's existing "tap the check to un-complete" and the Edit-sets panel. Logging the current set is unchanged at one tap; only *editing an already-completed set* costs one extra tap (tap to re-open). Cleanest progression.
- **Option B (strict zero-tap-delta):** keep every set's steppers live but visually recede completed/pending ones; remove the table feel via header removal + self-describing rows only. No tap change anywhere, slightly less clean.

I recommend **A** (rare edit path, matches existing un-complete interaction, delivers the coaching look). Flagged for your explicit call because it touches the "same taps" guardrail for the edit-a-completed-set case.

---

## 7. Accessibility / touch plan
**Accessibility lens.**
- **Touch targets:** current-set done ≥44px; steppers ≥36px (unchanged); step markers are display-only (not the tap target — the whole step row is tappable, ≥44px tall). Nothing shrinks.
- **Completion obvious:** confirmed steps use a tick **plus** recession **plus** the retained "N of M" — never colour alone (J4/accessibility). A done set is distinguishable in greyscale.
- **Next obvious:** the current step uses inset fill + full-ink + size + the sticky CTA echo — multiple cues, not colour only.
- **Readable under fatigue:** larger current-set focus, fewer competing elements, self-describing lines (no cross-referencing a header) reduce cognitive load mid-set.
- **Contrast:** all new step surfaces/markers contrast-checked against `--surface`/`--bg` to the Phase-2 standard before sign-off.

---

## 8. Screenshot gate (before → after, mandatory)
**Test-engineering lens.** Capture current v125 + redesigned for each; no approval on text alone:
1. Full active workout screen (composition)
2. Current strength exercise before logging
3. First set completed
4. Multiple sets completed
5. Next set obvious
6. Effort picker open
7. Weight override visible
8. Edit sets open
9. Superset visible
10. Collapsed upcoming exercises (checkbox → step)
11. Conditioning exercise
12. Conditioning swap open
13. Rest timer running (relationship intact)

Plus: full Node suite (20 files), coach-span zero-diff, CSS/flagged-markup-only diff, console clean, and the explicit **logging-not-slower** interaction check vs a before-capture.

---

## 9. Risks and mitigations
**Product + usability + engineering lens.**
- **Logging slower** — current-set log stays one tap; only the rare edit-a-completed-set path may cost +1 (Option A) — surfaced for approval, Option B available if unacceptable. Verified against a before-capture.
- **Hiding useful data** — nothing removed: prev, target, weight, reps, effort all still present; per-set weight shown when overridden (J2). Confirmed in the state model.
- **Screen too soft / over-designed** — anchored to coach-note language + real hierarchy; the current set is a strong, deliberate focus, not a dissolved card. Judged against "premium coach," not "minimal."
- **Losing superset clarity** — A1/A2 kept as explicit grouped tags; verified in the superset screenshot state.
- **Weakening completion clarity** — mitigated by tick + recession + retained count (J4), multi-cue, greyscale-safe.
- **Touching logic accidentally** — builders confirmed outside coach span; `data-act` bindings preserved verbatim; coach-span zero-diff enforced each step; markup changes flagged + shown first.
- **State-render regressions** (the set list has many states) — the §8 gate captures all of them before/after; live-drive each.

---

## 10. Approval questions
1. **Tap model (the key one):** approve **Option A** — completed sets collapse to a confirmed line, tap-to-re-open for edit (one extra tap only on the rare edit-a-completed-set path; logging unchanged) — or require **Option B** (all steppers stay live, zero tap delta, slightly less clean progression)?
2. **Effort placement:** approve moving the effort pills from today's separate revealed strip to an **inline suffix on the confirmed step** (`· effort 7`, tap to change) — same `setrpe` mechanic — or keep the separate revealed strip?
3. **Pending-set detail:** approve pending steps showing just `Set N · target reps` (calm), with weight/controls appearing only when the set becomes current (per the focus model) — or show more per pending set?
4. **Collapsed-row lead:** approve replacing the "0/2 sets" admin count with a **plan hint** (`3 × 8–12`) as the step's lead line, keeping the count only as needed — or retain the set count as the lead?
5. **Working-weight prominence:** approve the single shared **Working weight** control as the primary weight affordance, with per-set weight surfaced only on override (J2) — confirm this is the intended default read?
6. **Build cadence:** implement the whole screen redesign as **one pass** (all states together, one screenshot gate) — or split into (a) set progression + working weight, then (b) collapsed session steps + superset/conditioning, as two smaller screenshot-gated sub-passes? I recommend **one pass** since the states are interdependent, but two sub-passes de-risk the review.

No implementation until these are answered. Screenshots will gate the build.
