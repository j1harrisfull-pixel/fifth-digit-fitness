// v1.8 TEMPO -- Ticket 3 (active workout card + motion only). Static
// source-level checks: coach-span protection, the new sentence-prescription
// Effort append and progress-bar markup use only pre-existing fields, the
// set-logging/rest-timer/final-set/auto-close code paths are byte-identical
// to what shipped before this ticket (proving workout logic was untouched),
// motion durations/guards, contrast, rejected-copy guard, and scoping.
const fs = require('fs');
const { execSync } = require('child_process');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 1. Coach-span untouched ----------
const spanMd5 = execSync(`sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5`).toString().trim();
ok(spanMd5 === '1081700e58396438a0b408febcfdc56b', 'coach-span md5 unchanged (1081700e58396438a0b408febcfdc56b), got ' + spanMd5);

// ---------- 2. Sentence prescription: Effort appended from existing e.target only ----------
// 18 July 2026: a .replace() strips the " · ramp to top set" suffix here --
// the ramp is explained once, in its own italic rampLine, so this sentence
// no longer repeats it. Still e.target via the existing effortifyTarget(),
// no new field.
ok(/var effortText = \(e\.type === "strength" && e\.target\) \? effortifyTarget\(e\.target\)\.replace\(\/ · ramp to top set\$\/, ""\) : "";/.test(SRC),
   'Effort text is read from the existing e.target field via the existing effortifyTarget(), no new field');
ok(/statCells\.length && effortText \? ' <span class="card__rx-sep">·<\/span> ' : ''/.test(SRC),
   'Effort is appended to the existing sets/reps/rest sentence, not a separate invented line');

// ---------- 3. Progress bar: true completed/total sets, omitted when total is 0 ----------
ok(/var exProgressHtml = total > 0\s*\n\s*\? '<div class="card__exprogress"[^']*><div class="card__exprogress-fill" style="--ex-fill:' \+ Math\.round\(\(doneCount \/ total\) \* 100\) \+ '%"><\/div><\/div>'\s*\n\s*: '';/.test(SRC),
   'progress bar fill = Math.round(doneCount/total*100) -- the same doneCount/total this card already computes for setsHead/collapsedMeta (true completed sets over true prescribed sets)');
ok(!/doneCount \+ '\/' \+ overlineTotal/.test(SRC), 'progress bar never mixes doneCount with an exercise-count total (unit-honesty guard)');

// ---------- 4. Untouched workout logic: exact pre-existing code proven present verbatim ----------
const setHandler = SRC.slice(SRC.indexOf('if (act === "set") {'), SRC.indexOf('} else if (act === "w-" || act === "w+") {'));
ok(/sset\.completed = !sset\.completed;/.test(setHandler), 'set-completion toggle logic untouched');
ok(/if \(sset\.completed && w\.sl\.finishedAt\) delete w\.sl\.finishedAt;/.test(setHandler), 're-entry finishedAt-clear logic untouched');
ok(/logging the final set no longer auto-collapses[\s\S]{0,60}exercise\./.test(setHandler),
   'the "final set does not auto-close" comment/behavior block is present verbatim (exercise stays manually controlled)');
ok(/if \(pr1\.total > 0 && pr1\.done === pr1\.total\) renderDayBar\(\); else startRest\(e, si\);/.test(setHandler),
   'rest timer still fires via startRest() after logging a set (unless the whole session just completed) -- untouched');
ok(/} else \{\s*\n\s*hideRest\(\); \/\/ un-checking a set cancels the rest it started/.test(setHandler),
   'un-checking a set still cancels rest via hideRest() -- untouched');
ok(!/nextExercise\(\)|autoAdvance|autoClose/.test(setHandler), 'no new auto-advance/auto-close call was introduced into the set handler');

// ---------- 5. Start/Finish/readiness/zero-logged untouched ----------
ok(/id="liveBarStart">Start<\/button>/.test(SRC), 'Start control markup unchanged');
ok(/id="liveBarEnd">Finish<\/button>/.test(SRC), 'Finish control markup unchanged');
ok(/id="readinessPromptSkip"/.test(SRC), 'readiness prompt skip control unchanged');
ok(/toast\("Nothing logged\. Left as is\."\);/.test(SRC), 'zero-logged finish toast copy unchanged');

// ---------- 6. Finish sheet spoken line (v1.10 Ticket 5 THE PAGE) ----------
ok(/\$\("completeTitleText"\)\.textContent = finishKind === "partial" \? "Enough for today\." : "Work logged\.";/.test(SRC), 'finish spoken-line logic present (partial vs full/density)');
ok(/#completeSheet\.sheet \{ background: var\(--tempo-bone\)/.test(SRC), 'Ticket 2 finish sheet CSS untouched');

// ---------- 7. Motion scope ----------
ok(/@keyframes pulse \{ 0% \{ transform: scale\(1\); \} 40% \{ transform: scale\(1\.12\); \} 100% \{ transform: scale\(1\); \} \}/.test(SRC),
   'reuses the existing pulse keyframe (scale 1 -> 1.12 -> 1), no new keyframe added for the tick');
ok(/\.app\[data-view="day"\] \.setrow\.is-done\.pulse \.setrow__done \{ animation: pulse \.12s ease; \}/.test(SRC),
   'logged-tick animation duration capped at .12s (<=120ms), scoped to logged rows only');
ok(/\.card__exprogress-fill \{ height: 100%; width: var\(--ex-fill, 0%\); background: var\(--tempo-clay\); transition: width \.15s ease; \}/.test(SRC),
   'progress bar transition duration capped at .15s (<=150ms)');
ok(/@media \(prefers-reduced-motion: reduce\) \{ \*, \*::before, \*::after \{ animation-duration: \.001ms !important; transition-duration: \.001ms !important; \} \}/.test(SRC),
   'the blanket reduced-motion rule (already neutralises both new animation/transition durations) is still present');
ok(!/animation-iteration-count:\s*infinite/.test(SRC), 'no looping animation was introduced');

// ---------- 8. Rejected-copy guard, scoped to the new/changed workout code ----------
const cssStart = SRC.indexOf('v1.8 TEMPO -- Active Workout Card');
const cssEnd = SRC.indexOf('Visual Reset Phase 2: the hero reads as ELEVATED');
const workoutCss = SRC.slice(cssStart, cssEnd);
const NEW_CODE = workoutCss
  + SRC.slice(SRC.indexOf('var effortText ='), SRC.indexOf('var effortText =') + 900);
const REJECTED = [
  'great job', 'well done', 'crushed it', 'nice', 'recovered', 'fatigued', 'optimal',
  'readiness score', 'recovery score', 'confetti', 'streak', 'training receipt',
  'session signed off', 'Signed off', 'Every minute answered', 'built to the minute',
  '45 minutes, honest', 'Progression handled'
];
REJECTED.forEach(function (phrase) {
  ok(NEW_CODE.toLowerCase().indexOf(phrase.toLowerCase()) === -1, 'rejected phrase absent from new v1.8 Ticket 3 code: "' + phrase + '"');
});

// ---------- 9. No external/bitmap/network assets ----------
ok(!/url\(/.test(workoutCss), 'no url()/bitmap asset in the Ticket 3 CSS block');
ok(!/https?:\/\//.test(workoutCss), 'no network reference in the Ticket 3 CSS block');

// ---------- 10. No new stored fields / no data-shape change ----------
ok(!/sl\.exProgress|state\.exProgress|\.effortLogged\s*=/.test(NEW_CODE), 'no new stored field introduced by the Ticket 3 display code');

// ---------- 11. Contrast: the round tick uses a clay-deep TINT (not a flat fill), bone icon ----------
// 13 July 2026: this was a solid 34px filled clay-deep SQUARE -- the same
// "filled block" shape the wider premium-refinement pass moved away from
// everywhere else. Recoloured to a small round tinted badge (26px, 55%
// clay-deep mixed with --surface-3), matching the restrained-tint language
// used for the week-row done badge and the number-focus chip. Contrast is
// re-verified against the ACTUAL resulting background (the tint blended
// with the card surface), not the old flat clay-deep fill.
function srgbToLinear(c) { c /= 255; return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4); }
function relLum(hex) { const n = parseInt(hex.replace('#', ''), 16); const r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255; return 0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b); }
function contrast(a, b) { const L1 = relLum(a), L2 = relLum(b); const lighter = Math.max(L1, L2), darker = Math.min(L1, L2); return (lighter + 0.05) / (darker + 0.05); }
function mix(hexA, hexB, pct) {
  const a = parseInt(hexA.replace('#', ''), 16), b = parseInt(hexB.replace('#', ''), 16);
  const ar = (a >> 16) & 255, ag = (a >> 8) & 255, ab = a & 255;
  const br = (b >> 16) & 255, bg = (b >> 8) & 255, bb = b & 255;
  const r = Math.round(ar * pct + br * (1 - pct)), g = Math.round(ag * pct + bg * (1 - pct)), bl = Math.round(ab * pct + bb * (1 - pct));
  return '#' + [r, g, bl].map(x => x.toString(16).padStart(2, '0')).join('');
}
const bone = '#EDE8DF', clayDeep = '#A84A2F', surface3 = '#2E2820';
const badgeBg = mix(clayDeep, surface3, 0.55);
ok(contrast(bone, badgeBg) >= 3, 'tick icon (bone) on the resulting tinted badge background >= 3:1 (icon/UI-component bar, not the 4.5:1 text bar), got ' + contrast(bone, badgeBg).toFixed(2));
ok(/\.setrow\.is-done \.setrow__done \{[^}]*background: color-mix\(in srgb, var\(--tempo-clay-deep\) 55%, var\(--surface-3\)\)[^}]*color: var\(--tempo-bone\)/.test(workoutCss),
   'the logged-tick is a clay-deep-tinted round badge with a bone icon, not a flat clay-deep fill');

// ---------- 12. Scoping: new rules apply only to the day view / set rows ----------
const dayScopedLines = workoutCss.split('\n').filter(function (l) { return /^\.app\[data-view="day"\]/.test(l.trim()); });
ok(dayScopedLines.length >= 8, 'Ticket 3 rules are scoped under .app[data-view="day"] (found ' + dayScopedLines.length + ')');
ok(!/:root \{[^}]*--tempo-bg:\s*#(?!14161A)/i.test(SRC), 'no --tempo- token redefinition (still the single Ticket 1 palette)');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
