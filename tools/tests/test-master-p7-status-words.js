// Master Ticket Priority 7 parked item (13 July 2026) -- James rejected the
// week-row's generic status words ("closed"/"planned") as bureaucratic
// ledger jargon. Research across Hevy/Strong/Fitbod/Future confirmed none of
// them label a day with a status word -- the session's own name/focus IS the
// label, completion is a lightweight visual mark. This test asserts the
// resulting behavior: "closed"/"planned" text is gone, the done-state
// checkmark badge and is-done recede-styling are present, and the
// content-bearing annotations (banked/progress/skipped) are untouched.
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

// ---------- 1. "closed"/"planned" status words are gone from the source ----------
{
  ok(SRC.indexOf('weekrow__anno weekrow__anno--done">') === -1, 'old "closed" span markup (no aria-label) is gone');
  ok(SRC.indexOf('weekrow__anno">planned</span>') === -1, 'old "planned" span markup is gone');
}

// ---------- 2. renderWeekList: done state renders a badge with no visible text, aria-label carries the meaning for a11y ----------
{
  const fn = extractFn('renderWeekList');
  ok(/statHtml = '<span class="weekrow__anno weekrow__anno--done" aria-label="done">' \+ checkIcon \+ '<\/span>'/.test(fn),
    'done state renders just the checkmark icon, no visible word -- aria-label="done" preserves the meaning for screen readers');
}

// ---------- 3. renderWeekList: default/future state renders nothing ----------
{
  const fn = extractFn('renderWeekList');
  ok(/else statHtml = "";/.test(fn), 'future/unscheduled state renders an empty annotation -- the row\'s own name/focus is the only label, per the Hevy/Strong/Fitbod/Future research pattern');
}

// ---------- 4. Content-bearing annotations are untouched -- only the two content-free words were cut ----------
{
  const fn = extractFn('renderWeekList');
  ok(/bankedLabel/.test(fn), 'the "banked · N sets" annotation (real set/round count) is untouched');
  ok(/pr\.done \+ ' \/ ' \+ pr\.total/.test(fn), 'the "N / total" progress annotation (real numbers) is untouched');
  ok(/set aside/.test(fn), 'the "set aside" skipped annotation is untouched');
}

// ---------- 5. is-done class drives a visual recede, not a text change ----------
{
  const fn = extractFn('renderWeekList');
  ok(/var doneCls = \(st\.key === "done" \|\| st\.key === "finished"\) \? " is-done" : "";/.test(fn),
    'a done or early-finished row gets an is-done class on the row itself');
  ok(/\.weekrow\.is-done \.weekrow__name \{ color: var\(--ink-dim\); \}/.test(SRC), 'is-done recedes the row\'s name text (dims, not removed)');
  ok(/\.weekrow\.is-done \.weekrow__focus \{ color: var\(--faint\); \}/.test(SRC), 'is-done recedes the row\'s focus text further still (fainter than the name)');
}

// ---------- 6. Coach-span untouched -- this is presentation-layer copy/CSS, no coach logic changed ----------
{
  const { execSync } = require('child_process');
  const spanMd5 = execSync(`sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5`).toString().trim();
  ok(spanMd5 === 'ce6452b369d4d1d14fd0bf8560208ce7', 'coach-span md5 unchanged (ce6452b369d4d1d14fd0bf8560208ce7), got ' + spanMd5);
}

console.log(`Master Priority 7 parked item (status-word cut): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
