// Active-workout premium refinement, two rough spots found by actually
// logging a set on the real live screen (13 July 2026, "this is the user
// face"): (1) the completed-set checkmark rendered as a solid 34px filled
// clay SQUARE via a more-specific .app[data-view="day"] override that was
// never touched by the earlier Option D / number-focus tickets -- same
// "filled block" shape problem the whole premium-refinement pass elsewhere
// moved away from; (2) the exercise-level "Set your working weight" field
// still used a bare underline, missed by the number-focus ticket since it's
// a separate control (.weight__input), not a .setrow.
const fs = require('fs');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 1. Completed-set tick: round tinted badge, not a filled square ----------
{
  ok(/\.app\[data-view="day"\] \.setrow\.is-done \.setrow__done \{ width: 26px; height: 26px; min-height: 26px; padding: 0; border-radius: 50%; background: color-mix\(in srgb, var\(--tempo-clay-deep\) 55%, var\(--surface-3\)\); border-color: transparent; color: var\(--tempo-bone\); \}/.test(SRC),
    'day-view completed-set tick is a 26px round tinted badge (not the old 34px flat-filled square), bone icon on a clay-deep/surface-3 blend');
  ok(!/width: 34px; height: 34px; min-height: 34px; padding: 0; border-radius: 7px; background: var\(--tempo-clay-deep\); border-color: var\(--tempo-clay-deep\); color: var\(--tempo-bone\);/.test(SRC),
    'the old flat 34px clay-deep square rule is gone');
}

// ---------- 2. "Set your working weight" field: inset chip, not a bare underline ----------
{
  ok(/\.weight__field \{ display: inline-flex; align-items: baseline; gap: 3px; justify-content: center; background: color-mix\(in srgb, var\(--bg\) 60%, transparent\); border-radius: 5px; padding: 4px 8px; box-shadow: inset 0 1px 2px rgba\(0,0,0,\.35\); \}/.test(SRC),
    'the exercise-level weight field now uses the same recessed-chip look as the per-set weight/rep chips');
  ok(/\.startweight\.is-unset \.weight__field \{ border: 1px solid var\(--manage\); \}/.test(SRC),
    'the "your turn" amber signal is kept via a full ring around the chip, not a bottom-only underline');
  ok(!/border-bottom: 1px solid var\(--manage\); padding-bottom: 1px;/.test(SRC), 'the old bare-underline rule is gone');
}

// ---------- 3. Coach-span untouched -- both fixes are pure CSS ----------
{
  const { execFileSync } = require('child_process');
  const spanMd5 = execFileSync('sh', ['-c', "sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5"]).toString().trim();
  ok(spanMd5 === '1081700e58396438a0b408febcfdc56b', 'coach-span md5 unchanged (1081700e58396438a0b408febcfdc56b), got ' + spanMd5);
}

console.log(`Active-workout day-view fixes (tick shape + working-weight chip): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
