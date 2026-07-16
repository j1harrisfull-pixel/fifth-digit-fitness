// Comprehensive stress test: content coverage + a wide generation sweep asserting
// every invariant, plus edge cases. No crashes, no hollow/off-family/bogus/dupe.
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /function clampInt\(/.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.indexOf('/*__COACH_START__*/') >= 0);
const ce = lines.findIndex(l => l.indexOf('/*__COACH_END__*/') >= 0);
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports = { LIBRARY, ROLES, RAMP_ANCHORS, generateProgram, generateSession, libraryIntegrity, makeRequest, requestToParsed };';
const mod = { exports: {} };
new Function('module', 'exports', src)(mod, mod.exports);
const { LIBRARY, ROLES, RAMP_ANCHORS, generateProgram, generateSession, libraryIntegrity } = mod.exports;
const byName = {}; LIBRARY.forEach(e => byName[e.name.toLowerCase()] = e);
const libOf = n => byName[String(n).toLowerCase()];
let pass = 0, fail = 0; const fails = [];
function ok(c, m) { if (c) pass++; else { fail++; fails.push(m); } }

// ---------- 1. Library integrity ----------
ok(libraryIntegrity(LIBRARY).ok, 'library integrity');
ok(LIBRARY.length >= 230, 'library size >= 230 (got ' + LIBRARY.length + ')');

// ---------- 2. Content coverage ----------
const S = LIBRARY.filter(e => e.type === 'strength');
['squat', 'hinge', 'lunge', 'hpush', 'vpush', 'hpull', 'vpull', 'biceps', 'triceps', 'calf', 'core', 'carry'].forEach(p => {
  ok(S.some(e => e.pattern === p), 'pattern covered: ' + p);
});
// every muscle region trained
['quads', 'hamstrings', 'glutes', 'calves', 'chest', 'back', 'shoulders', 'biceps', 'triceps', 'forearms', 'core'].forEach(mu => {
  ok(S.some(e => (e.primary_muscles || []).indexOf(mu) >= 0 || (e.muscles || []).indexOf(mu) >= 0), 'muscle covered: ' + mu);
});
// bodyweight now has a real pull (the fixed gap)
ok(S.some(e => e.equipment === 'bodyweight' && (e.pattern === 'hpull' || e.pattern === 'vpull')), 'bodyweight has a pull');
// dumbbell triceps (was a gap)
ok(S.some(e => e.equipment === 'dumbbell' && e.pattern === 'triceps'), 'dumbbell triceps exists');
// hamstring knee-flexion (nordic)
ok(S.some(e => e.name === 'Nordic Hamstring Curl'), 'nordic hamstring curl exists');
// rehab presence
['Spanish Squat', 'Terminal Knee Extension', 'Clamshell', 'Eccentric Heel Drop'].forEach(n => ok(!!libOf(n), 'rehab move exists: ' + n));
// direct trap work
ok(S.some(e => e.name === 'Barbell Shrug'), 'trap work exists');

// ---------- 3. Wide generation sweep ----------
function roleFamily(role) { const u = {}; (ROLES[role] || []).forEach(s => (s.patterns || []).forEach(p => u[p] = 1)); return u; }
// 16 July 2026: full includes "lunge" -- ROLES.full's own lead slot is
// ["squat","lunge"], so a lunge-led Full Body day is on-role by the engine's
// real definition (the old name-regex fallback was silently doing this job
// for the two lunge names that existed before the library-depth batch).
const PRIM = { push: ["hpush","vpush","triceps"], upper: ["hpush","vpush","hpull","vpull"], pull: ["hpull","vpull","biceps"], lower: ["squat","hinge","lunge"], legs: ["squat","hinge","lunge"], full: ["squat","hinge","lunge","hpush","hpull"] };
const kits = [null, ["barbell","bodyweight"], ["dumbbell","bodyweight"], ["bodyweight"], ["kettlebell","bodyweight"], ["barbell","dumbbell","cable","machine","pullup-bar","bodyweight"], ["band","bodyweight"], ["dumbbell","pullup-bar","bodyweight"]];
const goals = ["strength", "hybrid", "hypertrophy", "general"];
let sessions = 0, crashes = 0, emptySessions = 0, badReps = 0, offFam = 0, bad35 = 0, hollow = 0, dupes = 0, badSets = 0;
for (const kit of kits) for (const goal of goals) for (let days = 1; days <= 7; days++) for (const min of [15, 30, 45, 60, 90]) for (let seed = 1; seed <= 4; seed++) {
  let prog;
  try { prog = generateProgram({ goal, days, minutes: min, weeks: (days >= 4 ? 4 : 1), includes: ["mobility", "conditioning"], equipment: kit }, {}, seed, {}); }
  catch (e) { crashes++; if (crashes <= 3) fails.push('CRASH ' + JSON.stringify({goal,days,min,seed,kit}) + ': ' + e.message); continue; }
  if (!prog || !Array.isArray(prog.weeks) || !prog.weeks.length) { crashes++; continue; }
  prog.weeks.forEach(wk => (wk.sessions || []).forEach(ses => {
    sessions++;
    if (!ses.exercises || !ses.exercises.length) { emptySessions++; return; }
    const strength = ses.exercises.filter(e => e.type === 'strength');
    const role = ["push","pull","legs","upper","lower","full"].find(r => (ses.name || '').toLowerCase().startsWith(r)) || null;
    // every exercise well-formed
    ses.exercises.forEach(e => {
      if (!e.name || e.sets == null || e.reps == null) badReps++;
      if (typeof e.sets !== 'number' || e.sets < 1 || e.sets > 8) badSets++;
    });
    if (role && strength.length) { const lead = libOf(strength[0].name); if (lead && !roleFamily(role)[lead.pattern]) offFam++; }
    strength.forEach(e => { if (String(e.reps).trim() === '3-5') { const l = libOf(e.name); if (!l || !RAMP_ANCHORS[l.id]) bad35++; } });
    if (role && PRIM[role]) { const hit = strength.some(e => { const l = libOf(e.name); return (l && PRIM[role].indexOf(l.pattern) >= 0) || /Bodyweight Squat|Push-Up|Table Row|Reverse Lunge|Glute Bridge/.test(e.name); }); if (!hit) hollow++; }
    const seen = {}; ses.exercises.forEach(e => { if (seen[e.name]) dupes++; seen[e.name] = 1; });
  }));
}
ok(crashes === 0, crashes + ' generation crashes');
ok(emptySessions === 0, emptySessions + ' empty sessions');
ok(badReps === 0, badReps + ' exercises with null name/sets/reps');
ok(badSets === 0, badSets + ' exercises with out-of-range set counts');
ok(offFam === 0, offFam + ' off-family anchors');
ok(bad35 === 0, bad35 + ' bogus 3-5 prescriptions');
ok(hollow === 0, hollow + ' hollow role days');
ok(dupes === 0, dupes + ' duplicate exercises in a session');

// ---------- 4. Edge cases ----------
try { generateProgram({ goal: 'strength', days: 1, minutes: 15, weeks: 1, includes: [], equipment: [] }, {}, 1, {}); ok(true, 'edge: 1-day 15-min empty-equip no crash'); } catch (e) { ok(false, 'edge 1-day crash: ' + e.message); }
try { generateProgram({ goal: 'endurance', days: 7, minutes: 120, weeks: 8, includes: ['conditioning','mobility'], equipment: null }, {}, 1, {}); ok(true, 'edge: 7-day 8-week endurance no crash'); } catch (e) { ok(false, 'edge endurance crash: ' + e.message); }
try { const p = generateProgram({ goal: 'hybrid', days: 3, minutes: 45, weeks: 4, includes: ['conditioning'], equipment: ['bodyweight'] }, {}, 1, {}); ok(p.weeks[3].deload === true, 'edge: week 4 is deload'); } catch (e) { ok(false, 'edge deload crash: ' + e.message); }

console.log('checked ' + sessions + ' sessions in the sweep');
console.log(pass + ' passed, ' + fail + ' failed');
if (fail) { console.log('FAILURES:'); fails.slice(0, 30).forEach(f => console.log('  - ' + f)); }
process.exit(fail ? 1 : 0);
