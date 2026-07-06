// Coach hardening regression tests: anchor-in-family, 3-5 gate, no hollow days.
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /function clampInt\(/.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.indexOf('/*__COACH_START__*/') >= 0);
const ce = lines.findIndex(l => l.indexOf('/*__COACH_END__*/') >= 0);
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports = { LIBRARY, ROLES, RAMP_ANCHORS, generateProgram };';
const mod = { exports: {} };
new Function('module', 'exports', src)(mod, mod.exports);
const { LIBRARY, ROLES, RAMP_ANCHORS, generateProgram } = mod.exports;
const byName = {}; LIBRARY.forEach(e => byName[e.name.toLowerCase()] = e);
const libOf = n => byName[String(n).toLowerCase()];

let pass = 0, fail = 0;
function ok(c, m) { if (c) pass++; else { fail++; console.error('FAIL: ' + m); } }

// role family = union of that role's slot patterns (mirrors selectComplementary)
function roleFamily(role) {
  const u = {}; (ROLES[role] || []).forEach(s => (s.patterns || []).forEach(p => u[p] = 1)); return u;
}
const PRIM = { push: ["hpush","vpush","triceps"], upper: ["hpush","vpush","hpull","vpull"], pull: ["hpull","vpull","biceps"], lower: ["squat","hinge","lunge"], legs: ["squat","hinge","lunge"], full: ["squat","hinge","hpush","hpull"] };

const kits = [
  { name: "full", equipment: null },
  { name: "barbell", equipment: ["barbell", "bodyweight"] },
  { name: "dumbbell", equipment: ["dumbbell", "bodyweight"] },
  { name: "bodyweight", equipment: ["bodyweight"] },
];
const goals = ["strength", "hybrid"];

let anchorOffFamily = 0, bad35 = 0, hollow = 0, dupeInSession = 0, checked = 0;
for (const kit of kits) for (const goal of goals) for (let days = 2; days <= 6; days++) for (let seed = 1; seed <= 6; seed++) {
  const prog = generateProgram({ goal, days, minutes: 60, weeks: 4, includes: ["mobility", "conditioning"], equipment: kit.equipment }, {}, seed, {});
  prog.weeks.forEach(wk => wk.sessions.forEach(ses => {
    checked++;
    const strength = ses.exercises.filter(e => e.type === "strength");
    const role = ["push","pull","legs","upper","lower","full"].find(r => (ses.name || "").toLowerCase().startsWith(r)) || null;
    // 1. anchor (first strength) is in the role family
    if (role && strength.length) {
      const lead = libOf(strength[0].name);
      const fam = roleFamily(role);
      if (lead && !fam[lead.pattern]) { anchorOffFamily++; if (anchorOffFamily <= 5) console.error('  off-family anchor: ' + strength[0].name + ' (' + (lead && lead.pattern) + ') on ' + ses.name + ' [' + kit.name + '/' + goal + ']'); }
    }
    // 2. no 3-5 reps unless a true ramp anchor
    strength.forEach(e => {
      if (String(e.reps).trim() === "3-5") {
        const lib = libOf(e.name);
        if (!lib || !RAMP_ANCHORS[lib.id]) { bad35++; if (bad35 <= 5) console.error('  bogus 3-5: ' + e.name + ' on ' + ses.name); }
      }
    });
    // 3. no hollow day: at least one role-primary strength move
    if (role && PRIM[role]) {
      const primHit = strength.some(e => { const l = libOf(e.name); return (l && PRIM[role].indexOf(l.pattern) >= 0) || /Bodyweight Squat|Push-Up|Reverse Lunge|Glute Bridge/.test(e.name); });
      if (!primHit) { hollow++; if (hollow <= 5) console.error('  hollow day: ' + ses.name + ' [' + kit.name + '/' + goal + '] -> ' + strength.map(e=>e.name).join(', ')); }
    }
    // 4. no duplicate exercise within a session
    const seen = {}; ses.exercises.forEach(e => { if (seen[e.name]) dupeInSession++; seen[e.name] = 1; });
  }));
}
ok(anchorOffFamily === 0, anchorOffFamily + " sessions anchored on an off-family lift");
ok(bad35 === 0, bad35 + " lifts prescribed 3-5 reps without being a true strength anchor");
ok(hollow === 0, hollow + " role days with no primary-pattern strength work (hollow)");
ok(dupeInSession === 0, dupeInSession + " sessions contain a duplicate exercise");
console.log('checked ' + checked + ' sessions across ' + kits.length + ' kits x ' + goals.length + ' goals');
console.log(pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
