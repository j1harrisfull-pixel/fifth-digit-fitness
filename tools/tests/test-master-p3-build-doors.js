// Master Ticket 2026-07-13, Priority 3 -- "two Build doors, not nine." Of the
// entry points audited, only one was a genuine, harmful duplicate: when the
// week is fully done, the Home hero's own "Build next week" CTA and the
// standing Build row below the week list (buildRowHtml, shipped in v1.15)
// were BOTH visible at once, both doing the exact same thing (openPlan()).
// The other "entry points" the audit counted (fresh-install's two honest
// doors, the substitute/swap link, onboarding's own builder step) are each a
// genuinely distinct job, not duplicates, and are deliberately left alone.
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

// ---------- 1. ctaLabel no longer has a weekDone branch ----------
{
  ok(/var ctaLabel = started \? "Continue" : "View the session";/.test(SRC),
     'ctaLabel is computed from started/not-started only -- no weekDone branch (was: weekDone ? "Build next week" : ...)');
  // Scoped to code, not comments -- "Build next week" only survives now in
  // explanatory prose describing what was removed and why.
  ok(!/"Build next week"/.test(SRC.replace(/^\s*\/\/.*$/gm, '')),
     'the "Build next week" hero copy is gone entirely from live code -- the Build row is the one door now');
}

// ---------- 2. The hero renders NO cta button element at all when weekDone ----------
{
  const fnSrc = extractFn('renderHomeHero');
  ok(/\(weekDone \? "" : '<button type="button" class="today-card__cta" id="homeHeroCta">'/.test(fnSrc),
     'renderHomeHero() renders an empty string (no button) in place of the CTA when weekDone -- not a hidden/disabled button, genuinely absent');
}

// ---------- 3. The Build row (v1.15) is unchanged and still the standing door ----------
{
  ok(/function buildRowHtml\(\)/.test(SRC), 'buildRowHtml() still exists unchanged');
  ok(/class="build-row" id="homeBuildRow"/.test(SRC), 'the Build row markup is unchanged');
}

// ---------- 4. Coach-span untouched ----------
{
  const spanMd5 = execSync(`sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5`).toString().trim();
  ok(spanMd5 === '1081700e58396438a0b408febcfdc56b', 'coach-span md5 unchanged (1081700e58396438a0b408febcfdc56b), got ' + spanMd5);
}

// ---------- 5. No new localStorage key introduced -- pure display-layer cut ----------
{
  const setItemCalls = SRC.match(/localStorage\.setItem\([^,]+,/g) || [];
  ok(setItemCalls.length === 10, 'localStorage.setItem call count unchanged at 10 (Batch A: tl:liveSid; Batch D: quarantine-recovery restore; Batch F: tl:a2hsHinted install-hint flag) (got ' + setItemCalls.length + ')');
}

console.log(`Master Ticket P3 (Build doors dedupe): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
