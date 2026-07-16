// Site-wide audit Tier 1 (13 July 2026, James: "Approved for all" after the
// before/after mockup). Five fixes, all pure presentation/copy:
// 1. Resume strip calmed -- was FOUR stacked accent treatments (accent
//    border, pulsing accent dot, uppercase tracked accent label, filled
//    accent pill) above the hero; now a quiet surface card whose single
//    live signal is the small pulse dot.
// 2. The banned word "closed" cut from its two survivors (week-done recap
//    sentence + the done-badge aria-label).
// 3. "Workout" -> "Session" on the two highest-traffic strings (resume
//    strip label, home hero CTA).
// 4. PR callout on the bone finish page restyled bone-native (was dark-theme
//    brass on bone at ~1.9:1 contrast, filled banner + decorative star).
// 5. Just-Today off-plan honesty line restored on the finish page (was
//    computed but never rendered after the finish-page rebuild).
const fs = require('fs');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 1. Resume strip: calm card, one live signal ----------
{
  ok(/\.resumestrip \{ [^}]*border: 1px solid var\(--line\); border-radius: var\(--radius\);/.test(SRC), 'resume strip container uses a normal --line border + the app radius, not an accent border at 5px');
  ok(/\.resumestrip__label \{ font-size: 13px; font-weight: 600; color: var\(--ink\); \}/.test(SRC), 'strip label is plain ink sentence-case text, not uppercase tracked accent mono');
  ok(/\.resumestrip__cta \{ flex: none; font-size: 13px; font-weight: 700; color: var\(--accent-ink\); background: none; padding: 0; \}/.test(SRC), 'Resume is quiet accent text, not a filled 999px pill');
  ok(/\.resumestrip__pulse \{ width: 7px; height: 7px;[^}]*background: var\(--accent\); animation: resumepulse/.test(SRC), 'the small pulsing dot remains as the single live signal');
  ok(SRC.indexOf('<span class="resumestrip__cta">Resume ›</span>') !== -1, 'CTA text is "Resume ›"');
}

// ---------- 2. "closed" is gone from its two survivors ----------
{
  ok(!/ sessions" \+ " closed\. "|" closed\. "/.test(SRC), 'the week-done recap no longer says "closed"');
  ok(/ sessions"\) \+ " done\. "/.test(SRC.replace(/\n/g, ' ')) || SRC.indexOf('" done. "') !== -1, 'the recap sentence says "done"');
  ok(SRC.indexOf('aria-label="closed"') === -1, 'the done-badge aria-label no longer says "closed"');
  ok(SRC.indexOf('weekrow__anno--done" aria-label="done"') !== -1, 'the done-badge aria-label says "done"');
}

// ---------- 3. Workout -> Session on the two big strings ----------
{
  ok(SRC.indexOf('<span class="resumestrip__label">Session in progress</span>') !== -1, 'resume strip label reads "Session in progress"');
  ok(SRC.indexOf('"View the session"') !== -1, 'hero CTA reads "View the session"');
  // The phrase legitimately survives inside ONE explanatory comment (the
  // v1.12.2 history note recording what the CTA used to say); assert it is
  // never ASSIGNED as the rendered label.
  ok(!/ctaLabel = [^;]*"View the workout"/.test(SRC), '"View the workout" is never assigned as the CTA label');
  ok(/resumeStripDetail"\)\.textContent = name \+ " · " \+ detail;/.test(SRC), 'the strip detail separator is a middot, not an em dash');
}

// ---------- 4. PR callout: bone-native record grammar ----------
{
  ok(/\.complete__pr-banner \{ display: flex;[^}]*color: var\(--tempo-bone-ink\); border-top: 1px solid var\(--tempo-bone-line\); border-bottom: 1px solid var\(--tempo-bone-line\);/.test(SRC),
    'PR banner is ink text between hairline bone rules -- no accent-tint wash, no accent-ink text');
  ok(/\.complete__pr-banner b \{[^}]*text-transform: uppercase; color: var\(--tempo-bone-ink\); border: 1px solid var\(--tempo-bone-ink\); border-radius: 4px;/.test(SRC),
    'the NEW BEST emphasis is a small bordered ink badge, not a color wash');
  ok(SRC.indexOf('hidden>★') === -1 && SRC.indexOf('>★ <span id="completePrCalloutText">') === -1, 'the decorative star is gone from the callout markup');
  ok(/" · est\. " \+ p\.orm \+ esc\(unit\)/.test(SRC), 'the PR figures are labelled "est." (they are est-1RM values) with middots');
  ok(/#completePrCalloutText \{ display: contents; \}/.test(SRC), 'the inner span participates in the banner flex row via display:contents');
}

// ---------- 5. Off-plan honesty line restored ----------
{
  ok(/if \(ses\.origin === "alternate"\) closeParts\.push\("off plan · no progression read"\);/.test(SRC),
    'a Just-Today (alternate) finish appends "off plan · no progression read" to the close line');
}

// ---------- 6. Coach-span untouched -- all five fixes are presentation/copy ----------
{
  const { execFileSync } = require('child_process');
  const spanMd5 = execFileSync('sh', ['-c', "sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5"]).toString().trim();
  ok(spanMd5 === '909fbc92112ba642ed56d6d88b114fb1', 'coach-span md5 unchanged (909fbc92112ba642ed56d6d88b114fb1), got ' + spanMd5);
}

console.log(`Site-wide audit Tier 1 (five approved fixes): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
