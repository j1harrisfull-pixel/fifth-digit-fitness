# Dogfood Manual Coach Review Checklist

This checklist is **not automated and never gates a commit**. It exists
alongside the automated harness (`tools/tests/test-phase8-battery.js`,
`tools/tests/test-phase8-safety-sweep.js`), not as a replacement for it.

The automated harness proves the engine's output is *structurally correct*
(safe, prescribed within band, coherent, MRV-respected, anchor-stable). It
cannot tell you whether a session actually *reads like it was written by a
great coach*. That judgement stays human, on purpose -- Phase 8's guardrail
is that no AI/LLM grading and no fuzzy automated pass/fail stands in for it.

## When to run this

After any engine change judged significant enough to warrant it (a change to
Selection, Prescription, Progression, Balance, Fatigue, or Recovery logic).
Run `node tools/dogfood/run-battery.js` first to confirm the automated
checks are clean, then read through the 12 scenarios' actual generated
sessions and answer the questions below for each one.

## The questions

For each of the 12 dogfood scenarios (see `tools/dogfood/scenarios.js`),
read the generated session/program and ask:

1. **Does this session feel purposeful?** Would a real coach be able to say
   why each exercise is there, in one sentence, without hedging?
2. **Does it match the request?** If the athlete asked for a 30-minute
   beginner full-body session, does what they got actually feel like one?
3. **Is it the right level of hard?** Not junk-volume-easy, not
   sandbagging-hard for this athlete's stated experience and readiness.
4. **Does anything feel random?** An exercise that doesn't obviously belong
   with the rest of the session, even if it individually passed every
   automated check.
5. **Would I give this to a real athlete?** Not "is it technically valid" --
   would you actually hand this exact session to a person and stand behind
   it.
6. **Is anything missing?** A pattern, a muscle group, a warm-up/cool-down
   element that a real coach would have included.
7. **Is anything unnecessary?** Padding, redundant accessory work, a
   finisher that doesn't fit the time budget or the day's intent.
8. **Does the flow make sense?** Warm-up into the heaviest/most technical
   work, into accessories, into conditioning, into cool-down -- not
   scrambled.
9. **Would the user understand why they're doing this?** Not just the
   per-exercise `why` string in isolation, but the session as a whole telling
   a coherent story.

## Recording findings

If a question surfaces a real concern, do not fix it inside this checklist
or inside Phase 8. Log it:
- As a new Technical Debt Register item (`docs/TECH-DEBT-REGISTER.md`) if
  it's a real gap that doesn't block anything today, or
- As a reported bug in the next Phase 8 completion report, for James to
  explicitly scope a fix.

Never silently patch the engine while running this checklist -- Phase 8
observes and validates only.
