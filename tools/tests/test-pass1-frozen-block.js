// Pass 1 (Programming Trust), Fix 4: defensive regression test. Stage-1
// inspection confirmed generateProgram's 4-week strength block intentionally
// freezes its main strength selection (blueprint.picks) for the whole block
// -- the SAME anchor+accessory lineup returns every week so logged load can
// climb, while RIR wave / anchor exposure / accessory suggestedWeight still
// progress underneath an unchanged exercise list. This is deliberate block
// periodisation, NOT accidental repetition, and Pass 1 does not rotate it.
// This test exists purely to catch a FUTURE "variety fix" that would
// accidentally break that progression model.
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /var STORE = /.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={LIBRARY,generateProgram};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const { LIBRARY, generateProgram } = m.exports;

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

const athlete = { experience: "intermediate", injuries: [] };
const FULL_GYM = ["barbell", "dumbbells", "kettlebells", "cable", "machines", "bands", "pullupbar", "cardio"];

// The optional per-week "functional finisher" (carries / anti-rotation core
// work, e.g. Bird Dog <-> Pallof Press) is drawn fresh each week BY DESIGN
// (pickFunctional, called inside the per-week loop with that week's own ctx
// -- not part of the frozen blueprint), so it's excluded from this check.
// Everything else in the strength list comes from the once-per-block
// blueprint.picks and must stay identical across all 4 weeks.
const isFunctionalFinisher = name => {
  const lib = LIBRARY.filter(l => l.name === name)[0];
  return !!lib && (lib.pattern === "carry" || lib.movement_pattern === "anti_rotation" || lib.pattern === "rotation");
};
function frozenStrengthByWeek(prog, day) {
  return prog.weeks.map(wk => {
    const ses = wk.sessions[day];
    return ses.exercises
      .filter(e => LIBRARY.some(l => l.name === e.name && l.type === "strength") && !isFunctionalFinisher(e.name))
      .map(e => e.name).sort().join("|");
  });
}

{
  const intake = { goal: "strength", days: 4, minutes: 45, weeks: 4, equipment: FULL_GYM, includes: [] };
  const prog = generateProgram(intake, {}, 1, {}, null, athlete, null, null, null);
  ok(prog.weeks.length === 4, "4-week strength build produces 4 weeks");

  for (let day = 0; day < prog.weeks[0].sessions.length; day++) {
    const namesByWeek = frozenStrengthByWeek(prog, day);
    ok(namesByWeek.every(n => n === namesByWeek[0]), `4-week strength block, day ${day + 1}: blueprint strength picks stay frozen across all 4 weeks (${JSON.stringify(namesByWeek)})`);
  }

  const focuses = prog.weeks.map(w => w.focus);
  ok(/3 reps in reserve/.test(focuses[0]), "week 1 focus reflects the accumulation/3-RIR phase");
  ok(/2 reps in reserve/.test(focuses[1]), "week 2 focus reflects the accumulation/2-RIR phase");
  ok(/1 rep in reserve/.test(focuses[2]), "week 3 focus reflects the intensification/1-RIR phase");
  ok(/Deload/.test(focuses[3]), "week 4 focus reflects the deload phase");
}

{
  // Hybrid 4-week: strength frozen, conditioning free to rotate (already-designed behaviour)
  const intakeHybrid = { goal: "hybrid", days: 4, minutes: 45, weeks: 4, equipment: FULL_GYM, includes: ["conditioning"] };
  const progH = generateProgram(intakeHybrid, {}, 1, {}, null, athlete, null, null, null);
  const namesByWeekH = frozenStrengthByWeek(progH, 0);
  ok(namesByWeekH.every(n => n === namesByWeekH[0]), `4-week hybrid block: blueprint strength picks also stay frozen across weeks (${JSON.stringify(namesByWeekH)})`);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log("  FAIL:", f)); process.exit(1); }
