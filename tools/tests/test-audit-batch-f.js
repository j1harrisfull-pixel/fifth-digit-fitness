// UX audit Batch F (13 July 2026, James: "do all") -- leftovers:
// 1. History/Progress "All lifts (N)" expander -- the top-8 cap silently
//    hid the rest of a long training history.
// 2. Receipt .finish-page__kept gets ellipsis truncation instead of
//    nowrap overflow off the bone page.
// 3. One-time install hint via beforeinstallprompt (Chrome/Android),
//    actionable toast with a real prompt() call; once per install.
// 4. Dead rest-bar RPE picker deleted (showRestRpe + its click handler
//    targeted a #restRpe element whose markup was removed when effort
//    rating moved into the set row); hideRestRpe stays as the null-safe
//    no-op its hide-path callers expect.
// 5. Boot no longer runs an unconditional save() -- a full state
//    serialization on every launch that re-wrote what load() just read.
// 6. Wizard consistency: the time step (nothing else on it) auto-advances
//    like goal; days deliberately keeps Next (optional weekday picker
//    shares its step).
// Deliberately NOT done (with reasons):
// - buildWeightMap/buildLastLogs memoization: Batch B removed the
//   per-keystroke re-render that made them hot; once per render is fine.
// - visualViewport keyboard padding: needs real-device verification.
// - audio-locked fallback: rest-end already vibrates independently of the
//   AudioContext state.
const fs = require('fs');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 1. All-lifts expander ----------
{
  ok(/var historyLiftsExpanded = false;/.test(SRC), 'the expander is session-scoped in-memory state (never persisted)');
  ok(/var liftNames = historyLiftsExpanded \? allLiftNames : allLiftNames\.slice\(0, 8\);/.test(SRC), 'collapsed view keeps the top-8 ranking');
  ok(/'<button type="button" class="history__more" data-act="lifts-all">All lifts \(' \+ allLiftNames\.length \+ '\)<\/button>'/.test(SRC),
    'the expander names the real total');
  ok(/historyLiftsExpanded = true; renderHistoryOverview\(\$\("historyBody"\)\)/.test(SRC), 'wired in the History sheet');
  ok(/historyLiftsExpanded = true; renderHistoryOverview\(\$\("progressBody"\)\)/.test(SRC), 'wired in the Progress tab');
}

// ---------- 2. Receipt kept-cell truncation ----------
{
  ok(/\.finish-page__kept \{[^}]*white-space: nowrap; overflow: hidden; text-overflow: ellipsis; min-width: 0; \}/.test(SRC),
    'a long result string truncates with an ellipsis instead of overflowing the bone receipt');
}

// ---------- 3. Install hint ----------
{
  ok(/window\.addEventListener\("beforeinstallprompt", function \(e\) \{/.test(SRC), 'beforeinstallprompt is captured');
  ok(/var K = "tl:a2hsHinted";[\s\S]{0,120}if \(localStorage\.getItem\(K\)\) return;/.test(SRC), 'the hint shows once per install');
  ok(/toastUndo\("Works best installed as an app", function \(\) \{ try \{ e\.prompt\(\); \} catch \(err\) \{\} \}, "Install"\);/.test(SRC),
    'the hint is actionable -- Install triggers the browser prompt');
}

// ---------- 4. Dead RPE picker removed ----------
{
  ok(SRC.indexOf('function showRestRpe(') === -1, 'showRestRpe (dead: #restRpe markup no longer exists) is deleted');
  ok(SRC.indexOf('restRpeEl.addEventListener') === -1, 'its dead click handler is deleted');
  ok(/function hideRestRpe\(\) \{ restState\.rpeTarget = null; if \(restRpeEl\) restRpeEl\.hidden = true; \}/.test(SRC),
    'hideRestRpe remains as the null-safe no-op its callers expect');
}

// ---------- 5. Boot save removed ----------
{
  // v1.13 onboarding added initOnboard() to this line (wires the new
  // first-run shell) -- same boot sequence, no save() reintroduced.
  ok(/initRest\(\); applyTheme\(\); renderAll\(true\); initPersistence\(\); initIntro\(\); initOnboard\(\); initPullRefresh\(\);/.test(SRC),
    'the boot sequence no longer serializes the whole state unconditionally');
  ok(!/initRest\(\); save\(\);/.test(SRC), 'the old boot-time save() call is gone');
}

// ---------- 6. Wizard auto-advance ----------
{
  ok(/\$\("bTime"\)\.addEventListener\("click", function \(ev\) \{[^\n]*save\(\); syncBuild\(\); showWeekStep\(weekWizardStep \+ 1\); \}\);/.test(SRC),
    'picking a session length auto-advances (its step holds nothing else)');
  ok(/\$\("bDays"\)\.addEventListener\("click", function \(ev\) \{[^\n]*save\(\); syncBuild\(\); \}\);/.test(SRC),
    'picking days does NOT auto-advance -- the optional weekday picker shares its step');
}

// ---------- 7. Coach-span untouched ----------
{
  const { execFileSync } = require('child_process');
  const spanMd5 = execFileSync('sh', ['-c', "sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5"]).toString().trim();
  ok(spanMd5 === '909fbc92112ba642ed56d6d88b114fb1', 'coach-span md5 unchanged (909fbc92112ba642ed56d6d88b114fb1), got ' + spanMd5);
}

console.log(`UX audit Batch F (leftovers): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
