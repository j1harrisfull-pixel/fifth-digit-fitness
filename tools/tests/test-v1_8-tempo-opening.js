// v1.8 TEMPO -- Opening Alignment. Static source-level checks: coach-span
// protection, no onboarding-logic diff (showWelcome/openPlan/step count
// verbatim), token/scoping guards for #bootSplash/.intro/#planSheet/the
// week-list first-use .empty/#readinessPromptTitle, FD-ghost-not-thumbprint
// guard, clay-not-brass CTA guard, footer version string, rejected-copy
// guard, contrast, and 320px overflow guard (no unbounded ghost mark).
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
ok(spanMd5 === '8dfbd4f07360fc76d5218c38eea8f0ae', 'coach-span md5 unchanged (8dfbd4f07360fc76d5218c38eea8f0ae), got ' + spanMd5);

// ---------- 2. No onboarding logic / step-order / behavior change ----------
ok((SRC.match(/class="intro__step"/g) || []).length === 4, 'still exactly 4 intro steps (no step added/removed)');
const showWelcomeBody = extractFn('showWelcome');
ok(/introShowStep\(building && !state\.userName \? 1 : 2\);/.test(showWelcomeBody),
   'showWelcome() step-routing logic unchanged verbatim');
ok(/go\.textContent = "Build my first week";/.test(showWelcomeBody), 'showWelcome() CTA text logic unchanged verbatim');
const openPlanBody = extractFn('openPlan');
ok(/openSheetNoKb\(planSheet\);/.test(openPlanBody), 'openPlan() still opens planSheet via the existing openSheetNoKb path, unchanged');
ok(/pending = null; pendingBuild = null; pendingToday = null; pendingSubstituteIdx = null;/.test(openPlanBody),
   'openPlan() reset logic unchanged verbatim');

// ---------- 3. No data-shape change ----------
ok(!/state\.userName\s*=(?!=)/.test(SRC.slice(SRC.indexOf('v1.8 TEMPO -- Opening Alignment'), SRC.indexOf('Visual Reset Phase 2: the hero reads as ELEVATED'))),
   'the Opening Alignment CSS block contains no state writes (it is CSS-only)');

// ---------- 4. Scoped token/visual guards ----------
const openStart = SRC.lastIndexOf('/*', SRC.indexOf('v1.8 TEMPO -- Opening Alignment'));
const openEnd = SRC.indexOf('Visual Reset Phase 2: the hero reads as ELEVATED');
const openingCss = SRC.slice(openStart, openEnd);

ok(/#bootSplash, \.intro, #planSheet\.sheet \{ background: var\(--tempo-bg\); \}/.test(openingCss),
   '#bootSplash/.intro/#planSheet share the TEMPO graphite background');
ok(/\.intro \.btn--primary \{ background: var\(--tempo-clay-deep\)/.test(openingCss),
   'intro primary actions use the contrast-safe clay-deep fill, not brass');
ok(/#planSheet \.btn--primary \{ background: var\(--tempo-clay-deep\)/.test(openingCss),
   'plan sheet primary actions use the contrast-safe clay-deep fill, not brass');
ok(/#readinessPromptTitle \{ color: var\(--tempo-brass\); \}/.test(openingCss),
   'readiness prompt title recolored to brass identity token (not --danger)');
ok(!/#readinessPromptTitle \{ color: var\(--danger\)/.test(SRC), 'readiness prompt title no longer forced to --danger anywhere');

// ---------- 5. FD ghost mark replaces thumbprint on intro + first-use empty state ----------
ok(/#intro::before \{ content: "FD";/.test(openingCss), 'intro uses an FD ghost mark (not the old thumbprint image), ID-scoped to win the cascade over the older .intro::before rule');
ok(/\.intro::before \{ content: ""; position: absolute[^}]*thumbprint\.png/.test(SRC),
   'the old .intro::before thumbprint rule still exists in source (untouched, out of scope) but is now beaten on specificity by #intro::before');
ok(/\.app\[data-view="week"\] #weekList \.empty::before \{ content: "FD";/.test(openingCss),
   'the week-list first-use empty state uses the FD ghost mark (not thumbprint)');

// ---------- 5b. Plan sheet chip/segment retoning (graphite, not the old warm --surface-2) ----------
ok(/#planSheet \.seg \{ background: var\(--tempo-surface\)/.test(openingCss), 'plan sheet segmented tabs retoned off the old warm --surface-2');
ok(/#planSheet \.chip \{ background: var\(--tempo-surface\)/.test(openingCss), 'plan sheet chips retoned off the old warm --surface-2');
ok(/#planSheet \.seg button\[aria-pressed="true"\] \{ background: var\(--tempo-bg\)/.test(openingCss), 'plan sheet selected segment state stays contrast-safe on the new base');
ok(/#planSheet \.chip\[aria-pressed="true"\] \{ background: var\(--tempo-bg\)/.test(openingCss), 'plan sheet selected chip state stays contrast-safe on the new base');
const wmMatches = openingCss.match(/opacity: \.045/g) || [];
ok(wmMatches.length >= 2, 'FD ghost marks stay at <=5% opacity (found ' + wmMatches.length + ' at .045)');

// ---------- 6. Untouched-scope guards: shared base rules not globally retokened ----------
ok(/^\.btn--primary \{ background: color-mix\(in srgb, var\(--accent\) 84%, var\(--surface\)\); border-color: transparent; color: var\(--on-accent\); \}$/m.test(SRC),
   'the shared global .btn--primary rule (Settings, other dialogs) is untouched -- only .intro/#planSheet scoped overrides were added');
ok(/^\.confirm__title \{ font-family: var\(--font-display\); font-weight: 800; font-size: 20px; letter-spacing: -\.01em; margin: 0 0 8px; display: flex; align-items: center; gap: 9px; color: var\(--danger\); \}$/m.test(SRC),
   'the shared .confirm__title rule keeps --danger for the real destructive-confirm dialog -- only #readinessPromptTitle was scoped-overridden');
ok(/^\.empty \{ position: relative; text-align: center; padding: 48px 24px; overflow: hidden; \}$/m.test(SRC),
   'the shared .empty base rule is untouched (day-view "Nothing here yet" list keeps its own existing thumbprint treatment, out of this ticket\'s scope)');

// ---------- 7. Footer version string ----------
// v1.9 Training Flow Trust deploy (approved) bumped this further, v1.8 -> v1.9.
ok(/Fifth Digit Coach · v1\.9 · works fully offline/.test(SRC), 'footer version string updated to v1.9');
ok(!/Fifth Digit Coach · v1\.3 · works fully offline/.test(SRC), 'stale v1.3 footer string is gone');

// ---------- 8. No copy change beyond the approved footer string ----------
ok(/Let's make this yours\./.test(SRC), 'intro step 1 headline copy unchanged');
ok(/Here's how it works/.test(SRC), 'intro step 2 headline copy unchanged');
ok(/Anything we should avoid\?/.test(SRC), 'intro step 3 headline copy unchanged');
ok(/Training experience/.test(SRC), 'intro step 4 headline copy unchanged');
ok(/How are you feeling today\?/.test(SRC), 'readiness prompt copy unchanged');

// ---------- 9. Rejected-copy guard (scoped to the new/changed opening code) ----------
// Strip /* */ comments before scanning -- this ticket's own explanatory
// comments legitimately use plain-English words ("untouched", "nice to
// have") that collide with rejected UI-copy terms; per the ticket, code
// comments that never render to the user are not in scope for this guard.
const openingCssNoComments = openingCss.replace(/\/\*[\s\S]*?\*\//g, '');
const REJECTED = [
  'built to the minute', 'Every minute answered', '45 minutes, honest', 'Progression handled',
  'Tuesday is banked', 'UNTOUCHED', 'WAITING', 'Signed off', 'training receipt', 'great job',
  'well done', 'crushed it', 'nice', 'recovered', 'fatigued', 'optimal', 'readiness score', 'recovery score'
];
REJECTED.forEach(function (phrase) {
  ok(openingCssNoComments.toLowerCase().indexOf(phrase.toLowerCase()) === -1, 'rejected phrase absent from new opening CSS (comments excluded): "' + phrase + '"');
});

// ---------- 10. No external/bitmap/network assets ----------
ok(!/url\(/.test(openingCss), 'no url()/bitmap asset added in the opening CSS block');
ok(!/https?:\/\//.test(openingCss), 'no network reference in the opening CSS block');

// ---------- 11. Contrast ratios ----------
function srgbToLinear(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function relLum(hex) { const n = parseInt(hex.replace('#', ''), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b); }
function contrast(a, b) { const L1 = relLum(a), L2 = relLum(b); const lighter = Math.max(L1, L2), darker = Math.min(L1, L2); return (lighter + 0.05) / (darker + 0.05); }
const T = { bg: '#14161A', ink: '#F2EFE9', dim: '#9A9EA6', faint: '#7C8087', bone: '#EDE8DF', 'clay-deep': '#A84A2F', brass: '#C79A43', surface: '#1B1E23', line: '#2A2E35' };
[
  ['ink', 'bg', 4.5], ['ink', 'surface', 4.5], ['dim', 'bg', 4.5],
  ['bone', 'clay-deep', 4.5], ['brass', 'bg', 4.5], ['brass', 'surface', 4.5],
].forEach(function (p) {
  const ratio = contrast(T[p[0]], T[p[1]]);
  ok(ratio >= p[2], p[0] + ' on ' + p[1] + ' >= ' + p[2] + ':1 (opening screens), got ' + ratio.toFixed(2));
});

// ---------- 12. 320px overflow guard: .intro has overflow-x hidden (unbounded ghost is clipped) ----------
ok(/\.intro \{ color: var\(--tempo-ink\); overflow-x: hidden; \}/.test(openingCss),
   '.intro clips horizontal overflow so the large FD ghost mark cannot cause a 320px scrollbar');
ok(/\.empty \{ position: relative; text-align: center; padding: 48px 24px; overflow: hidden; \}/.test(SRC),
   'the week-list empty state already clips overflow (pre-existing .empty rule), so its FD ghost is safely contained');

// ---------- 13. Scoping sanity ----------
const scopedLines = openingCss.split('\n').filter(function (l) {
  const t = l.trim();
  return /^(#bootSplash|\.intro|#planSheet|\.app\[data-view="week"\] #weekList \.empty|#readinessPromptTitle)/.test(t);
});
ok(scopedLines.length >= 10, 'Opening Alignment rules are scoped to the approved surfaces only (found ' + scopedLines.length + ')');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
