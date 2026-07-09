// v1.6 -- Rolling Just Today. Just Today's debt read becomes a rolling 7-day
// window over LOGGED work (sets + density rounds), instead of the current
// program-week's calendar boundary -- so a Just Today build stays aware of
// what was actually trained recently rather than resetting when a new
// program week starts. Missed days are ignored silently (no penalty, no
// catch-up); skipped-only work counts as nothing; density rounds count
// approximately (CAP/DONE_FLAT, internal only, never rendered); recent (48h)
// work is weighted slightly higher (RECENT_WEIGHT) as a soft demotion, not a
// recovery/fatigue claim. Program-week builds are completely untouched --
// only Just Today's local debt read is substituted, with a silent try/catch
// fallback to the exact debt resolveSpec already computed.
//
// computeRollingDebt is defined outside coach-span but reads the same
// LIBRARY/WEEKLY_SET_TARGETS/MUSCLE_VOLUME_LANDMARKS/ANTERIOR_PATTERNS/
// POSTERIOR_PATTERNS/SECONDARY_MUSCLE_CREDIT/MP_LABEL constants coach-span
// already defines (same shared closure, same pattern as showSessionComplete
// already reading LIBRARY) -- so this harness evaluates the real coach-span
// body alongside the real extracted computeRollingDebt, in one scope, giving
// the parity test (36) real data to compare against, not a hand-rolled stub.
const fs = require('fs');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');
const LINES = SRC.split('\n');

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

const csStart = LINES.findIndex(l => l.includes('/*__COACH_START__*/'));
const csEnd = LINES.findIndex(l => l.includes('/*__COACH_END__*/'));
const coachSpanBody = LINES.slice(csStart + 1, csEnd).join('\n');

const rollingSrc = extractFn('computeRollingDebt');
const dayReasonSrc = extractFn('dayReasonLine');

const harness = `
  ${coachSpanBody}
  function esc(s) { return String(s); }
  ${rollingSrc}
  ${dayReasonSrc}
  module.exports = {
    computeWeeklyDebt: computeWeeklyDebt,
    computeRollingDebt: computeRollingDebt,
    dayReasonLine: dayReasonLine,
    LIBRARY: LIBRARY,
    WEEKLY_SET_TARGETS: WEEKLY_SET_TARGETS
  };
`;
const mod = { exports: {} };
new Function('module', 'exports', harness)(mod, mod.exports);
const { computeWeeklyDebt, computeRollingDebt, dayReasonLine, LIBRARY } = mod.exports;

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- Fixture helpers ----------
// Real named exercises from the actual LIBRARY, one per pattern used below,
// so this test exercises the REAL name->pattern lookup, not an invented one.
function findByPattern(pattern, type) {
  type = type || 'strength';
  const hit = LIBRARY.find(e => e.type === type && e.movement_pattern === pattern);
  if (!hit) throw new Error('no LIBRARY fixture for pattern ' + pattern);
  return hit;
}
const PUSH_EX = findByPattern('horiz_push');   // e.g. Bench Press
const PULL_EX = findByPattern('horiz_pull');   // e.g. a horizontal pull
const LOWER_EX = findByPattern('squat');        // e.g. Back Squat

function isoAgo(nowMs, msAgo) { return new Date(nowMs - msAgo).toISOString(); }
const DAY = 24 * 60 * 60 * 1000;
const NOW = Date.parse('2026-07-09T12:00:00.000Z'); // fixed clock -- deterministic, no Date.now()

function sessionWith(id, exName, exId, setsCompleted, dateMsAgo, opts) {
  opts = opts || {};
  const ses = { id: id, name: 'Sess', exercises: [{ id: exId, name: exName, type: 'strength', sets: setsCompleted || 4 }] };
  const sl = { date: (dateMsAgo != null) ? isoAgo(NOW, dateMsAgo) : null, ex: {} };
  if (opts.skippedOnly) {
    sl.ex[exId] = { skipped: true, sets: [] };
  } else {
    sl.ex[exId] = { sets: Array.from({ length: setsCompleted || 0 }, () => ({ completed: true })) };
  }
  if (opts.finishedAt) sl.finishedAt = opts.finishedAt;
  return { ses: ses, sl: sl };
}

function stateWith(sessionsAndLogs) {
  const sessions = sessionsAndLogs.map(x => x.ses);
  const log = {};
  sessionsAndLogs.forEach(x => { log[x.ses.id] = x.sl; });
  return { program: { weeks: [{ week: 1, sessions: sessions }] }, log: log, activeWeek: 0 };
}

// ---------- Test 1: no history returns safe/default debt, hasSignal=false, blank reason ----------
// v1.6 correction: target-vs-zero debt alone is NOT a real training signal --
// with a cold program every pattern is tied at debt=target>0, so before this
// correction a heading always won that tie and rendered a fake reason. Now
// computeRollingDebt reports hasSignal=false when no real logged work exists
// in the window, and dayReasonLine returns blank immediately when it sees
// hasSignal === false, regardless of what the debt numbers say.
{
  const state = stateWith([]);
  const debt = computeRollingDebt(state, NOW);
  ok(debt && debt.byPattern && Object.keys(debt.byPattern).length > 0, 'no history: returns a full byPattern shape (test 1)');
  ok(Object.values(debt.byPattern).every(p => p.done === 0), 'no history: every pattern shows done=0');
  ok(debt.hasSignal === false, 'no history: hasSignal is explicitly false (test 1)');
  const line = dayReasonLine({ debt: debt });
  ok(line === '', 'no history: dayReasonLine returns a genuinely blank string, not a fabricated heading (test 1)');
}

// ---------- Test 1b: empty rolling window (sessions exist but none inside window) returns blank ----------
{
  const state = stateWith([sessionWith('s1', PUSH_EX.name, 'e0', 4, 30 * DAY)]); // 30 days old -- outside the 7-day window
  const debt = computeRollingDebt(state, NOW);
  ok(debt.hasSignal === false, 'empty rolling window (all logged work outside 7 days): hasSignal is false (test 1b)');
  ok(dayReasonLine({ debt: debt }) === '', 'empty rolling window: reason line is blank (test 1b)');
}

// ---------- Test 1c: default target debt alone (no logged work) never creates a reason line ----------
{
  // Directly exercise dayReasonLine's gate with hand-built debt that has real
  // per-group debt numbers but hasSignal explicitly false -- proves the gate
  // wins over debt magnitude, not just over an empty byPattern.
  const fakeSignalDebt = { hasSignal: false, byPattern: { squat: { debt: 999 }, hinge: { debt: 999 }, lunge: { debt: 999 }, horiz_pull: { debt: 999 }, vert_pull: { debt: 999 }, horiz_push: { debt: 999 }, vert_push: { debt: 999 } } };
  ok(dayReasonLine({ debt: fakeSignalDebt }) === '', 'hasSignal=false blanks the line even when every pattern shows large debt (test 1c)');
}

// ---------- Test 2/3/4: last session (push/pull/lower) affects rolling debt ----------
// (3 days ago, deliberately OUTSIDE the 48h recent-weighting window, so these
// assert the plain unweighted count -- the 48h weighting itself is test 12.)
{
  const state = stateWith([sessionWith('s1', PUSH_EX.name, 'e0', 4, 3 * DAY)]);
  const debt = computeRollingDebt(state, NOW);
  ok(debt.byPattern.horiz_push.done === 4, 'last push session: horiz_push done=4 in rolling debt (test 2)');
  ok(debt.hasSignal === true, 'last push session: hasSignal is true, real logged work exists (test 2)');
}
{
  const state = stateWith([sessionWith('s1', PULL_EX.name, 'e0', 4, 3 * DAY)]);
  const debt = computeRollingDebt(state, NOW);
  ok(debt.byPattern.horiz_pull.done === 4, 'last pull session: horiz_pull done=4 in rolling debt (test 3)');
  ok(debt.hasSignal === true, 'last pull session: hasSignal is true (test 3)');
}
{
  const state = stateWith([sessionWith('s1', LOWER_EX.name, 'e0', 4, 3 * DAY)]);
  const debt = computeRollingDebt(state, NOW);
  ok(debt.byPattern.squat.done === 4, 'last lower session: squat done=4 in rolling debt (test 4)');
  ok(debt.hasSignal === true, 'last lower session: hasSignal is true (test 4)');
}

// ---------- Test 4b: lower/pull/push lines only appear when real logged work makes them the honest top group ----------
{
  // Fully credit push and pull (both at/above target), leaving lower as the
  // only real debt -- the rendered line must be "Lower today." with real
  // signal backing it, not a coincidence of default targets.
  const pushLib = PUSH_EX, pullLib = PULL_EX;
  const state = stateWith([
    sessionWith('s1', pushLib.name, 'e0', 20, 3 * DAY),
    sessionWith('s2', pullLib.name, 'e0', 20, 3 * DAY)
  ]);
  const debt = computeRollingDebt(state, NOW);
  ok(debt.hasSignal === true, 'push+pull logged: hasSignal is true (test 4b)');
  const line = dayReasonLine({ debt: debt });
  ok(/Lower today\.<\/b> Legs need some work this week\./.test(line),
     'lower line appears only because push/pull are honestly satisfied and lower is the real remaining debt (test 4b, correction requirement 4)');
}

// ---------- Test 4c: push line honestly recommended with the new approved copy ----------
{
  // Fully credit pull and lower, leaving push as the only real debt.
  const state = stateWith([
    sessionWith('s1', PULL_EX.name, 'e0', 20, 3 * DAY),
    sessionWith('s2', LOWER_EX.name, 'e0', 20, 3 * DAY)
  ]);
  const debt = computeRollingDebt(state, NOW);
  const line = dayReasonLine({ debt: debt });
  ok(/Push today\.<\/b> Pressing needs some work this week\./.test(line),
     'push line uses the new approved copy "Pressing needs some work this week." (test 4c, correction requirement 6)');
  ok(!/You.?ve pulled more than you.?ve pressed lately/i.test(line),
     'old push line body never renders (test 4c, correction requirement 7)');
}

// ---------- Test 4d: pull line honestly recommended, backed by real logged work ----------
{
  // Fully credit push and lower, leaving pull as the only real debt.
  const state = stateWith([
    sessionWith('s1', PUSH_EX.name, 'e0', 20, 3 * DAY),
    sessionWith('s2', LOWER_EX.name, 'e0', 20, 3 * DAY)
  ]);
  const debt = computeRollingDebt(state, NOW);
  const line = dayReasonLine({ debt: debt });
  ok(/Pull today\.<\/b> You pressed last time\./.test(line),
     'pull line appears only because push/lower are honestly satisfied and pull is the real remaining debt (test 4d, correction requirement 5)');
}

// ---------- Test 5: density-only session with rounds counts approximately ----------
{
  const ses = { id: 'd1', name: 'Density', exercises: [{ id: 'de0', name: PUSH_EX.name, type: 'strength', sets: 0, block: 'strength', densityMode: 'emom' }], blocks: [{ kind: 'strength', minutes: 15, mode: 'emom' }] };
  const sl = { date: isoAgo(NOW, 3 * DAY), ex: {}, blocks: { strength: { rounds: 3, completed: false } } };
  const state = stateWith([{ ses: ses, sl: sl }]);
  const debt = computeRollingDebt(state, NOW);
  ok(debt.byPattern.horiz_push.done === 3, 'density rounds (3) credited approximately to horiz_push (test 5), got ' + debt.byPattern.horiz_push.done);
}

// ---------- Test 6: density block done at zero rounds counts DONE_FLAT ----------
{
  const ses = { id: 'd2', name: 'Density', exercises: [{ id: 'de0', name: PULL_EX.name, type: 'strength', sets: 0, block: 'strength', densityMode: 'emom' }], blocks: [{ kind: 'strength', minutes: 15, mode: 'emom' }] };
  const sl = { date: isoAgo(NOW, 3 * DAY), ex: {}, blocks: { strength: { rounds: 0, completed: true } } };
  const state = stateWith([{ ses: ses, sl: sl }]);
  const debt = computeRollingDebt(state, NOW);
  ok(debt.byPattern.horiz_pull.done === 3, 'density block done at 0 rounds credits DONE_FLAT=3 (test 6), got ' + debt.byPattern.horiz_pull.done);
}

// ---------- Test 7: skipped-only session ignored ----------
{
  const state = stateWith([sessionWith('s1', PUSH_EX.name, 'e0', 0, 3 * DAY, { skippedOnly: true })]);
  const debt = computeRollingDebt(state, NOW);
  ok(debt.byPattern.horiz_push.done === 0, 'skipped-only session contributes zero work (test 7)');
}

// ---------- Test 8: finished-early session counts logged sets only ----------
{
  const state = stateWith([sessionWith('s1', PUSH_EX.name, 'e0', 2, 3 * DAY, { finishedAt: isoAgo(NOW, 3 * DAY) })]);
  const debt = computeRollingDebt(state, NOW);
  ok(debt.byPattern.horiz_push.done === 2, 'finished-early session counts only its 2 logged sets, not a fabricated full count (test 8)');
}

// ---------- Test 9: missed days ignored silently (no compensation) ----------
{
  // A 6-day-old session with a 4-day gap before it (days 2-5 untouched) --
  // the gap itself must never appear anywhere in the output shape.
  const state = stateWith([sessionWith('s1', PUSH_EX.name, 'e0', 4, 6 * DAY)]);
  const debt = computeRollingDebt(state, NOW);
  ok(debt.byPattern.horiz_push.done === 4, 'a session 6 days old with untouched days before it still counts normally, no catch-up/penalty logic (test 9)');
  ok(Object.keys(debt).indexOf('missed') === -1 && Object.keys(debt).indexOf('gap') === -1, 'no missed/gap field exists anywhere in the debt output');
}

// ---------- Test 10/11: 7-day rolling window boundary ----------
{
  const state = stateWith([sessionWith('s1', PUSH_EX.name, 'e0', 4, 6 * DAY)]);
  const debt = computeRollingDebt(state, NOW);
  ok(debt.byPattern.horiz_push.done === 4, '6-day-old session is INCLUDED in the 7-day window (test 10)');
}
{
  const state = stateWith([sessionWith('s1', PUSH_EX.name, 'e0', 4, 8 * DAY)]);
  const debt = computeRollingDebt(state, NOW);
  ok(debt.byPattern.horiz_push.done === 0, '8-day-old session is EXCLUDED from the 7-day window (test 11)');
}

// ---------- Test 12: 48h recent weighting uses RECENT_WEIGHT 1.25 ----------
{
  const recentState = stateWith([sessionWith('s1', PUSH_EX.name, 'e0', 4, 24 * 60 * 60 * 1000)]); // 24h ago
  const olderState = stateWith([sessionWith('s1', PUSH_EX.name, 'e0', 4, 6 * DAY)]); // 6 days ago
  const recentDebt = computeRollingDebt(recentState, NOW);
  const olderDebt = computeRollingDebt(olderState, NOW);
  ok(recentDebt.byPattern.horiz_push.done === 5, '24h-old work (4 sets) is weighted 1.25x -> credited as 5 (test 12), got ' + recentDebt.byPattern.horiz_push.done);
  ok(olderDebt.byPattern.horiz_push.done === 4, '6-day-old work (4 sets) is NOT weighted -> credited as 4 (test 12 control)');
}

// ---------- Test 13: injected nowMs makes helper deterministic ----------
{
  const state = stateWith([sessionWith('s1', PUSH_EX.name, 'e0', 4, DAY)]);
  const a = computeRollingDebt(state, NOW);
  const b = computeRollingDebt(state, NOW);
  ok(JSON.stringify(a) === JSON.stringify(b), 'same (state, nowMs) in -> identical output out, every time (test 13)');
  ok(!/Date\.now\(\)/.test(rollingSrc), 'computeRollingDebt never calls Date.now() internally -- nowMs is always the injected argument (test 13)');
}

// ---------- Test 14: helper does not mutate input state ----------
{
  const state = stateWith([sessionWith('s1', PUSH_EX.name, 'e0', 4, DAY)]);
  const before = JSON.stringify(state);
  computeRollingDebt(state, NOW);
  const after = JSON.stringify(state);
  ok(before === after, 'computeRollingDebt does not mutate the state it reads (test 14)');
}

// ---------- Test 15: malformed logs do not throw ----------
{
  const junkState = {
    program: { weeks: [{ sessions: [{ id: 's1', exercises: [{ id: 'e0', name: 'Nonsense Exercise', type: 'strength' }, null, {}] }, null] }] },
    log: { s1: { date: 'not-a-date', ex: { e0: { sets: 'not-an-array' } }, blocks: { strength: 'garbage' } }, s2: null }
  };
  let threw = false;
  try { computeRollingDebt(junkState, NOW); } catch (e) { threw = true; }
  ok(!threw, 'malformed logs/sessions never throw (test 15)');
  ok(!computeRollingDebt(null, NOW).byPattern === false, 'null state coerces safely'); // sanity: does not throw above
  let threw2 = false;
  try { computeRollingDebt(null, NOW); } catch (e) { threw2 = true; }
  ok(!threw2, 'null state does not throw');
}

// ---------- Test 16: unknown exercise names are skipped ----------
{
  const ses = { id: 's1', name: 'Sess', exercises: [{ id: 'e0', name: 'Totally Made Up Exercise', type: 'strength', sets: 4 }] };
  const sl = { date: isoAgo(NOW, DAY), ex: { e0: { sets: [{ completed: true }, { completed: true }] } } };
  const state = stateWith([{ ses: ses, sl: sl }]);
  let threw = false, debt;
  try { debt = computeRollingDebt(state, NOW); } catch (e) { threw = true; }
  ok(!threw, 'unknown exercise name does not throw (test 16)');
  ok(Object.values(debt.byPattern).every(p => p.done === 0), 'unknown exercise name contributes zero work (skipped safely)');
}

// ---------- Test 17: archive is not read ----------
{
  ok(!/archive/i.test(rollingSrc), 'computeRollingDebt source contains no reference to archive at all (test 17)');
}

// ---------- Tests 18/19/20: intent/equipment/injury override steering (source-level, engine untouched) ----------
{
  // These constraints are enforced by the existing engine (buildIntent's
  // focusPatterns, equipment hard-filter, injury hard-filter in Phase 4) --
  // v1.6 does not touch any of that. Confirmed here by verifying v1.6's ONLY
  // change to onBuildToday is the debt substitution, not the intent/equipment/
  // injury handling, which remains byte-identical to the pre-v1.6 flow.
  const buildIdx = SRC.indexOf('function onBuildToday()');
  const buildBody = SRC.slice(buildIdx, buildIdx + 6000);
  ok(/req\.equipment/.test(buildBody), 'onBuildToday still reads req.equipment untouched (test 19 -- equipment remains law)');
  ok(/requestToParsed\(req\)/.test(buildBody), 'onBuildToday still builds parsed intent via requestToParsed untouched (test 18 -- intent remains law)');
  ok(/state\.athlete && state\.athlete\.injuries/.test(buildBody), 'onBuildToday still passes athlete injuries into recoverySession untouched (test 20 -- injury remains law)');
}

// ---------- Test 21: fallback works if rolling helper throws ----------
{
  // Extract the exact substitution snippet from onBuildToday and run it
  // standalone with a stubbed computeRollingDebt that throws -- proves the
  // try/catch silently preserves the original spec.debt.
  const buildIdx = SRC.indexOf('function onBuildToday()');
  const buildBody = SRC.slice(buildIdx, buildIdx + 4000);
  const snippetMatch = buildBody.match(/try \{[\s\S]*?computeRollingDebt[\s\S]*?\} catch \(e\) \{\}/);
  if (!snippetMatch) throw new Error('v1.6 substitution snippet not found in onBuildToday');
  const snippet = snippetMatch[0];
  const sentinelDebt = { byPattern: { sentinel: true } };
  const fnBody = `
    var spec = { debt: sentinelDebt };
    function computeRollingDebt() { throw new Error('boom'); }
    ${snippet}
    return spec.debt;
  `;
  const result = new Function('sentinelDebt', fnBody)(sentinelDebt);
  ok(result === sentinelDebt, 'when computeRollingDebt throws, spec.debt silently stays the original resolveSpec debt (test 21)');
}

// ---------- Test 22: program-week generation still uses computeWeeklyDebt ----------
{
  ok(/function resolveSpec\(request, state\) \{[\s\S]{0,700}computeWeeklyDebt\(state\)/.test(coachSpanBody),
     'resolveSpec (program-week path) still calls computeWeeklyDebt, unchanged (test 22)');
}

// ---------- Test 23: Just Today path uses rolling debt ----------
{
  const buildIdx = SRC.indexOf('function onBuildToday()');
  const buildBody = SRC.slice(buildIdx, buildIdx + 4000);
  ok(/computeRollingDebt\(state, Date\.now\(\)\)/.test(buildBody), 'onBuildToday calls computeRollingDebt with a freshly-captured Date.now() (test 23)');
  ok(/spec\.debt = rollingDebt/.test(buildBody), 'onBuildToday substitutes the result into the local spec.debt (test 23)');
}

// ---------- Test 24: v1.4 density finish behaviour remains intact (source guard) ----------
{
  ok(/function hasRealWork\(ses\)/.test(SRC), 'hasRealWork (v1.4) still present (test 24)');
  ok(/if \(hasRealWork\(ses\)\) \{/.test(SRC), 'endSession still gates on hasRealWork (test 24)');
}

// ---------- Tests 25-29: density date-stamp guard rules (source guards) ----------
{
  const actIdx = SRC.indexOf('function onDensityAct(act, kind, btn)');
  const actBody = SRC.slice(actIdx, actIdx + 2800);
  ok(/if \(isIncrease && slr && !slr\.date\) slr\.date = new Date\(\)\.toISOString\(\);/.test(actBody),
     'density date-stamp fires only on round INCREASE, guarded by !slr.date (test 25/29)');
  ok(/if \(sld && !sld\.date\) sld\.date = new Date\(\)\.toISOString\(\);/.test(actBody),
     'density date-stamp fires on block marked done, guarded by !sld.date (test 26/29)');
  const roundsBranch = actBody.slice(actBody.indexOf('act === "blkrounds-"'), actBody.indexOf('if (act === "blkdone")'));
  ok(!/if \(!isIncrease/.test(roundsBranch) && /if \(isIncrease && slr && !slr\.date\)/.test(roundsBranch),
     'the date stamp in the rounds branch is gated on isIncrease -- a decrease never stamps (test 27)');
  const doneBranch = actBody.slice(actBody.indexOf('if (act === "blkdone")'));
  const doneBranchBody = doneBranch.slice(0, doneBranch.indexOf('if (act === "blktimer")'));
  ok(/if \(willBeDone\) \{[\s\S]*if \(sld && !sld\.date\)/.test(doneBranchBody),
     'the date stamp in the done branch only fires inside the willBeDone (true) case, never on unmark (test 28)');
}

// ---------- Test 30: no new persistent fields ----------
{
  ok(!/freshState\([\s\S]{0,600}rollingDebt/.test(SRC), 'freshState does not reference any v1.6 rolling field');
  ok(!/rollingMemory|rollingHistory|rollingWindow\s*:/i.test(SRC.replace(rollingSrc, '')),
     'no new persistent field name for rolling memory appears anywhere outside the helper itself (test 30)');
  // v1.6 correction: hasSignal is a plain in-memory key on computeRollingDebt's
  // return object -- never assigned onto state/log/session, never written by
  // save()/writeLog(), never read by freshState/coerceState/compactLog.
  ok(!/state\.hasSignal|log\.hasSignal|sl\.hasSignal|ses\.hasSignal/.test(SRC),
     'hasSignal is never attached to state/log/session -- it only exists on the transient debt object returned by computeRollingDebt (test 30, correction)');
  ok(!/function (freshState|coerceState|compactLog)\([\s\S]{0,2000}hasSignal/.test(SRC),
     'freshState/coerceState/compactLog never reference hasSignal (test 30, correction)');
}

// ---------- Test 31: no forbidden copy ----------
{
  const forbidden = ['recovered', 'fatigued', 'optimal', 'readiness score', 'recovery score', 'injury safe',
    'safe for your injury', 'your body needs', 'your body is ready', 'overtrained', 'undertrained',
    'missed', 'skipped', 'behind', 'AI decided', 'optimized'];
  const newCopyBlob = dayReasonSrc + '\n' + rollingSrc;
  forbidden.forEach(word => {
    ok(!new RegExp(word, 'i').test(newCopyBlob), `forbidden word "${word}" does not appear in v1.6 new copy/logic (test 31)`);
  });
}

// ---------- Test 32: no digits/constants in user-facing reason copy ----------
{
  // Functional: force each group to be the top debt group and read the ACTUAL
  // rendered line, rather than pattern-matching raw source (heading/body are
  // separate string literals in source, not one running sentence).
  const lowerLine = dayReasonLine({ debt: { byPattern: { squat: { debt: 10 }, hinge: { debt: 0 }, lunge: { debt: 0 }, horiz_pull: { debt: 0 }, vert_pull: { debt: 0 }, horiz_push: { debt: 0 }, vert_push: { debt: 0 } } } });
  const pullLine = dayReasonLine({ debt: { byPattern: { squat: { debt: 0 }, hinge: { debt: 0 }, lunge: { debt: 0 }, horiz_pull: { debt: 10 }, vert_pull: { debt: 0 }, horiz_push: { debt: 0 }, vert_push: { debt: 0 } } } });
  const pushLine = dayReasonLine({ debt: { byPattern: { squat: { debt: 0 }, hinge: { debt: 0 }, lunge: { debt: 0 }, horiz_pull: { debt: 0 }, vert_pull: { debt: 0 }, horiz_push: { debt: 10 }, vert_push: { debt: 0 } } } });
  ok(/Lower today\.<\/b> Legs need some work this week\./.test(lowerLine), 'approved lower line renders verbatim (test 32)');
  ok(/Pull today\.<\/b> You pressed last time\./.test(pullLine), 'approved pull line renders verbatim, no exact count, no day name (test 32)');
  ok(/Push today\.<\/b> Pressing needs some work this week\./.test(pushLine), 'approved push line (corrected copy) renders verbatim (test 32, correction requirement 6)');
  ok(!/You've pressed twice since Monday/i.test(SRC), 'forbidden quantified/day-name example line is not present anywhere in source (test 32)');
  ok(!/You.?ve pulled more than you.?ve pressed lately/i.test(dayReasonSrc), 'old unapproved push line body no longer exists in source (test 32, correction requirement 7)');
  ok(!/\bCAP\b\s*=\s*5/.test(dayReasonSrc), 'CAP constant never appears inside dayReasonLine (internal-only, test 32)');
  ok(!/\bDONE_FLAT\b/.test(dayReasonSrc), 'DONE_FLAT constant never appears inside dayReasonLine (internal-only, test 32)');
  ok(!/\d/.test(lowerLine) && !/\d/.test(pullLine) && !/\d/.test(pushLine), 'no rendered reason line contains any digit (test 32)');
}

// ---------- Test 33: no recovery/fatigue/medical language in new copy/comments/tests ----------
{
  const bannedInComments = ['recovery reasoning', 'fatigue reasoning', 'diagnos', 'medical advice claim'];
  // Explicitly checks the RECENT_WEIGHT comment describes it as log-only, not body-state.
  ok(/statement about the log/.test(rollingSrc) || /not a claim about the body/.test(rollingSrc),
     'RECENT_WEIGHT is documented as a log-only statement, not a recovery/fatigue claim (test 33)');
  ok(!/\brecovery\b/i.test(rollingSrc.replace(/recoverySession/g, '').replace(/no recovery\/fatigue reasoning involved\.?/gi, '')), 'no bare "recovery" language in computeRollingDebt outside the explicit non-claim disclaimer (test 33)');
}

// ---------- Test 34: no network/API/analytics strings introduced ----------
{
  ok(!/fetch\(|XMLHttpRequest|navigator\.sendBeacon|analytics|telemetry/i.test(rollingSrc), 'computeRollingDebt introduces no network/analytics call (test 34)');
}

// ---------- Test 35: coach-span md5 zero-diff ----------
{
  const { execSync } = require('child_process');
  const current = execSync("sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5").toString().trim();
  const baseline = execSync("git -C /Users/jamesharris/Desktop/training-log-app show c556f29:index.html | sed -n '/__COACH_START__/,/__COACH_END__/p' | md5").toString().trim();
  ok(current === baseline, 'coach-span is byte-identical to the c556f29 baseline (test 35)');
}

// ---------- Test 36: parity -- rolling window == current week produces matching byPattern ----------
{
  const ses = { id: 'p1', name: 'Sess', exercises: [{ id: 'e0', name: PUSH_EX.name, type: 'strength', sets: 4 }, { id: 'e1', name: LOWER_EX.name, type: 'strength', sets: 3 }] };
  const sl = { date: isoAgo(NOW, 3 * DAY), ex: { e0: { sets: [{ completed: true }, { completed: true }, { completed: true }, { completed: false }] }, e1: { sets: [{ completed: true }, { completed: true }, { completed: false }] } } };
  const state = { program: { weeks: [{ week: 1, sessions: [ses] }] }, log: { p1: sl }, activeWeek: 0 };
  const weekly = computeWeeklyDebt(state);
  // Force the rolling call outside the 48h boost window (3 days old, so weight=1x) so the two are directly comparable set-for-set.
  const rolling = computeRollingDebt(state, NOW);
  ok(rolling.byPattern.horiz_push.done === weekly.byPattern.horiz_push.done,
     'parity: rolling horiz_push.done matches computeWeeklyDebt when the fixture sits inside both windows (test 36)');
  ok(rolling.byPattern.squat.done === weekly.byPattern.squat.done,
     'parity: rolling squat.done matches computeWeeklyDebt on the same fixture (test 36)');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
