// Phase 3 (Anchor & Progression) tests: frozen anchor identity, the increment
// calculation, and the progression/deload decision hierarchy. Pure functions in
// the helper span, extracted the same way as every other coach test.
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /function clampInt\(/.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={normalizeAthlete,getAnchorState,freezeAnchor,recordAnchorExposure,ANCHOR_PATTERNS,anchorIncrementKg,anchorProgressionDecision,resolveTodaysAnchor,ANCHOR_STALL_LIMIT,ANCHOR_EXPOSURE_BACKSTOP,generateSession,generateProgram,LIBRARY};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const { normalizeAthlete, getAnchorState, freezeAnchor, recordAnchorExposure, anchorIncrementKg, anchorProgressionDecision, resolveTodaysAnchor, generateSession, LIBRARY } = m.exports;
let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ================= Section 1: frozen anchor identity + progression state =================

{
  const a = normalizeAthlete({});
  ok(getAnchorState(a, "squat") === null, "no frozen anchor yet -> null");
}

{
  const a = normalizeAthlete({});
  freezeAnchor(a, "squat", "back-squat", 60);
  const s = getAnchorState(a, "squat");
  ok(s.exerciseId === "back-squat" && s.weight === 60 && s.exposureCount === 0 && s.consecutiveStalls === 0, "freezeAnchor sets identity + weight + zeroed counters");
}

{
  const a = normalizeAthlete({});
  freezeAnchor(a, "squat", "back-squat", 60);
  freezeAnchor(a, "squat", "front-squat", 40); // should NOT overwrite
  ok(getAnchorState(a, "squat").exerciseId === "back-squat", "freezeAnchor never overwrites an existing frozen anchor -- frozen anchor is created once per pattern");
}

{
  const a = normalizeAthlete({});
  freezeAnchor(a, "squat", "back-squat", 60);
  recordAnchorExposure(a, "squat", { hitTop: true, newWeight: 62.5, action: "increase" });
  const s = getAnchorState(a, "squat");
  ok(s.weight === 62.5 && s.exposureCount === 1 && s.consecutiveStalls === 0 && s.lastResult === "increase", "a hit-top exposure bumps weight, increments exposureCount, resets stall streak");
  ok(getAnchorState(a, "hinge") === null, "recording a squat exposure does not create a hinge anchor state");
}

{
  const a = normalizeAthlete({});
  freezeAnchor(a, "hinge", "deadlift", 100);
  recordAnchorExposure(a, "hinge", { hitTop: false, newWeight: 100, action: "hold" });
  recordAnchorExposure(a, "hinge", { hitTop: false, newWeight: 100, action: "hold" });
  ok(getAnchorState(a, "hinge").consecutiveStalls === 2, "two consecutive non-hit exposures -> consecutiveStalls 2");
  recordAnchorExposure(a, "hinge", { hitTop: true, newWeight: 105, action: "increase" });
  ok(getAnchorState(a, "hinge").consecutiveStalls === 0, "a hit-top exposure resets the stall streak");
}

{
  const a = normalizeAthlete({});
  freezeAnchor(a, "vpush", "overhead-press", 30);
  for (let i = 0; i < 3; i++) recordAnchorExposure(a, "vpush", { hitTop: true, newWeight: 30 + i, action: "increase" });
  recordAnchorExposure(a, "vpush", { hitTop: false, newWeight: 32, action: "deload" });
  ok(getAnchorState(a, "vpush").exposureCount === 0, "a deload exposure resets exposureCount to 0");
}

// ================= Section 2: increment calculation (3-tier) =================

{
  ok(anchorIncrementKg({ compound: true, pattern: "squat" }) === 5, "lower-body compound anchor -> +5kg");
  ok(anchorIncrementKg({ compound: true, pattern: "hinge" }) === 5, "hinge compound anchor -> +5kg");
  ok(anchorIncrementKg({ compound: true, pattern: "vpush" }) === 2.5, "upper-body compound anchor -> +2.5kg");
  ok(anchorIncrementKg({ compound: true, pattern: "hpull" }) === 2.5, "upper-body pull anchor -> +2.5kg");
  ok(anchorIncrementKg({ compound: false, pattern: "vpush" }) === 1.25, "isolation/smaller lift -> smallest increment (+1.25kg)");
  ok(anchorIncrementKg({ compound: true, pattern: "squat", load_increment_kg: 1 }) === 1, "real per-exercise metadata (Tier 1), when present, wins over the compound default");
}

// ================= Section 3: progression/deload decision hierarchy =================

{
  const base = { exposureCount: 2, consecutiveStalls: 1 };
  ok(anchorProgressionDecision(base, "red", true).action === "deload", "red fatigue overrides even a hit-top exposure");
  ok(anchorProgressionDecision({ exposureCount: 1, consecutiveStalls: 3 }, "green", true).action === "deload", "3 consecutive stalls trigger deload even when fatigue is green and this exposure hit top");
  ok(anchorProgressionDecision({ exposureCount: 6, consecutiveStalls: 0 }, "green", true).action === "deload", "6th exposure backstop fires even with green fatigue and a hit-top result");
  ok(anchorProgressionDecision({ exposureCount: 2, consecutiveStalls: 0 }, "green", true).action === "increase", "green fatigue, no stall streak, under the backstop, hit top -> increase");
  ok(anchorProgressionDecision({ exposureCount: 2, consecutiveStalls: 0 }, "amber", false).action === "hold", "amber fatigue alone does not force a deload; a miss without a stall streak just holds");
}

// ================= Section 4: resolveTodaysAnchor -- concepts 1/2/3 stay separate =================

{
  const a = normalizeAthlete({});
  const r1 = resolveTodaysAnchor(a, "squat", () => true);
  ok(r1.exerciseId === null && r1.source === "unset", "no frozen anchor yet -> source 'unset', caller must run its own ranker and freeze the result");
}

{
  const a = normalizeAthlete({});
  freezeAnchor(a, "squat", "back-squat", 60);
  const r = resolveTodaysAnchor(a, "squat", (id) => id === "back-squat");
  ok(r.exerciseId === "back-squat" && r.source === "frozen", "an available frozen anchor is returned with source 'frozen'");
  const r2 = resolveTodaysAnchor(a, "squat", (id) => id === "back-squat");
  ok(r2.exerciseId === r.exerciseId && r2.source === "frozen", "future sessions reuse the same frozen anchor -- calling again returns the identical exerciseId");
}

{
  const a = normalizeAthlete({});
  freezeAnchor(a, "squat", "back-squat", 60);
  const r = resolveTodaysAnchor(a, "squat", (id) => false); // e.g. barbell unavailable today
  ok(r.source === "needs-substitute" && r.exerciseId === null, "an unavailable/injured frozen anchor is not forced into the session -- resolveTodaysAnchor reports 'needs-substitute' instead of forcing the id through");
}

{
  const a = normalizeAthlete({});
  freezeAnchor(a, "squat", "back-squat", 60);
  const before = JSON.stringify(getAnchorState(a, "squat"));
  // Simulate a substitute session: resolve reports needs-substitute, caller picks
  // "goblet-squat" via its own ranker for THIS session only, and must NOT call
  // freezeAnchor or recordAnchorExposure for the substitute.
  const r = resolveTodaysAnchor(a, "squat", (id) => false);
  ok(r.source === "needs-substitute", "temporary substitute path is reached for one session");
  const after = JSON.stringify(getAnchorState(a, "squat"));
  ok(before === after, "a temporary substitute session never overwrites the frozen anchor -- state is byte-for-byte unchanged");
}

{
  // Progression history stays attached to the frozen anchor, never a substitute.
  const a = normalizeAthlete({});
  freezeAnchor(a, "squat", "back-squat", 60);
  recordAnchorExposure(a, "squat", { hitTop: true, newWeight: 65, action: "increase" });
  // A substitute session happens (goblet-squat stands in); by construction there
  // is no frozen state for "goblet-squat" to record against, and the plan forbids
  // ever calling recordAnchorExposure keyed by a substitute's id.
  ok(getAnchorState(a, "squat").weight === 65, "the frozen anchor (back-squat) carries the real progression history");
  ok(getAnchorState(a, "squat").exerciseId === "back-squat", "the frozen identity itself never changes because a substitute was used elsewhere");
}

{
  // Explicit "no silent reassignment" check: freezeAnchor is freeze-once no
  // matter how many times or in what sequence it's called, and there is no
  // reassignAnchor-shaped function exported at all.
  const a = normalizeAthlete({});
  freezeAnchor(a, "squat", "back-squat", 60);
  freezeAnchor(a, "squat", "front-squat", 40);
  freezeAnchor(a, "squat", "hack-squat", 80);
  ok(getAnchorState(a, "squat").exerciseId === "back-squat", "repeated freeze attempts across a session's lifetime never silently reassign the frozen anchor");
  ok(m.exports.reassignAnchor === undefined, "no reassignAnchor function exists in this phase -- permanent anchor change is an explicit future feature, not built here");
}

// ================= Section 5: end-to-end wiring through generateSession =================
// role "lower" -> slot 0 is {patterns:["squat"], compound:true}, the app's own
// existing single-anchor-pattern shape, so the frozen-anchor mechanism engages.
function findByName(name) { return LIBRARY.filter(function (e) { return e.name === name; })[0]; }
function squatExOf(session) {
  return session.exercises.filter(function (e) {
    var lib = findByName(e.name);
    return lib && lib.pattern === "squat" && lib.compound;
  })[0];
}

{
  const athlete = normalizeAthlete({});
  const parsed = { role: "lower", minutes: 45, goal: "strength", equipment: null, includes: [] };
  const s1 = generateSession(parsed, {}, 1, {}, null, false, null, athlete);
  const frozen1 = getAnchorState(athlete, "squat");
  ok(frozen1 !== null, "a first-ever squat/lower session freezes a squat anchor");
  const sq1 = squatExOf(s1);
  ok(sq1 && findByName(sq1.name).id === frozen1.exerciseId, "the exercise actually placed in the anchor slot matches what got frozen");

  // A second session, DIFFERENT seed (would otherwise reroll the ranker's pick),
  // same athlete -> future sessions reuse the same frozen anchor.
  const s2 = generateSession(parsed, {}, 999, {}, null, false, null, athlete);
  const sq2 = squatExOf(s2);
  ok(sq2 && sq2.name === sq1.name, "future sessions reuse the same frozen anchor even with a different seed, not a re-rolled pick");
  const frozen2 = getAnchorState(athlete, "squat");
  ok(frozen2.exerciseId === frozen1.exerciseId, "the frozen identity itself is unchanged across sessions");
}

{
  // Temporary substitute: freeze on a full gym (barbell squat), then build a
  // bodyweight-only session -- the frozen barbell lift can't be equipOk, so a
  // substitute must be used for this ONE session without touching frozen state.
  const athlete = normalizeAthlete({});
  const fullGym = { role: "lower", minutes: 45, goal: "strength", equipment: null, includes: [] };
  generateSession(fullGym, {}, 1, {}, null, false, null, athlete);
  const frozen = getAnchorState(athlete, "squat");
  ok(frozen !== null, "a squat anchor was frozen on the full-gym session");
  const frozenLib = LIBRARY.filter(function (e) { return e.id === frozen.exerciseId; })[0];
  ok(frozenLib.equipment !== "bodyweight", "the frozen squat anchor genuinely requires non-bodyweight equipment (test premise)");

  const before = JSON.stringify(getAnchorState(athlete, "squat"));
  const bwOnly = { role: "lower", minutes: 45, goal: "strength", equipment: ["bodyweight"], includes: [] };
  const s2 = generateSession(bwOnly, {}, 2, {}, null, false, null, athlete);
  const sq2 = squatExOf(s2);
  ok(sq2 && sq2.name !== frozenLib.name, "the unavailable frozen anchor is not forced into a bodyweight-only session -- a real substitute is used instead");
  const after = JSON.stringify(getAnchorState(athlete, "squat"));
  ok(before === after, "the substitute session never overwrites the frozen anchor -- state is byte-for-byte unchanged");
}

{
  // Progression history stays attached to the frozen anchor's id, never a
  // substitute's -- exercised through the real end-to-end path.
  const athlete = normalizeAthlete({});
  const fullGym = { role: "lower", minutes: 45, goal: "strength", equipment: null, includes: [] };
  generateSession(fullGym, {}, 1, {}, null, false, null, athlete);
  const pattern = "squat";
  const frozenIdBefore = getAnchorState(athlete, pattern).exerciseId;
  recordAnchorExposure(athlete, pattern, { hitTop: true, newWeight: 70, action: "increase" });
  ok(getAnchorState(athlete, pattern).exerciseId === frozenIdBefore, "recording an exposure never changes which exercise is frozen");
  ok(getAnchorState(athlete, pattern).weight === 70, "progression history (weight) lives on the frozen anchor record");
}

{
  // Backward compatibility: no athlete passed at all -> identical to
  // pre-Phase-3 behaviour, no freezing, no crash.
  const parsed = { role: "lower", minutes: 45, goal: "strength", equipment: null, includes: [] };
  const s = generateSession(parsed, {}, 1, {}, null, false, null, null);
  ok(s && Array.isArray(s.exercises) && s.exercises.length > 0, "generateSession works with athlete=null/absent exactly as before");
}

console.log(`${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
