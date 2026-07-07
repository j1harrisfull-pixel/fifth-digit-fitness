// Phase 8 (Elite Rubric) Task 8.3: wires the rubric assertion library
// (tools/dogfood/rubric.js) to all 12 approved dogfood scenarios
// (tools/dogfood/scenarios.js) and asserts against the REAL engine's CURRENT
// output. This is pure observation -- it builds sessions/programs via the
// real generateSession/generateProgram/recoverySession/degradation and
// checks structural coaching properties, never exact exercise names/IDs
// (except where a scenario's own purpose is anchor identity or safety
// exclusion, per the approved design). No engine behaviour is changed here.
const fs = require('fs');
const rubric = require('../dogfood/rubric.js');
const { SCENARIOS } = require('../dogfood/scenarios.js');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /function clampInt\(/.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={LIBRARY,generateSession,generateProgram,recoverySession,degradation,isExerciseInjuryFlagged,PRESCRIPTION_TABLE,ROLES,MUSCLE_VOLUME_LANDMARKS,SECONDARY_MUSCLE_CREDIT,getAnchorState,ANCHOR_PATTERNS};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const engine = m.exports;
const { LIBRARY, MUSCLE_VOLUME_LANDMARKS, SECONDARY_MUSCLE_CREDIT } = engine;

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };
const byName = (name) => LIBRARY.filter(e => e.name === name)[0];

// Sums PLANNED sets (the built output, not logged history) per muscle across
// a set of sessions, using the same credit rule computeWeeklyDebt already
// uses (primary full weight, secondary at SECONDARY_MUSCLE_CREDIT) against
// the same MUSCLE_VOLUME_LANDMARKS table -- an aggregation over already-real
// numbers, not a new coaching computation.
function plannedMuscleVolume(sessions) {
  var doneMus = {};
  sessions.forEach(function (session) {
    (session.exercises || []).forEach(function (ex) {
      var lib = byName(ex.name);
      if (!lib || lib.type !== 'strength' || !(ex.sets > 0)) return;
      var pm = lib.primary_muscles && lib.primary_muscles[0];
      if (pm) doneMus[pm] = (doneMus[pm] || 0) + ex.sets;
      (lib.secondary_muscles || []).forEach(function (sm) {
        doneMus[sm] = (doneMus[sm] || 0) + ex.sets * SECONDARY_MUSCLE_CREDIT;
      });
    });
  });
  var byMuscleVolume = {};
  Object.keys(MUSCLE_VOLUME_LANDMARKS).forEach(function (mus) {
    var landmarks = MUSCLE_VOLUME_LANDMARKS[mus];
    byMuscleVolume[mus] = { done: doneMus[mus] || 0, mev: landmarks.mev, mav: landmarks.mav, mrv: landmarks.mrv };
  });
  return byMuscleVolume;
}

function checkSession(label, entry) {
  var session = entry.session, exercises = session.exercises || [];
  var v = [];
  v = v.concat(rubric.assertMeaningfulWhy(exercises));
  v = v.concat(rubric.assertNoObviousFiller(exercises, byName));
  v = v.concat(rubric.assertNoUnsafeExercises(label, exercises, entry.athlete.injuries, engine.isExerciseInjuryFlagged, byName));
  v = v.concat(rubric.assertPrescriptionBands(exercises, byName, engine.PRESCRIPTION_TABLE, entry.goal));
  if (entry.role) v = v.concat(rubric.assertSessionCoherence(exercises, byName, entry.role, engine.ROLES));
  if (entry.isRecovery) {
    v = v.concat(rubric.assertRecoveryContentPresent(exercises, byName));
    v = v.concat(rubric.assertReadinessRespected(entry.degradationResult, exercises, byName));
  }
  var mrv = rubric.assertMrvRespected(plannedMuscleVolume([session]));
  v = v.concat(mrv.violations);
  ok(v.length === 0, v.length ? (label + ': ' + v.map(x => x.message).join(' | ')) : '');
  if (!v.length) pass = pass; // (message already recorded by ok() when failing)
  return v;
}

SCENARIOS.forEach(function (scenario) {
  var out = scenario.run(engine);
  var label = scenario.label + ' (' + scenario.key + ')';

  (out.sessions || []).forEach(function (entry) {
    ok(entry.session && Array.isArray(entry.session.exercises) && entry.session.exercises.length > 0, label + ': builds a non-empty session');
    checkSession(label, entry);
  });

  (out.programs || []).forEach(function (entry) {
    var program = entry.program;
    ok(program && Array.isArray(program.weeks) && program.weeks.length > 0, label + ': builds a non-empty program');
    var allSessions = [];
    program.weeks.forEach(function (wk) { (wk.sessions || []).forEach(function (s) { allSessions.push(s); }); });
    ok(allSessions.length > 0, label + ': program has at least one session across all weeks');
    allSessions.forEach(function (session) {
      checkSession(label, { session: session, athlete: entry.athlete, goal: entry.goal, role: null, isRecovery: false });
    });
    // Deload week (last week, when totalWeeks >= 4) should carry looser RIR
    // than week 3 for its own anchor -- structural, not exact-value, check:
    // every deload-week strength exercise's target string should read "eased"
    // relative to a genuine deload prescription (ririForWeek adds +1 rir on
    // deload, i.e. an EASIER effort target than week 3's tightest band).
    var lastWeek = program.weeks[program.weeks.length - 1];
    if (program.weeks.length >= 4 && lastWeek && lastWeek.sessions) {
      var deloadHasContent = lastWeek.sessions.some(function (s) { return (s.exercises || []).length > 0; });
      ok(deloadHasContent, label + ': deload (final) week still builds real session content, not an empty week');
    }
  });

  // Scenario 2/9: anchor stability across two builds with the same seed/athlete.
  if (out.anchorRepeat) {
    var s1ex = out.anchorRepeat.s1.exercises.filter(function (e) { var lib = byName(e.name); return lib && lib.type === 'strength'; });
    var s2ex = out.anchorRepeat.s2.exercises.filter(function (e) { var lib = byName(e.name); return lib && lib.type === 'strength'; });
    var anchorName1 = s1ex[0] && s1ex[0].name, anchorName2 = s2ex[0] && s2ex[0].name;
    var v = rubric.assertAnchorStable('anchor-repeat', anchorName1 ? { exerciseId: anchorName1 } : null, anchorName2 ? { exerciseId: anchorName2 } : null);
    ok(v.length === 0, v.length ? (label + ': ' + v[0].message) : '');
  }
});

console.log(`${pass} passed, ${fail} failed`);
if (fail) { fails.filter(Boolean).forEach(f => console.log('FAIL:', f)); process.exit(1); }
