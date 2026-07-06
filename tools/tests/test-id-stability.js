// Regression test: normalizeProgram must be ID-STABLE across repeated calls.
// It runs on EVERY app boot (coerceState), and previously reassigned every
// session/exercise id purely by array position -- fine for generateProgram
// output (which already uses that exact scheme), but it silently overwrote
// addTodaySession's different id scheme ("wk{n}_today{n}_{timestamp}") on the
// very next reload, orphaning state.log entries keyed by the original id.
// Covers: (1) a session/exercise with an existing string id keeps it across
// repeated normalize passes; (2) a session/exercise with NO id yet (first-time
// normalize of fresh generateProgram output) still gets a position-based id;
// (3) a realistic end-to-end scenario -- log a set against a Just-Today
// session, run it through normalizeProgram (simulating a reload), confirm the
// logged set is still reachable under the (unchanged) session/exercise id.
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /function clampInt\(/.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={normalizeProgram,generateProgram};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const { normalizeProgram, generateProgram } = m.exports;
let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 1. existing ids (addTodaySession's scheme) survive repeated normalize ----------
{
  const justToday = {
    title: 'x', goal: 'y', unit: 'kg', weeks: [{ week: 1, sessions: [
      { id: 'wk0_today0_1751000000', name: 'Full Body', focus: '', exercises: [
        { id: 'wk0_today0_1751000000_e0', name: 'Back Squat', type: 'strength', sets: 3, reps: '5' }
      ] }
    ] }]
  };
  const p1 = normalizeProgram(justToday);
  ok(p1.weeks[0].sessions[0].id === 'wk0_today0_1751000000', 'a Just-Today session id survives its FIRST normalize pass');
  ok(p1.weeks[0].sessions[0].exercises[0].id === 'wk0_today0_1751000000_e0', 'its exercise id survives too');
  const p2 = normalizeProgram(p1); // simulates a second app reload
  ok(p2.weeks[0].sessions[0].id === p1.weeks[0].sessions[0].id, 'the session id is STILL the same after a 2nd normalize pass (2nd reload)');
  ok(p2.weeks[0].sessions[0].exercises[0].id === p1.weeks[0].sessions[0].exercises[0].id, 'the exercise id is STILL the same after a 2nd normalize pass');
  const p3 = normalizeProgram(p2); // a 3rd, for good measure
  ok(p3.weeks[0].sessions[0].id === p1.weeks[0].sessions[0].id, 'stable across a 3rd normalize pass too');
}

// ---------- 2. a session/exercise with NO id yet still gets a position-based one ----------
{
  const fresh = {
    title: 'x', goal: 'y', unit: 'kg', weeks: [{ week: 1, sessions: [
      { name: 'Upper', focus: '', exercises: [{ name: 'Bench Press', type: 'strength', sets: 3, reps: '5' }] },
      { name: 'Lower', focus: '', exercises: [{ name: 'Back Squat', type: 'strength', sets: 3, reps: '5' }] }
    ] }]
  };
  const out = normalizeProgram(fresh);
  ok(out.weeks[0].sessions[0].id === 'wk0_s0', 'a session with no existing id gets the position-based id (session 0)');
  ok(out.weeks[0].sessions[1].id === 'wk0_s1', 'a session with no existing id gets the position-based id (session 1)');
  ok(out.weeks[0].sessions[0].exercises[0].id === 'wk0_s0_e0', 'an exercise with no existing id gets a position-based id too');
}

// ---------- 3. generateProgram output (position-scheme already) is unaffected ----------
{
  const p = generateProgram({ goal: 'hybrid', days: 3, minutes: 45, weeks: 1, includes: ['mobility', 'conditioning'], equipment: null }, {}, 1, {}, {});
  const before = p.weeks[0].sessions.map(s => s.id);
  const out = normalizeProgram(JSON.parse(JSON.stringify(p)));
  const after = out.weeks[0].sessions.map(s => s.id);
  ok(JSON.stringify(before) === JSON.stringify(after), 'a generateProgram-built week keeps identical session ids through normalizeProgram (unaffected by the fix)');
}

// ---------- 4. end-to-end: a logged set stays reachable across a simulated reload ----------
{
  const sessionId = 'wk0_today0_1751111111', exId = sessionId + '_e0';
  const justToday = {
    title: 'x', goal: 'y', unit: 'kg', weeks: [{ week: 1, sessions: [
      { id: sessionId, name: 'Full Body', focus: '', exercises: [{ id: exId, name: 'Back Squat', type: 'strength', sets: 3, reps: '5' }] }
    ] }]
  };
  const log = { [sessionId]: { date: null, ex: { [exId]: { weight: 60, sets: [{ completed: true, actual_reps: 5, actual_weight: 60 }] } } } };
  const p1 = normalizeProgram(justToday);
  const reloaded = normalizeProgram(JSON.parse(JSON.stringify(p1))); // 2nd normalize == 2nd reload
  const sesAfter = reloaded.weeks[0].sessions[0];
  ok(sesAfter.id === sessionId, 'session id unchanged after the simulated reload');
  ok(sesAfter.exercises[0].id === exId, 'exercise id unchanged after the simulated reload');
  ok(!!log[sesAfter.id], 'the ORIGINAL logged set is still reachable via state.log[session.id] after the reload');
  ok(!!(log[sesAfter.id] && log[sesAfter.id].ex[sesAfter.exercises[0].id]), 'the logged set is still reachable via state.log[session.id].ex[exercise.id]');
}

console.log(pass + ' passed, ' + fail + ' failed');
if (fail) fails.slice(0, 30).forEach(f => console.log('  - ' + f));
process.exit(fail ? 1 : 0);
