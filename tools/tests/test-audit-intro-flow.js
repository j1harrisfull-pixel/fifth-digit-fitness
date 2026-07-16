// Opening-flow structural rebuild (15 July 2026, James: "the whole opening
// flow doesn't work... lots of pages of the same thing, not very intuitive").
// Full walkthrough audit found 13 near-identical screens between cold launch
// and the first logged set: the intro's own 4-question wizard (name,
// how-it-works, injuries, experience) handed off into the build sheet's
// own 4-question wizard, plus a redundant double-confirm (preview "Use this
// week" then a day-preview "Start the session"). This replaces the earlier
// (13-14 July) incremental intro-flow polish -- superseded, not layered on:
// 1. The intro collapses to ONE brand beat: wordmark, product line, 3
//    "how it works" bullets, one CTA. No name ask (moved out of the front
//    door entirely -- Settings still has it), no separate injuries/
//    experience screens.
// 2. Experience folds inline into the wizard's goal step (secondary seg
//    group, arrives unselected, same honest-default contract the old intro
//    step 4 had -- normalizeAthlete's "intermediate" fallback still applies
//    invisibly if untouched).
// 3. Injuries fold inline into the wizard's kit step (optional add row,
//    same addAthleteInjury("pain", ...) write path); typed-but-not-Added
//    text is committed when Build is tapped, mirroring the old Continue fix.
// 4. The first-ever build skips the "Use this week" review entirely --
//    generateProgram's result is auto-accepted and the built day opens
//    directly. Only the true first build does this (captured via
//    !hasProgram() BEFORE generation); any later build (replacing a
//    program, or a returning user) keeps the review step.
const fs = require('fs');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 1. Single-beat intro ----------
{
  const stepCount = (SRC.match(/class="intro__step"/g) || []).length;
  ok(stepCount === 1, 'the intro is exactly one screen, not a 4-step wizard, found ' + stepCount);
  ok(!/id="introName"/.test(SRC), 'no name field on the front door (moved out of onboarding entirely)');
  ok(!/id="introInjInput"/.test(SRC), 'no separate injuries screen in the intro');
  ok(!/id="introExpChips"/.test(SRC), 'no separate experience screen in the intro');
  ok(/id="introGo" type="button" data-build="1">Build my first week<\/button>/.test(SRC),
    'one CTA takes the user straight into the build');
  ok(/<h1 class="intro__title" id="introTitle">Let's build your first week\.<\/h1>/.test(SRC),
    'the heading states the actual next action, not a generic welcome');
}

// ---------- 2. CTA skips the scope chooser, straight to the wizard ----------
{
  ok(/function openPlanForFirstBuild\(\) \{\s*openPlan\(\);\s*\$\("planChoiceStep"\)\.hidden = true;\s*buildPrefs\(\)\.weeks = 1;\s*setPlanMode\("week"\);\s*showWeekStep\(1\);\s*\}/.test(SRC),
    'openPlanForFirstBuild opens straight onto the wizard goal step (one week preset)');
  ok(/if \(building\) openPlanForFirstBuild\(\);/.test(SRC), 'the intro CTA routes through the first-build entry');
  const fb = SRC.slice(SRC.indexOf('function openPlanForFirstBuild'), SRC.indexOf('function openPlanForFirstBuild') + 400);
  ok(!/planChoiceMade = true/.test(fb), 'first build does not stamp planChoiceMade (the chooser must never look pre-decided)');
}

// ---------- 3. Info-mode reopen (Settings) shows the same single screen ----------
{
  ok(/function showWelcome\(building\) \{[\s\S]{0,500}go\.textContent = building \? "Build my first week" : "Got it";/.test(SRC),
    'reopening from Settings shows the same screen with a "Got it" dismiss, not a separate flow');
  ok(/if \(title\) title\.textContent = building \? "Let's build your first week\." : "Here's how it works\.";/.test(SRC),
    'the heading adapts for the reopen, same screen either way');
}

// ---------- 4. Experience folds into the wizard's goal step ----------
{
  ok(/<div class="wstep__secondary">\s*<p class="wstep__secondary-label">Been training long\?<\/p>\s*<div class="seg seg--full" id="bExpChips"/.test(SRC),
    'experience is a secondary block on the goal step, not its own screen');
  ok(/data-wstep="1">[\s\S]{0,1800}id="bExpChips"/.test(SRC), 'the experience block sits inside wstep 1 (goal), not a separate step');
  ok(/var wizExpChosen = false;/.test(SRC), 'the honest-default gate exists (unselected until a real tap)');
  ok(/var exp = wizExpChosen \? \(\(state\.athlete && state\.athlete\.experience\) \|\| ""\) : "";/.test(SRC),
    'syncBExpChips only lights a button after an explicit tap, never from the normalizeAthlete default');
  ok(/\$\("bExpChips"\)\.addEventListener\("click", function \(ev\) \{[\s\S]{0,300}wizExpChosen = true;/.test(SRC),
    'tapping an experience option sets the gate and writes state.athlete.experience');
  ok(/wizExpChosen = false; \/\/ fresh open of the sheet/.test(SRC), 'opening the build sheet resets the gate (no stale "chosen" light on reopen)');
}

// ---------- 5. Injuries fold into the wizard's kit step ----------
{
  ok(/data-wstep="4" hidden>[\s\S]{0,1400}id="bInjInput"/.test(SRC), 'the injury row sits inside wstep 4 (kit), not a separate step');
  ok(/Anything to avoid\? <span class="sect__hint" style="display:inline">Optional<\/span>/.test(SRC),
    'the injury row is clearly labelled optional');
  ok(/add\.addEventListener\("click", function \(\) \{\s*if \(addAthleteInjury\("pain", input\.value\)\)/.test(SRC),
    'Add commits through the same shared addAthleteInjury write path');
  ok(/\$\("buildBtn"\)\.addEventListener\("click", function \(\) \{[\s\S]{0,300}if \(input && input\.value\.trim\(\) && addAthleteInjury\("pain", input\.value\)\)/.test(SRC),
    'typed-but-not-Added injury text is committed when Build is tapped (mirrors the old Continue fix)');
}

// ---------- 6. First build auto-accepts, no double confirm ----------
// v1.13 First Run Onboarding (16 July 2026) supersedes this section's
// original claim: the first-ever build used to land directly on the built
// day (openDay(0)). The new light-stone onboarding shell now owns that
// moment instead -- Arrival must NOT open live workout mode (its own
// explicit rule) -- so isFirstBuild's branch hands off to the onboarding's
// own arrival renderer, falling back to the old openDay(0) only if that
// renderer somehow isn't armed. See test-audit-v1_13-onboarding.js for the
// full new-flow coverage.
{
  ok(/var isFirstBuild = !hasProgram\(\);/.test(SRC), 'onBuild captures first-build status BEFORE generation (confirmBuild changes hasProgram)');
  ok(/if \(isFirstBuild\) \{\s*confirmBuild\(\);[\s\S]{0,700}if \(onboardBuildActive\) \{ onboardBuildActive = false; renderObArrival\(\); return; \}\s*openDay\(0\); return;\s*\}/.test(SRC),
    'the first-ever build hands off to the onboarding arrival screen (falls back to openDay(0) only if onboarding never armed the build)');
  // The review step must still exist for every LATER build (a returning user
  // replacing their program) -- the auto-accept branch returns early, so the
  // "Use this week"/"Try again" markup below it is only reachable when
  // isFirstBuild is false.
  ok(/Use this week<\/button><button class="btn" id="rebuildBtn" type="button">Try again<\/button>/.test(SRC),
    'the review step still exists for non-first builds (returning users replacing a program)');
}

// ---------- 7. Coach-span untouched -- this is all flow/presentation ----------
{
  const { execFileSync } = require('child_process');
  const spanMd5 = execFileSync('sh', ['-c', "sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5"]).toString().trim();
  ok(spanMd5 === 'ce6452b369d4d1d14fd0bf8560208ce7', 'coach-span md5 unchanged (ce6452b369d4d1d14fd0bf8560208ce7), got ' + spanMd5);
}

console.log(`Opening-flow structural rebuild (13 screens -> 6, no duplicate confirms): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
