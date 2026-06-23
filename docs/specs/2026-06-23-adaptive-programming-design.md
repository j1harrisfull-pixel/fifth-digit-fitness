# Training Log — Adaptive Programming (design spec)

Date: 2026-06-23
Status: approved-for-spec-review

## 1. Goal
Turn the fixed A/B/C tracker into an **elite, offline workout log driven by programs you get from Claude in your own chat**. You can change weeks freely (adapt one week at a time) or load a full multi-week build (e.g. 8 weeks). No accounts, no API, no network — the app only *opens* what Claude gives you, via copy-paste.

## 2. The loop
1. App: **Copy request for Claude** — copies your progress-to-date + the required JSON format.
2. Claude chat: paste it, add your ask in plain words ("8-week strength build, shoulders cranky" / "just next week, push squats").
3. Claude replies with a program block. Copy it.
4. App: **Load workout** — validates, previews ("8-Week Strength Build · 8 weeks · 4 days"), confirm → live.
5. Train & log. Repeat; history rides along so Claude adapts.

No end-of-session check-in — the log itself (target vs. actual, missed reps) is the adaptation signal.

## 3. Data model (localStorage key `training-log:v2`)
- **Program** = `{ schema, title, goal, unit, weeks[] }`. 1 week or N weeks — same shape.
- **Week** = `{ week:Number, focus?, deload?:Bool, sessions[] }`.
- **Session** = `{ name:String (free-form, e.g. "Lower A"), focus?, exercises[] }`.
- **Exercise** = `{ name, type:"strength"|"mobility"|"conditioning", sets:Int, reps:String, weight:Number, target?:String, rest?:String, notes?:String }`.
- **Log** (separate from the program template, so targets stay pristine): per `week→session→exercise`, stores `{ done:[Bool], actualWeight:Number, notes:String }`, plus a session `date` stamped on first set logged.
- **History**: when a new program is loaded it **replaces** the active program; the outgoing program + its log are pushed to an `archive[]` (never deleted) and used to build the next Claude request.

### Program JSON Claude must return (`schema: "training-log/program@1"`)
```json
{
  "schema": "training-log/program@1",
  "title": "8-Week Strength Build",
  "goal": "Build the main lifts; keep shoulders healthy",
  "unit": "kg",
  "weeks": [
    { "week": 1, "focus": "Accumulation", "deload": false, "sessions": [
      { "name": "Lower A", "focus": "Squat", "exercises": [
        { "name": "Back Squat", "type": "strength", "sets": 3, "reps": "5", "weight": 60, "target": "RPE 7", "rest": "3 min", "notes": "Brace, full depth" }
      ]}
    ]}
  ]
}
```

## 4. Import / validation (Load workout)
- Accept pasted text; `JSON.parse`; tolerate Claude wrapping it in ```` ```json ```` fences (strip fences).
- Valid if it has `weeks[]` → `sessions[]` → `exercises[]` (schema string preferred but inferred if missing).
- Normalize/clamp every field (reuse + extend current `normalizeEx`): sets 1–12, reps→string, weight→number≥0, type defaulted to "strength", unknown fields ignored.
- Show a **preview** (title, #weeks, #days, first session) and require **Confirm** before it replaces the active program.
- Clear, friendly errors ("That doesn't look like a Training Log workout — paste the whole block Claude gave you, including the `{ … }`.").

## 5. Copy request for Claude
One button copies a plain-text prompt containing:
- A short **progress summary** built from the log (per week/session: exercise, target vs sets hit @ weight, dates).
- The **standing program** title/goal/current week.
- The **exact JSON format** above + rules ("reply with ONE json block in `training-log/program@1`").
- A blank line inviting the user's own weekly ask.

## 6. UI changes (extends the existing card UI)
- Top bar: add a **Plan** button (houses Copy request + Load workout) beside the Settings gear.
- Under the tabs: **program title** + a `‹ Week 2 of 8 ›` selector.
- **Day tabs become dynamic** — one per session in the current week (free-form names).
- Exercise cards unchanged, plus a subtle **target / rest** line when present.
- "Reset sets" scoped to the current session/week.
- Keeps light/dark, blueprint aesthetic, AA contrast.

## 7. Migration
On first load of v2 with a v1 record present, convert the current A/B/C (with any logged sets) into `Program{ title:"Starter", weeks:[{week:1, sessions:[A,B,C]}] }` and migrate `done[]` into the week-1 log. Nothing is lost. `Erase all data` resets to this Starter program.

## 8. Out of scope (deliberately)
Accounts, in-app network/AI, tap-a-link import, charts/graphs, exercise videos, multiple simultaneously-selectable programs (we chose replace + archive), post-session check-in.

## 9. Acceptance criteria
- Load a valid program from pasted text (incl. fenced JSON); invalid input rejected with a clear message; preview + confirm before apply.
- Multi-week navigation + dynamic day tabs work.
- All logging persists; loading a new program archives prior logs (history retained, usable in the next request).
- "Copy request for Claude" copies a complete, paste-ready prompt with schema + progress.
- v1 data migrates into "Starter"; nothing lost.
- Still a single self-contained `index.html`, offline, passes `node --check` (inline JS + sw.js) and manifest JSON validation, and verified working in the browser preview (light + dark, load a sample program, switch weeks, log sets).
