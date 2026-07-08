// Pass 1 (Programming Trust), Fix 3: Just Today anti-repeat memory.
// todaySeedCounter only ever varied tie-break jitter -- it never remembered
// what was actually generated, so a small equipment pool or a narrow request
// could legitimately produce the same top pick build after build. This adds
// a soft recentIds ranking penalty (never a hard filter) fed only from the
// Just Today build path (generateSession), never from generateProgram's
// week/4-week builds.
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /var STORE = /.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={LIBRARY,generateSession,recentTodayIdMap};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const { LIBRARY, generateSession, recentTodayIdMap } = m.exports;

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

const athlete = { experience: "intermediate", injuries: [] };
const FULL_GYM = ["barbell", "dumbbells", "kettlebells", "cable", "machines", "bands", "pullupbar", "cardio"];
function contentIds(ses) {
  const byName = {}; LIBRARY.forEach(l => byName[l.name.toLowerCase()] = l);
  return ses.exercises
    .filter(e => e.type === "strength" || e.type === "conditioning")
    .map(e => { const l = byName[e.name.toLowerCase()]; return l ? l.id : null; })
    .filter(Boolean);
}

// recentTodayIdMap: flattens state.recentTodayIds (array of arrays, most
// recent first) into a lookup map; must coerce safely on anything malformed.
{
  ok(JSON.stringify(recentTodayIdMap({ recentTodayIds: [["a", "b"], ["c"]] })) === JSON.stringify({ a: 1, b: 1, c: 1 }), "recentTodayIdMap flattens multiple recent builds into one lookup map");
  ok(JSON.stringify(recentTodayIdMap({ recentTodayIds: [] })) === "{}", "recentTodayIdMap on an empty list returns an empty map");
  ok(JSON.stringify(recentTodayIdMap({})) === "{}", "recentTodayIdMap on a state object with no recentTodayIds field at all coerces safely");
  ok(JSON.stringify(recentTodayIdMap(null)) === "{}", "recentTodayIdMap on null state coerces safely");
  ok(JSON.stringify(recentTodayIdMap({ recentTodayIds: "not-an-array" })) === "{}", "recentTodayIdMap on a corrupt (non-array) field coerces safely");
}

// The penalty must be a soft nudge: an exercise present in recentIds should
// score worse (higher, since lower is better in this ranker) than the exact
// same exercise scored with no recentIds at all -- proving the term fires --
// while every request still produces a complete, non-empty session (never a
// hard ban), including on a tiny equipment pool.
{
  const parsed = { goal: "hybrid", minutes: 45, equipment: FULL_GYM, includes: ["conditioning"] };
  const sesA = generateSession(parsed, {}, 1, {}, null, false, null, athlete, null, null, null, null);
  const idsA = contentIds(sesA);
  ok(idsA.length > 0, "a normal Just Today build (no recent memory) produces real strength/conditioning content");

  const recentMap = {}; idsA.forEach(id => { recentMap[id] = 1; });
  const sesB = generateSession(parsed, {}, 1, {}, null, false, null, athlete, null, null, null, recentMap);
  const idsB = contentIds(sesB);
  ok(idsB.length > 0, "a Just Today build WITH every id from the previous build penalised still produces a complete, non-empty session");

  const overlap = idsB.filter(id => recentMap[id]).length;
  ok(overlap < idsA.length, `penalising the previous build's ids reduces overlap with it (idsA=${idsA.length}, overlap=${overlap})`);
}

// Tiny equipment pool: the penalty must never starve a slot -- guaranteeSession's
// floor still guarantees a real, non-empty session even when every eligible
// candidate is in the recent-ids list.
{
  const TINY = ["bands"];
  const parsed = { goal: "hybrid", minutes: 30, equipment: TINY, includes: [] };
  const ses1 = generateSession(parsed, {}, 1, {}, null, false, null, athlete, null, null, null, null);
  const ids1 = contentIds(ses1);
  const allPenalised = {}; ids1.forEach(id => { allPenalised[id] = 1; });
  // Also penalise the full bands-eligible pool, not just what was picked, to
  // simulate "everything available has been seen recently".
  LIBRARY.filter(l => l.type === "strength" && (l.equipment === "bands" || l.equipment === "bodyweight")).forEach(l => { allPenalised[l.id] = 1; });
  const ses2 = generateSession(parsed, {}, 2, {}, null, false, null, athlete, null, null, null, allPenalised);
  ok(ses2.exercises.length > 0, "tiny equipment pool with every eligible candidate penalised still returns a non-empty session (soft penalty never hard-blocks)");
}

// Scope: generateProgram (week/4-week builds) never receives recentIds at
// all -- this mechanism is Just Today-exclusive by construction (there is no
// recentIds parameter threaded into generateProgram or its blueprint call).
{
  const src2 = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');
  const genProgSection = src2.slice(src2.indexOf('function generateProgram('), src2.indexOf('function generateProgram(') + 4000);
  ok(!/recentIds/.test(genProgSection), "generateProgram's own body makes no reference to recentIds -- the memory never reaches week/4-week builds");
}

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log("  FAIL:", f)); process.exit(1); }
