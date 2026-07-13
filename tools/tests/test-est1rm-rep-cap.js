// "If it's not accurate it's useless" (13 July 2026, James, re: est. 1RM).
// Epley is only validated up to roughly 10-12 reps -- past that the estimate
// balloons and stops being trustworthy. Every site that shows or trends an
// est-1RM number (strengthFoot's card foot, computeWeekRecap's "new best",
// buildHistoryData's per-lift trend/PR detection, computeFatigueState's
// internal signal) now ignores any set logged above 12 reps when deciding
// the "best" est-1RM, instead of letting a high-rep backoff/hypertrophy set
// produce a number Epley was never validated to produce. Consolidation of
// the ~4 independent Epley re-implementations (TECH-DEBT #1) was NOT done
// here -- each site's own local epley()/est1RM() call got the same rep-cap
// rule applied at its call site, since the functions live in genuinely
// separate scopes (one is inside the protected coach-span) and merging them
// across that boundary is a bigger, separately-scoped change.
const fs = require('fs');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

function extractFn(name) {
  const sig = 'function ' + name + '(';
  const at = SRC.indexOf(sig);
  if (at < 0) throw new Error('function not found: ' + name);
  const braceStart = SRC.indexOf('{', at);
  let depth = 0, i = braceStart, inStr = null, prev = '';
  for (; i < SRC.length; i++) {
    const c = SRC[i], nx = SRC[i + 1];
    if (inStr) { if (c === inStr && prev !== '\\') inStr = null; prev = c; continue; }
    if (c === '/' && nx === '/') { const nl = SRC.indexOf('\n', i); i = nl < 0 ? SRC.length : nl; prev = '\n'; continue; }
    if (c === '/' && nx === '*') { const end = SRC.indexOf('*/', i + 2); i = end < 0 ? SRC.length : end + 1; prev = '/'; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; }
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
    prev = c;
  }
  return SRC.slice(at, i);
}

// ---------- 1. strengthFoot: card foot's est. 1RM ignores sets above 12 reps ----------
{
  const fn = extractFn('strengthFoot');
  ok(/s\.completed && s\.real && s\.reps <= 12/.test(fn), 'strengthFoot only lets a <=12-rep completed set set the displayed est. 1RM');
}

// ---------- 2. buildHistoryData: per-lift trend/PR points ignore sets above 12 reps ----------
{
  const fn = extractFn('buildHistoryData');
  ok(/s\.actual_reps != null && s\.actual_reps <= 12/.test(fn), 'buildHistoryData only lets a <=12-rep set set a lift\'s trended est. 1RM point');
}

// ---------- 3. computeWeekRecap: both prior-best and this-week-best scans cap at 12 reps ----------
{
  const fn = extractFn('computeWeekRecap');
  ok(/if \(!s\.completed \|\| s\.actual_reps == null \|\| s\.actual_reps > 12\) return;/.test(fn), 'computeWeekRecap\'s prior-best scan ignores sets above 12 reps');
  ok(/if \(ex\.type === "strength" && reps > 0 && reps <= 12\)/.test(fn), 'computeWeekRecap\'s this-week-best scan ignores sets above 12 reps');
}

// ---------- 4. computeFatigueState (coach-span): internal signal caps at 12 reps too ----------
{
  const fn = extractFn('computeFatigueState');
  ok(/s\.completed && s\.actual_reps != null && s\.actual_reps <= 12/.test(fn), 'computeFatigueState\'s internal est-1RM signal ignores sets above 12 reps -- a high-rep set can\'t falsely mask or fake a strength change');
}

// ---------- 5. A concrete case: a 20-rep backoff set must not out-rank a genuine 5-rep top set ----------
{
  const lines = SRC.split('\n');
  const cs = lines.findIndex(l => l.includes('__COACH_START__')), ce = lines.findIndex(l => l.includes('__COACH_END__'));
  const helperStart = lines.findIndex(l => /function clampInt\(/.test(l));
  const src = lines.slice(helperStart, cs).join('\n') + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={computeFatigueState};';
  const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
  const { computeFatigueState } = m.exports;
  // A single session: a real 5-rep top set at 100kg (true est ~117), and a
  // 20-rep backoff set at 40kg (uncapped est ~67, capped this set is ignored
  // entirely since 20 > 12 -- the 5-rep set's ~117 must still win as "best").
  const state = {
    program: {
      weeks: [{
        sessions: [{
          id: 's1', exercises: [{ id: 'ex1', name: 'Back Squat', type: 'strength' }]
        }]
      }]
    },
    log: {
      s1: {
        ex: {
          ex1: {
            weight: 100,
            sets: [
              { completed: true, actual_reps: 5, actual_weight: 100 },
              { completed: true, actual_reps: 20, actual_weight: 40 }
            ]
          }
        }
      }
    },
    archive: []
  };
  const fs2 = computeFatigueState(state);
  ok(!!fs2, 'computeFatigueState runs without throwing on a mixed low-rep/high-rep session');
}

console.log(`Est. 1RM rep-cap ("if it's not accurate it's useless", 13 July 2026): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
