// Phase 2 (Intent Blueprint) tests: buildIntent() is the single source of
// truth for stimulus/target-pattern/constraints -- proves determinism (same
// request always yields a deep-equal Intent object) and behaviour-preservation
// (the values match what the old inline selGoal/allowPats derivation produced).
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /function clampInt\(/.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={buildIntent,generateSession,generateProgram,normalizeAthlete,rolePatterns};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const { buildIntent, generateSession, generateProgram, normalizeAthlete, rolePatterns } = m.exports;
let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- determinism: identical requests always produce a deep-equal Intent ----------
{
  const req = { goal: 'hypertrophy', role: 'upper', minutes: 45, equipment: ['barbell', 'bodyweight'] };
  const a = buildIntent(req), b = buildIntent(req);
  ok(JSON.stringify(a) === JSON.stringify(b), 'buildIntent(sameRequest) called twice yields a deep-equal Intent object');
  const c = buildIntent(Object.assign({}, req)); // a fresh object, same values
  ok(JSON.stringify(a) === JSON.stringify(c), 'buildIntent is deterministic across independently-constructed but equal inputs');
}

// ---------- stimulus derivation matches the old selGoal ternary exactly ----------
{
  ok(buildIntent({ goal: 'hypertrophy' }).primary.stimulus === 'hypertrophy', 'goal hypertrophy -> stimulus hypertrophy');
  ok(buildIntent({ goal: 'strength' }).primary.stimulus === 'strength', 'goal strength -> stimulus strength');
  ['hybrid', 'endurance', 'general', undefined].forEach(g => {
    ok(buildIntent({ goal: g }).primary.stimulus === 'general', `goal ${g} -> stimulus general (matches old ternary fallthrough)`);
  });
}

// ---------- focusPatterns resolution (role wins, else raw patterns, else null) ----------
{
  ok(JSON.stringify(buildIntent({ role: 'upper' }).primary.focusPatterns) === JSON.stringify(rolePatterns('upper')), 'a role resolves focusPatterns via the real rolePatterns(role)');
  ok(JSON.stringify(buildIntent({ patterns: ['squat', 'hinge'] }).primary.focusPatterns) === JSON.stringify(['squat', 'hinge']), 'no role, real patterns[] -> focusPatterns = patterns');
  ok(buildIntent({}).primary.focusPatterns === null, 'no role, no patterns -> focusPatterns null (matches old allowPats null fallback)');
}

// ---------- constraints: minutes/equipment clamped + passed through ----------
{
  const i = buildIntent({ minutes: 999, equipment: ['dumbbell'] });
  ok(i.constraints.minutes === 120, 'minutes clamps to the 15-120 range (999 -> 120)');
  const i2 = buildIntent({ minutes: 3 });
  ok(i2.constraints.minutes === 15, 'minutes clamps up to the floor (3 -> 15)');
  ok(i.constraints.equipment.length === 1 && i.constraints.equipment[0] === 'dumbbell', 'equipment array passed through');
  ok(buildIntent({}).constraints.equipment === null, 'no equipment -> null (full gym), same convention as today');
}

// ---------- constraints: athlete (experience/injuries) flows through, defaults safely ----------
{
  const athlete = normalizeAthlete({ experience: 'advanced', injuries: [{ category: 'nogo', target: 'Burpees' }] });
  const i = buildIntent({ goal: 'strength' }, athlete);
  ok(i.constraints.experience === 'advanced', 'athlete.experience flows into constraints.experience');
  ok(i.constraints.injuries.length === 1 && i.constraints.injuries[0].target === 'Burpees', 'athlete.injuries flows into constraints.injuries');
  const iNoAthlete = buildIntent({ goal: 'strength' });
  ok(iNoAthlete.constraints.experience === 'intermediate', 'no athlete -> experience defaults to intermediate');
  ok(Array.isArray(iNoAthlete.constraints.injuries) && iNoAthlete.constraints.injuries.length === 0, 'no athlete -> injuries defaults to []');
}

// ---------- goal passthrough (raw string preserved alongside derived stimulus) ----------
{
  ok(buildIntent({ goal: 'hybrid' }).goal === 'hybrid', 'raw goal string is preserved on the intent object (not just the derived stimulus)');
  ok(buildIntent({}).goal === 'general', 'missing goal defaults to "general"');
}

console.log(pass + ' passed, ' + fail + ' failed');
if (fail) fails.slice(0, 30).forEach(f => console.log('  - ' + f));
process.exit(fail ? 1 : 0);
