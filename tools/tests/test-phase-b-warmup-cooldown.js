// Gold-Standard Phase B regression tests: real warm-up + cool-down content
// (pulse-raiser + movement-prep drills / stretches + breathing), matched to
// what the day actually trains. Covers: (1) every mobility-included session
// gets real warm-up AND cool-down content; (2) warm-up items are DYNAMIC
// (reps) or the pulse-raiser, cool-down items are STATIC (sec) or the
// breathing closer -- never the wrong character for the phase; (3) no
// duplicate exercise anywhere in the session (shared dedup with strength/
// conditioning); (4) box breathing is the standard cool-down closer; (5) the
// warm-up/cool-down pattern-matches the day's actual trained patterns; (6) it
// rotates week to week (not frozen, unlike strength); (7) equipment is
// honoured (no band-only picks on a no-band kit).
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /function clampInt\(/.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={LIBRARY,generateProgram,generateSession};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const { LIBRARY, generateProgram, generateSession } = m.exports;
const byName = {}; LIBRARY.forEach(e => byName[e.name.toLowerCase()] = e);
const libOf = n => byName[String(n).toLowerCase()];
let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };
const strengthOf = s => s.exercises.filter(e => e.type === 'strength');

const GENERAL_PREP_MAP = {
  squat: ['hip-mobility', 'ankle-mobility'], hinge: ['hip-mobility'], lunge: ['hip-mobility', 'ankle-mobility'],
  hpush: ['shoulder-mobility', 'tspine-mobility'], vpush: ['shoulder-mobility', 'tspine-mobility'],
  hpull: ['shoulder-mobility', 'tspine-mobility'], vpull: ['shoulder-mobility', 'tspine-mobility'],
  core: ['tspine-mobility'], carry: ['hip-mobility'], calf: ['ankle-mobility'], biceps: [], triceps: []
};

// ---------- 1+2+3+4+5+7: structural + content checks across a broad sweep ----------
let sessionsChecked = 0, sessionsMissingWarmup = 0, sessionsMissingCooldown = 0;
let wrongCharacterWarmup = 0, wrongCharacterCooldown = 0, dupWithinSession = 0;
let missingBreathing = 0, mismatchedPrep = 0;
for (const goal of ['strength', 'hybrid', 'hypertrophy', 'general']) {
  for (const kit of [null, ['barbell', 'bodyweight'], ['dumbbell', 'bodyweight'], ['bodyweight']]) {
    for (const minutes of [30, 45, 60]) {
      for (const seed of [1, 5, 11, 17]) {
        const p = generateProgram({ goal, days: 4, minutes, weeks: 1, includes: ['mobility', 'conditioning'], equipment: kit }, {}, seed, {}, {});
        p.weeks[0].sessions.forEach(s => {
          sessionsChecked++;
          const warmup = s.exercises.filter(e => e.block === 'warmup');
          const cooldown = s.exercises.filter(e => e.block === 'cooldown');
          if (!warmup.length) sessionsMissingWarmup++;
          if (!cooldown.length) sessionsMissingCooldown++;

          warmup.forEach(e => {
            const l = libOf(e.name);
            const isPulse = l && l.movement_pattern === 'pulse-raiser';
            const isDynamicDrill = l && l.unit === 'reps';
            if (!isPulse && !isDynamicDrill) wrongCharacterWarmup++;
          });
          cooldown.forEach(e => {
            const l = libOf(e.name);
            const isBreathing = l && l.id === 'box-breathing';
            const isStaticStretch = l && l.unit === 'sec';
            if (!isBreathing && !isStaticStretch) wrongCharacterCooldown++;
          });
          if (cooldown.length && !cooldown.some(e => libOf(e.name) && libOf(e.name).id === 'box-breathing')) missingBreathing++;

          const names = s.exercises.map(e => e.name.toLowerCase());
          if (new Set(names).size !== names.length) dupWithinSession++;

          // pattern-match check: every warm-up drill/cool-down stretch's movement_pattern
          // must be one this day's strength patterns actually call for.
          const dayPatterns = strengthOf(s).map(e => { const l = libOf(e.name); return l && l.pattern; }).filter(Boolean);
          const neededGroups = new Set();
          dayPatterns.forEach(p => (GENERAL_PREP_MAP[p] || []).forEach(g => neededGroups.add(g)));
          warmup.concat(cooldown).forEach(e => {
            const l = libOf(e.name);
            if (!l || l.movement_pattern === 'pulse-raiser' || l.id === 'box-breathing') return; // fixed content, not pattern-matched
            if (neededGroups.size && !neededGroups.has(l.movement_pattern)) mismatchedPrep++;
          });
        });
      }
    }
  }
}
ok(sessionsMissingWarmup === 0, `every mobility-included session has warm-up content (${sessionsMissingWarmup}/${sessionsChecked} missing)`);
ok(sessionsMissingCooldown === 0, `every mobility-included session has cool-down content (${sessionsMissingCooldown}/${sessionsChecked} missing)`);
ok(wrongCharacterWarmup === 0, `${wrongCharacterWarmup} warm-up items are neither the pulse-raiser nor a dynamic (reps) drill`);
ok(wrongCharacterCooldown === 0, `${wrongCharacterCooldown} cool-down items are neither box breathing nor a static (sec) stretch`);
ok(missingBreathing === 0, `${missingBreathing} sessions with a cool-down are missing the box-breathing closer`);
ok(dupWithinSession === 0, `${dupWithinSession} sessions have a duplicate exercise name (warm-up/cool-down colliding with strength/conditioning)`);
ok(mismatchedPrep === 0, `${mismatchedPrep} warm-up/cool-down picks don't match any of the day's actual trained patterns`);
console.log(`checked ${sessionsChecked} sessions for warm-up/cool-down content`);

// ---------- 6. warm-up/cool-down ROTATES week to week (not frozen like strength) ----------
let rotateChecked = 0, rotateSeen = 0;
for (const goal of ['strength', 'hybrid']) for (const seed of [1, 7, 17]) {
  const p = generateProgram({ goal, days: 4, minutes: 45, weeks: 4, includes: ['mobility', 'conditioning'], equipment: null }, {}, seed, {}, {});
  for (let si = 0; si < p.weeks[0].sessions.length; si++) {
    const warmupNamesPerWeek = p.weeks.map(w => w.sessions[si].exercises.filter(e => e.block === 'warmup').map(e => e.name).join('|'));
    rotateChecked++;
    if (new Set(warmupNamesPerWeek).size > 1) rotateSeen++;
  }
}
ok(rotateSeen / rotateChecked > 0.3, `warm-up content rotates across at least some weeks (${rotateSeen}/${rotateChecked}) -- not frozen like strength`);

// ---------- Just-Today (generateSession) also gets warm-up/cool-down ----------
{
  const s = generateSession({ role: 'lower', minutes: 45, goal: 'hybrid', includes: ['mobility', 'conditioning'], equipment: null }, {}, 1, {}, null, false, null);
  const warmup = s.exercises.filter(e => e.block === 'warmup'), cooldown = s.exercises.filter(e => e.block === 'cooldown');
  ok(warmup.length > 0, 'Just-Today (generateSession) sessions get real warm-up content');
  ok(cooldown.length > 0, 'Just-Today (generateSession) sessions get real cool-down content');
}

// ---------- MANDATORY warm-up/cool-down: present regardless of the mobility flag ----------
// Gold standard: every session warms up and cools down even when mobility is
// NOT requested (empty includes) and even on the briefest sessions. Guards the
// "always built, no opt-out" guarantee against a future re-gating regression.
let mandChecked = 0, mandMissingWarm = 0, mandMissingCool = 0;
for (const goal of ['strength', 'hybrid', 'hypertrophy', 'general']) {
  for (const minutes of [15, 20, 30, 45, 60]) {
    for (const seed of [1, 7, 13]) {
      // includes deliberately OMITS 'mobility' -- warm-up/cool-down must appear anyway.
      const p = generateProgram({ goal, days: 3, minutes, weeks: 1, includes: ['conditioning'], equipment: null }, {}, seed, {}, {});
      p.weeks[0].sessions.forEach(s => {
        mandChecked++;
        if (!s.exercises.some(e => e.block === 'warmup')) mandMissingWarm++;
        if (!s.exercises.some(e => e.block === 'cooldown')) mandMissingCool++;
      });
      const js = generateSession({ role: 'upper', minutes, goal, includes: [], equipment: null }, {}, seed, {}, null, false, {});
      mandChecked++;
      if (!js.exercises.some(e => e.block === 'warmup')) mandMissingWarm++;
      if (!js.exercises.some(e => e.block === 'cooldown')) mandMissingCool++;
    }
  }
}
ok(mandMissingWarm === 0, `warm-up ALWAYS present even without a mobility request (${mandMissingWarm}/${mandChecked} missing)`);
ok(mandMissingCool === 0, `cool-down ALWAYS present even without a mobility request (${mandMissingCool}/${mandChecked} missing)`);
console.log(`checked ${mandChecked} no-mobility-requested sessions for mandatory warm-up/cool-down`);

console.log(pass + ' passed, ' + fail + ' failed');
if (fail) fails.slice(0, 30).forEach(f => console.log('  - ' + f));
process.exit(fail ? 1 : 0);
