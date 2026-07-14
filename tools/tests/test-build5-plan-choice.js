// Build 5 (13 July 2026) -- James: "the order should be Just today, 1 week,
// 4 week" -- merges the old two-tier choice (Build-a-week vs Just-today
// mode toggle, THEN a separate "Program length" step three questions deep)
// into one true first question: "How much do you want to plan?" with three
// options -- Just today / One week / Four weeks. Picking a week length sets
// buildPrefs().weeks and enters the existing Goal->Days->Time->Equipment
// wizard; picking Just today drops straight into the unchanged Just-Today
// screen, exactly as the old mode toggle did.
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

// ---------- 1. Markup: three choices in the exact order James asked for ----------
{
  const start = SRC.indexOf('id="planChoiceStep"');
  const end = SRC.indexOf('id="modeWeek"');
  const html = SRC.slice(start, end);
  const todayAt = html.indexOf('data-plan="today"');
  const oneAt = html.indexOf('data-plan="1"');
  const fourAt = html.indexOf('data-plan="4"');
  ok(todayAt >= 0 && oneAt > todayAt && fourAt > oneAt, 'the three plan choices appear in order: Just today, One week, Four weeks');
  ok(/Just today/.test(html) && /One week/.test(html) && /Four weeks/.test(html), 'plan-choice labels read as a clean trio (not "Single week" / "4-week block")');
  ok(/How much do you want to plan\?/.test(html), 'plan-choice asks one plain question');
}

// ---------- 2. The old two-tier controls are gone: no #planMode, no #bWeeks ----------
{
  ok(!/id="planMode"/.test(SRC), 'the old Build-a-week/Just-today mode toggle is gone (replaced by the 3-way plan choice)');
  ok(!/id="bWeeks"/.test(SRC), 'the old separate "Program length" step is gone (folded into the plan choice)');
}

// ---------- 3. choosePlan(): "today" enters Just Today unchanged; "1"/"4" set weeks and enter the wizard at Goal ----------
{
  const fn = extractFn('choosePlan');
  ok(/setPlanMode\("today"\)/.test(fn), 'choosePlan("today") calls the existing, unchanged setPlanMode("today")');
  ok(/buildPrefs\(\)\.weeks = parseInt\(plan, 10\)/.test(fn), 'choosing a week length sets buildPrefs().weeks directly from the choice');
  ok(/setPlanMode\("week"\)/.test(fn) && /showWeekStep\(1\)/.test(fn), 'choosing a week length enters the existing wizard at step 1 (Goal)');
}

// ---------- 4. showPlanChoice(): hides both modes, shows the plan-choice screen, and reflects the current weeks pref ----------
{
  const fn = extractFn('showPlanChoice');
  ok(/\$\("planChoiceStep"\)\.hidden = false/.test(fn), 'showPlanChoice() reveals the plan-choice screen');
  ok(/\$\("modeWeek"\)\.hidden = true/.test(fn) && /\$\("modeToday"\)\.hidden = true/.test(fn), 'showPlanChoice() hides both modes while the choice is showing');
  ok(/parseInt\(plan, 10\) === p\.weeks/.test(fn), 'reopening the sheet highlights whichever week length was last used (per the "should feel pre-selected" fix)');
}

// ---------- 5. openPlan() always resets to the plan choice, not into a stale mode ----------
{
  const fn = extractFn('openPlan');
  ok(/showPlanChoice\(\)/.test(fn), 'openPlan() resets to the plan-choice screen every time the sheet opens');
}

// ---------- 6. The substitute-day entry point ("Fancy a different session?") still skips straight to Just Today, unchanged behaviour ----------
{
  const fn = extractFn('openPlanForSubstitute');
  ok(/choosePlan\("today"\)/.test(fn), 'openPlanForSubstitute() still drops straight into Just Today, bypassing the plan-choice screen (same UX as before the merge)');
}

// ---------- 7. Back from Goal (wizard step 1) returns to the plan-choice screen, not nowhere ----------
{
  ok(/if \(weekWizardStep <= 1\) \{ showPlanChoice\(\); \}/.test(SRC), 'Back from the first wizard question (Goal) returns to the plan-choice screen');
}

// ---------- 8. Coach-span untouched -- this is UI/presentation only ----------
{
  const spanMd5 = execSync(`sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5`).toString().trim();
  ok(spanMd5 === 'ce6452b369d4d1d14fd0bf8560208ce7', 'coach-span md5 unchanged (ce6452b369d4d1d14fd0bf8560208ce7), got ' + spanMd5);
}

// ---------- 9. No new localStorage key -- plan choice reuses the existing buildPrefs.weeks field ----------
{
  const setItemCalls = SRC.match(/localStorage\.setItem\([^,]+,/g) || [];
  ok(setItemCalls.length === 10, 'localStorage.setItem call count unchanged at 10 (Batch A: tl:liveSid; Batch D: quarantine-recovery restore; Batch F: tl:a2hsHinted install-hint flag) (got ' + setItemCalls.length + ')');
}

console.log(`Build 5 (plan-choice merge): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
