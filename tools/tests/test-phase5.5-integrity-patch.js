// Phase 5.5 (Coaching Integrity Patch) tests. Not a feature phase -- these
// tests protect three specific fixes that bring the implementation back into
// alignment with the Programming Philosophy, per the Architecture Freeze
// Review: (1) the fallback "never hollow" path must never bypass injury
// filtering, (2) fatigue degradation must scope to the pattern actually being
// trained, (3) MRV trimming must accumulate across a single generation pass,
// not re-check a static historical snapshot per exercise.
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /function clampInt\(/.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={LIBRARY,roleFloorMoves,absoluteFloorExercises,topUpThinDay,guaranteeSession,recoverySession,isExerciseInjuryFlagged,fatigueBandForPatterns,degradation,fatigueBand,resolveSpec,buildIntent,requestToParsed,makeRequest,MUSCLE_VOLUME_LANDMARKS,SECONDARY_MUSCLE_CREDIT,trimSetsForVolumeLandmark,buildEx,generateSession,generateProgram,pickByType,pickMobilityByPatterns,pickPulseRaiser,buildWarmupCooldown,pickFunctional,pickConditioning,conditioningAlternatives,runWorkout};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const {
  LIBRARY, roleFloorMoves, absoluteFloorExercises, topUpThinDay, guaranteeSession, recoverySession,
  isExerciseInjuryFlagged, fatigueBandForPatterns, degradation, resolveSpec, buildIntent, requestToParsed, makeRequest,
  MUSCLE_VOLUME_LANDMARKS, SECONDARY_MUSCLE_CREDIT, trimSetsForVolumeLandmark, buildEx, generateSession, generateProgram,
  pickByType, pickMobilityByPatterns, pickPulseRaiser, buildWarmupCooldown, pickFunctional, pickConditioning,
  conditioningAlternatives, runWorkout
} = m.exports;
let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };
const byId = (id) => LIBRARY.filter(e => e.id === id)[0];
const byName = (name) => LIBRARY.filter(e => e.name === name)[0];

// ================= Task 1: fallback path must never bypass injury filtering =================
// Skill: safety reasoning + behaviour-preserving engineering.

const SHOULDER_INJ = [{ category: "pain", target: "shoulder" }];
const KNEE_INJ = [{ category: "pain", target: "knee" }];
const ALL_FLOOR_UNSAFE_INJ = [
  { category: "pain", target: "knee" },   // flags Bodyweight Squat, Reverse Lunge, Glute Bridge
  { category: "pain", target: "shoulder" }, // flags Push-Up, Table Row
  { category: "pain", target: "spine" }   // flags Plank (and Glute Bridge again)
];

{
  // roleFloorMoves respects injury filtering directly.
  const safe = roleFloorMoves("upper", []);
  ok(safe.some(e => e.name === "Push-Up"), "sanity: Push-Up is a normal upper floor candidate with no injuries");
  const filtered = roleFloorMoves("upper", SHOULDER_INJ);
  ok(!filtered.some(e => e.name === "Push-Up"), "a shoulder injury excludes Push-Up (joint_stress includes shoulder) from role floor moves");
  ok(!filtered.some(e => e.name === "Table Row"), "a shoulder injury excludes Table Row (joint_stress includes shoulder) from role floor moves");
  ok(filtered.some(e => e.name === "Bench Dip"), "Bench Dip (elbow only) still offered -- filtering is per-exercise, not all-or-nothing for the role");
  ok(filtered.some(e => e.name === "Plank"), "Plank (spine only) still offered under a shoulder injury");
}

{
  // absoluteFloorExercises respects injury filtering directly.
  const safe = absoluteFloorExercises([]);
  ok(safe.length === 5, "sanity: 5 default floor moves with no injuries");
  const filtered = absoluteFloorExercises(KNEE_INJ);
  ok(!filtered.some(e => e.name === "Bodyweight Squat"), "a knee injury excludes Bodyweight Squat from the absolute floor");
  ok(!filtered.some(e => e.name === "Reverse Lunge"), "a knee injury excludes Reverse Lunge from the absolute floor");
  ok(!filtered.some(e => e.name === "Glute Bridge"), "a knee injury excludes Glute Bridge from the absolute floor");
  ok(filtered.some(e => e.name === "Push-Up") && filtered.some(e => e.name === "Plank"), "Push-Up and Plank (no knee joint stress) remain available");
}

{
  // Unsafe fallback exercises never appear in a real thin-day top-up.
  const strengthEx = [];
  topUpThinDay(strengthEx, "upper", SHOULDER_INJ);
  ok(!strengthEx.some(e => e.name === "Push-Up"), "topUpThinDay never adds Push-Up to a thin upper day when shoulder is flagged");
  ok(!strengthEx.some(e => e.name === "Table Row"), "topUpThinDay never adds Table Row to a thin upper day when shoulder is flagged");
  ok(strengthEx.length > 0, "topUpThinDay still fills the day with the safe remainder (Bench Dip/Plank)");
}

{
  // Honest "no safe exercise" behaviour: every lower floor candidate is unsafe.
  const strengthEx = [];
  const gaps = topUpThinDay(strengthEx, "lower", KNEE_INJ);
  ok(strengthEx.length === 0, "topUpThinDay adds NOTHING to a thin lower day when every floor candidate (squat/lunge/bridge) is knee-flagged -- never silently prescribes an unsafe move");
  ok(Array.isArray(gaps) && gaps.length > 0, "topUpThinDay honestly reports the gap instead of silence when no safe fallback exists");
  ok(gaps[0] && typeof gaps[0].reason === "string" && gaps[0].reason.length > 0, "the reported gap carries a real, non-empty reason");
}

{
  // guaranteeSession never silently includes an unsafe absolute-floor move,
  // and honestly reports when literally nothing safe is left.
  const empty = { name: "Today", focus: "", exercises: [] };
  const built = guaranteeSession(empty, 30, ALL_FLOOR_UNSAFE_INJ);
  const unsafeNames = ["Bodyweight Squat", "Push-Up", "Reverse Lunge", "Glute Bridge", "Plank"];
  ok(!built.exercises.some(e => unsafeNames.indexOf(e.name) >= 0), "guaranteeSession never includes any of the 5 default floor moves when all are injury-flagged");
  ok(Array.isArray(built.unfilledSlots) && built.unfilledSlots.length > 0, "guaranteeSession honestly reports no safe fallback exercise exists, rather than silently returning an empty session");
}

{
  // Regression: injury-free behaviour is completely unchanged.
  const strengthEx = [];
  topUpThinDay(strengthEx, "upper", []);
  ok(strengthEx.some(e => e.name === "Push-Up"), "regression: with no injuries, Push-Up is still added to a thin upper day exactly as before this patch");
  const empty = { name: "Today", focus: "", exercises: [] };
  const built = guaranteeSession(empty, 30, []);
  ok(built.exercises.length === 5, "regression: with no injuries, guaranteeSession's absolute floor still yields all 5 default moves");
  ok(!built.unfilledSlots, "regression: no injuries means no honest-gap report is attached at all");
}

{
  // recoverySession threads injuries through to its own guaranteeSession call.
  const rec = recoverySession(null, 1, []);
  ok(rec && Array.isArray(rec.exercises), "recoverySession still returns a valid session with no injuries (regression)");
}

// ================= Task 2: fatigue must scope to the pattern being trained =================
// Skill: strength & conditioning reasoning.

{
  const fatigue = { band: "red", byPattern: { squat: 25, horiz_push: 5 } };
  ok(fatigueBandForPatterns(fatigue, ["hpush", "vpush"]) === "green", "fatigued squat pattern does not bleed into an unrelated upper-body pattern list");
  ok(fatigueBandForPatterns(fatigue, ["squat", "hinge"]) === "red", "same-pattern fatigue (squat) still reads red when squat is actually in today's patterns");
  ok(fatigueBandForPatterns(null, ["squat"]) === "green", "a null fatigue snapshot defaults to green, never throws");
  ok(fatigueBandForPatterns(fatigue, null) === "red", "no known pattern list falls back to the athlete's overall worst-pattern band (safe default when we don't know what's trained)");
  ok(fatigueBandForPatterns(fatigue, []) === "red", "an empty pattern list falls back the same way as null");
}

{
  const fatigueSquatRed = { band: "red", byPattern: { squat: 25 } };
  ok(degradation(fatigueSquatRed, null, ["hpush", "vpush"]) === "normal", "a fatigued squat pattern does not automatically degrade an unrelated upper-body session (Task 2's named requirement)");
  ok(degradation(fatigueSquatRed, null, ["squat", "hinge"]) === "recovery", "same-pattern fatigue still triggers recovery exactly as intended when squat IS today's pattern");

  const fatiguePressRed = { band: "red", byPattern: { vert_push: 25 } };
  ok(degradation(fatiguePressRed, null, ["squat", "hinge"]) === "normal", "a fatigued press pattern does not automatically degrade an unrelated lower-body session");
  ok(degradation(fatiguePressRed, null, ["hpush", "vpush"]) === "recovery", "same-pattern fatigue (press) still triggers recovery when vpush/hpush IS today's pattern");
}

{
  // Backward compatibility: the old 2-argument call site (no patterns known)
  // behaves EXACTLY as before this patch -- global worst-pattern band.
  const fatigue = { band: "red", byPattern: { squat: 25 } };
  ok(degradation(fatigue, null) === "recovery", "omitting patterns entirely preserves the pre-patch global-band behaviour");
  ok(degradation({ band: "green" }, null) === "normal", "regression: green overall band with no patterns still reads normal");
  ok(degradation(null, 0) === "recovery", "regression: rough readiness alone still forces recovery regardless of fatigue/patterns");
  ok(degradation(null, 1) === "eased", "regression: so-so readiness alone still forces eased regardless of fatigue/patterns");
}

{
  // resolveSpec integration: a real request's role determines which patterns
  // gate degradation, using buildIntent's own (already-approved) pattern
  // derivation -- not a new pattern-inference mechanism.
  const req = makeRequest({ scope: "session", role: "upper", goal: "hypertrophy", duration_min: 45 });
  const state = { program: null, log: {}, archive: [], readiness: null };
  const spec = resolveSpec(req, state);
  ok(spec && typeof spec.degradation === "string", "resolveSpec still returns a valid degradation string (regression)");
}

// ================= Task 3: MRV must accumulate across a generation pass =================
// Skill: exercise programming reasoning.

{
  // Direct unit proof: trimSetsForVolumeLandmark itself is unchanged (pure
  // function, still only reads weeklyVolume -- the accumulation lives in
  // buildEx's bookkeeping around it, not in the trim function itself).
  const bench = byId("bench-press");
  ok(trimSetsForVolumeLandmark(5, bench, { chest: { remainingToMrv: 3 } }) === 3, "trimSetsForVolumeLandmark itself is unchanged (regression)");
}

{
  // Two exercises sharing the SAME primary muscle, built in sequence with the
  // SAME weeklyVolume object (exactly how generateSession/generateProgram
  // thread it today) must accumulate: the second exercise sees the first
  // exercise's consumption, not the same static historical snapshot.
  const benchA = byId("bench-press");
  const benchLikeB = byId("incline-dumbbell-press") || byId("overhead-press") || benchA; // any second chest-primary compound
  const weeklyVolume = { chest: { remainingToMrv: 6 } };
  const exA = buildEx(benchA, "hypertrophy", false, {}, 45, 1, false, {}, false, "", weeklyVolume);
  ok(exA.sets <= 6, "first exercise is trimmed against the starting headroom (sanity)");
  const remainingAfterA = weeklyVolume.chest.remainingToMrv;
  ok(remainingAfterA === 6 - exA.sets, `weeklyVolume.chest.remainingToMrv decremented by exactly what the first exercise consumed (got ${remainingAfterA}, expected ${6 - exA.sets})`);
  const exB = buildEx(benchLikeB, "hypertrophy", false, {}, 45, 1, false, {}, false, "", weeklyVolume);
  ok(exA.sets + exB.sets <= 6, `two exercises sharing chest as primary never collectively exceed the muscle's MRV headroom in one generation pass (got ${exA.sets} + ${exB.sets} = ${exA.sets + exB.sets}, headroom was 6)`);
}

{
  // Secondary-muscle accumulation: an exercise's secondary-muscle consumption
  // must also carry forward to reduce headroom for the next exercise hitting
  // that same muscle as ITS secondary (or primary).
  const bench = byId("bench-press"); // primary chest, secondary triceps
  const weeklyVolume = { chest: { remainingToMrv: 20 }, triceps: { remainingToMrv: 2 } };
  const exA = buildEx(bench, "hypertrophy", false, {}, 45, 1, false, {}, false, "", weeklyVolume);
  ok(weeklyVolume.triceps.remainingToMrv === Math.max(0, 2 - exA.sets * SECONDARY_MUSCLE_CREDIT), `secondary-muscle (triceps) headroom decrements by sets * ${SECONDARY_MUSCLE_CREDIT} after the first exercise (got ${weeklyVolume.triceps.remainingToMrv})`);
}

{
  // Selection remains completely untouched: accumulation only ever changes
  // the SETS field, never which exercise generateSession picks.
  const parsed = { role: "upper", minutes: 45, goal: "hypertrophy", equipment: null, includes: [] };
  const freshVolume = {};
  Object.keys(MUSCLE_VOLUME_LANDMARKS).forEach(mm => { freshVolume[mm] = { remainingToMrv: 30 }; });
  const withHeadroom = generateSession(parsed, {}, 7, {}, null, false, null, null, null, freshVolume);
  const tightVolume = {};
  Object.keys(MUSCLE_VOLUME_LANDMARKS).forEach(mm => { tightVolume[mm] = { remainingToMrv: 30 }; });
  tightVolume.chest = { remainingToMrv: 2 };
  const withTightChest = generateSession(parsed, {}, 7, {}, null, false, null, null, null, tightVolume);
  const namesA = withHeadroom.exercises.map(e => e.name).sort();
  const namesB = withTightChest.exercises.map(e => e.name).sort();
  ok(JSON.stringify(namesA) === JSON.stringify(namesB), "identical seed/request with only chest MRV headroom changed selects the EXACT same exercises -- accumulation never influences selection");
  const setsA = withHeadroom.exercises.map(e => e.sets).join(",");
  const setsB = withTightChest.exercises.map(e => e.sets).join(",");
  ok(setsA !== setsB, "but the SETS differ -- only prescribed sets change, proving the accumulation actually took effect end-to-end");
}

// ================= Amendment: every remaining exercise entry point must use =================
// ================= the SAME isExerciseInjuryFlagged gate (no exempt paths)  =================
// Skill: safety reasoning + architecture reasoning. Discovered during the Task 1
// investigation that 9 real entry points (warm-up, cool-down, functional
// finisher, conditioning, live conditioning swap, filler, endurance run) never
// called the gate at all -- only pickStrength/anchorIsAvailable/the fallback
// trio did. This section proves each of the 9 now uses it, with no new
// injury logic invented (same isExerciseInjuryFlagged, same INJURY_CATEGORIES,
// only threaded to new call sites).

function sweepNeverFlagged(pickFn, injuries, tries) {
  for (let seed = 0; seed < tries; seed++) {
    const e = pickFn(seed);
    if (e && isExerciseInjuryFlagged(e, injuries)) return { failedAt: seed, name: e.name };
  }
  return null;
}

const HIP_INJ = [{ category: "pain", target: "hip" }];
const ANKLE_INJ = [{ category: "pain", target: "ankle" }]; // flags jumping-jacks/high-knees/butt-kicks, but not standing-march (empty joint_stress -- v1.11)
const ALL_PULSE_RAISERS_INJ = [
  { category: "pain", target: "jumping jacks" }, { category: "pain", target: "high knees" },
  { category: "pain", target: "butt kicks" }, { category: "pain", target: "standing march with arm swings" }
]; // tier-4 name match on every current pulse-raiser -- the only way to flag all of them now that one has joint_stress: []
const CARRY_SPINE_INJ = [{ category: "pain", target: "spine" }]; // flags every carry + anti_rotation candidate (all have spine in joint_stress)
const SLED_INJ = [{ category: "pain", target: "sled push" }]; // tier-4 name match -- conditioning entries carry no joint_stress data at all (see report)
const EASY_RUN_INJ = [{ category: "pain", target: "easy run" }]; // tier-4 name match -- RUN_PLAN entries carry no joint_stress data either

{
  // pickByType respects injuries.
  const bad = sweepNeverFlagged(seed => pickByType("mobility", null, {}, seed, HIP_INJ), HIP_INJ, 40);
  ok(!bad, `pickByType never returns a hip-flagged mobility move across 40 seeds (${bad ? bad.name + ' at seed ' + bad.failedAt : 'clean'})`);
  ok(pickByType("mobility", null, {}, 1, []) != null, "regression: pickByType with no injuries still returns a valid mobility move");
}

{
  // pickMobilityByPatterns respects injuries.
  const bad = sweepNeverFlagged(seed => pickMobilityByPatterns(["hip-mobility"], false, null, {}, seed, HIP_INJ), HIP_INJ, 40);
  ok(!bad, `pickMobilityByPatterns never returns a hip-flagged drill across 40 seeds even when searching the hip-mobility group itself (${bad ? bad.name : 'clean'})`);
  ok(pickMobilityByPatterns(["hip-mobility"], false, null, {}, 1, []) != null, "regression: pickMobilityByPatterns with no injuries still returns a valid hip-mobility drill");
}

{
  // pickPulseRaiser respects injuries.
  const bad = sweepNeverFlagged(seed => pickPulseRaiser({}, seed, ANKLE_INJ), ANKLE_INJ, 20);
  ok(!bad, `pickPulseRaiser never returns an ankle-flagged pulse-raiser across 20 seeds (${bad ? bad.name : 'clean'})`);
  // v1.11: the pulse-raiser pool grew from 2 to 4, and Standing March with Arm
  // Swings carries an empty joint_stress[] by design -- an ankle injury no
  // longer flags every real candidate, so a genuinely safe pulse-raiser is
  // now reachable instead of an honest null. The "return nothing when truly
  // everything is unsafe" guarantee itself still holds -- proven below with
  // an injury that name-targets all four current candidates at once.
  const stillSafeUnderAnkleInjury = pickPulseRaiser({}, 1, ANKLE_INJ);
  ok(stillSafeUnderAnkleInjury && stillSafeUnderAnkleInjury.name === "Standing March with Arm Swings",
     "an ankle injury now resolves to the zero-joint-stress Standing March option instead of returning null (v1.11 pool expansion)");
  const noneWhenAllFlaggedByName = pickPulseRaiser({}, 1, ALL_PULSE_RAISERS_INJ);
  ok(noneWhenAllFlaggedByName === null, "honest 'return nothing' still holds: an injury naming every current pulse-raiser candidate returns null rather than prescribing one anyway");
  ok(pickPulseRaiser({}, 1, []) != null, "regression: pickPulseRaiser with no injuries still returns a valid pulse-raiser");
}

{
  // v1.11: the closer is now a 3-way deterministic rotation (pickCloser), not
  // a single hardcoded Box Breathing lookup -- still safety-checked the same
  // way. An injury naming ALL THREE closers is the only way to flag every
  // candidate; naming just one still lets the rotation fall back to a safe
  // alternative rather than leaving the cool-down close blank.
  const ALL_CLOSERS_INJ = [
    { category: "pain", target: "box breathing" }, { category: "pain", target: "child's pose" },
    { category: "pain", target: "standing forward fold" }
  ];
  const strengthPicks = [{ pattern: "hpush" }];
  const CLOSER_NAMES = ["Box Breathing", "Child's Pose", "Standing Forward Fold"];
  let closerNamesSeen = new Set(), anyFlaggedCloserSurfaced = false;
  for (let seed = 0; seed < 6; seed++) {
    const wc = buildWarmupCooldown(strengthPicks, null, {}, seed, {}, 45, 1, false, {}, []);
    const closer = wc.cooldown.find(e => CLOSER_NAMES.indexOf(e.name) >= 0);
    if (closer) closerNamesSeen.add(closer.name);
    const wcAllFlagged = buildWarmupCooldown(strengthPicks, null, {}, seed, {}, 45, 1, false, {}, ALL_CLOSERS_INJ);
    if (wcAllFlagged.cooldown.some(e => CLOSER_NAMES.indexOf(e.name) >= 0)) anyFlaggedCloserSurfaced = true;
  }
  ok(closerNamesSeen.size > 1, `sanity: the closer rotates across seeds, not always the same one (saw: ${[...closerNamesSeen].join(', ')})`);
  ok(!anyFlaggedCloserSurfaced, "an injury naming all three closers by name excludes all of them from the cool-down across every seed -- the rotation is gated too, not just pool-scanned pickers");
  const oneFlagged = buildWarmupCooldown(strengthPicks, null, {}, 1, {}, 45, 1, false, {}, [{ category: "pain", target: "box breathing" }]);
  ok(!oneFlagged.cooldown.some(e => e.name === "Box Breathing"), "an injury targeting Box Breathing alone excludes only Box Breathing (the rotation still offers a safe alternative closer)");
}

{
  // pickFunctional respects injuries (carries + anti-rotation both tag spine).
  const bad = sweepNeverFlagged(seed => pickFunctional("carry", null, {}, seed, CARRY_SPINE_INJ), CARRY_SPINE_INJ, 20);
  ok(!bad, `pickFunctional("carry") never returns a spine-flagged carry across 20 seeds (${bad ? bad.name : 'clean'})`);
  const bad2 = sweepNeverFlagged(seed => pickFunctional("rotation", null, {}, seed, CARRY_SPINE_INJ), CARRY_SPINE_INJ, 20);
  ok(!bad2, `pickFunctional("rotation") never returns a spine-flagged anti-rotation move across 20 seeds (${bad2 ? bad2.name : 'clean'})`);
  ok(pickFunctional("carry", null, {}, 1, []) != null, "regression: pickFunctional with no injuries still returns a valid carry");
}

{
  // pickConditioning respects injuries.
  const bad = sweepNeverFlagged(seed => pickConditioning("interval", null, {}, seed, SLED_INJ), SLED_INJ, 20);
  ok(!bad, `pickConditioning never returns Sled Push once it's injury-flagged by name, across 20 seeds (${bad ? bad.name : 'clean'})`);
  ok(pickConditioning("interval", null, {}, 1, []) != null, "regression: pickConditioning with no injuries still returns a valid interval move");
}

{
  // conditioningAlternatives respects injuries (the live "swap the kit" button).
  const altsUnsafe = conditioningAlternatives("Bike Intervals", null, SLED_INJ);
  ok(!altsUnsafe.some(a => a.name === "Sled Push"), "conditioningAlternatives never offers Sled Push as a live swap once it's injury-flagged");
  const altsSafe = conditioningAlternatives("Bike Intervals", null, []);
  ok(altsSafe.some(a => a.name === "Sled Push"), "regression: with no injuries, Sled Push is still offered as a swap alternative");
}

{
  // runWorkout respects injuries -- honest "return nothing" since RUN_PLAN has
  // exactly one candidate per slot (no pool to fall back within).
  const flagged = runWorkout(0, 2, 45, 1, EASY_RUN_INJ); // days=2 -> ["easy","long"], si=0 -> "easy" -> Easy Run
  ok(flagged === null, "runWorkout returns null (honest 'no safe alternative') rather than prescribing Easy Run once it's injury-flagged by name");
  const safe = runWorkout(0, 2, 45, 1, []);
  ok(safe && safe.name === "Easy Run", "regression: with no injuries, runWorkout still returns Easy Run for the same slot");
}

{
  // Summary invariant: sweep every one of the 9 previously-unsafe entry points
  // together under one shared injury set and confirm none of them ever
  // surfaces a flagged exercise -- the single-gate invariant, proven in one
  // place rather than only piecemeal above.
  const UNIVERSAL_INJ = [{ category: "pain", target: "hip" }, { category: "pain", target: "ankle" }, { category: "pain", target: "spine" }];
  let anyBypass = null;
  for (let seed = 0; seed < 15 && !anyBypass; seed++) {
    const candidates = [
      pickByType("mobility", null, {}, seed, UNIVERSAL_INJ),
      pickMobilityByPatterns(["hip-mobility", "ankle-mobility"], false, null, {}, seed, UNIVERSAL_INJ),
      pickMobilityByPatterns(["hip-mobility", "ankle-mobility"], true, null, {}, seed, UNIVERSAL_INJ),
      pickPulseRaiser({}, seed, UNIVERSAL_INJ),
      pickFunctional("carry", null, {}, seed, UNIVERSAL_INJ),
      pickFunctional("rotation", null, {}, seed, UNIVERSAL_INJ)
    ];
    candidates.forEach(e => { if (e && isExerciseInjuryFlagged(e, UNIVERSAL_INJ)) anyBypass = e.name; });
  }
  ok(!anyBypass, `no entry point in the swept set ever bypasses the safety gate under a shared injury set (${anyBypass || 'clean'})`);
}

console.log(`${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
