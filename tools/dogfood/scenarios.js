// Phase 8 (Elite Rubric) Task 8.2: fixed, deterministic dogfood scenarios.
//
// Per James's approved judgement call: FIXED athlete fixtures (not fresh-
// per-run), seeded generation. This is a regression/quality harness, not a
// randomness test -- every scenario must be exactly reproducible so a
// failure is meaningful and diffable across engine changes.
//
// Each scenario's `run(engine)` calls ONLY real, already-shipped engine
// entry points (generateSession/generateProgram/recoverySession/degradation)
// -- it never re-implements or second-guesses what they decide. `engine` is
// the object of coach-span exports loaded by the caller (see run-battery.js
// / test-phase8-battery.js for the exact load pattern).
'use strict';

var SEED = 42; // one fixed base seed for the whole battery -- reproducible, diffable

function athlete(overrides) {
  var base = { experience: 'intermediate', injuries: [], prefs: {}, metrics: {}, history: {} };
  return Object.assign({}, base, overrides || {});
}

var SCENARIOS = [
  {
    key: 'beginner-full-body-30',
    label: 'Beginner full-body, 30 minutes',
    run: function (e) {
      var ath = athlete({ experience: 'beginner' });
      var parsed = { role: 'full', minutes: 30, goal: 'general', equipment: null, includes: [] };
      var session = e.generateSession(parsed, {}, SEED, {}, null, false, {}, ath, null, null, null);
      return { sessions: [{ session: session, role: 'full', goal: 'general', athlete: ath }] };
    }
  },
  {
    key: 'intermediate-upper-strength',
    label: 'Intermediate upper-body strength',
    run: function (e) {
      var ath = athlete({ experience: 'intermediate' });
      var parsed = { role: 'upper', minutes: 60, goal: 'strength', equipment: null, includes: [] };
      var s1 = e.generateSession(parsed, {}, SEED, {}, null, false, {}, ath, null, null, null);
      var s2 = e.generateSession(parsed, {}, SEED, {}, null, false, {}, ath, null, null, null);
      return {
        sessions: [{ session: s1, role: 'upper', goal: 'strength', athlete: ath }],
        anchorRepeat: { s1: s1, s2: s2 } // same seed/athlete -> anchor pick must be identical
      };
    }
  },
  {
    key: 'lower-hypertrophy',
    label: 'Lower-body hypertrophy',
    run: function (e) {
      var ath = athlete({ experience: 'intermediate' });
      var parsed = { role: 'lower', minutes: 60, goal: 'hypertrophy', equipment: null, includes: [] };
      var session = e.generateSession(parsed, {}, SEED, {}, null, false, {}, ath, null, null, null);
      return { sessions: [{ session: session, role: 'lower', goal: 'hypertrophy', athlete: ath }] };
    }
  },
  {
    key: 'short-20min-pump',
    label: 'Short 20-minute pump-style session',
    run: function (e) {
      var ath = athlete({ experience: 'intermediate' });
      var parsed = { role: 'upper', minutes: 20, goal: 'hypertrophy', equipment: null, includes: [] };
      var session = e.generateSession(parsed, {}, SEED, {}, null, false, {}, ath, null, null, null);
      return { sessions: [{ session: session, role: 'upper', goal: 'hypertrophy', athlete: ath }] };
    }
  },
  {
    key: 'rough-readiness-recovery',
    label: 'Rough-readiness recovery session',
    run: function (e) {
      var ath = athlete({ experience: 'intermediate' });
      var patterns = ['squat', 'hinge'];
      var degradationResult = e.degradation(null, 0, patterns); // readinessValue 0 = "rough"
      var session = e.recoverySession(null, SEED, ath.injuries, {});
      return { sessions: [{ session: session, role: null, goal: 'general', athlete: ath, isRecovery: true, degradationResult: degradationResult }] };
    }
  },
  {
    key: 'shoulder-restricted',
    label: 'Injury-restricted shoulder session',
    run: function (e) {
      var ath = athlete({ experience: 'intermediate', injuries: [{ category: 'pain', target: 'shoulder' }] });
      var parsed = { role: 'upper', minutes: 45, goal: 'general', equipment: null, includes: [] };
      var session = e.generateSession(parsed, {}, SEED, {}, null, false, {}, ath, null, null, null);
      return { sessions: [{ session: session, role: 'upper', goal: 'general', athlete: ath }] };
    }
  },
  {
    key: 'knee-restricted-lower',
    label: 'Knee-restricted lower-body session',
    run: function (e) {
      var ath = athlete({ experience: 'intermediate', injuries: [{ category: 'pain', target: 'knee' }] });
      var parsed = { role: 'lower', minutes: 45, goal: 'general', equipment: null, includes: [] };
      var session = e.generateSession(parsed, {}, SEED, {}, null, false, {}, ath, null, null, null);
      return { sessions: [{ session: session, role: 'lower', goal: 'general', athlete: ath }] };
    }
  },
  {
    key: 'equipment-limited-home',
    label: 'Equipment-limited home session',
    run: function (e) {
      var ath = athlete({ experience: 'intermediate' });
      var parsed = { role: 'full', minutes: 45, goal: 'general', equipment: ['bodyweight'], includes: [] };
      var session = e.generateSession(parsed, {}, SEED, {}, null, false, {}, ath, null, null, null);
      return { sessions: [{ session: session, role: 'full', goal: 'general', athlete: ath, equipment: ['bodyweight'] }] };
    }
  },
  {
    key: 'advanced-anchor-progression',
    label: 'Advanced anchor-progression session (multi-week program)',
    run: function (e) {
      var ath = athlete({ experience: 'advanced' });
      var intake = { days: 4, goal: 'strength', minutes: 60, weeks: 4, includes: [], equipment: null };
      var program = e.generateProgram(intake, {}, SEED, {}, {}, ath, null, null, null);
      return { programs: [{ program: program, athlete: ath, goal: 'strength' }] };
    }
  },
  {
    key: 'conditioning-plus-strength',
    label: 'Conditioning requested alongside strength',
    run: function (e) {
      var ath = athlete({ experience: 'intermediate' });
      var parsed = { role: 'full', minutes: 45, goal: 'general', equipment: null, includes: ['conditioning'] };
      var session = e.generateSession(parsed, {}, SEED, {}, null, false, {}, ath, null, null, null);
      return { sessions: [{ session: session, role: 'full', goal: 'general', athlete: ath }] };
    }
  },
  {
    key: 'full-week-build',
    label: 'Full week build (4 days x 4 weeks, hypertrophy)',
    run: function (e) {
      var ath = athlete({ experience: 'intermediate' });
      var intake = { days: 4, goal: 'hypertrophy', minutes: 60, weeks: 4, includes: [], equipment: null };
      var program = e.generateProgram(intake, {}, SEED, {}, {}, ath, null, null, null);
      return { programs: [{ program: program, athlete: ath, goal: 'hypertrophy' }] };
    }
  },
  {
    key: 'just-today-build',
    label: 'Just Today build (free-text, no role)',
    run: function (e) {
      var ath = athlete({ experience: 'intermediate' });
      var parsed = { patterns: ['squat', 'hpush'], minutes: 45, goal: 'general', equipment: null, includes: [] };
      var session = e.generateSession(parsed, {}, SEED, {}, null, false, {}, ath, null, null, null);
      return { sessions: [{ session: session, role: null, goal: 'general', athlete: ath }] };
    }
  }
];

module.exports = { SCENARIOS: SCENARIOS, SEED: SEED };
