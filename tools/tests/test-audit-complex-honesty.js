// Complex/circuit honesty (16 July 2026, James): "we make a workout
// structure to have all the exercises -- it's an expert, it cannot provide
// only copy with no data." Root cause of the live-audit finding (a
// prescribed AMRAP whose only visible content was the name "Kettlebell
// Complex"): kb-complex was a flat library entry whose swing/clean/press
// contents existed ONLY in its cue prose. This pass makes complex contents
// structured data and makes the copy-only failure mode impossible:
// 1. Library schema: optional `movements` array (2-6 real movement names),
//    validated by libraryIntegrity.
// 2. NEVER-AGAIN RULE: any entry NAMED complex/circuit/medley/flow without
//    movements[] fails libraryIntegrity -- so the whole Node suite fails.
// 3. kb-complex gains its real movements; four new structured complexes
//    across disciplines (barbell, dumbbell, bodyweight, band) join the
//    conditioning pool with full Section-C tags.
// 4. UI renders movements wherever the exercise appears: the density card's
//    move list (.dc__submoves) and the regular exercise card under the name
//    (.card__movements) -- looked up from LIBRARY by name at render time, so
//    NO persisted-programme schema change.
// Coach-span note: the library and libraryIntegrity live inside the span, so
// its md5 changed BY DESIGN this pass (James's standing coach-span allowance)
// -- every test file's expected hash was resynced to the new value.
const fs = require('fs');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- Extract the coach span and run LIBRARY + libraryIntegrity for
// real -- same proven harness pattern as test-v1_7-time-budget-honesty.js
// (repo-owned source evaluated in-process; nothing untrusted). ----------
const LINES = SRC.split('\n');
const csStart = LINES.findIndex(l => l.includes('/*__COACH_START__*/'));
const csEnd = LINES.findIndex(l => l.includes('/*__COACH_END__*/'));
const coachSpanBody = LINES.slice(csStart + 1, csEnd).join('\n');
const helper = LINES.slice(LINES.findIndex(l => /function clampInt\(/.test(l)), LINES.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const engineMod = { exports: {} };
new Function('module', 'exports', helper + '\n' + coachSpanBody + '\n; module.exports={LIBRARY,libraryIntegrity};')(engineMod, engineMod.exports);
const LIB = engineMod.exports.LIBRARY, libraryIntegrity = engineMod.exports.libraryIntegrity;

// ---------- 1. The real library passes the strengthened validator ----------
{
  const res = libraryIntegrity(LIB);
  ok(res.ok, 'the shipped library passes libraryIntegrity incl. the new movements rules: ' + (res.errors || []).slice(0, 5).join(' | '));
}

// ---------- 2. NEVER-AGAIN: a copy-only complex fails validation ----------
{
  const fake = LIB.concat([Object.assign({}, LIB.filter(e => e.id === 'kb-complex')[0], { id: 'fake-complex', name: 'Fake Sandbag Complex', movements: undefined })]);
  const res = libraryIntegrity(fake);
  ok(!res.ok && res.errors.some(e => /fake-complex.*movements\[\] -- contents must be data, not copy/.test(e)),
    'an entry NAMED as a complex without movements[] fails the whole library validation (the failure mode is now impossible to ship)');
  const badList = LIB.concat([Object.assign({}, LIB.filter(e => e.id === 'kb-complex')[0], { id: 'thin-complex', name: 'Thin Complex', movements: ['Only One'] })]);
  const res2 = libraryIntegrity(badList);
  ok(!res2.ok && res2.errors.some(e => /thin-complex.*2-6 movements/.test(e)), 'a 1-item movements list is rejected (a complex of one movement is not a complex)');
}

// ---------- 3. Every named complex/circuit in the shipped library has real movements ----------
{
  const named = LIB.filter(e => /complex|circuit|medley|flow/i.test(e.name));
  ok(named.length >= 5, 'the library carries at least 5 structured complexes/circuits across disciplines, found ' + named.length);
  named.forEach(e => {
    ok(Array.isArray(e.movements) && e.movements.length >= 2 && e.movements.every(m => typeof m === 'string' && m.trim()),
      e.id + ' has a real structured movements list (' + (e.movements || []).join(', ') + ')');
  });
  const equips = named.map(e => e.equipment);
  ['kettlebell', 'barbell', 'dumbbell', 'bodyweight', 'band'].forEach(eq => {
    ok(equips.indexOf(eq) >= 0, 'discipline covered: a structured complex/circuit exists for ' + eq);
  });
  const kb = LIB.filter(e => e.id === 'kb-complex')[0];
  ok(kb && kb.movements.join('|') === 'Kettlebell Swing|Kettlebell Clean|Kettlebell Overhead Press',
    'kb-complex (the original offender) now carries its real swing/clean/press contents as data');
}

// ---------- 4. New entries are selectable conditioning (same pool as the old finisher) ----------
{
  ['barbell-complex', 'db-complex', 'bw-circuit', 'band-circuit'].forEach(id => {
    const e = LIB.filter(x => x.id === id)[0];
    ok(!!e, id + ' exists');
    if (e) {
      ok(e.type === 'conditioning' && e.intensity === 'interval', id + ' sits in the interval-conditioning pool pickConditioning draws from');
      ok(/setup:/i.test(e.cue) && /key:/i.test(e.cue) && /fault:/i.test(e.cue), id + ' has a full Setup/Key/Fault cue');
    }
  });
}

// ---------- 5. UI renders movements wherever the exercise appears ----------
{
  ok(/function libMovementsFor\(name\) \{\s*var lib = libByName\(name\);\s*return \(lib && Array\.isArray\(lib\.movements\) && lib\.movements\.length\) \? lib\.movements : null;\s*\}/.test(SRC),
    'render-time lookup helper exists -- persisted programmes are untouched (no data-shape change)');
  ok(/var mv = libMovementsFor\(e\.name\);\s*var mvHtml = mv \? '<span class="dc__submoves">' \+ mv\.map\(esc\)\.join\(" → "\) \+ '<\/span>' : "";/.test(SRC),
    'the density (EMOM/AMRAP) card lists the complex\'s movements');
  ok(/\(libMovementsFor\(e\.name\) \? '<p class="card__movements">' \+ libMovementsFor\(e\.name\)\.map\(esc\)\.join\(" → "\) \+ '<\/p>' : ''\)/.test(SRC),
    'the regular exercise card (live AND preview -- same builder) shows the movements under the name');
  ok(/var mv = libMovementsFor\(e\.name\);\s*var mvHtml = mv \? '<p class="preview__ex-moves">' \+ mv\.map\(esc\)\.join\(" → "\) \+ '<\/p>' : "";/.test(SRC),
    'the read-only session preview row (the EXACT renderer from James\'s phone screenshot) shows the movements');
  ok(/\.dc__submoves \{ flex-basis: 100%;/.test(SRC) && /\.card__movements \{ font-size: 13px;/.test(SRC) && /\.preview__ex-moves \{ font-size: 12\.5px;/.test(SRC),
    'all three movement lines have their quiet styles');
}

// ---------- 6. Coach-span: changed BY DESIGN this pass, new hash pinned ----------
{
  const { execFileSync } = require('child_process');
  const spanMd5 = execFileSync('sh', ['-c', "sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5"]).toString().trim();
  ok(spanMd5 === '1081700e58396438a0b408febcfdc56b', 'coach-span md5 matches the new approved baseline (1081700e58396438a0b408febcfdc56b), got ' + spanMd5);
}

console.log(`Complex/circuit honesty (structured movements, never-again rule): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
