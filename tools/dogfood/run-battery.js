// Phase 8 (Elite Rubric) Task 8.5: dogfood battery runner.
//
// Regenerates all 12 approved dogfood scenarios and prints a human-readable
// report -- for a coach doing the manual review pass (docs/DOGFOOD-MANUAL-
// CHECKLIST.md), and as a quick eyeball after any engine change. This is a
// DIFFERENT artifact from tools/tests/test-phase8-battery.js: that file is
// the CI-style automated pass/fail; this one is the human-readable
// companion, run manually, never gating a commit.
//
// Usage: node tools/dogfood/run-battery.js
'use strict';
const fs = require('fs');
const path = require('path');
const rubric = require('./rubric.js');
const { SCENARIOS } = require('./scenarios.js');

const INDEX_HTML = path.join(__dirname, '..', '..', 'index.html');
const lines = fs.readFileSync(INDEX_HTML, 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /function clampInt\(/.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={LIBRARY,generateSession,generateProgram,recoverySession,degradation,isExerciseInjuryFlagged,PRESCRIPTION_TABLE,ROLES,MUSCLE_VOLUME_LANDMARKS,SECONDARY_MUSCLE_CREDIT,getAnchorState,ANCHOR_PATTERNS};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const engine = m.exports;
const { LIBRARY, MUSCLE_VOLUME_LANDMARKS, SECONDARY_MUSCLE_CREDIT } = engine;
const byName = (name) => LIBRARY.filter(e => e.name === name)[0];

function plannedMuscleVolume(sessions) {
  var doneMus = {};
  sessions.forEach(function (session) {
    (session.exercises || []).forEach(function (ex) {
      var lib = byName(ex.name);
      if (!lib || lib.type !== 'strength' || !(ex.sets > 0)) return;
      var pm = lib.primary_muscles && lib.primary_muscles[0];
      if (pm) doneMus[pm] = (doneMus[pm] || 0) + ex.sets;
      (lib.secondary_muscles || []).forEach(function (sm) { doneMus[sm] = (doneMus[sm] || 0) + ex.sets * SECONDARY_MUSCLE_CREDIT; });
    });
  });
  var byMuscleVolume = {};
  Object.keys(MUSCLE_VOLUME_LANDMARKS).forEach(function (mus) {
    var landmarks = MUSCLE_VOLUME_LANDMARKS[mus];
    byMuscleVolume[mus] = { done: doneMus[mus] || 0, mev: landmarks.mev, mav: landmarks.mav, mrv: landmarks.mrv };
  });
  return byMuscleVolume;
}

function checkSession(entry) {
  var session = entry.session, exercises = session.exercises || [];
  var v = [];
  v = v.concat(rubric.assertMeaningfulWhy(exercises));
  v = v.concat(rubric.assertNoObviousFiller(exercises, byName));
  v = v.concat(rubric.assertNoUnsafeExercises(session.name || 'session', exercises, entry.athlete.injuries, engine.isExerciseInjuryFlagged, byName));
  v = v.concat(rubric.assertPrescriptionBands(exercises, byName, engine.PRESCRIPTION_TABLE, entry.goal));
  if (entry.role) v = v.concat(rubric.assertSessionCoherence(exercises, byName, entry.role, engine.ROLES));
  if (entry.isRecovery) {
    v = v.concat(rubric.assertRecoveryContentPresent(exercises, byName));
    v = v.concat(rubric.assertReadinessRespected(entry.degradationResult, exercises, byName));
  }
  var mrv = rubric.assertMrvRespected(plannedMuscleVolume([session]));
  return { violations: v.concat(mrv.violations), notes: mrv.notes, exerciseCount: exercises.length };
}

var totalViolations = 0, totalNotes = 0;
console.log('=== Phase 8 Dogfood Battery ===\n');
SCENARIOS.forEach(function (scenario) {
  console.log('--- ' + scenario.label + ' (' + scenario.key + ') ---');
  var out = scenario.run(engine);

  (out.sessions || []).forEach(function (entry) {
    var result = checkSession(entry);
    console.log('  Session "' + (entry.session.name || '(unnamed)') + '": ' + result.exerciseCount + ' exercises, ' + result.violations.length + ' violation(s), ' + result.notes.length + ' note(s)');
    result.violations.forEach(function (v) { console.log('    VIOLATION [' + v.dimension + ']: ' + v.message); });
    result.notes.forEach(function (n) { console.log('    note [' + n.dimension + ']: ' + n.message); });
    totalViolations += result.violations.length; totalNotes += result.notes.length;
  });

  (out.programs || []).forEach(function (entry) {
    var allSessions = [];
    entry.program.weeks.forEach(function (wk) { (wk.sessions || []).forEach(function (s) { allSessions.push(s); }); });
    console.log('  Program: ' + entry.program.weeks.length + ' weeks, ' + allSessions.length + ' total sessions');
    allSessions.forEach(function (session, i) {
      var result = checkSession({ session: session, athlete: entry.athlete, goal: entry.goal, role: null, isRecovery: false });
      if (result.violations.length || result.notes.length) {
        console.log('    Session ' + (i + 1) + ' "' + (session.name || '(unnamed)') + '": ' + result.violations.length + ' violation(s), ' + result.notes.length + ' note(s)');
        result.violations.forEach(function (v) { console.log('      VIOLATION [' + v.dimension + ']: ' + v.message); });
        result.notes.forEach(function (n) { console.log('      note [' + n.dimension + ']: ' + n.message); });
      }
      totalViolations += result.violations.length; totalNotes += result.notes.length;
    });
  });

  if (out.anchorRepeat) {
    var s1ex = out.anchorRepeat.s1.exercises.filter(function (e) { var lib = byName(e.name); return lib && lib.type === 'strength'; });
    var s2ex = out.anchorRepeat.s2.exercises.filter(function (e) { var lib = byName(e.name); return lib && lib.type === 'strength'; });
    var a1 = s1ex[0] && s1ex[0].name, a2 = s2ex[0] && s2ex[0].name;
    var v = rubric.assertAnchorStable('anchor-repeat', a1 ? { exerciseId: a1 } : null, a2 ? { exerciseId: a2 } : null);
    console.log('  Anchor stability check: ' + (v.length ? 'VIOLATION - ' + v[0].message : 'stable (' + a1 + ')'));
    totalViolations += v.length;
  }
  console.log('');
});

console.log('=== Summary: ' + totalViolations + ' violation(s), ' + totalNotes + ' note(s) across ' + SCENARIOS.length + ' scenarios ===');
console.log('This report never gates a commit -- see docs/DOGFOOD-MANUAL-CHECKLIST.md for the separate manual coach review.');
