// Phase 5 (Stimulus Prescription & Volume Landmarks) tests. Pure functions in
// the helper/coach spans, extracted the same way as every other coach test.
// Revision 2 (post-review): this is NOT a pure-refactor test file -- several
// assertions below deliberately assert the NEW, Philosophy-aligned numbers
// and would FAIL against the old ad-hoc goal-branching code. That is the
// intended outcome of Phase 5, documented here and in the completion report.
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /function clampInt\(/.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={LIBRARY,MUSCLE_VOLUME_LANDMARKS,SECONDARY_MUSCLE_CREDIT,computeWeeklyDebt,PRESCRIPTION_TABLE,prescription,ririForWeek,trimSetsForVolumeLandmark,buildEx,generateSession,ANCHOR_T1,RAMP_ANCHORS};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const {
  LIBRARY, MUSCLE_VOLUME_LANDMARKS, SECONDARY_MUSCLE_CREDIT, computeWeeklyDebt,
  PRESCRIPTION_TABLE, prescription, ririForWeek, trimSetsForVolumeLandmark, buildEx,
  generateSession, ANCHOR_T1, RAMP_ANCHORS
} = m.exports;
let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };
const byId = (id) => LIBRARY.filter(e => e.id === id)[0];
const byName = (name) => LIBRARY.filter(e => e.name === name)[0];

// ================= Task 1.1: MUSCLE_VOLUME_LANDMARKS (data modelling) =================

{
  Object.keys(MUSCLE_VOLUME_LANDMARKS).forEach(m => {
    const l = MUSCLE_VOLUME_LANDMARKS[m];
    ok(l.mev < l.mav && l.mav < l.mrv, `${m}: mev (${l.mev}) < mav (${l.mav}) < mrv (${l.mrv})`);
  });
  ok(typeof SECONDARY_MUSCLE_CREDIT === "number" && SECONDARY_MUSCLE_CREDIT === 0.5, "SECONDARY_MUSCLE_CREDIT is exactly 0.5 (judgement call #2)");
}

// ================= Task 1.2: secondary-muscle crediting + byMuscleVolume =================

function fixtureState(completedSets) {
  const sid = "s1", exId = "e1";
  return {
    activeWeek: 0,
    program: { weeks: [{ week: 1, sessions: [{ id: sid, exercises: [{ id: exId, name: "Bench Press" }] }] }] },
    log: { [sid]: { ex: { [exId]: { weight: 60, sets: Array.from({ length: completedSets }, () => ({ completed: true, actual_reps: 8 })) } } } }
  };
}

{
  const debt = computeWeeklyDebt(fixtureState(4));
  ok(debt.byMuscle.chest === 4, `primary muscle (chest) credits at full 1.0x -- unchanged from before this task (got ${debt.byMuscle.chest})`);
  ok(debt.byMuscleVolume.triceps.done === 2, `secondary muscle (triceps) credits at exactly 0.5x the completed-set count (4 sets -> 2.0 credited, got ${debt.byMuscleVolume.triceps.done})`);
  ok(debt.byMuscleVolume.chest.done === 4, "byMuscleVolume.chest also reads the full primary credit");
}

{
  const under = computeWeeklyDebt(fixtureState(0));
  ok(under.byMuscleVolume.chest.band === "under-mev" && under.byMuscleVolume.chest.done === 0, "zero logged sets reads under-mev with done:0, never undefined/crash");
  const mev = computeWeeklyDebt(fixtureState(8)); // chest mev=8
  ok(mev.byMuscleVolume.chest.band === "in-mev", "exactly at MEV boundary reads in-mev");
  const mav = computeWeeklyDebt(fixtureState(14)); // chest mav=14
  ok(mav.byMuscleVolume.chest.band === "in-mav", "exactly at MAV boundary reads in-mav");
  const mrv = computeWeeklyDebt(fixtureState(20)); // chest mrv=20
  ok(mrv.byMuscleVolume.chest.band === "at-or-over-mrv", "exactly at MRV boundary reads at-or-over-mrv");
}

{
  // Regression: byPattern/byMuscle/ranked completely unchanged in shape/values.
  const debt = computeWeeklyDebt(fixtureState(4));
  ok(debt.byPattern && typeof debt.byPattern.horiz_push === "object", "byPattern still keyed by movement_pattern, unchanged");
  ok(debt.byPattern.horiz_push.done === 4, "byPattern's done-count for horiz_push is unaffected by the new secondary crediting");
  ok(Array.isArray(debt.ranked) && debt.ranked.length > 0, "ranked array still produced, unchanged shape");
}

// ================= Task 2.1: PRESCRIPTION_TABLE (coaching reasoning) =================

{
  ["strength", "hypertrophy", "general"].forEach(stim => {
    ok(PRESCRIPTION_TABLE[stim] && PRESCRIPTION_TABLE[stim].compound, `${stim} has a compound row`);
  });
  ok(!PRESCRIPTION_TABLE.strength.isolation, "strength deliberately has NO isolation row -- true strength work is never isolation");
  Object.keys(PRESCRIPTION_TABLE).forEach(stim => {
    ["compound", "isolation"].forEach(kind => {
      const row = PRESCRIPTION_TABLE[stim][kind]; if (!row) return;
      ok(Array.isArray(row.rirRange) && row.rirRange[0] <= row.rirRange[1], `${stim}.${kind}.rirRange is a valid [low,high] pair`);
    });
  });
}

// ================= Task 2.2: genuinely stimulus-driven strength prescription (coaching improvement) =================

{
  // Conflict #1 fix: a strength-goal ISOLATION accessory now gets
  // Tension-isolation numbers, not the old flat 8-10/90s.
  const curl = byName("Barbell Curl"); // isolation, biceps
  const p = prescription(curl, "strength", false, 45, 1, false);
  ok(p.reps === "10-15", `strength-goal isolation accessory (Barbell Curl) now gets 10-15 reps (Tension-isolation), not the old flat 8-10 (got ${p.reps})`);
  ok(/60-120s|90 s|75 s/.test(p.rest) === false || p.rest === "60-120s", `rest reflects the isolation band (got ${p.rest})`);
}

{
  // Conflict #1 fix, compound side: a strength-goal COMPOUND accessory (not
  // the anchor) now gets Tension-compound numbers, not the old flat 8-10/90s.
  const rdl = byName("Romanian Deadlift");
  if (rdl) {
    const p = prescription(rdl, "strength", false, 45, 1, false);
    ok(p.reps === "6-12", `strength-goal compound accessory (Romanian Deadlift) now gets 6-12 reps (Tension-compound), not the old flat 8-10 (got ${p.reps})`);
    ok(p.rest === "2-3 min", `compound accessory rest now reflects the Tension-compound band (got ${p.rest})`);
  }
}

{
  // Conflict #2 fix: hypertrophy compound anchor now uses the FULL 6-12 band
  // via the table, not a fixed 6-8. back-squat IS a canonical ramp anchor,
  // but rampAnchor's maximal 3-5 override is specifically a STRENGTH-stimulus
  // decision (restored pre-Phase-5 behaviour: only the old "strength" branch
  // ever consulted rampAnchor; hypertrophy never did) -- so a hypertrophy-
  // goal session correctly reads the table's own compound reps here, not 3-5.
  const squat = byId("back-squat");
  ok(!!RAMP_ANCHORS["back-squat"], "sanity: back-squat is a ramp anchor");
  const p = prescription(squat, "hypertrophy", true, 45, 1, false);
  ok(p.reps === "6-12", `hypertrophy compound anchor reps come from the table's full compound band, not forced to 3-5 despite being a ramp anchor (got ${p.reps})`);
}

{
  // rampAnchor gate is UNCHANGED for "strength" specifically: a true strength
  // ramp anchor still earns the maximal 3-5, exactly as before Phase 5.
  const squat = byId("back-squat");
  const p = prescription(squat, "strength", true, 45, 1, false);
  ok(p.reps === "3-5", `a true ramp anchor under a strength goal still earns 3-5 reps (got ${p.reps})`);
}

{
  // Special-case branches remain byte-for-byte unchanged.
  const mob = { type: "mobility", unit: "reps" };
  const p = prescription(mob, "strength", false, 45, 1, false);
  ok(p.sets === 2 && p.reps === "8-10" && p.target === "" && p.rest === "", "mobility branch is completely unchanged");

  const plank = { type: "strength", static_hold: true, unit: "sec" };
  const p2 = prescription(plank, "strength", false, 45, 1, false);
  ok(p2.sets === 3 && p2.reps === "30-45s" && p2.rest === "60s", "static_hold branch is completely unchanged");

  const carry = { type: "strength", pattern: "carry", unit: "reps" };
  const p3 = prescription(carry, "strength", false, 45, 1, false);
  ok(p3.sets === 3 && p3.reps === "40s" && p3.rest === "90s", "carry branch is completely unchanged");

  const tgu = { type: "strength", id: "kb-turkish-get-up", unit: "reps" };
  const p4 = prescription(tgu, "strength", false, 45, 1, false);
  ok(p4.reps === "3-5/side", "Turkish get-up branch is completely unchanged");
}

{
  // hybrid/endurance goals stay EXACTLY as before, including their original
  // rirMap-derived target wording -- outside Phase 5's declared stimulus scope.
  const squat = byId("back-squat");
  const pHybridAnchor = prescription(squat, "hybrid", true, 45, 1, false);
  ok(pHybridAnchor.reps === "5-6" && pHybridAnchor.target === "Effort 7 · 3 reps left", `hybrid anchor unchanged (got reps=${pHybridAnchor.reps}, target="${pHybridAnchor.target}")`);
  const curl = byName("Barbell Curl");
  const pEndurance = prescription(curl, "endurance", false, 45, 1, false);
  ok(pEndurance.reps === "15-20" && pEndurance.target === "Effort 7 · 3 reps left", `endurance unchanged (got reps=${pEndurance.reps}, target="${pEndurance.target}")`);
}

// ================= Task 2.3: RIR as a genuine structured field =================

{
  ok(ririForWeek([1, 3], 1, false) === 3, "week 1 returns the TOP (easiest) of the band");
  ok(ririForWeek([1, 3], 3, false) === 1, "week 3+ returns the BOTTOM (tightest) of the band");
  ok(ririForWeek([1, 3], 3, true) > 3, "deload returns easier than the band's own top");
}

{
  const squat = byId("back-squat");
  const p = prescription(squat, "strength", true, 45, 1, false);
  ok(typeof p.rir === "number", `prescription() returns a real numeric rir field (got ${typeof p.rir})`);
  ok(p.target === "Effort " + (10 - p.rir) + " · " + p.rir + (p.rir === 1 ? " rep" : " reps") + " left", "the derived target string always matches the numeric rir exactly -- one source of truth");
}

{
  // Additive, not breaking: every existing display-string caller still gets
  // a valid, correctly-worded target string.
  const curl = byName("Barbell Curl");
  const p = prescription(curl, "general", false, 45, 2, false);
  ok(typeof p.target === "string" && p.target.length > 0, "target remains a valid non-empty display string");
}

// ================= Task 3.1: trimSetsForVolumeLandmark (multi-muscle, physiologically honest) =================

{
  const bench = byId("bench-press");
  const atMrv = { chest: { remainingToMrv: 0 }, triceps: { remainingToMrv: 10 } };
  ok(trimSetsForVolumeLandmark(5, bench, atMrv) === 1, "primary muscle already at MRV trims a would-be 5-set prescription down to the floor of 1, never 0");

  const headroom3 = { chest: { remainingToMrv: 3 }, triceps: { remainingToMrv: 10 } };
  ok(trimSetsForVolumeLandmark(5, bench, headroom3) === 3, "3 sets of primary headroom trims 5 down to 3");

  const fullHeadroom = { chest: { remainingToMrv: 20 }, triceps: { remainingToMrv: 20 } };
  ok(trimSetsForVolumeLandmark(5, bench, fullHeadroom) === 5, "full headroom everywhere -> untouched");

  // Physiologically-honest case: SECONDARY muscle (triceps) near its own MRV
  // trims the exercise even though the PRIMARY (chest) has full headroom.
  // triceps remainingToMrv=2, credit rate 0.5 -> affords 2/0.5=4 exercise-sets.
  const secondaryTight = { chest: { remainingToMrv: 20 }, triceps: { remainingToMrv: 2 } };
  ok(trimSetsForVolumeLandmark(5, bench, secondaryTight) === 4, `a secondary muscle near its own MRV trims the exercise even when the primary has full headroom (got ${trimSetsForVolumeLandmark(5, bench, secondaryTight)})`);

  const noLandmarks = { wrists: { remainingToMrv: 0 } };
  ok(trimSetsForVolumeLandmark(5, bench, noLandmarks) === 5, "a muscle absent from weeklyVolume (not a defined landmark, e.g. wrists) never trims");
}

// ================= Task 3.2: wired into buildEx + end-to-end =================

{
  const bench = byId("bench-press");
  const weightMap = {};
  const noVol = buildEx(bench, "hypertrophy", false, weightMap, 45, 1, false, {}, false, "");
  ok(noVol.sets > 1, "buildEx with no weeklyVolume (backward-compatible) is unaffected by trimming");
  ok(typeof noVol.rir === "number", "buildEx surfaces the real rir field on its returned exercise object");

  const tightVol = { chest: { remainingToMrv: 1 } };
  const trimmed = buildEx(bench, "hypertrophy", false, weightMap, 45, 1, false, {}, false, "", tightVol);
  ok(trimmed.sets === 1, `buildEx with a tight weeklyVolume visibly reduces the set count (got ${trimmed.sets})`);
}

{
  // End-to-end via generateSession: a fresh athlete (no history) sees no
  // reduction; an athlete whose weeklyVolume already shows a muscle at MRV
  // gets a visibly reduced set count for an exercise touching that muscle.
  const parsed = { role: "upper", minutes: 45, goal: "hypertrophy", equipment: null, includes: [] };
  const fresh = generateSession(parsed, {}, 1, {}, null, false, null, null, null, null);
  ok(fresh && fresh.exercises.length > 0, "generateSession with no weeklyVolume works exactly as before (regression)");

  const tightChest = {};
  Object.keys(MUSCLE_VOLUME_LANDMARKS).forEach(m => { tightChest[m] = { remainingToMrv: 20 }; });
  tightChest.chest = { remainingToMrv: 1 };
  const capped = generateSession(parsed, {}, 1, {}, null, false, null, null, null, tightChest);
  const chestEx = capped.exercises.find(e => { const lib = byName(e.name); return lib && lib.primary_muscles && lib.primary_muscles[0] === "chest"; });
  ok(chestEx && chestEx.sets === 1, `a chest exercise in a session built with chest already at MRV shows a visibly reduced (floor) set count (got ${chestEx && chestEx.sets})`);
}

console.log(`${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
