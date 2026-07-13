// Active-workout premium refinement, current-set card (13 July 2026).
// Most of docs/plans/2026-07-08-active-workout-premium-refinement.md had
// already shipped in an earlier checkpoint (d46fd17) before this ticket --
// calm completion, inline effort, soft pills, warmed typography, grid gated
// off the day view were all already live. The one open gap: James was shown
// 4 shape options for the current-set card (A: match app's 14px radius, B:
// no fill, C: sharp/instrument 4px + outline accent, D: C's outline accent
// at a softened 9px radius) and picked D. This test asserts D's values
// landed on the real selectors, scoped to this card only (no change to the
// app's global --radius token).
const fs = require('fs');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 1. Current-set card: 9px radius, bumped accent border, no change to --radius token ----------
{
  ok(/\.setrow:not\(\.is-done\) \{ background: color-mix\(in srgb, var\(--surface-3\) 55%, var\(--bg\)\); border: 1px solid color-mix\(in srgb, var\(--accent\) 20%, transparent\); border-radius: 9px;/.test(SRC),
    'current-set card uses Option D: 9px radius, 20% accent border tint (up from 12%)');
  ok(/--radius: 14px;/.test(SRC), 'the app-wide --radius token is untouched at 14px -- Option D is scoped to this card only, not a global radius change');
}

// ---------- 2. Weight/reps pill clusters softened from full pill to 9px ----------
{
  ok(/\.setrow__wt, \.setrow__reps \{ background: var\(--surface-2\); border-radius: 9px;/.test(SRC), 'weight/reps pill clusters softened from 999px to 9px');
}

// ---------- 3. Steppers softened from full pill to 7px (slightly tighter than the cluster, same family) ----------
{
  ok(/\.rstep, \.wtstep \{ position: relative; width: 27px; height: 30px; flex: none; display: grid; place-items: center; border: 0; background: none; border-radius: 7px;/.test(SRC),
    'weight/rep steppers softened from 999px to 7px');
}

// ---------- 4. Log button softened from full pill to 9px, same family as the pill clusters ----------
{
  ok(/\.setrow__done \{ width: auto; height: auto; min-height: 40px; margin-left: auto; flex: none; display: inline-flex; align-items: center; justify-content: center; padding: 8px 18px; border-radius: 9px;/.test(SRC),
    'the Log/Logged button is softened from 999px to 9px, matching the pill clusters and steppers');
}

// ---------- 5. Grid removed on the day/active-workout view (already shipped in d46fd17, confirming it's still there) ----------
{
  ok(/body:has\(\.app\[data-view="day"\]\)::before \{ display: none; \}/.test(SRC), 'grid texture is gated off on the active-workout/day view (already shipped, this ticket did not need to touch it)');
}

// ---------- 6. Coach-span untouched -- pure CSS, no coach logic ----------
{
  const { execFileSync } = require('child_process');
  const spanMd5 = execFileSync('sh', ['-c', "sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5"]).toString().trim();
  ok(spanMd5 === '62fa16a3f1f9b9952d9060d2bda135e4', 'coach-span md5 unchanged (62fa16a3f1f9b9952d9060d2bda135e4), got ' + spanMd5);
}

console.log(`Active-workout premium refinement, Option D: ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
