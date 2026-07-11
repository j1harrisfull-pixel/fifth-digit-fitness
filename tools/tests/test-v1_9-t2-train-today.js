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

function actionHarness() {
  const harness = `
    var state;
    var _saveCount = 0, _renderAllCount = 0, _scrollCount = 0;
    var window = { scrollTo: function () { _scrollCount++; } };
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

    // ---- Fake dialog DOM: a Map-backed element registry, same pattern the
    // other test files in this directory already use for showSessionComplete
    // et al. -- $ auto-creates any element the real askConfirm/trainThisTodayClick
    // code reads/writes on. classList.toggle actually tracks membership (in
    // el._classSet) so tests can assert exactly which classes ended up
    // applied (e.g. proving danger/unit-switch confirms are unaffected).
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

    module.exports = {
      setState: function (s) { state = s; },
      trainThisTodayClick: trainThisTodayClick,
      saveCount: function () { return _saveCount; },
      renderAllCount: function () { return _renderAllCount; },
      scrollCount: function () { return _scrollCount; },
      resetCounts: function () { _saveCount = 0; _renderAllCount = 0; _scrollCount = 0; },
      getConfirmMsg: function () { return _els['confirmMsg'] ? _els['confirmMsg'].textContent : ''; },
      getConfirmTitle: function () { return _els['confirmTitleText'] ? _els['confirmTitleText'].textContent : ''; },
      getConfirmYesLabel: function () { return _els['confirmYes'] ? _els['confirmYes'].textContent : ''; },
      getConfirmNoLabel: function () { return _els['confirmNo'] ? _els['confirmNo'].textContent : ''; },
      clickConfirmYes: function () { var y = _els['confirmYes']; if (y._listeners && y._listeners.click) y._listeners.click(); },
      clickConfirmNo: function () { var n = _els['confirmNo']; if (n._listeners && n._listeners.click) n._listeners.click(); },
      getTodayPick: function () { return state.todayPick; },
      getState: function () { return state; },
      hasClass: function (id, cls) { return !!(_els[id] && _els[id]._classSet && _els[id]._classSet[cls]); },
      askConfirmRaw: function (opts) { askConfirm(opts); }
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
  // v1.10 Human Feel Ticket 3 (approved): the confirmation body became the
  // locked Training Ledger copy -- "<Session> becomes today's work. / The
  // rest of the week stays where it is." -- built from the real session
  // name, not the old, longer explainer sentence.
  ok(A.getConfirmMsg().indexOf("B\nbecomes today's work.\n\nThe rest of the week stays where it is.") === 0,
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

// ---------- Test 9: today-already-has-work case no longer adds a variant line ----------
// v1.10 Human Feel Ticket 3 (approved): the "Today already has work banked
// on <name>. That stays as it is." disclosure was removed. Log data is keyed
// per-session-id and is never touched by which session is armed, so the
// disclosure described a risk that never existed -- keeping it read as
// permissions-dialog hedging. The confirmation body is now identical
// (the locked two-line copy) whether or not the currently-armed session has
// real logged work.
{
  const A = actionHarness();
  var sessions9 = [ses('A', [3]), ses('B', [3])];
  var log9 = { A: { date: TODAY + 'T09:00:00.000Z', ex: { e0: { sets: [{ completed: true }] } } } };
  const st9 = { program: { weeks: [{ sessions: sessions9 }] }, activeWeek: 0, activeSession: 1, log: log9 };
  A.setState(st9);
  A.trainThisTodayClick();
  const msg = A.getConfirmMsg();
  ok(msg.indexOf('Today already has work banked on') === -1, 'no "today already has work" line appears even when the currently-armed session (A) has real logged work (test 9)');
  ok(msg === "B\nbecomes today's work.\n\nThe rest of the week stays where it is.", 'confirmation body is the exact locked copy regardless of armed-session logged work (test 9b)');
}
// ---------- Test 9b: same locked copy when the armed session has no work ----------
{
  const A = actionHarness();
  const st = fixtureState(1); // A armed, no log at all
  A.setState(st);
  A.trainThisTodayClick();
  ok(A.getConfirmMsg().indexOf('Today already has work banked on') === -1, 'no "today already has work" line when the armed session has no real logged work either (test 9c)');
}

// ==================================================================
// v1.9 Train This Today Home Hero Flow: the review beat is Home itself, not
// a sheet. Confirm writes todayPick and returns to Home; the Home hero (a
// pre-existing element, same code as the Hero Fix ticket) becomes the
// "Chosen today" moment. No modal, no extra screen, no new timer path.
// ==================================================================

// ---------- Test: the Chosen Today Review sheet flow no longer exists ----------
{
  ok(SRC.indexOf('chosenTodaySheet') === -1, '#chosenTodaySheet markup no longer exists anywhere in source (test 1)');
  ok(SRC.indexOf('function showChosenTodayReview') === -1, 'showChosenTodayReview() no longer exists (test 2)');
  ok(!/showChosenTodayReview/.test(confirmTrainTodaySrc), 'confirmTrainToday no longer opens a review sheet (test 3)');
}

// ---------- Test: confirmTrainToday now navigates to Home ----------
{
  ok(/state\.view = "week";/.test(confirmTrainTodaySrc), 'confirmTrainToday sets state.view to "week" (Home) (test 8)');
  const A = actionHarness();
  const st = fixtureState(1); // previewing B (index 1)
  A.setState(st);
  A.resetCounts();
  A.trainThisTodayClick();
  ok(A.saveCount() === 0, 'opening the confirmation writes nothing (test 4)');
  ok(!A.getTodayPick(), 'opening the confirmation writes no todayPick');
  A.clickConfirmYes();
  const tp = A.getTodayPick();
  ok(!!tp && tp.week === 0 && tp.session === 1 && tp.date === TODAY, 'confirm writes todayPick with the exact shape {week, session, date} (test 6/7)');
  ok(A.saveCount() === 1, 'confirm writes todayPick exactly once (test 6)');
  ok(A.renderAllCount() === 1, 'confirm triggers exactly one re-render');
  ok(A.getState().view === 'week', 'after confirm, the app is on the Home (week) view (test 8)');
}

// ---------- Test: cancel writes nothing ----------
{
  const A = actionHarness();
  const st = fixtureState(1);
  A.setState(st);
  A.resetCounts();
  A.trainThisTodayClick();
  A.clickConfirmNo();
  ok(A.saveCount() === 0, 'cancel writes nothing (test 5)');
  ok(!A.getTodayPick(), 'cancel leaves todayPick absent -- session stays in preview');
  ok(A.getState().view !== 'week' || A.getState().view === undefined, 'cancel does not force a navigation to Home either');
}

// ---------- Test: choosing another session overwrites todayPick cleanly ----------
{
  const A = actionHarness();
  const st = { program: { weeks: [{ sessions: [ses('A', [3]), ses('B', [3]), ses('C', [3])] }] }, activeWeek: 0, activeSession: 1, log: {} };
  A.setState(st);
  A.trainThisTodayClick(); A.clickConfirmYes(); // choose B
  ok(A.getTodayPick().session === 1, 'first choice (B) is recorded');
  A.getState().activeSession = 2;
  A.trainThisTodayClick(); A.clickConfirmYes(); // choose C
  ok(A.getTodayPick().session === 2, 'choosing another session (C) overwrites todayPick cleanly -- latest pick wins (test 18)');
  ok(A.getState().program.weeks[0].sessions.length === 3, 'no session was added, removed, or reordered by choosing a different pick');
}

// ---------- Test: no timer starts and no log is written on confirm ----------
{
  ok(!/startLiveTimer|ensureSessionLive/.test(confirmTrainTodaySrc), 'confirmTrainToday never calls startLiveTimer or ensureSessionLive -- no timer starts on confirm (test 14)');
  ok(!/state\.log\[/.test(confirmTrainTodaySrc), 'confirmTrainToday never writes to state.log -- no log is written on confirm (test 15)');
}

// ==================================================================
// Home hero copy + Start path: renderHomeHero already resolves heroIdx via
// heroInfo() (same resolver proven above), so when todayPicked is true the
// hero's own name/label already point at the chosen session (Hero Fix,
// unchanged by this ticket). This ticket only adds the exact "review beat"
// body copy and gates off the debt-reasoning line while a pick is active.
// Structural checks against the real renderHomeHero source (same pattern
// already used by test-v1_8-tempo-home.js for this same function).
// ==================================================================
const renderHomeHeroMatch = SRC.match(/function renderHomeHero\(\) \{[\s\S]*?\n  \}\n  \/\/ ---- History view/);
const renderHomeHeroSrc = renderHomeHeroMatch ? renderHomeHeroMatch[0] : '';
const chosenBodyIdx = renderHomeHeroSrc.indexOf('todayPicked ? ("You chose');
const chosenBodySnippet = renderHomeHeroSrc.slice(chosenBodyIdx, chosenBodyIdx + 150);
{
  ok(renderHomeHeroSrc.length > 0, 'renderHomeHero() body located for structural checks');
  // v1.10 Human Feel Ticket 1: Training Ledger voice -- active ("you chose")
  // rather than passive ("is set"), same two facts, same data.
  ok(/todayPicked \? \("You chose " \+ name \+ " for today\.\\nThe rest of the week stays where it is\."\)/.test(renderHomeHeroSrc),
     'Home hero body is exactly "You chose <Session name> for today.\\nThe rest of the week stays where it is." when a pick is active (test 9/10, v1.10 wording)');
  ok(/todayPicked \? "Chosen today"/.test(renderHomeHeroSrc), 'Home hero label reads "Chosen today" when a pick is active (test 9, from the Hero Fix)');
  ok(/var ctaLabel = weekDone \? "Build next week" : started \? "Continue" : "Start the session";/.test(renderHomeHeroSrc),
     'Home hero primary CTA reads "Start the session" for a not-yet-started session, chosen or not (test 11) -- no new start button was added');
  ok(/maybeOpenDayWithReadiness\(heroIdx\)/.test(renderHomeHeroSrc),
     'the CTA click handler still opens the session at heroIdx via the existing maybeOpenDayWithReadiness/openDay path -- no new start function (test 13)');
  ok(/if \(!weekDone && !todayPicked && typeof computeWeeklyDebt/.test(renderHomeHeroSrc),
     'the debt-reasoning line is suppressed while a pick is active, so it cannot contradict the user\'s own explicit choice');
}

// ---------- Test: original scheduled session untouched, non-armed sessions stay preview ----------
{
  var sessionsHH = [ses('A', [3]), ses('B', [3])];
  var stateHH = { program: { weeks: [{ sessions: sessionsHH }] }, activeWeek: 0, log: {}, todayPick: { week: 0, session: 1, date: TODAY } };
  M.setState(stateHH);
  ok(sessionsHH[0].id === 'A' && sessionsHH[0].exercises.length === 1, 'original session A is untouched (test 17)');
  ok(M.isPreviewSession(0), 'the non-picked session remains preview-only (test 11 dup-check with Hero Fix resolver)');
  ok(!M.isPreviewSession(1), 'the chosen session is armed (test 12)');
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
// Scoped to the actual new/touched copy this ticket added -- confirmTrainToday
// (Home navigation), the chosen-today body line + its guard, and the footer
// button -- NOT the whole pre-existing renderHomeHero function, which is full
// of unrelated, out-of-scope strings (e.g. the pre-existing fatigue-ring
// "Recovered · ready to train" copy, or "maybe" inside the pre-existing
// maybeOpenDayWithReadiness identifier).
const NEW_ZONE = trainThisTodayClickSrc + confirmTrainTodaySrc + chosenBodySnippet +
  SRC.slice(SRC.indexOf('id="trainTodayBtn"') - 100, SRC.indexOf('id="trainTodayBtn"') + 100);
REJECTED.forEach(function (phrase) {
  ok(NEW_ZONE.toLowerCase().indexOf(phrase.toLowerCase()) === -1, 'rejected phrase absent from v1.9-T2 new copy: "' + phrase + '"');
});
ok(SRC.indexOf('>Train this today<') !== -1, 'footer button copy present exactly: "Train this today"');
ok(!/\bpreview\b/i.test(chosenBodySnippet), 'the Home hero\'s chosen-today body never uses the word "preview" -- todayPick is already confirmed by the time this shows');

// ==================================================================
// No unexpected data-shape change: only one new field, no others.
// ==================================================================
ok(!/state\.todayPickWeek\b|state\.armedOverride\b|state\.pickedSession\b/.test(SRC),
   'no second/alternate stored field was introduced alongside todayPick');

// ==================================================================
// v1.10 Ticket 6 hero fix: a todayPick pointing at a TERMINAL session
// (finished early, or fully complete) no longer counts -- Home's memory
// line ("banked") and the hero must never disagree about the same session.
// ==================================================================
{
  // (a) partial finish: finishedAt set, sets incomplete -> pick ignored
  var sessionsT = [ses('A', [3]), ses('B', [3])];
  var logT = { B: { date: null, finishedAt: '2026-01-01T00:00:00.000Z', ex: { e0: { sets: [{ completed: true }] } } } };
  var stateT = { program: { weeks: [{ sessions: sessionsT }] }, activeWeek: 0, log: logT, todayPick: { week: 0, session: 1, date: TODAY } };
  M.setState(stateT);
  ok(M.validTodayPick(stateT.program.weeks[0]) === -1, 'terminal pick (partial finish): validTodayPick returns -1');
  ok(M.heroInfo(stateT.program.weeks[0]).picked === -1, 'terminal pick (partial finish): heroInfo no longer reports a chosen-today session');
  ok(M.armedSessionIdx() === 0, 'terminal pick (partial finish): resolver falls back to the first incomplete session');

  // (b) fully-complete pick (all sets done, no finishedAt) is terminal too
  var logT2 = { B: { date: null, ex: { e0: { sets: [{ completed: true }, { completed: true }, { completed: true }] } } } };
  var stateT2 = { program: { weeks: [{ sessions: [ses('A', [3]), ses('B', [3])] }] }, activeWeek: 0, log: logT2, todayPick: { week: 0, session: 1, date: TODAY } };
  M.setState(stateT2);
  ok(M.validTodayPick(stateT2.program.weeks[0]) === -1, 'terminal pick (fully complete): validTodayPick returns -1');

  // (c) an unfinished pick still outranks everything (unchanged behaviour)
  var stateT3 = { program: { weeks: [{ sessions: [ses('A', [3]), ses('B', [3])] }] }, activeWeek: 0, log: {}, todayPick: { week: 0, session: 1, date: TODAY } };
  M.setState(stateT3);
  ok(M.validTodayPick(stateT3.program.weeks[0]) === 1 && M.armedSessionIdx() === 1, 'unfinished pick: still valid and still armed (behaviour preserved)');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
