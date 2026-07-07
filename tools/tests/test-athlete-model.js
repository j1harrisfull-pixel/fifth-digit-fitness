// Phase 1 (Athlete model) tests: the persistent profile schema + learned-pref
// primitive. Pure functions in the helper span, extracted the same way as every
// other coach test.
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /function clampInt\(/.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={normalizeAthlete,bumpPref,PREF_MIN,PREF_MAX};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const { normalizeAthlete, bumpPref, PREF_MIN, PREF_MAX } = m.exports;
let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- normalizeAthlete: defaults ----------
{
  const a = normalizeAthlete(null);
  ok(a.experience === 'intermediate', 'null -> experience defaults to intermediate');
  ok(Array.isArray(a.injuries) && a.injuries.length === 0, 'null -> injuries defaults to []');
  ok(a.prefs && typeof a.prefs === 'object' && Object.keys(a.prefs).length === 0, 'null -> prefs defaults to {}');
  ok(a.metrics && typeof a.metrics === 'object' && Object.keys(a.metrics).length === 0, 'null -> metrics defaults to {} (reserved for future use)');
  ok(a.history && typeof a.history === 'object' && Object.keys(a.history).length === 0, 'null -> history defaults to {} (reserved for future use)');
}

// ---------- normalizeAthlete: metrics/history are forward-compatible placeholders ----------
{
  const a = normalizeAthlete({ metrics: { est1rm: { 'Back Squat': 120 } }, history: { streak: 4 } });
  ok(a.metrics.est1rm && a.metrics.est1rm['Back Squat'] === 120, 'a valid metrics object is PRESERVED, not wiped (future phases will write here)');
  ok(a.history.streak === 4, 'a valid history object is PRESERVED, not wiped');
  const b = normalizeAthlete({ metrics: 'nope', history: [1, 2, 3] });
  ok(Object.keys(b.metrics).length === 0, 'a non-object metrics value falls back to {}');
  ok(Object.keys(b.history).length === 0, 'an array (non-plain-object) history value falls back to {}');
}

// ---------- normalizeAthlete: all four injury categories are accepted ----------
{
  const a = normalizeAthlete({ injuries: [
    { category: 'pain', target: 'Overhead Press' },
    { category: 'restricted', target: 'Left shoulder' },
    { category: 'medical', target: 'Heavy overhead loading' },
    { category: 'nogo', target: 'Burpees' }
  ] });
  ok(a.injuries.length === 4, 'all four injury categories (pain/restricted/medical/nogo) survive validation');
  ['pain', 'restricted', 'medical', 'nogo'].forEach(cat => {
    ok(a.injuries.some(i => i.category === cat), `category "${cat}" is present`);
  });
}

// ---------- normalizeAthlete: validation ----------
{
  const a = normalizeAthlete({ experience: 'pro', injuries: 'nope', prefs: 5 });
  ok(a.experience === 'intermediate', 'bad experience enum falls back to intermediate');
  ok(Array.isArray(a.injuries) && a.injuries.length === 0, 'non-array injuries becomes []');
  ok(a.prefs && Object.keys(a.prefs).length === 0, 'non-object prefs becomes {}');
}
{
  const a = normalizeAthlete({
    experience: 'advanced',
    injuries: [{ category: 'pain', target: 'Overhead Press' }, { category: 'bogus', target: 'x' }, { target: 'no-cat' }, 'junk'],
    prefs: { 'Back Squat': 2, 'Bench Press': '1', 'Deadlift': 99, 'Row': 'x' }
  });
  ok(a.experience === 'advanced', 'valid experience preserved');
  ok(a.injuries.length === 1 && a.injuries[0].category === 'pain' && a.injuries[0].target === 'Overhead Press', 'only well-formed injuries with a valid category survive');
  ok(a.prefs['Back Squat'] === 2, 'numeric pref preserved');
  ok(a.prefs['Bench Press'] === 1, 'string-numeric pref coerced to number');
  ok(a.prefs['Deadlift'] === PREF_MAX, 'out-of-range pref clamped to PREF_MAX');
  ok(!('Row' in a.prefs), 'non-numeric pref dropped');
}

// ---------- normalizeAthlete: idempotent round-trip ----------
{
  const a = normalizeAthlete({ experience: 'beginner', injuries: [{ category: 'nogo', target: 'Burpee' }], prefs: { 'Chin-Up': -2 } });
  ok(JSON.stringify(normalizeAthlete(a)) === JSON.stringify(a), 'normalizeAthlete is idempotent');
}

// ---------- bumpPref: clamped increment/decrement, keyed by name ----------
{
  const a = normalizeAthlete(null);
  ok(bumpPref(a, 'Bench Press', 1) === 1, 'bumpPref creates a missing key at delta');
  ok(a.prefs['Bench Press'] === 1, 'bumpPref writes into athlete.prefs');
  bumpPref(a, 'Bench Press', 1); bumpPref(a, 'Bench Press', 1);
  ok(a.prefs['Bench Press'] === PREF_MAX, 'bumpPref clamps at PREF_MAX (does not exceed 3)');
  bumpPref(a, 'Bench Press', 1);
  ok(a.prefs['Bench Press'] === PREF_MAX, 'bumpPref stays at PREF_MAX when already capped');
  const low = bumpPref(a, 'Sit-Up', -1);
  ok(low === -1 && a.prefs['Sit-Up'] === -1, 'negative delta on a new key works');
  bumpPref(a, 'Sit-Up', -5);
  ok(a.prefs['Sit-Up'] === PREF_MIN, 'bumpPref clamps at PREF_MIN');
  bumpPref({}, 'X', 1); // must not throw on a prefs-less object
  ok(true, 'bumpPref tolerates a prefs-less object without throwing');
}

// ---------- coerceState invariant: a stored athlete round-trips cleanly ----------
{
  const storedGood = { experience: 'advanced', injuries: [{ category: 'nogo', target: 'Burpee' }], prefs: { 'Row': 1 } };
  const a = normalizeAthlete(storedGood);
  ok(a.experience === 'advanced' && a.injuries.length === 1 && a.prefs['Row'] === 1, 'a valid stored athlete survives normalizeAthlete unchanged');
  const legacy = normalizeAthlete(undefined);
  ok(legacy.experience === 'intermediate' && legacy.injuries.length === 0, 'legacy state (no athlete) defaults cleanly');
}

console.log(pass + ' passed, ' + fail + ' failed');
if (fail) fails.slice(0, 30).forEach(f => console.log('  - ' + f));
process.exit(fail ? 1 : 0);
