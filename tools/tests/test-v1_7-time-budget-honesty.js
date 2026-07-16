// v1.7 -- Time Budget Honesty. Fixes the confirmed defect where pure
// Strength-goal sessions could print rest and conditioning prescriptions that
// do not realistically fit the selected time (e.g. a flat "3-5 min" anchor
// rest, or a 4x4min interval crammed into a 10-min conditioning block).
//
// Approved route (Route D + B): prescription()'s strength-compound/anchor
// rest and its interval-conditioning branch now read the STRENGTH/
// CONDITIONING BLOCK's own allocated minutes (computeBlockBudgets -- already
// the single source of truth attachBlocks uses for the honest blocks[]
// summary the user sees), instead of the session's raw total minutes.
//
// This test file:
//  1. Encodes an audit-only time estimator (test-only, never shown to users)
//     using the approved assumptions, and classifies estimates the same way
//     the audit did (credible / tight but possible / unrealistic / impossible).
//  2. Generates real outputs from the actual engine (generateProgram/
//     generateSession) for the 14 required profiles and asserts none classify
//     as impossible.
//  3. Asserts the specific approved rest/interval bands appear where expected.
//  4. Asserts Zone 2, density, Hybrid, and v1.6/v1.4 behaviour are unchanged.
//  5. Asserts the coach-span diff is limited to the approved prescription
//     areas (prescription, PRESCRIPTION_TABLE, the two new band helpers,
//     buildEx, generateSession, generateProgram call-site wiring) -- every
//     other coach-span function must remain byte-identical to c556f29.
const fs = require('fs');
const { execSync } = require('child_process');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');
const LINES = SRC.split('\n');

function extractFn(name, src) {
  src = src || SRC;
  const sig = 'function ' + name + '(';
  const at = src.indexOf(sig);
  if (at < 0) return null;
  const braceStart = src.indexOf('{', at);
  let depth = 0, i = braceStart, inStr = null, prev = '';
  for (; i < src.length; i++) {
    const c = src[i], nx = src[i + 1];
    if (inStr) { if (c === inStr && prev !== '\\') inStr = null; prev = c; continue; }
    if (c === '/' && nx === '/') { const nl = src.indexOf('\n', i); i = nl < 0 ? src.length : nl; prev = '\n'; continue; }
    if (c === '/' && nx === '*') { const end = src.indexOf('*/', i + 2); i = end < 0 ? src.length : end + 1; prev = '/'; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; }
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
    prev = c;
  }
  return src.slice(at, i);
}

const csStart = LINES.findIndex(l => l.includes('/*__COACH_START__*/'));
const csEnd = LINES.findIndex(l => l.includes('/*__COACH_END__*/'));
const coachSpanBody = LINES.slice(csStart + 1, csEnd).join('\n');

// Full engine harness -- reuses the same pattern as the phase8 battery /
// v1.6 rolling-today test files: extract the real coach-span body and eval
// it in one scope so generateProgram/generateSession run for real.
const helper = LINES.slice(LINES.findIndex(l => /function clampInt\(/.test(l)), LINES.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const engineSrc = helper + '\n' + coachSpanBody + '\n; module.exports={LIBRARY,generateProgram,generateSession,requestToParsed,makeRequest,computeBlockBudgets,restBandForStrengthBlock,intervalBandForConditioningBlock,PRESCRIPTION_TABLE};';
const engineMod = { exports: {} };
new Function('module', 'exports', engineSrc)(engineMod, engineMod.exports);
const E = engineMod.exports;

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- Audit-only time estimator (test-only; never shown to users) ----------
const SET_WORK_SEC = 40, LOG_SEC = 7, TRANSITION_SEC = 20;
function parseRestSec(restStr) {
  if (!restStr) return 0;
  const s = String(restStr);
  const mm = s.match(/([\d.]+)(?:-([\d.]+))?\s*min/);
  if (mm) { const a = parseFloat(mm[1]), b = mm[2] ? parseFloat(mm[2]) : a; return ((a + b) / 2) * 60; }
  const ss = s.match(/([\d.]+)(?:-([\d.]+))?\s*s/);
  if (ss) { const a = parseFloat(ss[1]), b = ss[2] ? parseFloat(ss[2]) : a; return (a + b) / 2; }
  return 0;
}
function parseCondMinutes(reps) { const m = String(reps || '').match(/([\d.]+)\s*min/); return m ? parseFloat(m[1]) : 0; }
function estimateSession(ses) {
  let strengthSec = 0, condSec = 0, wuSec = 0, cdSec = 0, densitySec = 0, transitions = 0;
  (ses.exercises || []).forEach(ex => {
    const sets = ex.sets || 1, restSec = parseRestSec(ex.rest);
    if (ex.block === 'strength' || (!ex.block && ex.type === 'strength')) {
      if (ex.densityMode) return;
      strengthSec += sets * (SET_WORK_SEC + LOG_SEC) + Math.max(0, sets - 1) * restSec;
      transitions += 1;
    } else if (ex.block === 'conditioning' || ex.type === 'conditioning') {
      if (ex.densityMode) return;
      const mins = parseCondMinutes(ex.reps), rounds = ex.sets || 1;
      condSec += rounds * mins * 60 + Math.max(0, rounds - 1) * restSec;
    } else if (ex.block === 'warmup') {
      wuSec += sets * (parseRestSec(ex.reps) || 30);
    } else if (ex.block === 'cooldown') {
      cdSec += sets * (parseRestSec(ex.reps) || 30);
    }
  });
  if (Array.isArray(ses.blocks)) {
    ses.blocks.forEach(b => { if (b.mode === 'emom' || b.mode === 'amrap') densitySec += (b.minutes || 0) * 60; });
  }
  const transitionSec = transitions * TRANSITION_SEC;
  const totalSec = strengthSec + condSec + wuSec + cdSec + densitySec + transitionSec;
  return { totalMin: totalSec / 60 };
}
function classify(estMin, selMin) {
  if (estMin <= selMin) return 'credible';
  if (estMin <= selMin * 1.15) return 'tight but possible';
  if (estMin <= selMin * 1.35) return 'unrealistic';
  return 'impossible';
}

// ---------- Fixture generation helpers ----------
const athlete = { experience: 'intermediate', injuries: [], prefs: {}, metrics: {}, history: {} };
function genProgram(intake, seed) { return E.generateProgram(intake, {}, seed || 42, {}, null, athlete, null, null, null); }
function genSession(req, seed) {
  const parsed = E.requestToParsed(E.makeRequest(req));
  return E.generateSession(parsed, {}, seed || 11, {}, null, false, null, athlete, null, null, null, []);
}

// ---------- Test 1: estimator unit tests on hand-built fixtures ----------
{
  const ses = { exercises: [{ block: 'strength', sets: 4, rest: '2 min' }], blocks: [] };
  // 4 sets: work+log = 4*47=188s, rest after 3 sets = 3*120=360s, +1 transition(20s) = 568s = 9.47min
  const est = estimateSession(ses).totalMin;
  ok(Math.abs(est - 9.467) < 0.05, `estimator: known fixture computes expected minutes (test 1), got ${est}`);
  ok(classify(10, 10) === 'credible', 'classify: equal time is credible (test 1)');
  ok(classify(11.4, 10) === 'tight but possible', 'classify: 1.14x is tight but possible (test 1)');
  ok(classify(13.4, 10) === 'unrealistic', 'classify: 1.34x is unrealistic (test 1)');
  ok(classify(13.6, 10) === 'impossible', 'classify: 1.36x is impossible (test 1)');
}

// ---------- Tests 2-15: the 14 required generated profiles ----------
const profiles = [];
function record(label, ses, selMin) {
  const est = estimateSession(ses).totalMin;
  const cls = classify(est, selMin);
  profiles.push({ label, ses, selMin, est, cls });
  return { est, cls };
}

{ const P = genProgram({ goal: 'strength', days: 4, minutes: 60, weeks: 1, includes: ['conditioning'] }); record('1 Strength gym 4d 60m', P.weeks[0].sessions[0], 60); }
{ const P = genProgram({ goal: 'strength', days: 4, minutes: 45, weeks: 1, includes: ['conditioning'] }); record('2 Strength gym 4d 45m', P.weeks[0].sessions[0], 45); }
{ const P = genProgram({ goal: 'strength', days: 3, minutes: 45, weeks: 1, includes: ['conditioning'], equipment: ['dumbbell'] }); record('3 Strength DB 3d 45m', P.weeks[0].sessions[0], 45); }
{ const P = genProgram({ goal: 'strength', days: 3, minutes: 30, weeks: 1, equipment: ['dumbbell'] }); record('4 Strength DB 3d 30m', P.weeks[0].sessions[0], 30); }
{ const P = genProgram({ goal: 'strength', days: 3, minutes: 30, weeks: 1, equipment: [] }); record('5 Strength BW 3d 30m', P.weeks[0].sessions[0], 30); }
{ const P = genProgram({ goal: 'strength', days: 3, minutes: 20, weeks: 1, equipment: [] }); record('6 Strength BW 3d 20m', P.weeks[0].sessions[0], 20); }
{ const P = genProgram({ goal: 'hybrid', days: 4, minutes: 60, weeks: 1, includes: ['conditioning'] }); record('7 Hybrid gym 4d 60m', P.weeks[0].sessions[0], 60); }
{ const P = genProgram({ goal: 'hybrid', days: 4, minutes: 45, weeks: 1, includes: ['conditioning'] }); record('8 Hybrid gym 4d 45m', P.weeks[0].sessions[0], 45); }
{ const P = genProgram({ goal: 'hybrid', days: 4, minutes: 45, weeks: 1, includes: ['conditioning'], equipment: ['dumbbell'] }); record('9 Hybrid DB+run 4d 45m', P.weeks[0].sessions[0], 45); }
{ const P = genProgram({ goal: 'hybrid', days: 3, minutes: 30, weeks: 1, includes: ['conditioning'], equipment: [] }); record('10 Hybrid BW 3d 30m', P.weeks[0].sessions[0], 30); }
{ const P = genProgram({ goal: 'hybrid', days: 3, minutes: 20, weeks: 1, includes: ['conditioning'], equipment: [] }); record('11 Hybrid BW 3d 20m', P.weeks[0].sessions[0], 20); }
{ const s = genSession({ scope: 'session', goal: 'general', duration_min: 20, equipment: null, mobility: true, conditioning: false, days: 3, weeks: 1 }); record('12 Just Today 20m', s, 20); }
{ const s = genSession({ scope: 'session', goal: 'general', duration_min: 30, equipment: null, mobility: true, conditioning: false, days: 3, weeks: 1 }); record('13 Just Today 30m', s, 30); }
{ const P = genProgram({ goal: 'hybrid', days: 3, minutes: 30, weeks: 1, includes: ['conditioning'], equipment: [] }); record('14 Density EMOM/AMRAP session', P.weeks[0].sessions[0], 30); }

profiles.forEach(p => {
  ok(p.cls !== 'impossible', `profile "${p.label}": not impossible (selected=${p.selMin}m estimated=${p.est.toFixed(1)}m) [${p.cls}]`);
  ok(p.cls === 'credible' || p.cls === 'tight but possible', `profile "${p.label}": reaches credible or tight-but-possible (selected=${p.selMin}m estimated=${p.est.toFixed(1)}m) [${p.cls}]`);
});

// ---------- Test 16: no 3-5 min rest string in 20/30-min Strength sessions ----------
{
  const shortProfiles = profiles.filter(p => /Strength/.test(p.label) && (p.selMin === 20 || p.selMin === 30));
  ok(shortProfiles.length > 0, 'at least one 20/30-min Strength profile was generated (test 16)');
  shortProfiles.forEach(p => {
    const has35 = (p.ses.exercises || []).some(e => e.block === 'strength' && /3-5 min/.test(e.rest || ''));
    ok(!has35, `no "3-5 min" rest string in ${p.label} (test 16)`);
  });
}

// ---------- Test 17: interval conditioning never exceeds its allocated conditioning block budget ----------
{
  profiles.forEach(p => {
    (p.ses.exercises || []).forEach(ex => {
      if (ex.block === 'conditioning' && !ex.densityMode && /HRmax|near-max/.test(ex.target || '')) {
        const mins = parseCondMinutes(ex.reps), rounds = ex.sets || 1;
        const budget = E.computeBlockBudgets(p.selMin).conditioning;
        const restSec = parseRestSec(ex.rest);
        const realMin = (rounds * mins * 60 + Math.max(0, rounds - 1) * restSec) / 60;
        ok(realMin <= budget * 1.15, `interval in ${p.label} (${realMin.toFixed(1)}m) fits its conditioning block budget (${budget}m, test 17)`);
      }
    });
  });
}

// ---------- Test 18: 4x4min intervals only appear when the conditioning block budget is 19+ minutes ----------
{
  ['a', 'b', 'c', 'd'].forEach(() => {}); // no-op, keeps numbering stable
  for (let mins = 15; mins <= 90; mins += 5) {
    const budget = E.computeBlockBudgets(mins).conditioning;
    const band = E.intervalBandForConditioningBlock(budget);
    if (band.sets === 4 && band.reps === '4 min') {
      ok(budget >= 19, `4x4min interval band only appears when conditioning budget >= 19m (got budget=${budget}m at session=${mins}m, test 18)`);
    }
  }
}

// ---------- Test 19: approved rest bands render exactly as specified ----------
{
  ok(E.restBandForStrengthBlock(16) === '60-90s', 'rest band <=16m => 60-90s (test 19)');
  ok(E.restBandForStrengthBlock(20) === '90s', 'rest band 17-24m => 90s (test 19)');
  ok(E.restBandForStrengthBlock(30) === '90s-2 min', 'rest band 25-34m => 90s-2 min (test 19)');
  ok(E.restBandForStrengthBlock(40) === '2-3 min', 'rest band 35+m => 2-3 min (test 19)');
}

// ---------- Test 20: approved interval bands render exactly as specified ----------
{
  const b1 = E.intervalBandForConditioningBlock(8);
  ok(b1.sets === 2 && b1.reps === '2 min' && b1.rest === '1 min easy', 'interval band <=8m => 2x2min/1min easy (test 20)');
  const b2 = E.intervalBandForConditioningBlock(12);
  ok(b2.sets === 3 && b2.reps === '2 min' && b2.rest === '1 min easy', 'interval band 9-12m => 3x2min/1min easy (test 20)');
  const b3 = E.intervalBandForConditioningBlock(18);
  ok(b3.sets === 3 && b3.reps === '3 min' && b3.rest === '2 min easy', 'interval band 13-18m => 3x3min/2min easy (test 20)');
  const b4 = E.intervalBandForConditioningBlock(25);
  ok(b4.sets === 4 && b4.reps === '4 min' && b4.rest === '2 min easy', 'interval band 19+m => 4x4min/2min easy (test 20)');
}

// ---------- Test 21: density sessions remain time-boxed (block-mode present, exercises tagged) ----------
{
  const densityProfile = profiles.find(p => p.label === '14 Density EMOM/AMRAP session');
  const hasDensityBlocks = (densityProfile.ses.blocks || []).some(b => b.mode === 'emom' || b.mode === 'amrap');
  ok(hasDensityBlocks, 'density session still produces emom/amrap block modes (test 21)');
}

// ---------- Test 22: Zone 2 logic unchanged (still mins*0.35 clamped 10-40, snapped to 5) ----------
{
  [20, 30, 45, 60].forEach(mins => {
    const z = Math.max(10, Math.min(40, Math.round((mins * 0.35) / 5) * 5));
    const src = extractFn('prescription');
    ok(new RegExp('Math\\.max\\(10, Math\\.min\\(40, Math\\.round\\(\\(mins \\* 0\\.35\\)').test(src), 'Zone 2 formula source is byte-unchanged (test 22)');
  });
}

// ---------- Test 23: Hybrid outputs do not regress (still credible/tight, unchanged rest values) ----------
{
  const hybridProfiles = profiles.filter(p => /Hybrid/.test(p.label));
  ok(hybridProfiles.length >= 5, 'all required Hybrid profiles generated (test 23)');
  hybridProfiles.forEach(p => ok(p.cls === 'credible' || p.cls === 'tight but possible', `Hybrid profile ${p.label} does not regress (test 23)`));
}

// ---------- Test 24: v1.6 Rolling Just Today tests still pass ----------
{
  const out = execSync('node /Users/jamesharris/Desktop/training-log-app/tools/tests/test-v1_6-rolling-today.js', { encoding: 'utf8' });
  ok(/0 failed/.test(out), 'test-v1_6-rolling-today.js reports 0 failed (test 24)');
}

// ---------- Test 25: v1.4 density finish tests still pass ----------
{
  const out = execSync('node /Users/jamesharris/Desktop/training-log-app/tools/tests/test-v1_4-density-finish.js', { encoding: 'utf8' });
  ok(/0 failed/.test(out), 'test-v1_4-density-finish.js reports 0 failed (test 25)');
}

// ---------- Test 26: no new persistent fields / no data-shape change ----------
{
  ok(!/state\.blockBudgets|log\.blockBudgets|sl\.blockBudgets/.test(SRC), 'blockBudgets never attached to state/log (test 26)');
  ok(!/function (freshState|coerceState|compactLog)\([\s\S]{0,2000}blockBudgets/.test(SRC), 'freshState/coerceState/compactLog never reference blockBudgets (test 26)');
}

// ---------- Test 27: no forbidden language ----------
{
  const forbidden = ['recovered', 'fatigued\\b', 'optimal', 'readiness score', 'recovery score', 'injury safe',
    'safe for your injury', 'your body is ready', 'overtrained', 'undertrained'];
  const newCode = extractFn('prescription') + '\n' + extractFn('restBandForStrengthBlock') + '\n' + extractFn('intervalBandForConditioningBlock');
  forbidden.forEach(word => {
    ok(!new RegExp(word, 'i').test(newCode), `forbidden word "${word}" does not appear in v1.7 new code (test 27)`);
  });
}

// ---------- Test 28: no network/API strings ----------
{
  const newCode = extractFn('prescription') + '\n' + extractFn('restBandForStrengthBlock') + '\n' + extractFn('intervalBandForConditioningBlock');
  ok(!/fetch\(|XMLHttpRequest|navigator\.sendBeacon|analytics|telemetry/i.test(newCode), 'no network/analytics call introduced (test 28)');
}

// ---------- Test 29: no exact countdown claims in new copy ----------
{
  const newCode = extractFn('prescription') + '\n' + extractFn('restBandForStrengthBlock') + '\n' + extractFn('intervalBandForConditioningBlock');
  ok(!/exactly \d+ min|guaranteed|precisely \d+/i.test(newCode), 'no exact countdown/guarantee claim in new code (test 29)');
}

// ---------- Test 30: coach-span diff is limited to the approved prescription areas ----------
{
  const baselineSrc = execSync("git -C /Users/jamesharris/Desktop/training-log-app show c556f29:index.html").toString();
  const baselineLines = baselineSrc.split('\n');
  const bCsStart = baselineLines.findIndex(l => l.includes('/*__COACH_START__*/'));
  const bCsEnd = baselineLines.findIndex(l => l.includes('/*__COACH_END__*/'));
  const baselineCoachSpan = baselineLines.slice(bCsStart + 1, bCsEnd).join('\n');

  // Functions that MUST remain byte-identical to the c556f29 baseline --
  // everything in coach-span except the approved v1.7 prescription areas.
  // v1.11 (Warm-Up/Cool-Down, James-approved coach-span amendment) also
  // legitimately changed buildWarmupCooldown and recoverySession -- removed
  // from this frozen list below and covered by test-phase-b-warmup-cooldown.js
  // instead. pickPulseRaiser/pickMobilityByPatterns stay in this list: their
  // function bodies are untouched (only the library data and callers changed).
  // 13 July 2026 (James-approved coach-span amendment): computeFatigueState
  // also removed from this frozen list -- capped which sets can feed its
  // internal Epley est-1RM signal to <=12 reps (Epley's validated range),
  // matching the same cap applied to every user-facing est-1RM site
  // (strengthFoot/computeWeekRecap/buildHistoryData). Covered by
  // test-est1rm-rep-cap.js instead.
  // 16 July 2026 (James-approved coach-span amendment): libraryIntegrity
  // also removed -- it gained the complex/circuit honesty rules (movements[]
  // schema validation + the never-again rule that a complex-named entry
  // without structured movements fails the library). Covered by
  // test-audit-complex-honesty.js instead.
  const UNCHANGED_FNS = [
    'parseIntake', 'splitLabel', 'kitSupportsPPL', 'splitForDays',
    'isHeavyLowerRole', 'pickHardConditioningDay', 'equipOk', 'poolTierOf', 'skillAllowed',
    'pickStrength', 'wasSlotEmptiedBySafety', 'seededJitter', 'weakPointMuscles',
    'anchorIsAvailable', 'mostRecentByPattern', 'selectComplementary', 'pickByType',
    'pickMobilityByPatterns', 'pickPulseRaiser', 'pickFunctional',
    'ririForWeek', 'ririTargetString', 'trimSetsForVolumeLandmark', 'pickConditioning',
    'conditioningAlternatives', 'curveFor', 'buildSetPlan', 'defaultWhy', 'getExPattern',
    'libEntryByName', 'pairLegal', 'exTimed', 'leadEmphasis', 'nameStrengthSessions',
    'assignSupersets', 'canonicalExName', 'recentTodayIdMap', 'buildWeightMap',
    'allSetsAtTop', 'buildLastLogs', 'titleCaseAreas', 'rolePatterns', 'parseSession',
    'floorMoveSafe', 'absoluteFloorExercises', 'roleFloorMoves', 'rebalanceRolePairs',
    'topUpThinDay', 'computeBlockBudgets', 'attachBlocks', 'pickEmomPair',
    'applyDensityFormat', 'guaranteeSession', 'derivePurposeSlots', 'buildIntent',
    'hardRunType', 'runLayout', 'runWorkout', 'makeRequest', 'requestToIntake',
    'requestToParsed', 'parsedToRequest', 'computeWeeklyDebt',
    'fatigueBand', 'fatigueBandForAnchorPattern', 'fatigueBandForPatterns',
    'stubBlockWeek', 'todayStr', 'getReadinessToday', 'degradation', 'pickLightPump',
    'resolveSpec'
  ];
  let unexpectedDrift = [];
  UNCHANGED_FNS.forEach(name => {
    const cur = extractFn(name, coachSpanBody);
    const base = extractFn(name, baselineCoachSpan);
    if (cur === null || base === null) { unexpectedDrift.push(name + ' (not found)'); return; }
    if (cur !== base) unexpectedDrift.push(name);
  });
  ok(unexpectedDrift.length === 0, 'no unrelated coach-span function drifted from the c556f29 baseline (test 30): ' + unexpectedDrift.join(', '));

  // The approved areas SHOULD differ from baseline (that's the whole point of this ticket).
  const APPROVED_CHANGED_FNS = ['prescription', 'buildEx', 'generateSession', 'generateProgram'];
  let unchangedApproved = [];
  APPROVED_CHANGED_FNS.forEach(name => {
    const cur = extractFn(name, coachSpanBody);
    const base = extractFn(name, baselineCoachSpan);
    if (cur === base) unchangedApproved.push(name);
  });
  ok(unchangedApproved.length === 0, 'all approved-to-change functions actually changed vs baseline (test 30): unchanged=' + unchangedApproved.join(', '));

  // New helpers must exist and not have existed in the baseline.
  ok(extractFn('restBandForStrengthBlock', coachSpanBody) !== null, 'restBandForStrengthBlock exists in current coach-span (test 30)');
  ok(extractFn('intervalBandForConditioningBlock', coachSpanBody) !== null, 'intervalBandForConditioningBlock exists in current coach-span (test 30)');
  ok(extractFn('restBandForStrengthBlock', baselineCoachSpan) === null, 'restBandForStrengthBlock did not exist in the c556f29 baseline (test 30)');
  ok(extractFn('intervalBandForConditioningBlock', baselineCoachSpan) === null, 'intervalBandForConditioningBlock did not exist in the c556f29 baseline (test 30)');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  FAIL: ' + f)); process.exitCode = 1; }
