// Build item 2 (13 July 2026) -- finish-moment PR callout, per the research-
// grounded taste-preview pick (Option A: Strava/Hevy/Strong all put a stat
// recap -> PR/achievement callout -> close in that order). Reuses
// .complete__pr-banner -- CSS that already existed for exactly this purpose
// but had no markup wired to it -- and the exact same honestRead.prs data
// the ledger's own "· best yet" tags already use. No new PR-detection logic.
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

// ---------- 1. Markup exists, reuses the existing .complete__pr-banner class ----------
{
  ok(/id="completePrCallout"/.test(SRC), '#completePrCallout element exists');
  const tagStart = SRC.lastIndexOf('<p', SRC.indexOf('id="completePrCallout"'));
  const openTag = SRC.slice(tagStart, SRC.indexOf('>', tagStart));
  ok(/class="complete__pr-banner"/.test(openTag), 'reuses the pre-existing .complete__pr-banner class, not a new one');
  ok(/hidden/.test(openTag), 'starts hidden by default in markup');
}

// ---------- 2. .complete__pr-banner CSS is not newly authored -- it pre-existed ----------
{
  const bannerDefs = (SRC.match(/\.complete__pr-banner\s*\{/g) || []).length;
  ok(bannerDefs === 1, 'exactly one .complete__pr-banner rule exists (got ' + bannerDefs + ') -- reused, not duplicated');
}

// ---------- 3. showSessionComplete populates the callout from honestRead.prs -- no new PR logic ----------
{
  const fnSrc = extractFn('showSessionComplete');
  ok(/var honestRead = buildHonestRead\(ses\);/.test(fnSrc), 'showSessionComplete still calls the existing buildHonestRead() -- no second PR computation');
  const afterHonest = fnSrc.slice(fnSrc.indexOf('var honestRead = buildHonestRead(ses);'));
  ok(/honestRead\.prs\.length/.test(afterHonest), 'the callout is gated on honestRead.prs -- the exact same array the ledger tags use');
  ok(/prCalloutEl\.hidden = false;/.test(afterHonest) && /prCalloutEl\.hidden = true;/.test(afterHonest),
     'the callout is explicitly hidden (not just left at its default) when there are no PRs this session');
}

// ---------- 4. The ledger's own inline "best yet" tags are untouched ----------
{
  ok(/keptTxt \+= " · best yet";/.test(SRC), 'the ledger\'s existing "· best yet" per-row tag is untouched -- this is an addition, not a replacement');
}

// ---------- 5. Coach-span untouched ----------
{
  const spanMd5 = execSync(`sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5`).toString().trim();
  ok(spanMd5 === '62fa16a3f1f9b9952d9060d2bda135e4', 'coach-span md5 unchanged (62fa16a3f1f9b9952d9060d2bda135e4), got ' + spanMd5);
}

// ---------- 6. No new localStorage key -- pure display-layer change ----------
{
  const setItemCalls = SRC.match(/localStorage\.setItem\([^,]+,/g) || [];
  ok(setItemCalls.length === 7, 'localStorage.setItem call count unchanged at 7 (got ' + setItemCalls.length + ')');
}

console.log(`Build item 2 (finish-moment PR callout): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
