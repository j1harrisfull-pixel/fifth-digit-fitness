// Intro/welcome-flow audit fixes (15 July 2026, section-by-section audit #2).
// Five flow fixes + minors, all presentation/flow -- coach-span untouched:
// 1. "Build my first week" lands DIRECTLY on the wizard's goal step via
//    openPlanForFirstBuild() -- never the "How much do you want to plan?"
//    chooser with its Done dead-end. planChoiceMade is deliberately NOT set.
// 2. Step 3 Continue commits typed-but-not-Added injury text through the
//    same addAthleteInjury write path instead of silently dropping it.
// 3. Step 4 experience arrives UNSELECTED (introExpChosen gate); the
//    intermediate default still applies invisibly; fine print says so.
// 4. Quiet Back control on steps 2-4 (data-introback), hidden on step 2
//    for info-mode reopens.
// 5. Steps 1 and 2 carry step-count eyebrows like 3 and 4 (step 2's only
//    during the build flow).
// Minors: step 1 mission line removed (one supporting line), injury chips
// are labelled delete buttons not aria-pressed toggles, #intro is a dialog
// for assistive tech.
const fs = require('fs');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 1. First build skips the scope chooser ----------
{
  ok(/function openPlanForFirstBuild\(\) \{\s*openPlan\(\);\s*\$\("planChoiceStep"\)\.hidden = true;\s*buildPrefs\(\)\.weeks = 1;\s*setPlanMode\("week"\);\s*showWeekStep\(1\);\s*\}/.test(SRC),
    'openPlanForFirstBuild opens the sheet straight onto the wizard at step 1 (one week preset)');
  ok(/if \(building\) openPlanForFirstBuild\(\);/.test(SRC), 'the intro CTA routes through the first-build entry, not openPlan');
  const fb = SRC.slice(SRC.indexOf('function openPlanForFirstBuild'), SRC.indexOf('function openPlanForFirstBuild') + 400);
  ok(!/planChoiceMade = true/.test(fb), 'first build does NOT stamp planChoiceMade (the chooser must never look pre-decided later)');
}

// ---------- 2. Typed injury committed on Continue ----------
{
  ok(/s3go\.addEventListener\("click", function \(\) \{\s*if \(injInput && injInput\.value\.trim\(\) && addAthleteInjury\("pain", injInput\.value\)\)/.test(SRC),
    'step 3 Continue auto-adds pending typed input through the shared addAthleteInjury path');
  ok(/addAthleteInjury\("pain", injInput\.value\)\) \{ injInput\.value = ""; save\(\); renderIntroInjChips\(\); renderAthleteSettings\(\); \}\s*introShowStep\(4\);/.test(SRC),
    'the auto-add mirrors the Add button exactly (save + both chip renders) before advancing');
}

// ---------- 3. Honest experience default ----------
{
  ok(/var introExpChosen = false;/.test(SRC), 'the explicit-choice gate exists');
  ok(/var exp = introExpChosen \? \(\(state\.athlete && state\.athlete\.experience\) \|\| ""\) : "";/.test(SRC),
    'syncIntroExpChips lights a button only after a real tap, never from the normalizeAthlete default');
  ok(/introExpChosen = true; \/\/ fix 3/.test(SRC), 'a tap on the experience group sets the gate');
  ok(SRC.indexOf('Optional. Skip it and the coach assumes intermediate.') !== -1, 'fine print states the skip default honestly');
  ok(SRC.indexOf('Optional. Change it anytime in Settings.') === -1, 'the old "Optional" claim under a preselected control is gone');
}

// ---------- 4. Back controls ----------
{
  ok(/<button class="intro__back" type="button" data-introback="1" id="introBack2">‹ Back<\/button>/.test(SRC), 'step 2 has a Back to step 1');
  ok(/<button class="intro__back" type="button" data-introback="2">‹ Back<\/button>/.test(SRC), 'step 3 has a Back to step 2');
  ok(/<button class="intro__back" type="button" data-introback="3">‹ Back<\/button>/.test(SRC), 'step 4 has a Back to step 3');
  ok(/document\.querySelectorAll\("#intro \[data-introback\]"\)\.forEach\(function \(b\) \{\s*b\.addEventListener\("click", function \(\) \{ introShowStep\(parseInt\(b\.getAttribute\("data-introback"\), 10\)\); \}\);/.test(SRC),
    'all Back controls route through introShowStep');
  ok(/var bk2 = \$\("introBack2"\); if \(bk2\) bk2\.hidden = !introBuilding;/.test(SRC), 'step 2 Back hides on info-mode reopens (no flow to go back through)');
  ok(/\.intro__back \{ display: block; background: none; border: 0;/.test(SRC), 'Back is the quiet ghost voice, not a competing button');
}

// ---------- 5. Consistent step labels ----------
{
  ok(/<p class="intro__how">Step 1 of 4<\/p>\s*<h1 class="intro__title">Let's make this yours\.<\/h1>/.test(SRC), 'step 1 carries its step count');
  ok(/lbl\.textContent = introBuilding \? "Step 2 of 4" : "Here's how it works";/.test(SRC), 'step 2 shows "Step 2 of 4" during the flow');
  ok(/lbl\.hidden = introBuilding \? false : !nm;/.test(SRC), 'info-mode keeps the old personalised-only "Here\'s how it works" label');
  ok(/<p class="intro__how">Step 3 of 4<\/p>/.test(SRC) && /<p class="intro__how">Step 4 of 4<\/p>/.test(SRC), 'steps 3 and 4 unchanged');
}

// ---------- Minors ----------
{
  ok(!/intro__mission/.test(SRC.slice(SRC.indexOf('id="introStep1"'), SRC.indexOf('id="introStep2"'))), 'step 1 mission line removed (one supporting line under the wordmark)');
  ok(/<div class="intro" id="intro" role="dialog" aria-modal="true" aria-label="Welcome" hidden>/.test(SRC), '#intro is a dialog for assistive tech');
  ok(/class="chip is-on" data-act="inj-del"[^>]*aria-label="Remove ' \+ esc\(i\.target\) \+ '"/.test(SRC), 'injury chips are labelled Remove buttons, not aria-pressed toggles');
  ok(!/aria-pressed="true" data-act="inj-del"/.test(SRC), 'no inj-del chip claims to be a pressed toggle anymore');
  ok(/\.chip\[aria-pressed="true"\], \.chip\.is-on \{/.test(SRC), 'the is-on class keeps the same filled chip look');
}

// ---------- Coach-span untouched ----------
{
  const { execFileSync } = require('child_process');
  const spanMd5 = execFileSync('sh', ['-c', "sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5"]).toString().trim();
  ok(spanMd5 === 'ce6452b369d4d1d14fd0bf8560208ce7', 'coach-span md5 unchanged (ce6452b369d4d1d14fd0bf8560208ce7), got ' + spanMd5);
}

console.log(`Intro flow audit fixes (CTA->wizard, injury auto-add, honest default, back, labels + minors): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
