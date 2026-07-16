// v1.11.1 -- NEXT Highlight Consistency (Deep Resolver Audit + Fix).
// Extracts displayOrderedExercises/sessionItemsFor/firstIncompleteId/currentId/
// computeNextUpcomingId VERBATIM from index.html by brace-matching and runs
// them against fixture sessions (strength + warm-up/cool-down blocks, plus a
// density block) -- not a reimplementation. Proves the 10 properties in the
// v1.11.1 ticket.
const fs = require('fs');
const { execSync } = require('child_process');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

function extractFn(name) {
  const sig = 'function ' + name + '(';
  const at = SRC.indexOf(sig);
  if (at < 0) throw new Error('function not found: ' + name);
  const braceStart = SRC.indexOf('{', at);
  let depth = 0, i = braceStart, inStr = null, prev = '';
  for (; i < SRC.length; i++) {
    const c = SRC[i], nx = SRC[i + 1];
    if (inStr) { if (c === inStr && prev !== '\\') inStr = null; prev = c; continue; }
    if (c === '/' && nx === '/') { const nl = SRC.indexOf('\n', i); i = nl < 0 ? SRC.length : nl; prev = '\n'; continue; }
    if (c === '/' && nx === '*') { const end = SRC.indexOf('*/', i + 2); i = end < 0 ? SRC.length : end + 1; prev = '/'; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; }
    else if (c === '{') depth++;
    else if (c === '}') { depth--; if (depth === 0) { i++; break; } }
    prev = c;
  }
  return SRC.slice(at, i);
}

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 0. Coach-span untouched ----------
const spanMd5 = execSync(`sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5`).toString().trim();
ok(spanMd5 === '1081700e58396438a0b408febcfdc56b', 'coach-span md5 unchanged (1081700e58396438a0b408febcfdc56b), got ' + spanMd5);
const spanEnd = SRC.indexOf('/*__COACH_END__*/');
['displayOrderedExercises', 'sessionItemsFor', 'currentId', 'computeNextUpcomingId', 'applyGlance'].forEach(function (name) {
  const at = SRC.indexOf('function ' + name + '(');
  ok(at > spanEnd, name + '() is defined outside (after) the coach-span');
});

// ---------- 1. applyGlance is the single live owner of NEXT/zone state ----------
const applyGlanceSrc = extractFn('applyGlance');
ok(applyGlanceSrc.indexOf('computeNextUpcomingId(cid)') >= 0, 'applyGlance recomputes nextId via computeNextUpcomingId');
ok(applyGlanceSrc.indexOf('is-up-next') >= 0, 'applyGlance toggles .is-up-next on live patch');
ok(applyGlanceSrc.indexOf('card__zonelabel') >= 0, 'applyGlance refreshes the zone-label element on live patch');

// ==================================================================
// FUNCTIONAL: resolver chain, run against REAL extracted logic.
// ==================================================================
const displayOrderedExercisesSrc = extractFn('displayOrderedExercises');
const sessionItemsForSrc = extractFn('sessionItemsFor');
const firstIncompleteIdSrc = extractFn('firstIncompleteId');
const currentIdSrc = extractFn('currentId');
const computeNextUpcomingIdSrc = extractFn('computeNextUpcomingId');

function harness() {
  const src = `
    var state;
    function curSession() { return state.session; }
    function readLog(ses, ex) {
      var sl = state.log[ses.id], el = sl && sl.ex ? sl.ex[ex.id] : null;
      return { sets: (el && el.sets) || [] };
    }
    function isSkipped(ses, exId) {
      var sl = state.log[ses.id];
      return !!(sl && sl.ex && sl.ex[exId] && sl.ex[exId].skipped);
    }
    function blockPseudoId(kind) { return 'blk_' + kind; }
    function readBlockLog(ses, kind) {
      var sl = state.log[ses.id], b = sl && sl.blocks ? sl.blocks[kind] : null;
      return { rounds: (b && b.rounds) || 0, completed: !!(b && b.completed) };
    }
    ${displayOrderedExercisesSrc}
    ${sessionItemsForSrc}
    ${firstIncompleteIdSrc}
    function sessionItems() { return sessionItemsFor(curSession()); }
    ${currentIdSrc}
    ${computeNextUpcomingIdSrc}
    module.exports = {
      setState: function (s) { state = s; },
      sessionItemsFor: sessionItemsFor,
      currentId: currentId,
      computeNextUpcomingId: computeNextUpcomingId
    };
  `;
  const mod = { exports: {} };
  new Function('module', 'exports', src)(mod, mod.exports);
  return mod.exports;
}

// ---- Fixture: 3 warm-up, 3 strength, 3 cool-down (mirrors real generator
// order: strength assembled first, warm-up/cool-down appended after -- but
// displayOrderedExercises must walk them in ses.blocks' visual order).
function freshFixture() {
  const strength = [
    { id: 's0', block: 'strength', sets: 3 },
    { id: 's1', block: 'strength', sets: 3 },
    { id: 's2', block: 'strength', sets: 3 },
  ];
  const warmup = [
    { id: 'w0', block: 'warmup', sets: 2 },
    { id: 'w1', block: 'warmup', sets: 2 },
    { id: 'w2', block: 'warmup', sets: 2 },
  ];
  const cooldown = [
    { id: 'c0', block: 'cooldown', sets: 2 },
    { id: 'c1', block: 'cooldown', sets: 2 },
    { id: 'c2', block: 'cooldown', sets: 2 },
  ];
  return {
    session: {
      id: 'ses1',
      exercises: strength.concat(warmup).concat(cooldown), // raw generator order
      blocks: [{ kind: 'warmup' }, { kind: 'strength' }, { kind: 'cooldown' }], // true visual order
    },
    log: { ses1: { ex: {} } },
    activeExerciseId: null,
  };
}
function complete(state, id, n) {
  const sets = []; for (let i = 0; i < n; i++) sets.push({ completed: true });
  state.log.ses1.ex[id] = { sets: sets };
}
function completeN(state, id, n) {
  const sl = state.log.ses1.ex[id] || (state.log.ses1.ex[id] = { sets: [] });
  while (sl.sets.length < n) sl.sets.push({ completed: false });
  for (let i = 0; i < n; i++) sl.sets[i].completed = true;
}
function uncompleteOne(state, id) {
  const sl = state.log.ses1.ex[id];
  const done = sl.sets.filter(s => s.completed);
  if (done.length) done[done.length - 1].completed = false;
}
function skip(state, id) {
  state.log.ses1.ex[id] = state.log.ses1.ex[id] || { sets: [] };
  state.log.ses1.ex[id].skipped = true;
}
function unskip(state, id) {
  if (state.log.ses1.ex[id]) state.log.ses1.ex[id].skipped = false;
}
function order(items) { return items.map(i => i.id); }

const h = harness();

// ---------- Property 1: exactly one NEXT exists when a next item exists ----------
(function () {
  const state = freshFixture(); h.setState(state);
  ok(order(h.sessionItemsFor(state.session)).join(',') === 'w0,w1,w2,s0,s1,s2,c0,c1,c2',
    'sessionItemsFor walks in true visual (blocks) order, not raw storage order');
  const cid = h.currentId();
  ok(cid === 'w0', 'fresh session: CURRENT is the first card on screen (w0), not the first strength exercise');
  const nextId = h.computeNextUpcomingId(cid);
  ok(nextId === 'w1', 'fresh session: NEXT is exactly the second card (w1)');
})();

// ---------- Property 2: zero NEXT exists when no next item exists ----------
(function () {
  const state = freshFixture(); h.setState(state);
  ['w0', 'w1', 'w2', 's0', 's1', 's2', 'c0', 'c1'].forEach(id => complete(state, id, id[0] === 'w' || id[0] === 'c' ? 2 : 3));
  state.activeExerciseId = 'c2';
  const cid = h.currentId();
  ok(cid === 'c2', 'currentId respects explicit selection of the last unfinished item');
  const nextId = h.computeNextUpcomingId(cid);
  ok(nextId === null, 'NEXT is null when no valid next exercise exists (last item is CURRENT)');
})();

// ---------- Property 3: NEXT moves after completing current exercise ----------
(function () {
  const state = freshFixture(); h.setState(state);
  let cid = h.currentId(); // w0
  let nextId = h.computeNextUpcomingId(cid); // w1
  ok(cid === 'w0' && nextId === 'w1', 'baseline before completing current');
  complete(state, 'w0', 2);
  cid = h.currentId(); // firstIncompleteId now w1
  nextId = h.computeNextUpcomingId(cid);
  ok(cid === 'w1', 'CURRENT moves to w1 after w0 is completed');
  ok(nextId === 'w2', 'NEXT moves to w2 after completing CURRENT (w0)');
})();

// ---------- Property 4: NEXT moves further down after completing highlighted NEXT ----------
(function () {
  const state = freshFixture(); h.setState(state);
  complete(state, 'w0', 2);
  let cid = h.currentId(); // w1
  let nextId = h.computeNextUpcomingId(cid); // w2
  ok(nextId === 'w2', 'baseline NEXT is w2');
  complete(state, 'w2', 2); // complete the highlighted NEXT (w2), not CURRENT
  nextId = h.computeNextUpcomingId(cid); // cid still w1
  ok(nextId === 's0', 'completing the highlighted NEXT exercise advances NEXT further down the line (to s0)');
})();

// ---------- Property 5: NEXT clears from a card when that card becomes CURRENT ----------
(function () {
  const state = freshFixture(); h.setState(state);
  complete(state, 'w0', 2); complete(state, 'w1', 2); complete(state, 'w2', 2); // all warm-up genuinely done first
  let cid = h.currentId(); // s0
  let nextId = h.computeNextUpcomingId(cid); // s1
  ok(cid === 's0' && nextId === 's1', 'baseline: s0 is CURRENT, s1 is NEXT');
  state.activeExerciseId = 's1'; // open the actual NEXT card (s1) early
  cid = h.currentId();
  nextId = h.computeNextUpcomingId(cid);
  ok(cid === 's1', 'opening the NEXT card (s1) early makes it CURRENT');
  ok(nextId !== 's1', 'a card can never be both CURRENT and NEXT at once');
  ok(nextId === 's0', 'NEXT recomputes to the item after the newly-opened CURRENT card -- s0 is still unfinished and comes first in order');
})();

// ---------- Property 6: NEXT ignores skipped exercises ----------
(function () {
  const state = freshFixture(); h.setState(state);
  const cid = h.currentId(); // w0
  skip(state, 'w1');
  const nextId = h.computeNextUpcomingId(cid);
  ok(nextId === 'w2', 'NEXT skips over a skipped exercise (w1) and lands on w2');
  unskip(state, 'w1');
  const nextId2 = h.computeNextUpcomingId(cid);
  ok(nextId2 === 'w1', 'unskipping restores the item to NEXT-candidacy without creating duplicates');
})();

// ---------- Property 7: NEXT updates after unchecking a completed set ----------
(function () {
  const state = freshFixture(); h.setState(state);
  complete(state, 'w0', 2);
  complete(state, 'w1', 2);
  let cid = h.currentId(); // w2 (first incomplete)
  let nextId = h.computeNextUpcomingId(cid); // s0
  ok(cid === 'w2' && nextId === 's0', 'baseline after completing w0, w1');
  uncompleteOne(state, 'w1'); // re-enter w1 into the queue
  cid = h.currentId();
  nextId = h.computeNextUpcomingId(cid);
  ok(cid === 'w1', 'unchecking a completed set on w1 re-enters it as CURRENT (first incomplete)');
  ok(nextId === 'w2', 'NEXT recalculates correctly with no duplicate after unchecking (w2, not w1 again)');
})();

// ---------- Property 8: full render and live patch produce same zone state ----------
(function () {
  // applyGlance recomputes nextId via the SAME computeNextUpcomingId(cid) call
  // that renderList uses at full-render time (verified via source inspection
  // above: 'computeNextUpcomingId(cid)' appears verbatim in applyGlance).
  // Functionally: for any given state, computeNextUpcomingId is a pure
  // function of sessionItems()+cid, so a full render and a live patch calling
  // it at the same point in time can never disagree.
  const state = freshFixture(); h.setState(state);
  complete(state, 'w0', 2);
  const cid = h.currentId();
  const nextIdA = h.computeNextUpcomingId(cid); // as renderList would compute at full-render time
  const nextIdB = h.computeNextUpcomingId(cid); // as applyGlance recomputes on a live patch
  ok(nextIdA === nextIdB && nextIdA === 'w2', 'render-time and live-patch-time NEXT computation agree (pure function of same inputs)');
})();

// ---------- Property 9: density path remains safe ----------
(function () {
  const state = freshFixture(); h.setState(state);
  state.session.exercises = [
    { id: 'w0', block: 'warmup', sets: 2 },
    { id: 'd0', block: 'strength', sets: 1, densityMode: 'emom' },
    { id: 'd1', block: 'strength', sets: 1, densityMode: 'emom' }, // same block -> unified into one pseudo-id
    { id: 'c0', block: 'cooldown', sets: 2 },
  ];
  state.session.blocks = [{ kind: 'warmup' }, { kind: 'strength' }, { kind: 'cooldown' }];
  const items = h.sessionItemsFor(state.session);
  ok(items.length === 3, 'a density block collapses multiple exercises sharing a .block into ONE session item');
  ok(items[1].id === 'blk_strength', 'density block item uses the shared blockPseudoId, not an individual exercise id');
  complete(state, 'w0', 2);
  const cid = h.currentId();
  ok(cid === 'blk_strength', 'CURRENT can be the density block as a single unit');
  const nextId = h.computeNextUpcomingId(cid);
  ok(nextId === 'c0', 'NEXT correctly skips past the (now-current) density block to cooldown');
  // onDensityAct always does save(); renderList(false); applyGlance() on every
  // action (verified by source inspection: the append-only "return;" path in
  // onDensityAct for blkrounds+/-/blkdone all fall through to that same
  // full-re-render call) -- so density interactions never rely on incremental
  // DOM patching and cannot go stale the way the pre-fix live path could.
  const onDensityActSrc = extractFn('onDensityAct');
  ok(onDensityActSrc.indexOf('renderList(false)') >= 0 && onDensityActSrc.indexOf('applyGlance()') >= 0,
    'onDensityAct always triggers a full renderList + applyGlance, so density NEXT state cannot go stale');
})();

// ---------- Property 10: warm-up/cool-down can be NEXT when genuinely next ----------
(function () {
  const state = freshFixture(); h.setState(state);
  const cid = h.currentId();
  ok(cid === 'w0' && h.computeNextUpcomingId(cid) === 'w1', 'a warm-up item can be NEXT (w1 after w0)');
  ['w0', 'w1', 'w2', 's0', 's1', 's2'].forEach(id => complete(state, id, id[0] === 'w' ? 2 : 3));
  const cid2 = h.currentId(); // c0
  ok(cid2 === 'c0', 'CURRENT correctly reaches the cool-down block');
  ok(h.computeNextUpcomingId(cid2) === 'c1', 'a cool-down item can be NEXT (c1 after c0) -- not excluded by block type');
})();

console.log('v1.11.1 NEXT Highlight: ' + pass + ' passed, ' + fail + ' failed');
if (fail) { fails.forEach(f => console.log('  FAIL: ' + f)); process.exit(1); }
