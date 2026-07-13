// Build item 1 (13 July 2026) -- "open ready" home hero, per the research-
// grounded taste-preview pick (Option B: Whoop/Oura/Hevy's zero-tap "today"
// pattern -- one instruction, not an eyebrow+title+meta stack). Scoped to the
// single most common daily state (a session is up next, untouched, week not
// done, not an explicit todayPick) -- every other hero state
// (todayPicked/started/weekDone) keeps its exact existing markup untouched.
const fs = require('fs');
const { execSync } = require('child_process');
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

const heroSrc = extractFn('renderHomeHero');

// ---------- 1. isReadyLead gate exists with the exact right conditions ----------
ok(/var isReadyLead = !weekDone && !todayPicked && !started;/.test(heroSrc),
   'isReadyLead is exactly !weekDone && !todayPicked && !started -- the one common daily state, no other');

// ---------- 2. leadHtml reuses existing data (name, heroTotalMin) -- no new computation ----------
ok(/var leadHtml = isReadyLead/.test(heroSrc), 'leadHtml is gated on isReadyLead');
ok(/esc\(name\)/.test(heroSrc.slice(heroSrc.indexOf('var leadHtml'))), 'leadHtml uses the existing `name` (dayPositionLabel) -- no new session-naming logic');
ok(/heroTotalMin > 0/.test(heroSrc.slice(heroSrc.indexOf('var leadHtml'))), 'leadHtml reuses the existing heroTotalMin computation -- no fabricated time estimate');

// ---------- 3. Every other hero state keeps its exact original markup (label+name+meta) when not isReadyLead ----------
ok(/: '<div class="today-card__label">' \+ esc\(label2\) \+ '<\/div><h2 class="today-card__name">' \+ esc\(name\) \+ '<\/h2>' \+ metaHtml;/.test(heroSrc),
   'the non-lead branch is byte-identical to the pre-existing label+name+meta markup (todayPicked/started/weekDone untouched)');

// ---------- 4. The innerHTML assembly uses leadHtml, not a duplicate label/name/meta ----------
ok(/leadHtml \+\s*\n\s*subHtml/.test(heroSrc), 'renderHomeHero\'s innerHTML assembly uses leadHtml in place of the old separate label/name/meta concatenation');
ok(!/'<div class="today-card__label">' \+ esc\(label2\) \+ '<\/div>' \+\s*\n\s*'<h2 class="today-card__name">'/.test(heroSrc),
   'no leftover duplicate label/name markup exists alongside leadHtml in the innerHTML assembly');

// ---------- 5. CSS: new classes exist, gated correctly, no !important war ----------
ok(/\.today-card__lead \{/.test(SRC), '.today-card__lead CSS rule exists');
ok(/\.today-card__lead-go \{ color: var\(--accent\); \}/.test(SRC), '.today-card__lead-go uses the existing --accent token, not a new color');

// ---------- 6. Coach-span untouched ----------
{
  const spanMd5 = execSync(`sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5`).toString().trim();
  ok(spanMd5 === '8dfbd4f07360fc76d5218c38eea8f0ae', 'coach-span md5 unchanged (8dfbd4f07360fc76d5218c38eea8f0ae), got ' + spanMd5);
}

// ---------- 7. No new localStorage key introduced -- pure display-layer change ----------
{
  const setItemCalls = SRC.match(/localStorage\.setItem\([^,]+,/g) || [];
  ok(setItemCalls.length === 7, 'localStorage.setItem call count unchanged at 7 (got ' + setItemCalls.length + ')');
}

console.log(`Build item 1 (open-ready home): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
