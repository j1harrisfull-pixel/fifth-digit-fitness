// Master Ticket Priority 5 (13 July 2026) -- "the week as a rhythm, not a
// list": a small bar-shape above the week list, taller bars for longer
// sessions, flat gaps for rest days, instead of only reading each row's own
// minutes. Pure presentation -- reads sessions[].blocks[].minutes (already
// computed by the coach engine) and the existing trainDays scheduling; no new
// coach logic, so the coach-span md5 must be untouched by this ticket.
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

// ---------- 1. Markup: the host element exists, starts hidden ----------
{
  ok(/<div class="rhythm view-week" id="weekRhythm" hidden>/.test(SRC), '#weekRhythm host exists, starts hidden (no empty strip flash before data)');
}

// ---------- 2. sessionMinutes() sums block minutes, matching the existing hero total (heroTotalMin) computation ----------
{
  const fn = extractFn('sessionMinutes');
  ok(/Array\.isArray\(ses\.blocks\)/.test(fn), 'sessionMinutes() reads the same ses.blocks[] the hero already sums for heroTotalMin');
  ok(/if \(typeof b\.minutes === "number"\) m \+= b\.minutes;/.test(fn), 'sums every block\'s .minutes, no new duration model');
}

// ---------- 3. renderWeekRhythm(): hides on empty week, builds a real Mon-first shape when scheduled ----------
{
  const fn = extractFn('renderWeekRhythm');
  ok(/if \(!sessions\.length\) \{ host\.hidden = true;/.test(fn), 'an empty week hides the strip instead of rendering an empty bar row');
  ok(/programTrainDays\(\)/.test(fn), 'reuses the existing programTrainDays() -- no new scheduling concept');
  ok(/WEEKDAY_ORDER\.map/.test(fn), 'a scheduled program gets a real Mon-first 7-slot week shape');
  ok(/si == null \? \{ rest: true/.test(fn), 'an unscheduled weekday on a scheduled program renders as an honest rest gap, not a missing slot');
  ok(/cols = sessions\.map\(function \(s, i\) \{ return \{ rest: false, label: String\(i \+ 1\)/.test(fn), 'an unscheduled ("flexible pace") program falls back to plain session order, no invented calendar');
}

// ---------- 4. Bar height is proportional to minutes, with an honest floor so a short session is still visible/tappable ----------
{
  const fn = extractFn('renderWeekRhythm');
  ok(/Math\.max\(16, Math\.round\(mins\[c\.idx\] \/ maxMin \* 100\)\)/.test(fn), 'bar height is % of the week\'s longest session, floored at 16% so a short day never renders as an invisible sliver');
}

// ---------- 5. Rest columns are not clickable; real day columns are, and share the SAME routing as the week-list rows ----------
{
  const fn = extractFn('renderWeekRhythm');
  ok(/if \(c\.rest\) return '<div class="rhythm__col rhythm__col--rest">/.test(fn), 'a rest column renders as a plain <div>, not a <button> -- nothing to tap');
  ok(/<button type="button" class="rhythm__col/.test(fn), 'a real day column is a real <button>');
  const clickFn = SRC.slice(SRC.indexOf('$("weekRhythm").addEventListener'), SRC.indexOf('$("weekRhythm").addEventListener') + 300);
  ok(/openWeekDayFromList\(parseInt\(col\.getAttribute\("data-day"\), 10\)\)/.test(clickFn), 'tapping a rhythm bar calls the exact same openWeekDayFromList() the week-list rows use -- identical routing, not a second implementation');
  ok(/col\.classList\.contains\("rhythm__col--rest"\)/.test(clickFn), 'the click handler explicitly bails on a rest column even if something else ever adds a stray listener there');
}

// ---------- 6. renderWeekList() always calls renderWeekRhythm() first -- the strip can never go stale relative to the list ----------
{
  const fn = extractFn('renderWeekList');
  ok(/renderWeekRhythm\(sessions\)/.test(fn), 'renderWeekList() renders the rhythm strip from the exact same `sessions` array it renders the list from');
}

// ---------- 7. Coach-span untouched -- this is UI/presentation only, no new coach logic ----------
{
  const spanMd5 = execSync(`sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5`).toString().trim();
  ok(spanMd5 === '62fa16a3f1f9b9952d9060d2bda135e4', 'coach-span md5 unchanged (62fa16a3f1f9b9952d9060d2bda135e4), got ' + spanMd5);
}

// ---------- 8. No new localStorage key -- the strip is a pure re-render of existing session/program data ----------
{
  const setItemCalls = SRC.match(/localStorage\.setItem\([^,]+,/g) || [];
  ok(setItemCalls.length === 7, 'localStorage.setItem call count unchanged at 7 (got ' + setItemCalls.length + ')');
}

console.log(`Priority 5 (week-as-rhythm strip): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
