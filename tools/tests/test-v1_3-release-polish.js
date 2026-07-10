// v1.3 -- Release Polish: onboarding product line, user-facing version,
// feedback hint, Just Today reason line, zero-logged Finish toast, copy pass.
//
// All source-level guards (static markup/copy) plus a functional
// re-derivation of the new dayReasonLine push/pull/legs aggregation
// (extracted verbatim and run against synthetic debt inputs), so the
// grouping logic itself is a real regression guard, not just a string match.
const fs = require('fs');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- Test 1: onboarding product line ----------
{
  // v1.5: the opening-screen upgrade splits this line across two lines with
  // <br> (matching the ticket's given copy block) -- the words themselves
  // are unchanged, only the line break was added.
  ok(/<p class="intro__product">Training built for you\.<br>Logged on your phone\.<\/p>/.test(SRC),
     'the exact product line appears on the first onboarding screen (test 1)');
  const introIdx = SRC.indexOf('id="introStep1"');
  const productIdx = SRC.indexOf('intro__product', introIdx);
  const titleIdx = SRC.indexOf('intro__title">Let\'s make this yours.', introIdx);
  const step2Idx = SRC.indexOf('id="introStep2"', introIdx);
  ok(introIdx >= 0 && productIdx > introIdx && productIdx < titleIdx && titleIdx < step2Idx,
     'the product line sits before "Let\'s make this yours." inside step 1, not a new screen');
  ok(/Stays on your phone\. Always\./.test(SRC), 'the existing privacy line is preserved');
  // The existing 4 onboarding steps (name, how-it-works, injury, experience) are untouched --
  // no new step was added for the product line, it was folded into step 1.
  const stepCount = (SRC.match(/class="intro__step"/g) || []).length;
  ok(stepCount === 4, 'no extra onboarding screen was added -- still exactly the 4 pre-existing intro steps, found ' + stepCount);
}

// ---------- Test 2/3: user-facing version ----------
{
  ok(/Fifth Digit Coach · v1\.3 · works fully offline/.test(SRC),
     'the footer/Settings shows "Fifth Digit Coach · v1.3 · works fully offline" (test 2)');
  ok(!/Fifth Digit Coach · v2 ·/.test(SRC),
     'the footer no longer shows the internal schema version "v2" as the user-facing release (test 3)');
  // The internal storage schema marker (a totally different concern) must be untouched.
  ok(/var STORE = "training-log:v2"/.test(SRC), 'the internal storage key schema version is untouched (not a user-facing string)');
  ok(/version: 2,/.test(SRC), 'the internal state.version schema field is untouched');
}

// ---------- Test 4: feedback hint near export/backup ----------
{
  const exportIdx = SRC.indexOf('id="exportBtn"');
  const hintIdx = SRC.indexOf('Something off? Export your backup and send it over.');
  ok(hintIdx > 0, 'the feedback hint text exists (test 4)');
  ok(exportIdx > 0 && hintIdx > exportIdx && (hintIdx - exportIdx) < 600,
     'the feedback hint sits close to the Export backup button, not elsewhere in Settings');
  ok(!/feedback form|<form/i.test(SRC.slice(exportIdx, hintIdx + 200)),
     'no feedback form was added around the hint');
}

// ---------- Test 5: Just Today reason line (functional, not just string match) ----------
{
  ok(/function dayReasonLine\(spec\)/.test(SRC), 'dayReasonLine helper exists (test 5)');
  ok(!/function resolveSpec\(request, state\) \{[\s\S]*dayReasonLine/.test(SRC.slice(SRC.indexOf('function resolveSpec'), SRC.indexOf('function resolveSpec') + 20000)),
     'dayReasonLine is not called from inside resolveSpec (coach-span untouched)');
  const coachStart = SRC.indexOf('/*__COACH_START__*/'), coachEnd = SRC.indexOf('/*__COACH_END__*/');
  const reasonIdx = SRC.indexOf('function dayReasonLine');
  ok(reasonIdx > coachEnd, 'dayReasonLine is defined OUTSIDE the coach-span markers');

  // Extract dayReasonLine verbatim and run it against synthetic spec.debt inputs.
  function extractFn(name) {
    const sig = 'function ' + name + '(';
    const at = SRC.indexOf(sig);
    const braceStart = SRC.indexOf('{', at);
    let depth = 0, i = braceStart, inStr = null, prev = '';
    for (; i < SRC.length; i++) {
      const c = SRC[i], nx = SRC[i + 1];
      if (inStr) { if (c === inStr && prev !== '\\') inStr = null; prev = c; continue; }
      if (c === '/' && nx === '/') { const nl = SRC.indexOf('\n', i); i = nl < 0 ? SRC.length : nl; prev = '\n'; continue; }
      if (c === '/' && nx === '*') { const end = SRC.indexOf('*/', i + 2); i = end < 0 ? SRC.length : end + 1; prev = '/'; continue; }
      if (c === '"' || c === "'" || c === '`') { inStr = c; }
      else if (c === '{') depth++;
      else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
      prev = c;
    }
    return SRC.slice(at, i);
  }
  function extractConst(name) {
    const idx = SRC.indexOf('function esc(');
    return SRC.slice(idx, idx + 200); // not used directly; esc stubbed below
  }
  const harness = `
    function esc(s) { return String(s); }
    ${extractFn('dayReasonLine')}
    module.exports = { dayReasonLine };
  `;
  const m = { exports: {} };
  new Function('module', 'exports', harness)(m, m.exports);
  const { dayReasonLine } = m.exports;

  // Pull most behind -> "Pull today."
  ok(/Pull today\./.test(dayReasonLine({ debt: { byPattern: {
    horiz_pull: { debt: 8 }, vert_pull: { debt: 4 }, horiz_push: { debt: 1 }, vert_push: { debt: 0 },
    squat: { debt: 0 }, hinge: { debt: 0 }, lunge: { debt: 0 }
  } } })), 'when pull debt is highest, the reason line says "Pull today." with real data');

  // Legs most behind -> "Lower today."
  ok(/Lower today\./.test(dayReasonLine({ debt: { byPattern: {
    horiz_pull: { debt: 0 }, vert_pull: { debt: 0 }, horiz_push: { debt: 0 }, vert_push: { debt: 0 },
    squat: { debt: 10 }, hinge: { debt: 6 }, lunge: { debt: 2 }
  } } })), 'when leg-pattern debt is highest, the reason line says "Lower today."');

  // Push most behind -> "Push today."
  ok(/Push today\./.test(dayReasonLine({ debt: { byPattern: {
    horiz_pull: { debt: 0 }, vert_pull: { debt: 0 }, horiz_push: { debt: 5 }, vert_push: { debt: 5 },
    squat: { debt: 1 }, hinge: { debt: 0 }, lunge: { debt: 0 }
  } } })), 'when push debt is highest, the reason line says "Push today."');

  // No real debt anywhere -> honest blank, not a fabricated reason.
  ok(dayReasonLine({ debt: { byPattern: {
    horiz_pull: { debt: 0 }, vert_pull: { debt: 0 }, horiz_push: { debt: 0 }, vert_push: { debt: 0 },
    squat: { debt: 0 }, hinge: { debt: 0 }, lunge: { debt: 0 }
  } } }) === '', 'with zero debt across every group, dayReasonLine returns an honest blank (no fake reason)');

  // Missing/malformed spec -> safe fallback, never throws.
  ok(dayReasonLine(null) === '', 'dayReasonLine coerces safely on a null spec');
  ok(dayReasonLine({}) === '', 'dayReasonLine coerces safely on a spec with no debt field');

  // Exactly one reason line renders -- never a list.
  const line = dayReasonLine({ debt: { byPattern: { horiz_pull: { debt: 8 } } } });
  ok((line.match(/<p class="today-reason">/g) || []).length <= 1, 'dayReasonLine renders at most one paragraph -- never a dashboard list');
  ok(!/Behind this week:/.test(line), 'the old multi-item "Behind this week: X, Y" list format is gone from the reason line output');
}

// ---------- Test 6: zero-logged Finish toast ----------
{
  ok(/toast\("Nothing logged\. Left as is\."\);/.test(SRC),
     'the exact zero-logged Finish toast copy exists in source (test 6)');
  const endSessionIdx = SRC.indexOf('function endSession()');
  const elseIdx = SRC.indexOf('} else {', endSessionIdx);
  const toastIdx = SRC.indexOf('toast("Nothing logged. Left as is.");', endSessionIdx);
  const backIdx = SRC.indexOf('backToWeek();', elseIdx);
  ok(elseIdx > endSessionIdx && toastIdx > elseIdx && backIdx > elseIdx && backIdx < toastIdx,
     'the zero-logged branch still calls backToWeek() (before the toast), preserving "no receipt, return to week"');
  ok(!/finishedAt = new Date\(\)\.toISOString\(\);[\s\S]{0,40}\} else \{/.test(SRC),
     'finishedAt is still written only in the >0-logged branch, never in the zero-logged else');
}

// ---------- Test 7: copy pass ----------
{
  ok(!/Nice work this week/.test(SRC), '"Nice work this week" no longer appears anywhere (test 7)');
  ok(/Week's work done/.test(SRC), 'the week-complete hero heading now reads "Week\'s work done"');
  ok(!/"Session complete"/.test(SRC), 'the literal "Session complete" string is gone from source');
  ok(/That's the work done/.test(SRC), '"That\'s the work done" appears for the completion receipt copy');
  // Both the static markup default and the JS assignment were updated (not just one).
  const staticIdx = SRC.indexOf('id="completeOverline">That\'s the work done<');
  const jsIdx = SRC.indexOf('$("completeOverline").textContent = ended ? "Finished early" : "That\'s the work done";');
  ok(staticIdx > 0, 'the static receipt markup default was updated to the new copy');
  ok(jsIdx > 0, 'the JS assignment for the full-completion overline was updated to the new copy');
  // Early-finish copy (v136A, untouched by this ticket) must survive unchanged.
  ok(/"Finished early"/.test(SRC), 'the early-finish overline copy "Finished early" is untouched');
}

// ---------- v136A/v135/v136B regression guards (unchanged strings must survive) ----------
{
  ok(/endBtn\.textContent = "Finish";/.test(SRC), 'Finish label assignment is still unconditional (regression guard)');
  ok(/function isSessionFinished\(ses\)/.test(SRC), 'isSessionFinished still present (v136A)');
  ok(/card__skip-optional/.test(SRC), 'visible optional warm-up/cool-down Skip still present (v136A)');
  ok(/id="liveBarStart">Start<\/button>/.test(SRC), 'the workout-screen Start control still present (v136B)');
  ok(/var ctaLabel = weekDone \? "Build next week" : started \? "Continue" : "Start the session";/.test(SRC),
     'hero CTA reads "Start the session" (v1.8 TEMPO rename, approved)');
  ok(/Signing off session…/.test(SRC), 'the signing-off beat copy is untouched');
  ok(/\.cuebox \{ display: flex; flex-direction: column; gap: 8px; background: none;/.test(SRC),
     'form-note left-rule styling is untouched');
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
