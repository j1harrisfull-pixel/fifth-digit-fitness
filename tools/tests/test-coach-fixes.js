// Targeted regressions for the coach-credibility batch: superset adjacency,
// sec-unit holds prescribed as time, TGU low-rep, KB Swing eligible on strength.
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /function clampInt\(/.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={LIBRARY,generateProgram};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const { LIBRARY, generateProgram } = m.exports;
const byName = {}; LIBRARY.forEach(e => byName[e.name.toLowerCase()] = e);
let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

const kits = [null, ['dumbbell','bodyweight'], ['kettlebell','bodyweight'], ['bodyweight'], ['barbell','bodyweight']];
let badAdj = 0, badSec = 0, badTGU = 0, checked = 0, kbSwingSeen = 0, kbStrengthRuns = 0;
for (const kit of kits) for (const goal of ['strength','hybrid','hypertrophy']) for (let minutes of [30,45,60]) for (let seed=1; seed<=6; seed++){
  const p = generateProgram({goal,days:4,minutes,weeks:4,includes:['mobility','conditioning'],equipment:kit},{},seed,{},{});
  p.weeks.forEach(w => w.sessions.forEach(s => {
    checked++;
    // superset adjacency: same group letter -> adjacent indices
    const groups = {};
    s.exercises.forEach((e,idx) => { if (e.group) (groups[e.group]=groups[e.group]||[]).push(idx); });
    Object.keys(groups).forEach(g => { const ix = groups[g]; for (let z=1; z<ix.length; z++) if (ix[z] !== ix[z-1]+1) badAdj++; });
    // sec-unit holds prescribed as time
    s.exercises.forEach(e => {
      const l = byName[e.name.toLowerCase()];
      if (l && l.unit === 'sec' && e.type === 'strength') { if (!/s(\b|$|\/)/.test(String(e.reps))) badSec++; }
      if (e.name === 'Kettlebell Turkish Get-Up') { if (!/\/side/.test(String(e.reps))) badTGU++; }
    });
  }));
  if ((kit && kit[0]==='kettlebell') && goal==='strength') { kbStrengthRuns++; if (p.weeks.some(w=>w.sessions.some(s=>s.exercises.some(e=>e.name==='Kettlebell Swing')))) kbSwingSeen++; }
}
ok(badAdj === 0, badAdj + ' non-adjacent superset pairs');
ok(badSec === 0, badSec + ' sec-unit holds prescribed in reps not time');
ok(badTGU === 0, badTGU + ' Turkish Get-Ups without /side low-rep');
ok(kbStrengthRuns === 0 || kbSwingSeen > 0, `KB Swing appears in KB strength programs (${kbSwingSeen}/${kbStrengthRuns} runs)`);

// same-role paired days balanced to within 2 strength lifts (no 5-vs-2)
let worstGap = 0, worstCase = '';
for (const kit of [null, ['dumbbell','bodyweight'], ['kettlebell','bodyweight'], ['bodyweight']]) for (const goal of ['strength','hybrid','hypertrophy']) for (const days of [4,6]) for (let seed=1; seed<=6; seed++){
  const p = generateProgram({goal,days,minutes:60,weeks:1,includes:['mobility','conditioning'],equipment:kit},{},seed,{},{});
  const byRole = {};
  p.weeks[0].sessions.forEach(s => { const r = (s.name||'').split(' · ')[0]; const n = s.exercises.filter(e=>e.type==='strength').length; (byRole[r]=byRole[r]||[]).push(n); });
  Object.keys(byRole).forEach(r => { const a = byRole[r]; if (a.length>1){ const gap = Math.max(...a)-Math.min(...a); if (gap>worstGap){ worstGap=gap; worstCase=`${goal}/${days}d/${kit||'full'}/seed${seed} ${r} ${JSON.stringify(a)}`; } } });
}
ok(worstGap <= 2, `same-role day imbalance <= 2 (worst ${worstGap}: ${worstCase})`);

console.log('checked ' + checked + ' sessions');
console.log(pass + ' passed, ' + fail + ' failed');
if (fail) fails.forEach(f => console.log('  - ' + f));
process.exit(fail ? 1 : 0);
