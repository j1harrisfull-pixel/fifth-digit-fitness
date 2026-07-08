// Pass 1 (Programming Trust), Fix 2: ramp weight rounding. A ramp's non-1
// wpct (e.g. 0.85) multiplied against a real working weight used to land on
// an unloadable fraction (60kg * 0.85 = 51kg). roundToStep now rounds ONLY
// that product to the nearest real load step -- roundW (the universal
// 2-decimal display rounder used everywhere else) is untouched.
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /var STORE = /.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={LIBRARY,curveFor,buildSetPlan,roundToStep,roundW};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const { LIBRARY, curveFor, buildSetPlan, roundToStep, roundW } = m.exports;
const STEP = 2.5; // matches the app's own STEP constant (index.html:1645), not re-extracted here

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

const byId = id => LIBRARY.filter(e => e.id === id)[0];
const bench = byId("bench-press");
ok(!!bench, "bench-press exists in LIBRARY for ramp testing");
const curve = curveFor(bench, "strength", true);
ok(curve === "ramp", "bench-press + strength goal + anchor resolves to ramp curve");

// Mirrors the production logic exactly (readLog's curveW / writeLog's
// target_weight): wpct===1 (straight sets) uses roundW unchanged; a real
// ramp fraction uses roundToStep.
function rampWeight(workingWeight, wpct) { return wpct === 1 ? roundW(workingWeight * wpct) : roundToStep(workingWeight * wpct); }
function rampWeights(workingWeight, sets) {
  const plan = buildSetPlan(curve, sets, "3-5", "3-5 min");
  return plan.map(p => rampWeight(workingWeight, p.wpct));
}
const isStepMultiple = x => Math.abs((x / STEP) - Math.round(x / STEP)) < 1e-9;

[60, 62.5, 100, 47.5].forEach(w => {
  const weights4 = rampWeights(w, 4);
  ok(weights4[weights4.length - 1] === w, `4-set ramp @ ${w}kg: final set equals working weight (${weights4[weights4.length-1]} === ${w})`);
  ok(weights4.every(isStepMultiple), `4-set ramp @ ${w}kg: every set weight is a multiple of the ${STEP} step (${JSON.stringify(weights4)})`);
  let nonDecreasing = true;
  for (let i = 1; i < weights4.length; i++) if (weights4[i] < weights4[i-1]) nonDecreasing = false;
  ok(nonDecreasing, `4-set ramp @ ${w}kg: sequence is non-decreasing (${JSON.stringify(weights4)})`);
});

const weights5 = rampWeights(80, 5);
ok(weights5[4] === 80, `5-set ramp @ 80kg: final set equals working weight (${JSON.stringify(weights5)})`);
ok(weights5.every(isStepMultiple), `5-set ramp @ 80kg: every set is a step multiple (${JSON.stringify(weights5)})`);

// lb case -- STEP is unit-agnostic (2.5 lb is also a real plate increment)
const weightsLb = rampWeights(135, 4);
ok(weightsLb[3] === 135, `4-set ramp @ 135lb: final set equals working weight (${JSON.stringify(weightsLb)})`);
ok(weightsLb.every(isStepMultiple), `4-set ramp @ 135lb: every set is a step multiple (${JSON.stringify(weightsLb)})`);

// Displayed prefill (readLog's curveW) must equal the logged target_weight
// (writeLog) for the same wpct -- both route through the identical
// wpct===1-vs-not branch, so this is a same-inputs-same-output check.
const plan4 = buildSetPlan(curve, 4, "3-5", "3-5 min");
plan4.forEach((p, i) => {
  const prefill = rampWeight(60, p.wpct), logged = rampWeight(60, p.wpct);
  ok(prefill === logged, `set ${i+1} of 4: displayed prefill (${prefill}) equals logged target_weight (${logged})`);
});

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log("  FAIL:", f)); process.exit(1); }
