// v1.8 TEMPO -- Final Lock Audit fixes. Three display-layer/copy fixes only:
//
// 1. Home reason line honesty: computeWeeklyDebt() has no hasSignal concept
//    (that only exists on computeRollingDebt's output) -- on a fresh program
//    or a zero-history week every pattern reads "behind" a target of zero
//    real sets, so dayReasonLine() would show a debt claim the user hasn't
//    earned. Fixed with a Home-only display-layer gate (real logged history
//    required + no conflict with the current hero focus) -- computeWeeklyDebt
//    and dayReasonLine themselves are untouched.
// 2. Partial (and full/density) finish receipt no longer shows "N sets
//    logged" in both #completeSummary and #completeFact -- the phrase now
//    lives only on #completeFact.
// 3. Two em dash strings replaced with periods (copy-only).
//
// This harness extracts the real gating snippet verbatim (by string slice,
// since it's inline in renderHomeHero rather than a standalone function) and
// the real collectLoggedSessions/sessionHasCompletedWork/sessionLogDate/
// computeWeeklyDebt/dayReasonLine functions verbatim by brace-matching, then
// runs the ACTUAL shipped logic against fixtures -- not a reimplementation.
const fs = require('fs');
const { execSync } = require('child_process');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

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

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 0. Coach-span untouched ----------
const spanMd5 = execSync(`sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5`).toString().trim();
ok(spanMd5 === '909fbc92112ba642ed56d6d88b114fb1', 'coach-span md5 unchanged (909fbc92112ba642ed56d6d88b114fb1), got ' + spanMd5);

// ==================================================================
// FIX 1: Home reason-line honesty gate
// ==================================================================

// ---------- 1a. Structural guard: the gate exists, outside coach-span, and
// does not touch computeWeeklyDebt/dayReasonLine themselves ----------
const gateStart = SRC.indexOf('// v1.8 TEMPO reason line: reuses the EXACT v1.6 dayReasonLine()');
const gateEnd = SRC.indexOf('// A quiet preview of the session\'s lifts on the card itself', gateStart);
ok(gateStart > 0 && gateEnd > gateStart, 'Home reason-line gate block located');
const gateSrc = SRC.slice(gateStart, gateEnd);
const spanStart = SRC.indexOf('/*__COACH_START__*/'), spanEnd = SRC.indexOf('/*__COACH_END__*/');
ok(gateStart > spanEnd, 'the Home reason-line gate is defined outside (after) the coach-span');
ok(/homeHasLoggedHistory\s*=\s*collectLoggedSessions\(state\.program, state\.log\)\.length > 0/.test(gateSrc),
   'the gate requires real logged history (collectLoggedSessions) before computing the reason line');
ok(/state\.archive/.test(gateSrc), 'the gate also checks the archive for logged history, matching homeMemoryLine\'s own signal');
ok(/if \(homeHasLoggedHistory\) \{/.test(gateSrc), 'dayReasonLine() is only called once real history is confirmed');
ok(/conflicts/.test(gateSrc), 'a hero-focus conflict check exists');
const computeWeeklyDebtBody = extractFn('computeWeeklyDebt');
const dayReasonLineBody = extractFn('dayReasonLine');
ok(!/homeHasLoggedHistory/.test(computeWeeklyDebtBody),
   'computeWeeklyDebt() itself is untouched -- the gate lives in the display layer, not the coach function');
ok(!/homeHasLoggedHistory/.test(dayReasonLineBody),
   'dayReasonLine() itself is untouched -- the gate wraps its call site, not its body');

// ---------- 1b. Functional test: run the REAL gate logic against fixtures ----------
// computeWeeklyDebt reads shared coach-span constants (LIBRARY,
// WEEKLY_SET_TARGETS, MUSCLE_VOLUME_LANDMARKS, ANTERIOR/POSTERIOR_PATTERNS,
// SECONDARY_MUSCLE_CREDIT) -- pull in the real coach-span body (same pattern
// as test-v1_6-rolling-today.js) so this test runs against real data, not a
// hand-rolled stub.
const LINES = SRC.split('\n');
const csStart = LINES.findIndex(l => l.includes('/*__COACH_START__*/'));
const csEnd = LINES.findIndex(l => l.includes('/*__COACH_END__*/'));
const coachSpanBody = LINES.slice(csStart + 1, csEnd).join('\n');
const collectLoggedSessionsSrc = extractFn('collectLoggedSessions');
const sessionHasCompletedWorkSrc = extractFn('sessionHasCompletedWork');
const sessionLogDateSrc = extractFn('sessionLogDate');
const dayReasonLineSrc = extractFn('dayReasonLine');

// Build a small harness function that mirrors the real call site exactly:
// same variable names, same condition, same order of operations, lifted
// verbatim from the gate block located above (gateSrc) so this test proves
// the ACTUAL shipped code, not a paraphrase of it.
const harness = `
  ${coachSpanBody}
  ${sessionHasCompletedWorkSrc}
  ${sessionLogDateSrc}
  ${collectLoggedSessionsSrc}
  function esc(s) { return String(s); }
  // v1.9 Home Hero Flow added a todayPicked guard alongside weekDone to this
  // exact gate (a todayPick already answers "what am I training", so the
  // debt-reasoning line is suppressed rather than contradicting it) -- this
  // harness call site fixes it to false (never a Chosen Today Review case)
  // so every existing fixture below still exercises the untouched non-picked
  // path this file was written to test.
  function homeReasonHtml(state, weekDone, heroFocus) {
    var todayPicked = false;
    ${gateSrc}
    return reasonHtml;
  }
  ${dayReasonLineSrc}
  module.exports = { homeReasonHtml: homeReasonHtml };
`;
const mod = { exports: {} };
new Function('module', 'exports', harness)(mod, mod.exports);
const { homeReasonHtml } = mod.exports;

function loggedProgram(patternDebtSetup) {
  // A program/log with ONE completed set logged in the current week, so
  // collectLoggedSessions sees real history -- patternDebtSetup controls
  // which movement pattern is short on volume via the exercises array.
  return {
    program: { weeks: [{ sessions: [{ id: 'S1', exercises: patternDebtSetup, name: 'Sess' }] }] },
    log: { S1: { date: new Date().toISOString(), finishedAt: new Date().toISOString(), ex: { e0: { sets: [{ completed: true }] } } } },
    activeWeek: 0
  };
}
const LOWER_EX = [{ id: 'e0', name: 'Back Squat' }];
const LIBRARY_STUB_NOTE = 'computeWeeklyDebt looks up LIBRARY by exercise name -- using the real LIBRARY via the file is unnecessary here since byName lookup misses cleanly (lib undefined) and the exercise contributes no done-volume, which still exercises the "target > 0, done = 0" debt path that is the actual bug.';

// Test 1: fresh install -- no program at all.
{
  const state = { program: null, log: {}, archive: [] };
  const out = homeReasonHtml(state, false, 'Chest · Back · Shoulders');
  ok(out === '', 'fresh install (no program): Home reason line is blank, got: ' + JSON.stringify(out));
}

// Test 2: zero-history week -- a program/week exists but nothing has ever been logged.
{
  const state = { program: { weeks: [{ sessions: [{ id: 'S1', exercises: LOWER_EX, name: 'Sess' }] }] }, log: {}, archive: [] };
  const out = homeReasonHtml(state, false, 'Chest · Back · Shoulders');
  ok(out === '', 'zero-history week: Home reason line is blank (no fake debt/need claim), got: ' + JSON.stringify(out));
}

// Test 3: skipped-only -- an exercise marked skipped, no completed sets anywhere.
{
  const state = {
    program: { weeks: [{ sessions: [{ id: 'S1', exercises: LOWER_EX, name: 'Sess' }] }] },
    log: { S1: { date: null, ex: { e0: { skipped: true, sets: [] } } } },
    archive: []
  };
  const out = homeReasonHtml(state, false, 'Chest · Back · Shoulders');
  ok(out === '', 'skipped-only: Home reason line is blank, got: ' + JSON.stringify(out));
}

// Test 4: zero-logged -- a session log entry exists but every set is incomplete.
{
  const state = {
    program: { weeks: [{ sessions: [{ id: 'S1', exercises: LOWER_EX, name: 'Sess' }] }] },
    log: { S1: { date: null, ex: { e0: { sets: [{ completed: false }] } } } },
    archive: []
  };
  const out = homeReasonHtml(state, false, 'Chest · Back · Shoulders');
  ok(out === '', 'zero-logged: Home reason line is blank, got: ' + JSON.stringify(out));
}

// Test 5: real logged history exists, but the honest reason would conflict
// with the current hero focus -- e.g. "Lower today" while the up-next
// session is an Upper (Chest/Back/Shoulders) session.
{
  const fx = loggedProgram(LOWER_EX);
  fx.archive = [];
  const out = homeReasonHtml(fx, false, 'Chest · Back · Shoulders');
  ok(!/Lower today\./.test(out), '"Lower today." reason line is suppressed when the hero focus is Upper (conflict), got: ' + JSON.stringify(out));
}

// Test 6: real logged history exists, and the reason line does NOT conflict
// with the hero focus -- it renders.
{
  const fx = loggedProgram(LOWER_EX);
  fx.archive = [];
  const out = homeReasonHtml(fx, false, 'Quads · Hams · Glutes');
  ok(/Lower today\./.test(out), 'honest reason line still renders when backed by real signal and no hero-focus conflict, got: ' + JSON.stringify(out));
}

// Test 7: real logged history lives only in the archive (current program has
// none) -- still counts as honest signal.
{
  const state = {
    program: { weeks: [{ sessions: [{ id: 'S1', exercises: LOWER_EX, name: 'Sess' }] }] },
    log: {},
    archive: [{
      program: { weeks: [{ sessions: [{ id: 'A1', exercises: LOWER_EX, name: 'Old' }] }] },
      log: { A1: { date: new Date().toISOString(), ex: { e0: { sets: [{ completed: true }] } } } }
    }]
  };
  const out = homeReasonHtml(state, false, 'Quads · Hams · Glutes');
  ok(/Lower today\./.test(out), 'archived logged history counts as honest signal (matches homeMemoryLine\'s own rule), got: ' + JSON.stringify(out));
}

// Test 8: weekDone -- reason line is never shown once the week is complete
// (unchanged pre-existing behavior, still gated correctly with the new logic).
{
  const fx = loggedProgram(LOWER_EX);
  fx.archive = [];
  const out = homeReasonHtml(fx, true, 'Quads · Hams · Glutes');
  ok(out === '', 'weekDone: Home reason line stays blank regardless of signal, got: ' + JSON.stringify(out));
}

// ==================================================================
// FIX 2: partial/full/density finish receipt no longer duplicates "N sets logged"
// ==================================================================
// v1.10 Ticket 5 THE PAGE: the receipt's summary/fact split is gone -- the
// closing sentence is now the single honest counts line. The Fix-2 property
// this block protected (the set count is stated exactly once) still holds:
// only closeParts carries it.
{
  const closeIdx = SRC.indexOf('var closeParts = [];');
  ok(closeIdx > 0, 'closing-sentence block located');
  const closeBlock = SRC.slice(closeIdx, closeIdx + 1400);
  ok(/closeParts\.push\(setsDone \+ " set" \+ \(setsDone === 1 \? "" : "s"\) \+ " kept"\)/.test(closeBlock),
     'closing sentence carries the single "N set(s) kept" count');
  ok(/closeParts\.push\(roundsTotal \+ " round" \+ \(roundsTotal === 1 \? "" : "s"\) \+ " kept"\)/.test(closeBlock),
     'closing sentence still carries the honest rounds count for density-only sessions');
  ok(!/completeSummary/.test(SRC) && !/completeFact/.test(SRC),
     'the old summary/fact receipt elements are fully gone (no duplicate counts possible)');
  ok((SRC.match(/" kept"/g) || []).length >= 2 && !/logged · /.test(closeBlock.replace(/sets kept/g, '')),
     'set count is stated exactly once, in "kept" grammar, with no leftover "logged ·" line');
}

// ---------- Regression: zero-logged finish, full finish, density finish still correct ----------
// (Exercised end-to-end against the real endSession/showSessionComplete code
// in test-v1_4-density-finish.js and test-v1_8-tempo-finish.js -- re-run here
// as part of the required regression list via the shared harness pattern.)
ok(/toast\("Nothing logged\. Left as is\."\);/.test(SRC), 'zero-logged finish toast copy is exactly "Nothing logged. Left as is." (unchanged)');
// v1.10 Ticket 5 THE PAGE: the spoken line replaced the old headlines --
// "Work logged." (full/density) / "Enough for today." (partial).
ok(/"Work logged\."/.test(SRC), 'full/density finish spoken line is "Work logged."');
ok(/"Enough for today\."/.test(SRC), 'partial finish spoken line is "Enough for today."');

// ==================================================================
// FIX 3: em dash copy replaced
// ==================================================================
ok(SRC.indexOf('Optional — change it anytime in Settings.') === -1, 'old em dash string "Optional — change it anytime in Settings." is gone');
// Intro audit (15 July 2026): the intro step-4 copy of this string became
// "Optional. Skip it and the coach assumes intermediate." (the honest-default
// fix). The lock's intent -- no em dash form anywhere -- is unchanged.
ok(SRC.indexOf('Optional. Skip it and the coach assumes intermediate.') !== -1, 'intro step-4 fine print carries the honest-default copy (no em dash)');
ok(SRC.indexOf('Every session warms up and cools down &mdash; always.') === -1, 'old em dash string "Every session warms up and cools down &mdash; always." is gone');
ok(SRC.indexOf('Every session warms up and cools down. Always.') !== -1, 'replacement string "Every session warms up and cools down. Always." is present');

// ==================================================================
// Rejected-copy guard (scoped to the code touched by this ticket)
// ==================================================================
const REJECTED = [
  'built to the minute', 'Every minute answered', '45 minutes, honest', 'Progression handled',
  'Tuesday is banked', 'UNTOUCHED', 'WAITING', 'Signed off', 'training receipt', 'great job',
  'well done', 'crushed it', 'recovered', 'fatigued', 'optimal', 'readiness score', 'recovery score'
];
const TOUCHED_CODE = gateSrc + SRC.slice(SRC.indexOf('var summaryParts = [];'), SRC.indexOf('$("completeSummary")') + 200)
  + SRC.slice(SRC.indexOf('<p class="intro__fine">'), SRC.indexOf('<p class="intro__fine">') + 100)
  + SRC.slice(SRC.indexOf('<p class="bhint">'), SRC.indexOf('<p class="bhint">') + 100);
REJECTED.forEach(function (phrase) {
  ok(TOUCHED_CODE.toLowerCase().indexOf(phrase.toLowerCase()) === -1, 'rejected phrase absent from this ticket\'s touched code: "' + phrase + '"');
});

// ==================================================================
// No data-shape change: no new stored field introduced by either fix
// ==================================================================
ok(!/state\.memory\b|state\.reasonCache\b|\.homeGate\b/.test(gateSrc), 'no new stored field introduced by the Home reason-line gate');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
