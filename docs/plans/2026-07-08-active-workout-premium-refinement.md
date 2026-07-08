# Active Workout — Premium Finish Refinement Plan

**Status:** Plan only. No code, nothing deployed. Refines the (structurally-approved) guided progression so its *finish* reads modern-premium-native, not "2016 dark web app." Behaviour, data, coach-span all fixed.

**Stance:** the structure is right; the surface treatment is not elite yet. This plan is honest about what still looks dated and separates cheap fixes from real ones.

---

## 1. What specifically still feels old-fashioned
**Visual design + brand lens** (grounded in the current live screenshots):

1. **Completed sets are full-width green "alert" bands.** A whole row bathed in green tint + a big saturated `--ready` (#26C281) filled circle reads like a Bootstrap success-alert, ~2016. Modern premium confirms a set with a *small, integrated* mark, not a green wash across the row.
2. **The effort chip row (6 7 8 9 10) sits inside every completed set, permanently.** Five boxes per done set = noise, repeated down the list. Dated and busy.
3. **Controls read as web form controls.** Bare `−`/`+` glyphs floating beside values, an underline number field, a 2px-outline circle — the vocabulary of an HTML form, not native pill controls.
4. **Dashboard typography density.** Uppercase mono labels stacked — `EFFORT`, `EST. 1RM`, `SETS`, `TARGET 60kg × 6`, `WORKING WEIGHT`, `WARM-UP` — plus mono numerals everywhere. Reads instrument-panel/dashboard.
5. **The grid dot-texture** behind the session adds blueprint/technical energy that fights "calm private coach" specifically on this screen.
6. **Green saturation + flat fills** — the completion green is a bright flat emerald that doesn't sit in the warm-graphite palette; it pops like a status LED.

## 2. Structural vs colour/style
**Behaviour-preserving engineering lens.**
- **Mostly colour/style (CSS-only):** completed-set green restraint (#1, #6), control pill refinement (#3), grid reduction (#5), typography warming (#4). No markup/behaviour change.
- **One genuinely structural change (markup, no logic):** collapsing the always-on effort chip row into an **inline value that expands on demand** (#2). This needs a disclosure pattern in the render, not a new handler or logic — the same `setrpe` chips, shown only when editing.

So the elite lift is ~80% CSS + one contained markup change to the effort display.

## 3. What must change to match the reference more closely
**Product + visual lens.** The reference feel = calm surfaces, restrained accents, native pill controls, minimal labels, one clear focus. Concretely:
- Completion becomes a *quiet confirmation*, not a green band.
- Effort becomes *inline text + tap-to-edit*, not a permanent picker.
- Controls become *soft pills* with real spacing, not floating glyphs.
- Labels *warm down* (fewer uppercase, less mono).
- The screen *loses the grid* (or nearly) so the surfaces breathe.

## 4. How completed sets should look
**Visual + accessibility lens.** Target: obvious at a glance, but confirmed/calm/integrated.
- **Drop the full-row green fill** to either nothing or a whisper (≤4%), so the done row sits on the same calm surface as the rest — no alert band.
- **Replace the big saturated filled circle** with a **smaller, calmer green check** (a check glyph in a restrained green, or a small filled dot — not a 44px flat-emerald disc). It reads "done" without shouting.
- **The confirmed result carries the weight of the state**: `Set 1 · 60 × 6 · effort 7` in a settled, slightly-muted tone; the green mark is a quiet accent, not the whole row.
- **Accessibility:** completion stays non-colour-dependent (check glyph + result text + recession + the "2/4" count), so it's legible in greyscale and to low-vision users even with the green dialled back. Contrast re-checked.

## 5. How effort should display / edit
**UX writing + usability + behaviour-preserving lens.**
- **Default (has effort):** inline suffix on the confirmed step — `Set 1 · 60 × 6 · effort 7`. No chip row.
- **Default (no effort):** a quiet inline prompt — `· rate effort` — not five boxes.
- **Editing:** tapping the effort value reveals the same 6–10 picker *in place*; pick → collapses back to the inline value. Implemented as a **native `<details>`/`<summary>` disclosure** (no new JS handler, no logic change; the existing `setrpe` chips live inside) — so the mechanic is byte-identical, only its default visibility changes.
- **Result:** the completed list reads as calm records with a small effort note, and the full picker appears only in the ~5-second moment you're actually rating.

## 6. Grid background on the active workout
**Visual + brand lens.** Recommendation: **remove (or reduce to near-zero) the grid on the day/active-workout view specifically**, keeping it (optionally) elsewhere. On the session screen it's the clearest remaining "technical blueprint" cue and it fights the calm-coach goal. This is a scoped CSS change (gate the grid off under `data-view="day"` or on the day container). Low risk, high premium-payoff. Approval question below on scope (day-only vs everywhere).

## 7. How controls become premium while keeping tap speed
**Usability + accessibility + visual lens.**
- **Steppers → soft pill buttons:** the `−`/`+` become small rounded `--surface-2` pills (subtle fill, not floating glyphs), with the value between them; same 36px+ hit areas (via the existing inset pseudo), same taps.
- **Weight/reps values:** sit as clean numerals in the pill cluster; the weight field stays directly typable but reads as a value, not a form input (keep it calm — refine the underline or move to a subtle inset).
- **Done control:** keep 44px tap target; refine to a cleaner ring/tick that matches the calmer completion treatment.
- **Spacing:** more breathing room in the current-set control row (it's currently a touch cramped/airy in the wrong places) so it feels considered.
- **Guardrail:** no control loses its size, position in the tap sequence, or `data-act` binding — pure restyle. Verified against a before-capture that logging stays one tap and equally fast.

## 8. Exact selectors / render areas involved
**Engineering lens (last).**
- **Completed-set green:** `.setrow.is-done` (row fill), `.setrow.is-done .setrow__done` (the green disc), `--ready` usage — CSS only.
- **Effort inline/disclosure:** `rpeStripHtml` (`~:5991`) + where it's emitted in `setRowsInner` (`~:6050`) → wrap in `<details><summary>` with the inline value; `.setrow__rpe`, `.setrpe-chip`, new summary styles — markup + CSS, flagged and shown first.
- **Controls:** `.rstep`, `.wtstep`, `.rval`, `.setrow__wtinput`, `.setrow__wt`, `.setrow__reps`, `.setrow__done` — CSS only.
- **Grid:** the grid `background-image` rule (`~:98`) + a `data-view="day"` gate — CSS only.
- **Typography:** `.setcount__label`, `.setshead__target`, `.card__1rm span`, `.phasehead__label`, `.startweight__label`, `.setrow__rpe-lbl`, `.setrow__n` — CSS only (case/size/weight/mono).
- **No JS logic, no `__COACH__` span, no data shape.**

## 9. What must stay behaviour-identical
Per every prior guardrail: coaching engine, selection, prescription, progression, injury/readiness/recovery, build/Just-Today, **set logging one tap**, effort `setrpe` mechanic, rest-timer trigger/persistence, edit-sets, conditioning swap, reopen-to-edit, block counters, data + saved-state shape. The effort disclosure keeps the identical chips/`setrpe`; controls keep identical bindings and tap targets.

## 10. Screenshots required before approval
**Test-engineering lens** — before → after for each:
1. Full active workout (composition, with grid removed/reduced)
2. Current strength set before logging (refined pill controls)
3. One completed set — restrained green + inline `· effort 7`
4. Multiple completed sets — calm confirmed list, no green bands
5. Effort disclosure open (picker revealed on tap)
6. No-effort completed set (`· rate effort` prompt)
7. Next set obvious; pending sets calm
8. Weight override visible (brass, restrained)
9. Edit sets open
10. Superset visible
11. Conditioning + conditioning swap
12. Rest timer running (relationship intact)

Plus: full Node suite, coach-span zero-diff, console clean, and the explicit logging-not-slower check vs a before-capture.

---

## Approval questions
1. **Completed-set treatment:** approve dropping the full-row green fill in favour of a calm surface + a **small green check + muted result line** (green as a quiet accent, not a band)? Any preference between a small filled dot vs an outline check?
2. **Effort:** approve the **inline `· effort N` + native `<details>` disclosure** (picker on tap), replacing the always-on chip row? (One contained markup change, no logic.)
3. **Grid:** remove the grid on the **active-workout/day view only** (recommended), or reduce it globally, or leave it?
4. **Controls:** approve refining steppers to **soft `--surface-2` pills** and calming the weight field, keeping all tap targets/bindings?
5. **Typography:** approve warming down the uppercase/mono labels on this screen (fewer caps, less mono, quieter) — confirm you want this reduction, since some uppercase overlines are deliberate elsewhere?
6. **Green value:** keep `--ready` as-is but use it at lower opacity/size, or introduce a slightly deeper/less-saturated completion green for better warm-graphite integration? (I lean: same token, restrained usage — no new colour.)

No implementation until these are answered. Screenshots will gate it.
