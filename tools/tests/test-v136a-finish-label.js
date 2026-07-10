// v136A — Finish label + optional-skip source-level guards.
//
// These are static assertions against index.html source: the live-bar action
// must always read "Finish" (never "End"/"Quit"/"Abandon"/"Stop"), and the
// visible optional Skip must be scoped to warm-up/cool-down blocks only. They
// guard the copy contract and scoping without needing a DOM, complementing the
// live smoke checks.
const fs = require('fs');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- Test 1: initial live-bar markup reads "Finish" ----------
{
  const m = SRC.match(/id="liveBarEnd"[^>]*>([^<]*)</);
  ok(!!m, 'the live-bar action button (#liveBarEnd) is present in markup');
  ok(m && m[1].trim() === 'Finish', 'initial live-bar markup label is "Finish" (test 1)');
}

// ---------- Test 1/2: renderDayBar never assigns "End" to the button ----------
{
  // The old contract flipped the label to "End" while incomplete. Assert no
  // assignment of "End" (or the other banned verbs) to endBtn.textContent.
  const banned = ['End', 'Quit', 'Abandon', 'Stop'];
  banned.forEach(function (word) {
    const re = new RegExp('endBtn\\.textContent\\s*=\\s*[^;]*["\\x27]' + word + '["\\x27]');
    ok(!re.test(SRC), 'renderDayBar never sets the action label to "' + word + '" (test 2)');
  });
  ok(/endBtn\.textContent\s*=\s*"Finish"\s*;/.test(SRC), 'renderDayBar sets the action label unconditionally to "Finish"');
}

// ---------- Test: no visible "End" label remains in the active-workout flow ----------
{
  // The livebar button is the only session action; confirm no stray >End<
  // text node on a livebar/appbar control. (Receipt copy is checked separately.)
  ok(!/id="liveBarEnd"[^>]*>\s*End\s*</.test(SRC), 'no "End" text remains on the live-bar action');
}

// ---------- Test: receipt copy is honest for an early finish ----------
// v1.8 TEMPO Ticket 2 (approved) replaced "Finished early" / "· finished
// early" with the new partial-finish headline "Enough for today." -- the
// negative "Session ended" wording this test originally guarded against
// is still gone, which is the part of the original intent that still holds.
{
  ok(/"Enough for today\."/.test(SRC), 'partial-finish headline reads "Enough for today." (v1.8 TEMPO, approved)');
  ok(!/"Session ended"/.test(SRC), 'the negative "Session ended" copy is gone');
}

// ---------- Test 3/4/5: visible optional Skip is scoped to warm-up/cool-down ----------
{
  // The visible skip is gated on the block tag and reuses the existing skipex
  // handler (no new skip state).
  ok(/e\.block === "warmup" \|\| e\.block === "cooldown"[\s\S]{0,200}card__skip-optional/.test(SRC),
     'the visible optional Skip is gated on warmup/cooldown blocks (tests 3/4)');
  ok(/card__skip-optional"[^>]*data-act="skipex"/.test(SRC),
     'the visible optional Skip reuses the existing skipex handler (no new skip state)');
  // Main-lift path: the buildCard main return must NOT emit card__skip-optional
  // for a non-warmup/cooldown block -- guaranteed by the gate above being the
  // ONLY place the class is produced.
  const occurrences = (SRC.match(/card__skip-optional/g) || []).length;
  // Expected: 2 CSS rules (base + :hover) + 1 in the gated button string = 3.
  ok(occurrences === 3, 'card__skip-optional appears only in its two CSS rules and the one gated button (no leak onto main exercises) (test 5) — found ' + occurrences);
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
