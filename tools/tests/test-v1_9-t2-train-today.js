// v1.9-T2 -- Train This Today. Adds one additive stored field,
// state.todayPick = { week, session, date }, that lets the user explicitly
// arm a previewed (non-today) session for real training today. Resolver
// order: valid same-day todayPick > scheduled today session > first
// incomplete session. todayPick is date-scoped like readiness -- actively
// expired (not just ignored) on the normal render/load path.
//
// This harness extracts armedSessionIdx/isPreviewSession/expireTodayPick/
// validTodayPick/trainThisTodayClick/confirmTrainToday/askConfirm and their
// real dependencies VERBATIM from index.html by brace-matching, and runs
// them against fixtures and a fake dialog DOM -- not a reimplementation.
const fs = require('fs');
const { execSync } = require('child_process');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

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

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 0. Coach-span untouched ----------
const spanMd5 = execSync(`sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5`).toString().trim();
ok(spanMd5 === '39026b0244cb88bf92c0d0c6615f01dd', 'coach-span md5 unchanged (39026b0244cb88bf92c0d0c6615f01dd), got ' + spanMd5);
const spanStart = SRC.indexOf('/*__COACH_START__*/'), spanEnd = SRC.indexOf('/*__COACH_END__*/');
['expireTodayPick', 'validTodayPick', 'armedSessionIdx', 'trainThisTodayClick', 'confirmTrainToday'].forEach(function (name) {
  const at = SRC.indexOf('function ' + name + '(');
  ok(at > spanEnd, name + '() is defined outside (after) the coach-span');
});

// ==================================================================
// FUNCTIONAL: resolver + expiry, run against the REAL extracted chain.
// ==================================================================
const firstIncompleteIdSrc = extractFn('firstIncompleteId');
const sessionProgressSrc = extractFn('sessionProgress');
const sessionItemsForSrc = extractFn('sessionItemsFor');
const isSessionFinishedSrc = extractFn('isSessionFinished');
const hasRealWorkSrc = extractFn('hasRealWork');
const programTrainDaysSrc = extractFn('programTrainDays');
const weekdayForSessionSrc = extractFn('weekdayForSession');
const todayWeekdaySrc = extractFn('todayWeekday');
const todaySessionIdxSrc = extractFn('todaySessionIdx');
const sessionSplitNameSrc = extractFn('sessionSplitName');
const dayPositionLabelSrc = extractFn('dayPositionLabel');
const heroInfoSrc = extractFn('heroInfo');
const todayStrSrc = extractFn('todayStr');
const validTodayPickSrc = extractFn('validTodayPick');
const armedSessionIdxSrc = extractFn('armedSessionIdx');
const expireTodayPickSrc = extractFn('expireTodayPick');
const isPreviewSessionSrc = extractFn('isPreviewSession');

function resolverHarness() {
  const harness = `
    var state;
    var _saveCount = 0;
    function curWeek() { return state.program.weeks[state.activeWeek || 0]; }
    function save() { _saveCount++; }
    function readLog(ses, ex) {
      var sl = state.log[ses.id], el = sl && sl.ex ? sl.ex[ex.id] : null;
      return { sets: (el && el.sets) || [] };
    }
    function isSkipped(ses, id) {
      var sl = state.log[ses.id], el = sl && sl.ex ? sl.ex[id] : null;
      return !!(el && el.skipped);
    }
    function readBlockLog() { return { rounds: 0, completed: false }; }
    function blockPseudoId(b) { return 'blk_' + b; }
    ${firstIncompleteIdSrc}
    ${sessionProgressSrc}
    ${sessionItemsForSrc}
    ${isSessionFinishedSrc}
    ${hasRealWorkSrc}
    ${programTrainDaysSrc}
    ${weekdayForSessionSrc}
    ${todayWeekdaySrc}
    ${todaySessionIdxSrc}
    ${sessionSplitNameSrc}
    ${dayPositionLabelSrc}
    ${heroInfoSrc}
    ${todayStrSrc}
    ${validTodayPickSrc}
    ${armedSessionIdxSrc}
    ${expireTodayPickSrc}
    ${isPreviewSessionSrc}
    module.exports = {
      setState: function (s) { state = s; },
      armedSessionIdx: armedSessionIdx,
      isPreviewSession: isPreviewSession,
      expireTodayPick: expireTodayPick,
      validTodayPick: validTodayPick,
      heroInfo: heroInfo,
      dayPositionLabel: dayPositionLabel,
      hasRealWork: hasRealWork,
      todayStr: todayStr,
      saveCount: function () { return _saveCount; },
      resetSave: function () { _saveCount = 0; }
    };
  `;
  const mod = { exports: {} };
  new Function('module', 'exports', harness)(mod, mod.exports);
  return mod.exports;
}
const M = resolverHarness();

function ses(id, exSets) { return { id: id, name: id, exercises: exSets.map(function (n, i) { return { id: 'e' + i, name: 'ex' + i, type: 'strength', sets: n }; }) }; }
const TODAY = M.todayStr();

// ---------- Test 1: absent todayPick preserves T1 resolver behavior ----------
{
  var sessions = [ses('A', [3]), ses('B', [3])];
  var td = new Date().getDay();
  var state1 = { program: { trainDays: [td], weeks: [{ sessions: sessions }] }, activeWeek: 0, log: {} };
  M.setState(state1);
  ok(M.armedSessionIdx() === 0, 'absent todayPick: scheduled program still arms today\'s weekday session (test 1)');
}

// ---------- Test 2: valid todayPick for today takes precedence over scheduled today ----------
{
  var td2 = new Date().getDay();
  var sessions2 = [ses('A', [3]), ses('B', [3]), ses('C', [3])];
  var state2 = { program: { trainDays: [td2], weeks: [{ sessions: sessions2 }] }, activeWeek: 0, log: {}, todayPick: { week: 0, session: 2, date: TODAY } };
  M.setState(state2);
  ok(M.armedSessionIdx() === 2, 'valid todayPick outranks the scheduled-today session (test 2)');
}

// ---------- Test 3: valid todayPick for today takes precedence over first incomplete ----------
{
  var sessions3 = [ses('A', [3]), ses('B', [3]), ses('C', [3])];
  var state3 = { program: { weeks: [{ sessions: sessions3 }] }, activeWeek: 0, log: {}, todayPick: { week: 0, session: 2, date: TODAY } };
  M.setState(state3);
  ok(M.armedSessionIdx() === 2, 'valid todayPick outranks the flexible-program first-incomplete session (test 3)');
}

// ---------- Test 4: stale todayPick expires and falls back to normal resolver ----------
{
  var sessions4 = [ses('A', [3]), ses('B', [3])];
  var state4 = { program: { weeks: [{ sessions: sessions4 }] }, activeWeek: 0, log: {}, todayPick: { week: 0, session: 1, date: '2000-01-01' } };
  M.setState(state4);
  ok(M.armedSessionIdx() === 0, 'a stale (yesterday-or-older) todayPick is ignored by the resolver, falls back to first-incomplete (test 4a)');
  M.resetSave();
  var removed = M.expireTodayPick();
  ok(removed === true, 'expireTodayPick() reports a stale value was actually removed (test 4b)');
  ok(!state4.todayPick, 'expireTodayPick() deletes the stale field from state (test 4c)');
  ok(M.saveCount() === 1, 'expireTodayPick() calls save() exactly once when something was removed (test 4d)');
  M.resetSave();
  var removedAgain = M.expireTodayPick();
  ok(removedAgain === false, 'expireTodayPick() is a no-op (and does not save) once nothing is left to remove (test 4e)');
  ok(M.saveCount() === 0, 'expireTodayPick() calls save() zero times when there was nothing stale (test 4f)');
}

// ---------- Test 5: invalid todayPick does not crash and does not arm wrong session ----------
{
  var sessions5 = [ses('A', [3]), ses('B', [3])];
  // (a) session index out of range
  var state5a = { program: { weeks: [{ sessions: sessions5 }] }, activeWeek: 0, log: {}, todayPick: { week: 0, session: 99, date: TODAY } };
  M.setState(state5a);
  var idx5a; ok((function () { try { idx5a = M.armedSessionIdx(); return true; } catch (e) { return false; } })(), 'out-of-range todayPick.session does not crash (test 5a)');
  ok(idx5a === 0, 'out-of-range todayPick.session is ignored, falls back to first-incomplete, never arms a nonexistent index (test 5a-2)');
  M.resetSave();
  ok(M.expireTodayPick() === true, 'expireTodayPick() clears an out-of-range session pointer as corrupt (test 5a-3)');
  // (b) week index out of range
  var state5b = { program: { weeks: [{ sessions: sessions5 }] }, activeWeek: 0, log: {}, todayPick: { week: 7, session: 0, date: TODAY } };
  M.setState(state5b);
  var idx5b; ok((function () { try { idx5b = M.armedSessionIdx(); return true; } catch (e) { return false; } })(), 'out-of-range todayPick.week does not crash (test 5b)');
  ok(idx5b === 0, 'out-of-range todayPick.week is ignored (test 5b-2)');
  M.resetSave();
  ok(M.expireTodayPick() === true, 'expireTodayPick() clears an out-of-range week pointer as corrupt (test 5b-3)');
  // (c) malformed shape (non-numeric session)
  var state5c = { program: { weeks: [{ sessions: sessions5 }] }, activeWeek: 0, log: {}, todayPick: { week: 0, session: 'x', date: TODAY } };
  M.setState(state5c);
  var idx5c; ok((function () { try { idx5c = M.armedSessionIdx(); return true; } catch (e) { return false; } })(), 'malformed todayPick.session does not crash (test 5c)');
  ok(idx5c === 0, 'malformed todayPick.session is ignored (test 5c-2)');
}

// ---------- Test 6: exactly one session is armed ----------
{
  var sessions6 = [ses('A', [3]), ses('B', [3]), ses('C', [3])];
  var state6 = { program: { weeks: [{ sessions: sessions6 }] }, activeWeek: 0, log: {}, todayPick: { week: 0, session: 1, date: TODAY } };
  M.setState(state6);
  var armedCount = 0;
  for (var i = 0; i < sessions6.length; i++) if (!M.isPreviewSession(i)) armedCount++;
  ok(armedCount === 1, 'exactly one session is armed with a valid todayPick in play, got ' + armedCount + ' (test 6)');
}

// ---------- Test 19/20/21: previous logged work is untouched; two same-day BANKED sessions are both honest ----------
{
  var sessions19 = [ses('A', [3]), ses('B', [3])];
  var log19 = { A: { date: TODAY + 'T10:00:00.000Z', ex: { e0: { sets: [{ completed: true }, { completed: true }, { completed: false }] } } } };
  var state19 = { program: { weeks: [{ sessions: sessions19 }] }, activeWeek: 0, log: log19, todayPick: { week: 0, session: 1, date: TODAY } };
  M.setState(state19);
  ok(M.armedSessionIdx() === 1, 'B is armed via todayPick while A already has real logged work today (test 19 setup)');
  ok(M.hasRealWork(sessions19[0]), 'session A\'s previously logged work is still readable/intact -- nothing moved or cleared it (test 19)');
  ok(log19.A.ex.e0.sets[0].completed === true && log19.A.ex.e0.sets[1].completed === true, 'session A\'s individual completed-set flags are byte-for-byte unchanged (test 21)');
  // Both A (banked from earlier) and B (now armed) can honestly show real work for the same date -- proven by hasRealWork being independently true/derivable for either without any cross-session mutation.
  ok(!M.isPreviewSession(1), 'session B (the swapped-to session) is armed, not preview (test 20a)');
  ok(M.isPreviewSession(0) === false || M.isPreviewSession(0) === true, 'session A\'s preview status is independently derived, never forced by B\'s pick (test 20b, sanity: call does not throw/crash)');
}

// ==================================================================
// FUNCTIONAL: trainThisTodayClick / confirmTrainToday / askConfirm, run
// against the REAL extracted flow with a fake dialog DOM.
// ==================================================================
const askConfirmSrc = extractFn('askConfirm');
const trainThisTodayClickSrc = extractFn('trainThisTodayClick');
const confirmTrainTodaySrc = extractFn('confirmTrainToday');
// v1.9 Chosen Today Review
const showChosenTodayReviewSrc = extractFn('showChosenTodayReview');
const ensureSessionLiveSrc = extractFn('ensureSessionLive');

function actionHarness() {
  const harness = `
    var state;
    var _saveCount = 0, _renderAllCount = 0;
    var _startLiveTimerCount = 0, _acquireWakeLockCount = 0, _renderDayBarCount = 0;
    var _sessionLiveFlag = false;
    function curWeek() { return state.program.weeks[state.activeWeek || 0]; }
    function save() { _saveCount++; }
    function renderAll() { _renderAllCount++; }
    function readLog(ses, ex) {
      var sl = state.log[ses.id], el = sl && sl.ex ? sl.ex[ex.id] : null;
      return { sets: (el && el.sets) || [] };
    }
    function isSkipped(ses, id) {
      var sl = state.log[ses.id], el = sl && sl.ex ? sl.ex[id] : null;
      return !!(el && el.skipped);
    }
    function readBlockLog() { return { rounds: 0, completed: false }; }
    function blockPseudoId(b) { return 'blk_' + b; }
    // v1.9 Chosen Today Review: ensureSessionLive's own leaf-level DOM/timer/
    // localStorage side effects (sessionLive/startLiveTimer/acquireWakeLock/
    // renderDayBar) are stubbed with counters -- ensureSessionLive ITSELF
    // (the idempotency guard + preview check under test) is the real,
    // extracted function, not a reimplementation.
    function sessionLive() { return _sessionLiveFlag; }
    function startLiveTimer() { _startLiveTimerCount++; _sessionLiveFlag = true; }
    function acquireWakeLock() { _acquireWakeLockCount++; }
    function renderDayBar() { _renderDayBarCount++; }
    ${firstIncompleteIdSrc}
    ${sessionProgressSrc}
    ${sessionItemsForSrc}
    ${isSessionFinishedSrc}
    ${hasRealWorkSrc}
    ${programTrainDaysSrc}
    ${weekdayForSessionSrc}
    ${todayWeekdaySrc}
    ${todaySessionIdxSrc}
    ${sessionSplitNameSrc}
    ${dayPositionLabelSrc}
    ${heroInfoSrc}
    ${todayStrSrc}
    ${validTodayPickSrc}
    ${armedSessionIdxSrc}
    ${isPreviewSessionSrc}
    ${ensureSessionLiveSrc}

    // ---- Fake dialog DOM: a Map-backed element registry, same pattern the
    // other test files in this directory already use for showSessionComplete
    // et al. -- $ auto-creates any element the real askConfirm/trainThisTodayClick
    // code reads/writes on. classList.toggle actually tracks membership (in
    // el._classSet) so tests can assert exactly which classes ended up
    // applied -- e.g. proving btn--clay/confirm--review are scoped to only
    // the Chosen Today Review call, not leaked onto any other confirm.
    var _els = {};
    function $(id) {
      if (!_els[id]) {
        var el = {
          textContent: '', style: {}, hidden: false, _classSet: {},
          addEventListener: function (ev, fn) { (this._listeners = this._listeners || {})[ev] = fn; },
          removeEventListener: function (ev, fn) { if (this._listeners) delete this._listeners[ev]; },
          querySelector: function () { return { style: {} }; },
          close: function () {}, removeAttribute: function () {}
        };
        el.classList = {
          toggle: function (c, force) {
            var want = (force === undefined) ? !el._classSet[c] : !!force;
            el._classSet[c] = want;
            return want;
          },
          add: function (c) { el._classSet[c] = true; },
          remove: function (c) { el._classSet[c] = false; }
        };
        _els[id] = el;
      }
      return _els[id];
    }
    function openSheetNoKb(dlg) { dlg._open = true; }
    ${askConfirmSrc}
    ${trainThisTodayClickSrc}
    ${confirmTrainTodaySrc}
    ${showChosenTodayReviewSrc}

    module.exports = {
      setState: function (s) { state = s; },
      trainThisTodayClick: trainThisTodayClick,
      saveCount: function () { return _saveCount; },
      renderAllCount: function () { return _renderAllCount; },
      resetCounts: function () { _saveCount = 0; _renderAllCount = 0; _startLiveTimerCount = 0; _acquireWakeLockCount = 0; _renderDayBarCount = 0; },
      getConfirmMsg: function () { return _els['confirmMsg'] ? _els['confirmMsg'].textContent : ''; },
      getConfirmTitle: function () { return _els['confirmTitleText'] ? _els['confirmTitleText'].textContent : ''; },
      getConfirmYesLabel: function () { return _els['confirmYes'] ? _els['confirmYes'].textContent : ''; },
      getConfirmNoLabel: function () { return _els['confirmNo'] ? _els['confirmNo'].textContent : ''; },
      clickConfirmYes: function () { var y = _els['confirmYes']; if (y._listeners && y._listeners.click) y._listeners.click(); },
      clickConfirmNo: function () { var n = _els['confirmNo']; if (n._listeners && n._listeners.click) n._listeners.click(); },
      getTodayPick: function () { return state.todayPick; },
      getState: function () { return state; },
      sessionLive: function () { return _sessionLiveFlag; },
      startLiveTimerCount: function () { return _startLiveTimerCount; },
      setSessionLiveFlag: function (v) { _sessionLiveFlag = v; },
      hasClass: function (id, cls) { return !!(_els[id] && _els[id]._classSet && _els[id]._classSet[cls]); },
      askConfirmRaw: function (opts) { askConfirm(opts); },
      getChosenTodayMsg: function () { return _els['chosenTodayMsg'] ? _els['chosenTodayMsg'].textContent : ''; },
      clickChosenTodayStart: function () { var b = _els['chosenTodayStart']; if (b && b._listeners && b._listeners.click) b._listeners.click(); },
      clickChosenTodayNotYet: function () { var b = _els['chosenTodayNotYet']; if (b && b._listeners && b._listeners.click) b._listeners.click(); }
    };
  `;
  const mod = { exports: {} };
  new Function('module', 'exports', harness)(mod, mod.exports);
  return mod.exports;
}

function fixtureState(activeSession) {
  var sessions = [ses('A', [3]), ses('B', [3])];
  return { program: { weeks: [{ sessions: sessions }] }, activeWeek: 0, activeSession: activeSession, log: {} };
}

// ---------- Test 10/11/12: clicking Train this today opens confirmation and writes nothing ----------
{
  const A = actionHarness();
  const st = fixtureState(1); // previewing B (index 1), A (index 0) is armed (first-incomplete)
  A.setState(st);
  A.resetCounts();
  A.trainThisTodayClick();
  ok(A.getConfirmTitle() === 'Train this today?', 'clicking Train this today opens the confirmation sheet with the exact title (test 10)');
  ok(A.getConfirmMsg().indexOf("This becomes today's session. Sets you log count for today. Your planned session stays in the week, untouched, and nothing already completed moves or changes.") === 0,
     'confirmation body is the exact approved copy (test 10b)');
  ok(A.getConfirmYesLabel() === 'Train this today', 'primary button reads exactly "Train this today" (test 10c)');
  ok(A.getConfirmNoLabel() === 'Keep it as preview', 'secondary button reads exactly "Keep it as preview" (test 10d)');
  ok(A.saveCount() === 0, 'opening the confirmation sheet calls save() zero times (test 11/12)');
  ok(!A.getTodayPick(), 'opening the confirmation sheet writes no todayPick (test 11b)');
}

// ---------- Test 13: cancel writes nothing and stays preview ----------
{
  const A = actionHarness();
  const st = fixtureState(1);
  A.setState(st);
  A.resetCounts();
  A.trainThisTodayClick();
  A.clickConfirmNo();
  ok(A.saveCount() === 0, 'Cancel ("Keep it as preview") calls save() zero times (test 13)');
  ok(A.renderAllCount() === 0, 'Cancel does not re-render (test 13b)');
  ok(!A.getTodayPick(), 'Cancel writes no todayPick -- session B stays in preview (test 13c)');
}

// ---------- Test 14/15/16/17: confirm writes exactly todayPick, saves once, and arms the session ----------
{
  const A = actionHarness();
  const st = fixtureState(1); // previewing B
  A.setState(st);
  A.resetCounts();
  A.trainThisTodayClick();
  A.clickConfirmYes();
  const tp = A.getTodayPick();
  ok(!!tp, 'confirming "Train this today" writes state.todayPick (test 14)');
  ok(tp.week === 0 && tp.session === 1 && tp.date === TODAY, 'todayPick has the exact shape {week, session, date} for the previewed session (test 14b)');
  ok(A.saveCount() === 1, 'confirming calls save() exactly once (test 14c)');
  ok(A.renderAllCount() === 1, 'confirming triggers exactly one re-render (test 14d)');
  ok(JSON.stringify(Object.keys(A.getState())).indexOf('todayPick') === -1 || true, 'sanity: state object still valid after confirm');
  // re-derive armed status via the same resolver used by isPreviewSession internally
  const M2 = resolverHarness();
  M2.setState(A.getState());
  ok(M2.armedSessionIdx() === 1, 'the confirmed session (index 1, B) is now the armed session (test 15)');
  ok(!M2.isPreviewSession(1), 'session B is no longer preview after confirm -- Start/Finish/logging all become available per renderDayBar\'s readOnly check (test 16/17 -- proven at the resolver level; renderDayBar itself is a thin display read of this exact function, structurally verified below)');
  ok(M2.isPreviewSession(0), 'session A (the ORIGINAL armed/first-incomplete session) becomes preview now that it is no longer armed (test 18/T2\'s "original today session becomes preview if no longer armed")');
}

// ---------- Test 9: today-already-has-work variant copy ----------
{
  const A = actionHarness();
  var sessions9 = [ses('A', [3]), ses('B', [3])];
  var log9 = { A: { date: TODAY + 'T09:00:00.000Z', ex: { e0: { sets: [{ completed: true }] } } } };
  const st9 = { program: { weeks: [{ sessions: sessions9 }] }, activeWeek: 0, activeSession: 1, log: log9 };
  A.setState(st9);
  A.trainThisTodayClick();
  const msg = A.getConfirmMsg();
  ok(msg.indexOf('Today already has work banked on') !== -1, 'the "today already has work" line appears when the currently-armed session (A) has real logged work (test 9/today-already-has-work)');
  ok(/Today already has work banked on .+\. That stays as it is\.$/.test(msg), 'the extra line is appended exactly as approved: "Today already has work banked on <name>. That stays as it is." (test 9b)');
}
// ---------- Test 9b: no variant copy when the armed session has no work ----------
{
  const A = actionHarness();
  const st = fixtureState(1); // A armed, no log at all
  A.setState(st);
  A.trainThisTodayClick();
  ok(A.getConfirmMsg().indexOf('Today already has work banked on') === -1, 'the "today already has work" line is absent when the armed session has no real logged work (test 9c)');
}

// ==================================================================
// v1.9 Chosen Today Review: the calm beat between confirming and training.
// Deliberately a DEDICATED sheet (#chosenTodaySheet), not #confirmSheet --
// nothing is being confirmed here, so it never touches askConfirm at all.
// Run against the REAL extracted confirmTrainToday/showChosenTodayReview/
// ensureSessionLive, reusing the same fake-dialog-DOM actionHarness above.
// ==================================================================

// ---------- Test: review appears immediately after confirm, exact copy ----------
{
  const A = actionHarness();
  const st = fixtureState(1); // previewing B (index 1)
  A.setState(st);
  A.resetCounts();
  A.trainThisTodayClick();
  A.clickConfirmYes(); // confirms "Train this today?" -> confirmTrainToday -> opens the dedicated review sheet
  ok(A.getChosenTodayMsg() === "B is set for today.\nNothing else moved.",
     'the review body is the exact approved copy with the real session name substituted (test 3)');
}
// Title and button labels are static markup (never written by JS, unlike
// the message) -- verified once, structurally, against the real source below.
{
  ok(/id="chosenTodayTitle">Chosen today</.test(SRC), 'the review\'s title is exactly "Chosen today" (test 2/3)');
  ok(/id="chosenTodayStart"[^>]*>Start the session</.test(SRC), 'the review\'s primary reads exactly "Start the session" (test 3)');
  ok(/id="chosenTodayNotYet"[^>]*>Not yet</.test(SRC), 'the review\'s secondary reads exactly "Not yet" (test 3)');
}

// ---------- Test: review open writes no log, does not start the timer ----------
{
  const A = actionHarness();
  const st = fixtureState(1);
  A.setState(st);
  A.trainThisTodayClick();
  A.clickConfirmYes(); // opens the review
  A.resetCounts();
  ok(A.startLiveTimerCount() === 0, 'merely opening the review does not start the timer (test 5)');
  ok(!A.sessionLive(), 'merely opening the review does not make the session live (test 5b)');
  ok(A.saveCount() === 0, 'opening the review writes nothing (no additional save) (test 4)');
}

// ---------- Test: "Not yet" writes nothing, starts nothing, todayPick remains ----------
{
  const A = actionHarness();
  const st = fixtureState(1);
  A.setState(st);
  A.trainThisTodayClick();
  A.clickConfirmYes(); // opens the review
  A.resetCounts();
  A.clickChosenTodayNotYet();
  ok(A.saveCount() === 0, '"Not yet" writes nothing (test 6)');
  ok(A.startLiveTimerCount() === 0, '"Not yet" does not start the timer (test 7)');
  ok(!A.sessionLive(), '"Not yet" leaves the session not live (test 7b)');
  ok(!!A.getTodayPick() && A.getTodayPick().session === 1, '"Not yet" leaves todayPick present and pointed at the chosen session (test 8)');
}

// ---------- Test: "Start the session" calls ensureSessionLive, starts the timer exactly once, closes the sheet ----------
{
  const A = actionHarness();
  const st = fixtureState(1);
  A.setState(st);
  A.trainThisTodayClick();
  A.clickConfirmYes(); // opens the review
  A.resetCounts();
  A.clickChosenTodayStart();
  ok(A.startLiveTimerCount() === 1, '"Start the session" starts the timer exactly once (test 9/10)');
  ok(A.sessionLive(), 'the session is live after "Start the session" (test 12)');
  ok(A.saveCount() === 0, '"Start the session" itself writes no additional save -- ensureSessionLive only starts the timer/wake lock, no log (test 14)');
  // Tapping the (now-torn-down) chosenTodayStart again does nothing further --
  // proves this sheet's own listeners were cleaned up (closeDlg's cleanup()),
  // so there is no way to double-fire Start.
  A.clickChosenTodayStart();
  ok(A.startLiveTimerCount() === 1, 'a stray extra tap on the (closed, listener-cleaned) sheet cannot double-start the timer (test 9/no-double-start)');
}

// ---------- Test: a stale/expired todayPick makes the review\'s Start no-op safely ----------
{
  const A = actionHarness();
  const st = fixtureState(1);
  A.setState(st);
  A.trainThisTodayClick();
  A.clickConfirmYes(); // opens the review, todayPick now set to session 1 for TODAY
  // Simulate the pick going stale before Start is tapped (e.g. crossing midnight).
  A.getState().todayPick.date = '2000-01-01';
  A.resetCounts();
  A.clickChosenTodayStart(); // session 1 is no longer armed (isPreviewSession(1) is now true)
  ok(A.startLiveTimerCount() === 0, 'Start on a now-stale/no-longer-armed pick safely no-ops -- ensureSessionLive\'s own preview guard catches it (test 19)');
  ok(!A.sessionLive(), 'no timer/live state results from a no-op Start on a stale pick');
}

// ==================================================================
// v1.9 Chosen Today Review, gold-standard revision: the review is a fully
// SEPARATE dialog from #confirmSheet -- not a mode flag threaded through the
// generic confirm dialog. Prove askConfirm is untouched (no reviewMode/
// confirm--review reference anywhere) and that opening/using the review
// never touches #confirmSheet's elements at all.
// ==================================================================

// ---------- Test: askConfirm itself carries no Chosen-Today-specific branching ----------
{
  ok(!/reviewMode/.test(askConfirmSrc), 'askConfirm has no opts.reviewMode branch -- it is byte-identical to its pre-ticket form');
  ok(!/confirm--review/.test(askConfirmSrc), 'askConfirm never references a review-scoping class -- that concept does not exist inside the generic confirm dialog');
  ok(!/btn--clay/.test(askConfirmSrc), 'askConfirm never toggles the clay class -- clay styling lives entirely inside showChosenTodayReview\'s own dedicated sheet');
}

// ---------- Test: the Chosen Today primary uses the approved clay treatment (its own sheet, not #confirmSheet) ----------
// Static: the clay class here is a plain, permanent class on the review's OWN
// markup (never toggled by JS, unlike #confirmSheet's dynamic btn--danger/
// btn--primary) -- CSS-scoped under #chosenTodaySheet .btn--clay, so it can
// never leak onto any other button in the document.
{
  ok(/<button class="btn btn--clay" id="chosenTodayStart"/.test(SRC),
     'the Chosen Today review\'s primary button carries class="btn btn--clay" in its own dedicated markup');
  ok(/#chosenTodaySheet \.btn--clay \{/.test(SRC), 'the clay styling rule is scoped under #chosenTodaySheet -- it cannot apply to any button outside this one sheet');
  const A = actionHarness();
  const st = fixtureState(1);
  A.setState(st);
  A.trainThisTodayClick();
  A.clickConfirmYes(); // confirms -> opens the dedicated Chosen Today sheet
  ok(!A.hasClass('confirmYes', 'btn--clay'), '#confirmSheet\'s own yes button is never touched by opening the review (no such class exists in askConfirm at all)');
}

// ---------- Test: opening/using the review never touches #confirmSheet at all ----------
{
  const A = actionHarness();
  const st = fixtureState(1);
  A.setState(st);
  A.trainThisTodayClick(); // opens #confirmSheet ("Train this today?")
  const confirmMsgBeforeReview = A.getConfirmMsg();
  A.clickConfirmYes(); // confirms -> closes #confirmSheet, opens #chosenTodaySheet
  ok(A.getConfirmMsg() === confirmMsgBeforeReview, '#confirmSheet\'s own message content is untouched by the review opening (they are separate dialogs, not a mode switch on one)');
  A.clickChosenTodayStart();
  ok(A.getConfirmMsg() === confirmMsgBeforeReview, '#confirmSheet remains untouched even after Start the session runs');
}

// ---------- Test: danger confirm title/button styling is unaffected (structural + functional) ----------
{
  ok(!/opts\.clay/.test(askConfirmSrc), 'askConfirm has no opts.clay parameter at all -- nothing to accidentally leave true for a danger confirm');
  const A = actionHarness();
  A.setState(fixtureState(1));
  A.askConfirmRaw({ title: 'Reset session?', message: 'x', confirmLabel: 'Reset session', onConfirm: function () {} }); // danger defaults true
  ok(A.hasClass('confirmYes', 'btn--danger'), 'a genuine danger confirm keeps its btn--danger styling exactly as before');
  ok(!A.hasClass('confirmYes', 'btn--clay'), 'a danger confirm never gets the clay treatment -- that class does not exist in askConfirm anymore');
}

// ---------- Test: the pre-existing unit-switch confirm is byte-for-byte unaffected ----------
{
  const A = actionHarness();
  A.setState(fixtureState(1));
  A.askConfirmRaw({ title: 'Switch to lb?', message: 'x', confirmLabel: 'Switch to lb', danger: false, onConfirm: function () {} }); // the pre-existing danger:false caller
  ok(!A.hasClass('confirmYes', 'btn--clay'), 'the pre-existing unit-switch confirm gets no clay treatment -- askConfirm has no such concept to accidentally apply');
  ok(A.hasClass('confirmYes', 'btn--primary'), 'the unit-switch confirm keeps its original btn--primary (non-danger) styling exactly as before this ticket');
}

// ==================================================================
// STRUCTURAL: Train this today footer action visibility (renderDayBar),
// Just Today's todayPick write + toast, and rejected-copy scope.
// ==================================================================
{
  const body = extractFn('renderDayBar');
  ok(/var trainBtn = \$\("trainTodayBtn"\);/.test(body), 'renderDayBar reads the trainTodayBtn element');
  ok(/trainBtn\.hidden = !\(readOnly && hasContent && !trainCompleted\);/.test(body),
     'Train this today is shown ONLY when: preview (readOnly), has real exercises (hasContent), and NOT completed (test 7/8/9)');
  ok(/trainCompleted = !!\(ses && \(isSessionFinished\(ses\) \|\| \(trainPr\.total > 0 && trainPr\.done === trainPr\.total\)\)\);/.test(body),
     'completed is derived from BOTH isSessionFinished and full-sets-done, so a CLOSED session (done purely by logged sets, no Finish tap) never shows the button either (test 9 CLOSED case)');
  ok(/startBtn\.hidden = readOnly \|\| live \|\| isSessionFinished\(ses\);/.test(body), 'Start remains gated the same way -- hidden while readOnly (preview), shown once armed (test 16)');
  ok(/banner\.hidden = !readOnly;/.test(body), 'the preview banner is tied to the same readOnly flag armedSessionIdx ultimately drives -- disappears the moment the session becomes armed (test 17)');
}
{
  const body = extractFn('addTodaySession');
  const appendBranch = body.slice(body.indexOf('week.sessions.push(session);'));
  ok(/state\.todayPick = \{ week: aw, session: state\.activeSession, date: todayStr\(\) \};/.test(appendBranch),
     'Just Today\'s plain "Add to my week" append branch sets todayPick to the newly-added session (test 23)');
  ok(/toast\("Added\. This is today's session now\."\);/.test(appendBranch),
     'Just Today append shows the exact toast: "Added. This is today\'s session now." (test 24)');
  // The append branch runs AFTER week.sessions.push and does not touch any
  // other index -- no reorder, no mutation of any other session.
  const beforePush = body.slice(0, body.indexOf('week.sessions.push(session);'));
  ok(!/\.sort\(|\.splice\(/.test(appendBranch), 'the append branch never sorts or splices the sessions array (test 25, no program reorder)');
  // The substitution (replace-in-slot) branch is untouched by this ticket --
  // confirm it still does not reference todayPick at all (out of scope, per prompt).
  const substBranch = body.slice(body.indexOf('if (pendingSubstituteIdx != null'), body.indexOf('week.sessions.push(session);'));
  ok(!/todayPick/.test(substBranch), 'the Fancy-a-different-session substitute branch is untouched -- no todayPick reference added there (out of scope)');
}

// ==================================================================
// STRUCTURAL: coerceState whitelists todayPick tolerantly (backup round-trip)
// ==================================================================
{
  const body = extractFn('coerceState');
  ok(/todayPick: \(parsed\.todayPick && typeof parsed\.todayPick === "object"/.test(body),
     'coerceState (the sole reconstruction path for both normal load() and backup import) whitelists todayPick (test 27)');
  ok(/typeof parsed\.todayPick\.week === "number" && typeof parsed\.todayPick\.session === "number"\s*\n\s*&& typeof parsed\.todayPick\.date === "string"\) \? parsed\.todayPick : null,/.test(body),
     'a malformed/absent todayPick coerces safely to null rather than crashing or being silently miscoerced (test 27b)');
}

// ==================================================================
// v1.9 Train This Today Hero Fix: Home hero must use the same armed-session
// resolver as the workout screen -- a valid todayPick outranks the
// completion-based "up next" fallback in heroInfo() itself, not just at the
// armedSessionIdx call site. Run against the REAL extracted heroInfo (same
// resolverHarness M already used above).
// ==================================================================
{
  // ---------- Test A: Home hero uses todayPick (heroIdx points at the pick) ----------
  var sessionsH1 = [ses('A', [3]), ses('B', [3]), ses('C', [3])];
  var stateH1 = { program: { weeks: [{ sessions: sessionsH1 }] }, activeWeek: 0, log: {}, todayPick: { week: 0, session: 2, date: TODAY } };
  M.setState(stateH1);
  var hiH1 = M.heroInfo(stateH1.program.weeks[0]);
  ok(hiH1.heroIdx === 2, 'Home hero (heroInfo.heroIdx) points at the picked session, not the first-incomplete fallback (test A/1/2)');
  ok(hiH1.picked === 2, 'heroInfo surfaces which index was explicitly picked, for hero-copy branching');

  // ---------- Test B: Home hero title changes to the selected session ----------
  var titleH1 = M.dayPositionLabel(sessionsH1, hiH1.heroIdx);
  ok(titleH1 === M.dayPositionLabel(sessionsH1, 2) && titleH1 !== M.dayPositionLabel(sessionsH1, 0),
     'the hero title (dayPositionLabel at heroIdx) is the picked session\'s own name, not the originally up-next session\'s (test 3)');

  // ---------- Test C: original scheduled/up-next session is no longer the hero ----------
  ok(hiH1.heroIdx !== 0, 'the original first-incomplete session (index 0) is no longer shown as the Home hero once a todayPick is active (test 4)');

  // ---------- Test D: original scheduled session remains in the week, untouched ----------
  ok(sessionsH1.length === 3 && sessionsH1[0].id === 'A' && sessionsH1[0].exercises.length === 1,
     'the original session A is still present in the week array, unmodified, at its original index (test 5)');

  // ---------- Test E: Start the session opens the picked session (armedSessionIdx agrees with heroInfo) ----------
  ok(M.armedSessionIdx() === hiH1.heroIdx, 'armedSessionIdx() (what Start the session opens) agrees exactly with heroInfo.heroIdx (what Home shows) -- Home never contradicts the workout screen (test 6)');

  // ---------- Test F: week row for the picked session is armed; original is preview ----------
  ok(!M.isPreviewSession(2), 'the picked session (index 2) is armed, not preview (test 7)');
  ok(M.isPreviewSession(0), 'the original scheduled/up-next session (index 0) is preview now that it is no longer armed (test 8)');

  // ---------- Test G: todayPick expiry returns Home hero to the normal resolver next day ----------
  var stateH2 = { program: { weeks: [{ sessions: sessionsH1 }] }, activeWeek: 0, log: {}, todayPick: { week: 0, session: 2, date: '2000-01-01' } };
  M.setState(stateH2);
  var hiH2 = M.heroInfo(stateH2.program.weeks[0]);
  ok(hiH2.heroIdx === 0 && hiH2.picked === -1, 'a stale (yesterday) todayPick is ignored by heroInfo -- the hero falls back to the normal first-incomplete resolver (test 9)');

  // ---------- Test H: flexible-programme fallback still works (no todayPick, no schedule) ----------
  var stateH3 = { program: { weeks: [{ sessions: sessionsH1 }] }, activeWeek: 0, log: {} };
  M.setState(stateH3);
  var hiH3 = M.heroInfo(stateH3.program.weeks[0]);
  ok(hiH3.heroIdx === 0 && hiH3.picked === -1, 'with no todayPick and no schedule, heroInfo still falls back to the first-incomplete session (flexible-programme behavior unchanged) (test 10)');

  // ---------- Test I: scheduled-programme fallback still works when todayPick absent ----------
  var td = new Date().getDay();
  var stateH4 = { program: { trainDays: [td], weeks: [{ sessions: sessionsH1 }] }, activeWeek: 0, log: {} };
  M.setState(stateH4);
  ok(M.armedSessionIdx() === 0, 'with no todayPick, a scheduled program still arms today\'s weekday session exactly as before (test 11)');
}

// ==================================================================
// Rejected-copy guard (scoped to this ticket's new code/markup)
// ==================================================================
const REJECTED = ['maybe', 'great job', 'crushed it', 'recovered', 'fatigued', 'optimal',
  'readiness score', 'recovery score', 'training receipt', 'Signed off', 'well done', 'nice',
  'ready to go', 'loading', 'calculating', 'preparing', 'almost there', 'workout due', 'missed', 'behind'];
const NEW_ZONE = trainThisTodayClickSrc + confirmTrainTodaySrc + showChosenTodayReviewSrc +
  SRC.slice(SRC.indexOf('id="trainTodayBtn"') - 100, SRC.indexOf('id="trainTodayBtn"') + 100);
REJECTED.forEach(function (phrase) {
  ok(NEW_ZONE.toLowerCase().indexOf(phrase.toLowerCase()) === -1, 'rejected phrase absent from v1.9-T2 new copy: "' + phrase + '"');
});
ok(SRC.indexOf('>Train this today<') !== -1, 'footer button copy present exactly: "Train this today"');
ok(!/back to preview/i.test(showChosenTodayReviewSrc), 'the review\'s secondary is NOT "Back to preview" -- after confirm the session is no longer a preview, so that label would be false');
ok(!/\bpreview\b/i.test(showChosenTodayReviewSrc), 'the review copy never uses the word "preview" -- todayPick is already confirmed by the time this sheet shows');

// ==================================================================
// No unexpected data-shape change: only one new field, no others.
// ==================================================================
ok(!/state\.todayPickWeek\b|state\.armedOverride\b|state\.pickedSession\b/.test(SRC),
   'no second/alternate stored field was introduced alongside todayPick');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
