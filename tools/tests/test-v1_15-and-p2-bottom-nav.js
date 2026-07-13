// v1.15 Bottom Navigation -- 3-tab persistent bar (Home/Train/Settings),
// Build moved onto Home as page content, History folded into Train as a
// segment. Entirely outside the coach-span. Reuses existing openPlan(),
// the existing Preview mechanism (openPreview/renderPreview/closePreview),
// and the existing History row-rendering (extracted into
// renderHistoryOverview so both the modal and the inline Train segment
// call the identical function, not a duplicate).
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

// ---------- 2. New nav bar has exactly 3 items: Home, Train, Settings ----------
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
  ok(JSON.stringify(labels) === JSON.stringify(['Home', 'Train', 'Settings']), 'labels are exactly Home, Train, Settings in order (got ' + JSON.stringify(labels) + ')');
  ok(!/History/.test(navSrc), 'no stray "History" tab in the bottom nav');
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

// ---------- 4b. .segtoggle respects the [hidden] attribute ----------
// A same-specificity author rule (.segtoggle { display: flex }) silently
// beats the UA stylesheet's [hidden] rule unless explicitly re-asserted --
// without this, a week-row-triggered Preview (trainMode false, toggle
// legitimately hidden) would show the Today/History pill anyway.
{
  ok(/\.segtoggle\[hidden\]\s*\{\s*display:\s*none;?\s*\}/.test(SRC),
     '.segtoggle[hidden] explicitly forces display:none so the toggle truly hides for non-Train previews');
}

// ---------- 5. Train's Today segment reuses existing preview render (no duplicate fn) ----------
{
  ok(/function openTrain\(\)/.test(SRC), 'openTrain() exists');
  const openTrainSrc = SRC.slice(SRC.indexOf('function openTrain('), SRC.indexOf('\n}', SRC.indexOf('function openTrain(')));
  ok(/openPreview\(/.test(openTrainSrc), 'openTrain() calls the existing openPreview() -- no duplicate render path');
  ok(/heroInfo\(/.test(openTrainSrc), 'openTrain() reuses heroInfo() -- same selection logic as the Home hero, nothing new invented');
  // Two `function renderPreview(` matches exist: the module-level Preview-
  // screen renderer (2-space indent) and an unrelated same-named local
  // function nested inside onBuild()'s Build-preview-sheet code (4-space
  // indent, pre-existing, untouched by this ticket). Only the module-level
  // one is in scope here -- Train's Today segment must not add a second one.
  const renderPreviewDefs = (SRC.match(/^  function renderPreview\(/gm) || []).length;
  ok(renderPreviewDefs === 1, 'exactly one module-level renderPreview() definition exists (got ' + renderPreviewDefs + ') -- Today segment is not a second implementation');
}

// ---------- 6. Train's History segment reuses existing history row-rendering ----------
{
  const renderHistoryOverviewDefs = (SRC.match(/function renderHistoryOverview\(/g) || []).length;
  ok(renderHistoryOverviewDefs === 1, 'exactly one renderHistoryOverview() definition exists (got ' + renderHistoryOverviewDefs + ')');
  ok(/renderHistoryOverview\(\$\("historyBody"\)\)/.test(SRC), 'the History sheet (modal) calls renderHistoryOverview(historyBody)');
  ok(/function showTrainHistory\(\)/.test(SRC), 'showTrainHistory() exists');
  const showTrainHistorySrc = SRC.slice(SRC.indexOf('function showTrainHistory('), SRC.indexOf('\n}', SRC.indexOf('function showTrainHistory(')));
  ok(/renderHistoryOverview\(hb\)/.test(showTrainHistorySrc), 'Train\'s History segment calls the SAME renderHistoryOverview() targeting trainHistoryBody -- not a duplicate');
}

// ---------- 7. Fresh-install: Train tab present with dimmed/disabled visual state ----------
{
  ok(/id="navTrain"/.test(SRC), 'navTrain button exists unconditionally (not removed on fresh install)');
  ok(/is-dim/.test(SRC), 'a dimmed visual class (is-dim) is used for the fresh-install Train tab state');
  ok(/navTrain\.classList\.toggle\("is-dim", !hasProgram\(\)\)/.test(SRC), 'syncNavBar() toggles is-dim on #navTrain based on !hasProgram() -- dimmed but tappable, not hidden/disabled');
  ok(!/navTrain\.disabled/.test(SRC), 'navTrain is never given the disabled attribute (still tappable per the approved direction)');
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
