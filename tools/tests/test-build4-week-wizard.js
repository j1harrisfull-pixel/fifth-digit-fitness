// Build 4 (13 July 2026) -- the real Priority 4 rebuild: "Build a week" goes
// from one settings-style page (goal/days/time/weeks/include/equipment all
// stacked at once) to one question per screen, the same .intro__step pattern
// the welcome flow already uses. James's own words: "still looks like a
// settings screen" -- this ticket is the actual fix, not the goal-label
// relabel from the previous ticket (Build 3).
const fs = require('fs');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');
const { execSync } = require('child_process');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

function extractFn(name) {
  const sig = 'function ' + name + '(';
  const at = SRC.indexOf(sig);
  if (at < 0) throw new Error('function not found: ' + name);
  const braceStart = SRC.indexOf('{', at);
  let depth = 0, i = braceStart, inStr = null, prev = '';
  for (; i < SRC.length; i++) {
    const c = SRC[i], nx = SRC[i + 1];
    if (inStr) { if (c === inStr && prev !== '\\') inStr = null; prev = c; continue; }
    if (c === '/' && nx === '/') { const nl = SRC.indexOf('\n', i); i = nl < 0 ? SRC.length : nl; prev = '\n'; continue; }
    if (c === '/' && nx === '*') { const end = SRC.indexOf('*/', i + 2); i = end < 0 ? SRC.length : end + 1; prev = '/'; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; }
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
    prev = c;
  }
  return SRC.slice(at, i);
}

// ---------- 1. Markup: 4 distinct wstep screens, only step 1 visible by default ----------
{
  const wizardStart = SRC.indexOf('id="weekWizard"');
  const wizardEnd = SRC.indexOf('id="weekBuildRow"');
  const wizardHtml = SRC.slice(wizardStart, wizardEnd);
  const steps = [1, 2, 3, 4].map(n => new RegExp('data-wstep="' + n + '"').test(wizardHtml));
  ok(steps.every(Boolean), 'all 4 wstep screens exist inside #weekWizard');
  ok(/data-wstep="1"[\s\S]{0,20}>/.test(wizardHtml) && !/data-wstep="1"[^>]*hidden/.test(wizardHtml), 'step 1 (Goal) has no hidden attribute -- visible by default');
  [2, 3, 4].forEach(n => {
    const re = new RegExp('data-wstep="' + n + '" hidden');
    ok(re.test(wizardHtml), 'step ' + n + ' starts hidden');
  });
  ok(/What's the goal\?/.test(wizardHtml), 'step 1 asks one plain question, not a field label');
  ok(/How many days a week\?/.test(wizardHtml), 'step 2 asks one plain question');
  ok(/How long is each session\?/.test(wizardHtml), 'step 3 asks one plain question (Program length moved to the plan-choice screen in Build 5)');
  ok(/What have you got\?/.test(wizardHtml), 'step 4 asks one plain question');
}

// ---------- 2. Every field from the old single-page form still exists (behaviour-preserving move, not a rewrite) ----------
// bWeeks was removed in Build 5 -- Program length is now answered on the
// plan-choice screen (Just today / One week / Four weeks), not its own step.
{
  ['bGoal', 'bGoalUnsure', 'bDays', 'scheduleAdv', 'bTime', 'bInclude', 'bEquip'].forEach(id => {
    ok(new RegExp('id="' + id + '"').test(SRC), '#' + id + ' still exists (field moved into a wstep, not deleted)');
  });
}

// ---------- 3. Nav: Back/Next buttons exist. Back is always visible (Build 5:
// step 1 no longer has nowhere to go -- it returns to the plan-choice screen). ----------
{
  ok(/id="wizBack" type="button" hidden/.test(SRC), '#wizBack starts hidden in markup (JS un-hides it immediately since it always has somewhere to go now)');
  ok(/id="wizNext" type="button">Next</.test(SRC), '#wizNext exists');
  ok(/id="weekBuildRow"/.test(SRC) && /class="btn-row hidden" id="weekBuildRow"/.test(SRC), '#weekBuildRow (the real Build button) starts hidden -- only revealed on the last step');
}

// ---------- 4. showWeekStep() logic: bounds-clamped, toggles the right things ----------
{
  const fn = extractFn('showWeekStep');
  ok(/Math\.max\(1, Math\.min\(WEEK_WIZARD_STEPS \+ 1, n\)\)/.test(fn), 'showWeekStep clamps between step 1 and the review step (WEEK_WIZARD_STEPS + 1) -- cannot go out of range');
  ok(/el\.hidden = parseInt\(el\.getAttribute\("data-wstep"\), 10\) !== weekWizardStep/.test(fn), 'exactly one wstep is unhidden at a time (the current step)');
  ok(/back\.hidden = false/.test(fn), 'Back is always visible now (Build 5: step 1 goes back to the plan-choice screen instead of nowhere)');
  ok(/next\.hidden = onReview/.test(fn), 'Next is hidden once past the last question (review/build state)');
  ok(/buildRow\.classList\.toggle\("hidden", !onReview\)/.test(fn), 'the real Build button only appears in the review state, matching Next/Back being hidden');
}

// ---------- 5. Picking a goal card auto-advances (a tap answers the question and moves on, like a conversation) ----------
{
  const goalHandlerStart = SRC.indexOf('$("bGoal").addEventListener');
  const goalHandler = SRC.slice(goalHandlerStart, goalHandlerStart + 500);
  ok(/showWeekStep\(weekWizardStep \+ 1\)/.test(goalHandler), 'choosing a goal card advances to the next question automatically');
  const unsureStart = SRC.indexOf('$("bGoalUnsure").addEventListener');
  const unsureHandler = SRC.slice(unsureStart, unsureStart + 300);
  ok(/showWeekStep\(weekWizardStep \+ 1\)/.test(unsureHandler), '"Not sure?" also advances automatically, same as picking a card');
}

// ---------- 6. openPlan() resets to the plan-choice screen every time the sheet opens ----------
{
  const fn = extractFn('openPlan');
  ok(/showPlanChoice\(\)/.test(fn), 'openPlan() always resets to the plan-choice screen (Build 5) -- never resumes mid-flow from a stale state');
}

// ---------- 7. wizNext/wizBack are wired with the right direction (Build 5: Back from step 1 leaves the wizard for the plan-choice screen) ----------
{
  ok(/\$\("wizNext"\)\.addEventListener\("click", function \(\) \{ showWeekStep\(weekWizardStep \+ 1\); \}\)/.test(SRC), 'Next button advances one step');
  ok(/\$\("wizBack"\)\.addEventListener\("click", function \(\) \{ if \(weekWizardStep <= 1\) \{ showPlanChoice\(\); \} else \{ showWeekStep\(weekWizardStep - 1\); \} \}\)/.test(SRC), 'Back button retreats one step, or returns to the plan-choice screen from step 1');
}

// ---------- 8. Just Today mode untouched -- this ticket only rebuilds "Build a week" ----------
{
  ok(/<div id="modeToday" hidden>/.test(SRC), 'modeToday markup untouched');
  ok(/id="todayText"/.test(SRC) && /id="readinessChips"/.test(SRC), 'Just Today fields untouched');
}

// ---------- 9. Coach-span untouched -- this is UI/presentation only ----------
{
  const spanMd5 = execSync(`sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5`).toString().trim();
  ok(spanMd5 === '8dfbd4f07360fc76d5218c38eea8f0ae', 'coach-span md5 unchanged (8dfbd4f07360fc76d5218c38eea8f0ae), got ' + spanMd5);
}

// ---------- 10. No new localStorage key -- wizard step is transient UI state, not persisted ----------
{
  const setItemCalls = SRC.match(/localStorage\.setItem\([^,]+,/g) || [];
  ok(setItemCalls.length === 7, 'localStorage.setItem call count unchanged at 7 (got ' + setItemCalls.length + ')');
}

console.log(`Build 4 (week-build wizard): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
