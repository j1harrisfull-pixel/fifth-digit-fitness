// v1.8 TEMPO -- Ticket 1 (tokens + Home only). Static/source-level checks for
// the Home-only visual layer: coach-span untouched, no new stored fields, no
// writes from the memory helper, honesty gating for the 4 memory lines,
// rejected/approved copy guards, contrast ratios for the new tempo-* text
// tokens, no external/bitmap/network additions, and the watermark opacity
// ceiling. This is a static source audit (no DOM), matching the existing
// test files' style in this directory.
const fs = require('fs');
const { execSync } = require('child_process');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 1. Coach-span untouched ----------
const spanMatch = SRC.match(/\/\*__COACH_START__\*\/([\s\S]*?)\/\*__COACH_END__\*\//);
ok(!!spanMatch, 'coach-span markers present');
const spanMd5 = execSync(`sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5`).toString().trim();
ok(spanMd5 === '8dfbd4f07360fc76d5218c38eea8f0ae', 'coach-span md5 unchanged (8dfbd4f07360fc76d5218c38eea8f0ae), got ' + spanMd5);

// ---------- 2. New memory helper: read-only, outside coach-span, no writes ----------
const spanStart = SRC.indexOf('/*__COACH_START__*/');
const spanEnd = SRC.indexOf('/*__COACH_END__*/');
const memFnIdx = SRC.indexOf('function homeMemoryLine(');
ok(memFnIdx > spanEnd || memFnIdx < spanStart, 'homeMemoryLine() is defined outside the coach-span');
const memBlockMatch = SRC.match(/function homeMemoryLine\(\) \{[\s\S]*?\n  \}\n  function dayReasonLine/);
ok(!!memBlockMatch, 'homeMemoryLine() body located');
const memBody = memBlockMatch ? memBlockMatch[0] : '';
ok(!/state\.log\s*=|state\.program\s*=|state\.archive\s*=|localStorage\.setItem|\.push\(\{[^}]*completed/.test(memBody),
   'homeMemoryLine() body contains no writes to state.log/program/archive');
ok(!/computeWeeklyDebt|computeRollingDebt|computeFatigueState|selectComplementary|buildEx\(|generateSession\(|generateProgram\(/.test(memBody),
   'homeMemoryLine() does not call any coach-span function');

// ---------- 3. No new stored fields / no data-shape change ----------
// The helper reads existing fields only (sl.ex, sl.blocks, el.sets, el.weight,
// ses.exercises, ses.id, sl.finishedAt, sl.date) -- assert no new field name
// is assigned anywhere in the diffed functions.
ok(!/\.newField|\.memoryFlag|\.tempoData|state\.memory\b/.test(memBody),
   'no new stored field introduced by the memory helper');

// ---------- 4. Fresh-install / skipped-only / zero-logged: no fake memory ----------
// Structural guard: homeMemoryLine() is only ever invoked after a hasProgram()
// check in renderHomeHero (fresh install returns before it's called), and its
// own first line is `if (!hasProgram()) return "";`.
ok(/function homeMemoryLine\(\) \{\s*\n\s*if \(!hasProgram\(\)\) return "";/.test(SRC),
   'homeMemoryLine() returns "" immediately when there is no program (fresh install)');
const heroIdx = SRC.indexOf('function renderHomeHero() {');
const freshIfIdx = SRC.indexOf('if (!hasProgram()) {', heroIdx);
const freshReturnIdx = SRC.indexOf('return;', freshIfIdx);
const memoryLineCommentIdx = SRC.indexOf('// v1.8 TEMPO memory line', heroIdx);
ok(heroIdx > 0 && freshIfIdx > heroIdx && freshReturnIdx > freshIfIdx && memoryLineCommentIdx > freshReturnIdx,
   'renderHomeHero() returns the fresh-install branch before computing the memory line');
ok(/if \(!all\.length\) return "";/.test(memBody),
   'homeMemoryLine() returns "" when no session anywhere has completed work (covers skipped-only + zero-logged)');

// ---------- 5. Rejected-copy guard ----------
// Scoped to the code this ticket actually touched (the TEMPO CSS block +
// renderHomeHero + renderWeekList + the new memory helper), not the whole
// file -- pre-existing, out-of-scope strings elsewhere (e.g. the finish
// receipt's unrelated "Signed off" signature line, or the word "fatigued"
// inside untouched coach-span comments) are not part of this ticket's diff
// and must not fail this guard.
const heroFnMatch = SRC.match(/function renderHomeHero\(\) \{[\s\S]*?\n  \}\n  \/\/ ---- History view/);
const weekListFnMatch = SRC.match(/function renderWeekList\(\) \{[\s\S]*?\n  \}\n  \/\/ Delete the day/);
const NEW_CODE = tempoCssPlaceholder() + (heroFnMatch ? heroFnMatch[0] : '') + (weekListFnMatch ? weekListFnMatch[0] : '') + memBody;
function tempoCssPlaceholder() { return SRC.slice(SRC.indexOf('v1.8 TEMPO -- Home-only visual layer'), SRC.indexOf('Visual Reset Phase 2: the hero reads as ELEVATED')); }
const REJECTED = [
  'built to the minute', 'Every minute answered', '45 minutes, honest',
  'Progression handled', 'Tuesday is banked', 'UNTOUCHED', 'WAITING',
  'Signed off', 'training receipt', 'great job', 'well done', 'crushed it',
  'recovered', 'fatigued', 'optimal', 'readiness score', 'recovery score'
];
REJECTED.forEach(function (phrase) {
  ok(NEW_CODE.indexOf(phrase) === -1, 'rejected phrase absent from new v1.8 code: "' + phrase + '"');
});

// ---------- 6. Approved-copy guard for new Home strings ----------
// v1.10 Human Feel Ticket 2 (approved): the fresh-install why-line became the
// record-led "This becomes your training log. Build the first week." -- the
// CTA/sub/foot copy this test also checks is unchanged.
const APPROVED_LITERALS = [
  'This becomes your training log.', 'Build the first week.', 'Build your training week', 'Train today instead →',
  'Your first 14 days start here.', 'Start the session',
];
APPROVED_LITERALS.forEach(function (s) {
  ok(SRC.indexOf(s) !== -1, 'approved copy present: "' + s + '"');
});
// v1.10 Human Feel Ticket 1 (approved): the coloured-fill uppercase enum tags
// (CLOSED/BANKED · N SETS/READY/SKIPPED) became quiet lower-case Training
// Ledger annotations -- same data, same unit-honesty guarantee, just spoken
// instead of shouted. See test-v1_9-t1-preview.js and test-v1_8-tempo-
// ticket2-fixup.js for the full v1.10 wording assertions.
ok(SRC.indexOf('weekrow__anno weekrow__anno--done">') !== -1 && / closed</.test(SRC), 'week-row "closed" annotation present');
// v1.8 TEMPO Ticket 2 fix-up (approved): the banked label now reads a true
// completed-set count (bk.setsDone) instead of pr.done (which counts
// completed EXERCISES, a different unit) -- see test-v1_8-tempo-finish.js
// for the full unit-honesty test coverage of this fix.
ok(/banked · " \+ bk\.setsDone \+ " set/.test(SRC), 'week-row "banked · N sets" annotation present, uses true completed-set count (v1.8 fix-up, v1.10 wording)');
ok(/weekrow__anno">planned</.test(SRC), 'week-row "planned" annotation present');
ok(/weekrow__anno">set aside</.test(SRC), 'week-row "set aside" annotation present');
ok(SRC.indexOf('’s session is banked.') !== -1, 'memory line 1 template present');
ok(SRC.indexOf(' moved up this block.') !== -1, 'memory line 2 template present');
ok(SRC.indexOf(' in this week.') !== -1, 'memory line 3 template present');
ok(SRC.indexOf('Last session: ') !== -1 && SRC.indexOf(' banked."') !== -1, 'memory line 4 template present');

// ---------- 7. No external assets / bitmap / network ----------
const TEMPO_BLOCK_START = SRC.indexOf('v1.8 TEMPO -- Home-only visual layer');
const TEMPO_CSS_END = SRC.indexOf('Visual Reset Phase 2: the hero reads as ELEVATED');
const tempoCss = SRC.slice(TEMPO_BLOCK_START, TEMPO_CSS_END);
ok(!/url\(/.test(tempoCss), 'no url()/bitmap asset added in the TEMPO CSS block');
ok(!/https?:\/\//.test(tempoCss), 'no network reference in the TEMPO CSS block');
ok(!/fetch\(|XMLHttpRequest/.test(memBody), 'no network call in the memory helper');

// ---------- 8. FD watermark opacity ceiling ----------
// Swapped from a CSS-generated "FD" text glyph (::after { content: "FD" })
// to the real monogram SVG (.today-card__mark, same brand-handoff path as
// the header's .brand__mark) -- same position/opacity ceiling, just a real
// mark instead of a font recreation.
const wmMatch = tempoCss.match(/\.today-card__mark \{[^}]*opacity:\s*([0-9.]+)/);
ok(!!wmMatch, 'FD watermark rule found');
ok(!!wmMatch && parseFloat(wmMatch[1]) <= 0.05, 'FD watermark opacity <= 0.05, got ' + (wmMatch && wmMatch[1]));

// ---------- 9. Contrast ratios for the derived text-safe tempo tokens ----------
function srgbToLinear(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function relLum(hex) {
  const n = parseInt(hex.replace('#', ''), 16);
  const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b);
}
function contrast(a, b) {
  const L1 = relLum(a), L2 = relLum(b);
  const lighter = Math.max(L1, L2), darker = Math.min(L1, L2);
  return (lighter + 0.05) / (darker + 0.05);
}
const TOKENS = {
  bg: '#14161A', ink: '#F2EFE9', dim: '#9A9EA6', faint: '#7C8087',
  bone: '#EDE8DF', 'bone-ink': '#17181A', 'bone-dim': '#66614F',
  clay: '#C25436', 'clay-deep': '#A84A2F', brass: '#C79A43', 'brass-ink': '#7A6228',
};
const CONTRAST_PAIRS = [
  ['ink', 'bg', 4.5], ['dim', 'bg', 4.5],
  ['bone-ink', 'bone', 4.5], ['bone-dim', 'bone', 4.5],
  ['brass-ink', 'bone', 4.5], // the derived safe replacement for plain brass-on-bone
  ['bone', 'clay-deep', 4.5], // CTA text on the deepened clay fill
  ['brass', 'bg', 4.5],
];
CONTRAST_PAIRS.forEach(function (p) {
  const ratio = contrast(TOKENS[p[0]], TOKENS[p[1]]);
  ok(ratio >= p[2], p[0] + ' on ' + p[1] + ' >= ' + p[2] + ':1, got ' + ratio.toFixed(2));
});
// The plain (non-derived) brass-on-bone pairing is the one the audit found
// failing -- assert it is NOT used for text anywhere in the new TEMPO CSS
// (only --tempo-brass-ink is used for text color on the bone surface).
ok(!/\.today-card__label \{[^}]*color:\s*var\(--tempo-brass\)[^-]/.test(tempoCss),
   'today-card__label uses the safe --tempo-brass-ink, not plain --tempo-brass, for text on bone');
ok(!/\.today-reason b \{[^}]*color:\s*var\(--tempo-brass\)[^-]/.test(tempoCss),
   '.today-reason b uses the safe --tempo-brass-ink, not plain --tempo-brass, for text on bone');

// ---------- 10. Scoping: no shared global token was redefined ----------
ok(!/:root \{[^}]*--bg:\s*#14161A/.test(SRC.replace(tempoCss, '')),
   'the global :root --bg token was not overwritten (new tokens are additive under a separate --tempo- namespace)');
ok(/--tempo-bg: #14161A/.test(SRC), 'new --tempo-bg token added alongside the existing palette');

// ---------- 11. 320px scoping sanity: TEMPO rules are scoped to the week view ----------
const tempoRuleLines = tempoCss.split('\n').filter(function (l) { return /^\.app\[data-view="week"\]/.test(l.trim()); });
ok(tempoRuleLines.length > 10, 'TEMPO Home rules are scoped under .app[data-view="week"] (found ' + tempoRuleLines.length + ')');

// ---------- 12. Existing suites still pass (spot-check via require of a couple, avoided here to keep this file independent) ----------
// (Run separately: node tools/tests/test-v1_6-rolling-today.js, test-v1_7-time-budget-honesty.js, test-v1_4-density-finish.js)

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
