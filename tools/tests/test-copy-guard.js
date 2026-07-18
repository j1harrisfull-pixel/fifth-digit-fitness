// v1.10 Human Feel -- Ticket 1: whole-app rendered-copy guard.
//
// v1.10 Ticket 1 Platinum Pre-Commit Fix Pass: rebuilt to scan only KNOWN
// RENDERED SURFACES, not the whole file. The previous version stripped
// comments from the entire ~10,000-line source in one pass; a stray
// apostrophe inside an early comment ("it's", "don't") could desync that
// naive tokenizer's string-boundary tracking for everything after it,
// which is fragile and not something to commit. This version instead:
//
//   1. Extracts each function/markup block that actually produces
//      user-visible text (renderHomeHero, renderWeekList, renderDayBar,
//      showSessionComplete/finish, the static preview-banner markup, the
//      static confirm-sheet markup, and every toast(...) call's literal
//      argument) via the SAME brace-matching extractFn() helper every
//      other file in this directory already uses.
//   2. Strips comments only WITHIN each small, bounded extract -- a few KB
//      at most, not the whole file -- so a comment-embedded apostrophe can
//      only ever desync that one surface's own scan, never bleed into an
//      unrelated part of the app. Any desync is now trivially auditable by
//      hand (grep the one surface), which was the whole problem before.
//   3. The coach-span (exercise-library cue/setup text + every coach-engine
//      identifier) is never touched -- it's not one of the surfaces above,
//      so it's excluded by construction, not by a blind file-wide strip.
//
// Rejected copy found rendered on any of these surfaces FAILS the guard.
// There is no broad allowlist: EXPECTED_SOURCE_ONLY below only ever exists
// for occurrences already manually verified (via the exact-context match
// required to qualify) to be genuinely non-rendered -- an internal JS
// identifier or a deliberately different-meaning phrase -- never a way to
// silence real rendered rejected copy.
const fs = require('fs');
const { execFileSync } = require('child_process');
const INDEX_PATH = '/Users/jamesharris/Desktop/training-log-app/index.html';
const SRC = fs.readFileSync(INDEX_PATH, 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 0. Coach-span untouched (this ticket must not touch it) ----------
// execFileSync (argument array, no shell string built from concatenation)
// instead of execSync/exec -- avoids shell-interpolation risk even though
// INDEX_PATH here is a fixed constant, not user input.
const spanMd5 = execFileSync('sh', ['-c', `sed -n '/__COACH_START__/,/__COACH_END__/p' '${INDEX_PATH}' | md5`]).toString().trim();
ok(spanMd5 === '1081700e58396438a0b408febcfdc56b', 'coach-span md5 unchanged (1081700e58396438a0b408febcfdc56b), got ' + spanMd5);

// ---------- 1. Extraction helpers (same brace-matching pattern as every
// other test file in this directory) ----------
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
// Bounded comment-stripper -- applied only to a single extracted surface
// (a few KB), never the whole file. Same char-by-char approach as before,
// but the blast radius of any tokenizer desync is now one named surface,
// checkable by eye in seconds, not the entire app.
function stripComments(src) {
  let out = '', i = 0, inStr = null, prev = '';
  while (i < src.length) {
    const c = src[i], nx = src[i + 1];
    if (inStr) {
      out += c;
      if (c === inStr && prev !== '\\') inStr = null;
      prev = c; i++; continue;
    }
    if (c === '/' && nx === '/') { const nl = src.indexOf('\n', i); i = nl < 0 ? src.length : nl; continue; }
    if (c === '/' && nx === '*') { const end = src.indexOf('*/', i + 2); i = end < 0 ? src.length : end + 2; continue; }
    if (c === '"' || c === "'" || c === '`') { inStr = c; out += c; prev = c; i++; continue; }
    out += c; prev = c; i++;
  }
  return out;
}

// ---------- 2. Known rendered surfaces ----------
const renderHomeHeroBody = stripComments(extractFn('renderHomeHero'));
const renderWeekListBody = stripComments(extractFn('renderWeekList'));
const renderDayBarBody = stripComments(extractFn('renderDayBar'));
const showSessionCompleteBody = stripComments(extractFn('showSessionComplete'));
const trainThisTodayClickBody = stripComments(extractFn('trainThisTodayClick'));
// v1.10 Ticket 4: the live workout screen's per-exercise card builder --
// covers the DONE/CURRENT/NEXT zone grammar ("N sets kept", "Set N of M")
// and every other exercise-name/prescription string this function renders.
// buildDensityCard is its own function (density blocks render separately)
// and is extracted too, though it renders no new Ticket 4 copy itself.
const buildCardBody = stripComments(extractFn('buildCard'));
const buildDensityCardBody = stripComments(extractFn('buildDensityCard'));

// Static markup blocks (not JS functions) -- extracted by fixed anchors,
// same "slice between two known markers" style already used elsewhere in
// this suite (e.g. test-v1_8-tempo-home.js's tempoCssPlaceholder()).
function staticBlock(startNeedle, endNeedle) {
  const s = SRC.indexOf(startNeedle);
  const e = SRC.indexOf(endNeedle, s);
  ok(s >= 0 && e > s, 'static block located: "' + startNeedle + '" .. "' + endNeedle + '"');
  return s >= 0 && e > s ? SRC.slice(s, e) : '';
}
const previewBannerMarkup = staticBlock('<div class="daypreview-banner view-day" id="dayPreviewBanner"', '</dialog>');
const confirmSheetMarkup = staticBlock('<dialog class="sheet" id="confirmSheet"', '</dialog>');

// Every toast(...) call's literal string argument, wherever it appears in
// the file -- covers both bare toast("...") and toast("..." + dynamicPart)
// calls (only the literal portion is captured; dynamic values can't carry
// rejected words since they're never author-written copy).
const toastLiterals = [];
const toastRe = /toast(?:Undo)?\(\s*"((?:[^"\\]|\\.)*)"/g;
let tm;
while ((tm = toastRe.exec(SRC))) toastLiterals.push(tm[1]);
const toastCorpus = toastLiterals.join('\n');

const RENDERED_SURFACES = {
  'renderHomeHero (Home hero, fatigue line, streak stat, memory/reason lines)': renderHomeHeroBody,
  'renderWeekList (week-row annotations)': renderWeekListBody,
  'renderDayBar (day bar, live bar, Train this today button)': renderDayBarBody,
  'showSessionComplete (finish result)': showSessionCompleteBody,
  'buildCard (live workout exercise card: DONE/CURRENT/NEXT zone grammar)': buildCardBody,
  'buildDensityCard (EMOM/AMRAP block card)': buildDensityCardBody,
  'preview banner static markup': previewBannerMarkup,
  'confirm sheet static markup': confirmSheetMarkup,
  'trainThisTodayClick (Train this today confirmation body)': trainThisTodayClickBody,
  'toast()/toastUndo() literal strings (all call sites)': toastCorpus
};

// ---------- 3. Rejected rendered copy ----------
const REJECTED = [
  'ready to go', 'great job', 'nice', 'crushed it', 'recovered', 'fatigued',
  'optimal', 'loading', 'calculating', 'preparing', 'almost there',
  'workout due', 'missed', 'behind', 'training receipt', 'signed off',
  'well done', 'smashed it', 'level up', 'streak', 'readiness score',
  'recovery score'
];

// Explicit, documented source-only exceptions -- each requires an EXACT
// surrounding-context match (not just the bare word) to qualify, so this
// list can never silently swallow a genuinely new rendered occurrence of a
// rejected word appearing in a different context.
const EXPECTED_SOURCE_ONLY = [
  {
    phrase: 'loading', surface: 'toast()/toastUndo() literal strings (all call sites)',
    context: 'Updated in another tab',
    note: 'a real, honest, one-time toast -- another tab actually saved newer data, so this tab genuinely reloads. Not a fake spinner/loading state.'
  }
];

const rejectedFindings = [];
Object.keys(RENDERED_SURFACES).forEach(function (surfaceName) {
  const corpus = RENDERED_SURFACES[surfaceName];
  REJECTED.forEach(function (phrase) {
    const re = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    let m; const hits = [];
    while ((m = re.exec(corpus))) {
      const ctx = corpus.slice(Math.max(0, m.index - 30), m.index + phrase.length + 15).replace(/\s+/g, ' ').trim();
      const allowed = EXPECTED_SOURCE_ONLY.some(function (x) {
        return x.phrase === phrase.toLowerCase() && x.surface === surfaceName && ctx.indexOf(x.context) !== -1;
      });
      if (!allowed) hits.push(ctx);
    }
    ok(hits.length === 0, 'rejected rendered copy absent from ' + surfaceName + ': "' + phrase + '"' + (hits.length ? ' -- found: ' + hits.slice(0, 3).join(' | ') : ''));
    if (hits.length) rejectedFindings.push({ surface: surfaceName, phrase: phrase, hits: hits });
  });
});

// ---------- 4. Protected copy present where applicable ----------
const PROTECTED = [
  'Nothing logged. Left as is.',
  'Work logged.',
  'Enough for today.',
  'The rest of the week stays where it is.',
  'Start the session',
  'Finish'
];
PROTECTED.forEach(function (phrase) {
  ok(SRC.indexOf(phrase) !== -1, 'protected copy present: "' + phrase + '"');
});
// "Nothing starts until you press Start." is approved-territory copy but is
// deliberately NOT yet rendered -- adding it is a Home-hero layout decision
// (a new line/element), out of scope for a copy-only foundations ticket.
// Reported here honestly rather than forced in to pass a test.
ok(SRC.indexOf('Nothing starts until you press Start.') === -1,
   'note (not a failure): "Nothing starts until you press Start." intentionally deferred to Ticket 2 (Home hero layout decision)');

// ---------- 5. Specific v1.10 Ticket 1 copy proofs ----------
ok(SRC.indexOf('Recovered · ready to train') === -1, 'old fatigue line "Recovered · ready to train" is gone');
ok(SRC.indexOf('Nothing in the way today.') !== -1, 'clear-band fatigue line present: "Nothing in the way today."');
ok(SRC.indexOf('Move well. Log clean work.') !== -1, 'amber-band fatigue line present: "Move well. Log clean work."');
ok(SRC.indexOf('Recent sessions ran hard. Keep today clean.') !== -1, 'red-band fatigue line present: "Recent sessions ran hard. Keep today clean."');
// The three bands must render three DISTINCT strings, not two collapsed
// into one -- assert directly against the ternary construction.
ok(/var readingTxt = band === "red" \? "Recent sessions ran hard\. Keep today clean\."\s*\n\s*: band === "amber" \? "Move well\. Log clean work\."\s*\n\s*: "Nothing in the way today\.";/.test(SRC),
   'all three fatigue bands (red/amber/clear) render three distinct approved sentences, not a collapsed pair');

ok(SRC.indexOf('Best week streak') === -1, 'old "Best week streak" label is gone');
// "Longest run of full weeks" (the renamed streak stat) lived in the
// Progress tab's lifetime-stats block, removed 18 July 2026 along with the
// tab itself -- both the label and computeLifetimeStats() are gone now.

// 13 July 2026: "closed" (a generic status word) was cut -- research across
// Hevy/Strong/Fitbod/Future found none of them label a done day with a
// status word. The checkmark badge itself is still present, unlabeled.
ok(/weekrow__anno--done" aria-label="done">/.test(RENDERED_SURFACES['renderWeekList (week-row annotations)']), 'week-row done-state checkmark badge present (no visible status word)');
ok(SRC.indexOf('CLOSED</span>') === -1, 'old uppercase "CLOSED</span>" tag is gone');
ok(SRC.indexOf('READY</span>') === -1, 'old uppercase "READY</span>" tag is gone');
ok(SRC.indexOf('SKIPPED</span>') === -1, 'old uppercase "SKIPPED</span>" tag is gone');
ok(!/BANKED ·/.test(RENDERED_SURFACES['renderWeekList (week-row annotations)']), 'old uppercase "BANKED ·" wording is gone from rendered week-row output');
ok(/banked · " \+ bk\.setsDone \+ " set/.test(RENDERED_SURFACES['renderWeekList (week-row annotations)']),
   'week-row "banked · N sets" annotation present, driven by bk.setsDone (true completed-set count, unit-honesty preserved)');
// 13 July 2026: "planned" (a generic status word) was cut entirely -- a
// future row shows no status annotation, just the session name/focus already
// rendered in weekrow__main (research-backed, see the "closed" note above).
ok(SRC.indexOf('weekrow__anno">planned</span>') === -1, 'old "planned" annotation is gone');
ok(/weekrow__anno">set aside<\/span>/.test(RENDERED_SURFACES['renderWeekList (week-row annotations)']), 'week-row "set aside" annotation present');
ok(/weekrow__tag--today">Today<\/span>/.test(RENDERED_SURFACES['renderWeekList (week-row annotations)']), 'week-row "Today" scheduling marker still present (unchanged, own axis, not part of the completion-state annotation set)');

ok(SRC.indexOf('Planned for later. Nothing logs from here.') !== -1, 'preview banner copy present: "Planned for later. Nothing logs from here."');
ok(SRC.indexOf('PREVIEW · Planned for later.') === -1, 'old "PREVIEW ·" enum-prefixed banner copy is gone');

ok(/"You chose " \+ name \+ " for today\.\\nThe rest of the week stays where it is\."/.test(RENDERED_SURFACES['renderHomeHero (Home hero, fatigue line, streak stat, memory/reason lines)']),
   'chosen-today Home body present: "You chose <Session name> for today. / The rest of the week stays where it is."');

ok(toastLiterals.indexOf('Session restored.') !== -1, 'toast copy present: "Session restored." (both undo call sites)');
ok(SRC.indexOf(' loaded.') !== -1 && SRC.indexOf('state.program.title + " loaded."') !== -1, 'toast copy present: "<title> loaded." (real program title kept)');
ok(toastLiterals.indexOf('Plan erased.') !== -1, 'toast copy present: "Plan erased."');
ok(toastLiterals.indexOf('Restored') === -1 && toastLiterals.indexOf('Erased') === -1, 'old bare-fragment toasts ("Restored"/"Erased") are gone');

// ---------- 6. Dead CSS removed, annotation style clean and scoped ----------
ok(SRC.indexOf('.weekrow__tag--done ') === -1 && SRC.indexOf('.weekrow__tag--done{') === -1 && !/\.weekrow__tag--done\s*\{/.test(SRC),
   'dead selector .weekrow__tag--done removed');
ok(!/\.weekrow__tag--finished\s*\{/.test(SRC), 'dead selector .weekrow__tag--finished removed');
ok(!/\.weekrow__tag--prog\s*\{/.test(SRC), 'dead selector .weekrow__tag--prog removed');
ok(!/\.weekrow__tag--skipped\s*\{/.test(SRC), 'dead selector .weekrow__tag--skipped removed');
ok(!/\.weekrow__tag--pending\s*\{/.test(SRC), 'dead selector .weekrow__tag--pending removed');
// Still-used tag classes must be kept (they render "Today"/"Alt" markers).
ok(/\.weekrow__tag--alt\s*\{/.test(SRC), '.weekrow__tag--alt kept (still rendered: swapped-in alternate session marker)');
ok(/\.weekrow__tag--today\s*\{/.test(SRC), '.weekrow__tag--today kept (still rendered: scheduled-today marker)');
ok(SRC.indexOf('weekrow__tag--alt') > 0 && new RegExp('class="weekrow__tag weekrow__tag--alt"').test(SRC), '.weekrow__tag--alt is referenced by rendered markup');
ok(new RegExp('class="weekrow__tag weekrow__tag--today"').test(SRC), '.weekrow__tag--today is referenced by rendered markup');

const annoCssMatch = SRC.match(/\.weekrow__anno \{[^}]*\}/);
ok(!!annoCssMatch, '.weekrow__anno CSS rule located');
const annoCss = annoCssMatch ? annoCssMatch[0] : '';
ok(/background:\s*none/.test(annoCss), '.weekrow__anno has no bright fill (background: none)');
ok(!/var\(--(tempo-)?clay/.test(annoCss), '.weekrow__anno does not use clay');
ok(!/var\(--(tempo-)?brass/.test(annoCss), '.weekrow__anno does not use brass');
// Scoping: .weekrow__anno must only be used inside renderWeekList (week
// rows) plus its own CSS rule definitions -- nowhere else in the app.
const weekListFnMatch = SRC.match(/function renderWeekList\(\) \{[\s\S]*?\n  \}\n  \/\/ Delete the day/);
const outsideWeekList = SRC.replace(weekListFnMatch ? weekListFnMatch[0] : '', '');
const annoUsesOutsideWeekList = (outsideWeekList.match(/weekrow__anno/g) || []).length;
ok(annoUsesOutsideWeekList <= 3, // the 3 CSS rule definitions themselves (.weekrow__anno, .weekrow__anno--done, plus the comment mentioning the class name)
   '.weekrow__anno is not used anywhere outside week-row rendering + its own CSS rules (scoped to week rows only, per v1.10 approval) -- found ' + annoUsesOutsideWeekList + ' references outside renderWeekList');

// ---------- 7. v1.10 Ticket 2 (Home / Weekly Surface) copy + honesty proofs ----------
const heroBody = RENDERED_SURFACES['renderHomeHero (Home hero, fatigue line, streak stat, memory/reason lines)'];

// Normal training day: eyebrow renamed "Up next" -> "Today's work".
ok(/label2 = weekDone \? \(weekFullyComplete \? "Week complete" : "Week wrapped"\) : \(todayPicked \? "Chosen today" : "Today's work"\)/.test(heroBody),
   'Home normal-day eyebrow renders "Today\'s work" (was "Up next")');
ok(!/"Up next"/.test(heroBody), 'old "Up next" eyebrow string is gone from renderHomeHero');

// Chosen-today body (re-asserted here alongside the rest of Ticket 2's proofs;
// unchanged from Ticket 1, see section 5 above for the original assertion).
ok(/"You chose " \+ name \+ " for today\.\\nThe rest of the week stays where it is\."/.test(heroBody),
   'Home chosen-today body still present, unchanged by Ticket 2');

// Finished/banked ("win") state: sentence-shaped, no praise/gamified copy.
ok(/Done for today\.<br><b>/.test(heroBody), 'Home finished/banked state renders "Done for today." sentence');
ok(/is banked\. /.test(heroBody), 'Home finished/banked state renders "<Session> is banked."');
ok(/" set kept\."/.test(heroBody) && /" sets kept\."/.test(heroBody), 'Home finished/banked state renders unit-honest "N set(s) kept."');
ok(!/Done today ·/.test(heroBody), 'old middot-fragment "Done today · X · Nth of M done this week" win line is gone');
['great job', 'well done', 'crushed it', 'smashed it', 'level up', 'signed off', 'training receipt'].forEach(function (phrase) {
  ok(heroBody.toLowerCase().indexOf(phrase) === -1, 'Home finished/banked state does not render praise phrase: "' + phrase + '"');
});

// Fresh install: record-led copy, not a sales pitch.
ok(SRC.indexOf('This becomes your training log.') !== -1, 'fresh-install copy present: "This becomes your training log."');
ok(SRC.indexOf('Build the first week.') !== -1, 'fresh-install copy present: "Build the first week."');

// Week recap: dashboard stat boxes replaced with one real-data ledger sentence.
ok(/recapSentence = recap\.sessionsDone \+ " of " \+ recap\.sessionsTotal/.test(heroBody), 'Home week recap built from computeWeekRecap()\'s real sessionsDone/sessionsTotal (unit-honest)');
ok(/recap\.totalSets \+ \(recap\.totalSets === 1 \? " set" : " sets"\) \+ " kept\."/.test(heroBody), 'Home week recap renders real totalSets as "N sets kept." (unit-honest)');
ok(!/class="recap-stats">/.test(heroBody), 'Home week recap no longer renders the boxed .recap-stats dashboard markup (still used, unchanged, by the History sheet elsewhere)');
ok(!/Sets logged/.test(heroBody), 'old "Sets logged" stat-box label is gone from Home');
ok(heroBody.toLowerCase().indexOf('streak') === -1, 'Home renders no "streak" language anywhere (recap or otherwise)');

// No new persisted state / no new data shape: renderHomeHero and
// renderWeekList only ever READ state.todayPick, state.log, state.archive,
// state.program -- confirm no new state.* write was introduced by this ticket.
ok(!/state\.\w+\s*=/.test(heroBody.replace(/state\.todayPick/g, '')) || !/state\.(?!todayPick)\w+\s*=(?!=)/.test(heroBody),
   'renderHomeHero introduces no new state.* writes (display-layer only)');
ok(!/state\.\w+\s*=(?!=)/.test(RENDERED_SURFACES['renderWeekList (week-row annotations)']),
   'renderWeekList introduces no new state.* writes (display-layer only)');

// ---------- 8. v1.10 Ticket 3 (Preview + Train This Today polish) proofs ----------
const trainBody = RENDERED_SURFACES['trainThisTodayClick (Train this today confirmation body)'];

// Locked confirmation body: "<Session>\nbecomes today's work.\n\nThe rest
// of the week stays where it is." -- built from ses.name, not a hardcoded
// session name, so it is honest for every session.
ok(/var body = ses\.name \+ "\\nbecomes today's work\.\\n\\nThe rest of the week stays where it is\."/.test(trainBody),
   'Train this today confirmation body is the exact locked copy, built from the real session name');
ok(!/This becomes today's session\. Sets you log count for today\./.test(trainBody),
   'old, longer confirmation body wording is gone');
// The "already-banked armed session" disclosure was removed on review: log
// data is keyed per-session-id and is never touched by which session is
// armed, so the disclosure described a risk that never existed -- an extra
// caveat for a non-risk reads as permissions-dialog hedging. Confirm it is
// gone and no longer references armedSessionIdx/hasRealWork.
ok(!/Today already has work banked on/.test(trainBody),
   'the already-banked-session disclosure line has been removed (described a non-existent risk)');
ok(!/armedSessionIdx\(wk\)/.test(trainBody) && !/hasRealWork\(armedSes\)/.test(trainBody),
   'trainThisTodayClick no longer computes an armed-session disclosure at all (dead code removed, not just hidden)');

// Confirm sheet title/labels: exact locked strings (title question form,
// primary/secondary labels), unchanged from Ticket 2's askConfirm call.
ok(/title: "Train this today\?"/.test(trainBody), 'confirm sheet title is exactly "Train this today?"');
ok(/confirmLabel: "Train this today"/.test(trainBody), 'confirm sheet primary label is exactly "Train this today"');
ok(/cancelLabel: "Keep it as preview"/.test(trainBody), 'confirm sheet secondary label is exactly "Keep it as preview"');
ok(/danger: false/.test(trainBody), 'Train this today confirmation stays non-destructive (danger: false) -- no icon, no danger-red button');

// Title colour must now respect the danger flag instead of being hardcoded
// red for every confirm dialog (the core "warning dialog" defect this
// ticket fixes) -- verify both the CSS modifier and the JS toggle exist.
ok(/\.confirm__title\.is-calm\s*\{\s*color:\s*var\(--ink\);\s*\}/.test(SRC),
   '.confirm__title.is-calm CSS rule exists (calm ink colour for non-destructive confirms)');
ok(/titleEl\.classList\.toggle\("is-calm", !danger\)/.test(SRC),
   'askConfirm toggles the is-calm class from the same danger flag that already drives the icon/button');
ok(/white-space:\s*pre-line/.test(SRC.match(/\.confirm__msg \{[^}]*\}/)[0]),
   '.confirm__msg supports pre-line so the locked multi-line body actually renders as separate lines');

// Preview banner unchanged (Ticket 1 lock, re-asserted here since this
// ticket explicitly reviewed it): still the calm one-line hairline banner,
// no PREVIEW watermark, no icon, no alert colour class introduced.
ok(SRC.indexOf('Planned for later. Nothing logs from here.') !== -1, 'preview banner copy unchanged: "Planned for later. Nothing logs from here."');
ok(!/daypreview-banner[^{]*\{[^}]*(amber|warning|--danger)/i.test(SRC), 'preview banner CSS introduces no alert/warning colour');

// ---------- 9. v1.10 Ticket 4 (live workout DONE/CURRENT/NEXT zone grammar) ----------
// "Set N of M" -- built from the exact same doneCount/total buildCard
// already computes for setshead/collapsedMeta, never a separate/fake count.
// Strength-only, suppressed once complete.
ok(/setPosHtml = \(e\.type === "strength" && total > 0 && !complete\)/.test(buildCardBody),
   '"Set N of M" is strength-only and suppressed once the exercise is complete (never rendered for density/mobility)');
ok(/'<p class="card__setpos">Set <b>' \+ \(doneCount \+ 1\) \+ '<\/b> of <b>' \+ total \+ '<\/b><\/p>'/.test(buildCardBody),
   '"Set N of M" is built from the real doneCount/total, not a separate counter');

// DONE grammar: "N sets kept" -- same real doneCount, approved wording.
ok(/collapsedMeta = complete \? \(doneCount \+ \(doneCount === 1 \? " set kept" : " sets kept"\)\) : planHint/.test(buildCardBody),
   'DONE-state collapsed row renders "N sets kept" (or "1 set kept"), built from the real completed-set count');
ok(!/doneCount \+ "\/" \+ total \+ " sets"/.test(buildCardBody), 'old "N/total sets" collapsed-row grammar is gone from buildCard');
ok(/refreshSetPos\(card, e, doneCount\)/.test(SRC), 'the live (non-full-render) set-toggle path keeps "Set N of M" in sync via refreshSetPos, never leaving it stale');

// NEXT: exactly one exercise ever gets the up-next treatment, computed from
// the same real sessionItems() doneCount/sets every other progress read uses.
ok(/function computeNextUpcomingId\(cid\)/.test(SRC), 'computeNextUpcomingId helper exists');
ok(/it\.sets > 0 && \(it\.doneCount \|\| 0\) < it\.sets && it\.id !== cid/.test(SRC),
   'NEXT is the first real incomplete item (real sets/doneCount), excluding CURRENT -- never a fake/separate list');
ok(/isUpNext \? " is-up-next" : ""/.test(buildCardBody), 'exactly the one computed NEXT id gets the is-up-next class on its card');

// Rejected-copy sweep already covers buildCard/buildDensityCard via
// RENDERED_SURFACES above; explicitly confirm the DONE/NEXT grammar itself
// contains none of the rejected words.
['ready to go', 'great job', 'crushed it', 'smashed it', 'well done', 'level up', 'streak', 'missed', 'behind', 'workout due'].forEach(function (phrase) {
  ok(buildCardBody.toLowerCase().indexOf(phrase) === -1, 'buildCard renders no rejected phrase: "' + phrase + '"');
});

// Protected: clay stays reserved for the LOG action -- buildCard/
// buildDensityCard (the DONE/CURRENT/NEXT card chrome) must never introduce
// a clay reference; the moss token must appear in exactly the two approved
// declarations (CURRENT label colour + CURRENT left rule), never a third.
ok(!/tempo-clay/.test(buildCardBody) && !/tempo-clay/.test(buildDensityCardBody), 'buildCard/buildDensityCard reference no clay token (clay stays LOG-button-only)');
const mossDeclarations = (SRC.match(/var\(--tempo-moss\)/g) || []).length;
ok(mossDeclarations === 2, '--tempo-moss is used in exactly 2 CSS declarations (CURRENT overline colour + CURRENT left rule), got ' + mossDeclarations);

// v1.10 Ticket 4 audit fix (approved): literal DONE/CURRENT/NEXT/THEN zone
// words, not colour alone -- required after the platinum-gate rejection of
// the first pass. Computed per-card from the exact same complete/isUpNext
// flags already asserted above; no separate/fake list, no cross-card state.
ok(/var zoneWord = complete \? "Done" : isUpNext \? "Next" : "Then"/.test(buildCardBody),
   'buildCard computes the literal zone word (Done/Next/Then) from the exact same complete/isUpNext flags used elsewhere');
ok(/'<p class="card__zonelabel card__zonelabel--current">Current<\/p>'/.test(buildCardBody),
   'the expanded CURRENT card renders the literal word "Current"');
ok(/var zoneWordD = done \? "Done" : isUpNextD \? "Next" : "Then"/.test(buildDensityCardBody),
   'buildDensityCard computes the same literal zone word from its own done/isUpNextD flags (density blocks get the same zone system as strength exercises)');
ok(/'<p class="card__zonelabel card__zonelabel--current">Current<\/p>'/.test(buildDensityCardBody),
   'the expanded CURRENT density card renders the literal word "Current"');
ok(/\.card__zonelabel--current \{ color: var\(--tempo-moss/.test(SRC), '.card__zonelabel--current is moss-coloured');
ok(/\.card__zonelabel--next \{ color: var\(--tempo-brass/.test(SRC), '.card__zonelabel--next is brass-coloured');

// ---------- 10. v1.10 Ticket 5 (THE PAGE finish signature moment) proofs ----------
// Spoken line: exactly the two protected sentences, chosen by the real
// finishKind (partial vs full/density) -- never a praise headline.
ok(/\$\("completeTitleText"\)\.textContent = finishKind === "partial" \? "Enough for today\." : "Work logged\.";/.test(showSessionCompleteBody),
   'THE PAGE spoken line is exactly "Enough for today." (partial) / "Work logged." (full+density), keyed off the real finishKind');

// Record grammar, not prescription grammar: the kept column is built from
// the best COMPLETED set ("80 kg × 5"), reps/seconds honesty for unloaded
// work, and a plain sets fallback -- never target/planned language.
ok(/roundW\(best\.weight\) \+ " " \+ unit \+ " × " \+ \(best\.reps > 0 \? best\.reps : 1\)/.test(showSessionCompleteBody),
   'ledger kept column uses record grammar "W kg × R" from the best completed set');
ok(/bestReps \+ \(exTimed\(e\.name\) \? " sec" : " reps"\)/.test(showSessionCompleteBody),
   'unloaded work renders honest "N reps" / "N sec" from real logged values');
['target', 'planned', 'prescribed', 'goal'].forEach(function (frag) {
  ok(showSessionCompleteBody.toLowerCase().indexOf('"' + frag) === -1 && showSessionCompleteBody.toLowerCase().indexOf(frag + ' ') === -1,
     'THE PAGE renders no prescription-grammar word: "' + frag + '"');
});

// Closing sentence: real counts only, "kept" grammar, volume omitted when
// meaningless (only pushed when > 0 -- never "0 kg").
ok(/if \(volume > 0\)/.test(showSessionCompleteBody), 'volume line only rendered when > 0 (never "0 kg")');
ok(/" kept"/.test(showSessionCompleteBody), 'closing sentence uses "kept" grammar');

// PR marker: literal "· best yet", only from buildHonestRead's real prs --
// no badges, no colour classes.
ok(/ · best yet/.test(showSessionCompleteBody), '"· best yet" marker present');
ok(/prNames/.test(showSessionCompleteBody) && /buildHonestRead/.test(showSessionCompleteBody),
   '"· best yet" is driven by buildHonestRead PRs, not a separate/fake PR check');

// Rejected copy stays off the page (the RENDERED_SURFACES sweep covers this
// too; assert the receipt-era phrases the ticket names explicitly).
['training receipt', 'signed off', 'work done'].forEach(function (phrase) {
  ok(showSessionCompleteBody.toLowerCase().indexOf(phrase) === -1,
     'THE PAGE renders no retired receipt phrase: "' + phrase + '"');
});

// Zero-logged stays toast-only: the protected toast copy is intact and the
// page is only reached through endSession's hasRealWork gate.
ok(/toast\("Nothing logged\. Left as is\."\);/.test(SRC), 'zero-logged toast copy is exactly "Nothing logged. Left as is."');

// Done exit: quiet "Done." label, mechanics unchanged (closeDlg + backToWeek).
ok(/primaryBtn\.textContent = "Done\.";/.test(showSessionCompleteBody), 'exit action is labelled exactly "Done."');
ok(/closeDlg\(\);[\s\S]{0,60}backToWeek\(\);/.test(showSessionCompleteBody), 'Done keeps the closeDlg + backToWeek mechanics');

// ---------- v1.11 (Warm-Up/Cool-Down): reason-line copy territories ----------
// buildWarmupCooldown lives inside the coach-span (its reason lines flow
// into e.why, rendered later via buildCard's card__why -- already swept by
// the RENDERED_SURFACES pass above). This section additionally proves the
// exact approved territory strings are the ones actually in source, and
// sweeps them plus buildCard against the wider v1.11 rejected list.
function extractObjectLiteral(varName) {
  const at = SRC.indexOf('var ' + varName + ' = {');
  ok(at >= 0, varName + ' object literal located');
  if (at < 0) return '';
  const braceStart = SRC.indexOf('{', at);
  let depth = 0, i = braceStart;
  for (; i < SRC.length; i++) {
    if (SRC[i] === '{') depth++;
    else if (SRC[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return SRC.slice(braceStart, i);
}
const warmReasonBody = extractObjectLiteral('WARM_PREP_REASON');
const coolReasonBody = extractObjectLiteral('COOL_PREP_REASON');
const closerReasonBody = extractObjectLiteral('CLOSER_REASON');
// "Raises the pulse before the work." is passed directly at the pulse-raiser
// call site (not via a lookup dict, since there's only ever one pulse item),
// so it's pulled in by its own line rather than one of the three objects.
const pulseReasonAt = SRC.indexOf('"Raises the pulse before the work."');
const pulseReasonLine = pulseReasonAt >= 0 ? SRC.slice(pulseReasonAt, pulseReasonAt + 40) : '';
const v1_11ReasonCorpus = warmReasonBody + '\n' + coolReasonBody + '\n' + closerReasonBody + '\n' + pulseReasonLine;

const APPROVED_V1_11_LINES = [
  'Raises the pulse before the work.', 'Opens the hips before you load them.',
  'Gets the ankles ready for depth.', 'Brings the shoulders through range first.',
  'Brings the upper back through range first.', 'Wrists first — they carry the bar today.',
  'Lets the hips settle.', 'Lets the ankles settle.', 'Eases what you loaded.',
  'Range back in, slowly.', 'Eases the wrists after the work.',
  'Heart rate down before you go.', 'Let it settle.'
];
APPROVED_V1_11_LINES.forEach(function (line) {
  ok(v1_11ReasonCorpus.indexOf(line) >= 0, 'approved v1.11 reason-line territory present verbatim: "' + line + '"');
});

const REJECTED_V1_11 = [
  'mobility flow', 'activate', 'activation', 'fire up', 'wake up',
  'reset your body', 'breathe into it', 'feel the stretch', 'release',
  'unlock', 'recovery ritual', 'cooldown journey', 'stretch it out',
  'nice and easy', 'listen to your body', 'prime', 'priming'
].concat(REJECTED); // union with the standing rejected-copy list
REJECTED_V1_11.forEach(function (phrase) {
  ok(v1_11ReasonCorpus.toLowerCase().indexOf(phrase.toLowerCase()) === -1,
     'v1.11 reason-line copy renders no rejected phrase: "' + phrase + '"');
  ok(buildCardBody.toLowerCase().indexOf(phrase.toLowerCase()) === -1,
     'buildCard (where warm-up/cool-down reason lines actually render) contains no rejected phrase: "' + phrase + '"');
});

// Skip copy unchanged (locked, no nagging added).
ok(/Skip warm-up|Skip cool-down|Skip this exercise today/.test(buildCardBody) || /card__skip-optional[\s\S]{0,40}Skip /.test(SRC),
   'existing skip copy pattern ("Skip warm-up" / "Skip cool-down" / "Skip this exercise today") is still present, unmodified');
ok(SRC.indexOf('Undo') >= 0, '"Undo" skip-undo copy still present');
// No new Home copy mentioning skipped warm-ups/cool-downs was introduced.
ok(!/skipped warm-?up|skipped cool-?down/i.test(renderHomeHeroBody), 'Home never mentions skipped warm-ups/cool-downs (no surveillance copy)');

console.log(`\n${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('  FAIL:', f)); process.exit(1); }
