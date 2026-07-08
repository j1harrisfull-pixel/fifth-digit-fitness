# Product Feel Audit — Fifth Digit Fitness

**Status:** Read-only audit. No code changed. Visual phase sequence (Phase D shipped, Phase E onward) is paused pending review of this document.

**Trigger:** the Phase C/D active-workout screenshot made a broader concern visible — the app may still read as a technical checklist / control-room tool rather than a paid private-coaching product, across more than one screen. This audit investigates that claim directly against the current code (not just the screenshot), screen by screen.

---

## 1. Executive summary

**The visual language is partly wrong, not just under-polished.** Phases A–D correctly fixed the things they targeted (accent color, radius, card hierarchy, type scale, coach-note treatment, home hierarchy) — those changes should stay. But they operated on top of an underlying structural language that was designed, in earlier phases (the "reskin: BUILD-SPEC dark palette" / "zero corner radius everywhere" / "tactical" phases from before this session's Visual System work began), around a **military/tactical-instrument aesthetic**: hard-bordered boxes, uppercase tracked-out labels on everything, monospace creeping into structural chrome (not just numbers), a warning-triangle icon reused for neutral coaching moments, and a visible-but-uncredited grid texture. That language was a deliberate choice at the time (the "BUILD-SPEC" reskin, "zero corner radius everywhere," LIVE/timer bars) — it was never designed to say "premium private coach." It was designed to say "purpose-built training tool," which is a different, harder-edged brand.

Token-level polish (Phase A: `--accent`, `--radius`) softened the surface of this without changing its grammar. The set-row is still a bordered grid cell. The rest timer is still a bordered console. The help box is still a hard-cornered notice board with a warning-adjacent border weight. Phase B/C's spacing and coach-note work are the right direction and should continue — they just haven't yet reached the load-bearing chrome (livebar, set rows, rest timer, help/coachhint boxes, confirm-style dialogs).

**This needs a broader visual reset of the active-workout chrome specifically**, plus a lighter pass everywhere else. It is not a full rewrite: the underlying structure (one-exercise focus, sticky log bar, per-set rows, rest timer, block sections) is sound and should be preserved. What needs to change is the *material* those structures are rendered in — border-first → surface-first, uppercase-everywhere → selective emphasis, alert iconography → coaching iconography, mono-for-labels → mono-for-numbers-only.

---

## 2. Specialist skills used

- **Product design reasoning** — Section 1 (is this worth paying for), Section 4 (cross-app pattern diagnosis), Section 8 (phase sequencing) — judging whether each screen serves the athlete's actual goal in the moment, and whether the product coheres as one thing.
- **Usability reasoning** — Section 3 (per-screen "what does a real user hesitate on"), Section 6 (checklist-row analysis) — cognitive load, density, cognitive read of "what do I do right now."
- **Visual design reasoning** — Section 5 (cross-pattern diagnosis: borders, grid, mono, uppercase, density) — grounded directly in the CSS (border/typography/color audit below), not vibes.
- **UX writing reasoning** — used inside Section 3 for labels like "WARM-UP," "STRENGTH," "How are you feeling today?", the coachhint copy, confirm-dialog reuse — judging whether the words plus their container read as coaching or as system output.
- **Brand systems reasoning** — Section 1, Section 6 — measured against the standing brand memory (quiet confidence, discoverable-not-pitched story, no-accent-except-thumbprint rule, genetically-different close only at real closing moments) to judge whether the in-session chrome matches the same restraint the marketing site already has.
- **Accessibility reasoning** — folded into Section 3/6 — contrast and touch-target size were checked directly against the token values (below), not assumed.
- **Behaviour-preserving engineering reasoning** — Section 7/9 — used only to scope what's safe to re-skin without touching `/*__COACH_START__*/.../*__COACH_END__*/` or any data shape; never used to justify a design call.

---

## 3. Cross-app pattern diagnosis (grounded in code)

Read directly from `index.html`, not inferred from the screenshot alone:

| Pattern | Evidence | Verdict |
|---|---|---|
| **Grid background** | `--grid: rgba(255,235,214,.022)` — a 2.2%-opacity dot/line grid, masked to fade out after ~40% of the viewport (`index.html:98-100`) | **Not the main culprit.** It's genuinely faint. It reads as "blueprint" mainly *because* everything sitting on top of it is hard-bordered — the combination, not the grid alone, creates the control-room feel. Worth keeping at this opacity or slightly softer, but not worth spending a phase on in isolation. |
| **Hard borders** | 40+ instances of `border: 1px solid var(--line/--line-strong)` across cards, set rows, chips, the rest timer, the coachhint box, the livebar-end button, swap chips. Almost everything is an outlined box. | **Primary culprit.** This is a wireframe/spec-sheet grammar: every unit of content gets a rectangle. A premium surface differentiates through fill and elevation (`--surface` vs `--surface-2` vs `--surface-3`), not through outlining every element. |
| **Monospace usage** | `.mono` is applied to ~19 elements. The good news: almost all of them are genuinely numeric (weights, reps, timers, stat values, PR deltas) — this is correct, intentional use of tabular figures. Two exceptions lean structural: `.setrow__target` and `.setrow__rpe-lbl` set `font-family: "Spline Sans Mono"` directly (not via `.mono`) on text labels ("RPE", target strings), and `.livebar__label`/`.phasehead__min` sit right next to mono numbers so the whole bar *reads* monospace even though only half of it is. | **Partial culprit.** Numeric mono is correct and should stay (this is good tabular-nums practice, not a fault). The label-level mono creep (RPE tag, set target line) is what tips isolated numeric precision into "everything is a terminal." |
| **Uppercase section labels** | 35 instances of `text-transform: uppercase`, almost always paired with `letter-spacing: .08–.14em` and small size (10-11px). Includes `WARM-UP`/`STRENGTH` block headers, `LIVE`/timer bar label, `Est. 1RM` stat labels, `LAST 14 DAYS` (just added in Phase D), set-count labels. | **Real, but double-edged.** Used *sparingly* as section overlines this reads editorial (this is what fashion/editorial brands do). Used as densely as it currently is — on block headers AND the top status bar AND stat labels AND the new consistency caption, all at once, on one screen — it reads as military/diagnostic signage instead. The technique isn't wrong; the frequency is. |
| **Checklist-row structure** | `.setrow` is `display:grid` with a fixed column template (`24px 54px 88px minmax(0,1fr) 44px`), a hard border, 52px min-height, and a dashed-border input for weight (`border: 1px dashed var(--line-strong)`) that only turns solid when overridden. | **Real culprit.** Grid-of-cells + dashed placeholder border is literally admin-form styling (it's the same visual grammar as an editable spreadsheet cell). This is the single strongest "checklist, not coaching" signal in the app. |
| **Help/coachhint box** | `.coachhint` (the RPE/Est.1RM explainer) has `border: 1px solid var(--line-strong)` and — distinctively — **no `border-radius` at all**, meaning it is the one surface in the entire app still rendering with hard square corners after the Phase A radius rollout. Its dismiss button is a plain bordered rectangle ("Got it"). | **Real, and concrete.** This literally missed the Phase A token pass — it is visually a system notice, not a coaching aside, and it's the sharpest-cornered box on the screen precisely because it was never touched. |
| **Rest timer** | `.resttimer` is a fixed-position bordered card (`border: 1px solid var(--line-strong)`) with its own inner bordered progress track (`border: 1px solid var(--line)`), an uppercase uppercase label, and a bordered "Skip" button. Functionally excellent (Wake Lock, persistence, ±15s adjust — all real, all worth keeping) but visually it's a full console: border-within-border-within-fixed-bar. | **Real.** The timer earns its dominance (it IS the thing you're waiting on), but a console built from three nested borders reads more "device" than "coach standing next to you." |
| **Warning iconography misapplied** | The readiness-prompt dialog (`#readinessPromptSheet`) reuses `#readinessPromptTitle` styled as `.confirm__title`, and — more concretely than previously logged — **the same dialog markup pattern for destructive confirms (`#confirmSheet`) renders a literal warning-triangle-with-exclamation-mark SVG** (`<path d="M12 9v4M12 17h.01M10.29 3.86...`) next to the title. "How are you feeling today?" inherits this pattern's styling context (red title), even though its own markup (`index.html:1329`) doesn't render the icon itself — the color alone is the current cross-contamination, but it comes from the same confirm-dialog family that was built for "Are you sure you want to erase your data?" This is a bigger tonal collision than "a stray CSS class" — it's an entire dialog *pattern* built for alarm being reused for calm check-ins. | **Real, already logged, worse than previously scoped.** VISUAL-DEBT-REGISTER item #1 undersold this — it's not just a color inheritance, it's borrowing the destructive-action dialog family wholesale. |
| **Density / breathing room** | Set rows are 52px tall with 4px vertical padding and an 8px column gap; `.phasehead` gives blocks 26px top padding (already improved in Phase B for the home hero, not for the workout screen's block headers... actually shared token, `.phasehead` IS shared — confirmed it does apply here too). Block sections do have real air now. The density problem is concentrated *inside* each set row and inside the coachhint box, not at the section level. | **Localized, not global.** Phase B's spacing work already helped section-level rhythm. The remaining density problem is component-internal (set row, help box), not page rhythm. |
| **Brand moments** | Monogram in header (crossfades to wordmark on scroll — already shipped), thumbprint reserved for footer/completion per the No-Accent Rule, boot splash. These are quiet and correctly restrained — genuinely good, protect them. | **Working correctly**, not part of the problem. |
| **Color meaning (semantic misuse)** | `--danger`/red used correctly for erase/destructive confirms; incorrectly inherited by the readiness check-in (logged above); `--ready` green used correctly only for completion states (sets done, week done, trained days) — confirmed no accidental use elsewhere. | **One real defect** (readiness prompt), otherwise disciplined. |

---

## 4. Screen-by-screen classification

Classification key: **(1)** Premium private coach · **(2)** Acceptable but functional · **(3)** Too technical/checklist-like · **(4)** Visually off-brand · **(5)** Needs redesign treatment.

| Screen/flow | Class | Main issue | What to protect | Intervention | Phase |
|---|---|---|---|---|---|
| **Onboarding — name** | 2 | Fine: warm copy ("Let's make this yours," "Stays on your phone. Always."), generous space, monogram present. Minor: `.intro__go`/`.btn--primary` still uses the same clipped-CTA/system button family everywhere — acceptable here. | Copy tone, monogram placement, pacing (one question per step) | Light polish | Phase 5/6 (polish only) |
| **Onboarding — how it works** | 2 | Plain bulleted list (`<ul><li><b>Build a week:</b>...`) — functional, slightly manual-like, but brief and skippable-adjacent (not skippable itself, only 1 continue tap) so low cost. | The 3-bullet brevity — don't expand this into more content | Light polish (typographic rhythm only) | Phase 5/6 |
| **Injury/safety capture** | 2 | Plain input + chip row + Add button — correctly minimal (J8 already ruled out a dedicated injury-editor screen). Chips styled as `.chip` (softly bordered pill) — fine. | The single-field simplicity — this is already the right scope | Light polish | Phase 5 |
| **Experience capture** | 2 | Same chip pattern, clean, three options, optional framing ("Optional — change it anytime") is good coaching tone. | Chip pattern, optional framing | Light polish | Phase 5 |
| **Home screen (post Phase D)** | 1→2 | Already meaningfully improved this session: quiet greeting, dominant session title, muted consistency strip. Remaining: `.today-card` still carries a `border: 1px solid var(--line-strong)` — a visible outline around the one card that's supposed to feel like a considered hero, not a bordered box. | Hierarchy work from Phase B/D, quiet greeting, quiet consistency strip | Light polish (drop or soften the hero border, lean on `--surface-3` elevation alone) | Phase 2 (global card language) |
| **Build-a-week sheet** | 2 | Functional bottom sheet, chip-grid controls (goal/days/equipment) — chips read fine as selectable pills, not checklist rows. Disclosure triangles (▸/▾) for "Training days"/"Adjust" are slightly utilitarian but standard and low-risk. | Chip selection pattern, disclosure-triangle progressive disclosure (keeps the sheet short) | Light polish | Phase 6 |
| **Just Today flow** | 2 | Same sheet family as build-a-week; the free-text "what do you want to train today" box is a good, human, non-checklist touch — protect it. | Free-text intent box, readiness chips reuse | Light polish | Phase 6 |
| **Scheduled readiness prompt** | 4 | **Off-brand.** Inherits the destructive-confirm dialog family (`.confirm__title` = `--danger` red) for a neutral, even warm, daily check-in ("How are you feeling today?"). This is the single clearest color-meaning violation in the app — already logged as visual debt, confirmed here as more structurally rooted than a stray class. | The 3-chip Rough/So-so/Great pattern, the reassuring hint copy underneath, Skip option | Medium redesign (new dialog treatment, not shared with destructive confirms) | Phase 5 (was already slated — do not defer further) |
| **Recovery swap** | 2 | Reuses the Just Today sheet with a "Substituting · this replaces the plan" notice box — the notice box itself uses the same hard-bordered pattern as the coachhint box (see below), so it inherits that issue but isn't unique to this flow. | The clear "this replaces X, recorded as an alternate" transparency copy — excellent, keep verbatim | Light polish (shares fix with coachhint) | Phase 1 |
| **Live workout overview (top bar)** | 3 | The `LIVE`/session-timer bar: uppercase uppercase mono-adjacent label, hard `border-bottom`, bordered "End" button. This is the first thing visible when a session starts and it reads instrument-panel, not "your coach is with you." | Elapsed-timer accuracy, sticky positioning, End-button confirm-before-commit safety | Medium redesign | Phase 3 |
| **Active exercise card** | 3 | This is the screen the original screenshot exposed. Coach-note treatment (Phase C) is good and should stay. But: block header (`WARM-UP`/`STRENGTH`, uppercase overline) + 3-cell stat row (bordered pill-like boxes) + set-row grid below combine into a dense, bordered, spec-sheet read. | Coach-note italic+brass-rule treatment (Phase C), stat-row information (Sets/Reps/Rest), exercise naming/cueing | Heavy redesign (structural — this is the room the audit is most worried about) | Phase 3 |
| **Set logging (set rows)** | 3 | **Worst offender.** Grid-cell layout, per-row hard border, dashed-border weight input (spreadsheet-cell grammar), mono labels on non-numeric text (`RPE`, target string). This is where "checklist" is most literal — it *is* a data-entry grid. | The information architecture (set N / prev / weight / reps / RPE-on-completion) and the interaction model (tap to log, nudge weight) — these work, don't change the mechanics | Heavy redesign (visual only — same data, same taps, different material) | Phase 3 |
| **Rest timer** | 3 | Triple-nested border (card → track → fill), uppercase label, bordered skip button. Functionally excellent (persistence, Wake Lock, vibration, ±15s) — none of that is at risk, this is purely "does it look like a countdown console or a coach's cue." | All timer mechanics and persistence behaviour | Medium redesign | Phase 3 |
| **Help/coachhint box (RPE/Est.1RM explainer)** | 4 | **Off-brand outright** — the one surface with zero corner radius, reading as a system notice board, not a coaching aside. Concrete, easy, high-leverage fix. | The explanation content itself (accurate, useful, dismissible-once) | Light-medium polish (give it radius + a calmer border/fill treatment — small, contained fix) | Phase 1 |
| **Session completion** | 2 | Not audited in as much depth this pass (cream receipt + thumbprint stamp shipped earlier and is on-brand per memory), but it likely shares the bordered-card language for its stat rows (`.recap-stats`) — same family as the home-hero recap. Needs a quick visual confirm, not a structural rethink. | Cream/thumbprint moment, per-exercise honest recap | Light polish | Phase 4 |
| **Settings/About** | 2 | Not deeply inspected this pass; Settings historically houses the equipment/injury/experience editors reusing the same chip and card patterns audited above — inherits their issues, doesn't add new ones. | Backup/restore safety copy, quiet monogram sign-off | Light polish | Phase 6 |
| **Empty states** | 2 | "No sessions yet" / "Tap Build up top to build your week" — plain, honest, unadorned, thumbprint watermark at ~7% opacity in the background. This is already close to the right restrained tone. | Thumbprint watermark restraint, plain honest copy | Light polish only | Phase 6 |
| **Loading/splash** | 1 | Boot splash (monogram on near-black, ~400ms, first-launch only) — already reads as a considered brand moment, not a loading spinner. | As-is | None needed | — |

---

## 5. What is already working (protect, do not touch structurally)

- Dark graphite base + warm-ivory ink (`--bg`/`--ink` pairing) — the palette itself is right, this was never the problem.
- Muted brass accent (`--accent: #C79A43`) from Visual Phase A — correct value, correct restraint (used for CTAs/emphasis, not decoration).
- Softened radius token (10px) from Phase A — correct direction; the remaining border problem is about *whether* to border, not the radius of the border.
- Clipped-corner primary CTAs (`clip-path` on `.btn--primary`/`.today-card__cta`) — still a legitimate, deliberate signature per the J7 hybrid call; nothing in this audit contradicts that decision.
- Coach-note italic + brass-rule treatment (Phase C) — genuinely reads as a coach's voice, not a system label. This is the template for how the rest of the workout screen should feel.
- Block-scoped counters, per-set logging mechanics, effort picker, conditioning swap, undo-backed recovery substitution — all functionally sound; nothing here proposes touching them.
- Quiet greeting + dominant session title hierarchy (Phase D) — correct direction for the whole app, not just home.
- Brand restraint: monogram crossfade, thumbprint reserved for footer/completion, no-accent-rule discipline, quiet empty states. This is where Fifth Digit's actual brand discipline already lives in the UI — the goal of the next phases is to extend this same restraint into the workout screen, not invent a new brand.

---

## 6. What must change (name the shifts precisely)

1. **From border-first to surface-first hierarchy.** Cards, set rows, stat cells, and the help box should differentiate through fill/elevation (`--surface` → `--surface-2` → `--surface-3`) the way `.today-card` already does relative to the page background, rather than every unit getting its own 1px outline. Borders should become the exception (used for interactive affordance — an input, a toggle state) rather than the default container treatment.
2. **From checklist grid-rows to a guided set view.** The set row's spreadsheet-cell grammar (fixed grid columns + hard border + dashed placeholder input) is the single highest-priority structural change. It doesn't need to lose any information (set number, prev, weight, reps, RPE-on-completion all stay) — it needs a layout that doesn't read as a form grid.
3. **From alarm-pattern dialogs to coaching dialogs.** The readiness prompt must stop inheriting the destructive-confirm family. This needs its own visual identity: neutral/warm heading color, no warning iconography inheritance, still using the same 3-chip Rough/So-so/Great interaction.
4. **From console-style rest timer to a coach's cue.** Keep every mechanic (persistence, Wake Lock, ±15s, vibration); remove the nested-border stacking so it reads as one calm surface with a progress indicator, not an instrument cluster.
5. **From dense uppercase-everywhere to selective emphasis.** Keep uppercase overlines for genuine section changes (block headers like "Strength," "Warm-up") since that's an editorial, not military, convention when used sparingly — but stop pairing it with mono-adjacent labels in the same bar (livebar) and stop applying it to secondary captions that don't need the same visual weight (e.g., the new "Last 14 days" caption from Phase D could be small-caps-free and still read as quiet).
6. **From a hard-cornered "notice" to a coaching aside.** The `.coachhint` box needs the same radius/surface treatment as every other card — this alone will materially soften its "warning label" read for near-zero risk (it's isolated, one class, no logic).
7. **From label-mono creep to numeric-only mono.** Two spots (`.setrow__target`, `.setrow__rpe-lbl`) apply monospace to words, not numbers. Moving these to the body font is a small, safe, high-signal fix — mono should mean "this is a measured quantity," not "this is a technical label."

---

## 7. Revised implementation strategy

**A. Global visual-language changes** (small number of shared tokens/classes, touch many screens at once):
- Introduce a "quiet surface" pattern (background-differentiated, border removed or reduced to `--line-soft` at low opacity) to replace the default bordered-card look everywhere it isn't already using `--surface-3` elevation.
- Rebalance uppercase usage: keep for true section overlines, drop for secondary captions and stat labels where weight/scale can carry the hierarchy instead.
- Confine `.mono` strictly to numeric/tabular content; move the two label exceptions to `--font-body`.

**B. Core component redesigns** (used across multiple screens, need real design work, not token swaps):
- Set row (grid-cell → guided row).
- Help/coaching-aside box pattern (used for coachhint now, reusable for future coaching asides).
- Dialog family split: destructive-confirm pattern stays as-is (it should feel serious); a new neutral/coaching-dialog pattern for readiness and any future check-ins.

**C. Screens needing redesign treatment** (structural, not just token application):
- Active workout: live/session top bar, exercise card assembly, set-row area, rest timer. This is one coherent screen and should be redesigned as a set, not piecemeal, so the block header / coach-note / stat row / set rows / rest timer all agree with each other visually.

**D. Screens needing only polish:**
- Onboarding (all steps), injury/experience capture, build-a-week & Just Today sheets, Settings, empty states, session completion, home screen border removal.

**E. Brand moments:**
- No new brand moments proposed. Existing ones (monogram crossfade, thumbprint restraint, boot splash) are correct and untouched.

**F. Things to protect (explicit, non-negotiable across every phase below):**
- Coaching engine, selection, prescription, progression, anchors, injury filtering, readiness/recovery logic, build-a-week/Just Today logic, per-set logging, effort picker, rest-timer mechanics, exercise editing, conditioning swap, block-scoped counters, coach-note concept, undo-backed substitution, session-completion recap — all logic, all data shapes, all `__COACH__`-span code untouched in every phase below. Every phase is a re-skin of markup/CSS (plus, where noted, small presentational class changes), never a rewrite of behavior.

---

## 8. Proposed new phase plan

The existing Phase E ("onboarding/readiness/recovery polish") is not wrong, but it's in the wrong position — it treats the readiness-prompt color bug as a small fix when it's actually part of a bigger "dialog family" problem, and it would leave the active-workout screen (the screen that triggered this whole audit) untouched for two more phases. Proposed reordering:

- **Phase 1 — De-technical-ize shared chrome** (global, low-risk, highest leverage-per-effort): quiet-surface pattern for cards/boxes, fix `.coachhint` radius+border, fix the two mono-label exceptions, rebalance uppercase density on shared components (livebar, phasehead, stat labels). Touches every screen a little; breaks nothing structurally.
- **Phase 2 — Core card/list-row language**: apply the quiet-surface pattern everywhere a bordered card currently appears outside the workout screen (home hero border removal, week-list rows, settings rows, history rows). Establishes the "surface-first" grammar the rest of the plan depends on.
- **Phase 3 — Active workout redesign treatment** (the heavy lift, and the one the screenshot was actually about): live/session top bar, exercise-card assembly, set-row redesign, rest-timer redesign. Done as one coherent pass so the screen agrees with itself.
- **Phase 4 — Session completion + recap surfaces**: confirm the cream/thumbprint receipt and recap stat rows inherit the new surface language cleanly.
- **Phase 5 — Readiness/recovery dialog redesign**: the new neutral-coaching dialog pattern (fixes the readiness-prompt color/iconography inheritance at its root, rather than patching `.confirm__title`), applied to readiness prompt and recovery-swap notice box.
- **Phase 6 — Onboarding, build sheets, Settings, empty states**: light polish pass, applying the Phase 1/2 language, no structural change — these screens are already close.
- **Phase 7 — Final product QA**: full click-through as a paying user, contrast/touch-target accessibility recheck, regression + coach-span diff, single completion report.

This reordering front-loads the two phases (1, 3) that most directly address "does this feel like a control room," rather than spending two more phases polishing already-acceptable screens before touching the one that prompted the audit.

---

## 9. Risks and tradeoffs

- **Changing too much at once**: Phase 3 (active workout) is the highest-risk phase because it touches the busiest screen with the most interactive elements (set rows, timer, swap, edit-sets). Mitigate by doing it as its own phase with its own live-verification pass and regression run, not folded into a broader sweep.
- **Losing app identity**: the brass/clipped-CTA/monogram identity is not what's being changed — only the bordered/mono/uppercase-heavy chrome around it. Risk is low if Section 5's "protect" list is honored strictly.
- **Reducing workout-logging speed**: the set-row redesign must not add taps, add confirmation steps, or shrink touch targets below the existing 44-52px minimums. This should be validated explicitly during Phase 3 live-verification, not assumed from a screenshot.
- **Making the app generic**: removing borders and mono labels risks sliding toward a generic "soft SaaS card" look if done without a point of view. The mockup's calmer-graphite-plus-brass direction (already adopted for tokens in Phase A) should anchor the redesign, not a default "remove all borders" instinct — some structure (the block header rhythm, the coach-note rule) should stay geometric and quiet-confident, not dissolve into formless cards.
- **Overcorrecting toward luxury styling**: per the standing brand guardrail (no black-and-gold nightclub luxury), the fix for "too technical" is calm and considered, not ornamental. Phase 1-3 should be judged against "does this feel like a private coach," not "does this feel expensive."
- **Sequencing risk**: reordering Phase E into Phases 1/3/5 means readiness-prompt and recovery-swap fixes (already flagged, already wanted) are delayed behind the global/active-workout work. This is a deliberate tradeoff — fixing the shared dialog *pattern* once in Phase 5 is more durable than patching the one dialog instance sooner and re-touching it again when the pattern changes.

---

## 10. Approval questions

Decisions needed before any code is written:

1. **Phase reordering** — approve the proposed 7-phase sequence (Phase 1: shared chrome → Phase 2: card/list language → Phase 3: active workout → Phase 4: completion/recap → Phase 5: dialog family → Phase 6: polish pass → Phase 7: QA), replacing the original "Phase E onward" plan?
2. **Set-row redesign scope** — should Phase 3 treat the set row as a full visual rebuild (new layout grammar, same data/taps) or a constrained retrofit (remove border/dashed-input treatment, keep the existing grid structure)? This audit recommends full rebuild given it's identified as the single worst offender, but it's the highest-effort item in the plan and worth confirming before scoping.
3. **Dialog family split** — approve creating a distinct "neutral coaching dialog" visual pattern (Phase 5), separate from the existing destructive-confirm pattern, rather than continuing to reuse `.confirm__title`/`.sheet` for both?
4. **Uppercase/mono rebalancing** — approve reducing uppercase usage on secondary captions/stat labels (keeping it for true section overlines) and confining `.mono` strictly to numeric content, per Section 6 item 5/7?
5. **Grid background** — this audit recommends leaving it as-is (or very slightly softer) rather than removing it, since it's not a meaningful contributor once the bordering problem is fixed. Confirm no separate phase is needed for it.
6. **Today-card border removal** (Section 4, home screen row) — small, low-risk fix identified in passing; confirm whether to fold it into Phase 2 (card language) as scoped, or handle it as an immediate one-line fix now, ahead of the phase sequence, since it's isolated and matches work already reviewed/approved in Phase B/D.
