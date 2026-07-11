// Gold-Standard Phase B regression tests: real warm-up + cool-down content
// (pulse-raiser + movement-prep drills / stretches + a closer), matched to
// what the day actually trains. Covers: (1) every mobility-included session
// gets real warm-up AND cool-down content; (2) warm-up items are DYNAMIC
// (reps) or the pulse-raiser, cool-down items are STATIC (sec) or one of the
// quiet closers -- never the wrong character for the phase; (3) no duplicate
// exercise anywhere in the session (shared dedup with strength/conditioning);
// (4) a closer always appears; (5) the warm-up/cool-down pattern-matches the
// day's actual trained patterns (plus the v1.11 wrist/conditioning additions
// below); (6) it rotates week to week (not frozen, unlike strength); (7)
// equipment is honoured (no band-only picks on a no-band kit).
//
// v1.11 (Warm-Up/Cool-Down coach-span amendment) additions, proven here:
// (8) a genuinely full-body day (both lower and upper regions loaded) covers
// BOTH regions, never silently truncating to one; (9) that full-body dose
// never exceeds pulse + 3; (10) wrist prep is reachable on press/push-up-
// heavy days; (11) wrist prep is NOT added to unrelated days; (12) a day
// carrying a conditioning finisher gets real ankle/calf prep instead of the
// generic default; (13) the pulse-raiser pool has genuinely expanded past 2;
// (14) the cool-down closer rotates deterministically across more than one
// option, so Box Breathing is not the only thing that ever closes a session;
// (15) short (non-dual-region) sessions still cap at the pre-v1.11 dose.
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /function clampInt\(/.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={LIBRARY,generateProgram,generateSession,buildWarmupCooldown,isExerciseInjuryFlagged};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const { LIBRARY, generateProgram, generateSession, buildWarmupCooldown, isExerciseInjuryFlagged } = m.exports;
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
const CLOSER_NAMES = ['Box Breathing', "Child's Pose", 'Standing Forward Fold'];
const LOWER_REGION = { 'hip-mobility': 1, 'ankle-mobility': 1 };
const UPPER_REGION = { 'shoulder-mobility': 1, 'tspine-mobility': 1, 'wrist-mobility': 1 };
// Mirrors buildWarmupCooldown's own wrist/conditioning detection exactly, so
// the pattern-match check below knows these two groups can legitimately
// appear even when GENERAL_PREP_MAP alone wouldn't call for them.
function wristNeededFor(strengthPicksLib) {
  return strengthPicksLib.some(l => l && (l.pattern === 'hpush' || l.pattern === 'vpush') &&
    (l.equipment === 'barbell' || (l.equipment === 'bodyweight' && l.pattern === 'hpush')));
}

// ---------- 1+2+3+4+5+7: structural + content checks across a broad sweep ----------
let sessionsChecked = 0, sessionsMissingWarmup = 0, sessionsMissingCooldown = 0;
let wrongCharacterWarmup = 0, wrongCharacterCooldown = 0, dupWithinSession = 0;
let missingCloser = 0, mismatchedPrep = 0;
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
            const isCloser = l && CLOSER_NAMES.indexOf(l.name) >= 0;
            const isStaticStretch = l && l.unit === 'sec';
            if (!isCloser && !isStaticStretch) wrongCharacterCooldown++;
          });
          if (cooldown.length && !cooldown.some(e => libOf(e.name) && CLOSER_NAMES.indexOf(libOf(e.name).name) >= 0)) missingCloser++;

          const names = s.exercises.map(e => e.name.toLowerCase());
          if (new Set(names).size !== names.length) dupWithinSession++;

          // pattern-match check: every warm-up drill/cool-down stretch's movement_pattern
          // must be one this day's strength patterns actually call for, OR a
          // v1.11 wrist/conditioning addition that buildWarmupCooldown is
          // entitled to bring in on this exact day.
          const dayStrengthLib = strengthOf(s).map(e => libOf(e.name)).filter(Boolean);
          const dayPatterns = dayStrengthLib.map(l => l.pattern);
          const neededGroups = new Set();
          dayPatterns.forEach(p => (GENERAL_PREP_MAP[p] || []).forEach(g => neededGroups.add(g)));
          const hasConditioning = s.exercises.some(e => { const l = libOf(e.name); return l && l.type === 'conditioning'; }) || s.exercises.some(e => e.name === 'Easy Run' || e.name === 'Long Run' || e.name === 'Tempo Run' || e.name === 'Recovery Run');
          if (wristNeededFor(dayStrengthLib)) neededGroups.add('wrist-mobility');
          if (hasConditioning) neededGroups.add('ankle-mobility');
          warmup.concat(cooldown).forEach(e => {
            const l = libOf(e.name);
            if (!l || l.movement_pattern === 'pulse-raiser' || CLOSER_NAMES.indexOf(l.name) >= 0) return; // fixed content, not pattern-matched
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
ok(wrongCharacterCooldown === 0, `${wrongCharacterCooldown} cool-down items are neither a closer nor a static (sec) stretch`);
ok(missingCloser === 0, `${missingCloser} sessions with a cool-down are missing a closer`);
ok(dupWithinSession === 0, `${dupWithinSession} sessions have a duplicate exercise name (warm-up/cool-down colliding with strength/conditioning)`);
ok(mismatchedPrep === 0, `${mismatchedPrep} warm-up/cool-down picks don't match any of the day's actual trained patterns or a legitimate wrist/conditioning addition`);
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

// ==================================================================
// v1.11 Required Test 1+2: full-body day covers BOTH regions, never
// exceeding the approved pulse + 3 dose.
// ==================================================================
{
  let checked = 0, missingLower = 0, missingUpper = 0, overDose = 0;
  for (const seed of [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]) {
    for (const minutes of [30, 45, 60]) {
      const s = generateSession({ role: 'full', minutes, goal: 'general', includes: ['mobility'], equipment: null }, {}, seed, {}, null, false, null);
      const warmup = s.exercises.filter(e => e.block === 'warmup');
      const drillGroups = warmup.map(e => libOf(e.name)).filter(l => l && l.movement_pattern !== 'pulse-raiser').map(l => l.movement_pattern);
      checked++;
      if (!drillGroups.some(g => LOWER_REGION[g])) missingLower++;
      if (!drillGroups.some(g => UPPER_REGION[g])) missingUpper++;
      if (warmup.length > 4) overDose++; // 1 pulse-raiser + up to 3 drills, never more
    }
  }
  ok(missingLower === 0, `full-body (role: 'full') sessions always include at least one lower-region warm-up drill (${missingLower}/${checked} missing)`);
  ok(missingUpper === 0, `full-body (role: 'full') sessions always include at least one upper-region warm-up drill (${missingUpper}/${checked} missing) -- the old slice(0,2) truncation bug`);
  ok(overDose === 0, `full-body warm-up never exceeds the approved pulse + 3 dose (${overDose}/${checked} over)`);
}

// A free-text request that genuinely loads both regions (squat + bench, no
// role) must be treated the same way as ROLES.full -- the fix keys off real
// loaded regions, not a literal role name.
{
  let checked = 0, missingLower = 0, missingUpper = 0;
  for (const seed of [1, 2, 3, 4, 5]) {
    const s = generateSession({ patterns: ['squat', 'hpush'], minutes: 45, goal: 'general', includes: ['mobility'], equipment: null }, {}, seed, {}, null, false, null);
    const warmup = s.exercises.filter(e => e.block === 'warmup');
    const drillGroups = warmup.map(e => libOf(e.name)).filter(l => l && l.movement_pattern !== 'pulse-raiser').map(l => l.movement_pattern);
    checked++;
    if (!drillGroups.some(g => LOWER_REGION[g])) missingLower++;
    if (!drillGroups.some(g => UPPER_REGION[g])) missingUpper++;
  }
  ok(missingLower === 0 && missingUpper === 0, `a free-text squat+bench day (genuinely dual-region, no role) also gets both regions covered (${missingLower + missingUpper}/${checked * 2} missing)`);
}

// ==================================================================
// v1.11 Required Test 3+4: wrist prep reachable on press/push-up-heavy
// days, never added blindly to unrelated days.
// ==================================================================
{
  // A barbell bench-anchored upper day: across enough seeds, wrist prep
  // should surface at least once (it competes for a slot, doesn't own one).
  let sawWrist = false;
  for (let seed = 1; seed <= 20; seed++) {
    const wc = buildWarmupCooldown([{ pattern: 'hpush', equipment: 'barbell' }], null, {}, seed, {}, 45, 1, false, {}, []);
    if (wc.warmup.concat(wc.cooldown).some(e => libOf(e.name) && libOf(e.name).movement_pattern === 'wrist-mobility')) sawWrist = true;
  }
  ok(sawWrist, 'wrist prep is reachable on a barbell hpush (bench-style) day across a seed sweep');

  let sawWristPushup = false;
  for (let seed = 1; seed <= 20; seed++) {
    const wc = buildWarmupCooldown([{ pattern: 'hpush', equipment: 'bodyweight' }], null, {}, seed, {}, 45, 1, false, {}, []);
    if (wc.warmup.concat(wc.cooldown).some(e => libOf(e.name) && libOf(e.name).movement_pattern === 'wrist-mobility')) sawWristPushup = true;
  }
  ok(sawWristPushup, 'wrist prep is reachable on a bodyweight push-up-style day across a seed sweep');

  // A pure lower/pull day (no hpush/vpush at all) must NEVER surface wrist prep.
  let sawWristUnrelated = false;
  for (let seed = 1; seed <= 20; seed++) {
    const wc = buildWarmupCooldown([{ pattern: 'hinge', equipment: 'barbell' }, { pattern: 'hpull', equipment: 'barbell' }], null, {}, seed, {}, 45, 1, false, {}, []);
    if (wc.warmup.concat(wc.cooldown).some(e => libOf(e.name) && libOf(e.name).movement_pattern === 'wrist-mobility')) sawWristUnrelated = true;
  }
  ok(!sawWristUnrelated, 'wrist prep is never added to an unrelated hinge/hpull day across a seed sweep');

  // A dumbbell overhead/bench day (equipment "dumbbell", not "barbell" or
  // bodyweight hpush) is NOT treated as wrist-relevant -- the detection is
  // deliberately narrow (barbell load, or bodyweight push-up), not "any press".
  let sawWristDumbbell = false;
  for (let seed = 1; seed <= 20; seed++) {
    const wc = buildWarmupCooldown([{ pattern: 'vpush', equipment: 'dumbbell' }], null, {}, seed, {}, 45, 1, false, {}, []);
    if (wc.warmup.concat(wc.cooldown).some(e => libOf(e.name) && libOf(e.name).movement_pattern === 'wrist-mobility')) sawWristDumbbell = true;
  }
  ok(!sawWristDumbbell, 'wrist prep is not added for a dumbbell (non-barbell) press day -- narrow, not "any press", detection');
}

// ==================================================================
// v1.11 Required Test 5: a day carrying a conditioning finisher gets
// real ankle/calf prep, not just whatever the strength side mapped.
// ==================================================================
{
  // An upper-only day (shoulder/tspine only, per GENERAL_PREP_MAP -- no
  // ankle-mobility from the strength side at all) plus a conditioning
  // finisher should surface ankle-mobility across a seed sweep.
  let sawAnkleWithCon = false, sawAnkleWithoutCon = false;
  for (let seed = 1; seed <= 20; seed++) {
    const withCon = buildWarmupCooldown([{ pattern: 'hpush', equipment: 'dumbbell' }], null, {}, seed, {}, 45, 1, false, {}, [], true);
    if (withCon.warmup.concat(withCon.cooldown).some(e => libOf(e.name) && libOf(e.name).movement_pattern === 'ankle-mobility')) sawAnkleWithCon = true;
    const withoutCon = buildWarmupCooldown([{ pattern: 'hpush', equipment: 'dumbbell' }], null, {}, seed, {}, 45, 1, false, {}, [], false);
    if (withoutCon.warmup.concat(withoutCon.cooldown).some(e => libOf(e.name) && libOf(e.name).movement_pattern === 'ankle-mobility')) sawAnkleWithoutCon = true;
  }
  ok(sawAnkleWithCon, 'an upper-only day WITH a conditioning finisher surfaces ankle/calf prep across a seed sweep (the old generic-default gap)');
  ok(!sawAnkleWithoutCon, 'the same upper-only day WITHOUT a conditioning finisher never surfaces ankle/calf prep (no dose bloat when there is no conditioning need)');
}

// ==================================================================
// v1.11 Required Test 6+13: the pulse-raiser pool has genuinely expanded.
// ==================================================================
{
  const seen = new Set();
  for (let seed = 1; seed <= 30; seed++) {
    const wc = buildWarmupCooldown([{ pattern: 'squat', equipment: 'barbell' }], null, {}, seed, {}, 45, 1, false, {}, []);
    const pulse = wc.warmup.find(e => libOf(e.name) && libOf(e.name).movement_pattern === 'pulse-raiser');
    if (pulse) seen.add(pulse.name);
  }
  ok(seen.size > 2, `pulse-raiser pool has more than 2 real options (saw: ${[...seen].join(', ')})`);
}

// ==================================================================
// v1.11 Required Test 7+8: closer rotation is deterministic and Box
// Breathing is not the only thing that ever closes a session.
// ==================================================================
{
  const seen = new Set();
  for (let seed = 1; seed <= 12; seed++) {
    const wc = buildWarmupCooldown([{ pattern: 'squat', equipment: 'barbell' }], null, {}, seed, {}, 45, 1, false, {}, []);
    const closer = wc.cooldown.find(e => CLOSER_NAMES.indexOf(e.name) >= 0);
    if (closer) seen.add(closer.name);
  }
  ok(seen.size > 1, `the cool-down closer rotates across more than one option (saw: ${[...seen].join(', ')})`);
  ok(seen.size > 0 && !(seen.size === 1 && seen.has('Box Breathing')), 'Box Breathing is not the only closer that ever appears');

  // Determinism: the same seed always produces the same closer.
  const a = buildWarmupCooldown([{ pattern: 'squat', equipment: 'barbell' }], null, {}, 4, {}, 45, 1, false, {}, []);
  const b = buildWarmupCooldown([{ pattern: 'squat', equipment: 'barbell' }], null, {}, 4, {}, 45, 1, false, {}, []);
  const closerA = a.cooldown.find(e => CLOSER_NAMES.indexOf(e.name) >= 0);
  const closerB = b.cooldown.find(e => CLOSER_NAMES.indexOf(e.name) >= 0);
  ok(closerA && closerB && closerA.name === closerB.name, 'closer rotation is deterministic -- the same seed always produces the same closer');
}

// ==================================================================
// v1.11 Required Test 9+10: injury and equipment gates still apply to
// every v1.11 addition (new pulse-raisers, new closers, wrist prep).
// ==================================================================
{
  const KNEE_INJ = [{ category: 'pain', target: 'knee' }];
  let bypassed = null;
  for (let seed = 1; seed <= 20 && !bypassed; seed++) {
    const wc = buildWarmupCooldown([{ pattern: 'hpush', equipment: 'barbell' }], null, {}, seed, {}, 45, 1, false, {}, KNEE_INJ, true);
    wc.warmup.concat(wc.cooldown).forEach(e => {
      const l = libOf(e.name);
      if (l && isExerciseInjuryFlagged(l, KNEE_INJ)) bypassed = e.name;
    });
  }
  ok(!bypassed, `no v1.11 addition (pulse-raiser, closer, wrist/conditioning prep) ever bypasses a knee injury gate (${bypassed || 'clean'})`);

  // Equipment: a no-band kit never surfaces a band-only drill.
  let bandLeak = null;
  for (let seed = 1; seed <= 20 && !bandLeak; seed++) {
    const wc = buildWarmupCooldown([{ pattern: 'hpush', equipment: 'barbell' }], ['barbell', 'bodyweight'], {}, seed, {}, 45, 1, false, {}, []);
    wc.warmup.concat(wc.cooldown).forEach(e => {
      const l = libOf(e.name);
      if (l && l.equipment === 'band') bandLeak = e.name;
    });
  }
  ok(!bandLeak, `a no-band kit never surfaces a band-only warm-up/cool-down pick (${bandLeak || 'clean'})`);
}

// ==================================================================
// v1.11 Required Test 11+12: short / non-dual-region sessions do not
// bloat, and the sequencing skeleton (pulse -> dynamic prep, static ease
// -> closer) is unchanged.
// ==================================================================
{
  let overCap = 0, checked = 0;
  for (const seed of [1, 2, 3, 4, 5]) {
    for (const minutes of [20, 25, 30]) {
      const s = generateSession({ role: 'upper', minutes, goal: 'general', includes: ['mobility'], equipment: null }, {}, seed, {}, null, false, null);
      const warmup = s.exercises.filter(e => e.block === 'warmup');
      checked++;
      if (warmup.length > 3) overCap++; // non-dual-region cap: 1 pulse + up to 2 drills
    }
  }
  ok(overCap === 0, `short/single-region (Upper) sessions never exceed the pre-v1.11 pulse + 2 dose (${overCap}/${checked} over)`);

  const wc = buildWarmupCooldown([{ pattern: 'squat', equipment: 'barbell' }], null, {}, 3, {}, 45, 1, false, {}, []);
  const pulseIdx = wc.warmup.findIndex(e => libOf(e.name) && libOf(e.name).movement_pattern === 'pulse-raiser');
  ok(pulseIdx <= 0, 'the pulse-raiser still leads the warm-up array (sequencing: pulse -> dynamic prep)');
  wc.warmup.forEach(e => { const l = libOf(e.name); ok(l && (l.movement_pattern === 'pulse-raiser' || l.unit === 'reps'), `warm-up item "${e.name}" is still the pulse-raiser or a dynamic (reps) drill`); });
  wc.cooldown.forEach(e => { const l = libOf(e.name); ok(l && (CLOSER_NAMES.indexOf(l.name) >= 0 || l.unit === 'sec'), `cool-down item "${e.name}" is still a closer or a static (sec) stretch`); });
}

// ==================================================================
// v1.11 Library Variety Patch: 10-seed real-output rotation audit.
// Proves the picker actually rotates across a genuinely varied pool for
// each session type -- not just that new entries exist (that's what
// libraryIntegrity/pool-size-floor tests already cover), but that no
// single high-frequency slot dominates 10/10 real generated outputs.
// ==================================================================
const CLOSER_SET = new Set(CLOSER_NAMES);
function auditRotation(label, sessionBuilder) {
  const sessions = [];
  for (let seed = 1; seed <= 10; seed++) sessions.push(sessionBuilder(seed));
  const pulses = new Set(), drills = new Set(), closers = new Set();
  const counts = {};
  let mismatches = 0;
  sessions.forEach(s => {
    const warmup = s.exercises.filter(e => e.block === 'warmup');
    const cooldown = s.exercises.filter(e => e.block === 'cooldown');
    warmup.forEach(e => {
      const l = libOf(e.name);
      counts[e.name] = (counts[e.name] || 0) + 1;
      if (l && l.movement_pattern === 'pulse-raiser') pulses.add(e.name); else if (l) drills.add(e.name);
    });
    cooldown.forEach(e => { counts[e.name] = (counts[e.name] || 0) + 1; if (CLOSER_SET.has(e.name)) closers.add(e.name); });
    const strengthLib = strengthOf(s).map(e => libOf(e.name)).filter(Boolean);
    const hasLowerPattern = strengthLib.some(l => ['squat', 'hinge', 'lunge', 'calf'].indexOf(l.pattern) >= 0);
    const hasUpperPattern = strengthLib.some(l => ['hpush', 'vpush', 'hpull', 'vpull'].indexOf(l.pattern) >= 0);
    const drillGroups = warmup.map(e => libOf(e.name)).filter(l => l && l.movement_pattern !== 'pulse-raiser').map(l => l.movement_pattern);
    const gotLower = drillGroups.some(g => LOWER_REGION[g]), gotUpper = drillGroups.some(g => UPPER_REGION[g]);
    if (hasLowerPattern && !gotLower) mismatches++;
    if (hasUpperPattern && !gotUpper) mismatches++;
  });
  const n = sessions.length;
  const overused = Object.entries(counts).filter(([, v]) => v === n).map(([k]) => k);
  return { pulses, drills, closers, overused, mismatches, n };
}

// Determinism: same seed -> identical output; different seeds -> can differ.
{
  const build = seed => buildWarmupCooldown([{ pattern: 'hpush', equipment: 'barbell' }], null, {}, seed, {}, 45, 1, false, {}, []);
  const a = build(4), b = build(4);
  ok(JSON.stringify(a.warmup.map(e => e.name)) === JSON.stringify(b.warmup.map(e => e.name)),
     'same seed (4) produces byte-identical warm-up output across two independent calls');
  const seedOutputs = new Set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map(seed => build(seed).warmup.map(e => e.name).join('|')));
  ok(seedOutputs.size > 1, `different seeds produce different valid warm-up outputs (saw ${seedOutputs.size} distinct combos across 10 seeds)`);
}

const pushAudit = auditRotation('Upper Push', seed => generateSession({ role: 'push', minutes: 45, goal: 'general', includes: ['mobility'], equipment: null }, {}, seed, {}, null, false, null));
const pullAudit = auditRotation('Upper Pull', seed => generateSession({ role: 'pull', minutes: 45, goal: 'general', includes: ['mobility'], equipment: null }, {}, seed, {}, null, false, null));
const lowerAudit = auditRotation('Lower', seed => generateSession({ role: 'lower', minutes: 45, goal: 'general', includes: ['mobility'], equipment: null }, {}, seed, {}, null, false, null));
const fullAudit = auditRotation('Full Body', seed => generateSession({ role: 'full', minutes: 45, goal: 'general', includes: ['mobility'], equipment: null }, {}, seed, {}, null, false, null));
const conAudit = auditRotation('Conditioning', seed => generateSession({ role: 'upper', minutes: 45, goal: 'hybrid', includes: ['mobility', 'conditioning'], equipment: null }, {}, seed, {}, null, false, null));

[
  ['Upper Push', pushAudit], ['Upper Pull', pullAudit], ['Lower', lowerAudit],
  ['Full Body', fullAudit], ['Conditioning', conAudit]
].forEach(([label, a]) => {
  ok(a.mismatches === 0, `${label}: specificity holds across all 10 seeds (0 region mismatches)`);
  ok(a.overused.length === 0, `${label}: no single warm-up/cool-down item appears in all 10/10 real outputs (overused: ${a.overused.join(', ') || 'none'})`);
});

// Named regressions from the audit that triggered this patch.
ok(pushAudit.overused.indexOf('Wrist Prep Rocks') < 0, 'Upper Push no longer always uses Wrist Prep Rocks (Wrist Circles now shares the slot)');
ok(pushAudit.overused.indexOf('Sleeper Stretch') < 0, 'Upper Push no longer always uses Sleeper Stretch (Cross-Body/Standing Chest Stretch now share the slot)');
ok(pullAudit.overused.indexOf('Sleeper Stretch') < 0, 'Upper Pull no longer always uses Sleeper Stretch');
ok(pullAudit.overused.indexOf('Thoracic Extension (foam roller)') < 0, 'Upper Pull no longer always uses Thoracic Extension (Thread the Needle Hold now shares the slot)');
ok(lowerAudit.overused.indexOf('Soleus Wall Stretch') < 0, 'Lower no longer always uses Soleus Wall Stretch (Standing Calf Stretch now shares the slot)');
ok(fullAudit.overused.indexOf('Soleus Wall Stretch') < 0, 'Full Body no longer always uses Soleus Wall Stretch');

// The pool genuinely grew: each previously-monoculture group now resolves to
// more than one real name across the 10-seed sweep somewhere in the audit.
ok(new Set([...pushAudit.drills, ...conAudit.drills].filter(n => libOf(n) && libOf(n).movement_pattern === 'wrist-mobility')).size > 1,
   'wrist-mobility warm-up pool resolves to more than one real drill across the sweep');
{
  const shoulderStaticNames = new Set();
  const sessions = [1,2,3,4,5,6,7,8,9,10].map(seed => generateSession({ role: 'push', minutes: 45, goal: 'general', includes: ['mobility'], equipment: null }, {}, seed, {}, null, false, null));
  sessions.forEach(s => s.exercises.filter(e => e.block === 'cooldown').forEach(e => { const l = libOf(e.name); if (l && l.movement_pattern === 'shoulder-mobility') shoulderStaticNames.add(e.name); }));
  ok(shoulderStaticNames.size > 1, `shoulder-mobility cool-down pool resolves to more than one real stretch across the sweep (saw: ${[...shoulderStaticNames].join(', ')})`);
}
{
  const ankleStaticNames = new Set();
  const sessions = [1,2,3,4,5,6,7,8,9,10].map(seed => generateSession({ role: 'lower', minutes: 45, goal: 'general', includes: ['mobility'], equipment: null }, {}, seed, {}, null, false, null));
  sessions.forEach(s => s.exercises.filter(e => e.block === 'cooldown').forEach(e => { const l = libOf(e.name); if (l && l.movement_pattern === 'ankle-mobility') ankleStaticNames.add(e.name); }));
  ok(ankleStaticNames.size > 1, `ankle-mobility cool-down pool resolves to more than one real stretch across the sweep (saw: ${[...ankleStaticNames].join(', ')})`);
}
{
  const tspineStaticNames = new Set();
  const sessions = [1,2,3,4,5,6,7,8,9,10].map(seed => generateSession({ role: 'pull', minutes: 45, goal: 'general', includes: ['mobility'], equipment: null }, {}, seed, {}, null, false, null));
  sessions.forEach(s => s.exercises.filter(e => e.block === 'cooldown').forEach(e => { const l = libOf(e.name); if (l && l.movement_pattern === 'tspine-mobility') tspineStaticNames.add(e.name); }));
  ok(tspineStaticNames.size > 1, `tspine-mobility cool-down pool resolves to more than one real stretch across the sweep (saw: ${[...tspineStaticNames].join(', ')})`);
}

console.log(pass + ' passed, ' + fail + ' failed');
if (fail) fails.slice(0, 30).forEach(f => console.log('  - ' + f));
process.exit(fail ? 1 : 0);
