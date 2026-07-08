# Visual System Audit & Design Direction Plan (Revision 2 — mockup north-star)

> **Status: plan only. No code has been written, no files edited.** This
> revises the original audit against an actual reference mockup the user
> supplied. Still a planning document — wait for review and approval
> before any visual implementation begins.

**Objective, unchanged:** make the app feel like a private, paid coaching
system — calm, premium, restrained — without weakening the simplicity and
coach-led clarity Product Polish Phase 1 just delivered. This revision adds
a real visual reference in place of adjectives, and goes further than a
token swap where the mockup shows the current app falling short.

---

## 1. Specialist skills used

- **Product design reasoning** — separating what the mockup implies about *finish level* from what it implies about *flow* (the brief is explicit these are different questions).
- **Visual design reasoning** — extracting concrete, reusable values (palette hexes, type scale, radius language) from the mockup rather than restating it as mood words.
- **Usability reasoning** — checking every mockup screen against whether its simplified concept-art version of a flow would actually work once real data (variable rep ranges, per-set weights, RPE) is dropped in.
- **UX writing** — auditing the mockup's copy register ("Bench Press is your anchor lift today," "Your week won't change. This is only for today.") against the app's existing coach voice.
- **Accessibility reasoning** — flagging every color pairing pulled from the mockup for a contrast check before it becomes a token.
- **Brand systems reasoning** — confirming the mockup's thumbprint/monogram/closing-mark usage matches the brief's own scoping rules (it does, closely).
- **Behaviour-preserving engineering** — the mockup shows at least one interaction (single "Complete set" button) that would, if copied literally, remove real logging functionality. Naming this explicitly is this skill's job in this revision.

---

## 2. Revised headline assessment

The original audit's core finding stands and the mockup confirms it rather than changing it: **the current app's dark neutrals were already directionally correct.** The mockup's own palette swatches — background `#0B0D0E`, muted text `#9D9A91` — are within a few points of the live app's `#14110D` and `#9C9287`. This is not a coincidence to second-guess; it's confirmation that the foundation doesn't need rebuilding.

What the mockup adds that words couldn't: **the current app still reads as "functional" mainly because of shape and density, not just color.** Four concrete gaps the mockup makes obvious that the original audit under-weighted:

1. **Corner radius and card geometry.** The live app uses a tight 5px radius and a distinctive 45°-clipped-corner primary button. The mockup uses generously rounded cards (~20px+) and fully rounded/pill buttons throughout. This is a bigger, more foundational change than a color swap, and it directly conflicts with the original plan's instinct to "protect the clipped-corner geometry." Flagged as a real judgement call (§9, J7) rather than decided here.
2. **Structured stat display.** The mockup never lets a number sit loose in a sentence — sets/reps/rest/RIR are always in their own bordered cell, exercise count/minutes/intensity are always in their own icon+label pill. The live app currently mixes this (some stats in bordered feet, some inline in prose). Consistency here is a real, adoptable, low-risk win.
3. **The coach note has a name and a color.** The mockup labels it literally: a small brass "COACH NOTE" overline sits above the note text, which itself reads in a distinct (implied italic/serif-adjacent) register. This is more resolved than the original plan's "give it a quiet typographic treatment" — the mockup proves a labeled overline reads as intentional, not like a stray sentence.
4. **Readiness options carry real functional color** (green check / amber clock / red-orange flag), which the original audit's judgement calls were too cautious about (§9, J2 in the original — see revised J-Readiness below). The mockup shows this is legible and calm, not alarming, when it's a small icon rather than a colored card background.

**How far to move:** go further than a token swap — radius, spacing, stat-cell structure, and the coach-note label are all real, phased, low-risk adoptions. Do **not** go as far as the mockup's photographic completion screen, single-tap set logging, or icon-per-settings-row — these either need assets/production the project doesn't have, or would remove real functionality. The practical definition of "closer without copying" is in §9, J6.

---

## 3. Visual gap analysis — current app vs. mockup vs. target

| Dimension | Current live app (verified) | Mockup north-star | Target for Fifth Digit Fitness |
|---|---|---|---|
| Background | `#14110D` | `#0B0D0E` | Keep current — near-identical, no change needed. |
| Surface | `#1C1915` | `#121414` | Keep current. |
| Raised surface | `#262119` | `#1B1E1F` | Keep current; adopt a real third elevation tier consistently (mockup uses it for stat cells and rows, not just cards). |
| Ink | `#F6F1EA` | `#F3F0E8` | Keep current — near-identical. |
| Muted ink | `#9C9287` | `#9D9A91` | Keep current — near-identical, validates the existing value. |
| Accent | `#FF4A1C` (vivid orange) | `#C79A43` (muted brass) | **Adopt the mockup's brass**, or something very close to it — see J1. |
| Success | `#26C281` | `#2ECC71` | Keep current (close enough; both read as a clean, unsaturated green). |
| Danger | `#FF6B52` (orange-leaning) | `#E05252` (true red) | Consider nudging toward a truer red — the mockup's danger reads as more clearly "stop," less "warm." Small, low-risk change. |
| Corner radius | 5px, sharp | ~20px on cards, pill buttons | **Move toward larger, softer radius** — see J7. This is the single biggest shape change in this revision. |
| Primary button shape | 45°-clipped corner | Plain rounded/pill | Judgement call, J7 — the clipped corner is an existing signature; the mockup doesn't have an equivalent one. |
| Stat display | Mixed: some inline prose, some bordered "foot" cells | Always a bordered stat cell, consistently | Adopt consistent stat-cell treatment. |
| Coach note | Plain paragraph, same style as any other text | Labeled brass "COACH NOTE" overline + distinct note styling | Adopt directly — this is the mockup's clearest, lowest-risk, highest-value contribution. |
| Readiness options | Neutral chips, no icon, no per-option color | Icon + color per option (green/amber/red-orange), full-width rows with description | Adopt the icon+color+description treatment — more resolved than the original plan's "keep neutral" stance. |
| Onboarding progress | None currently visible in the intro flow | 3-segment quiet progress dash | Adopt a small segment indicator for the (now 4-step) onboarding flow. |
| Home hero | Exercise list preview, no session-level note | Session-level coach note under the title ("Bench Press is your anchor lift today"), icon+label stat row, numbered overview list | Adopt the session-level note (reusing the anchor's own `.why`, no new copy) and the icon+stat row; keep the existing exercise-preview list structurally, restyle only. |
| Set logging | Per-set rows (Set/Prev/Kg/Reps + individual complete-circles), inline effort picker | Single "Complete set" button per exercise, no visible per-set weight/reps grid | **Do not adopt literally** — the mockup is illustrating a concept, not real per-set logging. See §7. |
| Session completion | Receipt-paper card + thumbprint stamp | Icon + "All set." + photographic model image + reassurance line | **Do not adopt the photography** — keep the existing receipt/thumbprint moment, borrow only the calm reassurance copy register. |
| Closing mark | Does not exist yet | "FIFTH DIGIT" tracked-out wordmark + "GENETICALLY DIFFERENT" tagline, centered, quiet | Adopt as specified, exact placement per J4. |
| Iconography | Near-zero icons | Small functional icons (lock, checkmark, clock, shield, person, chart) used consistently, never decoratively | Adopt a small, fixed icon set for genuinely functional spots (reassurance lock, readiness status, stat pills) — not a general icon pass. |

---

## 4. Screen-by-screen recommendations (revised against the mockup)

For each: current issue → what the mockup suggests → adopt → avoid → phase.

**First launch / onboarding**
- Issue: functional, plain input+button flow; no progress indication.
- Mockup: spacious single-question cards, quiet 3-segment progress dash, reassurance line with lock icon, rounded soft card and button.
- Adopt: progress dash (scaled to the real 4-step flow: name → how-it-works → safety → experience), lock-icon reassurance line under the safety step (copy already exists — "You can skip this and change it later" — just pair it with a small lock glyph), larger card radius.
- Avoid: don't add a progress dash to the "how it works" step if it breaks the existing name→greeting continuity; keep it to the two new Phase-1 steps where it adds real orientation.
- Phase: E.

**Safety and injury capture**
- Issue: functional textarea/chip pattern, correct copy, plain styling.
- Mockup: identical structure to what's already built (this is validating, not instructive) — pill-shaped category chips, brass selected state, lock reassurance line.
- Adopt: pill chip shape + brass selected state (direct token/shape reuse, no new component); lock icon next to the existing reassurance copy.
- Avoid: nothing to avoid here — the mockup's version of this screen is close to what Phase 1 already built.
- Phase: B (chip shape/color), E (icon).

**Experience capture**
- Issue: three small chips in a row; low visual weight for a decision that matters to prescription.
- Mockup: full-width radio-style cards with title + one-line description per option.
- Adopt: consider the fuller-width card-per-option treatment — it gives each level a real description slot ("New to training or returning after a break") which the current chip can't hold. This is a genuine, justified upgrade, not decoration.
- Avoid: don't invent new experience-level copy beyond what's already implied by existing Settings hint text; keep to one honest line per level.
- Phase: E.

**Home screen**
- Issue: good card hierarchy already; CTA color is the loudest thing on the screen; no session-level coach framing.
- Mockup: session-level coach note under the title, icon+label stat row (exercises/minutes/intensity), numbered overview list, brass rounded CTA.
- Adopt: session-level note reusing the anchor exercise's own `.why` string (no new copy — literally the same string already shown on the exercise card, promoted to also appear on the hero); icon+stat row restyle of the existing session metadata; brass CTA.
- Avoid: don't add the "+2 more exercises" chevron-per-row interaction unless it's trivial — the existing flat preview list is fine restyled, this isn't a required change.
- Phase: D.

**Build-a-week sheet / Just Today flow**
- Issue: functional, already fairly quiet (ink-only selected states); dense but workable.
- Mockup doesn't show this screen directly; direction is inferred from onboarding's card language.
- Adopt: pill/rounded chip and card shapes, brass primary CTA.
- Avoid: no new fields, no new steps.
- Phase: B/D.

**Scheduled readiness prompt**
- Issue: neutral chips, orange heading (reads as alert for a neutral question).
- Mockup: full-width rows, each with a small colored status icon (green check/amber clock/red-orange flag) and a one-line description, lock-icon reassurance ("Your week won't change. This is only for today").
- Adopt: this is a genuine upgrade over the original plan's "keep neutral" stance — full-width option rows with a small semantic icon and description read as *calmer and clearer*, not more alarming, because the color is small and functional rather than a full-card wash. Heading moves to plain ink.
- Avoid: don't color the whole row/card background — icon-only color, matching the mockup exactly, keeps this from feeling like a medical triage screen.
- Phase: E.

**Recovery swap**
- Issue: none functionally — the existing toast-with-undo is already good.
- Mockup: a fuller, multi-step confirmation ("You marked today as rough" → expected-contents checklist → recovery session detail → confirmation) with reassurance copy at each step.
- Adopt: the reassurance copy register only ("Your week stays intact," "This is only for today" — close variants of language already in the app). Consider whether a one-line "what to expect" checklist adds real value over the current single-toast pattern — likely a nice-to-have, not required.
- Avoid: do not replace the existing fast, single-toast-with-undo interaction with a multi-screen confirmation sequence — that would slow down exactly the moment (a tired user just wanting to start something) where speed matters most. The mockup's multi-step version is a marketing illustration of the concept, not a better interaction.
- Phase: E (copy/icon only, no flow change).

**Active workout screen / exercise cards**
- Issue: good structural bones (collapsed/expanded, one-exercise-at-a-time); stat info partly inline prose; Setup/Key/Fault bundled into one "Form notes" disclosure.
- Mockup: numbered badge + title, labeled brass "COACH NOTE" + note text, four-cell stat row (Sets/Reps/Rest/RIR Target), Setup/Key/Fault as three separate expandable rows.
- Adopt: labeled coach-note treatment (highest-value single change in this whole plan); bordered four-cell stat row; splitting Setup/Key/Fault into three rows instead of one bundled block (same content, already parsed into three fields today — purely a presentation change).
- Avoid: do not replace the per-set Set/Prev/Kg/Reps logging table with a single "Complete set" button — see §7 for why this is a hard line, not a style preference.
- Phase: C.

**Coach notes**
- Covered above; this is the plan's top-priority single item.
- Phase: C.

**Edit sets / swap panel**
- Issue: plain, correctly labeled post-Phase-1, functionally fine.
- Mockup doesn't show this panel's expanded state distinctly from the main card.
- Adopt: ambient token/shape cascade only.
- Avoid: no structural change.
- Phase: C.

**Set logging**
- Issue: none structural — inline effort picker and per-set rows are good and protected.
- Mockup: oversimplified (single button, no visible set-by-set entry).
- Adopt: nothing beyond ambient restyle (button shape/color, row spacing).
- Avoid: the single-button model — hard line, see §7.
- Phase: C.

**Rest timer**
- Issue: none — already calm and functional.
- Mockup doesn't show this screen.
- Adopt: ambient restyle only (progress fill color, shape).
- Phase: C.

**Session completion**
- Issue: already the most "branded" moment (receipt paper + thumbprint stamp) and genuinely good.
- Mockup: icon + "All set." + photographic model + reassurance line.
- Adopt: the reassurance-copy register and icon-based confirmation *tone*; add the closing mark here.
- Avoid: the photographic model image — needs real art direction/licensing this project doesn't have, and risks the exact "template mobile UI" / "marketing screen" look the brief warns against if done with generic stock photography.
- Phase: F.

**Settings / About**
- Issue: long undifferentiated scroll, reads as generic.
- Mockup's "Injuries & restrictions" sub-screen shows a cleaner single-purpose layout (back arrow + title + Save, textarea, chip row, entry list with delete icons) — closer to a focused editor than a long settings list.
- Adopt: section grouping (already recommended in the original audit); consider whether injury editing deserves its own focused screen instead of a Settings sub-section — flagged as a nice-to-have, not required, since it would technically be a new "screen" (see §9 risk note, this is the one place a flow-shaped question sneaks in and needs your explicit sign-off if pursued).
- Avoid: don't add icons to every settings row — reserve icons for the same short, functional list the mockup itself uses (lock, shield, person), not a generic icon-per-row pass.
- Phase: F.

**Empty states**
- Issue: none — already correct (quiet thumbprint watermark).
- Adopt: nothing beyond ambient token cascade.
- Phase: F.

**Loading / splash moments**
- Issue: none — already correct (monogram, brief, near-black).
- Adopt: nothing beyond ambient token cascade.
- Phase: F.

---

## 5. Design system recommendations (revised with concrete values from the mockup)

### 5.1 Colour
Adopt the mockup's palette essentially as proposed, since it validates rather than contradicts the current tokens:
```
--bg:        #14110D  (unchanged)
--surface:   #1C1915  (unchanged)
--surface-2: #262119  (unchanged)
--ink:       #F6F1EA  (unchanged)
--ink-dim:   #9C9287  (unchanged)
--accent:    #C79A43  (NEW — from mockup, see J1)
--ready:     #26C281  (unchanged)
--manage:    #E8A23D  (unchanged)
--danger:    #E05252  (shifted from #FF6B52 toward the mockup's truer red — small change, see gap table)
```
Every one of these needs a real contrast check against `--bg`/`--on-accent` before implementation (accessibility reasoning) — not solved by picking a swatch from an image.

### 5.2 Typography
The mockup supplies a real scale; adopt it directly rather than inventing one:
```
Display:   36 / 40   (session titles, onboarding headlines)
Heading 1: 24 / 32   (screen titles, exercise names)
Heading 2: 18 / 24   (card titles, sub-headers)
Body:      16 / 24   (prose, descriptions, coach notes)
Small:     13 / 20   (metadata, helper text)
Label:     11 / 16   (overlines, section labels — mono face, as today)
```
Keep Geist for Display/Heading/Body/Small, keep Spline Sans Mono for Label and all numeric/tabular values — this is a refinement of the existing pairing, not a replacement.

### 5.3 Spacing
Adopt more generous spacing specifically where the mockup shows it mattering most: onboarding, readiness, and home hero cards get noticeably more internal padding and gap-between-elements than the current build. Active workout density stays as-is — the mockup's own exercise-card padding is not dramatically larger than the live app's, confirming density there doesn't need to loosen.

### 5.4 Cards
- **Radius**: move from 5px toward a larger, softer radius (candidate: 16–20px for cards, 12–14px for buttons/chips) — see J7 for the tension this creates with the existing clipped-corner signature.
- **Primary session card**: adopt the session-level coach note and icon+stat row.
- **Exercise card**: adopt the four-cell stat row and the labeled coach note.
- **System/safety card** (readiness, build preview): adopt full-width icon+description rows for option sets (readiness specifically).
- **Recovery card**: keep the existing honest-copy approach; no colored wash.
- **Settings card**: group into sections; no per-row icons beyond the few functional ones already identified.
- **Empty-state card**: unchanged.

### 5.5 Buttons
Primary buttons move from clipped-corner/orange to rounded/brass — pending J7. Secondary/ghost/destructive keep their current relative treatment, restyled onto the new tokens and radius.

### 5.6 Chips
Pill-shaped (matching mockup), brass fill for selected state, ghost/outline for unselected. Applies uniformly to injury category chips, experience options (if kept as chips rather than upgraded to cards), and equipment chips.

### 5.7 Coach notes
Adopt the mockup's exact pattern: a small brass, tracked-out "COACH NOTE" label above the note text, note text in a visually distinct (e.g. italic or slightly different color weight) register from ordinary body copy. This is the single highest-value visual change in the whole plan — it's cheap, low-risk, purely presentational, and directly answers "does this feel like the coach speaking."

### 5.8 Active workout hierarchy
Stat row becomes four consistent bordered cells (Sets/Reps/Rest/RIR or Target, matching whatever fields are real for that exercise type). Setup/Key/Fault become three separate rows instead of one bundled disclosure. Logging mechanics (per-set rows, inline effort picker, rest timer) are unchanged in function — only their color/shape/radius cascade from the new tokens.

### 5.9 Branding
Unchanged scoping from the original plan (thumbprint/monogram exactly as specified). The closing mark's exact treatment is now known precisely from the mockup: `FIFTH DIGIT` as a small tracked-out wordmark, `GENETICALLY DIFFERENT` as a smaller line beneath in a muted/brass tone, centered, standalone — adopt this exact typographic treatment.

### 5.10 Motion
Unchanged from the original plan — controlled, fast, no bounce, no celebration animation. The mockup is static and doesn't contradict this.

---

## 6. What to adopt from the mockup

- Palette values (validating existing tokens + the brass accent).
- Explicit type scale (six sizes, both faces retained).
- Labeled "COACH NOTE" overline treatment.
- Four-cell stat display for prescription data.
- Setup/Key/Fault as three separate rows.
- Icon+color+description treatment for readiness options.
- Session-level coach note on the home hero (reusing existing `.why` data).
- Quiet segmented progress indicator for onboarding.
- Larger, softer card/button radius (pending J7).
- Closing-mark exact typographic treatment.
- A small, fixed, functional icon set (lock, check, clock, flag/warning) used only where it adds real meaning.

## 7. What NOT to copy from the mockup

- **Single "Complete set" button replacing per-set logging.** The mockup shows one tap per exercise; the real app must let a user enter/adjust weight and reps per set, mark each set individually, and log effort — this is core, protected functionality (Product Polish Phase 1 explicitly protects "inline effort logging"). The mockup's simplified button is a concept illustration, not a literal target.
- **Photographic model imagery on session completion.** Needs real art direction and licensing the project doesn't have; generic stock photography risks the exact "template mobile UI" look the brief warns against. Keep the existing receipt/thumbprint moment.
- **Multi-screen rough-day confirmation sequence.** The current single-toast-with-undo is faster and already trust-building; don't slow down the recovery-swap moment to match the mockup's marketing-illustration pacing.
- **Icon-per-row settings treatment**, if taken further than the mockup's own restrained use (it only icons a handful of meaningfully distinct concepts, not every row).
- **Any new screen or flow implied but not explicit** — e.g., a dedicated full-screen injury editor is *implied* by the mockup's "Injuries & restrictions" screen but is not required; treat it as an optional, separately-approved idea (§9), not an assumed adoption.

## 8. What must not change technically or behaviourally

Unchanged from the original plan, restated for this revision: coach-span logic (selection, prescription, progression, safety filtering, anchors, readiness decision logic, recovery-session content, balance, fatigue, the Phase 8 dogfood/rubric harness); every Product Polish Phase 1 mechanism (safety-first onboarding order, simplified injury entry's data model, type-aware edit/swap label logic, which exercise gets a coach note, the readiness-prompt trigger and Rough-swap mechanism, block-specific counter logic, "Build it anyway," confirm-before-commit previews, inline effort logging, the rest timer). No AI/LLM features, no dashboards, no streaks/gamification/achievements/leaderboards/social, no new programme or training logic, no new onboarding requirements beyond what's already live, no new settings beyond what's explicitly called out here for approval.

---

## 9. Judgement calls and recommendations

**J1 — Exact brass token.** Recommend adopting the mockup's own value, `#C79A43`, as `--accent`, with `#D6AE5F` available as a lighter/hover variant if contrast testing shows the base brass needs a lighter step for small text or thin strokes. Needs a real contrast check at implementation time (Phase A), not approval of the number in the abstract.

**J2 — Set-completion colour.** Recommend keeping green (unchanged from the original plan) — the mockup's own readiness screen uses green specifically for "Good," reinforcing that green means "positive status," which a completed set legitimately is. Brass stays reserved for brand/action emphasis, not status.

**J3 — Week-dot-strip.** The mockup doesn't show this exact element, but it does show a much quieter progress convention (a 3-segment dash for onboarding steps). Recommend replacing the current 13-dot strip with either a similarly quiet segmented bar or a plain textual treatment ("Week 1 of 4"), whichever reads more calmly once built — this is a Phase D implementation-time choice, not something to lock in blind here.

**J4 — Closing mark placement.** Confirmed from the mockup's own bottom-of-page treatment: standalone, centered, small, appearing once. Recommend Settings/About and session completion only, exactly as the mockup itself demonstrates (it doesn't show the mark on every screen — it shows it once, as a colophon). Needs your confirmation only on whether it also replaces or sits beside the existing Settings monogram (unresolved from the original plan, still open).

**J5 — Per-block card differentiation.** Unchanged recommendation: skip. The mockup doesn't show per-block color-coding either — it reinforces that structure should come from labels and typography, not decoration.

**J6 — How far to move toward the mockup.** Recommend defining "closer" as: **adopt every value and pattern in §6, reject everything in §7, treat everything else as a Phase-by-Phase implementation-time decision verified live against this document.** Concretely, this means the app should end this project with the mockup's palette, type scale, coach-note treatment, stat-cell structure, and radius language — but with its own real logging mechanics, its own receipt-based completion moment (no stock photography), and no flow it didn't already have.

**J7 — Card/button radius and the clipped-corner signature (new).** This is the one place the mockup meaningfully disagrees with the original plan. The original plan recommended protecting the 45°-clipped-corner CTA as an existing brand signature; the mockup uses plain rounded/pill shapes throughout and shows no equivalent geometric signature. Two honest options:
  - **Option A (recommended):** adopt the mockup's larger, softer radius across cards and buttons, including the primary CTA — this is what most directly delivers "less default-looking UI" and "calmer, larger cards," and the clipped corner, however distinctive, reads closer to the "industrial/edgy" register than the "quiet private coaching system" register the brief asks for.
  - **Option B:** keep the clipped corner on the primary CTA specifically (as the one deliberate geometric signature) while adopting the softer, larger radius everywhere else (cards, secondary buttons, chips). This preserves one piece of existing brand geometry without inheriting the mockup's shape wholesale.
  Needs your decision before Phase A, since it's a global token (`--radius`) plus one component-level exception if Option B is chosen.

---

## 10. Revised implementation phases

- **Phase A — Tokens and global surface system.** Brass accent (J1), danger-red nudge, radius decision (J7), contrast-check the full palette. No component-level changes yet. Live-verify every screen for legibility.
- **Phase B — Card system, spacing, and typography.** Apply the six-step type scale; apply new card/button/chip radius and padding globally; pill-shape all chips. Live-verify Build-a-week, Just Today, and Settings still read correctly at the new density.
- **Phase C — Coach-note treatment and active workout hierarchy.** Labeled "COACH NOTE" overline; four-cell stat row; split Setup/Key/Fault into three rows. Explicitly do NOT touch per-set logging rows, the effort picker, or the rest timer's function — restyle only. Live-verify logging speed is unaffected.
- **Phase D — Home/session preview polish.** Session-level coach note (reusing the anchor's `.why`), icon+stat row, resolve the week-dot-strip (J3), radius/token cascade on hero and week-list cards. Live-verify the full build→home→start flow.
- **Phase E — Onboarding, readiness, and recovery polish.** Progress dash on the two new Phase-1 steps, lock-icon reassurance lines, experience-capture card upgrade (if approved), readiness icon+color+description rows. Live-verify the full onboarding and readiness-prompt flows, including Rough → recovery swap.
- **Phase F — Branding moments, Settings/About, and empty states.** Closing mark (J4) on Settings/About and session completion; Settings section grouping; confirm empty states need no change beyond token cascade.
- **Phase G — Final visual QA.** Full pass across every screen in §4's table against this document; contrast-check the whole palette in situ; confirm zero coach-span diff; confirm the two hard "do not copy" lines (§7) were actually respected in the diff, not just in intent.

---

## 11. Risks

- **Radius/shape change (J7) is the largest single visual shift in this plan** — larger than the color swap — and touches every card and button in the app. It should be verified live on real content (not just a few screens) before Phase B is considered done, since a radius that looks right on a small chip can look wrong on a full-width session card.
- **Session-level coach note (Phase D)** reuses existing `.why` data, but needs a UI-layer decision about what to show when the anchor's own why is generic (unchanged from Phase 1's existing suppression rule) — confirm this composes cleanly rather than leaving the new hero slot sometimes empty in a way that looks broken rather than intentional.
- **Settings "Injuries & restrictions" as its own focused screen** (implied, not required, by the mockup) is the one place a flow-shaped question could sneak in under the cover of a visual pass — explicitly gated behind your separate approval if pursued (see §7, last bullet).
- **Icon adoption**, even the small functional set proposed, is new surface area (new assets, new accessibility labels) that wasn't in the original plan — small risk, but real, and worth a dedicated live check in Phase E/F rather than assuming icons "just work" visually.

## 12. Approval questions before implementation

1. **J1** — approve `#C79A43` as the working brass value, pending contrast check?
2. **J2** — confirm green stays for set completion (unchanged recommendation)?
3. **J3** — approve replacing the week-dot-strip with a quieter segmented or textual treatment, decided concretely in Phase D?
4. **J4** — closing mark sits beside/below the existing Settings monogram, or replaces it?
5. **J6** — approve the "adopt §6 / reject §7 / everything else decided live per phase" definition of "closer to the mockup"?
6. **J7** — Option A (fully adopt the mockup's soft rounded geometry, including the primary CTA) or Option B (keep the clipped corner on the primary CTA only, soften everything else)?
7. Separately: is a dedicated full-screen injury editor (implied by the mockup, not required) something you want scoped now, or left out entirely?

No code has been written. Awaiting your answers to the seven questions above before Phase A begins.
