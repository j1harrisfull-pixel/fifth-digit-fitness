// v1.15 Bottom Navigation -- persistent bar, Build moved onto Home as page
// content. Entirely outside the coach-span. Reuses existing openPlan() and
// the existing Preview mechanism (openPreview/renderPreview/closePreview).
//
// Master Ticket P2 (2026-07-13) superseded the middle tab: "Train" turned
// out to be an exact duplicate of the Home hero's own tap target (identical
// heroInfo()/started/weekDone branching, identical three destinations), so
// it's gone. Progress took that tab's place for a few days, giving history/
// records/trends a real front door via an openProgress()/closeProgress()
// overlay -- then was itself removed 18 July 2026 (James: "not necessary to
// have"), leaving a plain 2-tab Home/Settings bar. Per-exercise history is
// still reachable from an active session's cards (openExerciseHistory),
// unaffected by either change.
const fs = require('fs');
const { execSync } = require('child_process');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 1. Header no longer contains planBtn/historyBtn/settingsBtn ----------
{
  const headerStart = SRC.indexOf('<header class="topbar">');
  const headerEnd = SRC.indexOf('</header>', headerStart);
  const headerSrc = SRC.slice(headerStart, headerEnd);
  ['planBtn', 'historyBtn', 'settingsBtn'].forEach(function (id) {
    ok(headerSrc.indexOf(id) === -1, 'header markup no longer contains #' + id);
  });
  // No dead click-wiring left anywhere in the file referencing the old ids.
  ['$("planBtn")', '$("historyBtn")', '$("settingsBtn")'].forEach(function (ref) {
    ok(SRC.indexOf(ref) === -1, 'no lingering $(...) reference to ' + ref);
  });
}

// ---------- 2. Nav bar has exactly 2 items: Home, Settings (Progress removed 18 July 2026) ----------
{
  const navStart = SRC.indexOf('<nav class="bottomnav"');
  ok(navStart > -1, 'bottomnav markup exists');
  const navEnd = SRC.indexOf('</nav>', navStart);
  const navSrc = SRC.slice(navStart, navEnd);
  const itemCount = (navSrc.match(/class="bottomnav__item"/g) || []).length;
  ok(itemCount === 2, 'bottomnav has exactly 2 items (got ' + itemCount + ')');
  const labels = (navSrc.match(/<span class="bottomnav__label">([^<]+)<\/span>/g) || []).map(function (m) {
    return m.replace(/<[^>]+>/g, '');
  });
  ok(JSON.stringify(labels) === JSON.stringify(['Home', 'Settings']), 'labels are exactly Home, Settings in order (got ' + JSON.stringify(labels) + ')');
  ok(!/Train/.test(navSrc), 'no stray "Train" tab in the bottom nav -- Master Ticket P2 removed it');
  ok(!/Progress/.test(navSrc), 'no stray "Progress" tab in the bottom nav -- removed 18 July 2026');
}

// ---------- 3. Bar hidden/hold condition includes state.view === "day" ----------
{
  const renderAllStart = SRC.indexOf('function renderAll(');
  const renderAllEnd = SRC.indexOf('\n}', renderAllStart);
  const renderAllSrc = SRC.slice(renderAllStart, renderAllEnd);
  ok(/bn\.hidden\s*=\s*\(state\.view === "day"\)/.test(renderAllSrc), 'renderAll() hides #bottomNav when state.view === "day"');
}

// ---------- 3b. Fresh-install (no program) doesn't double up on Build: the ----------
// ---------- empty-week-list branch only adds its own row when hasProgram(). ----------
{
  ok(/'<div class="empty">.*<\/div>' \+ \(hasProgram\(\) \? buildRowHtml\(\) : ''\)/.test(SRC),
     'the empty-sessions branch only appends buildRowHtml() when hasProgram() is true -- the true fresh-install state relies solely on the big hero CTA, no duplicate row');
}

// ---------- 4. Home's build-row present in week-list render, wired to openPlan ----------
{
  ok(/function buildRowHtml\(\)/.test(SRC), 'buildRowHtml() exists');
  ok(/class="build-row" id="homeBuildRow"/.test(SRC), 'build-row markup present');
  ok(/renderWeekList\.innerHTML|\}\)\.join\(""\) \+ buildRowHtml\(\)/.test(SRC) || /join\(""\) \+ buildRowHtml\(\)/.test(SRC), 'buildRowHtml() appended to week-list render output');
  const weekListClickStart = SRC.indexOf('weekListEl.addEventListener("click"');
  const weekListClickEnd = SRC.indexOf('\n  });', weekListClickStart);
  const weekListClickSrc = SRC.slice(weekListClickStart, weekListClickEnd);
  ok(/#homeBuildRow.*openPlan\(\); return;/.test(weekListClickSrc), 'build-row click delegates to the existing openPlan() (same function reference)');
}

// ---------- 4b. openTrain/showTrainToday/showTrainHistory/trainMode are gone ----------
{
  ['function openTrain(', 'function showTrainToday(', 'function showTrainHistory(', 'trainMode', 'navTrain', 'trainSegToday', 'trainSegHistory', 'trainSegToggle', 'trainHistoryBody'].forEach(function (needle) {
    ok(SRC.indexOf(needle) === -1, 'no lingering reference to "' + needle + '" -- Master Ticket P2 removed the Train tab entirely');
  });
}

// ---------- 5/6/7/7b. Progress screen, its drill-down, and its nav state ----------
// (Removed 18 July 2026 along with the Progress tab itself, James: "not
// necessary to have". openProgress/closeProgress/renderHistoryOverview and
// the #progressBody/#navProgress elements no longer exist. Per-exercise
// history (openExerciseHistory) is unaffected -- still reachable from an
// active session's cards, verified in test-audit-tier1/tier2.)
ok(SRC.indexOf('function openProgress(') === -1, 'openProgress() is gone');
ok(SRC.indexOf('function closeProgress(') === -1, 'closeProgress() is gone');
ok(SRC.indexOf('function renderHistoryOverview(') === -1, 'renderHistoryOverview() is gone (its only callers were Progress and the dead History-sheet overview list)');
ok(SRC.indexOf('id="navProgress"') === -1, 'navProgress button is gone');
ok(SRC.indexOf('id="progressBody"') === -1, 'progressBody element is gone');

// ---------- 8. Coach-span md5 unchanged ----------
{
  const spanMd5 = execSync(`sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5`).toString().trim();
  ok(spanMd5 === '1081700e58396438a0b408febcfdc56b', 'coach-span md5 unchanged (1081700e58396438a0b408febcfdc56b), got ' + spanMd5);
}

// ---------- 9. No new localStorage key introduced (setItem count unchanged at 7) ----------
{
  const setItemCalls = SRC.match(/localStorage\.setItem\([^,]+,/g) || [];
  ok(setItemCalls.length === 10, 'localStorage.setItem call count unchanged at 10 (Batch A: tl:liveSid; Batch D: quarantine-recovery restore; Batch F: tl:a2hsHinted install-hint flag) (got ' + setItemCalls.length + ') -- no new persisted key introduced');
}

console.log(`${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
