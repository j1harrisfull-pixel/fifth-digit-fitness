// Home (week view) audit fixes (15 July 2026, section audit #3):
// 1. Dead pager: renderHead sets weekNav[hidden] on 1-week programs, but
//    .weeknav's inline-flex overrode the hidden attribute (the v1.10
//    banner[hidden] bug class) -- "Week 1 of 1" with two no-op chevrons
//    rendered anyway. .weeknav[hidden]{display:none} closes it.
// 2. Rhythm strip: unlabelled, directly under "Last 14 days", with every
//    equal-length session rendering a solid 100% brass block -- a fresh week
//    read as 4 trained days. Now labelled ("This week · tap a session"),
//    planned bars are quiet graphite on a faint track, and brass is EARNED:
//    only a finished session's bar fills brass. is-done also moves off
//    --ready green (green means recovered elsewhere; one event, one colour).
// 3. Consistency is-trained cells were the other clay-red holdout on Home
//    (James: "the red doesn't match") -- now brass, matching earned-brass.
const fs = require('fs');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 1. Pager actually hides ----------
{
  ok(/\.weeknav\[hidden\] \{ display: none; \}/.test(SRC), '.weeknav[hidden] beats the inline-flex display');
  ok(/var wnav = \$\("weekNav"\); if \(wnav\) wnav\.hidden = p\.weeks\.length <= 1;/.test(SRC), 'the existing hide logic is untouched');
}

// ---------- 2. Rhythm strip ----------
{
  ok(/<p class="consistency-label view-week" id="weekRhythmLabel" hidden>This week · tap a session<\/p>/.test(SRC),
    'the rhythm strip has its own quiet label above it');
  ok(/var lbl = \$\("weekRhythmLabel"\);[\s\S]{0,200}if \(lbl\) lbl\.hidden = true; return; \}\s*if \(lbl\) lbl\.hidden = false;/.test(SRC),
    'the label shows/hides with the strip itself');
  ok(/\.rhythm__bar \{ width: 100%; border-radius: 3px; background: var\(--surface-3, var\(--surface-2\)\); border: 1px solid var\(--line-strong\); \}/.test(SRC),
    'planned bars are quiet graphite, not brass fills');
  ok(/\.rhythm__col\.is-done \.rhythm__bar \{ background: color-mix\(in srgb, var\(--accent\) 55%, var\(--surface-2\)\); border-color: transparent; \}/.test(SRC),
    'brass is earned: only a finished session fills brass');
  ok(!/\.rhythm__col\.is-done[^}]*var\(--ready\)/.test(SRC), 'is-done no longer borrows --ready green');
  ok(/\.rhythm__track \{ background: color-mix\(in srgb, var\(--surface-2\) 45%, transparent\); border-radius: 3px; \}/.test(SRC),
    'the track has a faint base so bars read as bars in a scale');
}

// ---------- 3. Consistency trained cells off clay ----------
{
  ok(/\.app\[data-view="week"\] \.consistency-cell\.is-trained \{ background: var\(--tempo-brass\); \}/.test(SRC),
    'trained cells are brass, not clay');
  ok(!/consistency-cell\.is-trained \{ background: var\(--tempo-clay\)/.test(SRC), 'no clay remains on the consistency strip');
}

// ---------- Coach-span untouched ----------
{
  const { execFileSync } = require('child_process');
  const spanMd5 = execFileSync('sh', ['-c', "sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5"]).toString().trim();
  ok(spanMd5 === 'ce6452b369d4d1d14fd0bf8560208ce7', 'coach-span md5 unchanged (ce6452b369d4d1d14fd0bf8560208ce7), got ' + spanMd5);
}

console.log(`Home audit fixes (pager hide, labelled earned-brass rhythm, brass consistency): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
