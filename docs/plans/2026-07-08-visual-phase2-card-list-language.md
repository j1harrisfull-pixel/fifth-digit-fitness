# Visual Reset — Phase 2 Implementation Plan: Core Card / List-Row Language

**Status:** Plan only. No code written, no files edited. Awaiting approval.

**Position in sequence:** Phase 2 of the approved 7-phase visual-language reset (1 shared chrome ✓ → **2 card/list language** → 3 active workout → 4 completion/recap → 5 dialog family → 6 polish pass → 7 QA).

**One-line goal:** move the *non-active-workout* card and list surfaces from border-first framing toward surface-first hierarchy, so the home and list screens read as a considered premium coaching product — without flattening hierarchy, blurring state, or drifting into generic soft-SaaS.

**Headline finding from reading the code:** the app's non-workout lists are **already divider-based, not box-based** — the "spec-sheet / grid-of-boxes" feeling the audit identified lives almost entirely on the *active-workout* screen (`.card`, set rows, stat cells), which is Phase 3. So Phase 2 is genuinely small and surgical: the two real border-first offenders outside the workout screen are **`.today-card`** (the home hero, framed with a strong border despite already being elevated by fill) and **`.weekrow__tag`** (outlined status pills that read spec-sheet-ish). Being strict per the brief, I am *not* manufacturing changes to already-good divided lists.

---

## 1. Specialist skills used

- **Visual design reasoning** (primary) — Sections 4, 5, 6: which borders are redundant framing vs. load-bearing separation, how `--surface-3` fill can carry the hero card's elevation once its border goes, tinted-fill vs. outlined status pills, and the deliberate choice *not* to touch divider-based lists.
- **Product design reasoning** — Sections 2, 5, 11: whether the home screen reads as an intentional premium entry point, and whether each proposed change makes the product feel more paid or just different.
- **Usability reasoning** — Sections 4, 5, 7: keeping the week list scannable, keeping the current-day/status legible, ensuring a borderless hero card still reads as a discrete unit.
- **UX writing reasoning** — Section 4 (weekrow tags): whether "DONE / IN PROGRESS / SKIPPED / TODAY / ALT" still read as coach-led status once restyled, and confirming no label text changes.
- **Brand systems reasoning** — Sections 5, 11: holding the line against soft-SaaS blandness and against introducing shadow/ornament that would break the deliberate flat graphite identity; keeping brass restraint.
- **Accessibility reasoning** — Section 7: contrast of `--surface-3` fill against `--bg` when the border is removed, status-color distinguishability in tinted pills, focus/hover/selected states, tap targets (none change).
- **Behaviour-preserving engineering reasoning** (last) — Section 8: proving every change is CSS on existing selectors, outside the `__COACH__` span, no markup/JS/data touched.

---

## 2. Phase 2 scope (what WILL change)

Deliberately narrow — two surfaces, both non-active-workout, plus one documented no-change decision:

1. **`.today-card` (home hero session card)** — remove the strong `--line-strong` outline; let the existing `--surface-3` fill carry the card's elevation against the page. It becomes the app's one genuinely *elevated* surface, defined by fill + spacing + radius, not by a frame.
2. **`.weekrow__tag` and its state variants** (`--alt / --done / --prog / --skipped / --pending / --today`) — convert the outlined status pills to **tinted-fill** pills that preserve the exact same semantic colours, so the week list stops reading like a spec sheet while status stays legible.
3. **Documented decision: keep divider-based lists as-is** — `.weekrow`, `.history__lift`, `.history__session` use hairline top-borders as *list dividers*, which is already a premium divided-list pattern (not a box grid). Per the brief's "do not defer everything just because it's safe" AND "do not include changes just because they're easy," the strict call is that these are not broken and changing them risks flattening a working pattern. Recorded, with reasoning, so it's a decision not an oversight.

That is the entire Phase 2 change set.

---

## 3. Out of scope (what will NOT be touched)

- **`.card` (active-workout exercise card)** — this is the exercise card on the day/session screen, not an "ordinary card" on home. It stays exactly as-is; its border/surface treatment is **Phase 3**.
- **Set rows, `.setcolhead`, stat cells, rest timer, livebar** — Phase 3.
- **`.seg` / `.weeknav` (segmented controls, week-nav pill)** — their borders are *interactive-control affordance*, not passive framing. Keep. (Build-sheet `.seg` polish is Phase 6 anyway.)
- **Dialogs** — `.confirm`, `.sheet`, readiness prompt, recovery dialog, destructive confirms — Phase 5 / untouched.
- **Sheet sections (`.sect`)** — margin-based, no border, already clean. Untouched.
- **Empty state (`.empty`)** — no border, thumbprint watermark, already on-brand. Untouched.
- **`--shadow` token** — stays `none` (see approval Q2); introducing shadow would break the deliberate flat identity and is explicitly *not* proposed.
- **Any JS, data shape, `__COACH__`-span code, CTA geometry** (`.today-card__cta` clip-path stays exactly as-is).
- **Coach-note treatment, quiet-aside pattern (Phase 1), type scale (Phase B), home hierarchy (Phase D)** — all preserved.

---

## 4. Selector / class audit

| Selector | Current visual issue | Proposed change | Why Phase 2 | What replaces the border | Risk | Verification |
|---|---|---|---|---|---|---|
| `.today-card` (`index.html:205`) | `border: 1px solid var(--line-strong)` on a `--surface-3` fill — the strong outline *and* the elevated fill both try to separate it from the page; the frame is redundant and makes the hero read as a "bordered box" rather than a considered, elevated surface | Remove the border (or reduce to a `--line-soft` whisper — approval Q1); keep `--surface-3` fill, radius, padding. The fill (`#2E2820` on `#14110D` bg) carries the elevation | Audit-flagged (approval Q6 folded it here); it's the single clearest border-first offender on the home screen and the app's designated hero surface | `--surface-3` fill contrast against `--bg` provides the separation; spacing + radius complete it | **Low-med** — hero could flatten if fill contrast reads weak | Contrast check `--surface-3` vs `--bg`; screenshot fresh + built-program home; confirm card still reads as a discrete elevated unit |
| `.weekrow__tag` (`index.html:236`) + variants (`237-241`) | Outlined pills (`border: 1px solid var(--line-strong)`, `--skipped` even uses `border-style: dashed`) — small hard-outlined boxes reading as spec-sheet / admin status chips | Convert to **tinted-fill** pills: colour-matched low-opacity background (`color-mix(... 14-18% ...)`) + the existing semantic text colour, border removed (or reduced to transparent). Keep every state's colour identity | Week list is explicitly Phase 2; these are the one element there that reads technical | The tinted fill carries the status colour more softly than an outline; text colour keeps meaning | **Medium** — must preserve 6 distinct, legible states (alt/done/prog/skipped/pending/today) incl. the dashed "skipped" cue | Live-verify **all** tag states render distinctly and legibly; check contrast of each tinted fill + text |
| `.weekrow` / `.weekrow__open` (`228-231`) | Hairline top/bottom dividers (`border-top: 1px solid var(--line)`) + hover `--surface-2` | **No change** — a divided list is already a premium pattern, not a box grid | Decision belongs to Phase 2's scope (list rows) but the strict call is *keep* | n/a (dividers stay as legitimate separation) | **n/a** | Confirm untouched in the diff; smoke-check rows still divide cleanly |
| `.history__lift` / `.history__session` (`804, 824`) | Same hairline-divider list pattern | **No change** — same reasoning as `.weekrow` | Phase 2 relevant, strict call is keep | n/a | **n/a** | Smoke-check history renders if reached |
| `.recap-stats` (`217`) | `border-top: 1px solid var(--line)` — an *internal* divider inside the hero/recap, separating stats from content above | **No change** — internal dividers are legitimate; not a container border | Would be over-reach | n/a | **n/a** | Confirm untouched |
| `.empty` (`844`) | No border; thumbprint watermark at ~7% | **No change** — already the right restrained tone | — | n/a | **n/a** | Smoke-check empty state |

---

## 5. Surface hierarchy proposal

The intended, explicit elevation ladder after Phase 2 (dark graphite base, warm ivory ink, muted brass accent — all preserved):

- **Primary session card (`.today-card`, home hero):** the app's *most elevated* surface — `--surface-3` fill, **no frame**, radius, generous padding. Elevation comes from fill contrast against `--bg`, not an outline. It should read as "the considered thing on this screen."
- **Ordinary card (`.card`, exercise):** unchanged this phase — `--surface` fill + `--line` hairline. Its surface-first treatment is Phase 3, where it's redesigned coherently with the set rows. (Noting it deliberately sits *below* the hero in the ladder: `--surface` < `--surface-3`.)
- **List row (`.weekrow`, `.history__*`):** *not* a card — a divided list on the `--bg` base, separated by hairline dividers, with a `--surface-2` hover wash. Stays. This is the correct premium pattern for a scannable list of days/sessions.
- **Settings row/card:** section-based (`.sect` margins) + interactive `.seg` controls (border = affordance, kept). No heavy "settings card" exists to soften; largely untouched, revisited lightly in Phase 6.
- **Sheet section (`.sect`):** margin-based, borderless, clean. Untouched.
- **Empty state (`.empty`):** borderless, watermark, restrained. Untouched.

Net ladder: `--bg` (page / list base) → `--surface` (ordinary card, Phase 3) → `--surface-3` (hero card, borderless). Status/aside surfaces (`--surface-2`, quiet-aside from Phase 1) sit as accents beside this, not in the elevation ladder.

---

## 6. Border policy

**Borders that STAY (meaningful):**
- `.seg`, `.weeknav`, week-nav buttons — interactive control affordance.
- Inputs (weight/name/injury fields) — input affordance.
- `.setrow` and all active-workout borders — Phase 3, untouched.
- `.card.is-complete` border-*colour* — a **state** signal (completion), not passive framing.
- `.btn--danger`, `.confirm__*`, `.preview__error` — destructive/safety affordance.
- Hairline list dividers (`.weekrow`, `.history__*`, `.recap-stats` top-border) — legitimate separation that fill alone wouldn't provide in a dense list.
- Focus/hover/selected states everywhere.

**Borders that SOFTEN or DISAPPEAR (only passive framing):**
- `.today-card` full border → removed; **replaced by** `--surface-3` fill elevation + spacing + radius.
- `.weekrow__tag` outlined pills → tinted fills; **replaced by** colour-matched low-opacity background carrying the status colour, with text colour preserving meaning.

No other border changes. Nothing is removed without a named replacement.

---

## 7. Accessibility / usability check

- **Hero card boundary (borderless):** verify `--surface-3` (`#2E2820`) against `--bg` (`#14110D`) is a clearly perceptible fill step (it is a meaningful lightness delta; will confirm the exact ratio live). If it reads weak, fall back to a `--line-soft` whisper hairline (approval Q1) — still far quieter than today's `--line-strong`.
- **Status-tag legibility (tinted fills):** each of the 6 states must stay distinct and readable; tinted-fill + strong semantic text colour is generally *higher* legibility than a thin coloured outline, but every state gets a live contrast check. The "skipped" state currently signals via a dashed border — its replacement must keep a distinct cue (tinted `--manage` fill; consider retaining a subtle dashed or muted treatment so skipped ≠ pending at a glance — flagged in approval Q3).
- **Tap targets:** unchanged — `.weekrow__open` stays 16px-padded full-width; tags are non-interactive labels; the hero CTA geometry is untouched.
- **Selected/current-day state:** `.weekrow.is-current` and the today-tag stay legible; no selected-state border is removed.
- **Focus states:** none of the touched selectors carry a focus ring that's being altered; the hero CTA and row buttons keep theirs.

---

## 8. Behaviour protection

- **Every change is a CSS property change** (border, background, `color-mix`) on existing selectors in the top `<style>` block. No markup, no class renames, no JS, no attributes.
- **`__COACH__` span untouched** — all targets are CSS; span diff will be proven zero as in every prior phase.
- **No data shape, no localStorage key, no state field** touched. Week-list rendering, tag-state computation, hero-card assembly logic all unchanged — only how the results look.
- **CTA geometry preserved** — `.today-card__cta` clip-path/padding not in scope.
- **Regression surface is visual only** — Node suite is a tripwire for accidental structural edits, expected identical.

---

## 9. Live verification checklist

- [ ] **Fresh home (no program)** — empty state renders, thumbprint watermark intact.
- [ ] **Built-program home** — `.today-card` reads as an elevated, borderless (or whisper-hairline) hero; still clearly a discrete unit; greeting/consistency/hierarchy from Phase D intact.
- [ ] **Today/session card** — label, title, focus line, lifts preview, CTA all render; CTA clipped corners unchanged.
- [ ] **Week/session rows** — all rows divide cleanly; **every `weekrow__tag` state** (today, in-progress, done, pending, alt, skipped) renders distinct and legible as a tinted fill; current-day row still reads.
- [ ] **Week-complete recap** (if reachable) — recap stats + today-card recap variant render.
- [ ] **Build-a-week sheet** — confirm untouched (no bleed into `.seg`/sections).
- [ ] **Just Today sheet** — confirm untouched.
- [ ] **Settings** — confirm untouched (segmented controls keep their borders).
- [ ] **History / session completion** (if affected) — divided lists render unchanged.
- [ ] **Active workout smoke test** — open a session; confirm `.card`, set rows, coach-note, rest timer all render exactly as before (proving no bleed from shared-token edits).

---

## 10. Regression checklist

- [ ] **Full Node suite** — all 20 files, 0 failed, identical counts to the Phase 1 baseline.
- [ ] **Coach-span diff** — zero diff.
- [ ] **CSS-only diff review** — confirm the diff touches only `.today-card` and `.weekrow__tag*` rules (plus this doc); no markup/JS.
- [ ] **Console check** — no new errors on home + week list + active workout.
- [ ] **Visual check of all changed states** — screenshot hero card, and the full set of weekrow tag states.
- [ ] **Touch-target / readability check** — hero CTA + row hit areas unchanged; tag text legible against tinted fills; hero boundary perceptible.

---

## 11. Risks and mitigations

- **App becoming too soft / generic.** *Mitigation:* only two surfaces change; divided lists and ordinary cards keep their structure. The hero stays anchored by radius + fill contrast + brass CTA, not dissolved into a formless panel. Judged against "premium private coach," not "softer."
- **Losing useful separation (borderless hero).** *Mitigation:* `--surface-3` fill provides a real, measured step from `--bg`; live contrast check + `--line-soft` fallback (Q1) if weak.
- **Selected/status states becoming unclear (tinted tags).** *Mitigation:* keep every semantic colour; live-verify all 6 states; special care that "skipped" stays distinct from "pending" (Q3). Tinted fill is generally more legible than a thin outline, not less.
- **Card hierarchy flattening.** *Mitigation:* Phase 2 actually *sharpens* hierarchy — the hero becomes the sole elevated (`--surface-3`, borderless) surface while ordinary cards stay `--surface`+hairline; the ladder is more legible, not flatter.
- **Changing too many shared selectors at once.** *Mitigation:* `.today-card` and `.weekrow__tag` are home/week-only; neither is shared with the active-workout screen, so no cross-screen bleed. Explicitly verified by the active-workout smoke test.
- **Accidental impact on active-workout components.** *Mitigation:* no active-workout selector is touched; `.card` (exercise) is explicitly out of scope; smoke test confirms.
- **Introducing shadow to fake elevation.** *Mitigation:* explicitly *not* proposed — `--shadow` stays `none` to protect the flat graphite identity; elevation comes from fill (Q2).

---

## 12. Approval questions

1. **Hero card border** — remove `.today-card`'s border entirely (rely on `--surface-3` fill alone), or keep a `--line-soft` whisper hairline for a touch more definition? **Recommendation: remove entirely** and let the fill carry it — this is the cleanest test of the surface-first thesis, with the hairline as a live-verified fallback only if contrast reads weak.
2. **Elevation via shadow?** — confirm we should **keep `--shadow: none`** and elevate the hero by fill contrast alone, rather than introducing a subtle shadow? **Recommendation: keep `none`** — a shadow would break the deliberate flat graphite identity and edge toward generic app styling.
3. **Weekrow status tags** — convert all six states to tinted-fill pills (recommended), and for the "skipped" state specifically, keep a distinct cue (muted/dashed treatment) so skipped ≠ pending at a glance? **Recommendation: tinted fills for all, with a distinct skipped treatment retained.**
4. **Divider-based lists** — confirm we **keep** `.weekrow` / `.history__*` as hairline-divided lists (not convert them to card/surface rows), on the reasoning that a divided list is already a premium pattern and the spec-sheet feel lives on the Phase 3 active-workout screen, not here?
5. **Scope tightness** — is Phase 2 = `.today-card` + `.weekrow__tag` (plus the documented keep-decisions) appropriately strict, or would you like an additional list/card surface brought into this phase (e.g. a light tint on `.weekrow` hover, or softening `.recap-stats` internal divider)? **Recommendation: keep it this tight** — it's the honest set of real offenders outside the workout screen.

No code will be written until these are answered and the plan is approved.
