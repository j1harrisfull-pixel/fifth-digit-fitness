// Phase 8 (Elite Rubric) Task 8.4: safety-invariant sweep.
//
// Re-VERIFIES the existing global guarantee (every real exercise entry point
// routes through isExerciseInjuryFlagged) across every known entry point,
// after every phase built through Phase 7. This is observation, not new
// safety logic -- it never adds a gate, it only re-checks that the gates
// already documented at index.html:~1511-1523 still hold for the CURRENT
// code. pickFiller (index.html:~7504, live rest-time suggestion UI) lives
// OUTSIDE the coach-span slice this harness can load and is covered by its
// own dedicated Phase 5.5 test coverage -- not retested here (see the Phase 8
// design doc §9, which records this explicitly rather than silently omitting it).
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /function clampInt\(/.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={LIBRARY,isExerciseInjuryFlagged,pickByType,pickMobilityByPatterns,pickPulseRaiser,pickFunctional,pickConditioning,conditioningAlternatives,pickLightPump,runWorkout,generateSession,generateProgram,recoverySession,buildWarmupCooldown};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const {
  LIBRARY, isExerciseInjuryFlagged, pickByType, pickMobilityByPatterns, pickPulseRaiser, pickFunctional,
  pickConditioning, conditioningAlternatives, pickLightPump, runWorkout, generateSession, generateProgram,
  recoverySession, buildWarmupCooldown
} = m.exports;

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };
const byName = (name) => LIBRARY.filter(e => e.name === name)[0];

var KNEE = [{ category: 'pain', target: 'knee' }];
var SHOULDER = [{ category: 'pain', target: 'shoulder' }];
var INJURY_SETS = [KNEE, SHOULDER, []];
var SEEDS = Array.from({ length: 12 }, (_, i) => i);

function assertNeverFlagged(entryPointName, exercise, injuries) {
  if (!exercise) return; // honest omission is always a valid, safe outcome
  var lib = byName(exercise.name) || exercise;
  ok(!isExerciseInjuryFlagged(lib, injuries), `${entryPointName} returned "${exercise.name}", which isExerciseInjuryFlagged() flags for injuries ${JSON.stringify(injuries)}`);
}

function sweepEntryPointExercises(entryPointName, exercisesList, injuries) {
  (exercisesList || []).forEach(function (e) { assertNeverFlagged(entryPointName, e, injuries); });
}

// ===================== 1. pickByType =====================
INJURY_SETS.forEach(function (inj) {
  SEEDS.forEach(function (seed) {
    var pick = pickByType('mobility', null, {}, seed, inj);
    assertNeverFlagged('pickByType("mobility")', pick, inj);
  });
});

// ===================== 2. pickMobilityByPatterns =====================
INJURY_SETS.forEach(function (inj) {
  SEEDS.forEach(function (seed) {
    var picks = pickMobilityByPatterns(['squat', 'hinge'], 2, null, {}, seed, inj);
    sweepEntryPointExercises('pickMobilityByPatterns', picks, inj);
  });
});

// ===================== 3. pickPulseRaiser =====================
INJURY_SETS.forEach(function (inj) {
  SEEDS.forEach(function (seed) {
    var pick = pickPulseRaiser({}, seed, inj);
    assertNeverFlagged('pickPulseRaiser', pick, inj);
  });
});

// ===================== 4. pickFunctional =====================
INJURY_SETS.forEach(function (inj) {
  SEEDS.forEach(function (seed) {
    ['carry', 'rotation'].forEach(function (kind) {
      var pick = pickFunctional(kind, null, {}, seed, inj);
      assertNeverFlagged('pickFunctional("' + kind + '")', pick, inj);
    });
  });
});

// ===================== 5. pickConditioning + conditioningAlternatives =====================
INJURY_SETS.forEach(function (inj) {
  SEEDS.forEach(function (seed) {
    ['z2', 'interval', 'threshold'].forEach(function (intensity) {
      var pick = pickConditioning(intensity, null, {}, seed, inj);
      assertNeverFlagged('pickConditioning("' + intensity + '")', pick, inj);
      if (pick) {
        var alts = conditioningAlternatives(pick.name, null, inj);
        alts.forEach(function (alt) { assertNeverFlagged('conditioningAlternatives', alt, inj); });
      }
    });
  });
});

// ===================== 6. pickLightPump =====================
INJURY_SETS.forEach(function (inj) {
  SEEDS.forEach(function (seed) {
    var pick = pickLightPump(null, {}, seed, {}, inj);
    assertNeverFlagged('pickLightPump', pick, inj);
  });
});

// ===================== 7. runWorkout =====================
INJURY_SETS.forEach(function (inj) {
  SEEDS.forEach(function (seed) {
    var run = runWorkout(seed % 4, 4, 45, 1, inj);
    assertNeverFlagged('runWorkout', run, inj);
  });
});

// ===================== 8. buildWarmupCooldown (Box Breathing + prep drills) =====================
INJURY_SETS.forEach(function (inj) {
  SEEDS.forEach(function (seed) {
    var wc = buildWarmupCooldown([], null, {}, seed, {}, 45, 1, false, {}, inj);
    sweepEntryPointExercises('buildWarmupCooldown.warmup', wc.warmup, inj);
    sweepEntryPointExercises('buildWarmupCooldown.cooldown', wc.cooldown, inj);
  });
});

// ===================== 9-12. Integration: generateSession / generateProgram / recoverySession =====================
// These wrap pickStrength / anchorIsAvailable / topUpThinDay's floorMoveSafe
// internally (no standalone signature simple enough to call directly without
// reconstructing their private ctx) -- exercised here at the integration
// level, exactly like Phase 5.5/Phase 7's own safety sweeps.
var ROLE_REQUESTS = [
  { role: 'full', minutes: 45, goal: 'general' },
  { role: 'upper', minutes: 45, goal: 'strength' },
  { role: 'lower', minutes: 45, goal: 'hypertrophy' },
  { role: 'push', minutes: 20, goal: 'hypertrophy' } // short session, exercises topUpThinDay/density paths too
];
INJURY_SETS.forEach(function (inj) {
  var athlete = { experience: 'intermediate', injuries: inj, prefs: {}, metrics: {}, history: {} };
  SEEDS.forEach(function (seed) {
    ROLE_REQUESTS.forEach(function (req) {
      var parsed = Object.assign({ equipment: null, includes: ['conditioning'] }, req);
      var session = generateSession(parsed, {}, seed, {}, null, false, {}, athlete, null, null, null);
      sweepEntryPointExercises('generateSession(' + req.role + ')', session.exercises, inj);
    });
  });
});
INJURY_SETS.forEach(function (inj) {
  var athlete = { experience: 'intermediate', injuries: inj, prefs: {}, metrics: {}, history: {} };
  var intake = { days: 4, goal: 'hypertrophy', minutes: 60, weeks: 4, includes: ['conditioning'], equipment: null };
  var program = generateProgram(intake, {}, 7, {}, {}, athlete, null, null, null);
  program.weeks.forEach(function (wk) {
    wk.sessions.forEach(function (session) {
      sweepEntryPointExercises('generateProgram week/session', session.exercises, inj);
    });
  });
});
INJURY_SETS.forEach(function (inj) {
  SEEDS.forEach(function (seed) {
    var session = recoverySession(null, seed, inj, {});
    sweepEntryPointExercises('recoverySession', session.exercises, inj);
  });
});

// A bodyweight-equipment-limited sweep, since equipment-limited pools are the
// most likely to be forced toward a narrow, edge-case candidate set.
INJURY_SETS.forEach(function (inj) {
  var athlete = { experience: 'intermediate', injuries: inj, prefs: {}, metrics: {}, history: {} };
  SEEDS.forEach(function (seed) {
    var parsed = { role: 'full', minutes: 45, goal: 'general', equipment: ['bodyweight'], includes: [] };
    var session = generateSession(parsed, {}, seed, {}, null, false, {}, athlete, null, null, null);
    sweepEntryPointExercises('generateSession(bodyweight-only)', session.exercises, inj);
  });
});

console.log(`${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
