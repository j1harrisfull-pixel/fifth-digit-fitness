# Screen-by-Screen Design — 01. Active Workout

**Status:** Design plan only. No code, no edits, nothing deployed. This begins a screen-by-screen product-design process, replacing the component-patch cadence — because Pass 1 proved that de-bordering elements (real progress) doesn't fix a screen whose *underlying structure* is a table + to-do list. Structure is what's left to fix.

**Method note:** grounded in the live v125 screenshots captured this session, not code alone. Behaviour is fixed and protected throughout; this is about layout, hierarchy, and feeling.

---

## PART A — Screen-by-screen design strategy (whole app)

**Product-design lens** — triage by paid-user value and how far each screen is from "premium private coach." Verdicts: **Redesign** (structure is wrong), **Polish** (structure right, finish needed), **Leave mostly alone**.

| # | Screen | Verdict | One-line why |
|---|---|---|---|
| 1 | **Active workout** | **Redesign** | Still reads as a table + to-do list under the Pass-1 paint. The 95%-of-time screen. **This plan.** |
| 2 | Home / session preview | **Polish** | Phase D/2 got the structure right (elevated hero, quiet strip); needs finish, not rethink. |
| 3 | Readiness / recovery | **Redesign** | Borrows the destructive-confirm dialog (red heading) for a warm check-in — wrong emotional frame. Needs the neutral coaching-dialog pattern. |
| 4 | Completion / recap | **Polish** | Cream/thumbprint receipt is on-brand; recap rows need to inherit the new surface language. |
| 5 | Onboarding | **Polish** | Copy/pacing already good; container language only. |
| 6 | Build / Just Today sheets | **Polish** | Chip/segment controls are fine; surface pass so they don't read as settings panels. |
| 7 | Settings / About | **Polish** | Section+control based; restrained pass, keep the quiet monogram sign-off. |
| 8 | Empty / loading / brand | **Leave mostly alone** | Thumbprint watermark, boot splash already quietly right. |

Only **1** and **3** are true structural redesigns. Everything else is polish once the design system the redesigns establish is in place. This document is screen 1.

---

## PART B — Active Workout Screen Design Plan

### 1. User goal
**Product + usability lens.** Mid-session, phone in one hand, possibly fatigued, the user wants to: know *what to do now*, do it, *log it in one tap*, see *what's next*, and trust the plan without thinking. Speed and calm confidence are the whole job. Everything else is secondary.

### 2. Target feeling
**Product + brand lens.** A guided private-coaching session: **calm, focused, one thing at a time, quietly premium, fast.** The screen should feel like a coach standing next to you turning to the current lift — not a form you fill in. "Considered," not "efficient-looking." It must never feel like a spreadsheet, a to-do list, or an app you're operating.

### 3. Current failure diagnosis (blunt, screenshot-evidenced)
**Visual design + UX-writing + usability lens**, against the live v125 captures:

1. **It's still a table.** Pass 1 removed the set-row *borders*, but the **column header "SET · PREV · KG · REPS" + column-aligned rows is a spreadsheet structure.** De-painting a table leaves a table. This is the single biggest remaining offender.
2. **"SEPREV" reads broken/cheap.** At 375px the "SET" and "PREV" column labels crowd — a compressed, technical, low-quality artifact of the table header. A premium screen has no column header to break.
3. **Square checkboxes = to-do list.** The collapsed exercises (warm-up, superset, conditioning, cooldown) each show a **square checkbox + name + "0/2 sets"** — the exact visual grammar of a task list. This is why the screen "feels like a checklist" even after Pass 1.
4. **Completed sets aren't obvious enough.** A done set is a green-tinted row with a small check circle; scanning "how many have I done" is harder than it should be — the count lives in a small "1 / 4 SETS" label, not in the set list's own read.
5. **Current exercise doesn't feel premium.** The hero card is a bordered box holding a coach note, a prescription line, a working-weight stepper, a "1/4 SETS" label, a "Target · 6 reps" line, a column header, and 4 table rows — **too many stacked utilitarian elements**; the eye has no single calm focus.
6. **Coachhint over-prominent.** The Effort/1RM explainer is a large box near the top of the first session — it competes with the actual work on the most important screen's first impression.
7. **Uppercase / mono density.** Block headers + column header + labels + mono numerals stack into a technical texture, even after Pass 1's trims.
8. **Redundant weight controls.** A shared "Set your working weight" stepper *and* a per-set weight value on every row (all showing the same 60) — duplicated data reads as a data-entry form.
9. **Rest timer** (Pass 2) still console-style; noted for relationship, not redesigned here.
10. **The screen doesn't match the engine.** The coaching intelligence underneath is elite; the surface says "training log."

### 4. New visual concept
**Product + visual design lens.**

**"One coached movement at a time. Sets as a guided progression, not a table."**

- The **current movement is a single calm coached card** — the hero. Coach note, the plan in one line, and the set progression. Nothing competes with it.
- **Set logging becomes a vertical progression, not a grid.** Kill the column header entirely. Each set is a **self-describing line** — it states its own weight × reps, so no column labels are needed. Completed sets read as **confirmed steps** (obvious tick + the numbers you did), the current set is the **clear focus** (its controls inline), pending sets are **quiet numbered steps** waiting their turn.
- **Completion is obvious at a glance** — the progression *fills in* as you go (done steps visually distinct and countable without reading a label), so "how far am I" is answered by the shape of the list, not a "2/4" caption.
- **Upcoming exercises are quiet session steps**, not to-do rows — the square checkbox goes; a done exercise reads via a subtle confirmed mark and recession, not a ticked box.
- **Weight is one control, not two.** The shared working weight is the primary; per-set weight shows **only when it differs** (an override), so ordinary rows stop repeating "60 · 60 · 60."

Net: the screen stops being *a table you fill* and becomes *a session you're guided through*.

### 5. Proposed screen structure
**Visual design + usability lens.** Top → bottom:

- **Session header** (Pass 1, keep): quiet timer + End; no "LIVE" broadcast.
- **Block context**: quiet overline ("Strength", "Warm-up") + time — kept, calmer.
- **Current exercise card (hero):**
  - Exercise name (display scale) + block position ("Strength 1 of 4") as a quiet eyebrow.
  - **Coach note** — the north star, kept.
  - **Prescription** — the Pass-1 coached line ("4 sets · 5–6 reps · 2 min rest").
  - **Working weight** — one calm primary control (the shared stepper), labelled plainly.
  - **Set progression** — the redesigned, header-less guided list (see §6). This is the heart.
  - **Effort** — appears on a completed set as tinted pills (kept, quieter).
  - **Foot** — est. 1RM / "hit N reps to add weight" / History, quiet (kept).
  - **Edit sets / Details** — a quiet disclosure (kept).
- **Upcoming exercises** — quiet session steps: name + a small block/role hint + a recessive state mark; tap to make current. **No square checkboxes.**
- **Superset** — A1/A2 kept as a coaching grouping label, not a table badge.
- **Conditioning / cooldown** — same guided-step language, self-describing.
- **Rest timer** — relationship preserved (triggers on log); full redesign is Pass 2.
- **Remove/End** — End in header (kept); "Remove this session" stays quiet at the foot.

### 6. State design
**Visual design + accessibility lens.** Each state gets an unambiguous, contrast-checked treatment:

- **Not started (pending set):** quiet numbered step, dimmed value, clearly secondary; reads "later."
- **Next set (current):** the focus — subtle inset surface + full-ink number + its inline controls (weight/reps steppers + the log action). Unmistakable as "do this now."
- **Completed set:** an obvious confirmed step — a real tick (not a square) + the numbers you actually did, quietly stated; recedes but stays legible.
- **Multiple completed:** the progression visibly *fills* — done steps share one calm treatment so a glance counts them; no reliance on a "2/4" label.
- **Effort selected:** the chosen tinted pill (brass), others quiet — kept.
- **Overridden weight:** shown inline on that set only, full-ink + brass marker (Pass 1) — the exception, not on every row.
- **Skipped exercise:** quiet, struck/recessed session step (kept semantics).
- **Superset A1/A2:** a small brass grouping tag on the paired steps; the pairing reads as coaching, not a table badge.
- **Conditioning:** self-describing step (e.g. "Zone 2 · 10 min"), same language.
- **Cooldown / mobility:** same quiet step language, timed.
- **Rest running:** the current-set step shows a calm "resting" affordance relationship (visual only; timer mechanics Pass 2).

### 7. What must stay functionally identical
**Behaviour-preserving engineering + usability lens.** Protected, mapped:

| Protected | How the redesign keeps it |
|---|---|
| Same data | Re-layout only; every field (set#, prev, weight, reps, effort, target) still present |
| Same taps or fewer | Log = one tap on the current set; no added confirmations |
| Same logging speed | Current-set controls inline and finger-sized; no sequential-only lock |
| Same/better touch targets | Done ≥44px; steppers ≥36px; never smaller |
| Previous-set info | Kept — surfaced on the set (prev reference), not a column |
| Set number / weight / reps entry | All kept, just re-presented |
| RPE / effort | Kept, tinted pills on completion |
| Rest trigger | Log→rest-timer wiring untouched (event handlers) |
| Edit sets / conditioning swap | Kept; restyled to the new language |
| Block counters / session progress | Kept; progress read more from the list shape |

### 8. What can change visually (be bold)
The table structure, the column header, the square checkboxes, the redundant per-set weight display, the current-card composition, the collapsed-row grammar, the coachhint prominence, uppercase/mono density. All fair game — this is a real redesign of *form*, not a token tweak.

### 9. What can change in markup
**Behaviour-preserving engineering lens.** Presentational markup only. Likely needed (all flagged and shown before editing, per the standing rule): restructuring the set-row render (`setRowHtml`/`buildCard` set list) from a column grid to a self-describing step; changing the collapsed-row markup to drop the square checkbox; possibly wrapping the working-weight + progression as one composed block. **No data-shape, no state field, no event-handler, no `__COACH__`-span change.** If any change risks behaviour, stop and report.

### 10. Exact code areas likely involved
**(Engineering last, not leading.)** CSS: `.setrow*`, `.setcolhead*`, `.setlist`, `.card*` (day view), `.card__collapsed*` (square checkbox), `.card__stats`/`.card__rx`, `.setrpe*`, `.phasehead*`, `.startweight*`, `.warm-pill`, `.supertag`/superset markup, `.coachhint`. JS render (presentational strings, outside the coach span): the set-row builders (~`:5871`/`:5991`), `buildCard()` (~`:6125`), the collapsed-row render, `renderList()` (~`:6378`). The coach engine (span 1923–4830) is **not** touched.

### 11. Screenshot states required (before → after gate)
**Test-engineering lens.** Capture current + redesigned for each:
1. Full active workout screen (composition)
2. Current strength exercise before logging
3. Set completed
4. Multiple sets completed
5. Next set obvious
6. Effort picker open
7. Edit sets open
8. Superset visible
9. Collapsed exercise rows (the checkbox → step change)
10. Conditioning exercise
11. Conditioning swap open
12. Rest timer running (relationship)
13. Remove / End session visible

No screen approved on text alone — screenshots decide.

### 12. Approval questions
**These shape the redesign; needed before any implementation.**

1. **Core model:** approve the shift from a **column table** (SET/PREV/KG/REPS header + grid rows) to a **header-less guided set progression** where each set is self-describing? This is the central decision — it's what makes the screen stop reading as a spreadsheet.
2. **Weight controls:** approve showing per-set weight **only when overridden** (leaning on the one shared "working weight" control as primary), rather than repeating the same weight on every row? (Removes the form-like redundancy; the override + all data stay accessible.)
3. **Completed-set indicator:** approve replacing the **square checkbox** on collapsed/other exercises with a quieter confirmed mark (tick/dot + recession), so the list stops reading as a to-do list?
4. **Progress read:** approve letting the *shape of the filling progression* carry "how many done," keeping the "N of M" as a quiet secondary label rather than the primary signal?
5. **Coachhint:** approve making the Effort/1RM explainer **quieter/smaller** (or a dismissible one-liner) so it doesn't dominate the first session's most important screen? (Content unchanged.)
6. **Scope boundary:** confirm the **rest timer stays functionally as-is** in this screen redesign (its full calm-cue redesign remains Pass 2 / screen 3-adjacent), with this plan only ensuring the set→rest relationship reads cleanly?
7. **Boldness latitude:** how far to go on the current-exercise card — a **restrained restructure** (same elements, new composition) or a **stronger single-focus treatment** (e.g. the current set genuinely foregrounded, other sets more recessive)? I recommend the stronger treatment given the brief's "be bold visually," but it's the highest-change option and worth confirming.

No implementation until these are answered and the design is approved. Screenshots will gate the build.
