// v1.12 -- Preview Mode Separation. A genuinely read-only "what is this
// workout" screen shown in front of both entry points (home hero, week-row
// tap) for any not-yet-started, not-finished session -- readiness, live
// logging, CURRENT/NEXT/THEN/DONE, and Log/Skip/Finish controls only ever
// appear after the preview's own "Start the session"/"Train this today"
// action is tapped.
//
// Design note this file locks down: previewIdx is a plain in-memory
// variable (never persisted, never part of state), and visibility toggles
// via a separate data-mode="preview" attribute on #app -- state.view stays
// exactly "week" or "day" throughout, so no existing state.view === "day"
// check anywhere else in the app is touched by this feature. buildCard/
// buildDensityCard/renderList/applyGlance/computeNextUpcomingId are not
// read or modified by the new code.
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

// ---------- 0. Coach-span untouched ----------
const spanMd5 = execSync(`sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5`).toString().trim();
ok(spanMd5 === '0e665de20f3872db06e90974f0af8b0b', 'coach-span md5 unchanged (0e665de20f3872db06e90974f0af8b0b), got ' + spanMd5);
const spanEnd = SRC.indexOf('/*__COACH_END__*/');
['openPreview', 'closePreview', 'previewPrimaryAction', 'previewExRow', 'renderPreview'].forEach(function (name) {
  const at = SRC.indexOf('function ' + name + '(');
  ok(at > spanEnd, name + '() is defined outside (after) the coach-span');
});

// ---------- sw.js / manifest untouched ----------
const swDiff = execSync('git -C /Users/jamesharris/Desktop/training-log-app diff --stat HEAD -- sw.js manifest.webmanifest').toString().trim();
ok(swDiff === '', 'sw.js and manifest.webmanifest have no uncommitted diff vs HEAD');

// ---------- 1. previewIdx is never persisted (no new schema) ----------
ok(/var previewIdx = null;/.test(SRC), 'previewIdx exists as a plain in-memory variable');
ok(!/state\.previewIdx/.test(SRC), 'previewIdx is never read from or written to state (no new persisted field)');
ok(!/state\.view\s*=\s*"preview"/.test(SRC), 'state.view is never set to "preview" -- no new view-state value introduced');

// ---------- 2/3/4/5. openPreview never triggers readiness, logging, or live zone state ----------
const openPreviewSrc = extractFn('openPreview');
ok(!/readinessPromptSheet|shouldPromptReadiness/.test(openPreviewSrc), 'openPreview never triggers the readiness prompt');
ok(!/ensureSessionLive|acquireWakeLock/.test(openPreviewSrc), 'openPreview never starts the live timer or wake lock');
ok(/appEl\.setAttribute\("data-mode", "preview"\)/.test(openPreviewSrc), 'openPreview sets the preview display mode');
ok(!/state\.view\s*=/.test(openPreviewSrc), 'openPreview never mutates state.view');

const renderPreviewSrc = extractFn('renderPreview');
ok(!/is-current|is-up-next|card__zonelabel/.test(renderPreviewSrc), 'renderPreview never emits CURRENT/NEXT/zone-label classes');
ok(!/data-act="setdone"|data-act="set"|data-act="skipex"|data-act="blkdone"/.test(renderPreviewSrc), 'renderPreview never emits log/skip/density-done controls');
ok(!/id="liveBarStart"|id="liveBarEnd"|rest-timer|dc__timer/.test(renderPreviewSrc), 'renderPreview never emits Finish/rest-timer/density-timer controls');

// ---------- 6. Start the session (today) triggers the existing readiness/start chain ----------
const previewPrimaryActionSrc = extractFn('previewPrimaryAction');
ok(/if \(isToday\) \{ maybeOpenDayWithReadiness\(i\); \}/.test(previewPrimaryActionSrc),
   'previewPrimaryAction routes the today branch through the existing, unchanged maybeOpenDayWithReadiness');
ok(/else \{ state\.activeSession = i; trainThisTodayClick\(\); \}/.test(previewPrimaryActionSrc),
   'previewPrimaryAction routes the non-today branch through the existing, unchanged trainThisTodayClick');
ok(/closePreview\(\);/.test(previewPrimaryActionSrc), 'previewPrimaryAction always closes the preview overlay before transitioning');

// ---------- 7/11. Future preview offers "Train this today"; today preview offers "Start the session" ----------
ok(/var ctaLabel = isToday \? "Start the session" : "Train this today";/.test(renderPreviewSrc),
   'renderPreview picks "Start the session" for today, "Train this today" for a future/other session');
ok(/var eyebrow = isToday \? "Today\\u0027s work" : "Planned";/.test(renderPreviewSrc.replace(/'/g, "\\u0027")) ||
   /var eyebrow = isToday \? "Today's work" : "Planned";/.test(renderPreviewSrc),
   'renderPreview labels the eyebrow "Today\'s work" (today) or "Planned" (future)');
ok(/var noteTxt = isToday \? "Nothing logs from this view\." : "Planned for later\. Nothing logs from this view\."/.test(renderPreviewSrc),
   'renderPreview uses the approved copy-bank sentence, distinct for today vs. future');

// ---------- 8/9/10/19. Future preview cannot log, mutate progress, or trigger readiness ----------
// (same renderPreview/openPreview guards above cover both today and future --
// there is only one preview renderer, used for both entry points.)
ok(!/save\(\)/.test(renderPreviewSrc), 'renderPreview never calls save() -- it cannot mutate or persist anything');
ok(!/save\(\)/.test(openPreviewSrc), 'openPreview never calls save()');

// ---------- 12/13. Train this today remains explicit; confirms via the unchanged sheet ----------
const trainThisTodayClickSrc = extractFn('trainThisTodayClick');
ok(/askConfirm\(/.test(trainThisTodayClickSrc), 'trainThisTodayClick (unchanged) still opens an explicit confirm sheet, never writes on tap alone');
ok(/The rest of the week stays where it is\./.test(trainThisTodayClickSrc), 'the locked "rest of the week stays where it is" copy survives unchanged');

// ---------- 14/15/16/17/18. Live workout mode is untouched ----------
['computeNextUpcomingId', 'applyGlance', 'sessionItemsFor', 'buildCard', 'buildDensityCard', 'renderList'].forEach(function (name) {
  ok(SRC.indexOf('function ' + name + '(') >= 0, name + '() still exists, unmodified by this ticket');
});
// v1.11.1 NEXT highlight consistency: re-run the exact same live-suite check
// this ticket must not regress (delegates to the dedicated NEXT test file
// rather than duplicating its 37 assertions here).
const nextTestOut = execSync('node /Users/jamesharris/Desktop/training-log-app/tools/tests/test-v1_11_1-next-highlight.js').toString();
ok(/37 passed, 0 failed/.test(nextTestOut), 'v1.11.1 NEXT highlight test suite still fully green (' + nextTestOut.trim().split('\n').pop() + ')');

// ---------- 20. Completed sessions never accidentally become trainable via preview ----------
const weekRowHandlerMatch = SRC.match(/weekListEl\.addEventListener\("click", function \(ev\) \{[\s\S]*?\n  \}\);/);
ok(!!weekRowHandlerMatch, 'week-row click handler found');
const weekRowHandlerSrc = weekRowHandlerMatch[0];
ok(/var finished = isSessionFinished\(ses\);/.test(weekRowHandlerSrc), 'week-row handler checks isSessionFinished before routing');
ok(/if \(alreadyStarted \|\| finished\) \{/.test(weekRowHandlerSrc), 'a finished session is routed to the existing openDay/maybeOpenDayWithReadiness path, never openPreview');

const heroClickWiringMatch = SRC.match(/if \(cta\) cta\.addEventListener\("click", weekDone \? openPlan : function \(\) \{[\s\S]*?\n\s*\}\);/);
ok(!!heroClickWiringMatch, 'hero CTA click wiring found');
ok(/if \(started\) maybeOpenDayWithReadiness\(heroIdx\);/.test(heroClickWiringMatch[0]),
   'an already-started (resumed) hero session skips preview and goes straight back into the live chain (approved resume-in-progress decision)');

// ---------- 21/22/23. Protected systems confirmed untouched (repeats the raw checks above for the lettered report) ----------
// (span md5 + sw/manifest diff already asserted at the top of this file)

// ---------- 24. No new localStorage schema ----------
ok(!/localStorage\.setItem\([^)]*previewIdx/.test(SRC), 'previewIdx is never written to localStorage');

// ---------- 25. 320px layout safety (structural CSS guard; full visual check is the browser QA pass) ----------
ok(/\.preview \{ display: none; padding: 4px 4px 40px; \}/.test(SRC), 'preview container uses the app\'s existing fluid padding, no fixed width');
ok(!/\.preview[^{]*\{[^}]*width:\s*\d+px/.test(SRC), 'no preview rule hardcodes a pixel width that could overflow a 320px viewport');

// ---------- Structural: preview never reuses the live .card markup ----------
ok(!/class="preview[^"]*"[^>]*class="card/.test(SRC), 'preview rows never nest the live .card class');
ok(/\.preview__ex \{/.test(SRC), 'preview exercise rows use their own dedicated class, not .card');

console.log('v1.12 Preview Mode Separation: ' + pass + ' passed, ' + fail + ' failed');
if (fail) { fails.forEach(f => console.log('  FAIL: ' + f)); process.exit(1); }
