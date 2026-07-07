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

// ================= purposeSlots (Phase 2 amendment v2 -- priority-driven) =================
const ALLOWED_SLOT_KEYS = ['role', 'priority', 'reason', 'required', 'selectionStatus', 'target', 'pattern', 'stimulus', 'demand', 'status', 'constraints'];
const FORBIDDEN_KEYS = ['exerciseId', 'exerciseName', 'sets', 'reps', 'load', 'progression', 'variation'];
const VALID_PRIORITIES = ['required', 'critical', 'high', 'medium', 'low', 'optional'];

// ---------- returns purposeSlots; every slot is well-formed, has a valid priority; no exercise selection ----------
{
  const i = buildIntent({ goal: 'strength', role: 'upper', minutes: 60, includes: ['conditioning'] });
  ok(Array.isArray(i.purposeSlots) && i.purposeSlots.length > 0, 'buildIntent() returns a non-empty purposeSlots array');
  i.purposeSlots.forEach(s => {
    ok(PURPOSE_SLOT_ROLES.indexOf(s.role) >= 0, `slot role "${s.role}" is one of the allowed PURPOSE_SLOT_ROLES`);
    ok(VALID_PRIORITIES.indexOf(s.priority) >= 0, `slot "${s.role}" has a valid priority ("${s.priority}")`);
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

// ---------- slot order is fixed (canonical sequencing order), regardless of priority ----------
{
  const roles = buildIntent({ goal: 'strength', role: 'upper', minutes: 90, includes: ['conditioning'], patterns: ['power'] }).purposeSlots.map(s => s.role);
  const canonical = ['prep', 'power_skill', 'anchor', 'secondary_compound', 'accessory_balance', 'accessory_weak_point', 'isolation', 'finisher', 'cooldown'];
  ok(JSON.stringify(roles) === JSON.stringify(canonical), `a long, fully-loaded (90min) session has ALL slots in the exact canonical SEQUENCING order, not priority order (got ${JSON.stringify(roles)})`);
}

// ---------- required slots (priority "required"/"critical") always present, never budget-limited ----------
{
  const roles = buildIntent({ goal: 'general', minutes: 15 }).purposeSlots;
  const req = roles.filter(s => s.required).map(s => s.role);
  ok(JSON.stringify(req) === JSON.stringify(['prep', 'anchor', 'cooldown']), `even the shortest (15min) session keeps exactly the 3 required slots -- required status is NEVER dropped by the budget (got ${JSON.stringify(req)})`);
  ok(roles.find(s => s.role === 'prep').priority === 'required', 'prep priority is "required"');
  ok(roles.find(s => s.role === 'anchor').priority === 'critical', 'anchor priority is "critical" (ranks above every optional slot, though structurally required regardless)');
  ok(roles.find(s => s.role === 'cooldown').priority === 'required', 'cooldown priority is "required"');
}

// ---------- PRIORITY (not duration) governs which optional slots fit the coaching budget ----------
// Real, discovered outputs of the priority/budget algorithm (spent on required
// slots: prep 5 + anchor 12 + cooldown 5 = 22 "coaching minutes"; optional
// slots then compete for what's left, highest priority first).
{
  const at15 = buildIntent({ goal: 'general', minutes: 15 }).purposeSlots.map(s => s.role);
  ok(JSON.stringify(at15) === JSON.stringify(['prep', 'anchor', 'cooldown']), `15min: budget is negative/zero once required slots are costed -- no optional slots fit (got ${JSON.stringify(at15)})`);

  const at20 = buildIntent({ goal: 'general', minutes: 20 }).purposeSlots.map(s => s.role);
  ok(JSON.stringify(at20) === JSON.stringify(['prep', 'anchor', 'cooldown']), `20min: still no budget left for any optional slot (got ${JSON.stringify(at20)})`);

  const at30 = buildIntent({ goal: 'general', minutes: 30 }).purposeSlots.map(s => s.role);
  ok(at30.indexOf('secondary_compound') >= 0, '30min: budget (8) exactly covers the highest-priority optional slot, secondary_compound (cost 8)');
  ok(at30.length === 4, `30min: exactly ONE optional slot fits (got ${JSON.stringify(at30)})`);

  // 29min proves the algorithm tries EVERY candidate in priority order rather
  // than stopping at the first one that doesn't fit: secondary_compound
  // (high, cost 8) does NOT fit a budget of 7, but accessory_balance
  // (medium, cost 6) DOES -- so the lower-priority slot still gets a chance.
  const at29 = buildIntent({ goal: 'general', minutes: 29 }).purposeSlots.map(s => s.role);
  ok(at29.indexOf('secondary_compound') === -1, '29min: the highest-priority optional slot (secondary_compound, cost 8) does NOT fit a budget of 7');
  ok(at29.indexOf('accessory_balance') >= 0, '29min: a LOWER-priority slot that costs less (accessory_balance, cost 6) DOES fit -- proves the algorithm keeps trying after a miss, it does not just stop');

  const at45 = buildIntent({ goal: 'general', minutes: 45 }).purposeSlots.map(s => s.role);
  ok(at45.indexOf('secondary_compound') >= 0 && at45.indexOf('accessory_balance') >= 0 && at45.indexOf('accessory_weak_point') >= 0, `45min: budget (23) fits secondary_compound + accessory_balance + accessory_weak_point (got ${JSON.stringify(at45)})`);
  ok(at45.indexOf('isolation') === -1, '45min: isolation (cost 5) does NOT fit the remaining budget of 3 after the three higher-costed slots are seated');

  const at60 = buildIntent({ goal: 'general', minutes: 60 }).purposeSlots.map(s => s.role);
  ok(at60.indexOf('isolation') >= 0, '60min: the larger budget now covers isolation too');

  // Longer sessions strictly ADD to shorter ones for this fixed request shape --
  // never fewer optional slots as the coaching budget grows.
  ok(at15.length <= at20.length && at20.length <= at29.length && at29.length <= at30.length && at30.length <= at45.length && at45.length <= at60.length, 'optional slot count is monotonically non-decreasing as minutes increase');
}

// ---------- finisher depends on REQUEST + READINESS only -- never on duration ----------
{
  const withCon15 = buildIntent({ goal: 'general', minutes: 15, includes: ['conditioning'] }).purposeSlots.map(s => s.role);
  const withCon60 = buildIntent({ goal: 'general', minutes: 60, includes: ['conditioning'] }).purposeSlots.map(s => s.role);
  const withoutCon60 = buildIntent({ goal: 'general', minutes: 60, includes: [] }).purposeSlots.map(s => s.role);
  ok(withCon15.indexOf('finisher') >= 0, 'conditioning requested -> finisher slot present even at the shortest duration (15min) -- duration plays no part in this decision');
  ok(withCon60.indexOf('finisher') >= 0, 'conditioning requested -> finisher slot present at 60min too');
  ok(withoutCon60.indexOf('finisher') === -1, 'conditioning NOT requested -> no finisher slot, even at 60 minutes');
  const f = buildIntent({ goal: 'general', minutes: 60, includes: ['conditioning'] }).purposeSlots.find(s => s.role === 'finisher');
  ok(f.priority === 'optional', 'finisher priority is "optional" (lowest tier)');
}

// ---------- power_skill: requires the request signal; NOT itself duration-gated ----------
{
  const withPower15 = buildIntent({ goal: 'general', minutes: 15, patterns: ['power'] }).purposeSlots.map(s => s.role);
  const withPower45 = buildIntent({ goal: 'general', minutes: 45, patterns: ['power'] }).purposeSlots.map(s => s.role);
  const noPower45 = buildIntent({ goal: 'general', minutes: 45 }).purposeSlots.map(s => s.role);
  ok(withPower45.indexOf('power_skill') >= 0, 'power requested + budget available -> power_skill slot present');
  ok(withPower15.indexOf('power_skill') === -1, 'power requested but the required-slot floor alone exceeds a 15min budget -- power_skill loses the SAME budget competition every other optional slot loses, not a hardcoded duration rule');
  ok(noPower45.indexOf('power_skill') === -1, 'power not requested -> power_skill is not even a candidate');
}

// ---------- readiness tunes emphasis/budget WITHOUT silently overriding the theme ----------
{
  const normal = buildIntent({ goal: 'strength', role: 'upper', minutes: 45, includes: ['conditioning'] }).purposeSlots;
  const eased = buildIntent({ goal: 'strength', role: 'upper', minutes: 45, includes: ['conditioning'], readiness: 'eased' }).purposeSlots;
  const anchorNormal = normal.find(s => s.role === 'anchor'), anchorEased = eased.find(s => s.role === 'anchor');
  ok(anchorNormal.demand === 'normal', 'normal readiness -> anchor demand is "normal"');
  ok(anchorEased.demand === 'reduced', 'eased readiness -> anchor demand is "reduced" (emphasis tuned)');
  ok(anchorEased.target === anchorNormal.target && anchorEased.stimulus === anchorNormal.stimulus, 'eased readiness does NOT change the anchor\'s target/stimulus -- the requested theme is preserved');
  ok(eased.map(s => s.role).indexOf('finisher') === -1, 'eased readiness excludes the finisher (request+readiness gate -- conditioning was requested but readiness says not today)');
  ok(eased.length < normal.length, 'eased readiness has FEWER slots than normal readiness for the identical request -- modelled as a genuinely reduced coaching budget (recoverable capacity), not a hardcoded per-slot cut list');
  ok(eased.some(s => s.role === 'anchor'), 'eased readiness still keeps a real anchor -- it tunes the session, it does not replace it with recovery');

  const rough = buildIntent({ goal: 'strength', role: 'upper', minutes: 60, includes: ['conditioning'], readiness: 'rough' }).purposeSlots;
  const roughRoles = rough.map(s => s.role);
  ok(JSON.stringify(roughRoles) === JSON.stringify(['prep', 'recovery', 'cooldown']), `rough readiness collapses to the recovery-shaped slot list (got ${JSON.stringify(roughRoles)}) -- mirrors the EXISTING readiness->recovery path, not a new override`);
  ok(rough.filter(s => s.required).length === 3, 'in recovery mode, all 3 slots (prep/recovery/cooldown) are required');
  ok(rough.find(s => s.role === 'recovery').priority === 'required', 'the recovery slot itself carries priority "required"');
}

// ---------- accessory_weak_point is honestly marked dormant -- never fakes real coaching intelligence ----------
{
  const s = buildIntent({ goal: 'general', minutes: 60 }).purposeSlots.find(x => x.role === 'accessory_weak_point');
  ok(s !== undefined, 'accessory_weak_point slot exists at 60min (enough budget)');
  ok(s.status === 'dormant', 'accessory_weak_point is explicitly marked status:"dormant" -- honest about not yet having real weak-point detection');
  ok(/dormant|awaiting|not yet/i.test(s.reason), 'its reason string plainly says this is not yet real, rather than pretending the engine knows a weak point it does not');
  ok(s.priority === 'medium', 'accessory_weak_point still carries a real priority (medium) for when detection lands -- dormant status does not mean deprioritised, just not yet implemented');
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
