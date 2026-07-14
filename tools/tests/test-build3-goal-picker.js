// Build item 3 (13 July 2026) -- new goal picker (Master Ticket Priority 4).
// Get stronger / Build muscle / Strength + cardio / "Not sure?" fallback,
// replacing Hybrid/Strength/Endurance. Endurance stays hidden (not deleted).
// "Build muscle" opens the engine's pre-existing hypertrophy goal and
// "Not sure?" the pre-existing general goal -- both already fully supported
// by generateProgram/buildIntent; this ticket only wires the UI + the
// buildPrefs() goal whitelist to stop discarding them.
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const SRC_FULL = lines.join('\n');
const helper = lines.slice(lines.findIndex(l => /function clampInt\(/.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={generateProgram,normalizeAthlete};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const { generateProgram, normalizeAthlete } = m.exports;

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 1. Markup: three real goal cards + a separate "Not sure?" fallback link ----------
{
  ok(/data-goal="strength" type="button">Get stronger/.test(SRC_FULL), '"Get stronger" card wired to data-goal="strength"');
  ok(/data-goal="hypertrophy" type="button">Build muscle/.test(SRC_FULL), '"Build muscle" card wired to data-goal="hypertrophy" (the engine\'s existing hidden goal)');
  ok(/data-goal="hybrid" type="button">Strength \+ cardio/.test(SRC_FULL), '"Strength + cardio" card wired to data-goal="hybrid" (renamed, same goal)');
  ok(/data-goal="endurance" type="button" hidden>Endurance/.test(SRC_FULL), 'Endurance stays hidden, not deleted (per ticket: shelved until real cardio depth exists)');
  ok(/id="bGoalUnsure" type="button">Not sure\? I.ll build you a balanced week\./.test(SRC_FULL), '"Not sure?" fallback line present with the exact ticket copy');
}

// ---------- 2. buildPrefs() goal whitelist accepts hypertrophy + general, not just hybrid/strength ----------
{
  const fnStart = SRC_FULL.indexOf('function buildPrefs()');
  const fnSlice = SRC_FULL.slice(fnStart, fnStart + 700);
  ok(/\["hybrid", "strength", "hypertrophy", "general"\]\.indexOf\(p\.goal\)/.test(fnSlice), 'buildPrefs() goal whitelist now includes hypertrophy and general (previously silently discarded to hybrid)');
}

// ---------- 3. Click handlers: hypertrophy suppresses conditioning like strength; "Not sure?" sets goal=general ----------
{
  ok(/p\.goal === "strength" \|\| p\.goal === "hypertrophy"\) \{ p\.conditioning = false; \}/.test(SRC_FULL), 'Build-muscle (hypertrophy), like Get-stronger, turns conditioning off by default -- a lifting-focused goal shouldn\'t silently add cardio');
  ok(/bGoalUnsure"\)\.addEventListener\("click", function \(\) \{ var p = buildPrefs\(\); p\.goal = "general";/.test(SRC_FULL), '"Not sure?" link sets goal to the engine\'s existing "general" (balanced) goal');
}

// ---------- 4. The engine actually builds a real sample week for both new goals, with no crash and non-empty sessions ----------
{
  const athlete = normalizeAthlete(null);
  ['hypertrophy', 'general'].forEach(goal => {
    const program = generateProgram(
      { goal: goal, minutes: 45, days: 4, weeks: 4, mobility: true, conditioning: false, equipment: null },
      {}, 12345, {}, null, athlete, null, {}, null
    );
    ok(program && Array.isArray(program.weeks) && program.weeks.length === 4, `generateProgram(goal:"${goal}") returns a 4-week program`);
    const week1 = program.weeks[0];
    ok(Array.isArray(week1.sessions) && week1.sessions.length === 4, `generateProgram(goal:"${goal}") week 1 has all 4 requested sessions`);
    week1.sessions.forEach((ses, i) => {
      ok(Array.isArray(ses.exercises) && ses.exercises.length > 0, `generateProgram(goal:"${goal}") session ${i + 1} is non-empty (${ses.exercises && ses.exercises.length} exercises)`);
    });
  });
}

// ---------- 5. Coach-span untouched (this ticket only touches UI wiring + buildPrefs, not coach logic) ----------
{
  const { execSync } = require('child_process');
  const spanMd5 = execSync(`sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5`).toString().trim();
  ok(spanMd5 === 'ce6452b369d4d1d14fd0bf8560208ce7', 'coach-span md5 unchanged (ce6452b369d4d1d14fd0bf8560208ce7), got ' + spanMd5);
}

// ---------- 6. No new localStorage key -- goal is still just a field on the existing buildPrefs object ----------
{
  const setItemCalls = SRC_FULL.match(/localStorage\.setItem\([^,]+,/g) || [];
  ok(setItemCalls.length === 8, 'localStorage.setItem call count unchanged at 8 (Batch A added tl:liveSid, the live-run session id) (got ' + setItemCalls.length + ')');
}

console.log(`Build item 3 (goal picker): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
