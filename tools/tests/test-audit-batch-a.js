// UX audit Batch A (13 July 2026, James: "do all"). The single biggest
// "working around the app" pain, red-team confirmed (C1/C5/C7):
// 1. Session survives Home round-trips: backToWeek used to hideRest() +
//    stopLiveTimer(), destroying the running rest countdown and deleting
//    the live-run key -- so the most natural habit (pop Home, tap Resume)
//    reset the clock and re-showed Start. Now backToWeek only PAUSES
//    (hideRestView/pauseLiveTimer keep the persisted endAt/start stamp),
//    and openDay resumes the run for the live session via the same
//    resumeRest()/startLiveTimer(true) path a reload already used. A new
//    tl:liveSid key scopes the run to its session so "live" can't leak
//    onto a different day; opening any other session still ends the run;
//    finishing (showSessionComplete) now ends it explicitly.
// 2. openDay scroll fix: scrollTo(0,0) moved BEFORE renderAll so the
//    smooth scrollToCurrent() is no longer deterministically overridden
//    (the old order meant top always won and the user hunted for their
//    exercise on every entry). Same reorder in switchSession.
// 3. Hot-path saves debounced: the 5 tap-frequency handlers (set, w±,
//    warm, sets±, density setdone) called synchronous save() -- a full
//    JSON.stringify of program+logs+archive plus a whole-blob localStorage
//    re-read, inside the tap handler. All now use saveSoon() (400ms
//    debounce; the existing pagehide flush covers kills).
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

// ---------- 1. Session survival plumbing ----------
{
  ok(/var LIVE_SID_KEY = "tl:liveSid";/.test(SRC), 'the live run is scoped to its session via tl:liveSid');
  const start = extractFn('startLiveTimer');
  ok(/localStorage\.setItem\(LIVE_SID_KEY, lses\.id\)/.test(start), 'startLiveTimer stamps the owning session id');
  const stop = extractFn('stopLiveTimer');
  ok(/removeItem\(LIVE_KEY\); localStorage\.removeItem\(LIVE_SID_KEY\)/.test(stop), 'stopLiveTimer clears both live keys');
  const pause = extractFn('pauseLiveTimer');
  ok(!/removeItem/.test(pause), 'pauseLiveTimer stops the tick WITHOUT deleting the live keys');
  const hrv = extractFn('hideRestView');
  ok(!/clearRestPersist/.test(hrv), 'hideRestView hides the bar WITHOUT clearing the persisted rest');
  const isLive = extractFn('isLiveSession');
  ok(/sid === ses\.id/.test(isLive), 'isLiveSession matches the stored sid against the target session');
}

// ---------- 2. backToWeek pauses; openDay resumes; finish ends ----------
{
  const btw = extractFn('backToWeek');
  ok(/hideRestView\(\); pauseLiveTimer\(\);/.test(btw), 'backToWeek pauses the run instead of destroying it');
  ok(!/\bhideRest\(\);|\bstopLiveTimer\(\);/.test(btw), 'backToWeek no longer calls the destructive hideRest/stopLiveTimer');
  const od = extractFn('openDay');
  ok(/var liveTarget = isLiveSession\(i\);/.test(od), 'openDay detects whether the target session owns the live run');
  ok(/if \(liveTarget\) \{ startLiveTimer\(true\); acquireWakeLock\(\); resumeRest\(\); \}/.test(od), 'openDay resumes clock + rest for the live session (same path a reload uses)');
  ok(/else \{ hideRest\(\); stopLiveTimer\(\); \}/.test(od), 'opening a DIFFERENT session still ends the previous run outright');
  const ssc = extractFn('showSessionComplete');
  ok(/hideRest\(\); stopLiveTimer\(\);/.test(ssc), 'finishing ends the live run explicitly (no longer backToWeek\'s implicit job)');
  const rcd = extractFn('removeCurrentDay');
  ok(/stopLiveTimer\(\)/.test(rcd), 'deleting the current day still ends the run');
}

// ---------- 3. Scroll order: top jump BEFORE render, so scrollToCurrent wins ----------
{
  const od = extractFn('openDay');
  const scrollIdx = od.indexOf('window.scrollTo(0, 0)');
  const renderIdx = od.indexOf('renderAll(true)');
  ok(scrollIdx >= 0 && renderIdx > scrollIdx, 'openDay scrolls to top BEFORE renderAll -- scrollToCurrent\'s smooth scroll is no longer overridden');
  const sw = extractFn('switchSession');
  ok(sw.indexOf('window.scrollTo(0, 0)') < sw.indexOf('renderList(true)'), 'switchSession has the same corrected order');
}

// ---------- 4. Hot-path saves debounced ----------
{
  // Window spans the whole dispatcher: from the first hot branch through the
  // setdone branch (which sits AFTER exhist in source order).
  const handlers = SRC.slice(SRC.indexOf('if (act === "set") {'), SRC.indexOf('function onListInput('));
  ok(/state\.activeExerciseId = e\.id;\s*\n\s*saveSoon\(\); \/\/ Batch A[\s\S]{0,120}var on = sset\.completed;/.test(handlers), 'the set toggle uses saveSoon');
  ok(/wl\.el\.weight \+ \(act === "w\+" \? STEP : -STEP\)\)\); saveSoon\(\)/.test(handlers), 'the w± stepper uses saveSoon');
  ok(/wwl\.el\.warm\[wi\] = !wwl\.el\.warm\[wi\]; saveSoon\(\)/.test(handlers), 'the warm-up tick uses saveSoon');
  ok(/e\.sets = ns; writeLog\(ses, e\); saveSoon\(\)/.test(handlers), 'the sets± stepper uses saveSoon');
  ok(/state\.activeExerciseId = e\.id;\s*\n\s*saveSoon\(\); \/\/ Batch A[\s\S]{0,120}var drow = btn\.closest/.test(handlers), 'the density setdone toggle uses saveSoon');
}

// ---------- 5. Coach-span untouched ----------
{
  const { execFileSync } = require('child_process');
  const spanMd5 = execFileSync('sh', ['-c', "sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5"]).toString().trim();
  ok(spanMd5 === '1081700e58396438a0b408febcfdc56b', 'coach-span md5 unchanged (1081700e58396438a0b408febcfdc56b), got ' + spanMd5);
}

console.log(`UX audit Batch A (session survival + scroll + save debounce): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
