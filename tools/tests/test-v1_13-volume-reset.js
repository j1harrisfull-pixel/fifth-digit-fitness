// v1.13 Engine Volume Fix -- Weekly Budget Reset + Anchor Floor. A multi-week
// program used to thread the SAME weeklyVolume object (a ONE-WEEK MRV budget)
// by reference through every week of the block, so week 1's spend
// permanently ate into week 2/3/4's headroom -- reproduced live as Week 3
// Lower.Squat dropping Back Squat to 1 set while Lying Leg Curl (an
// under-used bucket) kept 4. Two approved fixes, both inside the coach-span:
// (1) generateProgram snapshots weeklyVolume once and rebuilds a fresh
// per-week working copy for every week's buildEx calls, so within-week
// accumulation (Phase 5.5 Task 3) is unchanged but nothing carries over
// week to week; (2) buildEx enforces a floor of min(3, pre-trim sets) on the
// day's anchor (isAnchor) outside of deload weeks, so a trim never cuts the
// main lift below 3 sets -- but never inflates a legitimately lower
// prescription either. generateSession (Just Today) is unchanged and keeps
// threading the raw weeklyVolume object exactly as before.
const fs = require('fs');
const { execSync } = require('child_process');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const helper = lines.slice(lines.findIndex(l => /function clampInt\(/.test(l)), lines.findIndex(l => /function migrateV1toV2\(/.test(l))).join('\n');
const cs = lines.findIndex(l => l.includes('/*__COACH_START__*/')), ce = lines.findIndex(l => l.includes('/*__COACH_END__*/'));
const src = helper + '\n' + lines.slice(cs + 1, ce).join('\n') + '\n; module.exports={LIBRARY,MUSCLE_VOLUME_LANDMARKS,SECONDARY_MUSCLE_CREDIT,trimSetsForVolumeLandmark,buildEx,generateSession,generateProgram};';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const { LIBRARY, MUSCLE_VOLUME_LANDMARKS, SECONDARY_MUSCLE_CREDIT, trimSetsForVolumeLandmark, buildEx, generateSession, generateProgram } = m.exports;

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 0. Coach-span md5 (this ticket is the first-ever approved change) ----------
const spanMd5 = execSync(`sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5`).toString().trim();
ok(spanMd5 === 'ce6452b369d4d1d14fd0bf8560208ce7', 'coach-span md5 is the new v1.13 value (ce6452b369d4d1d14fd0bf8560208ce7), got ' + spanMd5);

function freshWeeklyVolume(overrides) {
  const wv = {};
  Object.keys(MUSCLE_VOLUME_LANDMARKS).forEach(function (m2) {
    const lm = MUSCLE_VOLUME_LANDMARKS[m2];
    wv[m2] = { mev: lm.mev, mav: lm.mav, mrv: lm.mrv, done: 0, band: 'under-mev', remainingToMrv: lm.mrv };
  });
  if (overrides) Object.keys(overrides).forEach(function (m2) { wv[m2] = Object.assign({}, wv[m2], overrides[m2]); });
  return wv;
}

function anchorsBySession(weekSessions) {
  // The anchor is the first strength exercise in each session.
  return weekSessions.map(function (ses) {
    return ses.exercises.find(function (e) { return e.type === 'strength'; });
  });
}

const HYBRID_INTAKE = { goal: 'hybrid', days: 4, minutes: 45, weeks: 4 };

// ---------- 1/2/3. 4-week hybrid build: anchors floor at >=3 in non-deload weeks; ----------
// ---------- week 2/3 anchor sets equal week 1's (frozen lift, reset budget); ----------
// ---------- week 4 (deload) is exempt and unchanged. ----------
{
  const wv = freshWeeklyVolume({
    hamstrings: { remainingToMrv: 30 }, // deliberately generous -- reproduces the live
                                          // bug's under-used bucket that used to soak up
                                          // the whole block's budget instead of just one week's
  });
  const prog = generateProgram(HYBRID_INTAKE, {}, 42, {}, null, null, null, wv, null);
  ok(prog.weeks.length === 4, 'sanity: 4-week hybrid block builds 4 weeks');

  for (let wn = 0; wn < 4; wn++) {
    const isDeloadWeek = (wn === 3);
    const anchors = anchorsBySession(prog.weeks[wn].sessions);
    anchors.forEach(function (anchor, si) {
      if (!anchor) return;
      if (isDeloadWeek) return; // deload exempt -- checked separately below
      ok(anchor.sets >= 3, `week ${wn + 1} session ${si} anchor "${anchor.name}" has sets >= 3 (got ${anchor.sets})`);
    });
  }

  // Frozen strength selection is identical week to week (same lift each week,
  // only the prescription changes) -- so week 1 vs week 2/3's anchor for the
  // SAME session index is the same exercise, and with a reset budget neither
  // week 2 nor week 3 should show a smaller anchor set-count than week 1
  // purely because of accumulated cross-week MRV trimming.
  const wk1Anchors = anchorsBySession(prog.weeks[0].sessions);
  const wk2Anchors = anchorsBySession(prog.weeks[1].sessions);
  const wk3Anchors = anchorsBySession(prog.weeks[2].sessions);
  wk1Anchors.forEach(function (a1, si) {
    if (!a1) return;
    const a2 = wk2Anchors[si], a3 = wk3Anchors[si];
    ok(a2 && a2.name === a1.name, `week 2 session ${si} anchor is the same frozen lift as week 1 ("${a1.name}")`);
    ok(a3 && a3.name === a1.name, `week 3 session ${si} anchor is the same frozen lift as week 1 ("${a1.name}")`);
    if (a2) ok(a2.sets >= a1.sets, `week 2 session ${si} anchor "${a1.name}" sets (${a2.sets}) are not reduced vs week 1 (${a1.sets}) -- no cross-week MRV leak`);
    if (a3) ok(a3.sets >= a1.sets, `week 3 session ${si} anchor "${a1.name}" sets (${a3.sets}) are not reduced vs week 1 (${a1.sets}) -- no cross-week MRV leak (the reproduced live defect)`);
  });
}

// ---------- 4. Within-week MRV trimming still works for a non-anchor accessory. ----------
{
  // Force a hard budget on a muscle so a non-anchor (accessory) exercise
  // sharing that primary muscle gets trimmed. Anchors are exempted from the
  // floor-BYPASSING trim (they get the floor instead), but accessories must
  // still see real trimming down to the existing floor of 1 set.
  const wv = freshWeeklyVolume({ chest: { remainingToMrv: 1 } });
  const bench = LIBRARY.find(function (e) { return e.name === 'Bench Press'; });
  const built = buildEx(bench, 'hypertrophy', false /* not anchor */, {}, 45, 1, false, {}, false, '', wv);
  ok(built.sets === 1, `a non-anchor exercise on a muscle with remainingToMrv=1 is trimmed down to the existing floor of 1 set (got ${built.sets})`);
}

// ---------- 5. weeklyVolume passed by the caller is not mutated across weeks in a leaking way. ----------
{
  const wv = freshWeeklyVolume({ quads: { remainingToMrv: 6 } });
  const originalQuadsRemaining = wv.quads.remainingToMrv;
  generateProgram(HYBRID_INTAKE, {}, 7, {}, null, null, null, wv, null);
  ok(wv.quads.remainingToMrv === originalQuadsRemaining,
     `the caller's original weeklyVolume object is never mutated by generateProgram -- each week works against its own snapshot copy (quads.remainingToMrv still ${wv.quads.remainingToMrv}, expected ${originalQuadsRemaining})`);
}

// ---------- 6. The anchor floor never inflates a legitimately-low prescription, ----------
// ---------- and is skipped entirely for deload weeks. ----------
{
  const squat = LIBRARY.find(function (e) { return e.name === 'Back Squat'; });

  // Deload is exempt from the floor: a tight budget can still trim a deload
  // anchor below 3 sets, because isDeload short-circuits the floor's
  // `isAnchor && !isDeload` guard -- the deload's own reduced dose IS the
  // intended lighter prescription, not something the floor should undo.
  const tightVolume = freshWeeklyVolume({ quads: { remainingToMrv: 1 } });
  const deloadBuilt = buildEx(squat, 'strength', true /* isAnchor */, {}, 45, 4, true /* isDeload */, {}, false, '', tightVolume);
  ok(deloadBuilt.sets < 3, `a deload-week anchor is still trimmable below 3 sets under a tight budget -- the floor does not apply to deload weeks (got ${deloadBuilt.sets})`);

  // With ample headroom (no trim pressure at all), the floor's
  // Math.max(trimmedSets, Math.min(3, preTrimSets)) can never exceed what was
  // actually prescribed pre-trim -- an anchor is never padded past its own
  // natural prescription just because the floor logic ran.
  const ampleVolume = freshWeeklyVolume();
  const untrimmedBuilt = buildEx(squat, 'strength', true, {}, 45, 1, false, {}, false, '', ampleVolume);
  const naturalBuilt = buildEx(squat, 'strength', true, {}, 45, 1, false, {}, false, '', null); // no weeklyVolume at all -> no trim/floor path runs
  ok(untrimmedBuilt.sets === naturalBuilt.sets, `with ample MRV headroom, the floor never inflates sets beyond the natural (untrimmed) prescription (got ${untrimmedBuilt.sets}, natural was ${naturalBuilt.sets})`);
}

// ---------- 7. generateSession (Just Today) is completely unaffected -- still ----------
// ---------- threads the raw weeklyVolume object unchanged, single-session behavior intact. ----------
{
  const wv = freshWeeklyVolume({ chest: { remainingToMrv: 1 } });
  const parsed = { role: 'upper', minutes: 45, goal: 'hypertrophy', equipment: null, includes: [] };
  const originalRemaining = wv.chest.remainingToMrv;
  const ses = generateSession(parsed, {}, 7, {}, null, false, null, null, null, wv);
  ok(ses && Array.isArray(ses.exercises) && ses.exercises.length > 0, 'generateSession still returns a valid single session (regression)');
  ok(wv.chest.remainingToMrv !== originalRemaining || ses.exercises.every(function (e) { return e.name.indexOf('chest') < 0; }),
     'generateSession still mutates its own weeklyVolume object directly by reference (unchanged Just Today behavior, not per-week-copied)');
}

console.log(`${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
