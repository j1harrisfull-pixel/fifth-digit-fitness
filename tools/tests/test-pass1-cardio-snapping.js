// Pass 1 (Programming Trust), Fix 1: cardio duration snapping. Zone 2
// conditioning previously produced odd-feeling durations (e.g. a 45-min
// session -> "16 min"); now snapped to 5-min coaching blocks. Threshold and
// interval schemes were already clean and must stay byte-identical.
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /var STORE = /.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={prescription};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const { prescription } = m.exports;

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

const z2ex = { type: "conditioning", intensity: "z2" };
[15, 20, 25, 30, 35, 40, 45, 50, 55, 60, 65, 70, 90, 120].forEach(mins => {
  const p = prescription(z2ex, "hybrid", false, mins, 1, false);
  const z = parseInt(p.reps, 10);
  ok(z % 5 === 0, `z2 @ ${mins}min: output "${p.reps}" is a multiple of 5`);
  ok(z >= 10 && z <= 40, `z2 @ ${mins}min: output ${z} stays within the 10-40 clamp`);
});
const p45 = prescription(z2ex, "hybrid", false, 45, 1, false);
ok(p45.reps === "15 min", `z2 @ 45min is exactly "15 min" (was the reported "16 min" bug), got "${p45.reps}"`);

const thEx = { type: "conditioning", intensity: "threshold" };
const pTh30 = prescription(thEx, "hybrid", false, 30, 1, false);
const pTh45 = prescription(thEx, "hybrid", false, 45, 1, false);
ok(pTh30.sets === 2 && pTh30.reps === "8 min", "threshold @ 30min unchanged (2x8min)");
ok(pTh45.sets === 3 && pTh45.reps === "8 min", "threshold @ 45min unchanged (3x8min)");

const intEx = { type: "conditioning", intensity: "interval" };
const pInt30 = prescription(intEx, "hybrid", false, 30, 1, false);
const pInt45 = prescription(intEx, "hybrid", false, 45, 1, false);
ok(pInt30.sets === 3 && pInt30.reps === "3 min", "interval @ 30min unchanged (3x3min)");
ok(pInt45.sets === 4 && pInt45.reps === "4 min", "interval @ 45min unchanged (4x4min)");

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log("  FAIL:", f)); process.exit(1); }
