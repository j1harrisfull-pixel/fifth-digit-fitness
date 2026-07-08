# Visual Reset — Phase 1 Implementation Plan: De-technical-ize Shared Chrome

**Status:** Plan only. No code written, no files edited. Awaiting approval before implementation.

**Position in sequence:** Phase 1 of the approved 7-phase visual-language reset (Phase 1 shared chrome → 2 card/list language → 3 active workout → 4 completion/recap → 5 dialog family → 6 polish pass → 7 QA). Replaces the retired "Phase E onward" sequence.

**One-line goal:** move the *shared, low-risk* chrome from border-first/notice-board grammar toward a calmer surface-first grammar, without touching any primary content card, set row, timer, or dialog (those are later phases).

---

## 1. Specialist skills used

- **Visual design reasoning** (primary lens) — Sections 4, 5, 6, 7: which borders to drop vs keep, how the coachhint becomes an aside not a notice, mono/uppercase balance, radius/surface/contrast choices.
- **Product design reasoning** — Sections 2, 11: confirming each change makes a screen read calmer/more trustworthy (more "private coach"), not just visually different, and that we're solving the shared-chrome problem and not drifting into a later phase's work.
- **Usability reasoning** — Sections 4, 5, 9, 11: confirming reduced borders don't erase the visual separation a user relies on to parse content, that nothing gets harder to scan, and that the dismiss/interaction affordances stay obvious.
- **UX writing reasoning** — Section 6: the mono/uppercase decisions are as much about whether a *label reads as coaching or as system output* as about typography; used to decide which labels lose emphasis and which keep it.
- **Brand systems reasoning** — Sections 5, 11: measuring every change against Fifth Digit's quiet-confidence discipline (premium without noise, not soft-SaaS, not black-and-gold), and against the existing Phase C coach-note treatment so Phase 1 stays consistent with it.
- **Accessibility reasoning** — Sections 4, 9, 10, 11: contrast of any softened border/surface, preservation of visible focus/selected/disabled states, no reduction of touch targets or legibility.
- **Behaviour-preserving engineering reasoning** (last, not leading) — Section 8: proving every change is CSS/presentational, sits outside the `__COACH__` span, touches no data shape, and carries near-zero regression risk.

---

## 2. Exact scope (what Phase 1 WILL change)

Four contained changes, all CSS-only (one is a font-family swap, none touch markup structure, none touch JS logic):

1. **Coaching-aside treatment for the two "notice box" surfaces** — `.coachhint` (the RPE/Est.1RM explainer) and `.today-subbanner` (the recovery-swap "this replaces the plan" notice). Both currently read as hard-cornered system notices; both become calm coaching asides.
2. **Mono-creep removal on exactly two label selectors** — `.setrow__target` and `.setrow__rpe-lbl` move from Spline Sans Mono to the body font. Font-family only; no layout, border, size, or structural change to the set row (the set-row *redesign* stays in Phase 3).
3. **One uppercase softening** — `.consistency-label` (the "LAST 14 DAYS" caption added in Phase D) drops uppercase/heavy tracking, becoming a quiet sentence-case caption. This is the single label I own outright and the clearest "signage" offender outside the active-workout screen.
4. **Establish the shared "quiet aside" surface approach** as the reusable pattern the two boxes in (1) adopt — documented in a CSS comment so Phase 2/3 inherit the same grammar rather than reinventing it.

That is the entire Phase 1 change set. Deliberately small.

---

## 3. Out of scope (what Phase 1 will NOT touch)

- **Primary content cards** — `.card` (exercise card), `.today-card` (home hero), `.weekrow` (week list rows), Settings rows, history rows. All border/surface work on these is **Phase 2/3**, not now.
- **Set-row structure** — the grid template, per-row border, dashed weight input, 52px min-height, tap behaviour. Only the two font-family swaps in Scope item 2 touch anything set-row-adjacent, and only the typeface.
- **Rest timer** — no changes (`.resttimer` and its nested borders are Phase 3).
- **Live/session top bar** — `.livebar`, `.livebar__label` ("LIVE"), End button. Phase 3.
- **Dialogs** — `.confirm__title`, `.sheet`, readiness prompt, destructive confirms. The readiness-prompt colour bug stays logged as debt and is fixed at its root in **Phase 5**, not patched here.
- **Grid background** — `--grid` left exactly as-is (approved decision #5).
- **Most uppercase overlines** — `.sect__label`, `.phasehead__label`, `.blabel`, `.field-label`, `.recap-stat__label`, `.history__section-title`, etc. These are legitimate editorial section overlines; the audit's uppercase complaint was about *density on one screen* (the active-workout stack), which is a Phase 3 concern. Softening them individually now would scatter the fix and risk inconsistency. They stay.
- **Coach-note treatment** — `.card__coachnote`/`.card__coachnote-label` (Phase C, mono brass overline) is intentional and untouched; Phase 1 explicitly does not extend mono-removal to it.
- **Any JS, any data shape, any `__COACH__`-span code.**

---

## 4. Target CSS / classes

| Selector | Current issue | Proposed visual change | Why Phase 1 | Risk |
|---|---|---|---|---|
| `.coachhint` (`index.html:265`) | `border: 1px solid var(--line-strong)`, **no `border-radius`** — the sharpest-cornered box in the app, reads as a system notice board | Add `border-radius: var(--radius)`; reduce border to `var(--line)` (or drop border and lean on a `--surface-2` fill so it sits *inside* the content, not framed against it); keep the flex layout and dismiss button but give the button the same softened treatment | It's the clearest single off-brand element (audit class 4) and fully isolated — one class, no logic, no markup | **Low** |
| `.coachhint__dismiss` (`index.html:271`) | Bordered rectangle ("Got it") — reinforces the notice-board read | Soften to match the calmer aside (lighter border or ghost-button style, keep 7px+ padding and hit area) | Same box, must move together or it looks half-done | **Low** |
| `.today-subbanner` (`index.html:525`) | `border: 1px solid var(--line-strong)` + no radius — same notice-board grammar, used for the recovery-swap "this replaces the plan" message | Same aside treatment as `.coachhint` (radius + softened border/surface) so the two share one grammar | Recovery-swap flow (audit flagged its notice box shares the coachhint issue); establishes the reusable aside pattern | **Low** |
| `.today-subbanner__label` (`index.html:526`) | Uppercase + `.12em` tracking — reads as a system label heading a warning | Keep uppercase *or* soften — see Section 6; recommend keeping uppercase here (it IS a genuine "this is a mode change" overline) but reducing tracking to `.08em` so it's calmer, not signage | Part of the same aside; small tuning, not a redesign | **Low** |
| `.setrow__target` (`index.html:426`) | `font-family: "Spline Sans Mono"` on a phrase ("Effort 7 · 3 reps left") — mono on words, not numbers | Change `font-family` to `var(--font-body)`; keep size/colour/position | Explicitly named for Phase 1; mono should mean "measured quantity," not "technical label." Font-family only — does not redesign the row | **Low-medium** (touches a set-row component visually, but typeface only) |
| `.setrow__rpe-lbl` (`index.html:430`) | `font-family: "Spline Sans Mono"` + uppercase on the literal word "RPE"/effort label | Change `font-family` to `var(--font-body)`; keep uppercase (it's a 3-letter tag) or lower-case it — recommend keeping the tag form but off mono | Explicitly named for Phase 1; same rationale | **Low-medium** (typeface only) |
| `.consistency-label` (`index.html:194`) | Uppercase + `.06em` tracking "LAST 14 DAYS" — I added this in Phase D; it reads as signage above a quiet strip | Drop `text-transform: uppercase`; sentence-case "Last 14 days" via content is already the text, so just remove the transform + reduce weight/tracking → quiet caption | Isolated, I own it, and it's the clearest non-active-workout uppercase offender | **Low** |
| **Shared token note** | No token *values* change in Phase 1 | Possibly introduce nothing new — reuse existing `--surface-2`, `--line`, `--line-soft`, `--radius`. If an aside needs a distinct fill, reuse `--accent-tint` (already defined) for an optional subtle brass wash — see Section 6 approval Q | Keeps Phase 1 token-neutral and reversible | **Low** |

---

## 5. Surface-first strategy (without going generic or unclear)

**Visual design + usability lens.** The principle: separation should come from *fill, spacing, and radius* before it comes from an *outline*. But Phase 1 applies this **only to aside/notice boxes**, not to primary cards — because primary cards genuinely use their border to say "this is a discrete, tappable unit," and removing that indiscriminately is exactly the "too soft / generic SaaS" failure the audit warned about. So:

- **Asides (coachhint, subbanner)** are *secondary* content that currently shout via a hard frame. These are the right first candidates to go border-light: a filled `--surface-2` block with radius reads as "a quiet note set into the page," which is precisely the coaching-aside feel. Dropping/softening their border loses no clarity because their *content* and *position* already make their role obvious.
- **Primary cards stay bordered for now.** The surface-first grammar for cards is deliberately deferred to Phase 2, where it can be done consistently across home hero, week rows, and settings in one coherent pass, with its own live-verification. Doing one card now would create exactly the inconsistency risk we're trying to avoid.
- **Guardrail against generic:** the aside doesn't become a formless grey rectangle — it keeps a deliberate radius, an optional restrained brass tie (approval Q), and the same spacing rhythm as the coach-note treatment, so it reads *composed*, not *absent*. The point of view (calm graphite + restrained brass, matching Phase A/C) anchors it.

Net: Phase 1 proves the surface-first pattern on the two lowest-risk surfaces and writes it down, so Phase 2 can extend it to cards with confidence.

---

## 6. Coachhint / help-box strategy

**Visual design + UX writing + brand lens.** Today `.coachhint` is a hard-cornered, strong-bordered block on `--surface`, dismissed by a bordered "Got it" button — the visual grammar of a system warning. The RPE/Est.1RM copy inside it is genuinely *helpful coaching* ("Effort is how hard a set felt: 6 easy, 10 all-out…"), so the container is fighting the content.

Proposed coaching-aside treatment:
- **Corners:** add `border-radius: var(--radius)` so it stops being the one square box on the screen.
- **Frame:** drop the `--line-strong` outline; sit the content in a `--surface-2` fill (a note set *into* the page) rather than a box framed *against* it. If any edge definition is wanted, use `--line-soft` at 1px, not `--line-strong`.
- **Optional brass tie (approval Q3):** a subtle left accent rule or a faint `--accent-tint` wash would visually relate it to the Phase C coach-note (which uses a brass left rule). This would make it read as "the coach explaining something," consistent with the app's established coach voice. *But* — the coach-note's italic/quote treatment is reserved for the coach's spoken notes; the coachhint is instructional, not a spoken note, so I would **not** make it italic. The question is only whether to add the quiet brass tie or keep it fully neutral graphite.
- **Dismiss button:** soften from a bordered rectangle to a quieter control (ghost/underlined or a lighter-bordered pill), keeping ≥44px effective hit area and a visible focus state.
- **Copy:** unchanged — it's accurate and useful; this is a container problem, not a wording problem.

Result: a calm aside that reads as guidance, matching the coach-note family, not a warning panel. Fully isolated, reversible, no logic.

---

## 7. Mono / uppercase strategy (exactly what moves, what stays)

**Visual design + UX writing lens.**

**Mono — remove from exactly two, keep everywhere else:**
- **Remove:** `.setrow__target` (phrase with mixed words+numbers) and `.setrow__rpe-lbl` (the word "RPE") → `var(--font-body)`. Rationale: mono should signal "a measured quantity in a column," which these are not.
- **Keep (numeric/tabular, correct use):** `.mono` on weights, reps, timers, set numbers, PR deltas, stat values — all of it. This is good tabular-nums practice and is *not* the problem.
- **Keep for now (mono-on-label, but on other screens — defer to their phases):** `.supertag`, `.supernext__label`, `.card__skip-tag`, `.weekrow__tag`, `.intro__how`, `.card__coachnote-label` (the last is intentional Phase C brass overline — keep permanently). These live on the active-workout / week-list / onboarding / completion screens; touching them now would reach into Phases 3/6. They're logged for those phases, not Phase 1.

**Uppercase — soften one, keep the rest:**
- **Soften now:** `.consistency-label` only (drop uppercase → quiet caption).
- **Keep (legitimate editorial overlines):** `.sect__label`, `.phasehead__label`, `.blabel`, `.field-label`, `.recap-stat__label`, `.recap-prs__label`, `.history__section-title`, `.today-subbanner__label` (tracking tuned but form kept), etc. The technique is right; the *density* is the problem, and the worst density is on the active-workout screen, which is Phase 3's job to resolve holistically. Scattering individual uppercase removals now would produce inconsistency and pre-empt Phase 3.

This keeps Phase 1 honest: it fixes the mono-on-words creep (a clear, safe win) and the one caption I own, and explicitly defers the broader uppercase-density work to the phase that owns the screen where it actually hurts.

---

## 8. Behaviour protection

**Behaviour-preserving engineering lens.**
- **Every change is a CSS property change** (border-radius, border colour/width, background, font-family, text-transform) on existing selectors, plus at most a tuning of one label's tracking. No markup restructure, no class renames, no attribute changes.
- **Nothing in the `/*__COACH_START__*/ … /*__COACH_END__*/` span is touched.** All target selectors are in the top-of-file `<style>` block; the coach span is JS. I will diff the span before/after to prove zero change (`sed -n '/__COACH_START__/,/__COACH_END__/p'`), as every prior visual phase did.
- **No data shape, no localStorage key, no state field touched.** The coachhint's dismiss-once behaviour (localStorage flag) and the subbanner's render logic are untouched — only how they look.
- **The two set-row font swaps do not touch the set row's grid, borders, inputs, tap targets, or logging path** — purely `font-family`.
- **Regression surface:** CSS only → the risk is visual, not functional. The Node suite (which tests the engine, not styling) should show identical results; it's run anyway as a tripwire for any accidental structural edit.

---

## 9. Live verification checklist

Run in the `/tmp/training-log-preview` harness after implementation, SW/cache/localStorage reset, on a freshly built 4-week program:

- [ ] **Onboarding** — all steps render; intro card unaffected (no shared-chrome regression).
- [ ] **Home** — hero + consistency strip; confirm `.consistency-label` now reads as a quiet caption, strip unaffected.
- [ ] **Build-a-week sheet** — chips/controls unaffected (not in scope, verifying no bleed).
- [ ] **Just Today sheet** — free-text box, readiness chips unaffected.
- [ ] **Active workout** — open a real session; confirm `.setrow__target` and `.setrow__rpe-lbl` now render in body font, set rows otherwise **identical** (grid, borders, taps, min-height all unchanged); coach-note (Phase C) still correct.
- [ ] **Coachhint / help box** — trigger the RPE/Est.1RM explainer on a fresh session; confirm it now reads as a calm aside (radius, softer frame), dismiss works, dismiss-once still persists across reload.
- [ ] **Recovery-swap notice** — trigger a Rough-day recovery substitution; confirm `.today-subbanner` matches the new aside treatment and the "replaces the plan / recorded as an alternate" copy is intact.
- [ ] **Set logging** — log real sets; confirm tap-to-log, weight nudge, RPE-on-completion all behave exactly as before.
- [ ] **Rest timer** — confirm untouched (starts, persists, ±15s, skip) — verifying no accidental bleed.
- [ ] **Settings** — open; confirm untouched.
- [ ] **Session completion** — only if the recap/receipt is visually affected (it should not be — not in scope); quick confirm the cream receipt is unchanged.

---

## 10. Regression checklist

- [ ] **Full Node suite** — all 20 files in `tools/tests/`, expect 0 failed, identical counts to the Phase D baseline (incl. `test-phase8-safety-sweep.js`).
- [ ] **Coach-span diff** — `sed`-extract the `__COACH__` span before/after, expect zero diff.
- [ ] **Console check** — no new errors/warnings in `preview_console_logs` on home + active workout + coachhint trigger.
- [ ] **Visual check of changed shared chrome** — screenshot coachhint, subbanner, a set row's target/RPE label, and the home consistency caption; confirm each matches intent and nothing adjacent shifted.
- [ ] **Touch-target / readability check** — measure the coachhint dismiss button hit area (≥44px effective) and confirm body-font `.setrow__target`/`.setrow__rpe-lbl` remain legible at their sizes; confirm softened borders keep sufficient contrast against their surfaces (accessibility).
- [ ] **Working-tree hygiene** — confirm the diff is CSS-only (plus the two font-family lines), no stray edits.

---

## 11. Risks and mitigations

**Visual design / usability / brand / accessibility lenses.**

- **Removing too many borders → lost structure.** *Mitigation:* Phase 1 removes/softens borders on **only the two aside boxes**, never on primary cards or set rows. Cards keep their borders until Phase 2 does them coherently.
- **App drifting soft/generic.** *Mitigation:* the asides keep a deliberate radius, spacing rhythm, and optional restrained brass tie anchored to the Phase A/C language — composed, not absent. Judged against "does this feel like a private coach," not "is it softer."
- **Breaking selected/focus/disabled states.** *Mitigation:* touched selectors (`.coachhint`, `.today-subbanner`, two set-row labels, one caption) have no interactive state except the dismiss button, which keeps a visible focus ring and hit area; explicitly checked in Section 10.
- **Reducing clarity of interactive elements.** *Mitigation:* no interactive element loses a border it needs — the dismiss button stays clearly a button; inputs and set-row controls are untouched.
- **Touching active-workout chrome too early.** *Mitigation:* the only active-workout touch is two `font-family` swaps, explicitly carved out by the approved brief; the set-row redesign, timer, and top bar are firmly Phase 3. Flagged as the one place Phase 1 lightly reaches into a Phase 3 component, typeface-only.
- **Inconsistency with the Phase C coach-note treatment.** *Mitigation:* the coachhint aside is designed to *relate* to the coach-note (shared calm surface, optional brass tie) but not *impersonate* it (no italic/quote form, which stays reserved for spoken coach notes). Approval Q3 settles whether to add the brass tie or stay neutral.
- **Uppercase change feeling arbitrary/partial.** *Mitigation:* Phase 1 deliberately softens only the one caption it owns and *documents* that the broader uppercase-density fix is Phase 3's, so the restraint is a stated decision, not an oversight.

---

## 12. Approval questions

1. **Aside border treatment** — for `.coachhint` and `.today-subbanner`, prefer (a) **drop the border entirely**, using a `--surface-2` fill + radius alone (softest, most "note set into the page"), or (b) **keep a hairline** at `--line-soft`/1px + radius (a touch more defined)? Recommendation: **(a)** for the coachhint, **(b)** for the subbanner (it marks a real plan change, so a whisper of edge is appropriate) — approve or override.
2. **Set-row mono removal** — confirm you want both `.setrow__target` and `.setrow__rpe-lbl` moved to body font in Phase 1 (the one place Phase 1 touches a set-row component, typeface-only), rather than deferring them to the Phase 3 set-row rebuild?
3. **Coachhint brass tie** — add a subtle brass tie (a thin `--accent` left rule or faint `--accent-tint` wash) to relate the aside to the coach voice, or keep it fully neutral graphite? Recommendation: **subtle brass left rule**, matching the coach-note family without copying its italic form.
4. **Uppercase scope** — approve limiting Phase 1 uppercase change to just `.consistency-label`, keeping all genuine section overlines and deferring the active-workout uppercase-density work to Phase 3? Or would you like a broader uppercase pass now?
5. **`.today-subbanner__label` tracking** — keep it uppercase (it marks a genuine "mode change") with tracking merely eased from `.12em`→`.08em`, or fully soften it like the consistency caption? Recommendation: **keep uppercase, ease tracking.**

No code will be written until these are answered and the plan is approved.
