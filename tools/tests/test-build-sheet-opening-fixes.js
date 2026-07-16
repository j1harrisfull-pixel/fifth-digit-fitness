// Build sheet opening sequence (13 July 2026, James, re: the plan-choice
// screenshot): three fixes.
// 1. "It shouldn't default to any pick" -- the plan-choice screen was
//    marking "Four weeks" as pressed before the user ever touched it,
//    because buildPrefs().weeks always has a concrete fallback (4) that
//    generation needs. Added a genuine planChoiceMade flag, separate from
//    the fallback value, so the screen starts with nothing selected.
// 2. "Ask Claude directly...needs to be simpler and usable by any AI" --
//    de-branded every user-visible string (it was never Claude-specific in
//    the actual generated request text, only the UI labels/toasts/errors),
//    and trimmed the copy.
// 3. "Match the app look and hierarchy" -- the sheet's <h2> title and the
//    wizard's actual question (.wstep__q) were the same 20px/700 weight,
//    two headings fighting each other. The sheet title now reads as a quiet
//    eyebrow-style frame label; the question is promoted to --fs-h1, the
//    app's real hero-heading scale (matching .card__name's exercise-name
//    treatment on the active-workout screen).
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

// ---------- 1. No default pick ----------
{
  const prefsFn = extractFn('buildPrefs');
  ok(/planChoiceMade: !!p\.planChoiceMade,/.test(prefsFn), 'buildPrefs() carries a genuine planChoiceMade flag, separate from the weeks fallback');
  const showFn = extractFn('showPlanChoice');
  ok(/b\.setAttribute\("aria-pressed", p\.planChoiceMade && plan !== "today" && parseInt\(plan, 10\) === p\.weeks\);/.test(showFn),
    'showPlanChoice() only marks a button pressed when planChoiceMade is genuinely true, not just because weeks happens to equal the fallback');
  const chooseFn = extractFn('choosePlan');
  ok(/buildPrefs\(\)\.planChoiceMade = true;/.test(chooseFn), 'choosePlan() sets planChoiceMade=true on a real user choice');
}

// ---------- 2. De-branded, AI-agnostic copy ----------
{
  ok(SRC.indexOf('Claude') === -1, 'no "Claude" string remains anywhere in the app');
  ok(SRC.indexOf('Ask an AI directly') !== -1, 'the section is now labelled "Ask an AI directly"');
  ok(SRC.indexOf('Copy, paste into any AI chat') !== -1, 'step 1 label is de-branded and simplified');
  ok(SRC.indexOf('Paste its reply back here') !== -1, 'step 2 label is de-branded and simplified');
  ok(SRC.indexOf('Copied. Paste into any AI chat') !== -1, 'the copy-confirmation toast is de-branded');
  ok(SRC.indexOf('Paste what your AI gave you.') !== -1, 'the empty-paste error message is de-branded');
  ok(SRC.indexOf('AI-driven adaptive programs') !== -1, 'the page meta description is de-branded');
}

// ---------- 3. Opening-sequence hierarchy: eyebrow title, promoted question ----------
{
  ok(/\.sheet h2 \{ font-family: var\(--font-body\); font-weight: 600; font-size: 13px; color: var\(--ink-dim\); margin: 8px 0 2px; letter-spacing: \.01em; \}/.test(SRC),
    'sheet <h2> is now a quiet 13px frame label, not a competing 20px/700 headline');
  ok(/\.wstep__q \{ font-family: var\(--font-display\); font-weight: 700; font-size: var\(--fs-h1\); line-height: var\(--lh-h1\); margin: 0 0 14px; letter-spacing: -\.01em; \}/.test(SRC),
    'the wizard question (.wstep__q) is promoted to --fs-h1, the app\'s real hero-heading scale');
}

// ---------- 4. Options are individually outlined, but still one flush group ----------
// James, after seeing the mockup: "the options need to be outlined just not
// separate" -- each of the 3 plan-choice/goal cards gets its own visible
// border so they read as distinct choices, but they stay in the same
// segmented group (same tight 3px gap) rather than becoming floating,
// separated cards.
{
  ok(/\.seg--goal button \{ display: flex; flex-direction: column; align-items: center; gap: 3px; padding: 12px 10px; border: 1px solid var\(--line-strong\); \}/.test(SRC),
    'each .seg--goal option (plan-choice AND goal-picker, same shared class) has its own visible border');
  ok(/\.seg--goal button\[aria-pressed="true"\] \{ border-color: var\(--ink\); \}/.test(SRC),
    'the selected option\'s border brightens to --ink on top of the existing ring, so the outline itself also signals selection');
  ok(/\.seg \{ display: inline-flex; background: var\(--surface-2\); border: 1px solid var\(--line\); border-radius: var\(--radius\); padding: 3px; gap: 3px; \}/.test(SRC),
    'the shared group container still uses the same tight 3px gap -- outlining the options did not space them apart into separate cards');
}

// ---------- 5. Coach-span untouched -- this is presentation/copy only ----------
{
  const { execFileSync } = require('child_process');
  const spanMd5 = execFileSync('sh', ['-c', "sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5"]).toString().trim();
  ok(spanMd5 === '1081700e58396438a0b408febcfdc56b', 'coach-span md5 unchanged (1081700e58396438a0b408febcfdc56b), got ' + spanMd5);
}

console.log(`Build sheet opening-sequence fixes: ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
