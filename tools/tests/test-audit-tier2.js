// Site-wide audit Tier 2 (13 July 2026) -- "half-applied standards": the
// patterns already existed (eyebrow+hero, quiet stats, segmented outlined
// choice groups, recessed number chips, brass-only celebration), these
// surfaces just missed them. Six items, all presentation/copy:
// 1. Progress tab: real hero heading under the eyebrow; the "‹ Week" back
//    button removed (top-level nav destination, not a drill-down); the
//    lifetime-stats quieting widened to cover the tab, not just the sheet.
// 2. History drill-down PR badge: --ready green -> brass (green means
//    ready/recovered elsewhere; one event, one colour).
// 3. Progress numbers that matter get the recessed chip (per-lift current
//    est-1RM + the drill-down's best est-1RM); dense per-session rows stay
//    plain deliberately.
// 4. Finish page "Done.": 12px dim invisible text -> calm outlined button.
// 5. Readiness prompt: own eyebrow+hero pair (no borrowed danger class, no
//    brass heading); chips -> segmented outlined group.
// 6. Intro steps: eyebrow above the hero on step 2 (was inverted), step 3/4
//    get step-count eyebrows, step 4 retitled as a question, experience
//    chips -> segmented outlined group.
const fs = require('fs');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 1. Progress tab ----------
{
  ok(/<p class="preview__eyebrow">Your training<\/p>\s*<h2 class="history__title">Progress<\/h2>/.test(SRC),
    'Progress tab has the eyebrow+hero pair (quiet "Your training" over the 21px Progress heading)');
  ok(SRC.indexOf('id="progressBack"') === -1, 'the "‹ Week" back button is gone from the Progress tab');
  ok(SRC.indexOf('$("progressBack")') === -1, 'no JS still binds the removed back button (would throw on boot)');
  ok(/#historySheet \.recap-stat__num, #progressView \.recap-stat__num \{ font-size: 15px; font-weight: 700; \}/.test(SRC),
    'the lifetime-stats quieting now covers the Progress tab too, not just the old sheet');
}

// ---------- 2. PR badge unified on brass ----------
{
  ok(/\.exhist__pr \{[^}]*border: 1px solid var\(--accent-ink\); color: var\(--accent-ink\); border-radius: 4px;/.test(SRC),
    'the history PR badge is brass with the small-chip radius, not --ready green');
  ok(!/\.exhist__pr \{[^}]*var\(--ready\)/.test(SRC), 'no --ready green remains on the PR badge');
}

// ---------- 3. Recessed chips on the numbers that matter ----------
{
  ok(/\.history__lift-val \{[^}]*background: color-mix\(in srgb, var\(--bg\) 60%, transparent\); border-radius: 5px;[^}]*box-shadow: inset 0 1px 2px rgba\(0,0,0,\.35\);/.test(SRC),
    'the per-lift current est-1RM gets the recessed chip treatment');
  ok(/\.exhist__record b \{[^}]*background: color-mix\(in srgb, var\(--bg\) 60%, transparent\);[^}]*box-shadow: inset 0 1px 2px rgba\(0,0,0,\.35\);/.test(SRC),
    'the drill-down best est-1RM gets the matching chip');
  ok(!/\.history__session-sets \{[^}]*box-shadow: inset/.test(SRC), 'dense per-session rows stay plain (no chip soup)');
}

// ---------- 4. Finish "Done." is a visible calm button ----------
{
  ok(/#completeSheet \.finish-page__done \{[^}]*border: 1px solid var\(--tempo-bone-line\); border-radius: var\(--radius\); font-size: 14px; font-weight: 600; color: var\(--tempo-bone-ink\);/.test(SRC),
    'the finish page Done button is a legible outlined button (14px ink, hairline bone border), still no fill/accent');
}

// ---------- 5. Readiness prompt ----------
{
  ok(/<p class="readiness-eyebrow">Before you start<\/p>\s*<h2 id="readinessPromptTitle">How are you feeling today\?<\/h2>/.test(SRC),
    'readiness prompt has its own eyebrow+hero pair, no borrowed confirm__title class');
  ok(/<div class="seg seg--full seg--goal" id="readinessPromptChips"/.test(SRC),
    'readiness options use the outlined-but-flush segmented group, not loose chips');
  ok(/id="readinessPromptChips"[\s\S]{0,300}data-rp="0">Rough<\/button>/.test(SRC), 'the same data-rp buttons remain (handler unchanged)');
}

// ---------- 6. Intro steps ----------
{
  ok(/<p class="intro__how" id="introHowLabel" hidden>Here's how it works<\/p>\s*<h1 class="intro__title" id="introStep2Title">/.test(SRC),
    'step 2 eyebrow renders ABOVE the hero heading (was inverted)');
  ok(/<p class="intro__how">Step 3 of 4<\/p>\s*<h1 class="intro__title">Anything we should avoid\?<\/h1>/.test(SRC), 'step 3 has a step-count eyebrow');
  ok(/<p class="intro__how">Step 4 of 4<\/p>\s*<h1 class="intro__title">How long have you been training\?<\/h1>/.test(SRC),
    'step 4 has a step-count eyebrow and asks a question instead of the field-label "Training experience"');
  ok(/<div class="seg seg--full seg--goal" id="introExpChips"/.test(SRC), 'experience options use the segmented outlined group');
  ok(/id="introExpChips"[\s\S]{0,300}data-exp="beginner"/.test(SRC), 'the same data-exp buttons remain (handler + aria-pressed sync unchanged)');
}

// ---------- 7. Coach-span untouched -- all Tier 2 items are presentation/copy ----------
{
  const { execFileSync } = require('child_process');
  const spanMd5 = execFileSync('sh', ['-c', "sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5"]).toString().trim();
  ok(spanMd5 === 'ce6452b369d4d1d14fd0bf8560208ce7', 'coach-span md5 unchanged (ce6452b369d4d1d14fd0bf8560208ce7), got ' + spanMd5);
}

console.log(`Site-wide audit Tier 2 (six fixes): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
