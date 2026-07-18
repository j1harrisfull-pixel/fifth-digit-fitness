// UX audit Batch B (13 July 2026, James: "do all") -- weight & reps entry
// ergonomics, the highest-frequency taps in the app:
// 1. Reps are typable: the read-only .rval span is now a number input
//    (data-act="repset", clamped 0-100) flanked by the same steppers.
// 2. Select-on-focus: tapping into any number field selects its contents
//    (delegated focusin + setTimeout for WebKit), so corrections don't
//    start with backspacing.
// 3. enterkeyhint="done" on all three fields + delegated Enter -> blur.
// 4. Long-press auto-repeat on every stepper (.step/.rstep/.wtstep):
//    450ms delay then 140ms repeats through the normal click path; the
//    release-click is swallowed so a hold never lands one extra step.
// 5. wset no longer rebuilds the setlist per keystroke (moved to a
//    commit-time change handler) and treats an emptied field as "still
//    typing", mirroring setwt's "" -> no-change contract.
// 6. The 26px .step header steppers get the ::after hit-area extension
//    the ghost steppers already had.
const fs = require('fs');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 1. Typable reps ----------
{
  ok(/<input class="rval mono" type="number" inputmode="numeric" min="0" max="100" enterkeyhint="done"/.test(SRC),
    'the reps value is a typable number input, clamped 0-100, with enterkeyhint');
  ok(/data-act="repset"/.test(SRC), 'the reps input dispatches through data-act="repset"');
  ok(!/<span class="rval">/.test(SRC), 'no read-only rval span remains in the set row');
  ok(/rrow\.querySelector\("\.rval"\)\.value, 10/.test(SRC.replace(/\n/g, ' ')) || /parseInt\(rrow\.querySelector\("\.rval"\)\.value, 10\)/.test(SRC),
    'the rep± steppers read the input VALUE (not textContent)');
  ok(/rrow\.querySelector\("\.rval"\)\.value = rnv;/.test(SRC), 'the rep± steppers write back via .value');
  ok(/Math\.max\(0, Math\.min\(100, rcur \+ \(act === "rep\+" \? 1 : -1\)\)\)/.test(SRC), 'steppers share the same 0-100 clamp');
  ok(/} else if \(act === "repset"\) \{[\s\S]{0,400}Math\.max\(0, Math\.min\(100, parseInt\(rawR, 10\) \|\| 0\)\)/.test(SRC),
    'the typed-reps input branch clamps to 0-100 and writes actual_reps');
  ok(/act === "repset"\) \{[\s\S]{0,500}if \(rawR === ""\) return;/.test(SRC), 'an emptied reps field is "still typing", not a 0-rep write');
  // 18 July 2026: width tightened 56px -> 38px, then to 32px (reclaiming
  // room the .setrow__wtinput decimal-clipping fix spent) as part of the
  // horizontal weight+reps+Log single-line layout; the chip look this test
  // guards (no border, fixed width, no native spinners) is unchanged.
  ok(/input\.rval \{ border: 0; width: 32px; appearance: textfield/.test(SRC), 'the input keeps the chip look (no border, fixed width, no native spinners)');
}

// ---------- 2 + 3. Select-on-focus and Enter commits ----------
{
  ok(/listEl\.addEventListener\("focusin", function \(ev\) \{[\s\S]{0,400}el\.select\(\)/.test(SRC),
    'delegated focusin selects the field contents (survives re-renders)');
  ok(/setTimeout\(function \(\) \{ try \{ el\.select\(\); \} catch \(e\) \{\} \}, 0\)/.test(SRC), 'select is deferred a tick for WebKit');
  ok(/'input\[data-act="wset"\], input\[data-act="setwt"\], input\[data-act="repset"\]'/.test(SRC), 'all three number fields are covered');
  ok(/ev\.key !== "Enter"\) return;[\s\S]{0,300}el\.blur\(\);/.test(SRC), 'Enter blurs (= commits via the change handler)');
  const ekh = (SRC.match(/enterkeyhint="done"/g) || []).length;
  ok(ekh >= 3, 'enterkeyhint="done" on at least the three day-view fields (found ' + ekh + ')');
}

// ---------- 4. Long-press auto-repeat ----------
{
  ok(/listEl\.addEventListener\("pointerdown", function \(ev\) \{[\s\S]{0,300}'\.step\[data-act\], \.rstep, \.wtstep'/.test(SRC),
    'long-press arms on every stepper family');
  ok(/setTimeout\(function \(\) \{\s*lpInterval = setInterval/.test(SRC), 'repeat starts after the hold delay');
  ok(/\}, 140\);\s*\}, 450\);/.test(SRC), '450ms hold, 140ms repeat cadence');
  ok(/lpSynthetic = true; b\.click\(\); lpSynthetic = false;/.test(SRC), 'repeats fire through the button\'s normal click path');
  ok(/if \(b && lpFired\) \{ lpFired = false; ev\.stopPropagation\(\); ev\.preventDefault\(\); \}/.test(SRC),
    'the release-click after a long-press is swallowed (no extra step)');
  ok(/\["pointerup", "pointercancel"\]\.forEach\(function \(t\) \{ window\.addEventListener\(t, lpStop, true\); \}\)/.test(SRC),
    'repeat stops on release/cancel anywhere on the page');
}

// ---------- 5. wset: no per-keystroke rebuild, empty = no-change ----------
{
  const wsetIdx = SRC.indexOf('if (act === "wset") {');
  const wsetBranch = SRC.slice(wsetIdx, SRC.indexOf('} else if (act === "repset")', wsetIdx));
  ok(/var rawW = String\(el\.value\)\.trim\(\); if \(rawW === ""\) return;/.test(wsetBranch),
    'an emptied working-weight field no longer writes 0 kg mid-edit');
  ok(!/setRowsInner/.test(wsetBranch), 'the input handler no longer rebuilds the setlist per keystroke');
  ok(/listEl\.addEventListener\("change", function \(ev\) \{[\s\S]{0,700}sl\.innerHTML = setRowsInner\(e, lg, !!ut\);/.test(SRC),
    'the setlist rebuild moved to the commit-time change handler');
  ok(/if \(String\(el\.value\)\.trim\(\) === ""\) el\.value = lg\.weight;/.test(SRC),
    'an abandoned-empty weight field is restored to the stored value on commit');
  ok(/act === "repset"\) \{\s*\/\/ Echo the stored value[\s\S]{0,300}el\.value = rsr\.reps;/.test(SRC),
    'an abandoned-empty reps field is restored to the stored value on commit');
  ok(/listEl\.addEventListener\("change"[\s\S]{0,200}isPreviewSession\(state\.activeSession\)\) return;/.test(SRC),
    'the change handler keeps the same preview write-guard as onListInput');
}

// ---------- 6. Header stepper hit-area ----------
{
  ok(/\.step \{ position: relative;/.test(SRC), '.step is a positioning context for its hit-area');
  ok(/\.step::after \{ content: ""; position: absolute; inset: -8px -6px; \}/.test(SRC),
    'the 26px header steppers get the invisible hit-area extension');
}

// ---------- 7. Coach-span untouched ----------
{
  const { execFileSync } = require('child_process');
  const spanMd5 = execFileSync('sh', ['-c', "sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5"]).toString().trim();
  ok(spanMd5 === '1081700e58396438a0b408febcfdc56b', 'coach-span md5 unchanged (1081700e58396438a0b408febcfdc56b), got ' + spanMd5);
}

console.log(`UX audit Batch B (weight & reps entry ergonomics): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
