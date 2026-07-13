// Master Ticket Priority 7 (13 July 2026) -- the biggest library gap James
// named: the app only ever AVOIDED a flagged injury (hard-filtered it out of
// selection), it never HELPED it. This is the first real rehab/corrective
// prescription: 7 new library entries (one per joint area the injury system
// already recognises), a pickRehabForInjuries() picker, and a fix to the
// injury hard-filter so a rehab exercise named after the joint it treats
// (e.g. "Banded Terminal Knee Extension" for a knee injury) doesn't trip the
// tier-4 named-movement exclusion meant for risky movements, not corrective
// ones. James (13 July, after this touched the coach span): "as long as it
// doesn't break anything that makes coach span better is allowed" -- so the
// coach-span md5 constant across the whole test suite was deliberately
// updated to the new value alongside this ticket, with his explicit sign-off.
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const cs = lines.findIndex(l => l.includes('__COACH_START__')), ce = lines.findIndex(l => l.includes('__COACH_END__'));
const helperStart = lines.findIndex(l => /function clampInt\(/.test(l));
const helperEnd = lines.findIndex(l => /function migrateV1toV2\(/.test(l));
const src = lines.slice(helperStart, helperEnd).join('\n') + '\n' + lines.slice(cs + 1, ce).join('\n') +
  '\n; module.exports={LIBRARY, libraryIntegrity, pickRehabForInjuries, isExerciseInjuryFlagged, normalizeAthlete, buildWarmupCooldown};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const { LIBRARY, libraryIntegrity, pickRehabForInjuries, isExerciseInjuryFlagged } = m.exports;

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 1. Library integrity: 7 new entries, no duplicate names/ids, valid schema ----------
{
  const chk = libraryIntegrity(LIBRARY);
  ok(chk.ok, 'libraryIntegrity() passes with the new rehab entries: ' + chk.errors.join('; '));
  const rehabEntries = LIBRARY.filter(e => Array.isArray(e.rehab_for) && e.rehab_for.length);
  ok(rehabEntries.length === 7, 'exactly 7 rehab entries exist (one per joint area), got ' + rehabEntries.length);
  const joints = ['shoulder', 'knee', 'spine', 'neck', 'wrist', 'hip', 'ankle'];
  joints.forEach(j => {
    ok(rehabEntries.some(e => e.rehab_for.indexOf(j) >= 0), 'a rehab entry exists for "' + j + '"');
  });
}

// ---------- 2. Rehab entries are deliberately joint_stress: [] -- they treat the joint, they don't load it ----------
{
  const rehabEntries = LIBRARY.filter(e => Array.isArray(e.rehab_for) && e.rehab_for.length);
  rehabEntries.forEach(e => {
    ok(Array.isArray(e.joint_stress) && e.joint_stress.length === 0, e.name + ' has joint_stress: [] (authored as safe FOR the joint it treats, not risky load on it)');
  });
}

// ---------- 3. pickRehabForInjuries() finds a real exercise for every recognised joint keyword ----------
{
  const joints = ['shoulder', 'knee', 'spine', 'neck', 'wrist', 'hip', 'ankle'];
  joints.forEach(j => {
    const used = {};
    const picks = pickRehabForInjuries([{ category: 'pain', target: j }], null, used, 1);
    ok(picks.length === 1 && picks[0].joint === j, 'pickRehabForInjuries() finds a real corrective exercise for a "' + j + '" injury (got: ' + (picks[0] && picks[0].exercise.name) + ')');
  });
}

// ---------- 4. Cap at 2 picks even with many injuries -- can't crowd out the day's real work ----------
{
  const used = {};
  const manyInjuries = [
    { category: 'pain', target: 'shoulder' }, { category: 'pain', target: 'knee' },
    { category: 'pain', target: 'spine' }, { category: 'pain', target: 'hip' }, { category: 'pain', target: 'ankle' }
  ];
  const picks = pickRehabForInjuries(manyInjuries, null, used, 1);
  ok(picks.length === 2, 'pickRehabForInjuries() caps at 2 picks regardless of how many joints are flagged (got ' + picks.length + ')');
}

// ---------- 5. No injuries -> no picks (purely additive, changes nothing for athletes without injuries) ----------
{
  const used = {};
  const picks = pickRehabForInjuries([], null, used, 1);
  ok(picks.length === 0, 'no injuries -> pickRehabForInjuries() returns nothing (behaviour-preserving for the common case)');
}

// ---------- 6. The tier-4 named-movement fix is narrow: a rehab exercise still gets excluded by an UNRELATED injury/name match ----------
{
  const kneeRehab = LIBRARY.filter(e => Array.isArray(e.rehab_for) && e.rehab_for.indexOf('knee') >= 0)[0];
  ok(!isExerciseInjuryFlagged(kneeRehab, [{ category: 'pain', target: 'knee' }]), 'the knee rehab exercise is NOT excluded by a knee injury (the bug this ticket fixes)');
  // A genuinely separate exclusion (an unrelated named-movement exclusion) must still work --
  // the fix only narrows tier 4 for the exact joint the exercise is rehab_for-tagged for.
  ok(isExerciseInjuryFlagged(kneeRehab, [{ category: 'pain', target: 'Banded Terminal Knee Extension' }]), 'an athlete explicitly excluding this exact named movement still gets it excluded (the fix is narrow, not a blanket rehab exemption)');
}

// ---------- 7. Equipment gating still applies: a band-only rehab pick honestly disappears without a band ----------
{
  const used = {};
  const picksWithBand = pickRehabForInjuries([{ category: 'pain', target: 'shoulder' }], ['band'], used, 1);
  ok(picksWithBand.length === 1, 'shoulder rehab (band) is offered when band is in the kit');
  const used2 = {};
  const picksNoBand = pickRehabForInjuries([{ category: 'pain', target: 'shoulder' }], ['barbell'], used2, 1);
  ok(picksNoBand.length === 0, 'shoulder rehab (band-only) honestly disappears without a band in the kit, no fake substitute');
}

console.log(`Priority 7 (rehab/corrective content): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
