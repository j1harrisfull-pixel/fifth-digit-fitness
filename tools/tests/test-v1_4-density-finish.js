// v1.4 -- Density Finish Honesty.
//
// Density-style work (EMOM/AMRAP) is logged via sl.blocks[kind] = {rounds,
// completed} instead of normal sl.ex[*].sets rows. Before this fix, endSession
// only counted completed sets, so a session where the user logged real rounds
// (or marked a conditioning block done) was treated as zero-logged: no
// receipt, no finishedAt, "Nothing logged. Left as is." -- a fabricated-empty
// history for real work.
//
// This harness extracts hasRealWork, endSession, showSessionComplete,
// compactLog, and their real dependencies (sessionProgress, sessionItemsFor,
// readBlockLog, writeBlockLog, blockPseudoId, isSkipped) verbatim from
// index.html by brace-matching, and stubs only the DOM/coach-adjacent
// dependencies showSessionComplete needs ($ getter, buildHonestRead,
// computeFatigueState, strengthFoot, LIBRARY, bumpPref, canonicalExName,
// dayPositionLabel, ordinal, curWeek, save) -- so the actual receipt-summary
// string-building code under test is the real code, not a reimplementation.
const fs = require('fs');
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

// ---------- Source-level checks: hasRealWork lives outside coach-span ----------
{
  var coachStart = SRC.indexOf('/*__COACH_START__*/'), coachEnd = SRC.indexOf('/*__COACH_END__*/');
  var hrwIdx = SRC.indexOf('function hasRealWork(');
  if (hrwIdx < coachEnd) throw new Error('hasRealWork must be defined OUTSIDE coach-span');
}

const NAMES = ['isSkipped', 'isSessionFinished', 'hasRealWork', 'blockPseudoId', 'readBlockLog', 'writeBlockLog',
  'sessionProgress', 'displayOrderedExercises', 'sessionItemsFor', 'compactLog', 'endSession', 'showSessionComplete'];
const body = NAMES.map(extractFn).join('\n\n');

const harness = `
  var state = { log: {}, program: { unit: 'kg' }, activeSession: 0, athlete: null };
  var _saveCount = 0, _backCount = 0, _toastMsgs = [], _hideRestCount = 0, _ensureLiveCount = 0;
  function save() { _saveCount++; }
  function backToWeek() { _backCount++; }
  // v1.9-T1: endSession now starts with an isPreviewSession(state.activeSession)
  // guard. Every case here exercises the armed (loggable) session.
  function isPreviewSession() { return false; }
  function toast(msg) { _toastMsgs.push(msg); }
  function hideRest() { _hideRestCount++; }
  function stopLiveTimer() {} // Batch A: showSessionComplete now ends the live run itself
  function ensureSessionLive() { _ensureLiveCount++; }
  function unlockAudio() {}
  function computeFatigueState() { return null; }
  function strengthFoot() { return { ready: false }; }
  function bumpPref() {}
  function canonicalExName(n) { return n; }
  function getAnchorState() { return null; }
  function fatigueBandForAnchorPattern() { return null; }
  function anchorProgressionDecision() { return { action: 'hold' }; }
  function anchorIncrementKg() { return 0; }
  function roundW(w) { return w; }
  function recordAnchorExposure() {}
  var LIBRARY = [];
  function buildHonestRead() { return { html: '', prs: [] }; }
  function dayPositionLabel() { return 'Session'; }
  function ordinal(n) { return n + 'th'; }
  var _curWeek = null;
  function curWeek() { return _curWeek; }
  function curSession() { return _curSession; }
  var _curSession = null;
  var liveTimerStart = 0;
  var reduceMotion = true;
  function fmtDate() { return 'Date'; }
  function openSheetNoKb() {}
  // v1.10 Ticket 5 (THE PAGE): new display-layer dependencies of
  // showSessionComplete -- same-shape stubs as the rest of this harness.
  var WARM_LOADED = ['barbell', 'dumbbell', 'machine', 'cable', 'kettlebell', 'smith'];
  var BLOCK_MODE_LABEL = { emom: 'EMOM', amrap: 'AMRAP' };
  function est1RM(w, r) { return w * (1 + r / 30); }
  function exTimed() { return false; }
  function esc(s) { return String(s == null ? '' : s); }

  // readLog: a minimal stub surfacing exactly the completed-set flags the
  // test wired into state.log[ses.id].ex[ex.id].sets -- same shape/behaviour
  // as the real readLog for the fields showSessionComplete/endSession touch.
  function readLog(ses, ex) {
    var sl = state.log[ses.id], el = sl && sl.ex ? sl.ex[ex.id] : null;
    return { sets: (el && Array.isArray(el.sets)) ? el.sets : [], weight: (el && el.weight) || 0 };
  }

  // Fake DOM: a Map-backed element registry so $("id") returns a stable
  // object the real showSessionComplete code can read/write .textContent,
  // .hidden, .innerHTML on -- exactly like real elements, just not attached
  // to a document.
  var _els = {};
  function $(id) {
    if (!_els[id]) _els[id] = { textContent: '', innerHTML: '', hidden: false, close: function () {}, removeAttribute: function () {} };
    return _els[id];
  }

  ${body}

  module.exports = {
    setState: function (s) { state = s; },
    setCurSession: function (s) { _curSession = s; },
    setCurWeek: function (w) { _curWeek = w; },
    hasRealWork: hasRealWork,
    endSession: endSession,
    compactLog: compactLog,
    writeBlockLog: writeBlockLog,
    readBlockLog: readBlockLog,
    els: function () { return _els; },
    counts: function () { return { save: _saveCount, back: _backCount, toasts: _toastMsgs.slice(), ensureLive: _ensureLiveCount }; },
    resetCounts: function () { _saveCount = 0; _backCount = 0; _toastMsgs = []; _hideRestCount = 0; _ensureLiveCount = 0; }
  };
`;
const mod = { exports: {} };
new Function('module', 'exports', harness)(mod, mod.exports);
const M = mod.exports;

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

function strengthEx(id, sets) { return { id: id, name: id, type: 'strength', sets: sets }; }

function densitySession(id, exIds) {
  return { id: id, name: 'Density', exercises: exIds.map(function (eid) { return { id: eid, name: eid, type: 'strength', sets: 0 }; }) };
}

function setup(ses, log, wk) {
  M.setState({ log: log, program: { unit: 'kg' }, activeSession: 0, athlete: null });
  M.setCurSession(ses);
  M.setCurWeek(wk || { sessions: [ses] });
  M.resetCounts();
}

// ---------- Test 1: normal strength, no logs ----------
{
  var ses = { id: 'S1', name: 'Sess', exercises: [strengthEx('e0', 4)] };
  setup(ses, {});
  M.endSession();
  var c = M.counts();
  ok(c.toasts.length === 1 && c.toasts[0] === 'Nothing logged. Left as is.', 'normal strength no logs: toast fires (test 1)');
  ok(c.back === 1, 'normal strength no logs: returns to week');
  ok(!(M.hasRealWork(ses)), 'normal strength no logs: hasRealWork is false');
}

// ---------- Test 2: normal strength, one completed set ----------
{
  var ses = { id: 'S2', name: 'Sess', exercises: [strengthEx('e0', 4)] };
  var log = { S2: { date: null, ex: { e0: { sets: [{ completed: true }, { completed: false }, { completed: false }, { completed: false }] } } } };
  setup(ses, log);
  ok(M.hasRealWork(ses), 'one completed set: hasRealWork is true (test 2)');
  M.endSession();
  ok(!!log.S2.finishedAt, 'one completed set: finishedAt written');
  // v1.10 Ticket 5 THE PAGE: the closing sentence carries the honest count.
  ok(/^1 set kept/.test(M.els().completeClose.textContent), 'one completed set: closing sentence says "1 set kept" (singular), got: ' + M.els().completeClose.textContent);
  ok(M.els().completeLedger.innerHTML.indexOf('finish-page__row') !== -1, 'one completed set: ledger renders a row for the exercise');
}

// ---------- Test 3: skips only ----------
{
  var ses = { id: 'S3', name: 'Sess', exercises: [strengthEx('e0', 4)] };
  var log = { S3: { date: null, ex: { e0: { skipped: true, sets: [] } } } };
  setup(ses, log);
  ok(!M.hasRealWork(ses), 'skips only: hasRealWork is false (test 3)');
  M.endSession();
  ok(!log.S3.finishedAt, 'skips only: no finishedAt written');
}

// ---------- Test 4: density, zero rounds, not done ----------
{
  var ses = densitySession('S4', ['blk_strength']);
  var log = { S4: { date: null, ex: {}, blocks: { strength: { rounds: 0, completed: false } } } };
  setup(ses, log);
  ok(!M.hasRealWork(ses), 'density zero rounds: hasRealWork is false (test 4)');
  M.endSession();
  var c = M.counts();
  ok(c.toasts.length === 1 && c.toasts[0] === 'Nothing logged. Left as is.', 'density zero rounds: toast fires');
  ok(!log.S4.finishedAt, 'density zero rounds: no finishedAt');
}

// ---------- Test 5: density, one round ----------
{
  var ses = densitySession('S5', ['blk_strength']);
  var log = { S5: { date: null, ex: {}, blocks: { strength: { rounds: 1, completed: false } } } };
  setup(ses, log);
  ok(M.hasRealWork(ses), 'density one round: hasRealWork is true (test 5)');
  M.endSession();
  ok(!!log.S5.finishedAt, 'density one round: finishedAt written');
  ok(/^1 round kept/.test(M.els().completeClose.textContent), 'density one round: closing sentence says "1 round kept" (singular), got: ' + M.els().completeClose.textContent);
  ok(!/0 sets/.test(M.els().completeClose.textContent), 'density one round: never says "0 sets"');
}

// ---------- Test 6: density, multiple rounds ----------
{
  var ses = densitySession('S6', ['blk_strength']);
  var log = { S6: { date: null, ex: {}, blocks: { strength: { rounds: 6, completed: false } } } };
  setup(ses, log);
  M.endSession();
  ok(/^6 rounds kept/.test(M.els().completeClose.textContent), 'density multiple rounds: closing sentence says "6 rounds kept" (test 6), got: ' + M.els().completeClose.textContent);
}

// ---------- Test 7: density block done at 0 rounds ----------
{
  var ses = densitySession('S7', ['blk_con']);
  var log = { S7: { date: null, ex: {}, blocks: { con: { rounds: 0, completed: true } } } };
  setup(ses, log);
  ok(M.hasRealWork(ses), 'density block done at 0 rounds: hasRealWork is true (test 7)');
  M.endSession();
  ok(!!log.S7.finishedAt, 'density block done at 0 rounds: finishedAt written');
  ok(/^conditioning done/.test(M.els().completeClose.textContent), 'density block done at 0 rounds: closing sentence says "conditioning done", no fake round count, got: ' + M.els().completeClose.textContent);
  ok(!/0 rounds/.test(M.els().completeClose.textContent), 'density block done at 0 rounds: never prints "0 rounds"');
}

// ---------- Test 8: mixed sets + density rounds ----------
{
  var ses = { id: 'S8', name: 'Sess', exercises: [strengthEx('e0', 4), { id: 'blk_con', name: 'Density', type: 'strength', sets: 0 }] };
  var log = { S8: { date: null, ex: { e0: { sets: [{ completed: true }, { completed: true }, { completed: false }, { completed: false }] } }, blocks: { con: { rounds: 3, completed: false } } } };
  setup(ses, log);
  M.endSession();
  var close = M.els().completeClose.textContent;
  // v1.10 Ticket 5 THE PAGE: sets outrank rounds in the closing sentence --
  // the ledger rows carry the per-exercise detail.
  ok(/^2 sets kept/.test(close), 'mixed session: closing sentence leads with "2 sets kept" (test 8), got: ' + close);
}

// ---------- Test 9: density after finishedAt (re-entry via endSession re-run is out of scope here --
// this is covered by onDensityAct's own re-entry logic, verified via source guard below) ----------
{
  ok(/if \(isIncrease && slr && slr\.finishedAt\) delete slr\.finishedAt;/.test(SRC),
     'density round increase clears finishedAt on re-entry (test 9, source guard)');
  ok(/if \(willBeDone\) \{[\s\S]{0,80}if \(sld && sld\.finishedAt\) delete sld\.finishedAt;/.test(SRC),
     'marking a density block done clears finishedAt on re-entry (test 9, source guard)');
}

// ---------- Test 10/11: density timer parity (source guards -- onDensityAct itself
// is UI-event-wired and not independently extractable without a DOM harness) ----------
{
  var actIdx = SRC.indexOf('function onDensityAct(act, kind, btn)');
  // v1.9-T1 added a short leading isPreviewSession guard line to onDensityAct
  // -- window widened slightly to absorb that shift.
  var actBody = SRC.slice(actIdx, actIdx + 2700);
  // v1.6 added a guarded sl.date stamp comment+line inside both branches
  // (between the finishedAt clear and the ensureSessionLive call), so the
  // proximity windows below were widened to still match through it.
  ok(/isIncrease\)[\s\S]{0,300}\{ unlockAudio\(\); ensureSessionLive\(\); \}/.test(actBody),
     'logging a density round (increase) starts the session timer via ensureSessionLive if not live (test 10)');
  ok(/if \(willBeDone\) \{[\s\S]{0,400}ensureSessionLive\(\);/.test(actBody),
     'marking a density block done starts the session timer via ensureSessionLive if not live (test 10)');
  var timerBranch = actBody.slice(actBody.indexOf('act === "blktimer"'));
  ok(!/ensureSessionLive/.test(timerBranch.slice(0, 300)),
     'the density block\'s own EMOM/AMRAP preview timer does NOT call ensureSessionLive (test 11 -- viewing/timing alone is not real work)');
}

// ---------- Test 12: compactLog preserves density blocks ----------
{
  var log = {
    S12a: { date: '2026-07-09T10:00:00.000Z', ex: {}, blocks: { strength: { rounds: 5, completed: false } } },
    S12b: { date: '2026-07-09T10:00:00.000Z', ex: {}, blocks: { con: { rounds: 0, completed: true } } },
    S12c: { date: '2026-07-09T10:00:00.000Z', ex: {}, blocks: { strength: { rounds: 0, completed: false } } }, // truly empty
    S12d: { date: '2026-07-09T10:00:00.000Z', ex: { e0: { sets: [{ completed: true }] } } }, // normal set, no blocks
    S12e: { date: '2026-07-09T10:00:00.000Z', ex: {}, blocks: { strength: { rounds: 4, completed: false } }, finishedAt: '2026-07-09T11:00:00.000Z' }
  };
  var out = M.compactLog(log);
  ok(!!out.S12a && out.S12a.blocks && out.S12a.blocks.strength.rounds === 5, 'compactLog preserves a rounds-only density session (test 12)');
  ok(!!out.S12b && out.S12b.blocks && out.S12b.blocks.con.completed === true, 'compactLog preserves a completed-block density session');
  ok(!out.S12c, 'compactLog still drops a truly-empty session (0 rounds, not done, no sets)');
  ok(!!out.S12d && !out.S12d.blocks, 'compactLog still compacts a normal set-only session with no blocks key added');
  ok(!!out.S12e && out.S12e.finishedAt === '2026-07-09T11:00:00.000Z', 'compactLog preserves finishedAt alongside density blocks');
}

// ---------- Test 13: backup export/import round-trips density blocks (source guard --
// migrateLogToSets only rewrites sl.ex[id] entries in place, never touches sl.blocks) ----------
{
  var migIdx = SRC.indexOf('function migrateLogToSets(log, program)');
  var migBody = SRC.slice(migIdx, migIdx + 900);
  ok(!/\.blocks/.test(migBody), 'migrateLogToSets never references sl.blocks -- density logs pass through migration/import untouched (test 13)');
}

// ---------- Test 14: Home/hero/week treat finished density session honestly ----------
// (covered structurally: isSessionFinished reads finishedAt directly, which endSession now
// writes for density work via hasRealWork -- no read-site changes needed or made.)
{
  var ses = densitySession('S14', ['blk_strength']);
  var log = { S14: { date: null, ex: {}, blocks: { strength: { rounds: 2, completed: false } } } };
  setup(ses, log);
  M.endSession();
  ok(log.S14.finishedAt, 'a finished density session has finishedAt set, which isSessionFinished/heroInfo/weekDayStatus already read honestly (test 14)');
}

// ---------- Test 15: zero-density Finish keeps existing toast copy ----------
{
  var ses = densitySession('S15', ['blk_strength']);
  var log = { S15: { date: null, ex: {}, blocks: { strength: { rounds: 0, completed: false } } } };
  setup(ses, log);
  M.endSession();
  ok(M.counts().toasts[0] === 'Nothing logged. Left as is.', 'zero-density Finish shows the unchanged toast copy (test 15)');
}

// ---------- Regression: never "0 sets logged" anywhere in source (dead literal) ----------
{
  ok(!/"0 sets logged"/.test(SRC), 'the literal "0 sets logged" string does not exist in source');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
