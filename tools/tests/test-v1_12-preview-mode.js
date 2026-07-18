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
ok(spanMd5 === '1081700e58396438a0b408febcfdc56b', 'coach-span md5 unchanged (1081700e58396438a0b408febcfdc56b), got ' + spanMd5);
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
// Priority 5 (13 July 2026, week-as-rhythm) factored this routing logic out of
// the inline click handler into openWeekDayFromList() so the new rhythm strip
// can share it -- same logic, new home, so the check now targets that function.
const weekRowHandlerMatch = SRC.match(/function openWeekDayFromList\(day\) \{[\s\S]*?\n  \}/);
ok(!!weekRowHandlerMatch, 'openWeekDayFromList() found (the shared week-row/rhythm-bar routing function)');
const weekRowHandlerSrc = weekRowHandlerMatch[0];
ok(/var finished = isSessionFinished\(ses\);/.test(weekRowHandlerSrc), 'openWeekDayFromList() checks isSessionFinished before routing');
ok(/if \(alreadyStarted \|\| finished\) \{/.test(weekRowHandlerSrc), 'a finished session is routed to the existing openDay/maybeOpenDayWithReadiness path, never openPreview');

// Master Ticket P3 (2026-07-13): the cta element no longer exists at all when
// weekDone (the hero goes CTA-less, relying on the standing Build row
// instead), so the click wiring is a plain function, not a weekDone ternary.
const heroClickWiringMatch = SRC.match(/if \(cta\) cta\.addEventListener\("click", function \(\) \{[\s\S]*?\n\s*\}\);/);
ok(!!heroClickWiringMatch, 'hero CTA click wiring found');
ok(/if \(started\) maybeOpenDayWithReadiness\(heroIdx\);/.test(heroClickWiringMatch[0]),
   'an already-started (resumed) hero session skips preview and goes straight back into the live chain (approved resume-in-progress decision)');

// ---------- 21/22/23. Protected systems confirmed untouched (repeats the raw checks above for the lettered report) ----------
// (span md5 + sw/manifest diff already asserted at the top of this file)

// ---------- 24. No new localStorage schema ----------
ok(!/localStorage\.setItem\([^)]*previewIdx/.test(SRC), 'previewIdx is never written to localStorage');

// ---------- 25. 320px layout safety (structural CSS guard; full visual check is the browser QA pass) ----------
// v1.15: bottom padding grew to clear the new fixed bottom-nav bar (still
// fluid/safe-area-based, not a fixed width) -- same rule, updated value.
// (#progressView shared this rule until the Progress tab was removed
// 18 July 2026 -- #previewView is on its own again now.)
ok(/#previewView \{ display: none; padding: 4px 4px calc\(env\(safe-area-inset-bottom\) \+ 96px\); \}/.test(SRC), 'preview container uses the app\'s existing fluid padding, no fixed width');
ok(!/#previewView[^{]*\{[^}]*width:\s*\d+px/.test(SRC), 'no preview rule hardcodes a pixel width that could overflow a 320px viewport');

// ---------- Structural: preview never reuses the live .card markup ----------
ok(!/class="preview[^"]*"[^>]*class="card/.test(SRC), 'preview rows never nest the live .card class');
ok(/#previewView \.preview__ex \{/.test(SRC), 'preview exercise rows use their own dedicated class, not .card');

// ---------- v1.12.1 Preview Visual Hierarchy ----------
// Design note: every v1.12.1 CSS rule below is scoped to #previewView, not
// the bare .preview/.preview__title class family -- those pre-existing
// names are also used, independently, by the unrelated #buildPreview /
// Just-Today build-preview dialog (see index.html ~line 1081). The
// original v1.12 CSS collided with that dialog (a bare ".preview {
// display:none }" rule silently hid #buildPreview outside
// data-mode="preview"); fixed by id-scoping every new/changed rule here,
// confirmed by the two guards below.
ok(!/\.preview \{ display: none; padding: 4px 4px 40px; \}/.test(SRC),
   'the original v1.12 unscoped ".preview { display:none }" collision rule is gone (replaced by the #previewView-scoped version)');
ok(!/^\.preview__title \{ font-family: var\(--font-display\)/m.test(SRC),
   'no bare, unscoped .preview__title rule with the new 26px hierarchy survives (would have collided with #buildPreview\'s own title divs)');
ok(/#buildPreview/.test(SRC) && /\.preview \{ margin-top: 12px; padding: 16px;/.test(SRC) && /\.preview__title \{ font-weight: 700; font-size: 15px; \}/.test(SRC),
   'the pre-existing #buildPreview dialog\'s own bare .preview/.preview__title styling survives completely untouched');

// 1. CTA renders after .preview__blocks in renderPreview's output string order.
{
  const contentAssignIdx = renderPreviewSrc.indexOf('$("previewContent").innerHTML =');
  const blocksIdx = renderPreviewSrc.indexOf("'<div class=\"preview__blocks\">", contentAssignIdx);
  const ctaIdx = renderPreviewSrc.indexOf('preview__cta', blocksIdx);
  ok(contentAssignIdx >= 0 && blocksIdx > contentAssignIdx && ctaIdx > blocksIdx,
     'the CTA button string appears AFTER .preview__blocks in renderPreview\'s innerHTML assembly -- content first, action after');
}

// 2/3. Today CTA has no ghost class; future CTA does.
ok(/'<button type="button" class="preview__cta' \+ \(isToday \? "" : " preview__cta--ghost"\) \+ '" id="previewCta">'/.test(renderPreviewSrc),
   'the CTA class is plain "preview__cta" for today, "preview__cta preview__cta--ghost" for a future/other session');
ok(/#previewView \.preview__cta--ghost \{ background: transparent; color: var\(--ink\); border: 1px solid var\(--line-strong\); \}/.test(SRC),
   'the ghost CTA is a genuinely quieter treatment -- transparent fill, hairline border, plain ink text, no accent colour');

// 4/5/6. Summary line built only from ses.blocks[].minutes; total = sum; omitted when blocks absent/empty.
{
  const summaryBlockMatch = renderPreviewSrc.match(/var summaryHtml = "";\s*\n\s*if \(Array\.isArray\(ses\.blocks\) && ses\.blocks\.length\) \{([\s\S]*?)\n    \}/);
  ok(!!summaryBlockMatch, 'renderPreview computes summaryHtml only inside an `Array.isArray(ses.blocks) && ses.blocks.length` guard (omitted otherwise)');
  const summaryBody = summaryBlockMatch ? summaryBlockMatch[1] : '';
  ok(/totalMin \+= b\.minutes/.test(summaryBody), 'the summary total is accumulated purely from b.minutes (no exercise-count derivation)');
  ok(!/\.exercises\.length|\.sets\b/.test(summaryBody), 'the summary block never reads exercise count or set count -- Unit Honesty (minutes only)');
  ok(/summaryHtml = ""/.test(renderPreviewSrc.slice(0, renderPreviewSrc.indexOf('var blocksHtml = "";'))),
     'summaryHtml defaults to empty string, so a session with no ses.blocks renders no summary line at all');
}

// 7/8/9. Block cards render as .preview__block sections with a .preview__block-head carrying the duration.
ok(/'<section class="preview__block">' \+/.test(renderPreviewSrc), 'each populated block renders as a <section class="preview__block">');
ok(/'<div class="preview__block-head">/.test(renderPreviewSrc), 'each block card has a .preview__block-head header row');
ok(SRC.indexOf("b.minutes + ' min</span>") >= 0, 'the block header shows that block\'s own stored minutes -- not a derived or shared value');

// 10. previewExRow no longer renders e.why coach-note text.
{
  const previewExRowSrc = extractFn('previewExRow');
  ok(!/e\.why/.test(previewExRowSrc), 'previewExRow no longer reads or renders e.why -- coach notes are gone from default preview rows');
  ok(!/preview__ex-note/.test(previewExRowSrc), 'the preview__ex-note element is gone from previewExRow\'s output entirely');
}

// 11. Form notes still render as a collapsed <details>.
ok(/<details class="preview__ex-formnotes"><summary>Form notes<\/summary>/.test(extractFn('previewExRow')),
   'Form notes remain an unopened <details>/<summary> disclosure, unchanged');

// ---------- v1.12.2 Home Hero CTA Copy + In-Workout Build Removal ----------
// The hero's own label is now "View the session" (it opens Preview, not a
// live session) -- "Start the session" moved entirely to Preview's own
// bottom CTA. Build is hidden (not removed) from #app whenever
// data-mode="preview" or data-view="day", so Home/plan-setup keeps it
// working exactly as before.
ok(/var ctaLabel = started \? "Continue" : "View the session";/.test(SRC),
   'Home hero CTA reads "View the session" for a not-yet-started session (Preview\'s own CTA keeps "Start the session")');
ok(!/var ctaLabel = weekDone \? "Build next week" : started \? "Continue" : "Start the session";/.test(SRC),
   'the old "Start the session" hero-CTA assignment is gone -- no longer a false promise of a live session');
ok(/var ctaLabel = isToday \? "Start the session" : "Train this today";/.test(extractFn('renderPreview')),
   'Preview\'s own bottom CTA is unchanged: "Start the session" (today) / "Train this today" (future)');
// v1.15 superseded this: #planBtn no longer exists in the header at all --
// Build moved onto Home as page content (.build-row) and is reached via the
// bottom nav's Home tab, so there is no longer a #planBtn to hide in
// Preview/day view. Assert the old header button is genuinely gone rather
// than re-asserting CSS that no longer applies.
ok(SRC.indexOf('id="planBtn"') === -1, 'the old #planBtn header button no longer exists (v1.15: Build lives on Home as page content)');

console.log('v1.12 Preview Mode Separation: ' + pass + ' passed, ' + fail + ' failed');
if (fail) { fails.forEach(f => console.log('  FAIL: ' + f)); process.exit(1); }
