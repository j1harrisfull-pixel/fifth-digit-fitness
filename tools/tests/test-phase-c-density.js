// Gold-Standard Phase C regression tests: density formats (EMOM strength
// pairing + AMRAP conditioning finisher) for 30-min sessions only. Covers:
// (1) a 30-min hybrid build with real pairable content converts both blocks
// to density mode; (2) 45/60-min sessions are UNCHANGED (no mode, straight
// sets, unaffected exercise counts) -- the plan explicitly says do not widen
// density formats beyond 30 min; (3) exactly 2 strength exercises tagged
// "emom" and up to 3 conditioning tagged "amrap", never more; (4) blocks[]
// minutes still sum to the requested duration after conversion; (5) mode/
// rounds/densityMode survive a save/reload round-trip through
// normalizeProgram; (6) a constrained build with <2 strength exercises stays
// straight (no fabricated EMOM pairing) -- honest fallback, not a crash.
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /function clampInt\(/.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={LIBRARY,generateProgram,generateSession,normalizeProgram};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const { generateProgram, generateSession, normalizeProgram } = m.exports;
let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };
const strengthOf = s => s.exercises.filter(e => e.type === 'strength');
const conOf = s => s.exercises.filter(e => e.type === 'conditioning');

// ---------- 1+3+4: 30-min hybrid converts, exact pairing counts, minutes intact ----------
// Deliberately sweeps BOTH with and without 'mobility' in includes: without it,
// generateSession/generateProgram request MORE strength slots (no warm-up/
// cool-down eating into the 30-min budget) -- exactly the case that exposed a
// real bug where applyDensityFormat's keep-list, keyed by exercise .id, was a
// no-op (every exercise's id is still undefined at that point in the pipeline,
// so every "kept" and "dropped" exercise collided into the same id bucket).
let checked30 = 0, converted = 0, strengthCountOk = 0, conCountOk = 0, minutesOk = 0;
for (const kit of [null, ['barbell', 'bodyweight'], ['dumbbell', 'bodyweight']]) {
  for (const includes of [['mobility', 'conditioning'], ['conditioning']]) {
  for (const seed of [1, 3, 7, 11, 17, 23, 31, 42]) {
    const p = generateProgram({ goal: 'hybrid', days: 4, minutes: 30, weeks: 1, includes, equipment: kit }, {}, seed, {}, {});
    p.weeks[0].sessions.forEach(s => {
      checked30++;
      const sBlock = s.blocks && s.blocks.find(b => b.kind === 'strength');
      const cBlock = s.blocks && s.blocks.find(b => b.kind === 'conditioning');
      if (!sBlock || !cBlock) return; // this build didn't have both -- not a density candidate
      const strengthEx = strengthOf(s), conEx = conOf(s);
      const emomTagged = strengthEx.filter(e => e.densityMode === 'emom');
      const amrapTagged = conEx.filter(e => e.densityMode === 'amrap');
      if (!emomTagged.length && !amrapTagged.length) return; // constrained build, honestly stayed straight
      converted++;
      if (sBlock.mode === 'emom' && emomTagged.length === 2 && strengthEx.length === 2) strengthCountOk++;
      if (cBlock.mode === 'amrap' && amrapTagged.length === conEx.length && conEx.length >= 1 && conEx.length <= 3) conCountOk++;
      const sum = s.blocks.reduce((a, b) => a + b.minutes, 0);
      if (sum === 30) minutesOk++;
    });
  }
  }
}
ok(checked30 > 0, 'exercised some 30-min hybrid builds');
ok(converted > 0, 'at least some 30-min hybrid builds actually converted to density format');
ok(strengthCountOk === converted, `every converted build has exactly 2 strength exercises tagged emom (${strengthCountOk}/${converted})`);
ok(conCountOk === converted, `every converted build has 1-3 conditioning exercises all tagged amrap (${conCountOk}/${converted})`);
ok(minutesOk === converted, `every converted build's blocks[] minutes still sum to 30 (${minutesOk}/${converted})`);

// ---------- 2: 45/60-min sessions are completely unaffected ----------
let checkedLonger = 0, anyDensityLeak = 0;
for (const minutes of [45, 60]) for (const seed of [1, 5, 9, 13]) {
  const p = generateProgram({ goal: 'hybrid', days: 4, minutes, weeks: 1, includes: ['mobility', 'conditioning'], equipment: null }, {}, seed, {}, {});
  p.weeks[0].sessions.forEach(s => {
    checkedLonger++;
    const hasDensity = (s.blocks || []).some(b => b.mode === 'emom' || b.mode === 'amrap') || s.exercises.some(e => e.densityMode);
    if (hasDensity) anyDensityLeak++;
  });
}
ok(checkedLonger > 0, 'exercised some 45/60-min builds');
ok(anyDensityLeak === 0, `${anyDensityLeak}/${checkedLonger} 45/60-min sessions leaked a density format (must be 30-min only)`);

// ---------- 5: mode/rounds/densityMode survive normalizeProgram round-trip ----------
{
  let sample = null;
  for (const seed of [1, 3, 7, 11, 17, 23, 31, 42]) {
    const p = generateProgram({ goal: 'hybrid', days: 4, minutes: 30, weeks: 1, includes: ['mobility', 'conditioning'], equipment: null }, {}, seed, {}, {});
    const hit = p.weeks[0].sessions.find(s => s.blocks && s.blocks.some(b => b.mode === 'emom'));
    if (hit) { sample = p; break; }
  }
  ok(!!sample, 'found at least one seed producing a density-converted 30-min session to round-trip');
  if (sample) {
    const roundTripped = normalizeProgram(JSON.parse(JSON.stringify(sample)));
    const before = sample.weeks[0].sessions.find(s => s.blocks && s.blocks.some(b => b.mode === 'emom'));
    const beforeIdx = sample.weeks[0].sessions.indexOf(before);
    const after = roundTripped.weeks[0].sessions[beforeIdx];
    ok(JSON.stringify(before.blocks) === JSON.stringify(after.blocks), 'session.blocks (incl. mode/rounds) survives a JSON round-trip through normalizeProgram unchanged');
    ok(before.exercises.every((e, idx) => e.densityMode === after.exercises[idx].densityMode), 'every exercise.densityMode survives the same round-trip');
  }
}

// ---------- 6: constrained build with <2 strength exercises stays straight (no crash, no fake pairing) ----------
{
  // A very tight bodyweight-only, 1-day kit at 30 min -- likely to sometimes
  // produce a session with only 1 (or 0) strength exercises. Whenever that
  // happens, it must NOT have been force-converted to emom.
  let sawSingleStrength = false, sawBadConversion = false;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    const s = generateSession({ role: 'full', minutes: 30, goal: 'hybrid', includes: ['mobility', 'conditioning'], equipment: ['bodyweight'] }, {}, seed, {}, null, false, null);
    const strengthEx = strengthOf(s);
    if (strengthEx.length < 2) {
      sawSingleStrength = true;
      if (strengthEx.some(e => e.densityMode === 'emom')) sawBadConversion = true;
    }
  }
  ok(!sawBadConversion, 'a session with <2 strength exercises never gets force-tagged emom');
  console.log('constrained-kit single-strength edge observed: ' + sawSingleStrength);
}

console.log(pass + ' passed, ' + fail + ' failed');
if (fail) fails.slice(0, 30).forEach(f => console.log('  - ' + f));
process.exit(fail ? 1 : 0);
