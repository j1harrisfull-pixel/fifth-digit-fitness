// Active-workout premium refinement, "clear focus around the numbers"
// (13 July 2026, James after Option D shipped). Of the 3 options shown
// (inset chip / accent colour / bigger+underline), he picked the inset
// chip: the weight/rep VALUE gets its own recessed background inside the
// pill, distinct from the flat pill itself, rather than floating as plain
// text between the steppers.
const fs = require('fs');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 1. .rval (rep count) gets the inset chip ----------
{
  ok(/\.rval \{ font-family: "Spline Sans Mono", monospace; font-size: 19px; font-weight: 700; font-variant-numeric: tabular-nums; min-width: 30px; text-align: center; color: var\(--ink\); background: color-mix\(in srgb, var\(--bg\) 60%, transparent\); border-radius: 5px; padding: 4px 10px; box-shadow: inset 0 1px 2px rgba\(0,0,0,\.35\);/.test(SRC),
    '.rval (rep count) has its own recessed chip: bigger (19px/700), darker background, inset shadow');
}

// ---------- 2. .setrow__wtinput (weight value) gets the matching chip ----------
{
  ok(/\.setrow__wtinput \{ flex: none; width: 48px; box-sizing: border-box; min-height: 30px; padding: 4px 10px; border: 0; background: color-mix\(in srgb, var\(--bg\) 60%, transparent\); border-radius: 5px; box-shadow: inset 0 1px 2px rgba\(0,0,0,\.35\); font-size: 19px; font-weight: 700;/.test(SRC),
    '.setrow__wtinput (weight value) matches the same chip treatment as .rval -- same recess, same size');
  ok(/\.setrow__wt\.is-override \.setrow__wtinput \{ color: var\(--accent-ink\); \}/.test(SRC), 'the per-set weight-override colour distinction (brass vs dimmed) is untouched by the chip change');
}

// ---------- 3. The outer pill stays flat -- the inset moved to the number, not stacked on both ----------
{
  ok(!/\.setrow:not\(\.is-done\) \.setrow__wt, \.setrow:not\(\.is-done\) \.setrow__reps \{ background: color-mix\(in srgb, var\(--surface-2\) 100%, var\(--ink\) 6%\); padding: 3px 5px; box-shadow:/.test(SRC),
    'the outer pill no longer carries its own box-shadow -- avoids a muddy double-inset now that the number has one');
}

// ---------- 4. Steppers themselves are untouched -- only the value changed ----------
{
  ok(/\.rstep, \.wtstep \{ position: relative; width: 27px; height: 30px; flex: none; display: grid; place-items: center; border: 0; background: none; border-radius: 7px; font-size: 15px; color: var\(--faint\);/.test(SRC),
    'stepper glyphs (+/-) are unchanged -- same size, same radius, same taps, only the value between them changed');
}

// ---------- 5. Coach-span untouched -- pure CSS ----------
{
  const { execFileSync } = require('child_process');
  const spanMd5 = execFileSync('sh', ['-c', "sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5"]).toString().trim();
  ok(spanMd5 === '909fbc92112ba642ed56d6d88b114fb1', 'coach-span md5 unchanged (909fbc92112ba642ed56d6d88b114fb1), got ' + spanMd5);
}

console.log(`Active-workout premium refinement, number focus (Option 1): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
