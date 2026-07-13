// v1.15 Bottom Navigation -- 3-tab persistent bar, Build moved onto Home as
// page content. Entirely outside the coach-span. Reuses existing openPlan(),
// the existing Preview mechanism (openPreview/renderPreview/closePreview),
// and the existing History row-rendering (renderHistoryOverview).
//
// Master Ticket P2 (2026-07-13) superseded the middle tab: "Train" turned
// out to be an exact duplicate of the Home hero's own tap target (identical
// heroInfo()/started/weekDone branching, identical three destinations), so
// it's gone. Progress takes that tab instead -- history, records, trends
// finally get a real front door (previously only reachable via a per-lift
// drill-down's "back" link) via a new openProgress()/closeProgress() overlay,
// same data-mode-attribute pattern as Preview, rendering the exact same
// renderHistoryOverview() content the modal always used.
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

// ---------- 2. New nav bar has exactly 3 items: Home, Progress, Settings ----------
{
  const navStart = SRC.indexOf('<nav class="bottomnav"');
  ok(navStart > -1, 'bottomnav markup exists');
  const navEnd = SRC.indexOf('</nav>', navStart);
  const navSrc = SRC.slice(navStart, navEnd);
  const itemCount = (navSrc.match(/class="bottomnav__item"/g) || []).length;
  ok(itemCount === 3, 'bottomnav has exactly 3 items (got ' + itemCount + ')');
  const labels = (navSrc.match(/<span class="bottomnav__label">([^<]+)<\/span>/g) || []).map(function (m) {
    return m.replace(/<[^>]+>/g, '');
  });
  ok(JSON.stringify(labels) === JSON.stringify(['Home', 'Progress', 'Settings']), 'labels are exactly Home, Progress, Settings in order (got ' + JSON.stringify(labels) + ')');
  ok(!/Train/.test(navSrc), 'no stray "Train" tab in the bottom nav -- Master Ticket P2 removed it');
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

// ---------- 5. Progress screen reuses existing history-rendering (no duplicate fn) ----------
{
  ok(/function openProgress\(\)/.test(SRC), 'openProgress() exists');
  ok(/function closeProgress\(\)/.test(SRC), 'closeProgress() exists');
  const openProgressSrc = SRC.slice(SRC.indexOf('function openProgress('), SRC.indexOf('\n}', SRC.indexOf('function openProgress(')));
  ok(/renderHistoryOverview\(\$\("progressBody"\)\)/.test(openProgressSrc), 'openProgress() calls the existing renderHistoryOverview() targeting #progressBody -- no duplicate render path');
  const renderHistoryOverviewDefs = (SRC.match(/function renderHistoryOverview\(/g) || []).length;
  ok(renderHistoryOverviewDefs === 1, 'exactly one renderHistoryOverview() definition exists (got ' + renderHistoryOverviewDefs + ') -- Progress is not a second implementation');
  ok(/renderHistoryOverview\(\$\("historyBody"\)\)/.test(SRC), 'the History sheet (modal, still used for the per-lift back-link) also calls the SAME renderHistoryOverview()');
}

// ---------- 6. Progress's lift drill-down reuses the existing per-lift history view ----------
{
  const wireStart = SRC.indexOf('$("progressBody").addEventListener("click"');
  ok(wireStart > -1, '#progressBody has a click handler wired');
  const wireSrc = SRC.slice(wireStart, wireStart + 300);
  ok(/openExerciseHistory\(/.test(wireSrc), 'tapping a lift in Progress calls the existing openExerciseHistory() -- no second inline drill-down implementation');
}

// ---------- 7. Fresh-install: Progress tab present with dimmed/disabled visual state ----------
{
  ok(/id="navProgress"/.test(SRC), 'navProgress button exists unconditionally (not removed on fresh install)');
  ok(/is-dim/.test(SRC), 'a dimmed visual class (is-dim) is used for the fresh-install Progress tab state');
  ok(/navProgress\.classList\.toggle\("is-dim", !hasProgram\(\)\)/.test(SRC), 'syncNavBar() toggles is-dim on #navProgress based on !hasProgram() -- dimmed but tappable, not hidden/disabled');
  ok(!/navProgress\.disabled/.test(SRC), 'navProgress is never given the disabled attribute (still tappable, same convention as before)');
}

// ---------- 7b. swReloadShouldHold() covers the new Progress overlay ----------
{
  const fnStart = SRC.indexOf('function swReloadShouldHold(');
  const fnEnd = SRC.indexOf('\n  }', fnStart);
  const fnSrc = SRC.slice(fnStart, fnEnd);
  ok(/data-mode"\)\s*===\s*"progress"/.test(fnSrc), 'swReloadShouldHold() defers a pending SW reload while the Progress overlay is open, same as Preview');
}

// ---------- 8. Coach-span md5 unchanged ----------
{
  const spanMd5 = execSync(`sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5`).toString().trim();
  ok(spanMd5 === '8dfbd4f07360fc76d5218c38eea8f0ae', 'coach-span md5 unchanged (8dfbd4f07360fc76d5218c38eea8f0ae), got ' + spanMd5);
}

// ---------- 9. No new localStorage key introduced (setItem count unchanged at 7) ----------
{
  const setItemCalls = SRC.match(/localStorage\.setItem\([^,]+,/g) || [];
  ok(setItemCalls.length === 7, 'localStorage.setItem call count unchanged at 7 (got ' + setItemCalls.length + ') -- no new persisted key introduced');
}

console.log(`${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
