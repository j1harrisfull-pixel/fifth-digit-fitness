// UX audit Batch E (13 July 2026, James: "do all") -- awareness & consistency:
// 1. Hidden-page timer hygiene: the 250ms rest/density ticks stop while the
//    page is hidden (endAt/startAt stamps are the source of truth) and
//    recompute on return; a rest that expired while away says HOW late.
// 2. Midnight rollover: returning to a page rendered yesterday re-renders,
//    so Today markers / hero / due-day logic aren't stale.
// 3. Settings schedule chips announce their effect ("Schedule updated").
// 4. Settings experience picker uses the same outlined segmented group as
//    the intro's identical question (was loose chips).
// 5. Finish page primary says where it goes ("Back to the week", not the
//    12px "Done.").
// 6. +15s stays usable after 0:00 -- restarts a fresh 15s countdown.
// 7. An orphaned density timer (host card re-rendered away) clears its
//    interval instead of ticking forever.
const fs = require('fs');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 1 + 2. Visibility handler ----------
{
  ok(/var hiddenPausedRest = false, hiddenPausedDensity = false, lastSeenDay = todayStr\(\);/.test(SRC),
    'the visibility handler tracks paused ticks + the rendered day');
  ok(/if \(restState\.timer\) \{ clearInterval\(restState\.timer\); restState\.timer = null; hiddenPausedRest = true; \}/.test(SRC),
    'hiding the page stops the rest tick (stamps stay authoritative)');
  ok(/if \(densityTimerState\.timer\) \{ clearInterval\(densityTimerState\.timer\); densityTimerState\.timer = null; hiddenPausedDensity = true; \}/.test(SRC),
    'hiding the page stops the density tick too');
  ok(/if \(overdueMs < 0\) restState\.timer = setInterval\(tickRest, 250\);\s*\n\s*else if \(overdueMs > 3000\) toast\("Rest ended " \+ Math\.round\(overdueMs \/ 1000\) \+ "s ago"\);/.test(SRC),
    'returning mid-rest resumes the tick; returning late says how late');
  ok(/if \(todayStr\(\) !== lastSeenDay\) \{ lastSeenDay = todayStr\(\); renderAll\(false\); \}/.test(SRC),
    'a date change while hidden re-renders on return (midnight rollover)');
}

// ---------- 3. Schedule chips toast ----------
{
  ok(/toast\(td\.length \? "Schedule updated" : "Schedule cleared · train at your own pace"\);/.test(SRC),
    'changing training days in Settings is announced');
}

// ---------- 4. Experience picker consistency ----------
{
  ok(/<div class="seg seg--full seg--goal" id="expChips" role="group" aria-label="Experience level">/.test(SRC),
    'Settings experience picker uses the same segmented group as the intro');
  ok(!/<div class="chips" id="expChips"/.test(SRC), 'the loose-chips variant is gone');
  ok(/id="expChips"[\s\S]{0,300}data-exp="beginner"/.test(SRC), 'the same data-exp buttons remain (handler + aria-pressed sync unchanged)');
}

// ---------- 5. Finish primary label ----------
{
  ok(/<button class="finish-page__done" id="completeNext" type="button">Back to the week<\/button>/.test(SRC),
    'the finish page primary names its destination');
  ok(SRC.indexOf('>Done.</button>') === -1, 'the old "Done." label is gone');
}

// ---------- 6. +15s after 0:00 ----------
{
  ok(!/var rp = \$\("restPlus"\); if \(rp\) rp\.hidden = true;/.test(SRC), 'the 0:00 branch no longer hides +15s');
  ok(/if \(!restEl \|\| restEl\.hidden \|\| !restEl\.classList\.contains\("is-done"\)\) return;\s*\n\s*restState\.total = 15; restState\.endAt = Date\.now\(\) \+ 15000;/.test(SRC),
    '+15s on a finished rest restarts a fresh 15s countdown (guarded to the visible done bar)');
  ok(/restEl\.classList\.remove\("is-done"\);\s*\n\s*var rsk2 = \$\("restSkip"\); if \(rsk2\) rsk2\.textContent = "Skip";\s*\n\s*tickRest\(\); restState\.timer = setInterval\(tickRest, 250\);/.test(SRC),
    'the restart resets the done costume and re-arms the tick');
}

// ---------- 7. Orphaned density timer ----------
{
  ok(/if \(!host\) \{ clearInterval\(densityTimerState\.timer\); densityTimerState\.timer = null; return; \}/.test(SRC),
    'a density tick with no host card clears its interval (persisted stamp survives for resume)');
}

// ---------- 8. Coach-span untouched ----------
{
  const { execFileSync } = require('child_process');
  const spanMd5 = execFileSync('sh', ['-c', "sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5"]).toString().trim();
  ok(spanMd5 === '909fbc92112ba642ed56d6d88b114fb1', 'coach-span md5 unchanged (909fbc92112ba642ed56d6d88b114fb1), got ' + spanMd5);
}

console.log(`UX audit Batch E (awareness & consistency): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
