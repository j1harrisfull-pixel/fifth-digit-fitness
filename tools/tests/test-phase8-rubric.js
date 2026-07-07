// Phase 8 (Elite Rubric) Task 8.1: unit tests for tools/dogfood/rubric.js
// against small, hand-built fixtures (not full dogfood scenarios -- those are
// Task 8.2/8.3). Uses the real engine's own isExerciseInjuryFlagged/LIBRARY/
// PRESCRIPTION_TABLE/ROLE_PRIMARY via the standard slice-and-eval harness, so
// this file never re-implements or guesses engine behaviour.
const fs = require('fs');
const rubric = require('../dogfood/rubric.js');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /function clampInt\(/.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={LIBRARY,isExerciseInjuryFlagged,PRESCRIPTION_TABLE,ROLES};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const { LIBRARY, isExerciseInjuryFlagged, PRESCRIPTION_TABLE, ROLES } = m.exports;

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };
const byName = (name) => LIBRARY.filter(e => e.name === name)[0];

// ================= assertNoUnsafeExercises =================
{
  const benchLib = byName('Bench Press');
  const built = [{ name: 'Bench Press', why: 'x' }];
  const v = rubric.assertNoUnsafeExercises('Test session', built, [{ category: 'pain', target: 'shoulder' }], isExerciseInjuryFlagged, byName);
  ok(v.length === 1, `assertNoUnsafeExercises flags a shoulder-flagged Bench Press for a shoulder-injured athlete (got ${v.length})`);
  ok(v[0].message.indexOf('Bench Press') >= 0 && v[0].message.indexOf('unsafe') >= 0, 'violation message names the exercise and explains why');
}
{
  const built = [{ name: 'Bench Press', why: 'x' }];
  const v = rubric.assertNoUnsafeExercises('Test session', built, [], isExerciseInjuryFlagged, byName);
  ok(v.length === 0, 'assertNoUnsafeExercises returns no violations when the athlete has no injuries');
}
{
  // Non-LIBRARY-backed name (e.g. an absolute-floor fallback outside LIBRARY) -- skipped, not crashed.
  const built = [{ name: 'Totally Made Up Exercise', why: 'x' }];
  let threw = false;
  let v;
  try { v = rubric.assertNoUnsafeExercises('Test session', built, [{ category: 'pain', target: 'shoulder' }], isExerciseInjuryFlagged, byName); } catch (e) { threw = true; }
  ok(!threw && v.length === 0, 'assertNoUnsafeExercises does not throw and skips exercises with no LIBRARY match');
}

// ================= assertPrescriptionBands =================
{
  // Hypertrophy isolation exercise correctly prescribed 10-15 -- no violation.
  const built = [{ name: 'Bench Press', reps: '6-12' }, { name: 'Lateral Raise', reps: '10-15' }];
  const v = rubric.assertPrescriptionBands(built, byName, PRESCRIPTION_TABLE, 'hypertrophy');
  ok(v.length === 0, `assertPrescriptionBands passes a correctly-prescribed hypertrophy session (violations: ${JSON.stringify(v)})`);
}
{
  // The example failure from the brief: a hypertrophy isolation exercise given 6-8 instead of 10-15.
  const built = [{ name: 'Bench Press', reps: '6-12' }, { name: 'Lateral Raise', reps: '6-8' }];
  const v = rubric.assertPrescriptionBands(built, byName, PRESCRIPTION_TABLE, 'hypertrophy');
  ok(v.length === 1, `assertPrescriptionBands catches a hypertrophy isolation exercise given the wrong rep band (got ${v.length})`);
  ok(v[0].message.indexOf('Lateral Raise') >= 0 && v[0].message.indexOf('6-8') >= 0 && v[0].message.indexOf('10-15') >= 0, `violation message names exercise, actual, and expected band (got: ${v[0] && v[0].message})`);
}
{
  // Ramp-anchor strength override (3-5 reps) is a documented exception, never flagged.
  const built = [{ name: 'Bench Press', reps: '3-5' }];
  const v = rubric.assertPrescriptionBands(built, byName, PRESCRIPTION_TABLE, 'strength');
  ok(v.length === 0, 'assertPrescriptionBands does not flag a ramp anchor\'s documented 3-5 strength override');
}
{
  // hybrid/endurance use the legacy bracket, explicitly skipped.
  const built = [{ name: 'Bench Press', reps: '5-6' }];
  const v = rubric.assertPrescriptionBands(built, byName, PRESCRIPTION_TABLE, 'hybrid');
  ok(v.length === 0, 'assertPrescriptionBands skips hybrid/endurance goals (legacy bracket, not table-driven)');
}

// ================= assertAnchorStable =================
{
  const v = rubric.assertAnchorStable('squat', { exerciseId: 'back-squat' }, { exerciseId: 'back-squat' });
  ok(v.length === 0, 'assertAnchorStable passes when the anchor exerciseId is identical across two builds');
}
{
  const v = rubric.assertAnchorStable('squat', { exerciseId: 'back-squat' }, { exerciseId: 'front-squat' });
  ok(v.length === 1, `assertAnchorStable flags a changed anchor exerciseId (got ${v.length})`);
  ok(v[0].message.indexOf('back-squat') >= 0 && v[0].message.indexOf('front-squat') >= 0, 'violation message names both the old and new exerciseId');
}
{
  const v = rubric.assertAnchorStable('squat', null, null);
  ok(v.length === 0, 'assertAnchorStable is a no-op when either side has no frozen anchor yet (nothing to compare)');
}

// ================= assertRecoveryContentPresent =================
{
  const built = [{ name: 'Cat-Cow' }, { name: 'Box Breathing' }];
  const v = rubric.assertRecoveryContentPresent(built, byName);
  ok(v.length === 0, `assertRecoveryContentPresent passes when real mobility content is present (violations: ${JSON.stringify(v)})`);
}
{
  // Box Breathing is itself LIBRARY type "mobility" -- use a non-mobility
  // exercise (a conditioning pick) to construct a genuinely mobility-free session.
  const z2Lib = LIBRARY.filter(e => e.type === 'conditioning' && e.intensity === 'z2')[0];
  const built = [{ name: z2Lib.name }];
  const v = rubric.assertRecoveryContentPresent(built, byName);
  ok(v.length === 1, 'assertRecoveryContentPresent flags a recovery session with zero mobility-type content');
  ok(v[0].message.indexOf('mobility') >= 0, 'violation message explains the missing content type');
}

// ================= assertMeaningfulWhy =================
{
  const built = [{ name: 'Bench Press', why: 'Primary horizontal push, most behind this week' }];
  ok(rubric.assertMeaningfulWhy(built).length === 0, 'assertMeaningfulWhy passes a real, non-empty why');
}
{
  const built = [{ name: 'Bench Press', why: '' }, { name: 'Squat', why: '   ' }, { name: 'Row' }];
  const v = rubric.assertMeaningfulWhy(built);
  ok(v.length === 3, `assertMeaningfulWhy flags empty, whitespace-only, and missing why fields (got ${v.length})`);
}

// ================= assertNoObviousFiller =================
{
  const built = [{ name: 'Bench Press', reps: '6-12', rir: 2, sets: 4 }];
  ok(rubric.assertNoObviousFiller(built, byName).length === 0, 'assertNoObviousFiller passes a fully-prescribed strength exercise');
}
{
  const built = [{ name: 'Bench Press', reps: '6-12', sets: 4 }]; // missing rir
  const v = rubric.assertNoObviousFiller(built, byName);
  ok(v.length === 1 && v[0].message.indexOf('rir') >= 0, `assertNoObviousFiller flags a strength exercise missing rir (got ${JSON.stringify(v)})`);
}
{
  const built = [{ name: 'Bench Press', reps: '6-12', rir: 2, sets: 0 }]; // no sets
  const v = rubric.assertNoObviousFiller(built, byName);
  ok(v.length === 1 && v[0].message.indexOf('sets') >= 0, `assertNoObviousFiller flags a strength exercise with zero sets (got ${JSON.stringify(v)})`);
}
{
  const built = [{ name: 'Bench Press', rir: 2, sets: 4 }]; // no reps at all
  const v = rubric.assertNoObviousFiller(built, byName);
  ok(v.some(x => x.message.indexOf('no reps') >= 0), 'assertNoObviousFiller flags any exercise with an empty reps field');
}

// ================= assertMrvRespected =================
{
  const byMuscleVolume = { chest: { done: 14, mev: 8, mav: 14, mrv: 20 } };
  const r = rubric.assertMrvRespected(byMuscleVolume);
  ok(r.violations.length === 0 && r.notes.length === 0, 'assertMrvRespected: under MRV is clean, no violation and no note');
}
{
  const byMuscleVolume = { chest: { done: 21, mev: 8, mav: 14, mrv: 20 } };
  const r = rubric.assertMrvRespected(byMuscleVolume);
  ok(r.violations.length === 0, 'assertMrvRespected: 1 set over MRV is within the documented floor-of-1 tolerance, not a violation');
  ok(r.notes.length === 1 && r.notes[0].message.indexOf('minimum exposure under MRV cap') >= 0, 'assertMrvRespected: 1-over is surfaced as an explicit "minimum exposure under MRV cap" note, not silently ignored');
}
{
  const byMuscleVolume = { chest: { done: 26, mev: 8, mav: 14, mrv: 20 } };
  const r = rubric.assertMrvRespected(byMuscleVolume);
  ok(r.violations.length === 1, `assertMrvRespected: 6 sets over MRV (beyond floor-of-1 tolerance) is a real violation (got ${r.violations.length})`);
  ok(r.violations[0].message.indexOf('chest') >= 0 && r.violations[0].message.indexOf('26') >= 0 && r.violations[0].message.indexOf('20') >= 0, 'violation message names the muscle, actual total, and MRV');
}

// ================= assertReadinessRespected =================
{
  const built = [{ name: 'Cat-Cow' }, { name: 'Box Breathing' }];
  ok(rubric.assertReadinessRespected('recovery', built, byName).length === 0, 'assertReadinessRespected passes a genuine recovery-path build (no compound strength)');
}
{
  const built = [{ name: 'Bench Press' }]; // compound strength
  const v = rubric.assertReadinessRespected('recovery', built, byName);
  ok(v.length === 1, `assertReadinessRespected flags a "recovery" decision that still built compound strength work (got ${v.length})`);
  ok(v[0].message.indexOf('recovery') >= 0, 'violation message names the mismatched decision');
}
{
  const built = [{ name: 'Bench Press' }];
  ok(rubric.assertReadinessRespected('normal', built, byName).length === 0, 'assertReadinessRespected is a no-op for "normal"/"eased" decisions');
}

// ================= assertSessionCoherence =================
{
  const built = [{ name: 'Bench Press' }]; // pattern hpush, in ROLE_PRIMARY.upper
  ok(rubric.assertSessionCoherence(built, byName, 'upper', ROLES).length === 0, 'assertSessionCoherence passes an on-theme exercise for its role');
}
{
  const built = [{ name: 'Back Squat' }]; // pattern squat, NOT in ROLE_PRIMARY.upper
  const squatLib = LIBRARY.filter(e => e.pattern === 'squat' && e.compound)[0];
  const b2 = [{ name: squatLib.name }];
  const v = rubric.assertSessionCoherence(b2, byName, 'upper', ROLES);
  ok(v.length === 1, `assertSessionCoherence flags an off-theme squat pattern on an "upper" day (got ${v.length})`);
  ok(v[0].message.indexOf('upper') >= 0, 'violation message names the mismatched role');
}
{
  const built = [{ name: 'Bench Press' }];
  ok(rubric.assertSessionCoherence(built, byName, 'some-freetext-role', ROLES).length === 0, 'assertSessionCoherence is a no-op for a role with no ROLE_PRIMARY entry (free-text request)');
}

console.log(`${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
