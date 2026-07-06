// Progression + selection-quality regression tests for the block rebuild:
// (1) strength anchors are FROZEN across the whole block (same main lift each
//     week so load can climb); (2) conditioning/mobility still ROTATE for variety;
// (3) full-gym strength anchors are barbell "money lifts" (RAMP_ANCHORS), not
//     random same-pattern compounds; (3b) and specifically T1 FLAGSHIPS, not
//     tied specialty variations (Phase D -- the reported Floor-Press-led-over-
//     Bench-Press bug); (4) strength conditioning is polarized (<=1 hard
//     finisher/week); (5) no battle-ropes/jump-rope on a bodyweight kit;
//     (6) Phase D vertical-press guarantee: any Upper/Push day that bills
//     shoulders in its focus and has room (>=3 strength slots) contains a real
//     compound vertical press, not just an isolation lateral raise.
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /function clampInt\(/.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={LIBRARY,RAMP_ANCHORS,ANCHOR_T1,ANCHOR_T2,generateProgram};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const { LIBRARY, RAMP_ANCHORS, ANCHOR_T1, ANCHOR_T2, generateProgram } = m.exports;
const byName = {}; LIBRARY.forEach(e => byName[e.name.toLowerCase()] = e);
const libOf = n => byName[String(n).toLowerCase()];
let pass = 0, fail = 0; const fails = [];
const ok = (c, m) => { if (c) pass++; else { fail++; fails.push(m); } };
const strengthOf = s => s.exercises.filter(e => e.type === 'strength');
// The functional finisher (carry / anti-rotation) is DELIBERATELY rotated week to
// week and dropped on the deload -- that's the intended variety, not the frozen
// strength work. Exclude it when checking the block freeze.
const isFinisher = e => { const l = libOf(e.name); const mp = l && (l.movement_pattern || l.pattern); return e.pattern === 'carry' || mp === 'carry' || mp === 'anti_rotation'; };
const coreStrengthOf = s => strengthOf(s).filter(e => !isFinisher(e));

// ---------- 1+2. freeze anchors, rotate conditioning ----------
const kits = [null, ['barbell', 'bodyweight'], ['dumbbell', 'bodyweight'], ['bodyweight'], ['kettlebell', 'bodyweight']];
const goals = ['strength', 'hybrid', 'hypertrophy'];
let frozenChecks = 0, rotateSeen = 0, rotateTotal = 0;
for (const kit of kits) for (const goal of goals) for (const seed of [1, 7, 17]) {
  const p = generateProgram({ goal, days: 4, minutes: 60, weeks: 4, includes: ['mobility', 'conditioning'], equipment: kit }, {}, seed, {}, {});
  for (let si = 0; si < p.weeks[0].sessions.length; si++) {
    // The CORE strength work (anchor + accessories, excluding the rotating
    // functional finisher) must be identical every week -- that's the freeze.
    const lists = p.weeks.map(w => coreStrengthOf(w.sessions[si]).map(e => e.name).join('|'));
    ok(lists.every(l => l === lists[0]), `core strength frozen ${goal}/${kit}/seed${seed}/s${si}: ${lists.join(' || ')}`);
    // And the anchor specifically is identical across ALL weeks incl. deload.
    const anchors = p.weeks.map(w => { const s = strengthOf(w.sessions[si]); return s[0] && s[0].name; });
    ok(anchors.every(a => a === anchors[0]), `anchor frozen ${goal}/${kit}/seed${seed}/s${si}: ${anchors.join(' | ')}`);
    frozenChecks++;
    // conditioning should differ across at least some weeks (variety), when present
    const cons = p.weeks.map(w => { const c = w.sessions[si].exercises.find(e => e.type === 'conditioning'); return c ? c.name : null; }).filter(Boolean);
    if (cons.length === 4) { rotateTotal++; if (new Set(cons).size > 1) rotateSeen++; }
  }
}
ok(rotateTotal === 0 || rotateSeen / rotateTotal > 0.5, `conditioning rotates across weeks (${rotateSeen}/${rotateTotal})`);

// ---------- 3. full-gym strength anchors are money lifts ----------
let moneyHits = 0, moneyTotal = 0;
for (const seed of [1, 3, 7, 11, 17, 23, 31, 42]) {
  const p = generateProgram({ goal: 'strength', days: 4, minutes: 60, weeks: 4, includes: ['mobility', 'conditioning'], equipment: null }, {}, seed, {}, {});
  p.weeks[0].sessions.forEach(s => {
    const lead = strengthOf(s)[0]; if (!lead) return;
    const l = libOf(lead.name); moneyTotal++;
    if (l && RAMP_ANCHORS[l.id]) moneyHits++;
  });
}
ok(moneyHits / moneyTotal >= 0.9, `>=90% full-gym strength anchors are money lifts (got ${moneyHits}/${moneyTotal})`);

// ---------- 3b. full-gym anchors are specifically T1 flagships, not tied T2 variations ----------
// Regression test for the reported bug: Floor Press (T2) led an Upper day over
// Bench Press (T1) because both scored identically. Covers strength AND hybrid
// (hybrid's selGoal collapses to the same "general" bucket the anchor bonus
// gates on), across enough seeds that a real regression can't hide in the jitter.
let t1Hits = 0, t1Total = 0;
for (const goal of ['strength', 'hybrid']) for (const seed of [1, 3, 7, 11, 17, 23, 31, 42, 55, 89]) {
  const p = generateProgram({ goal, days: 4, minutes: 60, weeks: 4, includes: ['mobility', 'conditioning'], equipment: null }, {}, seed, {}, {});
  p.weeks[0].sessions.forEach(s => {
    const lead = strengthOf(s)[0]; if (!lead) return;
    const l = libOf(lead.name); t1Total++;
    if (l && ANCHOR_T1[l.id]) t1Hits++;
  });
}
ok(t1Hits / t1Total >= 0.85, `>=85% strength/hybrid full-gym anchors are T1 flagships (got ${t1Hits}/${t1Total})`);
// Confirm the tiers are actually disjoint and both non-empty (guards against a
// future edit collapsing them back into one bucket without anyone noticing).
const t1Ids = Object.keys(ANCHOR_T1), t2Ids = Object.keys(ANCHOR_T2);
ok(t1Ids.length > 0 && t2Ids.length > 0, `both anchor tiers populated (T1=${t1Ids.length}, T2=${t2Ids.length})`);
ok(t1Ids.every(id => !ANCHOR_T2[id]), 'ANCHOR_T1 and ANCHOR_T2 are disjoint');

// ---------- 4. strength conditioning polarized (<=1 hard/week) ----------
const HARD = /interval|sprint|rope|burpee/i;
let overCon = 0;
for (const seed of [1, 3, 7, 11, 17]) {
  const p = generateProgram({ goal: 'strength', days: 5, minutes: 60, weeks: 4, includes: ['conditioning', 'mobility'], equipment: null }, {}, seed, {}, {});
  p.weeks.forEach(w => {
    const hard = w.sessions.filter(s => { const c = s.exercises.find(e => e.type === 'conditioning'); return c && HARD.test(c.name); }).length;
    if (hard > 1) overCon++;
  });
}
ok(overCon === 0, `${overCon} strength weeks with >1 hard conditioning finisher`);

// ---------- 5. bodyweight kit: no ropes ----------
let ropeLeak = 0;
for (const seed of [1, 5, 9]) {
  const p = generateProgram({ goal: 'hypertrophy', days: 4, minutes: 45, weeks: 4, includes: ['conditioning'], equipment: ['bodyweight'] }, {}, seed, {}, {});
  p.weeks.forEach(w => w.sessions.forEach(s => s.exercises.forEach(e => { if (/Battle Ropes|Jump Rope/.test(e.name)) ropeLeak++; })));
}
ok(ropeLeak === 0, `${ropeLeak} rope moves leaked into a bodyweight kit`);

// ---------- 6. Phase D vertical-press guarantee ----------
// Any day that BILLS shoulders in its focus text (Upper/Push, via ROLE_FOCUS)
// must contain a real compound vertical press once it has room for one (>=3
// strength slots) -- not just an isolation lateral raise. Gated on slot count
// so a 2-exercise session (too short for full coverage) isn't unfairly failed.
let pressChecked = 0, pressMissing = 0;
for (const goal of ['strength', 'hybrid', 'hypertrophy', 'general']) for (const days of [2, 4, 5, 6]) for (const minutes of [45, 60]) for (const seed of [1, 5, 9, 13, 21]) {
  const p = generateProgram({ goal, days, minutes, weeks: 1, includes: ['mobility', 'conditioning'], equipment: null }, {}, seed, {}, {});
  p.weeks[0].sessions.forEach(s => {
    if (!/shoulders/i.test(s.focus || '')) return; // only days that BILL shoulders (Upper/Push)
    const strength = strengthOf(s);
    if (strength.length < 3) return; // too short a session to guarantee full coverage
    pressChecked++;
    const hasPress = strength.some(e => {
      const l = libOf(e.name);
      return l && l.compound && (l.movement_pattern === 'vert_push' || l.pattern === 'vpush');
    });
    if (!hasPress) pressMissing++;
  });
}
ok(pressChecked > 0, 'vertical-press check actually exercised some Upper/Push sessions');
ok(pressMissing === 0, `${pressMissing}/${pressChecked} shoulder-billed sessions (>=3 strength slots) missing a real vertical press`);

console.log(`froze-checked ${frozenChecks} session-slots`);
console.log(pass + ' passed, ' + fail + ' failed');
if (fail) fails.slice(0, 20).forEach(f => console.log('  - ' + f));
process.exit(fail ? 1 : 0);
