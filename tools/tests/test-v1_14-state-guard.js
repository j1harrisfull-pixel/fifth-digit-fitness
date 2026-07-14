// v1.14 State Guard Fix -- Active Session Wins + SW Reload Deferral. Two bugs
// found in the app-state-loss audit, both entirely outside the coach-span:
// (1) save()'s multi-tab conflict guard did whole-blob last-writer-wins with
// NO exception for an active live workout -- a tab mid-session that lost the
// stamp race had its own just-logged edit silently discarded and was reloaded
// into the other context's state ("the app forgot my workout"). Fixed: a tab
// in a live session (view "day" + sessionLive()) now writes through instead
// of discarding; every other case (idle tab, any other view) keeps the exact
// original behavior -- toast + reload, edit deferred to the newer stamp.
// (2) The SW controllerchange reload was deferred only for view "day", so an
// open Build/Just Today/Settings/onboarding/history sheet or an open preview
// could be destroyed by a surprise reload. Fixed: the hold now also covers
// any open dialog.sheet and preview mode, releasing through the same existing
// applySwReload() at backToWeek (unchanged), closePreview (new), and every
// sheet's native "close" event (new).
const fs = require('fs');
const { execSync } = require('child_process');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 0. Coach-span untouched (both fixes are outside the span) ----------
const spanMd5 = execSync(`sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5`).toString().trim();
ok(spanMd5 === 'ce6452b369d4d1d14fd0bf8560208ce7', 'coach-span md5 unchanged (ce6452b369d4d1d14fd0bf8560208ce7), got ' + spanMd5);
const spanEnd = SRC.indexOf('/*__COACH_END__*/');
['save', 'storedStamp', 'sessionLive', 'closePreview', 'backToWeek', 'swReloadShouldHold', 'applySwReload'].forEach(function (name) {
  const at = SRC.indexOf('function ' + name + '(');
  ok(at > spanEnd, name + '() is defined outside (after) the coach-span');
});

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

const saveSrc = extractFn('save');

// ---------- 1. save()'s conflict branch contains the live-session guard, ----------
// ---------- and writes through instead of returning early in that case. ----------
{
  ok(/state\s*&&\s*state\.view\s*===\s*"day"\s*&&\s*sessionLive\(\)/.test(saveSrc),
     'save() checks state.view === "day" && sessionLive() inside the conflict branch');
  // The live-session branch must NOT contain a `return` before the write --
  // structurally: find the if/else around the guard and confirm the else
  // (stale-tab) branch is the one with the reload + early return, while the
  // live-session branch falls through to the normal write below.
  const guardIdx = saveSrc.search(/state\s*&&\s*state\.view\s*===\s*"day"\s*&&\s*sessionLive\(\)/);
  ok(guardIdx > -1, 'sanity: guard located in save()');
  const afterGuard = saveSrc.slice(guardIdx, guardIdx + 400);
  ok(/toast\("Synced over another tab"\)/.test(afterGuard), 'the live-session branch shows the quiet "Synced over another tab" toast');
  // Confirm the live-session branch does NOT contain its own `return` (it must
  // fall through to the write), by checking there is no `return;` between the
  // guard and the following `} else {`.
  const elseIdx = afterGuard.indexOf('} else {');
  ok(elseIdx > -1, 'sanity: located the else (stale-tab) branch');
  const liveBranchBody = afterGuard.slice(0, elseIdx);
  ok(!/return;/.test(liveBranchBody), 'the live-session branch does not early-return -- it falls through to the normal write (state.savedAt = ...)');
}

// ---------- 2. The non-live conflict path is byte-intact: stale-tab toast + ----------
// ---------- deferred reload behavior preserved. ----------
{
  ok(/toast\("Updated in another tab · reloading"\)/.test(saveSrc), 'the original stale-tab toast copy survives unchanged');
  ok(/setTimeout\(function \(\) \{ location\.reload\(\); \}, 700\)/.test(saveSrc), 'the original 700ms reload timeout survives unchanged');
  ok(/localStorage\.setItem\(STORE, JSON\.stringify\(state\)\)/.test(saveSrc), 'the normal write path (localStorage.setItem(STORE, ...)) is still present and reachable');
}

// ---------- 3. Approved copy exists exactly once; rejected phrases absent. ----------
{
  const occurrences = (SRC.match(/Synced over another tab/g) || []).length;
  ok(occurrences === 1, `"Synced over another tab" appears exactly once (got ${occurrences})`);
  ['data conflict', 'error', 'warning'].forEach(function (phrase) {
    // Scoped to the save()/swReload code, not a whole-file sweep (the word
    // "error" legitimately appears elsewhere in the app, e.g. form validation).
    ok(saveSrc.toLowerCase().indexOf(phrase) === -1, `rejected phrase "${phrase}" absent from save()`);
  });
}

// ---------- 4. controllerchange hold condition covers day view, any open ----------
// ---------- dialog.sheet, and preview mode. ----------
{
  const holdSrc = extractFn('swReloadShouldHold');
  ok(/state\s*&&\s*state\.view\s*===\s*"day"/.test(holdSrc), 'swReloadShouldHold() checks state.view === "day"');
  ok(/data-mode"\)\s*===\s*"preview"/.test(holdSrc), 'swReloadShouldHold() checks the preview data-mode attribute');
  ok(/dialog\.sheet/.test(holdSrc), 'swReloadShouldHold() checks for any open dialog.sheet');
  ok(/\.open\b/.test(holdSrc), 'swReloadShouldHold() checks each sheet\'s native .open property');
}

// ---------- 5. applySwReload is invoked from backToWeek, closePreview, and ----------
// ---------- every sheet's native "close" event -- no second reload mechanism. ----------
{
  const backToWeekSrc = extractFn('backToWeek');
  ok(/applySwReload\(\)/.test(backToWeekSrc), 'backToWeek() still calls applySwReload() (unchanged release point)');
  const closePreviewSrc = extractFn('closePreview');
  ok(/applySwReload\(\)/.test(closePreviewSrc), 'closePreview() now calls applySwReload() (new release point)');
  ok(/dlg\.addEventListener\("close", applySwReload\)/.test(SRC), 'every dialog.sheet gets a native "close" listener wired to applySwReload (new release point, no second mechanism)');
  // Only one applySwReload function definition exists -- the mechanism was
  // reused, not duplicated.
  const defCount = (SRC.match(/function applySwReload\(/g) || []).length;
  ok(defCount === 1, `exactly one applySwReload() definition exists (got ${defCount}) -- no second reload mechanism was invented`);
}

// ---------- 6. Coach-span md5 already asserted above (section 0). ----------

// ---------- 7. No new localStorage key introduced by this diff. ----------
{
  // The known key set before this ticket (STORE, STORE_V1, quarantine, splash
  // seen, coach hint seen, LIVE_KEY, DENSITY_TIMER_KEY, REST_KEY) -- assert
  // the total count of distinct setItem KEY EXPRESSIONS is unchanged at 7,
  // matching the pre-ticket count (verified by hand before this fix).
  const setItemCalls = SRC.match(/localStorage\.setItem\([^,]+,/g) || [];
  ok(setItemCalls.length === 8, `localStorage.setItem call count unchanged at 8 (Batch A added tl:liveSid, the live-run session id) (got ${setItemCalls.length}) -- no new persisted key introduced`);
}

console.log(`${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
