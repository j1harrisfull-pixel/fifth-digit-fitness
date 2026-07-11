// v1.8 TEMPO Ticket 2 finish sheet -> v1.10 Ticket 5 THE PAGE. Static/
// source-level checks plus a real-function harness (same extract-by-brace-
// matching pattern as test-v1_4-density-finish.js) covering the finish
// page's states in showSessionComplete(): full / partial / density /
// zero-logged, record-grammar ledger rows, closing sentence, coach-span
// protection, data-shape protection, rejected-copy guard, and contrast.
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

// ---------- 2. v1.10 Ticket 5: the lift-progress helper was removed WITH
// its only caller (the receipt's interpretation line) -- the page carries
// no interpretation beyond "· best yet". Dead code must not linger. ----------
ok(SRC.indexOf('function finishLiftProgressLine(') === -1, 'finishLiftProgressLine removed with the receipt (dead code, only caller was the removed lift-progress line)');
ok(extractFn('showSessionComplete').indexOf('moved up this block') === -1, 'the finish page renders no "moved up this block" interpretation line (that fact lives only in the Home memory line now)');

// ---------- Harness: real showSessionComplete/endSession/hasRealWork/etc ----------
const NAMES = ['isSkipped', 'isSessionFinished', 'hasRealWork', 'blockPseudoId', 'readBlockLog', 'writeBlockLog',
  'sessionProgress', 'sessionItemsFor', 'compactLog', 'endSession', 'showSessionComplete'];
const body = NAMES.map(extractFn).join('\n\n');

const harness = `
  var state = { log: {}, program: { unit: 'kg', weeks: [] }, activeSession: 0, activeWeek: 0, athlete: null };
  var _saveCount = 0, _backCount = 0, _toastMsgs = [];
  function save() { _saveCount++; }
  function backToWeek() { _backCount++; }
  function toast(msg) { _toastMsgs.push(msg); }
  // v1.9-T1: endSession now starts with an isPreviewSession(state.activeSession)
  // guard. Every case here exercises the armed (loggable) session.
  function isPreviewSession() { return false; }
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
  // v1.10 Ticket 5 (THE PAGE): new display-layer dependencies of
  // showSessionComplete -- same-shape stubs as the rest of this harness.
  var WARM_LOADED = ['barbell', 'dumbbell', 'machine', 'cable', 'kettlebell', 'smith'];
  var BLOCK_MODE_LABEL = { emom: 'EMOM', amrap: 'AMRAP' };
  function est1RM(w, r) { return w * (1 + r / 30); }
  function exTimed() { return false; }
  function esc(s) { return String(s == null ? '' : s); }

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
  ok(!('completeDate' in M.els()), 'zero-logged: showSessionComplete never ran, no page element was ever touched');
}

// ---------- 4. Full finish: spoken line, session name, ledger, closing sentence ----------
{
  var ses = { id: 'F1', name: 'Sess', exercises: [strengthEx('e0', 2), strengthEx('e1', 2)] };
  var log = { F1: { date: null, ex: {
    e0: { weight: 40, sets: [{ completed: true, actual_reps: 8 }, { completed: true, actual_reps: 8 }] },
    e1: { weight: 40, sets: [{ completed: true, actual_reps: 8 }, { completed: true, actual_reps: 8 }] }
  } } };
  setup(ses, log);
  M.endSession();
  ok(M.els().completeTitleText.textContent === 'Work logged.', 'full finish: the spoken line is "Work logged." got: ' + M.els().completeTitleText.textContent);
  ok(M.els().completeDate.textContent.length > 0, 'full finish: the date line is populated');
  ok(M.els().completeSessionName.textContent === 'Session', 'full finish: the session name (dayPositionLabel) is the page hero');
  var ledgerF = M.els().completeLedger.innerHTML;
  ok((ledgerF.match(/finish-page__row/g) || []).length === 2, 'full finish: one ledger row per exercise with kept work, got: ' + ledgerF);
  // This harness stubs readLog with sets that carry no per-set weight/reps,
  // so the record grammar falls to its safest honest form: the real
  // completed-set count. (Per-set record grammar is covered in section 4b.)
  ok(/2 sets/.test(ledgerF), 'full finish: rows fall back to the honest completed-set count when per-set figures are unavailable');
  ok(M.els().completeClose.textContent === '4 sets kept', 'full finish: closing sentence is the real kept-set count (no mins in this fixture, no timer set), got: ' + M.els().completeClose.textContent);
}

// ---------- 4b. Record grammar: best kept set from real per-set figures ----------
{
  var ses = { id: 'F2', name: 'Sess', exercises: [Object.assign(strengthEx('e0', 3), { equipment: 'barbell' })] };
  // Real per-set weight/reps as real readLog returns them: best est-1RM is
  // 80 × 5 (93.3) over 75 × 6 (90) and 80 × 3 (88) -- the row must read the
  // BEST KEPT set in record grammar, load first, never the prescription.
  var log = { F2: { date: null, ex: { e0: { weight: 80, sets: [
    { completed: true, actual_reps: 6, weight: 75, reps: 6 },
    { completed: true, actual_reps: 5, weight: 80, reps: 5 },
    { completed: true, actual_reps: 3, weight: 80, reps: 3 }
  ] } } } };
  setup(ses, log);
  M.endSession();
  var ledgerG = M.els().completeLedger.innerHTML;
  ok(/80 kg × 5/.test(ledgerG), 'record grammar: the row shows the best kept set "80 kg × 5" (highest est-1RM among completed sets), got: ' + ledgerG);
  ok(!/3 × 80|sets of|target/.test(ledgerG), 'record grammar: no prescription grammar on the page');
  ok(M.els().completeClose.textContent === '3 sets kept · 1,090 kg', 'closing sentence carries real volume when real load exists (75×6 + 80×5 + 80×3 = 1,090), got: ' + M.els().completeClose.textContent);
}

// ---------- 5. Partial finish: spoken line, only kept work on the page ----------
{
  var ses = { id: 'P1', name: 'Sess', exercises: [strengthEx('e0', 4), strengthEx('e1', 3)] };
  var log = { P1: { date: null, ex: { e0: { weight: 40, sets: [{ completed: true, actual_reps: 8 }, { completed: false }, { completed: false }, { completed: false }] } } } };
  setup(ses, log);
  M.endSession();
  ok(M.els().completeTitleText.textContent === 'Enough for today.', 'partial finish: the spoken line is "Enough for today." got: ' + M.els().completeTitleText.textContent);
  var ledgerP = M.els().completeLedger.innerHTML;
  ok((ledgerP.match(/finish-page__row/g) || []).length === 1, 'partial finish: ONLY the exercise with kept work renders -- the page never knows what wasn\'t done');
  ok(ledgerP.indexOf('e1') === -1, 'partial finish: the untouched exercise does not appear at all');
  ok(M.els().completeClose.textContent === '1 set kept', 'partial finish: closing sentence counts only real kept sets, got: ' + M.els().completeClose.textContent);
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
  ok(M.els().completeTitleText.textContent === 'Work logged.', 'density finish: the spoken line is "Work logged." got: ' + M.els().completeTitleText.textContent);
  var densityHtml = M.els().completeLedger.innerHTML;
  ok(/EMOM<\/span><span class="finish-page__kept">7 rounds/.test(densityHtml), 'density finish: EMOM ledger row records the real rounds ("7 rounds"), got: ' + densityHtml);
  ok(/AMRAP<\/span><span class="finish-page__kept">4 rounds · finished/.test(densityHtml), 'density finish: completed AMRAP row records rounds + "finished" from the real completed flag, got: ' + densityHtml);
  ok(M.els().completeClose.textContent === '11 rounds kept', 'density finish: closing sentence counts real rounds when the session\'s work was rounds, got: ' + M.els().completeClose.textContent);
}

// ---------- 7. AMRAP not completed: rounds line, not "AMRAP finished." ----------
{
  var ses = { id: 'D2', name: 'Density', exercises: [{ id: 'e0', name: 'AMRAP Work', type: 'strength', sets: 0, block: 'conditioning', densityMode: 'amrap' }] };
  var log = { D2: { date: null, ex: {}, blocks: { conditioning: { rounds: 3, completed: false } } } };
  setup(ses, log);
  M.endSession();
  var densityHtml = M.els().completeLedger.innerHTML;
  ok(/3 rounds/.test(densityHtml), 'AMRAP not completed: honest rounds figure shown, got: ' + densityHtml);
  ok(!/finished/.test(densityHtml), 'AMRAP not completed: "finished" must not render (completed flag is false)');
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

// ---------- 9. v1.10 Ticket 5: the page renders no interpretation lines ----------
{
  // The old lift-progress element is never touched by the page (its helper
  // was removed with its only caller); the ONLY progress marker permitted
  // is "· best yet" on a ledger row, from the same buildHonestRead PR
  // comparison the receipt already trusted (stubbed to no-PRs here).
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
  ok(!('completeLiftProgress' in M.els()), 'the page never touches a lift-progress element (interpretation line removed with the receipt)');
  ok(M.els().completeLedger.innerHTML.indexOf('best yet') === -1, 'no "· best yet" without a genuine PR (buildHonestRead stubbed to none here)');
}

// ---------- 10. Done. closes the page and returns to week (navigation unchanged) ----------
{
  ok(/primaryBtn\.textContent = "Done\.";/.test(SRC), 'Done. label (the page\'s one quiet exit word)');
  ok(/primaryBtn\.onclick = function \(\) \{ closeDlg\(\); backToWeek\(\); \};/.test(SRC), 'Done. still closes the page then returns to week (unchanged navigation)');
}

// ---------- 11. Rejected-copy guard (scoped to the new/changed finish code) ----------
const showFnBody = extractFn('showSessionComplete');
const finishCssStart = SRC.indexOf('v1.10 Ticket 5 -- THE PAGE');
const finishCssEnd = SRC.indexOf('v1.8 TEMPO -- Active Workout Card');
ok(finishCssStart > 0 && finishCssEnd > finishCssStart, 'THE PAGE finish CSS block located');
const finishCss = SRC.slice(finishCssStart, finishCssEnd);
const NEW_FINISH_CODE = finishCss + showFnBody;
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
ok(!/fetch\(|XMLHttpRequest/.test(showFnBody), 'no network call in the finish display code');

// ---------- 13. v1.10 Ticket 5: the pressed FD stamp (watermark removed) ----------
ok(finishCss.indexOf('receipt-paper::after') === -1, 'the old FD ghost watermark is gone (the pressed stamp replaced it)');
const stampMatch = finishCss.match(/#completeSheet \.finish-page__stamp \{[^}]*opacity:\s*([0-9.]+)/);
ok(!!stampMatch, 'pressed FD stamp rule found in finish CSS');
ok(!!stampMatch && parseFloat(stampMatch[1]) <= 0.65 && parseFloat(stampMatch[1]) >= 0.4, 'stamp is pressed (~60% ink), never full black, got ' + (stampMatch && stampMatch[1]));
const settleMatch = finishCss.match(/@keyframes fdStampSettle/);
ok(!!settleMatch, 'the stamp settle keyframes exist (the page\'s only motion)');
const settleDur = finishCss.match(/animation: fdStampSettle ([0-9.]+)s/);
ok(!!settleDur && parseFloat(settleDur[1]) <= 0.35, 'stamp settle is ~300ms or less, got ' + (settleDur && settleDur[1]) + 's (reduced-motion suppressed by the existing blanket rule)');

// ---------- 14. Contrast ratios for tokens used on the finish sheet (reuse Ticket 1 tokens, same values) ----------
function srgbToLinear(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function relLum(hex) { const n = parseInt(hex.replace('#', ''), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b); }
function contrast(a, b) { const L1 = relLum(a), L2 = relLum(b); const lighter = Math.max(L1, L2), darker = Math.min(L1, L2); return (lighter + 0.05) / (darker + 0.05); }
const T = { bone: '#EDE8DF', 'bone-ink': '#17181A', 'bone-dim': '#66614F', 'brass-ink': '#7A6228' };
[['bone-ink', 'bone', 4.5], ['bone-dim', 'bone', 4.5], ['brass-ink', 'bone', 4.5], ['bone', 'bone-ink', 4.5]].forEach(function (p) {
  const ratio = contrast(T[p[0]], T[p[1]]);
  ok(ratio >= p[2], p[0] + ' on ' + p[1] + ' >= ' + p[2] + ':1 (finish sheet reuses Ticket 1 derived tokens), got ' + ratio.toFixed(2));
});
// v1.10 Ticket 5: no plain --tempo-brass text on bone anywhere on the page
// (the page uses only bone-ink and bone-dim; brass has no seat here at all).
ok(!/var\(--tempo-brass\)/.test(finishCss), 'THE PAGE uses no brass -- ink and dim on bone only');
ok(!/var\(--tempo-clay/.test(finishCss), 'THE PAGE uses no clay -- the record is not an action surface');

// ---------- 15. Scoping: finish CSS only touches #completeSheet ----------
const finishRuleLines = finishCss.split('\n').filter(function (l) { return /^#completeSheet/.test(l.trim()); });
ok(finishRuleLines.length >= 12, 'finish CSS rules are scoped under #completeSheet (THE PAGE is deliberately leaner than the receipt; found ' + finishRuleLines.length + ')');

// ---------- 16. No new stored fields ----------
ok(!/sl\.result\s*=|state\.finish\s*=|\.densityResult\s*=/.test(showFnBody), 'no new stored field introduced by the finish display code');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
