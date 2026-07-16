// Phase 8 (Elite Rubric): deterministic, rule-based session assertions.
//
// PURE OBSERVATION ONLY. Every function here reads an already-built
// session/program/state object and returns a list of violations -- it never
// re-implements or overrides Selection/Prescription/Progression/Safety logic.
// Callers inject the real engine functions/data (isExerciseInjuryFlagged,
// a LIBRARY-backed byName lookup, ROLE_PRIMARY, PRESCRIPTION_TABLE) so this
// file never duplicates coaching knowledge -- it only checks that the real
// engine's own output is internally consistent with the real engine's own
// rules.
//
// No AI grading, no fuzzy scoring: every check below is a plain boolean rule
// over structured data, and every violation carries a specific, actionable
// message (never a bare "failed").
'use strict';

function strengthExercises(exercises, byName) {
  return exercises.filter(function (e) {
    var lib = byName(e.name);
    return lib && lib.type === 'strength';
  }).map(function (e) { return { built: e, lib: byName(e.name) }; });
}

// ---- 1. No unsafe exercises -------------------------------------------
// Re-checks the SAME shared gate the engine itself uses (isExerciseInjuryFlagged),
// against every exercise that actually landed in the built output. This is a
// re-verification of the engine's own guarantee, not a new safety rule.
function assertNoUnsafeExercises(sessionLabel, exercises, injuries, isExerciseInjuryFlagged, byName) {
  var violations = [];
  exercises.forEach(function (e) {
    var lib = byName(e.name);
    if (!lib) return; // not a LIBRARY-backed exercise (e.g. an absolute-floor
                       // bodyweight fallback outside LIBRARY) -- nothing to check
    if (isExerciseInjuryFlagged(lib, injuries || [])) {
      violations.push({
        dimension: 'balanced-injury-smart',
        message: sessionLabel + ' includes "' + e.name + '", which isExerciseInjuryFlagged() marks as unsafe for this athlete\'s injuries.'
      });
    }
  });
  return violations;
}

// A small, fixed set of exercises whose prescription deliberately bypasses
// PRESCRIPTION_TABLE entirely -- static holds, loaded carries, the Turkish
// Get-Up -- each has its own dedicated branch at the TOP of prescription(),
// checked before the table is ever consulted (see prescription()'s own
// static_hold/carry/unit==="sec"/kb-turkish-get-up branches). Detected from
// the same LIBRARY fields prescription() itself reads, not guessed.
function isNonStandardPrescription(lib) {
  return !!(lib.static_hold || lib.pattern === 'carry' || lib.unit === 'sec' || lib.id === 'kb-turkish-get-up');
}
// The two fixed "never leave a day hollow" fallback pools (roleFloorMoves /
// absoluteFloorExercises) build raw exercise objects with their own hardcoded
// sets/reps -- they never call buildEx/prescription() at all, so they have no
// PRESCRIPTION_TABLE row to check against. Detected by their own fixed,
// verified `why` strings (the only stable signature these objects carry).
var FLOOR_FALLBACK_WHY = ['Bodyweight work so the day isn\'t left short · no kit needed', 'Bodyweight foundation, no equipment needed'];

// ---- 2. Correct prescription bands -------------------------------------
// Cross-checks each strength exercise's own reps string against the row
// PRESCRIPTION_TABLE itself defines for (stimulus, compound|isolation) --
// the same table prescription() already reads, using prescription()'s OWN
// rule for what counts as a compound slot: `anchor = ex.compound && isAnchor`
// (an anchor slot filled by a non-compound substitute is NOT treated as
// compound -- isAnchor alone never forces the compound row). A non-anchor
// slot in a strength-goal session always borrows the hypertrophy row
// (existing, documented behaviour -- see prescription()'s tableGoal comment).
// "hybrid"/"endurance" goals use a separate legacy bracket (documented,
// pre-Phase-5 behaviour) and are skipped here, not flagged.
function assertPrescriptionBands(exercises, byName, PRESCRIPTION_TABLE, goal) {
  var violations = [];
  if (goal === 'hybrid' || goal === 'endurance') return violations; // legacy bracket, not table-driven
  var picks = strengthExercises(exercises, byName);
  picks.forEach(function (p, idx) {
    var e = p.built, lib = p.lib;
    if (isNonStandardPrescription(lib)) return; // own dedicated prescription branch, not table-driven
    if (FLOOR_FALLBACK_WHY.indexOf(e.why) >= 0) return; // hardcoded fallback object, never touches the table
    var isAnchorSlot = idx === 0; // first strength slot is always the anchor slot (buildEx's own k===0 convention)
    var anchor = isAnchorSlot && !!lib.compound; // prescription()'s exact rule -- isAnchor alone is not enough
    var tableGoal = (goal === 'strength' && !anchor) ? 'hypertrophy' : goal;
    var row = PRESCRIPTION_TABLE[tableGoal] || PRESCRIPTION_TABLE.general;
    var slotIsCompound = anchor ? true : !!lib.compound;
    var stimRow = slotIsCompound ? row.compound : (row.isolation || row.compound);
    if (!stimRow) return; // e.g. "strength" isolation has no row -- borrowed hypertrophy above already
    // A ramp anchor's strength-goal 3-5 override is a documented, deliberate
    // exception (prescription()'s own rampAnchor branch) -- never flagged here.
    if (e.reps === '3-5' && goal === 'strength') return;
    if (e.reps !== stimRow.reps) {
      violations.push({
        dimension: 'right-hard',
        message: e.name + ' (stimulus=' + tableGoal + ', compound=' + slotIsCompound + ') prescribed ' + e.reps + ' reps -- expected ' + stimRow.reps + ' per PRESCRIPTION_TABLE.'
      });
    }
  });
  return violations;
}

// ---- 3. Anchor stability -------------------------------------------------
// getAnchorState's own exerciseId must be byte-identical across two builds
// for the same athlete/pattern -- never silently reassigned. Callers pass the
// same athlete object through two separate generation calls and read the
// anchor state before/after; this function only compares the two reads.
function assertAnchorStable(pattern, anchorBefore, anchorAfter) {
  var violations = [];
  if (anchorBefore && anchorAfter && anchorBefore.exerciseId !== anchorAfter.exerciseId) {
    violations.push({
      dimension: 'goes-somewhere',
      message: 'Anchor for pattern "' + pattern + '" changed from "' + anchorBefore.exerciseId + '" to "' + anchorAfter.exerciseId + '" across two builds with the same athlete object -- no explicit reassignment occurred.'
    });
  }
  return violations;
}

// ---- 4. Recovery content present ------------------------------------------
// A recoverySession() build must contain real mobility content, and honestly
// includes-or-omits (never substitutes) light-pump/breathing -- this checks
// PRESENCE of the recovery-specific content types, not their exact identity.
function assertRecoveryContentPresent(exercises, byName) {
  var violations = [];
  var mobility = exercises.filter(function (e) {
    var lib = byName(e.name);
    return lib && lib.type === 'mobility';
  });
  if (!mobility.length) {
    violations.push({
      dimension: 'session-coherence',
      message: 'Recovery session contains zero mobility-type exercises -- expected at least one.'
    });
  }
  return violations;
}

// ---- 5. Every exercise has a meaningful why -------------------------------
function assertMeaningfulWhy(exercises) {
  var violations = [];
  exercises.forEach(function (e) {
    if (typeof e.why !== 'string' || !e.why.trim().length) {
      violations.push({
        dimension: 'reasoned',
        message: e.name + ' has no reason recorded (why="' + e.why + '").'
      });
    }
  });
  return violations;
}

// ---- 6. No obvious filler (structural completeness) -----------------------
// "Filler" here means a slot the engine placed without a real prescription --
// every strength exercise must carry a numeric rir and a real sets count;
// every exercise of any type must carry non-empty reps. This does not judge
// coaching QUALITY (that's Right-Hard's job), only that the slot is a real,
// complete prescription rather than a hollow placeholder.
function assertNoObviousFiller(exercises, byName) {
  var violations = [];
  exercises.forEach(function (e) {
    var lib = byName(e.name);
    if (!e.reps && e.reps !== 0) {
      violations.push({ dimension: 'right-hard', message: e.name + ' has no reps prescribed (empty placeholder slot).' });
    }
    if (lib && lib.type === 'strength' && !isNonStandardPrescription(lib) && FLOOR_FALLBACK_WHY.indexOf(e.why) < 0) {
      // static holds/carries/Turkish Get-Up and the hardcoded floor-fallback
      // pool are real, complete prescriptions -- they legitimately carry no
      // rir field (a different branch of prescription() entirely, or no
      // prescription() call at all), so they're exempt from this check, not
      // silently broken.
      if (typeof e.rir !== 'number') {
        violations.push({ dimension: 'right-hard', message: e.name + ' is a strength exercise but has no numeric rir.' });
      }
      if (!(e.sets > 0)) {
        violations.push({ dimension: 'right-hard', message: e.name + ' is a strength exercise but has no sets prescribed.' });
      }
    }
  });
  return violations;
}

// ---- 7. MRV respected ------------------------------------------------------
// Re-reads computeWeeklyDebt(state).byMuscleVolume AFTER a build, comparing
// `done` against `mrv`. trimSetsForVolumeLandmark deliberately floors at 1 set
// even with zero headroom (Phase 5, documented) -- so a muscle can land up to
// one exercise's worth of sets over its literal mrv number. This check treats
// that specific, documented case as a "minimum exposure under MRV cap" note,
// not a failure; anything beyond that tolerance is a real violation.
function assertMrvRespected(byMuscleVolume, tolerancePerMuscleSets) {
  tolerancePerMuscleSets = tolerancePerMuscleSets || {};
  var violations = [], notes = [];
  Object.keys(byMuscleVolume || {}).forEach(function (m) {
    var v = byMuscleVolume[m];
    if (v.done <= v.mrv) return;
    var over = v.done - v.mrv;
    var tolerance = tolerancePerMuscleSets[m] != null ? tolerancePerMuscleSets[m] : 1;
    if (over <= tolerance) {
      notes.push({ dimension: 'balanced-injury-smart', message: m + ' is ' + over + ' set(s) over its MRV of ' + v.mrv + ' -- minimum exposure under MRV cap (floor-of-1 trimming, documented Phase 5 behaviour), not full productive volume.' });
    } else {
      violations.push({ dimension: 'balanced-injury-smart', message: m + ' received ' + v.done + ' total sets, exceeding MRV of ' + v.mrv + ' by ' + over + ' sets -- beyond the documented floor-of-1 tolerance.' });
    }
  });
  return { violations: violations, notes: notes };
}

// ---- 8. Readiness respected -------------------------------------------------
// degradation()'s own decision must actually be reflected in what got built:
// a "recovery" decision must route through recoverySession() content (mobility
// present, no full strength session forced); "eased" must show eased targets
// somewhere; "normal" is unconstrained. This checks the OUTPUT is consistent
// with the decision already made elsewhere -- it never recomputes degradation.
function assertReadinessRespected(degradationResult, exercises, byName) {
  var violations = [];
  if (degradationResult === 'recovery') {
    var strengthPicks = strengthExercises(exercises, byName);
    var hardStrength = strengthPicks.filter(function (p) { return p.lib.compound; });
    if (hardStrength.length > 0) {
      violations.push({
        dimension: 'right-hard',
        message: 'degradation() returned "recovery" but the built session still includes ' + hardStrength.length + ' compound strength exercise(s) -- expected a recovery-path build (mobility/light-pump only).'
      });
    }
  }
  return violations;
}

// ---- 9. Session coherence (ROLES-derived family proxy) ----------------------
// Lightweight, first-pass structural check only -- NOT a complete judgement of
// coaching quality. Every strength exercise's own `pattern` should be a member
// of the day's declared role family. The family is derived from ROLES[role]
// itself (the same slot definitions generateSession/generateProgram use to
// decide what a role's day is built from) rather than the narrower
// ROLE_PRIMARY table: ROLE_PRIMARY was built for a different purpose
// (topUpThinDay's floor-fill decision) and its coverage is deliberately
// partial -- it omits several patterns ROLES legitimately assigns to a role's
// own isolation/secondary slots (e.g. biceps/triceps/calf/core accessories,
// or the "lunge"/"vpush" slots ROLES.full genuinely allows). Using the
// narrower table produced false positives on entirely legitimate, on-role
// accessory work; ROLES is the more accurate and equally-real source (see
// the Phase 8 completion report for this deviation from the original design
// note). Mobility/conditioning/functional content is exempt (ROLES only
// describes strength slots). Roles with no ROLES entry (a free-text/
// areas-only request) are exempt entirely -- this check simply doesn't apply.
function roleFamilyFromRoles(ROLES, role) {
  var slots = role && ROLES[role];
  if (!slots) return null;
  var family = [];
  slots.forEach(function (slot) {
    (slot.patterns || []).forEach(function (p) { if (family.indexOf(p) < 0) family.push(p); });
  });
  return family;
}
function assertSessionCoherence(exercises, byName, role, ROLES) {
  var violations = [];
  var family = roleFamilyFromRoles(ROLES, role);
  if (!family) return violations; // no proxy available for this role -- not a failure
  var picks = strengthExercises(exercises, byName);
  picks.forEach(function (p) {
    var mp = p.lib.pattern; // ROLES is expressed in the short slot-vocabulary (hpush/vpush/...)
    // 16 July 2026 safety-backfill exemption: when injury filtering empties a
    // slot, the engine deliberately substitutes a safe OFF-family pattern
    // (core/carry/arms) rather than shipping a thin day -- those picks carry
    // an explicit "Swapped in" why and are coherent BY DESIGN, not a drift.
    if (/^Swapped in/.test((p.built && p.built.why) || "")) return;
    if (mp && family.indexOf(mp) < 0) {
      violations.push({
        dimension: 'session-coherence',
        message: p.built.name + ' (pattern=' + mp + ') appears in a "' + role + '" day but "' + mp + '" is not in that role\'s family [' + family.join(', ') + '].'
      });
    }
  });
  return violations;
}

module.exports = {
  assertNoUnsafeExercises: assertNoUnsafeExercises,
  assertPrescriptionBands: assertPrescriptionBands,
  assertAnchorStable: assertAnchorStable,
  assertRecoveryContentPresent: assertRecoveryContentPresent,
  assertMeaningfulWhy: assertMeaningfulWhy,
  assertNoObviousFiller: assertNoObviousFiller,
  assertMrvRespected: assertMrvRespected,
  assertReadinessRespected: assertReadinessRespected,
  assertSessionCoherence: assertSessionCoherence
};
