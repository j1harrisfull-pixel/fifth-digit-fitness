// Master Ticket 2026-07-13, Priority 1 -- "never lose the user's place." An
// unmissable "workout in progress -- resume" strip on Home/Preview whenever
// any session in the current week has real logged work (at least one
// completed SET) but isn't finished. Deliberately keys off countCompletedSets
// + isSessionFinished (the same honest per-set signal the week-row BANKED
// label and finish receipt already use) -- NOT sessionProgress()'s
// done/total, which counts fully-finished EXERCISES and would miss the most
// common in-progress moment: one set into your first exercise.
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

// ---------- 1. Markup exists, sits outside .view-week (survives Preview's hide-all gate) ----------
{
  const navStart = SRC.indexOf('id="resumeStrip"');
  ok(navStart > -1, 'resumeStrip element exists');
  const tagStart = SRC.lastIndexOf('<button', navStart);
  const tagEnd = SRC.indexOf('>', navStart);
  const openTag = SRC.slice(tagStart, tagEnd);
  ok(!/class="[^"]*view-week/.test(openTag), 'resumeStrip has no .view-week class -- stays visible under .app[data-mode="preview"] .view-week{display:none!important}');
  ok(/hidden/.test(openTag), 'resumeStrip starts hidden by default (markup)');
}

// ---------- 2. findInProgressSession() uses the honest per-set signal, not exercise-count ----------
{
  const fnSrc = extractFn('findInProgressSession');
  ok(/isSessionFinished\(/.test(fnSrc), 'findInProgressSession() checks isSessionFinished() -- the established finishedAt signal');
  ok(/countCompletedSets\(/.test(fnSrc), 'findInProgressSession() uses countCompletedSets() -- the same honest per-set reduction the week-row BANKED label and finish receipt already use');
  ok(!/sessionProgress\([^)]*\)\.done\s*>\s*0[^;]*&&[^;]*sessionProgress/.test(fnSrc), 'sanity: not gated on sessionProgress().done alone (would miss "1 set into exercise 1")');
}

// ---------- 3. renderResumeStrip() only shows on Home/Preview, never inside the live day view ----------
{
  const fnSrc = extractFn('renderResumeStrip');
  ok(/state\.view !== "day"/.test(fnSrc), 'renderResumeStrip() is gated on state.view !== "day"');
  ok(/hasProgram\(\)/.test(fnSrc), 'renderResumeStrip() is gated on hasProgram() -- never shows on a fresh install');
}

// ---------- 4. renderAll() calls renderResumeStrip() every render pass ----------
{
  const renderAllSrc = extractFn('renderAll');
  ok(/renderResumeStrip\(\)/.test(renderAllSrc), 'renderAll() calls renderResumeStrip() -- kept in sync with every other view-dependent render');
}

// ---------- 5. Tapping the strip resumes the exact session via the existing openDay() ----------
{
  const wireStart = SRC.indexOf('$("resumeStrip").addEventListener');
  ok(wireStart > -1, 'resumeStrip has a click handler wired');
  const wireSrc = SRC.slice(wireStart, wireStart + 500);
  ok(/openDay\(idx\)/.test(wireSrc), 'resumeStrip click calls the existing openDay(idx) -- no new/duplicate day-opening path');
  ok(/data-resume-idx/.test(wireSrc), 'resumeStrip click reads the session index the render pass stamped onto the element');
}

// ---------- 6. Coach-span untouched (this work is entirely outside the span) ----------
{
  const spanMd5 = execSync(`sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5`).toString().trim();
  ok(spanMd5 === '909fbc92112ba642ed56d6d88b114fb1', 'coach-span md5 unchanged (909fbc92112ba642ed56d6d88b114fb1), got ' + spanMd5);
}

// ---------- 7. No new localStorage key introduced -- this reads only what's already persisted ----------
{
  const setItemCalls = SRC.match(/localStorage\.setItem\([^,]+,/g) || [];
  ok(setItemCalls.length === 10, 'localStorage.setItem call count unchanged at 10 (Batch A: tl:liveSid; Batch D: quarantine-recovery restore; Batch F: tl:a2hsHinted install-hint flag) (got ' + setItemCalls.length + ') -- the resume strip reads existing state.log, it does not persist anything new');
}

console.log(`Master Ticket P1 (resume strip): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
