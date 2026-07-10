// v1.8 TEMPO -- Ticket 2 (finish result sheet only). Static/source-level
// checks plus a real-function harness (same extract-by-brace-matching
// pattern as test-v1_4-density-finish.js) covering the new headline/copy
// branches in showSessionComplete(): full / partial / density / zero-logged,
// the new finishLiftProgressLine() helper, coach-span protection, data-shape
// protection, rejected-copy guard, contrast, and the FD watermark ceiling.
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

// ---------- 1. Coach-span untouched ----------
const spanMd5 = execSync(`sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5`).toString().trim();
ok(spanMd5 === '39026b0244cb88bf92c0d0c6615f01dd', 'coach-span md5 unchanged (39026b0244cb88bf92c0d0c6615f01dd), got ' + spanMd5);

// ---------- 2. finishLiftProgressLine outside coach-span, no coach-span calls ----------
const spanStart = SRC.indexOf('/*__COACH_START__*/'), spanEnd = SRC.indexOf('/*__COACH_END__*/');
const flpIdx = SRC.indexOf('function finishLiftProgressLine(');
ok(flpIdx > spanEnd || flpIdx < spanStart, 'finishLiftProgressLine() is defined outside the coach-span');
const flpBody = extractFn('finishLiftProgressLine');
ok(!/computeWeeklyDebt|computeRollingDebt|computeFatigueState|selectComplementary|buildEx\(|generateSession\(|generateProgram\(/.test(flpBody),
   'finishLiftProgressLine() does not call any coach-span function');
ok(!/state\.log\s*=|state\.program\s*=|\.push\(\{[^}]*completed/.test(flpBody),
   'finishLiftProgressLine() contains no writes to state.log/program');

// ---------- Harness: real showSessionComplete/endSession/hasRealWork/etc ----------
const NAMES = ['isSkipped', 'isSessionFinished', 'hasRealWork', 'blockPseudoId', 'readBlockLog', 'writeBlockLog',
  'sessionProgress', 'sessionItemsFor', 'compactLog', 'endSession', 'showSessionComplete', 'finishLiftProgressLine'];
const body = NAMES.map(extractFn).join('\n\n');

const harness = `
  var state = { log: {}, program: { unit: 'kg', weeks: [] }, activeSession: 0, activeWeek: 0, athlete: null };
  var _saveCount = 0, _backCount = 0, _toastMsgs = [];
  function save() { _saveCount++; }
  function backToWeek() { _backCount++; }
  function toast(msg) { _toastMsgs.push(msg); }
  function hideRest() {}
  function ensureSessionLive() {}
  function unlockAudio() {}
  function computeFatigueState() { return null; }
  function strengthFoot() { return { ready: false }; }
  function bumpPref() {}
  function canonicalExName(n) { return n; }
  function getAnchorState() { return null; }
  function fatigueBandForAnchorPattern() { return null; }
  function anchorProgressionDecision() { return { action: 'hold' }; }
  function anchorIncrementKg() { return 0; }
  function roundW(w) { return w; }
  function recordAnchorExposure() {}
  var LIBRARY = [];
  function buildHonestRead() { return { html: '', prs: [] }; }
  function dayPositionLabel() { return 'Session'; }
  function ordinal(n) { return n + 'th'; }
  var _curWeek = null;
  function curWeek() { return _curWeek; }
  function curSession() { return _curSession; }
  var _curSession = null;
  var liveTimerStart = 0;
  var reduceMotion = true;
  function fmtDate() { return 'Date'; }
  function openSheetNoKb() {}

  function readLog(ses, ex) {
    var sl = state.log[ses.id], el = sl && sl.ex ? sl.ex[ex.id] : null;
    return { sets: (el && Array.isArray(el.sets)) ? el.sets : [], weight: (el && el.weight) || 0 };
  }

  var _els = {};
  function fakeReceiptEl() { return { style: { _props: {}, setProperty: function (k, v) { this._props[k] = v; } } }; }
  function $(id) {
    if (id === 'completeSheet') {
      if (!_els.completeSheet) _els.completeSheet = { querySelector: function (sel) { return sel === '.receipt-paper' ? fakeReceiptEl() : null; } };
      return _els.completeSheet;
    }
    if (!_els[id]) _els[id] = { textContent: '', innerHTML: '', hidden: false, close: function () {}, removeAttribute: function () {} };
    return _els[id];
  }

  ${body}

  module.exports = {
    setState: function (s) { state = s; },
    setCurSession: function (s) { _curSession = s; },
    setCurWeek: function (w) { _curWeek = w; },
    hasRealWork: hasRealWork,
    endSession: endSession,
    els: function () { return _els; },
    counts: function () { return { save: _saveCount, back: _backCount, toasts: _toastMsgs.slice() }; },
    resetCounts: function () { _saveCount = 0; _backCount = 0; _toastMsgs = []; }
  };
`;
const mod = { exports: {} };
new Function('module', 'exports', harness)(mod, mod.exports);
const M = mod.exports;

function strengthEx(id, sets, extra) { return Object.assign({ id: id, name: id, type: 'strength', sets: sets }, extra || {}); }

function setup(ses, log, wk, program) {
  M.setState({ log: log, program: program || { unit: 'kg', weeks: [{ sessions: [ses] }] }, activeSession: 0, activeWeek: 0, athlete: null });
  M.setCurSession(ses);
  M.setCurWeek(wk || { sessions: [ses] });
  M.resetCounts();
}

// ---------- 3. Zero-logged: exact toast, no result sheet ----------
{
  var ses = { id: 'Z1', name: 'Sess', exercises: [strengthEx('e0', 4)] };
  setup(ses, {});
  M.endSession();
  var c = M.counts();
  ok(c.toasts.length === 1 && c.toasts[0] === 'Nothing logged. Left as is.', 'zero-logged: exact toast copy');
  ok(c.back === 1, 'zero-logged: returns to week');
  ok(!('completeOverline' in M.els()), 'zero-logged: showSessionComplete never ran, no result-sheet element was ever touched');
}

// ---------- 4. Full finish: headline, state word, fact line ----------
{
  var ses = { id: 'F1', name: 'Sess', exercises: [strengthEx('e0', 2), strengthEx('e1', 2)] };
  var log = { F1: { date: null, ex: {
    e0: { weight: 40, sets: [{ completed: true, actual_reps: 8 }, { completed: true, actual_reps: 8 }] },
    e1: { weight: 40, sets: [{ completed: true, actual_reps: 8 }, { completed: true, actual_reps: 8 }] }
  } } };
  setup(ses, log);
  M.endSession();
  ok(M.els().completeTitleText.textContent === 'That’s the work done.', 'full finish: headline is "That’s the work done." got: ' + M.els().completeTitleText.textContent);
  ok(M.els().completeOverline.textContent === 'SESSION CLOSED' && M.els().completeOverline.hidden === false, 'full finish: state word "SESSION CLOSED" shown');
  ok(M.els().completeFact.textContent === '4 sets logged', 'full finish: fact line shows real set count (no mins in this fixture, no timer set), got: ' + M.els().completeFact.textContent);
}

// ---------- 5. Partial finish: headline, sub line, note, no "Finished early" ----------
{
  var ses = { id: 'P1', name: 'Sess', exercises: [strengthEx('e0', 4)] };
  var log = { P1: { date: null, ex: { e0: { weight: 40, sets: [{ completed: true, actual_reps: 8 }, { completed: false }, { completed: false }, { completed: false }] } } } };
  setup(ses, log);
  M.endSession();
  ok(M.els().completeTitleText.textContent === 'Enough for today.', 'partial finish: headline is "Enough for today." got: ' + M.els().completeTitleText.textContent);
  ok(M.els().completeEarned.textContent === 'every set still counts', 'partial finish: sub line is "every set still counts"');
  ok(M.els().completePartialNote.textContent === 'Short session. Still banked.' && M.els().completePartialNote.hidden === false, 'partial finish: honest note shown');
  ok(M.els().completeOverline.hidden === true, 'partial finish: no "SESSION CLOSED" state word (not fully complete)');
  ok(!/Finished early/.test(M.els().completeTitleText.textContent), 'partial finish: headline is not "Finished early"');
}

// ---------- 6. Density finish: "Work logged.", rounds line, AMRAP gating ----------
{
  var ses = {
    id: 'D1', name: 'Density',
    exercises: [
      { id: 'e0', name: 'EMOM Work', type: 'strength', sets: 0, block: 'strength', densityMode: 'emom' },
      { id: 'e1', name: 'AMRAP Work', type: 'strength', sets: 0, block: 'conditioning', densityMode: 'amrap' }
    ]
  };
  var log = { D1: { date: null, ex: {}, blocks: { strength: { rounds: 7, completed: false }, conditioning: { rounds: 4, completed: true } } } };
  setup(ses, log);
  M.endSession();
  ok(M.els().completeTitleText.textContent === 'Work logged.', 'density finish: headline is "Work logged." got: ' + M.els().completeTitleText.textContent);
  var densityHtml = M.els().completeDensityLines.innerHTML;
  ok(/7 rounds banked\./.test(densityHtml), 'density finish: "7 rounds banked." rendered from real bl.rounds, got: ' + densityHtml);
  ok(/AMRAP finished\./.test(densityHtml), 'density finish: "AMRAP finished." rendered when completed flag true, got: ' + densityHtml);
  ok(!/4 rounds banked\./.test(densityHtml), 'density finish: completed AMRAP block does not ALSO print a rounds-banked line');
}

// ---------- 7. AMRAP not completed: rounds line, not "AMRAP finished." ----------
{
  var ses = { id: 'D2', name: 'Density', exercises: [{ id: 'e0', name: 'AMRAP Work', type: 'strength', sets: 0, block: 'conditioning', densityMode: 'amrap' }] };
  var log = { D2: { date: null, ex: {}, blocks: { conditioning: { rounds: 3, completed: false } } } };
  setup(ses, log);
  M.endSession();
  var densityHtml = M.els().completeDensityLines.innerHTML;
  ok(/3 rounds banked\./.test(densityHtml), 'AMRAP not completed: honest rounds line shown instead, got: ' + densityHtml);
  ok(!/AMRAP finished\./.test(densityHtml), 'AMRAP not completed: "AMRAP finished." must not render (completed flag is false)');
}

// ---------- 8. Density with zero rounds and not completed: no density result sheet (falls to zero-logged, unchanged v1.4 behavior) ----------
{
  var ses = { id: 'D3', name: 'Density', exercises: [{ id: 'e0', name: 'EMOM Work', type: 'strength', sets: 0, block: 'strength', densityMode: 'emom' }] };
  var log = { D3: { date: null, ex: {}, blocks: { strength: { rounds: 0, completed: false } } } };
  setup(ses, log);
  M.endSession();
  var c = M.counts();
  ok(c.toasts.length === 1 && c.toasts[0] === 'Nothing logged. Left as is.', 'density zero rounds/not completed: zero-logged toast still wins (v1.4 behavior unchanged)');
}

// ---------- 9. Lift-progress line: appears only with a strict weight increase across sessions ----------
{
  var program = { unit: 'kg', weeks: [{ sessions: [
    { id: 'L0', name: 'Prior', exercises: [strengthEx('e0', 1)] },
    { id: 'L1', name: 'This', exercises: [strengthEx('e0', 2)] }
  ] }] };
  var log = {
    L0: { date: null, ex: { e0: { weight: 60, sets: [{ completed: true, actual_reps: 8 }] } } },
    L1: { date: null, ex: { e0: { weight: 65, sets: [{ completed: true, actual_reps: 8 }, { completed: true, actual_reps: 8 }] } } }
  };
  setup(program.weeks[0].sessions[1], log, { sessions: program.weeks[0].sessions }, program);
  M.endSession();
  ok(M.els().completeLiftProgress.textContent === 'e0 moved up this block.' && M.els().completeLiftProgress.hidden === false,
     'lift-progress line renders on a strict weight increase, got: ' + M.els().completeLiftProgress.textContent);
}
{
  // Flat weight: no progress line.
  var program = { unit: 'kg', weeks: [{ sessions: [
    { id: 'L2', name: 'Prior', exercises: [strengthEx('e0', 1)] },
    { id: 'L3', name: 'This', exercises: [strengthEx('e0', 2)] }
  ] }] };
  var log = {
    L2: { date: null, ex: { e0: { weight: 60, sets: [{ completed: true, actual_reps: 8 }] } } },
    L3: { date: null, ex: { e0: { weight: 60, sets: [{ completed: true, actual_reps: 8 }, { completed: true, actual_reps: 8 }] } } }
  };
  setup(program.weeks[0].sessions[1], log, { sessions: program.weeks[0].sessions }, program);
  M.endSession();
  ok(M.els().completeLiftProgress.hidden === true && M.els().completeLiftProgress.textContent === '',
     'lift-progress line omitted when weight did not strictly increase');
}
{
  // Partial finish: lift-progress line only renders on FULL finish, not partial.
  var program = { unit: 'kg', weeks: [{ sessions: [
    { id: 'L4', name: 'Prior', exercises: [strengthEx('e0', 1)] },
    { id: 'L5', name: 'This', exercises: [strengthEx('e0', 4)] }
  ] }] };
  var log = {
    L4: { date: null, ex: { e0: { weight: 60, sets: [{ completed: true, actual_reps: 8 }] } } },
    L5: { date: null, ex: { e0: { weight: 65, sets: [{ completed: true, actual_reps: 8 }, { completed: false }, { completed: false }, { completed: false }] } } }
  };
  setup(program.weeks[0].sessions[1], log, { sessions: program.weeks[0].sessions }, program);
  M.endSession();
  ok(M.els().completeLiftProgress.hidden === true,
     'lift-progress line is a full-finish-only line, omitted on a partial finish even with a real weight increase');
}

// ---------- 10. Done closes the sheet and returns to week (existing contract, unchanged) ----------
{
  ok(/primaryBtn\.textContent = "Done";/.test(SRC), 'Done button label unchanged');
  ok(/primaryBtn\.onclick = function \(\) \{ closeDlg\(\); backToWeek\(\); \};/.test(SRC), 'Done still closes the sheet then returns to week (unchanged navigation)');
}

// ---------- 11. Rejected-copy guard (scoped to the new/changed finish code) ----------
const showFnBody = extractFn('showSessionComplete');
const finishCssStart = SRC.indexOf('v1.8 TEMPO -- Finish Result Sheet');
const finishCssEnd = SRC.indexOf('Visual Reset Phase 2: the hero reads as ELEVATED');
const finishCss = SRC.slice(finishCssStart, finishCssEnd);
const NEW_FINISH_CODE = finishCss + showFnBody + flpBody;
const REJECTED = [
  'Signed off', 'session signed off', 'training receipt', 'great job', 'well done', 'crushed it',
  'Every minute answered', 'built to the minute', '45 minutes, honest', 'Progression handled',
  'recovered', 'fatigued', 'optimal', 'readiness score', 'recovery score', 'confetti', 'streak'
];
REJECTED.forEach(function (phrase) {
  ok(NEW_FINISH_CODE.toLowerCase().indexOf(phrase.toLowerCase()) === -1, 'rejected phrase absent from new finish code: "' + phrase + '"');
});
ok(SRC.indexOf('>Signed off<') === -1, 'the static "Signed off" markup default is gone');

// ---------- 12. No external/bitmap/network assets in the new CSS ----------
ok(!/url\(/.test(finishCss), 'no url()/bitmap asset added in the finish CSS block');
ok(!/https?:\/\//.test(finishCss), 'no network reference in the finish CSS block');
ok(!/fetch\(|XMLHttpRequest/.test(showFnBody + flpBody), 'no network call in the finish display code');

// ---------- 13. FD watermark opacity ceiling ----------
const wmMatch = finishCss.match(/#completeSheet \.receipt-paper::after \{[^}]*opacity:\s*([0-9.]+)/);
ok(!!wmMatch, 'FD watermark rule found in finish CSS');
ok(!!wmMatch && parseFloat(wmMatch[1]) <= 0.05, 'FD watermark opacity <= 0.05, got ' + (wmMatch && wmMatch[1]));

// ---------- 14. Contrast ratios for tokens used on the finish sheet (reuse Ticket 1 tokens, same values) ----------
function srgbToLinear(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function relLum(hex) { const n = parseInt(hex.replace('#', ''), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b); }
function contrast(a, b) { const L1 = relLum(a), L2 = relLum(b); const lighter = Math.max(L1, L2), darker = Math.min(L1, L2); return (lighter + 0.05) / (darker + 0.05); }
const T = { bone: '#EDE8DF', 'bone-ink': '#17181A', 'bone-dim': '#66614F', 'brass-ink': '#7A6228' };
[['bone-ink', 'bone', 4.5], ['bone-dim', 'bone', 4.5], ['brass-ink', 'bone', 4.5], ['bone', 'bone-ink', 4.5]].forEach(function (p) {
  const ratio = contrast(T[p[0]], T[p[1]]);
  ok(ratio >= p[2], p[0] + ' on ' + p[1] + ' >= ' + p[2] + ':1 (finish sheet reuses Ticket 1 derived tokens), got ' + ratio.toFixed(2));
});
ok(!/#completeSheet \.receipt-paper__ov \{[^}]*color:\s*var\(--tempo-brass\)[^-]/.test(finishCss),
   'the finish overline uses the safe --tempo-brass-ink, not plain --tempo-brass, for text on bone');
ok(!/#completeSheet \.complete__lift-progress \{[^}]*color:\s*var\(--tempo-brass\)[^-]/.test(finishCss),
   'the lift-progress line uses the safe --tempo-brass-ink, not plain --tempo-brass, for text on bone');

// ---------- 15. Scoping: finish CSS only touches #completeSheet ----------
const finishRuleLines = finishCss.split('\n').filter(function (l) { return /^#completeSheet/.test(l.trim()); });
ok(finishRuleLines.length > 15, 'finish CSS rules are scoped under #completeSheet (found ' + finishRuleLines.length + ')');

// ---------- 16. No new stored fields ----------
ok(!/sl\.result\s*=|state\.finish\s*=|\.densityResult\s*=/.test(showFnBody), 'no new stored field introduced by the finish display code');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
