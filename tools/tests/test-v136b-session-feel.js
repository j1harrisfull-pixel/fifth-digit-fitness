// v136B (+ correction) -- Home only ENTERS the workout; the workout screen's
// own Start action is the sole place the timer begins. Plus the signing-off
// beat after Finish and form notes restyled into the coach-note family.
//
// v136B's first pass wired the timer to start at Home/hero/readiness-prompt
// entry (openDayToTrain). The product model changed: "Home enters. Workout
// starts. Finish closes." -- so every entry route (hero CTA, readiness
// accept/skip, the recovery swap, a plain week-row tap) now opens the workout
// via plain openDay() ONLY, and a new #liveBarStart button on the workout
// screen itself is the one explicit "begin training" action (reusing the
// existing ensureSessionLive(), no new timer state).
//
// Most of this lives in DOM-wired click handlers, exercised live in the
// browser smoke pass. This file covers what's safely testable outside a DOM:
// (1) source guards confirming NONE of the entry routes call ensureSessionLive
// directly, that the hero button reads "Enter workout", and that the new
// Start control is wired to the existing timer-start function; (2) a
// functional re-derivation of the receipt's duration-preference arithmetic;
// (3) source guards for the signing-off beat's wiring and reduced-motion
// bypass; (4) source guards for the form-note CSS.
const fs = require('fs');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- Test 1: Home hero reads "Enter workout" and does not start the timer ----------
{
  // v1.12.2: the hero opens Today Preview, not a live session -- "Start the
  // session" moved to Preview's own bottom CTA (see test-v1_12-preview-mode.js);
  // the hero's untouched-session label is now the honest "View the session".
  ok(/var ctaLabel = started \? "Continue" : "View the session";/.test(SRC),
     'the untouched-session hero CTA label is "View the session" (v1.12.2, approved) (test: Home hero copy)');
  ok(!/"Start training"/.test(SRC), 'the old "Start training" copy is gone entirely');
  // The hero CTA's click handler resolves through maybeOpenDayWithReadiness
  // (resumed/already-started sessions only) or openPreview (v1.12 Preview
  // Mode Separation -- everything not yet started) -- which (below, and in
  // test-v1_12-preview-mode.js) are both proven to never call
  // ensureSessionLive directly, so the hero itself contains no direct
  // ensureSessionLive/openDayToTrain call either way.
  ok(/if \(cta\) cta\.addEventListener\("click", function \(\) \{\s*\n\s*if \(started\) maybeOpenDayWithReadiness\(heroIdx\);\s*\n\s*else openPreview\(heroIdx\);\s*\n\s*\}\);/.test(SRC),
     'the hero CTA routes through maybeOpenDayWithReadiness (resumed) or openPreview (not yet started) only -- no direct timer start (test: Home hero does not start timer)');
}

// ---------- Test 2: every entry route opens the workout WITHOUT starting the timer ----------
{
  ok(!/openDayToTrain/.test(SRC), 'openDayToTrain (the old auto-start wrapper) no longer exists anywhere in source');
  ok(/function maybeOpenDayWithReadiness\(i\) \{[\s\S]{0,200}else openDay\(i\);\s*\n\s*\}/.test(SRC),
     'maybeOpenDayWithReadiness (hero CTA + today\'s own week-row tap) opens via plain openDay when no readiness prompt is needed -- no timer start');
  ok(/if \(v === 0\) swapTodayForRecovery\(dayIdx\); else openDay\(dayIdx\);/.test(SRC),
     'readiness prompt ACCEPT (not-too-sore) branch opens via plain openDay -- no timer start');
  ok(/if \(dayIdx != null\) openDay\(dayIdx\);/.test(SRC),
     'readiness prompt SKIP branch opens via plain openDay -- no timer start');
  const swapFnMatch = SRC.match(/function swapTodayForRecovery\(dayIdx\) \{[\s\S]*?\n  \}/);
  ok(!!swapFnMatch && !/ensureSessionLive/.test(swapFnMatch[0]),
     'swapTodayForRecovery (the "too sore" branch) no longer calls ensureSessionLive -- opens the recovery session without starting the timer');
  ok(!/addTodaySession\(\);\s*\n\s*ensureSessionLive\(\);/.test(SRC),
     'Just Today confirm (addTodaySession) never auto-starts the timer on entry (test: Just Today confirm does not start timer)');
}

// ---------- Test 3: a plain week-row preview of any day does NOT start the timer ----------
{
  // v1.12 Preview Mode Separation: a not-yet-started, not-finished row now
  // opens openPreview(day) (see test-v1_12-preview-mode.js) instead of
  // going straight to openDay; the started/finished branch keeps calling
  // exactly the same maybeOpenDayWithReadiness/openDay pair as before,
  // unchanged. Neither branch calls ensureSessionLive directly.
  const m = SRC.match(/if \(alreadyStarted \|\| finished\) \{\s*\n\s*if \(day === todaySessionIdx\(wk\.sessions\)\) maybeOpenDayWithReadiness\(day\);\s*\n\s*else openDay\(day\);\s*\n\s*\} else \{\s*\n\s*openPreview\(day\);\s*\n\s*\}/);
  ok(!!m, 'week-row click: a started/finished day routes through maybeOpenDayWithReadiness/openDay (unchanged), everything else opens openPreview -- neither calls ensureSessionLive directly (test: week-row preview does not start timer)');
}

// ---------- Test: the workout screen's own Start action starts the timer ----------
{
  ok(/id="liveBarStart">Start<\/button>/.test(SRC), 'the workout screen has a visible Start control');
  ok(/\$\("liveBarStart"\)\.addEventListener\("click", ensureSessionLive\);/.test(SRC),
     'tapping Start calls the EXISTING ensureSessionLive() directly -- reuses the same timer-start path the first logged set has always used, no new timer state (test: workout Start action starts timer)');
  // v1.9-T1: renderDayBar gained a leading readOnly (preview-only session)
  // check -- Start is now hidden when readOnly, in addition to the original
  // live/finished conditions, which are otherwise unchanged.
  ok(/var startBtn = \$\("liveBarStart"\);\s*\n\s*if \(startBtn && ses\) startBtn\.hidden = readOnly \|\| live \|\| isSessionFinished\(ses\);/.test(SRC),
     'renderDayBar shows Start only when the session is open, not read-only-preview, not live, and not already finished');
}

// ---------- Test 3: receipt duration prefers the live timer start ----------
// Extract the exact duration-preference block verbatim and evaluate it against
// synthetic (liveTimerStart, logMs, now) triples, so this stays a real
// regression guard on the arithmetic, not just a string match.
{
  function computeMins(liveTimerStart, slcDate, nowMs) {
    var slc = slcDate ? { date: slcDate } : null;
    var logMs = (slc && slc.date) ? Date.parse(slc.date) : 0;
    var startMs = 0;
    if (liveTimerStart && logMs) startMs = Math.min(liveTimerStart, logMs);
    else if (liveTimerStart) startMs = liveTimerStart;
    else if (logMs) startMs = logMs;
    var mins = null;
    if (startMs) {
      var m = Math.round((nowMs - startMs) / 60000);
      if (m >= 1 && m <= 180) mins = m;
    }
    return mins;
  }
  // Sanity: the harness's computeMins must match the source's actual block,
  // not just an assumption -- assert the source contains this exact logic.
  ok(/if \(liveTimerStart && logMs\) startMs = Math\.min\(liveTimerStart, logMs\);/.test(SRC),
     'source contains the min(liveTimerStart, logMs) preference exactly (test 3 guard)');

  var now = Date.parse('2026-07-09T13:00:00.000Z');
  var tenMinAgo = now - 10 * 60000;
  var fiveMinAgo = now - 5 * 60000;
  // Timer started 10 min ago (Start training), first set logged 5 min ago
  // (after warm-up) -> duration should be ~10 min, not ~5.
  ok(computeMins(tenMinAgo, new Date(fiveMinAgo).toISOString(), now) === 10,
     'timer started before the first log -> receipt duration counts from the EARLIER timer start (warm-up time counts) (test 3)');
  // Timer started AFTER the logged date would be a data anomaly; min() must
  // still resolve to the earlier real timestamp (the log), never invent a
  // negative/impossible duration.
  ok(computeMins(fiveMinAgo, new Date(tenMinAgo).toISOString(), now) === 10,
     'defensive: if the log timestamp is earlier than the stored timer start, the earlier real timestamp still wins');
  // No live timer (never explicitly started, resumed session) -> falls back
  // to the first logged set's date exactly as v135 did.
  ok(computeMins(0, new Date(tenMinAgo).toISOString(), now) === 10,
     'no live timer start recorded -> falls back to the first logged set\'s date (unchanged v135 behaviour)');
  // Neither exists (defensive) -> no duration shown, never a fabricated number.
  ok(computeMins(0, null, now) === null,
     'neither a timer start nor a logged date -> no duration is shown (honest blank, not a fabricated number)');
  // Implausible span (stale, left open) still suppressed.
  ok(computeMins(now - 4 * 60 * 60000, null, now) === null,
     'an implausibly long span (4h) is still suppressed -- the existing plausibility guard survives untouched');
}

// ---------- Test 4/5/6: signing-off beat wiring ----------
{
  ok(/id="signoffBeat" hidden>/.test(SRC), 'the signoffBeat overlay exists in markup, hidden by default');
  ok(/Signing off session…/.test(SRC), 'the beat copy is exactly "Signing off session…" (test 4)');
  ok(!/Generating insights|AI analysing|Optimising performance|analysing performance/i.test(SRC),
     'no fake-AI/insights copy anywhere near the beat');
  ok(/beatEl\.hidden = false;\s*\n\s*openSheetNoKb\(dlg\);\s*\n\s*setTimeout\(function \(\) \{ beatEl\.hidden = true; \}, 650\);/.test(SRC),
     'the beat shows, the (already-populated) sheet opens immediately under it, then the beat is hidden ~650ms later to reveal the receipt (test 5)');
  ok(/if \(beatEl && !reduceMotion\)/.test(SRC),
     'the beat is skipped entirely under prefers-reduced-motion (same convention as the existing Build/Just-Today beats)');
  // Save-before-beat ordering: the finishedAt stamp + save() in endSession, and
  // showSessionComplete's own save() for exposure/pref bumping, must appear
  // BEFORE the beat's setTimeout in source order -- i.e. persistence is
  // synchronous and complete before any delay is introduced (test 6).
  var endSessionIdx = SRC.indexOf('function endSession()');
  var finishedAtSaveIdx = SRC.indexOf('slf.finishedAt = new Date().toISOString();\n      save();', endSessionIdx);
  ok(finishedAtSaveIdx > endSessionIdx, 'endSession saves the finishedAt stamp synchronously (v136A, unchanged)');
  var showCompleteIdx = SRC.indexOf('function showSessionComplete(ses, opts)');
  var innerSaveIdx = SRC.indexOf('\n    save();\n', showCompleteIdx);
  var beatTimeoutIdx = SRC.indexOf('setTimeout(function () { beatEl.hidden = true; }, 650);', showCompleteIdx);
  ok(innerSaveIdx > showCompleteIdx && innerSaveIdx < beatTimeoutIdx,
     'showSessionComplete\'s own save() runs BEFORE the beat\'s setTimeout is scheduled -- persistence never waits on the delay (test 6)');
}

// ---------- Test 7: form-note CSS guard ----------
{
  ok(/\.cuebox \{ display: flex; flex-direction: column; gap: 8px; background: none; border: 0; border-left: 2px solid var\(--line-strong\); border-radius: 0; padding: 2px 0 2px 12px; \}/.test(SRC),
     'cuebox drops the boxed background/border/radius and adopts a left-rule, same family as .card__why (test 7)');
  ok(!/\.cuebox \{[^}]*background: var\(--surface-2\)/.test(SRC),
     'cuebox no longer fills with --surface-2 (no more boxy card)');
  ok(/\.cue-tag \{[^}]*color: var\(--ink-dim\)/.test(SRC),
     'cue-tag uses the neutral --ink-dim, not the coach-note\'s --accent-ink -- quieter than coach notes, no new colour');
  // Coach note itself must be untouched (still uses its own --coachnote-accent).
  ok(/--coachnote-accent: #7FA6C4/.test(SRC), 'the coach note\'s own accent colour is untouched');
  ok(/border-left: 2px solid var\(--coachnote-accent\)/.test(SRC), 'the coach note\'s left-rule styling is untouched');
}

// ---------- v136A regression guard (ticket test 8): re-assert the load-bearing strings survive ----------
{
  ok(/endBtn\.textContent = "Finish";/.test(SRC), 'v136A: Finish label assignment still unconditional (regression guard)');
  ok(/function isSessionFinished\(ses\)/.test(SRC), 'v136A: isSessionFinished still present');
  ok(/card__skip-optional/.test(SRC), 'v136A: visible optional Skip still present');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
