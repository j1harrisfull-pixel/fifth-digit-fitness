# Redesign Pass 1 — Active Workout (Implementation Plan)

**Status:** Plan only. No code, no edits, nothing deployed. Awaiting approval.

**Position:** Pass 1 of the approved Hybrid master plan (Pass 1 active workout → Pass 2 rest/dialogs/completion → Pass 3 consolidation). Heavy pass. Visual language only — the engine, data shape, and every interaction mechanic are fixed.

**Verified up front:** the set-row builders (`index.html:5871`, `:5991`), `buildCard()` (`:6125`), the block-header builder (`:6336`), and `renderList()` (`:6378`) all sit **outside** the `/*__COACH_START__*/…/*__COACH_END__*/` span (1923–4830). Pass 1 touches presentation only; the coach span stays byte-identical.

---

## 1. Specialist skills used

- **Product design** — §2 (is the screen worth paying for), §3 (target experience), §5 (per-component "what improves for a paying user").
- **Visual design** (primary) — §2, §3, §5 (surfaces, the guided set row, card composition, livebar).
- **Usability** — §3, §5, §7, §9 (logging speed, scan speed, next-action clarity, the "not slower" proof).
- **UX writing** — §5 (livebar label, block headers, any label read) — no copy rewrites planned; tone-checks only.
- **Brand systems** — §3, §5 (console→coach; avoiding soft-SaaS and luxury; the coach-note north star).
- **Accessibility** — §8 (contrast of new surfaces, state visibility, touch targets, the weight-override signal).
- **Behaviour-preserving engineering** — §6, §7 (markup latitude, same-data/same-taps proof, coach-span protection).
- **Test engineering** — §9, §10 (regression, screenshot gates, the logging-speed verification method).

---

## 2. Active workout diagnosis — what makes it feel like a console/checklist

**Visual design + product lens**, grounded in the exact CSS/markup.

The core insight: the screen's **information architecture is good** (one exercise in focus, column-aligned sets, clear next action), but its **material is wrong** — almost every unit is a bordered box or a spreadsheet cell. The console/checklist read comes from *material*, not *layout*. Specifics:

1. **Set rows are spreadsheet cells.** `.setrow` (`:444`) = a 5-column grid (`24px 54px 88px 1fr 44px`) with a **per-row `1px solid` border** and a **dashed-border weight input** (`.setrow__wtinput`, `:483`). A stack of bordered grid rows with a dashed input *is* a spreadsheet. This is the single strongest offender.
2. **State signalled by border weight.** `.setrow.is-next` = a stronger border (`:464`); `.setrow.is-done` = tinted fill + green border (`:460`). Borders doing state work reinforces the boxed read.
3. **Prescription as bordered cells.** `.card__stats` (`:412`) = three `--surface-2` cells each with `1px solid` border — a mini spec-sheet above the sets.
4. **Livebar reads tactical.** `.livebar__label` (`:154`) = uppercase tracked-out "LIVE • CHEST • BACK • SHOULDERS", a status dot, a hard `border-bottom`, and a bordered "End" button (`:156`) = instrument cluster on session entry.
5. **Uppercase stacking.** On one screen: livebar label + `.setcolhead` column labels (`:429`) + `.phasehead__label` block header (`:686`) + `.card__stat-label` — all uppercase at once = signage density.
6. **The exercise card is itself a bordered box** (`.card`, `:301`) containing more bordered boxes — nested framing.

What's already right and must be preserved as the anchor: the **coach note** (`.card__coachnote`, `:350`) — the one element that reads as a human coach. Pass 1 makes the rest of the screen agree with *it*.

---

## 3. Target active workout experience

**Product + visual + brand lens.** One sentence: *a paying client, mid-session, looks down and sees their coach's plan for the current lift laid out calmly — one thing in focus, the next set obvious, logging a tap away — not a data-entry grid.*

Concretely, the new language (extending the approved foundations, anchored to the coach-note):
- **Surface-first, not border-first.** The exercise card holds its sets on its own surface; sets are separated by rhythm/hairline/inset fill, not by each being a bordered cell. Borders reserved for interaction (inputs) and are the exception.
- **One clear focus.** The current exercise is the hero; the current *set* within it is unmistakable via a quiet inset fill (not a heavier border), agreeing with the single orange LOG bar.
- **Calm prescription.** Sets/reps/rest read as a quiet coached line or de-bordered surface, not spec-sheet cells.
- **Logging stays a fast, aligned, one-tap action.** Column alignment (which aids scanning speed) is *kept*; only the boxed material changes. This is the crux: **redesign the material, keep the information architecture.**
- **Quieter chrome.** Livebar sheds its tactical label; block headers stay as restrained editorial overlines; uppercase density drops.
- **`--shadow: none` holds** — elevation via fill + tuned rim, never drop shadow.

---

## 4. Exact selector / class / render audit

| Element | Selector(s) / render | Current material problem |
|---|---|---|
| Session top bar | `.livebar*` (`:148–160`), markup `index.html` livebar block | Tactical uppercase label, status dot, hard bottom border, bordered End |
| Exercise card shell | `.card` (`:301`), `.card.is-current` (`:379`) | Bordered box containing bordered boxes |
| Card head / name | `.card__head`, `.card__name` (`:314–315`) | Fine; hierarchy only |
| Coach note | `.card__coachnote*` (`:350–351`) | **Keep — the anchor** |
| Coachhint (RPE/1RM) | `.coachhint*` (Phase 1, `:265`) | Already a calm aside; verify fit only |
| Prescription cells | `.card__stats`, `.card__stat*` (`:412–415`) | Three bordered spec cells |
| Column header | `.setcolhead`, `.setcolhead span` (`:424–429`) | Uppercase column labels; part of density |
| Set list | `.setlist` (`:437`) | 6px-gap stack (fine) |
| **Set row** | `.setrow` (`:444`), render `:5991` (strength) / `:5871` (simple) | **Spreadsheet cell — primary target** |
| Set number | `.setrow__n` (`:466`) | Mono; fine |
| Prev cell | `.setrow__prev` (`:469`) | Fine |
| Weight cluster | `.setrow__wt`, `.setrow__wtinput` (`:482–484`) | **Dashed-border input = spreadsheet cell** |
| Reps cluster | `.setrow__reps`, `.rstep`, `.rval` (`:470–476`) | Ghost steppers already quiet; keep |
| Done control | `.setrow__done` (`:488`) | 44px circle, good affordance; keep |
| Next-set state | `.setrow.is-next` (`:464`) | Border-weight state signal |
| Done state | `.setrow.is-done` (`:460`) | Tinted fill + green border |
| Effort picker | `.setrow__rpe`, `.setrpe-chip` (`:455–459`) | Bordered chips |
| Target line | `.setrow__target` (`:453`) | Body font (Phase 1); fine |
| Block header | `.phasehead*` (`:684–687`), render `:6336` | Uppercase overline (mostly fine) |
| Card foot | `.card__foot`, `.card__1rm`, `.card__prog` (`:497–500`) | Fine; hierarchy only |
| Edit sets / notes | `.notes*`, `.reps__input`, `.cuebox` (`:509–520`) | Bordered inputs (affordance — keep) |
| Superset | `.supertag`, superset badge markup | Keep clarity; align material |
| Sticky LOG bar | `.logbar__btn` (`:166`) | Clipped CTA signature — keep |

---

## 5. Proposed treatment (component by component)

**Visual + usability + brand + UX-writing lens per item. Each states what improves for a paying user.**

### Livebar (session top bar)
- **Treatment:** drop the uppercase "LIVE • focus" tactical label (the session title already lives in the daybar directly below — it's redundant *and* tactical). Keep a quiet elapsed timer and the End control; soften End to the Phase 2 border policy (hairline, not `--line-strong`). Remove or soften the hard `border-bottom` to a hairline. Retain sticky positioning, the timer, and End's confirm-before-commit safety.
- **Improves:** the first thing a client sees on entering a session becomes calm, not an instrument panel. *(UX-writing: removing "LIVE" also removes a system-status word for a human moment.)*
- **Risk:** medium — must not disturb timer/End behaviour.

### Active exercise card (shell + composition)
- **Treatment:** the current card keeps `--surface`; reduce its own border to a hairline (or drop it in favour of the card being the surface the sets sit on). Internally, stop nesting bordered boxes — the sets and prescription become surface-first elements *within* the card, not framed cells. Order stays: name → coach note → prescription → column header → sets → foot.
- **Improves:** the card reads as one considered coaching surface, not a box of boxes.
- **Risk:** medium.

### Block header / counter (`.phasehead`)
- **Treatment:** keep the uppercase overline (legitimate editorial section marker) but ease weight/tracking so it's a quiet label, consistent with Phase 2's uppercase discipline. Minutes stay.
- **Improves:** section orientation without military signage.
- **Risk:** low.

### Coach note
- **Treatment:** **unchanged** — it's the north star. Verify it sits well in the recomposed card.
- **Improves:** already the best element; protected.
- **Risk:** none.

### Coachhint (RPE/1RM explainer)
- **Treatment:** **unchanged** (Phase 1 aside). Verify fit in the new card context.
- **Risk:** none.

### Stat / prescription display (`.card__stats`)
- **Treatment (approval Q1):** two candidates — (a) **de-border the three cells** to surface-first pills (`--surface-2` fill, no border, radius), or (b) **replace with a single quiet coached line** ("4 sets · 5–6 reps · 2 min rest"). (a) keeps glanceable columns with calmer material; (b) is the calmest, least boxy, most "coach telling you the plan" — but loses the three-column scan. Recommendation: **(b) a single quiet line** for the strongest console→coach shift, keeping the exact same `e.sets/e.reps/e.rest` data. Ask before committing.
- **Improves:** the plan reads as coaching, not a spec sheet.
- **Risk:** low–medium (information density change — verify nothing is lost).

### Guided set row (the heart of Pass 1)
- **Treatment:** **redesign the material, keep the information architecture.** Precisely:
  - **Remove the per-row `1px solid` border.** Sets sit on the card surface, separated by rhythm + a hairline divider (or none), not each in its own box.
  - **Keep the column alignment** (`Set | Prev | Kg | Reps | Done`) and the column header — alignment is what makes logging fast; this is deliberately preserved.
  - **Weight input:** drop the dashed/solid **border** treatment (the clearest spreadsheet signal). Keep it a typable field with its ghost ± steppers, but signal *inherited vs override* by **text treatment** instead of a box: inherited = `--ink-dim` value; override = full-ink value + a small brass marker (dot or underline). Same `.is-override` class, restyled — likely **no markup change**.
  - **Next-set state:** signal the live row with a quiet **inset `--surface-2` fill** (agreeing with the single orange LOG bar) instead of a heavier border.
  - **Done state:** quiet green-tinted fill + the existing check; recede. Keep the 44px done circle exactly.
  - **Effort chips:** de-border to tinted pills matching the Phase 2 tag/effort language; same reveal-after-done mechanic, same values.
- **Improves:** logging stops feeling like filling a spreadsheet and reads as a guided, coached line — *at the same speed*, because alignment and tap targets are unchanged.
- **Risk:** **high** — this is the most interactive element. Mitigated by §7/§9.

### Logged set state
- **Treatment:** as above — quiet green-tinted fill + check, no heavy border; the completed set recedes so focus moves to the next.
- **Improves:** clear, calm progress feedback without boxed clutter.
- **Risk:** medium (state visibility — verify done is unmistakable).

### Effort picker
- **Treatment:** `.setrpe-chip` → tinted-pill language (de-border, matching status tags); selected chip keeps brass. Same inline-after-done reveal, same tap.
- **Improves:** effort capture feels like a calm choice, not a keypad.
- **Risk:** low–medium.

### Edit sets panel
- **Treatment:** inputs keep their borders (input affordance — correct). Align spacing/labels with the new card rhythm; `.field-label` uppercase eased to match. No structural change.
- **Improves:** consistent, calm, still clearly editable.
- **Risk:** low.

### Conditioning card / swap
- **Treatment:** conditioning uses `.setrow--simple` — inherits the guided-row material. The "Swap exercise" control aligns to the new language. No swap-logic change.
- **Improves:** conditioning reads consistent with strength work.
- **Risk:** low.

### Superset treatment
- **Treatment:** keep the A1/A2 badge + `.supertag` clarity; ensure their material (currently accent-tinted) agrees with the new surfaces. No superset-logic change.
- **Improves:** supersets stay unmistakable in the calmer system.
- **Risk:** low.

---

## 6. Presentational markup changes needed (if any)

**Behaviour-preserving engineering lens.** Goal: **CSS-only wherever possible.** Expected reality:

- **Set row (`:5991`/`:5871`):** the material changes (border removal, surface-first, override-by-text, tinted next/done) are achievable by **restyling existing classes** (`.setrow`, `.setrow__wt`, `.is-override`, `.is-next`, `.is-done`, `.setrpe-chip`) — **CSS-only, no markup change expected.**
- **Prescription line (if Q1 = single line):** likely a **small markup change** in `buildCard()` — swapping the three `.card__stat` cells for one `.card__rx-line` span built from the same `e.sets/e.reps/e.rest`. This is presentation/hierarchy only, no new data, no logic. **Flagged; shown before editing.**
- **Livebar label removal:** removing/altering the `.livebar__label` text is a **small markup change** in the livebar render. Presentation only. **Flagged.**
- **Anything else:** if the guided row needs a wrapper element for rhythm/dividers, that's a presentational wrapper — **flagged and shown before editing**, coach-span zero-diff enforced.

**Commitment:** before writing any markup change, I will list it, show the before/after string, and confirm it's presentation/hierarchy only. If any change risks behaviour/data/state/logic, I stop and report (per J3).

---

## 7. Same-data / same-taps protection plan

**Behaviour-preserving engineering + usability lens.** Every J2 guardrail mapped to how it's held:

| Must not lose | How Pass 1 preserves it |
|---|---|
| Set number | `.setrow__n` kept in every row |
| Previous-set info | `.setrow__prev` kept, same `buildLastLogs` source |
| Weight entry | `.setrow__wtinput` stays a typable field + ± steppers; only its *border* styling changes |
| Reps entry | `.setrow__reps` / `.rstep` / `.rval` unchanged in structure & taps |
| RPE / effort picker | `.setrow__rpe` reveal-after-done + `.setrpe-chip` taps unchanged; only chip styling |
| Completed-state feedback | `.is-done` still fills + checks; restyled, not removed |
| Rest-timer trigger | The done-tap → rest-timer wiring is untouched (event handlers, not markup) |
| Same taps | No control removed, added, or relocated in a way that changes the tap sequence |
| Same/better speed | Column alignment kept; the log action stays one tap on the same-sized done circle + sticky LOG bar |
| No progression / data-shape / logging-mechanics change | All in the coach span / event handlers — untouched |

---

## 8. Accessibility / touch-target plan

**Accessibility lens**, using the Phase 2 contrast method.
- **Touch targets:** done circle stays 44px; steppers keep their 36px + inset pseudo hit areas; effort chips keep ≥34×36px. Nothing shrinks. Measured live, not assumed.
- **State contrast:** the next-set inset fill and done tint must each be perceptibly distinct from a resting row and from each other — contrast-checked against `--surface`/`--bg` (target: clearly visible; the Phase 2 standard). If fill-only proves weak, a hairline or stronger tint is added.
- **Weight override signal:** replacing the dashed box with text treatment must stay perceivable — override uses full-ink + a brass marker with sufficient contrast, not colour alone (a weight/shape cue too), so the inherited/override distinction survives for low-vision and daylight use.
- **Focus states:** inputs and buttons keep visible focus rings; verified.
- **Colour meaning:** green = done only; brass = accent/override; no new semantic colours.

---

## 9. Regression & live-verification checklist (incl. the "not slower" proof)

**Test engineering + usability lens.**
- **Full Node suite** — 20 files, 0 failed, identical to the Phase 2 baseline.
- **Coach-span diff** — zero.
- **CSS/markup-only diff review** — confirm only presentational selectors + any flagged-and-approved render strings changed.
- **Console** — clean on the active workout across all states.
- **Logging-not-slower verification (explicit):** on a real strength exercise, drive the full log flow — enter weight, adjust reps, tap done, rate effort — and confirm: (a) tap count per set is identical to today, (b) the done circle and steppers are the same size/position, (c) the next set becomes the clear focus, (d) the rest timer triggers on done as before. Compare against a pre-change screenshot/interaction of the same flow.
- **Interaction checks:** edit sets open/close + edit a value; conditioning swap toggle; superset round; weight override (type a value) shows the override signal; effort chip select.
- **Untouched-area smoke:** home, week list, build sheet, settings render unchanged (no bleed from shared-token edits).

---

## 10. Screenshot states to review **before implementation is approved** and again after

**Test engineering lens** — the required gate set:
1. Active workout initial state (session just opened)
2. First strength exercise (hero card)
3. Coach note visible
4. Coachhint (RPE/1RM) visible
5. Set not logged (resting + next-set focus)
6. Set logged (completed row)
7. Effort picker open
8. Rest timer running *(present; full rest-timer redesign is Pass 2 — Pass 1 leaves it functionally as-is, only ensures it doesn't clash)*
9. Edit sets open
10. Conditioning card
11. Conditioning swap open
12. Superset visible
13. Block transition (warm-up → strength) if visible in one frame

I will capture the **current** state of each first (the "before"), so approval is against a real before/after, not a description.

---

## 11. Risks and mitigations

**Product + usability + engineering lens.**
- **Logging becomes slower / less clear** *(highest risk).* → §7/§9: alignment + taps + target sizes preserved; explicit not-slower verification against a before capture.
- **Hiding useful data** (prev, target, override, effort). → §7: re-layout not data-cull; every datum mapped.
- **State visibility weakened** (next/done less obvious once borders go). → §8: inset-fill + tint contrast-checked; done circle unchanged.
- **App becomes generic/soft.** → anchor to the coach-note + tuned rims + brass; not "remove all borders." Judged against "private coach."
- **Overcorrecting into luxury.** → no shadows, no ornament, `--shadow: none`.
- **Touching logic accidentally** (workout markup is engine-adjacent). → builders confirmed outside the coach span; CSS-first; markup changes flagged+shown before editing; coach-span zero-diff every step.
- **Accumulating unpushed work.** → per J4, deploy the accumulated approved visual work as one checkpoint *after* Pass 1 is approved.
- **Prescription-line info loss (if Q1=b).** → verify sets/reps/rest all still present and legible before/after.

---

## 12. Approval questions

1. **Prescription display:** (a) de-border the three stat cells to surface-first pills, or (b) replace with a single quiet coached line ("4 sets · 5–6 reps · 2 min rest")? *Recommendation: (b)* — strongest console→coach shift, same data. This needs a small flagged markup change in `buildCard()`.
2. **Weight override signal:** approve replacing the dashed-border input with a **text-based** inherited/override signal (inherited = dimmed value; override = full-ink + small brass marker), keeping the field fully typable? *(This removes the single clearest spreadsheet cue.)*
3. **Livebar label:** approve **removing the uppercase "LIVE • focus" label** from the session top bar (the session title already shows in the daybar below), leaving a quiet timer + softened End? Small flagged markup change.
4. **Next-set / done state:** approve signalling live-set and done-set via **quiet inset fill/tint** instead of border weight (agreeing with the single orange LOG bar as the one accent)?
5. **Scope confirm:** Pass 1 leaves the **rest timer functionally as-is** (only ensuring it doesn't visually clash), with its full redesign in Pass 2 — confirm?

No code until these are answered and the plan is approved. Nothing deployed.
