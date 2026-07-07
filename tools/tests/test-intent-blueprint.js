// Phase 2 (Intent Blueprint) tests: buildIntent() is the single source of
// truth for stimulus/target-pattern/constraints -- proves determinism (same
// request always yields a deep-equal Intent object) and behaviour-preservation
// (the values match what the old inline selGoal/allowPats derivation produced).
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /function clampInt\(/.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={buildIntent,generateSession,generateProgram,normalizeAthlete,rolePatterns,PURPOSE_SLOT_ROLES};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const { buildIntent, generateSession, generateProgram, normalizeAthlete, rolePatterns, PURPOSE_SLOT_ROLES } = m.exports;
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

// ================= purposeSlots (Phase 2 amendment) =================
const ALLOWED_SLOT_KEYS = ['role', 'reason', 'required', 'selectionStatus', 'target', 'pattern', 'stimulus', 'demand', 'constraints'];
const FORBIDDEN_KEYS = ['exerciseId', 'exerciseName', 'sets', 'reps', 'load', 'progression', 'variation'];

// ---------- returns purposeSlots; every slot is well-formed; no exercise selection ----------
{
  const i = buildIntent({ goal: 'strength', role: 'upper', minutes: 60, includes: ['conditioning'] });
  ok(Array.isArray(i.purposeSlots) && i.purposeSlots.length > 0, 'buildIntent() returns a non-empty purposeSlots array');
  i.purposeSlots.forEach(s => {
    ok(PURPOSE_SLOT_ROLES.indexOf(s.role) >= 0, `slot role "${s.role}" is one of the allowed PURPOSE_SLOT_ROLES`);
    ok(typeof s.reason === 'string' && s.reason.length > 0, `slot "${s.role}" has a non-empty reason`);
    ok(typeof s.required === 'boolean', `slot "${s.role}" has a boolean required flag`);
    ok(s.selectionStatus === 'unfilled', `slot "${s.role}" has selectionStatus "unfilled"`);
    Object.keys(s).forEach(k => ok(ALLOWED_SLOT_KEYS.indexOf(k) >= 0, `slot "${s.role}" key "${k}" is an allowed key (no leaked exercise-selection field)`));
    FORBIDDEN_KEYS.forEach(k => ok(!(k in s), `slot "${s.role}" does NOT contain forbidden key "${k}" (no exercise chosen inside buildIntent)`));
  });
  ok(JSON.stringify(i.purposeSlots).indexOf('exerciseId') === -1 && JSON.stringify(i.purposeSlots).indexOf('exerciseName') === -1, 'no exerciseId/exerciseName anywhere in the serialized purposeSlots');
}

// ---------- determinism: identical requests always produce deep-equal purposeSlots ----------
{
  const req = { goal: 'strength', role: 'upper', minutes: 45, includes: ['conditioning'] };
  const a = buildIntent(req).purposeSlots, b = buildIntent(req).purposeSlots;
  ok(JSON.stringify(a) === JSON.stringify(b), 'purposeSlots are deterministic for identical requests');
}

// ---------- slot order is fixed (canonical order, filtered) ----------
{
  const roles = buildIntent({ goal: 'strength', role: 'upper', minutes: 90, includes: ['conditioning'], patterns: ['power'] }).purposeSlots.map(s => s.role);
  const canonical = ['prep', 'power_skill', 'anchor', 'secondary_compound', 'accessory_balance', 'accessory_weak_point', 'isolation', 'finisher', 'cooldown'];
  ok(JSON.stringify(roles) === JSON.stringify(canonical), `a long, fully-loaded session has ALL slots in the exact canonical order (got ${JSON.stringify(roles)})`);
}

// ---------- required slots always present (normal mode: prep/anchor/cooldown) ----------
{
  const roles = buildIntent({ goal: 'general', minutes: 15 }).purposeSlots;
  const req = roles.filter(s => s.required).map(s => s.role);
  ok(JSON.stringify(req) === JSON.stringify(['prep', 'anchor', 'cooldown']), `even the shortest session keeps exactly the 3 required slots (got ${JSON.stringify(req)})`);
}

// ---------- optional slots appear only when appropriate; short sessions reduce them ----------
{
  const short = buildIntent({ goal: 'general', minutes: 20 }).purposeSlots.map(s => s.role);
  ok(JSON.stringify(short) === JSON.stringify(['prep', 'anchor', 'cooldown']), `a 20-min session has NO optional slots (got ${JSON.stringify(short)})`);

  const mid30 = buildIntent({ goal: 'general', minutes: 30 }).purposeSlots.map(s => s.role);
  ok(mid30.indexOf('secondary_compound') >= 0, '30-min session adds secondary_compound');
  ok(mid30.indexOf('accessory_balance') === -1, '30-min session does NOT yet add accessory_balance (needs 45+)');

  const mid45 = buildIntent({ goal: 'general', minutes: 45 }).purposeSlots.map(s => s.role);
  ok(mid45.indexOf('accessory_balance') >= 0 && mid45.indexOf('isolation') >= 0, '45-min session adds accessory_balance + isolation');
  ok(mid45.indexOf('accessory_weak_point') === -1, '45-min session does NOT yet add accessory_weak_point (needs 60+)');

  const long60 = buildIntent({ goal: 'general', minutes: 60 }).purposeSlots.map(s => s.role);
  ok(long60.indexOf('accessory_weak_point') >= 0, '60-min session adds accessory_weak_point');

  // Longer sessions strictly ADD to shorter ones -- never fewer optional slots as time grows.
  ok(short.length < mid30.length && mid30.length < mid45.length && mid45.length <= long60.length, 'optional slot count is monotonically non-decreasing as minutes increase');
}

// ---------- finisher only when conditioning was actually requested ----------
{
  const withCon = buildIntent({ goal: 'general', minutes: 60, includes: ['conditioning'] }).purposeSlots.map(s => s.role);
  const withoutCon = buildIntent({ goal: 'general', minutes: 60, includes: [] }).purposeSlots.map(s => s.role);
  ok(withCon.indexOf('finisher') >= 0, 'conditioning requested -> finisher slot present');
  ok(withoutCon.indexOf('finisher') === -1, 'conditioning NOT requested -> no finisher slot, even at 60 minutes');
}

// ---------- power_skill only when requested AND there is time ----------
{
  const withPower = buildIntent({ goal: 'general', minutes: 45, patterns: ['power'] }).purposeSlots.map(s => s.role);
  const shortPower = buildIntent({ goal: 'general', minutes: 20, patterns: ['power'] }).purposeSlots.map(s => s.role);
  const noPower = buildIntent({ goal: 'general', minutes: 45 }).purposeSlots.map(s => s.role);
  ok(withPower.indexOf('power_skill') >= 0, 'power requested + enough time -> power_skill slot present');
  ok(shortPower.indexOf('power_skill') === -1, 'power requested but too short (20 min) -> no power_skill slot');
  ok(noPower.indexOf('power_skill') === -1, 'power not requested -> no power_skill slot');
}

// ---------- readiness tunes emphasis/presence WITHOUT silently overriding the theme ----------
{
  const normal = buildIntent({ goal: 'strength', role: 'upper', minutes: 60, includes: ['conditioning'] }).purposeSlots;
  const eased = buildIntent({ goal: 'strength', role: 'upper', minutes: 60, includes: ['conditioning'], readiness: 'eased' }).purposeSlots;
  const anchorNormal = normal.find(s => s.role === 'anchor'), anchorEased = eased.find(s => s.role === 'anchor');
  ok(anchorNormal.demand === 'normal', 'normal readiness -> anchor demand is "normal"');
  ok(anchorEased.demand === 'reduced', 'eased readiness -> anchor demand is "reduced" (emphasis tuned)');
  ok(anchorEased.target === anchorNormal.target && anchorEased.stimulus === anchorNormal.stimulus, 'eased readiness does NOT change the anchor\'s target/stimulus -- the requested theme is preserved');
  ok(eased.map(s => s.role).indexOf('finisher') === -1, 'eased readiness drops the finisher slot (reduces optional load)');
  ok(eased.map(s => s.role).indexOf('accessory_weak_point') === -1, 'eased readiness drops the accessory_weak_point slot');
  ok(eased.some(s => s.role === 'anchor'), 'eased readiness still keeps a real anchor -- it tunes, it does not replace the session with recovery');

  const rough = buildIntent({ goal: 'strength', role: 'upper', minutes: 60, includes: ['conditioning'], readiness: 'rough' }).purposeSlots;
  const roughRoles = rough.map(s => s.role);
  ok(JSON.stringify(roughRoles) === JSON.stringify(['prep', 'recovery', 'cooldown']), `rough readiness collapses to the recovery-shaped slot list (got ${JSON.stringify(roughRoles)}) -- mirrors the EXISTING readiness->recovery path, not a new override`);
  ok(rough.filter(s => s.required).length === 3, 'in recovery mode, all 3 slots (prep/recovery/cooldown) are required');
}

// ---------- injuries/experience pass through as constraints only (never interpreted here) ----------
{
  const athlete = normalizeAthlete({ experience: 'advanced', injuries: [{ category: 'pain', target: 'Overhead Press' }] });
  const i = buildIntent({ goal: 'strength', role: 'upper', minutes: 60 }, athlete);
  const anchor = i.purposeSlots.find(s => s.role === 'anchor');
  ok(anchor.constraints && Array.isArray(anchor.constraints.injuries) && anchor.constraints.injuries[0].target === 'Overhead Press', 'a functional slot carries the athlete\'s injuries as a passthrough constraint');
  ok(JSON.stringify(i.purposeSlots).indexOf('"experience"') === -1, 'experience level is NOT embedded per-slot (it stays a top-level constraint only) -- buildIntent does not interpret it into prescription');
  const prep = i.purposeSlots.find(s => s.role === 'prep'), cooldown = i.purposeSlots.find(s => s.role === 'cooldown');
  ok(!prep.constraints && !cooldown.constraints, 'prep/cooldown (handled by the existing warmup/cooldown builder) carry no redundant constraints object');
}

// ---------- generateSession/generateProgram consume Intent; adding purposeSlots changes nothing ----------
{
  const before = generateSession({ role: 'upper', minutes: 45, goal: 'hybrid', includes: ['mobility', 'conditioning'], equipment: null }, {}, 7, {}, null, false, null);
  ok(!('purposeSlots' in before), 'the generated SESSION object itself never leaks a purposeSlots field (it is intent-internal, not session output)');
  const p = generateProgram({ goal: 'hybrid', days: 3, minutes: 45, weeks: 1, includes: ['mobility', 'conditioning'], equipment: null }, {}, 7, {}, {});
  ok(p.weeks[0].sessions.every(s => !('purposeSlots' in s)), 'no session in a generated program leaks purposeSlots either');
}

console.log(pass + ' passed, ' + fail + ' failed');
if (fail) fails.slice(0, 30).forEach(f => console.log('  - ' + f));
process.exit(fail ? 1 : 0);
