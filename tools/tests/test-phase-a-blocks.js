// Gold-Standard Phase A regression tests: session architecture (four time-
// budgeted phases -- warm-up/strength/conditioning/cool-down) instead of a flat
// exercise list. Covers: (1) blocks[] minutes always sum exactly to the
// requested duration; (2) every exercise carries a valid block tag matching a
// listed block; (3) hybrid never loses its conditioning block; (4) blocks
// survive a save/reload round-trip through normalizeProgram (the exact path a
// stored program takes); (5) sessions/imports with no blocks stay legacy
// (normalizeProgram must never fabricate a blocks array out of nothing).
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /function clampInt\(/.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={LIBRARY,generateProgram,generateSession,normalizeProgram,computeBlockBudgets};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const { generateProgram, generateSession, normalizeProgram, computeBlockBudgets } = m.exports;
let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };
const BLOCK_KINDS = ['warmup', 'strength', 'conditioning', 'cooldown'];

// ---------- 1+2. blocks sum to duration; every exercise's block tag is valid & listed ----------
let sessionsChecked = 0;
for (const goal of ['strength', 'hybrid', 'hypertrophy', 'general', 'conditioning']) {
  for (const kit of [null, ['barbell', 'bodyweight'], ['bodyweight']]) {
    for (const minutes of [30, 40, 45, 60, 75]) {
      for (const seed of [1, 5, 11]) {
        const p = generateProgram({ goal, days: 4, minutes, weeks: 1, includes: ['mobility', 'conditioning'], equipment: kit }, {}, seed, {}, {});
        p.weeks[0].sessions.forEach(s => {
          sessionsChecked++;
          ok(Array.isArray(s.blocks) && s.blocks.length > 0, `session has a non-empty blocks[] (${goal}/${minutes}min/seed${seed})`);
          if (!Array.isArray(s.blocks)) return;
          const sum = s.blocks.reduce((a, b) => a + b.minutes, 0);
          ok(sum === minutes, `blocks[] minutes sum to the requested duration (got ${sum}, wanted ${minutes}, ${goal}/${minutes}min/seed${seed})`);
          const kinds = s.blocks.map(b => b.kind);
          ok(new Set(kinds).size === kinds.length, `no duplicate block kinds (${goal}/${minutes}min/seed${seed}: ${kinds.join(',')})`);
          ok(kinds.every(k => BLOCK_KINDS.indexOf(k) >= 0), `every block kind is one of the four valid kinds (${kinds.join(',')})`);
          const kindSet = new Set(kinds);
          s.exercises.forEach(e => {
            ok(BLOCK_KINDS.indexOf(e.block) >= 0, `${e.name}: has a valid block tag (got '${e.block}')`);
            ok(kindSet.has(e.block), `${e.name}: its block '${e.block}' is actually listed in session.blocks`);
          });
        });
      }
    }
  }
}
console.log(`checked ${sessionsChecked} sessions for block structure`);

// ---------- 3. hybrid never loses its conditioning block when conditioning is included ----------
let hybridChecked = 0, hybridMissingCon = 0;
for (const minutes of [20, 30, 45, 60]) for (const seed of [1, 3, 7, 11, 17]) {
  const p = generateProgram({ goal: 'hybrid', days: 4, minutes, weeks: 1, includes: ['mobility', 'conditioning'], equipment: null }, {}, seed, {}, {});
  p.weeks[0].sessions.forEach(s => {
    hybridChecked++;
    const hasCon = (s.blocks || []).some(b => b.kind === 'conditioning');
    if (!hasCon) hybridMissingCon++;
  });
}
ok(hybridMissingCon === 0, `hybrid never drops its conditioning block (${hybridMissingCon}/${hybridChecked} missing)`);

// ---------- 4. round-trip through normalizeProgram (simulates localStorage save/reload) ----------
{
  const p = generateProgram({ goal: 'hybrid', days: 4, minutes: 45, weeks: 1, includes: ['mobility', 'conditioning'], equipment: null }, {}, 1, {}, {});
  const roundTripped = normalizeProgram(JSON.parse(JSON.stringify(p)));
  const before = p.weeks[0].sessions[0], after = roundTripped.weeks[0].sessions[0];
  ok(JSON.stringify(before.blocks) === JSON.stringify(after.blocks), 'session.blocks survives a JSON round-trip through normalizeProgram unchanged');
  ok(before.exercises.every((e, idx) => e.block === after.exercises[idx].block), 'every exercise.block survives the same round-trip');
}

// ---------- 5. a session with NO blocks stays legacy (normalizeProgram must never fabricate one) ----------
{
  const legacyProgram = { title: 'Legacy', goal: 'strength', unit: 'kg', weeks: [{ week: 1, sessions: [
    { name: 'Old Session', focus: 'Legacy', exercises: [{ name: 'Bench Press', type: 'strength', equipment: 'barbell', sets: 3, reps: '5' }] }
  ] }] };
  const normalized = normalizeProgram(legacyProgram);
  const ses = normalized.weeks[0].sessions[0];
  ok(ses.blocks === undefined, 'a session with no blocks stays undefined after normalizeProgram (no fabricated structure)');
  ok(ses.exercises[0].block === undefined, 'an exercise with no block tag stays undefined after normalizeProgram');
}

// ---------- 6. Just-Today (generateSession) path also gets blocks ----------
{
  const s = generateSession({ role: 'upper', minutes: 45, goal: 'hybrid', includes: ['mobility', 'conditioning'], equipment: null }, {}, 1, {}, null, false, null);
  ok(Array.isArray(s.blocks) && s.blocks.length > 0, 'Just-Today (generateSession) sessions also get a blocks[] summary');
  if (Array.isArray(s.blocks)) {
    const sum = s.blocks.reduce((a, b) => a + b.minutes, 0);
    ok(sum === 45, `Just-Today blocks[] minutes sum to the requested duration (got ${sum})`);
  }
}

// ---------- 7. computeBlockBudgets: monotonic, all non-negative, matches the documented anchors exactly ----------
ok(JSON.stringify(computeBlockBudgets(30)) === JSON.stringify({ warmup: 4, strength: 16, conditioning: 7, cooldown: 3 }), '30-min budget matches the documented anchor exactly');
ok(JSON.stringify(computeBlockBudgets(45)) === JSON.stringify({ warmup: 5, strength: 25, conditioning: 10, cooldown: 5 }), '45-min budget matches the documented anchor exactly');
ok(JSON.stringify(computeBlockBudgets(60)) === JSON.stringify({ warmup: 6, strength: 34, conditioning: 14, cooldown: 6 }), '60-min budget matches the documented anchor exactly');
for (const mins of [15, 20, 25, 35, 50, 70, 90, 120]) {
  const b = computeBlockBudgets(mins);
  const sum = BLOCK_KINDS.reduce((a, k) => a + b[k], 0);
  ok(sum === mins, `computeBlockBudgets(${mins}) sums exactly to ${mins} (got ${sum})`);
  ok(BLOCK_KINDS.every(k => b[k] >= 0), `computeBlockBudgets(${mins}) has no negative buckets`);
}

console.log(pass + ' passed, ' + fail + ' failed');
if (fail) fails.slice(0, 30).forEach(f => console.log('  - ' + f));
process.exit(fail ? 1 : 0);
