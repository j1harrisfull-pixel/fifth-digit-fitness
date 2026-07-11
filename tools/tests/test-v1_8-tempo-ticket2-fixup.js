// v1.8 TEMPO -- Ticket 2 Fix-Up. Covers the two known issues from the
// Ticket 2 report:
//   Fix 1: #signoffBeat's [hidden] attribute being overridden by its own
//          display:flex CSS (same gotcha as .coachhint/.intro/etc elsewhere
//          in this file).
//   Fix 2: the Home week-row "BANKED · N SETS" label was reading pr.done
//          (completed EXERCISES) instead of a true completed-SET count.
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

// ---------- Coach-span untouched ----------
const spanMd5 = execSync(`sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5`).toString().trim();
ok(spanMd5 === '0e665de20f3872db06e90974f0af8b0b', 'coach-span md5 unchanged (0e665de20f3872db06e90974f0af8b0b), got ' + spanMd5);

// ================= FIX 1: signoffBeat hidden state =================
{
  ok(/\.signoff-beat\[hidden\] \{ display: none; \}/.test(SRC), 'a narrow .signoff-beat[hidden]{display:none} rule exists (Fix 1)');
  const beatRuleIdx = SRC.indexOf('.signoff-beat {');
  const fixRuleIdx = SRC.indexOf('.signoff-beat[hidden]');
  ok(beatRuleIdx > 0 && fixRuleIdx > beatRuleIdx, 'the [hidden] override rule comes after the base .signoff-beat display:flex rule (source-order-independent since specificity already wins, but keeps the override adjacent/legible)');
  // signoffBeat itself, its markup, and showSessionComplete's timing/hidden-toggle logic must be untouched.
  ok(/id="signoffBeat" hidden>/.test(SRC), 'signoffBeat element still present with its default hidden attribute');
  ok(/setTimeout\(function \(\) \{ beatEl\.hidden = true; \}, 650\)/.test(SRC), 'the 650ms signoff timing is unchanged');
  ok(/if \(beatEl && !reduceMotion\) \{/.test(SRC), 'the reduced-motion branching for the beat is unchanged');
}

// ================= FIX 2: BANKED unit honesty =================
// v1.9 Train This Today Hero Fix: heroInfo now calls validTodayPick internally
// -- extracted alongside it so this harness's copy stays real. No fixture in
// this file sets state.todayPick, so it safely short-circuits to "no pick".
const NAMES = ['sessionProgress', 'isSkipped', 'isSessionFinished', 'hasRealWork', 'sessionItemsFor', 'heroInfo',
  'weekDayStatus', 'countCompletedSets', 'sessionDensityRounds', 'validTodayPick'];
const body = NAMES.map(extractFn).join('\n\n');
const harness = `
  var state = { log: {} };
  function readLog(ses, ex) {
    var sl = state.log[ses.id], el = sl && sl.ex ? sl.ex[ex.id] : null;
    return { sets: (el && Array.isArray(el.sets)) ? el.sets : [] };
  }
  function readBlockLog(ses, kind) {
    var sl = state.log[ses.id], bl = sl && sl.blocks ? sl.blocks[kind] : null;
    return bl || { rounds: 0, completed: false };
  }
  function blockPseudoId(k) { return 'blk_' + k; }
  ${body}
  module.exports = {
    setState: function (s) { state = s; },
    weekDayStatus: weekDayStatus,
    countCompletedSets: countCompletedSets,
    sessionDensityRounds: sessionDensityRounds
  };
`;
const mod = { exports: {} };
new Function('module', 'exports', harness)(mod, mod.exports);
const M = mod.exports;

function strengthEx(id, sets) { return { id: id, name: id, type: 'strength', sets: sets }; }
function densityEx(id, block, mode) { return { id: id, name: id, type: 'strength', sets: 0, block: block, densityMode: mode }; }

// ---------- BANKED · N SETS: exact completed-set count, never "0 SETS" ----------
{
  var ses = { id: 'S1', name: 'Sess', exercises: [strengthEx('e0', 4)] };
  var log = { S1: { date: null, finishedAt: '2026-07-10T10:00:00.000Z', ex: { e0: { sets: [{ completed: true }, { completed: false }, { completed: false }, { completed: false }] } } } };
  M.setState({ log: log });
  var st = M.weekDayStatus([ses], 0);
  ok(st.key === 'finished', 'one completed set out of four, not fully done: status key is "finished"');
  ok(st.banked.setsDone === 1, 'one completed set: banked.setsDone === 1 (not pr.done, which would be 0 exercises complete), got ' + st.banked.setsDone);
}
{
  var ses = { id: 'S2', name: 'Sess', exercises: [strengthEx('e0', 4), strengthEx('e1', 3)] };
  var log = { S2: { date: null, finishedAt: '2026-07-10T10:00:00.000Z', ex: {
    e0: { sets: [{ completed: true }, { completed: true }, { completed: false }, { completed: false }] },
    e1: { sets: [{ completed: true }, { completed: false }, { completed: false }] }
  } } };
  M.setState({ log: log });
  var st = M.weekDayStatus([ses], 0);
  ok(st.banked.setsDone === 3, 'multiple completed sets across exercises: banked.setsDone === 3, got ' + st.banked.setsDone);
}

// ---------- Skipped-only / zero-logged: never reach "finished"/BANKED ----------
{
  var ses = { id: 'S3', name: 'Sess', exercises: [strengthEx('e0', 4)] };
  var log = { S3: { date: null, ex: { e0: { skipped: true, sets: [] } } } }; // no finishedAt -- endSession never writes one for skip-only
  M.setState({ log: log });
  var st = M.weekDayStatus([ses], 0);
  ok(st.key !== 'finished', 'skipped-only session (no finishedAt) never reaches the BANKED/"finished" state, got key: ' + st.key);
}
{
  var ses = { id: 'S4', name: 'Sess', exercises: [strengthEx('e0', 4)] };
  M.setState({ log: {} });
  var st = M.weekDayStatus([ses], 0);
  ok(st.key !== 'finished', 'zero-logged session never reaches the BANKED/"finished" state, got key: ' + st.key);
}

// ---------- Density: rounds > 0 renders BANKED · N ROUNDS ----------
{
  var ses = { id: 'D1', name: 'Density', exercises: [densityEx('e0', 'strength', 'emom')] };
  var log = { D1: { date: null, finishedAt: '2026-07-10T10:00:00.000Z', ex: {}, blocks: { strength: { rounds: 7, completed: false } } } };
  M.setState({ log: log });
  var st = M.weekDayStatus([ses], 0);
  ok(st.banked.setsDone === 0, 'density session: setsDone is honestly 0 (no sl.ex sets)');
  ok(st.banked.density.roundsTotal === 7, 'density session: density.roundsTotal === 7, got ' + st.banked.density.roundsTotal);
}

// ---------- Density completed at zero rounds: bare BANKED, never "BANKED · 0 SETS"/"0 ROUNDS" ----------
// (A second, still-untouched exercise keeps the session below 100% complete
// -- i.e. genuinely "finished early", not "done" -- so the BANKED branch is
// the one under test, not the CLOSED/"done" branch.)
{
  var ses = { id: 'D2', name: 'Density', exercises: [densityEx('e0', 'conditioning', 'amrap'), strengthEx('e1', 4)] };
  var log = { D2: { date: null, finishedAt: '2026-07-10T10:00:00.000Z', ex: {}, blocks: { conditioning: { rounds: 0, completed: true } } } };
  M.setState({ log: log });
  var st = M.weekDayStatus([ses], 0);
  ok(st.key === 'finished', 'density block done + an untouched exercise: status key is "finished" (BANKED), not "done" (CLOSED), got: ' + st.key);
  ok(st.banked.setsDone === 0 && st.banked.density.roundsTotal === 0 && st.banked.density.blockDoneZeroRounds === true,
     'density block completed at zero rounds: setsDone=0, roundsTotal=0, blockDoneZeroRounds=true -- label falls to bare BANKED');
}

// ---------- Untouched / explicit-skipped week-row states (unchanged, still correct) ----------
{
  var ses1 = { id: 'U1', name: 'Sess1', exercises: [strengthEx('e0', 4)] };
  var ses2 = { id: 'U2', name: 'Sess2', exercises: [strengthEx('e0', 4)] };
  // weekDayStatus's "laterTouched" check requires a FULLY-completed exercise
  // (sessionProgress's done count), not merely a partially-logged one.
  var log = { U2: { date: null, ex: { e0: { sets: [{ completed: true }, { completed: true }, { completed: true }, { completed: true }] } } } };
  M.setState({ log: log });
  var stUntouched = M.weekDayStatus([ses1, ses2], 0);
  ok(stUntouched.key === 'skipped', 'an untouched session with a LATER touched session renders "skipped" (moved past), unchanged behavior, got: ' + stUntouched.key);
  var stPending = M.weekDayStatus([ses1], 0);
  ok(stPending.key === 'pending', 'a genuinely untouched, un-superseded session renders "pending" (-> READY label), unchanged behavior');
}

// ---------- Source-level: the render label construction matches the approved rules ----------
const rwIdx = SRC.indexOf('function renderWeekList() {');
const rwBody = extractFn('renderWeekList');
// v1.10 Human Feel Ticket 1 (approved): the label became lower case Training
// Ledger wording ("banked · N sets") -- same bk.setsDone/bk.density source,
// same unit-honesty guarantee this fix-up ticket established, just de-shouted.
ok(/bk\.setsDone > 0 \? \("banked · " \+ bk\.setsDone \+ " set" \+ \(bk\.setsDone === 1 \? "" : "s"\)\)/.test(rwBody),
   'renderWeekList: "banked · N sets" uses bk.setsDone (true completed-set count)');
ok(/bk\.density\.roundsTotal > 0 \? \("banked · " \+ bk\.density\.roundsTotal \+ " round"/.test(rwBody),
   'renderWeekList: "banked · N rounds" uses bk.density.roundsTotal (true density round count)');
ok(/: "banked";/.test(rwBody), 'renderWeekList: falls back to a bare "banked" (never "banked · 0 sets") when neither sets nor rounds are present');
// (the fallback-to-bare-"banked" assertion above already proves this
// structurally; a substring scan here would also false-positive on this
// file's own explanatory comments describing the bug being fixed)

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
