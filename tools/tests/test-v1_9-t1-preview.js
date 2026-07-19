// v1.9-T1 -- Preview Other Days Safely. Exactly one session is "armed"
// (startable/loggable): the scheduled today session for a trainDays program,
// else the first-incomplete session (heroInfo's nextIdx, the same session
// Home's hero already points at). Every other UNFINISHED session is
// preview-only: full content stays visible, but a central guard makes every
// write action a no-op (never gated button-by-button). A session that is
// already finished/closed keeps its exact v1.8 behavior (completed-session
// read-only is a separate, later ticket).
//
// This harness extracts armedSessionIdx/isPreviewSession and their real
// dependencies (todaySessionIdx, programTrainDays, weekdayForSession,
// todayWeekday, heroInfo, sessionProgress, sessionItemsFor, firstIncompleteId,
// isSessionFinished) VERBATIM from index.html by brace-matching, and runs the
// real resolver logic against fixtures -- not a reimplementation. It then
// verifies, structurally, that the central write guard is the first
// statement in every handler this ticket touches (onListClick, onListInput,
// onDensityAct, ensureSessionLive, endSession, resetDay), and functionally,
// that onListClick/onListInput/onDensityAct/ensureSessionLive genuinely
// no-op (no save(), no state mutation) for every listed write action when
// isPreviewSession is true -- save() is this app's sole path to localStorage,
// so "save() never called" is the direct Node-level equivalent of "localStorage
// byte-identical".
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
ok(spanMd5 === '1081700e58396438a0b408febcfdc56b', 'coach-span md5 unchanged (1081700e58396438a0b408febcfdc56b), got ' + spanMd5);
const spanStart = SRC.indexOf('/*__COACH_START__*/'), spanEnd = SRC.indexOf('/*__COACH_END__*/');

// ---------- 1. Every function this ticket touches lives outside coach-span ----------
['armedSessionIdx', 'isPreviewSession'].forEach(function (name) {
  const at = SRC.indexOf('function ' + name + '(');
  ok(at > spanEnd, name + '() is defined outside (after) the coach-span');
});

// ==================================================================
// Functional: armedSessionIdx / isPreviewSession, run against the REAL
// extracted resolver chain.
// ==================================================================
const firstIncompleteIdSrc = extractFn('firstIncompleteId');
const sessionProgressSrc = extractFn('sessionProgress');
const displayOrderedExercisesSrc = extractFn('displayOrderedExercises');
const sessionItemsForSrc = extractFn('sessionItemsFor');
const isSessionFinishedSrc = extractFn('isSessionFinished');
// 19 July 2026: isPreviewSession now reuses countCompletedSets (a session
// with any completed set is in progress, never preview) -- pull it in too.
const countCompletedSetsSrc = extractFn('countCompletedSets');
const programTrainDaysSrc = extractFn('programTrainDays');
const weekdayForSessionSrc = extractFn('weekdayForSession');
const todayWeekdaySrc = extractFn('todayWeekday');
const todaySessionIdxSrc = extractFn('todaySessionIdx');
const heroInfoSrc = extractFn('heroInfo');
const todayStrSrc = extractFn('todayStr');
const validTodayPickSrc = extractFn('validTodayPick');
const armedSessionIdxSrc = extractFn('armedSessionIdx');
const isPreviewSessionSrc = extractFn('isPreviewSession');

const harness = `
  var state;
  function curWeek() { return state.program.weeks[state.activeWeek || 0]; }
  // Minimal stand-ins for the parts of readLog/isSkipped/density-block
  // reading that sessionItemsFor touches -- only .sets[].completed matters
  // for sessionProgress's done/total math, which is all this resolver test
  // exercises (no density fixtures in these cases).
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
  ${displayOrderedExercisesSrc}
    ${sessionItemsForSrc}
  ${isSessionFinishedSrc}
  ${countCompletedSetsSrc}
  ${programTrainDaysSrc}
  ${weekdayForSessionSrc}
  ${todayWeekdaySrc}
  ${todaySessionIdxSrc}
  ${heroInfoSrc}
  ${todayStrSrc}
  ${validTodayPickSrc}
  ${armedSessionIdxSrc}
  ${isPreviewSessionSrc}
  module.exports = {
    setState: function (s) { state = s; },
    armedSessionIdx: armedSessionIdx,
    isPreviewSession: isPreviewSession,
    heroInfo: heroInfo,
    todaySessionIdx: todaySessionIdx
  };
`;
const mod = { exports: {} };
new Function('module', 'exports', harness)(mod, mod.exports);
const M = mod.exports;

function strengthEx(id, sets) { return { id: id, name: id, type: 'strength', sets: sets, exercises: undefined }; }
function ses(id, exSets) { return { id: id, name: id, exercises: exSets.map(function (n, i) { return { id: 'e' + i, name: 'ex' + i, type: 'strength', sets: n }; }) }; }

// ---------- Test 1: scheduled program arms today's weekday session ----------
{
  var today = new Date().getDay();
  var sessions = [ses('A', [3]), ses('B', [3]), ses('C', [3])];
  var state1 = {
    program: { trainDays: [today], weeks: [{ sessions: sessions }] },
    activeWeek: 0, log: {}
  };
  M.setState(state1);
  ok(M.todaySessionIdx(sessions) === 0, 'todaySessionIdx maps to session 0 when trainDays=[today] (sanity)');
  ok(M.armedSessionIdx() === 0, 'scheduled program: armed session is the one mapped to today\'s weekday (test 1)');
  ok(!M.isPreviewSession(0), 'the armed session is NOT preview (test 1b)');
  ok(M.isPreviewSession(1) && M.isPreviewSession(2), 'every other session IS preview (test 1c)');
}

// ---------- Test 2: flexible program arms the first incomplete session ----------
{
  var sessions2 = [ses('A', [3]), ses('B', [3]), ses('C', [3])];
  var log2 = { A: { date: 'd', ex: { e0: { sets: [{ completed: true }, { completed: true }, { completed: true }] } } } }; // A fully done
  var state2 = { program: { weeks: [{ sessions: sessions2 }] }, activeWeek: 0, log: log2 };
  M.setState(state2);
  ok(M.armedSessionIdx() === 1, 'flexible program: armed session is the first INCOMPLETE session (test 2), skipping the fully-done one');
  ok(!M.isPreviewSession(1), 'session B (armed) is not preview (test 2b)');
  ok(M.isPreviewSession(2), 'session C (not armed, not started) is preview (test 2c)');
  // 19 July 2026 (finish-screen audit) REVERSAL of the old 2d: a session
  // with completed sets but no finishedAt is IN PROGRESS, never preview.
  // The old rule was found live to render the "Planned for later. Nothing
  // logs from here." banner OVER a ticking resumed live timer with the
  // Finish button hidden -- a fully-logged session with no way to close it
  // out. isPreviewSession now short-circuits on countCompletedSets > 0.
  ok(!M.isPreviewSession(0), 'a session with completed sets (even fully done, unfinished) is IN PROGRESS -- never preview (test 2d, reversed 19 Jul 2026)');
}

// ---------- Test 3: exactly one session is armed ----------
{
  var sessions3 = [ses('A', [3]), ses('B', [3]), ses('C', [3])];
  var state3 = { program: { weeks: [{ sessions: sessions3 }] }, activeWeek: 0, log: {} };
  M.setState(state3);
  var armedCount = 0;
  for (var i = 0; i < sessions3.length; i++) if (!M.isPreviewSession(i)) armedCount++;
  ok(armedCount === 1, 'exactly one session is armed (not-preview) at a time, got ' + armedCount + ' (test 3)');
}

// ---------- Test 4: finished session is carved out (unchanged v1.8 re-entry) ----------
{
  var sessions4 = [ses('A', [3]), ses('B', [3])];
  var log4 = { A: { date: 'd', finishedAt: '2026-07-09T10:00:00.000Z', ex: { e0: { sets: [{ completed: true }] } } } };
  var state4 = { program: { weeks: [{ sessions: sessions4 }] }, activeWeek: 0, log: log4 };
  M.setState(state4);
  ok(M.armedSessionIdx() === 1, 'a finished-early session A is skipped by the armed resolver (heroInfo terminal logic) (test 4)');
  ok(!M.isPreviewSession(0), 'a FINISHED session is never preview-gated -- v1.8 re-entry behavior is untouched by this ticket (test 4b)');
}

// ---------- Test 5: nothing armed when the week is fully done ----------
{
  var sessions5 = [ses('A', [1])];
  var log5 = { A: { date: 'd', ex: { e0: { sets: [{ completed: true }] } } } };
  var state5 = { program: { weeks: [{ sessions: sessions5 }] }, activeWeek: 0, log: log5 };
  M.setState(state5);
  ok(M.armedSessionIdx() === -1, 'a fully-complete week has nothing armed (test 5)');
}

// ==================================================================
// Structural: the central write guard is the FIRST statement in every
// handler this ticket touches.
// ==================================================================
// onListInput/onDensityAct/ensureSessionLive/endSession/resetDay have no
// read-only actions of their own (every action they dispatch is a write),
// so they keep the simple "guard is the first statement" shape.
const GUARDED_FNS = ['onListInput', 'onDensityAct', 'ensureSessionLive', 'endSession', 'resetDay'];
GUARDED_FNS.forEach(function (name) {
  const body = extractFn(name);
  const afterBrace = body.slice(body.indexOf('{') + 1);
  const stripped = afterBrace.replace(/\/\/[^\n]*\n/g, '').replace(/\/\*[\s\S]*?\*\//g, '').trim();
  ok(/^if\s*\(isPreviewSession\(/.test(stripped), name + '() checks isPreviewSession as its first executable statement, got: ' + stripped.slice(0, 60));
});
// onListClick classifies read-only navigation (card open/collapse, Form
// notes, cue/warm-up disclosures, History) BEFORE the write guard, per the
// v1.9-T1 fix -- verify: (1) it still computes `preview` up front from
// isPreviewSession, (2) a single named PREVIEW_READ_ONLY_ACTS allowlist
// gates every data-act write in one place (not per-button), and (3) that
// allowlist contains ONLY the approved read-only actions -- no write action
// name appears in it.
{
  const onListClickFull = extractFn('onListClick');
  ok(/var preview = isPreviewSession\(state\.activeSession\);/.test(onListClickFull),
     'onListClick computes `preview` from isPreviewSession up front');
  ok(/if \(preview && !PREVIEW_READ_ONLY_ACTS\[btn\.getAttribute\("data-act"\)\]\) return;/.test(onListClickFull),
     'onListClick blocks every data-act NOT in PREVIEW_READ_ONLY_ACTS with a single central check');
  const allowlistMatch = SRC.match(/var PREVIEW_READ_ONLY_ACTS = \{([^}]*)\};/);
  ok(!!allowlistMatch, 'PREVIEW_READ_ONLY_ACTS allowlist located');
  const allowlistSrc = allowlistMatch ? allowlistMatch[1] : '';
  ['notes', 'cuenotes', 'warmnotes'].forEach(function (a) {
    ok(new RegExp('\\b' + a + '\\s*:\\s*1\\b').test(allowlistSrc), 'PREVIEW_READ_ONLY_ACTS includes read-only action "' + a + '"');
  });
  const WRITE_ACT_NAMES = ['setdone', 'warm', 'wt-', 'wt+', 'rep-', 'rep+', 'setrpe', 'skipex', 'unskipex', 'swap-pick', 'sets-', 'sets+', 'set'];
  WRITE_ACT_NAMES.forEach(function (a) {
    ok(!new RegExp('\\b' + a.replace(/[-+]/g, '\\$&') + '\\s*:\\s*1\\b').test(allowlistSrc),
       'PREVIEW_READ_ONLY_ACTS never allowlists write action "' + a + '"');
  });
  // exhist (exercise History) is handled separately, before any preview
  // check, since it isn't gated by the data-act allowlist path at all --
  // confirm it still fires unconditionally (read-only, no save anywhere near it).
  ok(/var histBtn = ev\.target\.closest\('\[data-act="exhist"\]'\);\s*\n\s*if \(histBtn\)/.test(onListClickFull),
     'exhist (History) is dispatched unconditionally, before the preview/write classification');
}

// ==================================================================
// Functional write-sweep: onListClick / onListInput / onDensityAct /
// ensureSessionLive must no-op (no save(), no state mutation) for every
// required write action when isPreviewSession is true. save() is this app's
// only path to localStorage, so "save() never called" here is the direct
// Node-level equivalent of "localStorage is byte-identical".
// ==================================================================
{
  const onListClickSrc = extractFn('onListClick');
  const onListInputSrc = extractFn('onListInput');
  const onDensityActSrc = extractFn('onDensityAct');
  const ensureSessionLiveSrc = extractFn('ensureSessionLive');
  // The PREVIEW_READ_ONLY_ACTS allowlist is declared just before onListClick,
  // outside its body -- pull the one line verbatim so the harness runs the
  // real allowlist, not a hand-copied one.
  const allowlistLineIdx = SRC.indexOf('var PREVIEW_READ_ONLY_ACTS');
  const allowlistLineEnd = SRC.indexOf(';', allowlistLineIdx) + 1;
  const previewReadOnlyActsSrc = SRC.slice(allowlistLineIdx, allowlistLineEnd);

  const sweepHarness = `
    var saveCount = 0;
    var state = { activeSession: 1, program: { weeks: [{ sessions: [
      { id: 'A', name: 'A', exercises: [{ id: 'e0', name: 'Bench', type: 'strength', sets: 3, reps: '5' }] },
      { id: 'B', name: 'B', exercises: [
        { id: 'e0', name: 'Squat', type: 'strength', sets: 3, reps: '5' },
        { id: 'e1', name: 'RDL', type: 'strength', sets: 3, reps: '8' }
      ] }
    ] }] }, activeWeek: 0, log: {} };
    ${previewReadOnlyActsSrc}
    function curWeek() { return state.program.weeks[state.activeWeek]; }
    function curSession() { return curWeek().sessions[state.activeSession]; }
    function findEx(id) { return curSession().exercises.filter(function (e) { return e.id === id; })[0]; }
    // Read-only stand-ins for isPreviewSession's own dependency chain (it
    // calls heroInfo -> sessionItemsFor -> readLog for every guarded
    // function, including on the preview path) -- these must NOT throw;
    // only the actual write functions below (writeLog/writeBlockLog/etc.)
    // throw, so a throw here would mean the guard itself is broken, not
    // that a write leaked through.
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
    ${sessionProgressSrc}
    ${displayOrderedExercisesSrc}
    ${sessionItemsForSrc}
    function sessionItems() { return sessionItemsFor(curSession()); }
    ${firstIncompleteIdSrc}
    ${isSessionFinishedSrc}
  ${countCompletedSetsSrc}
    ${programTrainDaysSrc}
    ${weekdayForSessionSrc}
    ${todayWeekdaySrc}
    ${todaySessionIdxSrc}
    ${heroInfoSrc}
    ${todayStrSrc}
    ${validTodayPickSrc}
    ${armedSessionIdxSrc}
    ${isPreviewSessionSrc}
    function save() { saveCount++; }
    function saveSoon() { saveCount++; }
    function writeLog() { throw new Error('writeLog must never be called in preview'); }
    function readBlockLog() { throw new Error('readBlockLog must never be called in preview'); }
    function writeBlockLog() { throw new Error('writeBlockLog must never be called in preview'); }
    function startRest() { throw new Error('startRest must never be called in preview'); }
    function hideRest() { throw new Error('hideRest must never be called in preview'); }
    function unlockAudio() { throw new Error('unlockAudio must never be called in preview'); }
    function selectExercise() { throw new Error('selectExercise (the SAVING nav path) must never be called in preview'); }
    function removeCurrentDay() { throw new Error('removeCurrentDay must never be called in preview'); }
    // v1.9-T1 fix: these three are legitimate read-only navigation helpers --
    // onListClick's preview card-select branch calls them directly (bypassing
    // selectExercise, which is save()-backed and preview-forbidden above).
    var historyOpenedFor = null;
    function openExerciseHistory(name) { historyOpenedFor = name; }
    function hideSuperNext() {}
    function hideFiller() {}
    function scrollToCurrent() {}
    function applyGlance() {}
    function currentId() { return state.activeExerciseId === '__collapsed__' ? null : (state.activeExerciseId || null); }
    function refreshCollapsedMeta() {}
    function refreshFoot() {}
    function renderHead() {}
    function renderList() {}
    function renderDayBar() {}
    function bumpPref() {}
    function canonicalExName(n) { return n; }
    function toastUndo() {}
    function toast() {}
    function numOr(v, d) { return isNaN(parseFloat(v)) ? d : parseFloat(v); }
    function roundW(n) { return n; }
    function platesText() { return ''; }
    function refreshWarm() {}
    function refreshTargetLine() {}
    function refreshStartWeightLabel() {}
    function setRowsInner() { return ''; }
    function sessionLive() { return false; }
    function startLiveTimer() { throw new Error('startLiveTimer (Start) must never be called in preview'); }
    function acquireWakeLock() { throw new Error('acquireWakeLock (Start) must never be called in preview'); }
    var STEP = 2.5;
    ${onListClickSrc}
    ${onListInputSrc}
    ${onDensityActSrc}
    ${ensureSessionLiveSrc}
    module.exports = {
      onListClick: onListClick, onListInput: onListInput, ensureSessionLive: ensureSessionLive,
      saveCount: function () { return saveCount; }, resetSave: function () { saveCount = 0; },
      getActiveExerciseId: function () { return state.activeExerciseId; },
      setActiveExerciseId: function (v) { state.activeExerciseId = v; },
      getHistoryOpenedFor: function () { return historyOpenedFor; },
      resetHistoryOpenedFor: function () { historyOpenedFor = null; }
    };
  `;
  const sweepMod = { exports: {} };
  new Function('module', 'exports', sweepHarness)(sweepMod, sweepMod.exports);
  const S = sweepMod.exports;

  function fakeBtn(attrs) {
    const attrMap = attrs;
    return {
      getAttribute: function (k) { return attrMap[k] != null ? attrMap[k] : null; },
      classList: { toggle: function () {}, add: function () {}, remove: function () {} },
      setAttribute: function () {},
      nextElementSibling: { classList: { toggle: function () {} } },
      closest: function (sel) {
        if (sel === '.card') return { querySelector: function () { return { classList: { toggle: function () {} } }; } };
        if (sel === '.setrow' || sel === '.card__head') return null;
        return null;
      }
    };
  }
  function fakeEvent(btn) {
    return {
      target: {
        closest: function (sel) {
          if (sel === '#dayRemove' || sel === '.card') return null;
          if (sel === '[data-act]') return btn;
          if (sel.indexOf('[data-act=') === 0) {
            // e.g. '[data-act="exhist"]' -- match only if the button's own
            // data-act equals the quoted value, exactly like a real CSS
            // attribute selector would.
            const wanted = sel.slice(sel.indexOf('"') + 1, sel.lastIndexOf('"'));
            return btn.getAttribute('data-act') === wanted ? btn : null;
          }
          return null;
        }
      }
    };
  }

  // state.activeSession = 1 ('B'), armed session is 0 ('A') since flexible +
  // A is untouched/incomplete and comes first -- so B (index 1) is preview.
  ok(S.saveCount() === 0, 'sanity: no saves yet');

  const WRITE_ACTIONS = [
    { act: 'setdone', extra: { 'data-ex': 'e0', 'data-set': '0' } },
    { act: 'warm', extra: { 'data-ex': 'e0', 'data-warm': '0' } },
    { act: 'wt-', extra: { 'data-ex': 'e0', 'data-set': '0' } },
    { act: 'wt+', extra: { 'data-ex': 'e0', 'data-set': '0' } },
    { act: 'rep-', extra: { 'data-ex': 'e0', 'data-set': '0' } },
    { act: 'rep+', extra: { 'data-ex': 'e0', 'data-set': '0' } },
    { act: 'setrpe', extra: { 'data-ex': 'e0', 'data-set': '0', 'data-rpe': '8' } },
    { act: 'skipex', extra: { 'data-ex': 'e0' } },
    { act: 'unskipex', extra: { 'data-ex': 'e0' } }
  ];
  WRITE_ACTIONS.forEach(function (w) {
    S.resetSave();
    const attrs = Object.assign({ 'data-act': w.act }, w.extra);
    const btn = fakeBtn(attrs);
    let threw = null;
    try { S.onListClick(fakeEvent(btn)); } catch (e) { threw = e; }
    ok(!threw, 'onListClick("' + w.act + '") on a preview session does not throw (no write path reached): ' + (threw && threw.message));
    ok(S.saveCount() === 0, 'onListClick("' + w.act + '") on a preview session calls save() zero times');
  });

  // onListInput actions (wset/setwt/reps)
  ['wset', 'setwt', 'reps'].forEach(function (act) {
    S.resetSave();
    const el = { getAttribute: function (k) { return { 'data-act': act, 'data-ex': 'e0', 'data-set': '0' }[k] || null; }, value: '10', closest: function () { return null; } };
    let threw = null;
    try { S.onListInput({ target: el }); } catch (e) { threw = e; }
    ok(!threw, 'onListInput("' + act + '") on a preview session does not throw: ' + (threw && threw.message));
    ok(S.saveCount() === 0, 'onListInput("' + act + '") on a preview session calls save() zero times');
  });

  // ================================================================
  // v1.9-T1 FIX: read-only day-screen navigation must work in preview --
  // opening another exercise card, Form notes / cue / warm-up disclosures,
  // and History -- all without ever calling save().
  // ================================================================

  // Fake "tap on a card" event: closest('.card') returns a card stub with the
  // given data-ex id; closest('[data-act]') returns null (no action button
  // under the tap -- this is a plain card-body/header tap); closest for
  // '.card__head' is toggled by `onHeader` to simulate tapping the title row
  // (closes the open card) vs the body (opens/switches cards).
  function fakeCardEvent(exId, onHeader) {
    const cardStub = { getAttribute: function (k) { return k === 'data-ex' ? exId : null; } };
    return {
      target: {
        closest: function (sel) {
          if (sel === '.card') return cardStub;
          if (sel === '.card__head') return onHeader ? {} : null;
          if (sel === '[data-act]') return null;
          if (sel === '#dayRemove') return null;
          return null;
        }
      }
    };
  }

  // Test: preview allows opening another exercise card (e0 -> e1).
  {
    S.resetSave();
    S.setActiveExerciseId('e0');
    let threw = null;
    try { S.onListClick(fakeCardEvent('e1', false)); } catch (e) { threw = e; }
    ok(!threw, 'opening another exercise card (e0 -> e1) in preview does not throw: ' + (threw && threw.message));
    ok(S.getActiveExerciseId() === 'e1', 'opening another exercise card in preview actually switches the open card (activeExerciseId is now e1)');
    ok(S.saveCount() === 0, 'opening another exercise card in preview calls save() ZERO times');
  }

  // Test: preview allows closing the currently-open card via a header tap.
  {
    S.resetSave();
    S.setActiveExerciseId('e1');
    let threw = null;
    try { S.onListClick(fakeCardEvent('e1', true)); } catch (e) { threw = e; }
    ok(!threw, 'closing the open exercise card (header tap) in preview does not throw: ' + (threw && threw.message));
    ok(S.getActiveExerciseId() === '__collapsed__', 'closing the open exercise card in preview still writes the __collapsed__ sentinel (existing behavior, just unsaved)');
    ok(S.saveCount() === 0, 'closing the open exercise card in preview calls save() ZERO times');
  }

  // Test: preview allows Form notes / cue-notes / warm-up-notes disclosures,
  // and none of them call save().
  ['notes', 'cuenotes', 'warmnotes'].forEach(function (act) {
    S.resetSave();
    const btn = fakeBtn({ 'data-act': act, 'data-ex': 'e0' });
    let threw = null;
    try { S.onListClick(fakeEvent(btn)); } catch (e) { threw = e; }
    ok(!threw, 'onListClick("' + act + '") (read-only disclosure) in preview does not throw: ' + (threw && threw.message));
    ok(S.saveCount() === 0, 'onListClick("' + act + '") in preview calls save() ZERO times (read-only, unsaved)');
  });

  // Test: preview allows exercise History (exhist) -- already covered by the
  // structural test above that it's dispatched unconditionally; confirm it
  // actually fires and calls save() zero times.
  {
    S.resetSave();
    S.resetHistoryOpenedFor();
    const btn = fakeBtn({ 'data-act': 'exhist', 'data-ex': 'e0' });
    let threw = null;
    try { S.onListClick(fakeEvent(btn)); } catch (e) { threw = e; }
    ok(!threw, 'onListClick("exhist") in preview does not throw: ' + (threw && threw.message));
    ok(S.getHistoryOpenedFor() === 'Squat', 'opening exercise History in preview actually opens history for the tapped exercise');
    ok(S.saveCount() === 0, 'opening exercise History in preview calls save() ZERO times');
  }

  // Start (ensureSessionLive) must no-op on the preview session too.
  S.resetSave();
  let startThrew = null;
  try { S.ensureSessionLive(); } catch (e) { startThrew = e; }
  ok(!startThrew, 'ensureSessionLive() (Start) on a preview session does not throw: ' + (startThrew && startThrew.message));
}

// ==================================================================
// Copy: exact approved strings present, nothing else new.
// ==================================================================
// v1.9 Preview Clarity Fix (approved): the old two-signal preview UI (a
// standalone banner paragraph PLUS a long .livebar message) is replaced by
// ONE compact banner. Old copy must be GONE, not just superseded.
// v1.10 Human Feel Ticket 1 (approved): the "PREVIEW ·" telegram-style
// prefix became a plain sentence -- "Planned for later. Nothing logs from
// here." (one line, per the v1.9 Preview Clarity no-wrap constraint).
ok(SRC.indexOf('Planned for later. Nothing logs from here.') !== -1, 'preview header copy present exactly: "Planned for later. Nothing logs from here." (v1.10 wording)');
ok(SRC.indexOf('PREVIEW · Planned for later.') === -1, 'old "PREVIEW ·" enum-prefixed copy is gone (v1.10 wording)');
ok(SRC.indexOf('Preview · not today\'s session') === -1, 'old preview header copy "Preview · not today\'s session" is gone (test 1/2)');
ok(SRC.indexOf('This session is planned for later. Training something else today is your call.') === -1,
   'old long preview message copy is gone -- no second preview signal (test 3)');
ok(!/id="dayPreviewMsg"/.test(SRC), 'dayPreviewMsg no longer exists -- the message line was removed, not just hidden (test 4)');
ok(/id="dayPreviewBanner"[^>]*hidden/.test(SRC), 'dayPreviewBanner defaults to hidden in markup');

// ---------- Rejected-copy guard, scoped to the new v1.9 Preview Clarity markup/CSS ----------
const bannerIdx = SRC.indexOf('id="dayPreviewBanner"');
const NEW_COPY_ZONE = SRC.slice(bannerIdx - 50, bannerIdx + 400);
const REJECTED = ['maybe', 'great job', 'crushed it', 'recovered', 'fatigued', 'optimal',
  'readiness score', 'recovery score', 'training receipt', 'Signed off', 'well done', 'nice'];
REJECTED.forEach(function (phrase) {
  ok(NEW_COPY_ZONE.toLowerCase().indexOf(phrase.toLowerCase()) === -1, 'rejected phrase absent from new v1.9-T1 copy: "' + phrase + '"');
});

// ==================================================================
// renderDayBar: Start/Finish hidden when readOnly, banner/message toggled.
// ==================================================================
{
  const body = extractFn('renderDayBar');
  ok(/var readOnly = !!\(ses && isPreviewSession\(state\.activeSession, wk\)\);/.test(body),
     'renderDayBar computes readOnly from isPreviewSession');
  ok(/startBtn\.hidden = readOnly \|\| live \|\| isSessionFinished\(ses\);/.test(body),
     'Start is hidden when readOnly (preview), in addition to the existing live/finished checks');
  ok(/endBtn\.hidden = readOnly;/.test(body), 'Finish is hidden when readOnly (preview)');
  ok(/banner\.hidden = !readOnly;/.test(body), 'the single compact preview banner is shown exactly when readOnly is true');
  ok(/appEl\.classList\.toggle\("is-day-preview", readOnly\);/.test(body),
     'v1.9 Preview Clarity: readOnly also drives the is-day-preview class (hides active-workout controls via CSS)');
}

// ==================================================================
// No data-shape change: no new stored field introduced anywhere in this
// ticket's code (armedSessionIdx/isPreviewSession are pure reads).
// ==================================================================
ok(!/state\.armed\b|state\.preview\b|state\.todayPick\b/.test(isPreviewSessionSrc + armedSessionIdxSrc),
   'no new stored field introduced by the armed-session resolver');

// Ticket 6 QA fix guard: .daypreview-banner uses display:flex, which beats
// the plain [hidden] attribute (same trap as .coachhint / .signoff-beat).
// Without the explicit override the banner renders on ARMED sessions too,
// claiming "Nothing logs from here" while logging actually works.
ok(/\.daypreview-banner\[hidden\] \{ display: none; \}/.test(SRC),
   '.daypreview-banner[hidden] display:none override exists (banner truly hides on armed sessions)');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
