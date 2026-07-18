// UX audit Batch D (13 July 2026, James: "do all") -- protection against
// silent data loss and unrecoverable mis-taps:
// 1. Undo on the three unprotected destructive taps: skip exercise,
//    conditioning swap-pick, injury-chip delete (Settings categories +
//    quick-add). Each undo also unwinds its bumpPref learned-preference
//    writes so a mis-tap teaches the ranker nothing.
// 2. Swipe-switch guard: 60px/1.8x -> 100px/3x so a sloppy vertical scroll
//    can't silently teleport to another session; a real switch is toasted
//    with the day's name.
// 3. Archive prune warning: dropping the oldest of the 12 archived
//    programs is announced with an export nudge (was the one place the
//    app permanently discarded training data in silence).
// 4. Storage-full escalation: a second consecutive save failure surfaces
//    an actionable "Export backup" toast, not just a passing note.
// 5. Quarantine recovery UI: the recovery blob kept at boot is now
//    reachable from Settings (coerceState-gated, confirm-first).
// 6. Calm (danger:false) confirms treat a backdrop tap as Cancel.
// 7. History drill-down backdrop goes back one level, not full-close.
const fs = require('fs');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 1. Undo coverage ----------
{
  ok(/toastUndo\(e\.name \+ " skipped today", function \(\) \{[\s\S]{0,300}wRe\.el\.skipped = false;[\s\S]{0,120}bumpPref\(state\.athlete, canonicalExName\(e\.name\), 1\);/.test(SRC),
    'skip exercise gets Undo, and the undo reverts the -1 preference nudge');
  ok(/var prevSwap = \{ name: e\.name, equipment: e\.equipment, notes: e\.notes \};/.test(SRC), 'swap-pick snapshots the previous exercise');
  ok(/toastUndo\("Swapped to " \+ alt\.name, function \(\) \{[\s\S]{0,400}e\.name = prevSwap\.name; e\.equipment = prevSwap\.equipment; e\.notes = prevSwap\.notes;/.test(SRC),
    'swap-pick gets Undo restoring the previous exercise');
  const swapUndo = SRC.slice(SRC.indexOf('toastUndo("Swapped to "'), SRC.indexOf('toastUndo("Swapped to "') + 500);
  ok((swapUndo.match(/bumpPref\(/g) || []).length >= 2, 'the swap undo unwinds BOTH preference writes');
  ok(/toastUndo\('Removed "' \+ delTarget \+ '"', function \(\) \{[\s\S]{0,150}addAthleteInjury\(cat, delTarget\)/.test(SRC),
    'Settings category injury-chip delete gets Undo (re-adds via the shared write path)');
  ok(/toastUndo\('Removed "' \+ qTarget \+ '"', function \(\) \{[\s\S]{0,150}addAthleteInjury\(qCat, qTarget\)/.test(SRC),
    'quick-add injury-chip delete gets the same Undo');
}

// ---------- 2. Swipe guard ----------
{
  ok(/Math\.abs\(dx\) > 100 && Math\.abs\(dx\) > Math\.abs\(dy\) \* 3/.test(SRC), 'swipe threshold raised to 100px and 3x horizontal dominance');
  ok(!/Math\.abs\(dx\) > 60 && Math\.abs\(dx\) > Math\.abs\(dy\) \* 1\.8/.test(SRC), 'the old 60px/1.8x trigger is gone');
  ok(/if \(swipeSuppress\) toast\("Switched to " \+ curSession\(\)\.name\);/.test(SRC), 'a successful swipe switch names where you landed');
}

// ---------- 3. Archive prune warning ----------
{
  ok(/function archiveWithPruneWarning\(\) \{[\s\S]{0,600}state\.archive = pruneArchive\(state\.archive, 12\);[\s\S]{0,300}Export a backup in Settings/.test(SRC),
    'the shared archive helper warns when the oldest program is dropped');
  ok(/var willDrop = state\.archive\.length >= 12 \? state\.archive\[0\] : null;/.test(SRC), 'the warning names the program actually dropped');
  const helperUses = (SRC.match(/archiveWithPruneWarning\(\);/g) || []).length;
  ok(helperUses === 2, 'both archive sites (confirmBuild + confirmLoad) route through the helper (found ' + helperUses + ')');
  const inlinePrunes = (SRC.match(/state\.archive = pruneArchive\(state\.archive, 12\);/g) || []).length;
  ok(inlinePrunes === 1, 'no silent inline prune remains outside the helper (found ' + inlinePrunes + ')');
}

// ---------- 4. Storage-full escalation ----------
{
  ok(/saveFailCount\+\+;[\s\S]{0,300}if \(saveFailCount >= 2\) toastUndo\("Storage is full · changes are NOT saving", function \(\) \{ exportBackup\(\); \}, "Export backup"\);/.test(SRC),
    'a second consecutive save failure escalates to an actionable Export toast');
  ok(/return;\s*\}\s*saveFailCount = 0;/.test(SRC), 'a successful save resets the failure counter');
  ok(/function toastUndo\(msg, onUndo, actionLabel\) \{/.test(SRC) && /btn\.textContent = actionLabel \|\| "Undo";/.test(SRC),
    'toastUndo grew an optional action label (defaults to Undo for every existing caller)');
}

// ---------- 5. Quarantine recovery ----------
{
  ok(/<button class="btn" id="recoverQuarantineBtn" type="button" hidden>Recover previous data<\/button>/.test(SRC),
    'Settings has a hidden-by-default Recover previous data button');
  ok(/qRaw = localStorage\.getItem\(STORE \+ ":quarantine"\);[\s\S]{0,80}if \(!qRaw\) return;\s*rq\.hidden = false;/.test(SRC),
    'the button only appears when a quarantine blob actually exists');
  ok(/recovered = coerceState\(JSON\.parse\(qRaw\)\);/.test(SRC), 'recovery runs the same coerceState gate a normal load uses');
  ok(/if \(!recovered\) \{ toast\("The recovery copy couldn't be read either · it stays kept on this device"\); return; \}/.test(SRC),
    'a corrupt recovery copy is refused, not swapped in blind, and is NOT deleted');
  ok(/title: "Recover previous data\?",[\s\S]{0,400}Export a backup of the current data first/.test(SRC),
    'recovery is confirm-first and nudges an export of the current data');
}

// ---------- 6. Calm confirm backdrop = Cancel ----------
{
  ok(/function onBackdrop\(ev\) \{ if \(ev\.target === dlg && opts\.danger === false\) onNo\(\); \}/.test(SRC),
    'backdrop tap cancels ONLY calm (danger:false) confirms; destructive ones still need a button');
  ok(/dlg\.removeEventListener\("click", onBackdrop\);/.test(SRC), 'the backdrop handler is torn down with the others (no stale handler on the shared dialog)');
}

// ---------- 7. History drill-down backdrop ----------
// (Removed 18 July 2026: this covered the histback "go back one level" path,
// which only existed because the Progress tab's lift list could be drilled
// into. Progress is gone -- openExerciseHistory is now a single-level dialog
// with a plain backdrop-closes-everything handler, verified elsewhere.)

// ---------- 8. Coach-span untouched ----------
{
  const { execFileSync } = require('child_process');
  const spanMd5 = execFileSync('sh', ['-c', "sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5"]).toString().trim();
  ok(spanMd5 === '1081700e58396438a0b408febcfdc56b', 'coach-span md5 unchanged (1081700e58396438a0b408febcfdc56b), got ' + spanMd5);
}

console.log(`UX audit Batch D (data protection): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
