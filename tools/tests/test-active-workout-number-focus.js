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
// 18 July 2026: sizing shrank (19px/30px -> 17px/26px, padding 4px10 ->
// 4px7) as part of the horizontal weight+reps+Log single-line layout
// (James: "should the input boxes be horizontal?") -- the chip TREATMENT
// (recessed background, inset shadow, bold mono) is what this test verifies
// and is unchanged; only the literal size numbers moved.
{
  ok(/\.rval \{ font-family: "Spline Sans Mono", monospace; font-size: 17px; font-weight: 700; font-variant-numeric: tabular-nums; min-width: 26px; text-align: center; color: var\(--ink\); background: color-mix\(in srgb, var\(--bg\) 60%, transparent\); border-radius: 5px; padding: 4px 7px; box-shadow: inset 0 1px 2px rgba\(0,0,0,\.35\);/.test(SRC),
    '.rval (rep count) has its own recessed chip: bold mono, darker background, inset shadow');
}

// ---------- 2. .setrow__wtinput (weight value) gets the matching chip ----------
// 18 July 2026, second pass: 36px clipped decimal loads ("42.5" rendered as
// "42."); widened to 52px AND dropped its font-size to 15px (.rval, reps,
// keeps 17px -- reps rarely need more than 2-3 digits) so a 3-digit decimal
// like "142.5" (a real heavy squat/deadlift load) fits without clipping.
// Tighter padding elsewhere keeps the one-line fit. The recessed-chip
// TREATMENT this test guards is otherwise unchanged.
{
  ok(/\.setrow__wtinput \{ flex: none; width: 52px; box-sizing: border-box; min-height: 26px; padding: 4px 3px; border: 0; background: color-mix\(in srgb, var\(--bg\) 60%, transparent\); border-radius: 5px; box-shadow: inset 0 1px 2px rgba\(0,0,0,\.35\); font-size: 15px; font-weight: 700;/.test(SRC),
    '.setrow__wtinput (weight value) matches the same chip treatment as .rval -- same recess, same relative size');
  ok(/\.setrow__wt\.is-override \.setrow__wtinput \{ color: var\(--accent-ink\); \}/.test(SRC), 'the per-set weight-override colour distinction (brass vs dimmed) is untouched by the chip change');
}

// ---------- 3. The outer pill stays flat -- the inset moved to the number, not stacked on both ----------
{
  ok(!/\.setrow:not\(\.is-done\) \.setrow__wt, \.setrow:not\(\.is-done\) \.setrow__reps \{ background: color-mix\(in srgb, var\(--surface-2\) 100%, var\(--ink\) 6%\); padding: 3px 5px; box-shadow:/.test(SRC),
    'the outer pill no longer carries its own box-shadow -- avoids a muddy double-inset now that the number has one');
}

// ---------- 4. Steppers keep their look -- same radius/style, size tightened for the horizontal row ----------
// 18 July 2026: shrank 27x30 -> 21x26 (part of fitting weight+reps+Log on one
// line); the compensating ghost-hit inset grew in the same pass so the real
// tap target didn't shrink. Radius/style (the actual thing this test guards)
// is unchanged.
{
  ok(/\.rstep, \.wtstep \{ position: relative; width: 21px; height: 26px; flex: none; display: grid; place-items: center; border: 0; background: none; border-radius: 7px; font-size: 14px; color: var\(--faint\);/.test(SRC),
    'stepper glyphs (+/-) keep the same radius/style -- only their size tightened for the horizontal row');
}

// ---------- 5. Coach-span untouched -- pure CSS ----------
{
  const { execFileSync } = require('child_process');
  const spanMd5 = execFileSync('sh', ['-c', "sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5"]).toString().trim();
  ok(spanMd5 === '1081700e58396438a0b408febcfdc56b', 'coach-span md5 unchanged (1081700e58396438a0b408febcfdc56b), got ' + spanMd5);
}

console.log(`Active-workout premium refinement, number focus (Option 1): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
