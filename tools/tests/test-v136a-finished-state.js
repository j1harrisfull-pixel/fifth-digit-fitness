// v136A — Finished-state contract (finish honesty).
//
// The v136 audit found the app had NO persisted notion of "finished": Home,
// the week list and the hero all derived done-ness purely from all-sets-
// complete, so finishing a session early left it presented as untouched
// "up next" work forever. v136A adds an additive sl.finishedAt stamp (written
// by endSession only when >=1 set is logged) and teaches the read sites to
// treat finished OR fully-complete as terminal, while keeping the visual
// language honest (a finished-early session is "Finished · X of Y", never
// "Done").
//
// These functions live inside the app's main closure (they read a shared
// `state` and call `readLog`), so this harness extracts each one by name with
// brace-matching and runs it against a mutable mock `state` plus a stub
// `readLog` that simply surfaces the completed-set flags the test sets up.
// Covers ticket tests 6-13: finishedAt write gate, zero-logged no-write,
// compactLog preservation, heroInfo up-next exclusion, weekDayStatus honest
// state, finished-early is never "Done", and the Just-Today-only case.
const fs = require('fs');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

// Pull one `function NAME(...) { ... }` out of the source by brace-matching
// from the opening brace -- robust to the surrounding 9k lines.
function extractFn(name) {
  const sig = 'function ' + name + '(';
  const at = SRC.indexOf(sig);
  if (at < 0) throw new Error('function not found: ' + name);
  const braceStart = SRC.indexOf('{', at);
  let depth = 0, i = braceStart, inStr = null, prev = '';
  for (; i < SRC.length; i++) {
    const c = SRC[i], nx = SRC[i + 1];
    if (inStr) {
      if (c === inStr && prev !== '\\') inStr = null;
      prev = c; continue;
    }
    // Skip comments so apostrophes/braces inside them can't skew the matcher.
    if (c === '/' && nx === '/') { const nl = SRC.indexOf('\n', i); i = nl < 0 ? SRC.length : nl; prev = '\n'; continue; }
    if (c === '/' && nx === '*') { const end = SRC.indexOf('*/', i + 2); i = end < 0 ? SRC.length : end + 1; prev = '/'; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; }
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
    prev = c;
  }
  return SRC.slice(at, i);
}

const NAMES = ['sessionProgress', 'isSkipped', 'isSessionFinished', 'hasRealWork', 'sessionItemsFor', 'heroInfo', 'weekDayStatus', 'compactLog', 'endSession', 'countCompletedSets', 'sessionDensityRounds'];
const body = NAMES.map(extractFn).join('\n\n');

// Sandbox: a mutable `state`, a stub `readLog` (surfaces exactly the sets the
// test wired into state.log), and inert stubs for endSession's DOM-side deps.
// blockPseudoId/readBlockLog are unreferenced (no densityMode exercises here).
const harness = `
  var state = { log: {} };
  var _saveCount = 0, _showCount = 0, _backCount = 0;
  function save() { _saveCount++; }
  function readLog(ses, ex) {
    var sl = state.log[ses.id], el = sl && sl.ex ? sl.ex[ex.id] : null;
    return { sets: (el && Array.isArray(el.sets)) ? el.sets : [] };
  }
  function readBlockLog() { return { completed: false }; }
  function blockPseudoId(k) { return 'blk_' + k; }
  function curSession() { return _curSession; }
  function showSessionComplete() { _showCount++; }
  function backToWeek() { _backCount++; }
  function toast() { _toastCount++; }
  var _curSession = null, _toastCount = 0;
  // v1.9-T1: endSession now starts with an isPreviewSession(state.activeSession)
  // guard. Every case in this file exercises the armed (loggable) session, so
  // this stub is simply "never preview" -- it does not change what's under test.
  function isPreviewSession() { return false; }
  ${body}
  module.exports = {
    get state() { return state; }, set state(v) { state = v; },
    isSessionFinished: isSessionFinished, hasRealWork: hasRealWork, heroInfo: heroInfo, weekDayStatus: weekDayStatus,
    compactLog: compactLog, sessionProgress: sessionProgress, sessionItemsFor: sessionItemsFor,
    endSession: endSession,
    setCurSession: function (s) { _curSession = s; },
    setState: function (s) { state = s; },
    counts: function () { return { save: _saveCount, show: _showCount, back: _backCount, toast: _toastCount }; }
  };
`;
const mod = { exports: {} };
new Function('module', 'exports', harness)(mod, mod.exports);
const M = mod.exports;

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// Build a session with N exercises each carrying `sets` sets; the log wires
// `doneCounts[i]` completed sets for exercise i. finishedAt optional.
function makeCase(sets, doneCounts, finishedAt) {
  const exercises = doneCounts.map((_, i) => ({ id: 'e' + i, name: 'Ex' + i, type: 'strength', sets: sets }));
  const ses = { id: 'S', name: 'Sess', exercises: exercises };
  const ex = {};
  doneCounts.forEach((dc, i) => {
    ex['e' + i] = { sets: Array.from({ length: sets }, (_, k) => ({ completed: k < dc })) };
  });
  const log = { S: { date: '2026-07-09T10:00:00.000Z', ex: ex } };
  if (finishedAt) log.S.finishedAt = finishedAt;
  return { ses: ses, log: log };
}

// ---------- Test 6/7: endSession finishedAt write gate ----------
{
  // >=1 logged set -> finishedAt stamped as an ISO string.
  const c = makeCase(3, [2], null); // 2 of 3 sets on one exercise = finished early
  M.setState({ log: c.log }); M.setCurSession(c.ses);
  M.endSession();
  const fa = M.state.log.S.finishedAt;
  ok(typeof fa === 'string' && /^\d{4}-\d\d-\d\dT/.test(fa), 'endSession with >=1 logged set stamps an ISO finishedAt (test 6)');
  ok(M.counts().show === 1, 'a finish with work logged shows the receipt, not a silent leave');
}
{
  // zero logged sets -> nothing persisted, no finishedAt, just leaves.
  const c = makeCase(3, [0], null);
  // Represent "never logged" honestly: no ex entries at all.
  M.setState({ log: {} }); M.setCurSession(c.ses);
  M.endSession();
  const sl = M.state.log.S;
  ok(!sl || !sl.finishedAt, 'a zero-logged Finish writes NO finishedAt (test 7)');
  ok(M.counts().back >= 1, 'a zero-logged Finish just leaves to the week (no receipt)');
  // v1.3: the zero-logged path also shows a quiet toast ("Nothing logged. Left
  // as is.") so the tap doesn't read as silently doing nothing -- still no
  // receipt, no finishedAt, no fake record.
  ok(M.counts().toast === 1, 'a zero-logged Finish shows exactly one toast (v1.3)');
}

// ---------- Test 8: compactLog preserves finishedAt ----------
{
  const log = {
    S1: { date: 'd', finishedAt: '2026-07-09T11:00:00.000Z', ex: { e0: { sets: [{ completed: true }] } } },
    S2: { date: 'd', ex: { e0: { sets: [{ completed: true }] } } }, // no finishedAt
    S3: { date: 'd', finishedAt: '2026-07-09T12:00:00.000Z', ex: { e0: { sets: [{ completed: false }] } } } // dropped (no completed set)
  };
  const out = M.compactLog(log);
  ok(out.S1 && out.S1.finishedAt === '2026-07-09T11:00:00.000Z', 'compactLog carries finishedAt through compaction (test 8)');
  ok(out.S2 && !('finishedAt' in out.S2), 'compactLog adds no finishedAt where there was none');
  ok(!out.S3, 'compactLog still drops an entry with no completed sets (finishedAt does not resurrect an empty entry)');
}

// ---------- Test 9: backup round-trip (compact -> JSON -> parse) preserves finishedAt ----------
{
  const log = { S: { date: 'd', finishedAt: '2026-07-09T13:00:00.000Z', ex: { e0: { sets: [{ completed: true }] } } } };
  const round = JSON.parse(JSON.stringify(M.compactLog(log)));
  ok(round.S.finishedAt === '2026-07-09T13:00:00.000Z', 'finishedAt survives a JSON export/import round-trip (test 9)');
}

// ---------- Test 10: heroInfo excludes finished sessions from "up next" ----------
{
  // A 3-session week: session 0 finished early, session 1 fully complete,
  // session 2 untouched -> up-next must be session 2, not the finished 0.
  const mk = (dc, fin) => {
    const ex = {}; dc.forEach((d, i) => { ex['e' + i] = { sets: Array.from({ length: 3 }, (_, k) => ({ completed: k < d })) }; });
    return { exs: dc.map((_, i) => ({ id: 'e' + i, name: 'X', type: 'strength', sets: 3 })), ex: ex };
  };
  const a = mk([1]), b = mk([3]), cc = mk([0]);
  const wk = { sessions: [
    { id: 'A', exercises: a.exs }, { id: 'B', exercises: b.exs }, { id: 'C', exercises: cc.exs }
  ] };
  const log = {
    A: { date: 'd', finishedAt: '2026-07-09T10:00:00.000Z', ex: a.ex },
    B: { date: 'd', ex: b.ex },
    C: { date: 'd', ex: cc.ex }
  };
  M.setState({ log: log });
  const hi = M.heroInfo(wk);
  ok(hi.nextIdx === 2, 'heroInfo up-next skips the finished-early session AND the complete one -> points at the untouched session (test 10)');
  ok(hi.weekDone === false, 'the week is not done while an untouched session remains');
}

// ---------- Test 11/12/13: weekDayStatus honest state + Just-Today-only ----------
{
  // Finished-early single session (Just Today): weekDayStatus = "finished",
  // NOT "done"; heroInfo reports weekDone but NOT weekFullyComplete.
  const c = makeCase(3, [1], '2026-07-09T10:00:00.000Z'); // 1 of 3 sets, finished
  M.setState({ log: c.log });
  const st = M.weekDayStatus([c.ses], 0);
  ok(st.key === 'finished', 'weekDayStatus returns "finished" for a finished-early session (test 11)');
  ok(st.key !== 'done', 'a finished-early session is NEVER "done" (test 12)');
  ok(st.pr.done === 0 && st.pr.total === 1, 'its honest read is 0 of 1 exercises complete (the one exercise had 1/3 sets, so it is not a completed unit) -> week row shows "Finished · 0 of 1"');
}
{
  // Just-Today-only, finished early: heroInfo weekDone true (nothing up next),
  // weekFullyComplete false (it was not actually completed).
  const ex = { e0: { sets: [{ completed: true }, { completed: false }, { completed: false }] } };
  const ses = { id: 'S', exercises: [{ id: 'e0', name: 'X', type: 'strength', sets: 3 }] };
  const wk = { sessions: [ses] };
  M.setState({ log: { S: { date: 'd', finishedAt: '2026-07-09T10:00:00.000Z', ex: ex } } });
  const hi = M.heroInfo(wk);
  ok(hi.weekDone === true, 'a single finished-early session leaves nothing "up next" -> weekDone (test 13)');
  ok(hi.weekFullyComplete === false, 'but weekFullyComplete is false -> hero never claims "Week complete"');
}
{
  // A fully-complete single session: done, and weekFullyComplete true.
  const ex = { e0: { sets: [{ completed: true }, { completed: true }, { completed: true }] } };
  const ses = { id: 'S', exercises: [{ id: 'e0', name: 'X', type: 'strength', sets: 3 }] };
  M.setState({ log: { S: { date: 'd', ex: ex } } });
  const st = M.weekDayStatus([ses], 0);
  ok(st.key === 'done', 'a fully-complete session still reads "done" (finishedAt logic does not regress completion)');
  const hi = M.heroInfo({ sessions: [ses] });
  ok(hi.weekDone === true && hi.weekFullyComplete === true, 'fully-complete week is weekDone AND weekFullyComplete -> honest "Week complete"');
}

// ---------- isSessionFinished basic contract ----------
{
  M.setState({ log: { S: { date: 'd', ex: {} } } });
  ok(M.isSessionFinished({ id: 'S' }) === false, 'isSessionFinished is false with no finishedAt (absent = not finished, no migration needed)');
  M.state.log.S.finishedAt = '2026-07-09T10:00:00.000Z';
  ok(M.isSessionFinished({ id: 'S' }) === true, 'isSessionFinished is true once the stamp exists');
  ok(M.isSessionFinished({ id: 'MISSING' }) === false, 'isSessionFinished is safe for a session with no log entry at all');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
