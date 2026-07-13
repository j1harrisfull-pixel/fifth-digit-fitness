# Fifth Digit Coach — Master Ticket

**Date:** 13 July 2026
**Status:** Approved direction. No code yet. Every ticket below gets its own build pass, in order.
**Live version:** v1.14. (v1.15 bottom nav is committed locally only — not pushed, not approved, superseded by Ticket 2.)

---

## What this app is — James's words, the test for every decision

The app is a **coach, not a toolbox**. It welcomes you, gives you a workout plan
(just today, one week, or four weeks), and logs your work so you can see progress.
That's it. Nothing outside the realms of a simple fitness app.

**The loop the whole app serves:**
Open → see today's workout → do it → feel the finish → come back tomorrow.

**The experience it must deliver:**
- Greets you. Asks your name, your injuries, how you feel. You feel considered, not registered.
- You land on a simple, inviting home screen. Building a workout is obvious and easy.
- Building never feels like a settings page. It feels like a coach asking questions.
- You can swap a workout if today isn't that day.
- You can start, pause, stop, and finish a workout.
- **You can leave the screen, or leave the whole app, and come back — and your workout is still there. It never forgets you.**
- It keeps history. It tells you when you're making progress, positively.

**The rule for every future change:** if it doesn't serve the loop, it gets cut or hidden.
Stop building ticket-by-ticket reactions. Work from this document.

---

## Priority 1 — Never lose the user's place ("the trust fix")

**Problem:** Start a workout, leave the screen, come back — nothing says
"you're mid-workout." Just a quiet Continue button that looks like every other button.
This breaks trust, and trust is the whole product.

**Fix:** A clear, unmissable "Workout in progress" state.
- A strip/banner: *"Upper · Bench in progress — 4 of 11 done — Resume"*.
- Visible on Home and anywhere else the user can land, until the workout is finished or ended.
- Survives leaving the app and coming back. Survives a phone restart.

**Done when:** you can start a workout, close the app, reopen it an hour later,
and the first thing you see tells you exactly where you were.

---

## Priority 2 — One navigation decision: Home / Progress / Settings

**Problem:** Home and Train do the same thing (audit confirmed: identical logic,
identical destination). Meanwhile Progress/history — half the reason the app
exists — has no proper front door at all.

**Fix:**
- **Kill the Train tab.** Home IS train.
- **Progress gets the tab Train wasted.** History, records, trends, milestones — one home.
- Bottom nav becomes: **Home · Progress · Settings**.
- This settles the unapproved v1.15 work in one move (keep the bar and Build-on-Home
  ideas; replace Train with Progress).

**Done when:** every screen has one job, and a user can say what each tab is for in one word.

---

## Priority 3 — Two Build doors, not nine

**Problem:** Nine different buttons open the Build screen. That's how an app gets confusing.

**Fix:**
- Empty app: one big obvious door — "Build your training week" (+ "Train today instead").
- App with a program: one quiet Build button. That's it.
- Delete the other seven paths.

**Done when:** there are exactly two ways to reach Build, and both are obvious.

---

## Priority 4 — Building feels like a coach, not a settings form

**Problem:** The build sheet works, but it's a form. James: "they should feel
considered and thought about" — equipment selection included.

**Fix:**
- Turn Build into a short conversation — one question per screen, like the welcome flow.
- Goal → days → time → equipment → here's your week. Each step feels asked, not configured.
- **New goal choices (decided 13 July):**
  - **Get stronger** (existing strength goal)
  - **Build muscle** (opens the engine's already-built hidden hypertrophy goal —
    needs one test pass building sample weeks before shipping)
  - **Strength + cardio** (hybrid, renamed into plain words)
  - Small fallback line: *"Not sure? I'll build you a balanced week."* (hidden "general" goal)
  - **Endurance is DROPPED** from the UI. The library (~8 running entries) can't
    honestly back it. It returns only if real cardio depth is ever built — as a
    decision, not a leftover.
- **Just Today is the star** of the build offer. One-week and four-week stay, but quieter.

**Done when:** building a workout feels like being asked three friendly questions,
and every goal button is backed by real library depth.

---

## Priority 5 — Make the loop feel alive

Not broken things — things that turn "works" into "love it." In rough order:

1. **Open ready.** Mid-week, the app opens basically saying "Bench day. 45 minutes. Start."
   One decision already made. (Whoop opens on your recovery — zero taps.)
2. **The finish moment.** The session receipt is honest but flat. The end of a workout
   is the emotional high point — make it feel like something. (Strava's magic is the
   moment after you stop.)
3. **A reason to come back tomorrow.** The 14-day strip is easy to miss. One gentle,
   visible hook — "3 weeks consistent." (Duolingo's streak, without the guilt.)
4. **Progress told as a sentence.** "Your bench is up 10kg since March." The data
   already exists; the sentence is missing.
5. **One-tap set logging.** Pre-fill everything; the user just confirms. Adjust only
   when something changed.
6. **The week as a rhythm, not a list.** Hard day, easy day, rest — shown as a shape.

---

## Priority 6 — Say everything once

- Records/PRs currently appear in **three** places → they live in Progress, referenced elsewhere.
- Injuries can be entered in **two** places → one flow, reachable from both doors.
- "How are you feeling" has **two** different UIs → one.

---

## Priority 7 — Library depth (the engine's content)

Audit (13 July): 244 exercises — 181 strength / 37 mobility / 26 conditioning.
The strength catalogue is genuinely extensive. The gaps, in build order:

1. **Rehab/physio — the biggest gap.** The app asks about injuries, then only *avoids*
   exercises. It never *helps* the injury. James wants physio/rehab workouts to exist.
   Build: injury-specific corrective/rehab content and a way to prescribe it.
2. **Cardio depth.** ~8 running entries is a menu, not a programme. Needed before
   Endurance could ever return, and to make "Strength + cardio" richer.
3. **Mobility/stretching.** Functional but modest (17 warm-up moves, 20 stretches,
   4 pulse-raisers, 3 closers). Widen the pool.
4. **Calisthenics progressions.** Thin — bar basics only.

---

## Priority 8 — Parked (not lost, not now)

- Animated opening splash (approved mockup, never built).
- "planned / closed" week-row wording James dislikes.
- Active-workout premium polish plan (docs/plans/2026-07-08 — written, never started).
- Two injury-matching safety bugs (TECH-DEBT register #10, #11).
- "Programs" goal-picker idea (idea only).

---

## Working agreement

1. One priority at a time, top to bottom. Each gets: plain-English ticket → James
   approves → build → test → James approves → ship.
2. Read-only first when unsure. No surprise changes.
3. Reports to James: short sentences, no code talk, problems labelled simply.
4. Anything new that comes up gets added HERE first, not built on impulse.
