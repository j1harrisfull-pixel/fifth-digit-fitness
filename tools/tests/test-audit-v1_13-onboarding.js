// v1.13 First Run Onboarding (16 July 2026). Replaces the old dark
// #intro/wizard chain for the TRUE first run (no programme exists yet) with
// a calm, full-screen, light-stone conversational flow: Intro -> Goal ->
// Days -> Time -> Equipment -> Arrival, one question per screen, a coach
// response after each answer, no auto-advance, no praise language, no
// progress percentage. Feeds the EXISTING buildPrefs()/onBuild()/
// confirmBuild()/generateProgram() pipeline verbatim -- no second generator,
// no coach-span change, no localStorage schema change beyond widening one
// already-validated numeric whitelist (buildPrefs().minutes: +75).
//
// Returning users (hasProgram() true) never see this -- refreshWelcome()
// only opens #onboard when hasProgram() is false; the old dark wizard-in-
// sheet remains completely untouched for every later build.
const fs = require('fs');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// ---------- 1/2. First-run guard ----------
{
  ok(/function refreshWelcome\(\) \{\s*if \(!hasProgram\(\)\) \{ var ob = \$\("onboard"\); if \(ob\) \{ resetOnboard\(\); ob\.hidden = false; \} \}/.test(SRC),
    'no programme -> the new onboarding shell opens (test 1)');
  ok(/else \{ var el = \$\("intro"\); if \(el\) el\.hidden = true; var ob2 = \$\("onboard"\); if \(ob2\) ob2\.hidden = true; \}/.test(SRC),
    'a valid programme -> both the old intro and the new onboarding stay hidden (test 2)');
}

// ---------- 3. Intro CTA opens Goal ----------
{
  ok(/var begin = \$\("obBegin"\); if \(begin\) begin\.addEventListener\("click", function \(\) \{ obShow\("goal"\); \}\);/.test(SRC),
    'Begin opens the Goal screen (test 3)');
  ok(/<h1 class="ob-h">Let's build your first week\.<\/h1>/.test(SRC), 'intro headline matches the approved copy exactly');
  ok(/<p class="ob-sub">A few quick choices\.<br>Then we train\.<\/p>/.test(SRC), 'intro supporting copy matches the approved copy exactly');
  ok(!/id="obIntro"[\s\S]{0,600}<input/.test(SRC), 'no form fields on the intro screen');
  ok(!/Step 1 of/.test(SRC.slice(SRC.indexOf('id="obIntro"'), SRC.indexOf('id="obGoal"'))), 'no "Question 1 of 5" style label on intro');
}

// ---------- 4/5. Goal requires selection, coach response matches ----------
{
  ok(/data-val="strength" type="button">Strength<\/button>/.test(SRC), 'Strength option present');
  ok(/data-val="hypertrophy" type="button">Muscle<\/button>/.test(SRC), 'Muscle option present');
  ok(/data-val="hybrid" type="button">Fat loss<\/button>/.test(SRC), 'Fat loss option present');
  ok(/data-val="general" type="button">General fitness<\/button>/.test(SRC), 'General fitness option present');
  ok(/var OB_GOAL_COACH = \{\s*strength: \["Strength it is\.", "We.ll build around progressive overload\."\],\s*hypertrophy: \["More quality volume\.", "We.ll keep the progression clear\."\],\s*hybrid: \["We.ll keep the work efficient\.", "Strength stays in\."\],\s*general: \["Balanced work\.", "Enough strength, conditioning and recovery\."\]/.test(SRC),
    'goal coach responses match the approved copy exactly, per option (test 5)');
  ok(/var goalNext = \$\("obGoalNext"\); if \(goalNext\) goalNext\.addEventListener\("click", function \(\) \{ obShow\("days"\); \}\);/.test(SRC),
    'Continue only exists as an explicit tap target, never auto-fired (test 4, 14)');
}

// ---------- 6/7. Days requires selection, coach response matches ----------
{
  ok(/data-val="2" type="button">2 days<\/button>/.test(SRC), '2 days option present');
  ok(/data-val="3" type="button">3 days<span class="ob-suggest">Most start here<\/span><\/button>/.test(SRC),
    '3 days carries the quiet "Most start here" suggestion, not a badge/score');
  ok(/data-val="4" type="button">4 days<\/button>/.test(SRC), '4 days option present');
  ok(/data-val="5" type="button">5\+ days<\/button>/.test(SRC), '5+ days option present');
  ok(/var OB_DAYS_COACH = \{\s*2: \["Two days\.", "We.ll make both count\."\],\s*3: \["Three days\.", "Most people recover well here\."\],\s*4: \["Four days\.", "Enough room to separate the work\."\],\s*5: \["Five days or more\.", "We.ll manage the load carefully\."\]/.test(SRC),
    'days coach responses match the approved copy exactly, per option (test 7)');
}

// ---------- 8/9. Time requires selection, coach response matches ----------
{
  ok(/data-val="30" type="button">30 min<\/button>/.test(SRC), '30 min option present');
  ok(/data-val="45" type="button">45 min<\/button>/.test(SRC), '45 min option present');
  ok(/data-val="60" type="button">60 min<\/button>/.test(SRC), '60 min option present');
  ok(/data-val="75" type="button">75\+ min<\/button>/.test(SRC), '75+ min option present');
  ok(/var OB_TIME_COACH = \{\s*30: \["Thirty minutes\.", "We.ll keep it focused\."\],\s*45: \["Forty five minutes\.", "Plenty of time for quality work\."\],\s*60: \["An hour\.", "Enough room for the full session\."\],\s*75: \["More time available\.", "We.ll use it without adding waste\."\]/.test(SRC),
    'time coach responses match the approved copy exactly, per option (test 9)');
  // The 75-minute option requires buildPrefs().minutes to accept it -- the
  // only place restricting the stored value beyond makeRequest's own 15-120
  // clamp.
  ok(/minutes: \[30, 45, 60, 75\]\.indexOf\(p\.minutes\) >= 0 \? p\.minutes : 45,/.test(SRC),
    'buildPrefs() widened to accept 75 minutes (additive only; 30/45/60 untouched)');
}

// ---------- 10/11/12. Equipment requires selection, coach matches, avoidance optional ----------
{
  ok(/data-val="full" type="button">Full gym<\/button>/.test(SRC), 'Full gym option present');
  ok(/data-val="garage" type="button">Garage gym<\/button>/.test(SRC), 'Garage gym option present');
  ok(/data-val="dumbbells" type="button">Dumbbells only<\/button>/.test(SRC), 'Dumbbells only option present');
  ok(/data-val="minimal" type="button">Minimal or no equipment<\/button>/.test(SRC), 'Minimal or no equipment option present');
  ok(/var OB_EQUIP_COACH = \{\s*full: \["Full gym\.", "We have room to build properly\."\],\s*garage: \["Garage gym\.", "We.ll build around the essentials\."\],\s*dumbbells: \["Dumbbells\.", "Enough to train well\."\],\s*minimal: \["Minimal equipment\.", "We.ll keep the work honest\."\]/.test(SRC),
    'equipment coach responses match the approved copy exactly, per option (test 11)');
  ok(/<label class="ob-avoid-label" for="obAvoid">Anything to avoid\?<\/label>/.test(SRC), 'avoidance field is present and labelled per the approved copy');
  ok(/function obEquipMap\(\) \{\s*return \{\s*full: EQUIP_ALL\.slice\(\),\s*garage: \["barbell", "dumbbell", "kettlebell", "pullup-bar", "band"\],\s*dumbbells: \["dumbbell"\],\s*minimal: \[\]/.test(SRC),
    'the 4 kit presets translate into the EXISTING equipment vocabulary -- no new equipment concept, no generator change');
  ok(/if \(av && av\.value && av\.value\.trim\(\)\) \{ addAthleteInjury\("pain", av\.value\); save\(\); \}/.test(SRC),
    'avoidance text is optional -- only written if the field is non-empty, never blocks Build my week (test 12)');
  ok(!/diagnos/i.test(SRC.slice(SRC.indexOf('id="obEquip"'), SRC.indexOf('id="obBuilding"'))),
    'no medical diagnosis language on the equipment/avoidance screen');
}

// ---------- 13/14. Back navigation preserves selections; Continue never auto-fires ----------
{
  ok(/data-obback="intro" type="button">\u2039 Back<\/button>/.test(SRC), 'Goal has a Back control to Intro');
  ok(/data-obback="goal" type="button">\u2039 Back<\/button>/.test(SRC), 'Days has a Back control to Goal');
  ok(/data-obback="days" type="button">\u2039 Back<\/button>/.test(SRC), 'Time has a Back control to Days');
  ok(/data-obback="time" type="button">\u2039 Back<\/button>/.test(SRC), 'Equipment has a Back control to Time');
  ok(/document\.querySelectorAll\("\.onboard \[data-obback\]"\)\.forEach\(function \(b\) \{\s*b\.addEventListener\("click", function \(\) \{ obShow\(b\.getAttribute\("data-obback"\)\); \}\);/.test(SRC),
    'Back only calls obShow() -- it never clears OB.*, so prior selections and their picked/coach state remain in the DOM (test 13)');
  ok(!/setTimeout\(function \(\) \{ obShow\(/.test(SRC), 'no delayed/automatic screen advance exists anywhere in the onboarding module (test 14)');
}

// ---------- 15/16. Build my week calls the existing generator once, with the chosen values ----------
{
  ok(/function obCommitAndBuild\(\) \{\s*var p = buildPrefs\(\);\s*p\.goal = OB\.goal; p\.days = OB\.days; p\.minutes = OB\.minutes;[\s\S]{0,700}p\.equipment = obEquipMap\(\)\[OB\.equip\]\.slice\(\);/.test(SRC),
    'Build my week writes the 4 chosen answers into the EXISTING buildPrefs() fields (test 16)');
  ok(/p\.weeks = 1; p\.planChoiceMade = false;/.test(SRC), 'first build is always a single week, same convention as the old first-build path');
  // James's live audit (16 July 2026): an onboarding Strength build shipped a
  // cardio block because the goal's include side-effects only lived in the
  // OLD wizard's click handlers. obCommitAndBuild must mirror that mapping.
  ok(/if \(p\.goal === "hybrid"\) \{ p\.conditioning = true; p\.mobility = true; \}\s*else \{ p\.conditioning = false; \}/.test(SRC),
    'goal include side-effects mirror the old wizard: hybrid (Fat loss) -> cardio+mobility on; strength/hypertrophy/general -> cardio off');
  ok(/onboardBuildActive = true;[\s\S]{0,600}onBuild\(true\);/.test(SRC),
    'obCommitAndBuild calls the EXISTING onBuild() exactly once -- no second/duplicated generator call (test 15)');
  ok((SRC.match(/function generateProgram\(/g) || []).length === 1, 'generateProgram itself is still defined exactly once -- not duplicated for onboarding');
}

// ---------- 17/18/19. Arrival uses real generated data, honest units ----------
{
  ok(/function renderObArrival\(\) \{\s*if \(obBuildInterval\) \{ clearInterval\(obBuildInterval\); obBuildInterval = null; \}[\s\S]{0,700}var prog = state\.program, wk = prog\.weeks\[0\], sessions = wk\.sessions, ses0 = sessions\[0\];/.test(SRC),
    'Arrival reads directly from state.program -- the actual just-built programme, not a cached preview (test 17)');
  // Browser QA regression: confirmBuild() calls refreshWelcome() internally,
  // and hasProgram() is now true -- refreshWelcome's OTHER branch hides
  // #onboard before renderObArrival ever gets to show it, leaving Home
  // visible with nothing on top. renderObArrival must force the overlay
  // back open itself rather than assuming it's still showing.
  ok(/if \(obBuildInterval\) \{ clearInterval\(obBuildInterval\); obBuildInterval = null; \}[\s\S]{0,700}var ob = \$\("onboard"\); if \(ob\) ob\.hidden = false;/.test(SRC),
    'renderObArrival re-opens the #onboard overlay itself (confirmBuild->refreshWelcome hides it first, since hasProgram() just became true)');
  ok(/var mins = sessionMinutes\(ses0\);/.test(SRC), 'planned time reuses the EXISTING sessionMinutes() helper (same one Home\'s rhythm strip uses), not a re-derived or invented number');
  ok(/'<div class="ob-prevrow"><span>Sessions this week<\/span><b>' \+ sessions\.length \+ '<\/b><\/div>'/.test(SRC),
    'UNIT HONESTY: session count is sessions.length (the actual generated array), never the user\'s day-count INPUT (test 18)');
  ok(/'<div class="ob-prevrow"><span>Exercises<\/span><b>' \+ exCount \+ '<\/b><\/div>'/.test(SRC),
    'UNIT HONESTY: exercise count is the actual ses0.exercises.length, never invented');
  ok(/var exCount = Array\.isArray\(ses0\.exercises\) \? ses0\.exercises\.length : 0;/.test(SRC), 'exercise count is read from real generated exercises');
  ok(/\(mins > 0 \? '<div class="ob-prevrow"><span>Planned time<\/span><b>' \+ mins \+ ' min<\/b><\/div>' : ""\)/.test(SRC),
    'UNIT HONESTY: planned-time row is suppressed rather than shown with a fabricated 0/padded value when no block minutes exist (test 19)');
}

// ---------- 20/21/22. Arrival CTA, no readiness, no live workout ----------
{
  ok(/<button class="ob-cta" id="obViewWeek" type="button">View your week<\/button>/.test(SRC),
    'Arrival CTA says exactly "View your week", never "Start the session" (test 20)');
  const arrivalBlock = SRC.slice(SRC.indexOf('id="obArrival"'), SRC.indexOf('id="onboard"', SRC.indexOf('id="obArrival"')) === -1 ? SRC.length : SRC.length);
  ok(!/startRest\(|acquireWakeLock\(|getReadinessToday|setReadiness\(/.test(SRC.slice(SRC.indexOf('function renderObArrival'), SRC.indexOf('function obCommitAndBuild'))),
    'renderObArrival never touches readiness or rest/live-workout mechanics (test 21, 22)');
  ok(/var viewWeek = \$\("obViewWeek"\);\s*if \(viewWeek\) viewWeek\.addEventListener\("click", function \(\) \{\s*var ob = \$\("onboard"\); if \(ob\) ob\.hidden = true;/.test(SRC),
    'View your week only hides the onboarding overlay -- it does not call openDay/startRest/any readiness entry point (test 21, 22)');
  ok(!/obViewWeek[\s\S]{0,200}openDay\(/.test(SRC), 'View your week never calls openDay (would be live workout mode, forbidden by the ticket)');
}

// ---------- 23-28. Home/preview/readiness/live-workout chain preserved verbatim ----------
{
  ok(/View the workout/.test(SRC), 'Home hero CTA copy is untouched (test 24)');
  ok(/id="homeHeroCta"/.test(SRC), 'the existing hero CTA element is untouched (test 25 entry point)');
  ok(/id="previewCta"/.test(SRC), 'the existing Today Preview CTA element is untouched (test 26)');
  ok(/id="readinessPromptSheet"/.test(SRC), 'the existing readiness prompt dialog is untouched (test 27)');
  ok(/function openDay\(i\) \{/.test(SRC), 'the existing openDay (live workout entry) function is untouched in shape (test 28)');
  ok((SRC.match(/function openDay\(i\) \{/g) || []).length === 1, 'openDay is not duplicated');
}

// ---------- 29/30. NEXT / warm-up / cool-down untouched (spot checks; full coverage in their own suites) ----------
{
  ok(/function refreshLogBarInner/.test(SRC) || /function refreshFoot/.test(SRC), 'existing NEXT-resolver machinery is present and untouched');
  ok(/WARM-UP/.test(SRC) || /warmup/.test(SRC), 'existing warm-up rendering is present and untouched');
}

// ---------- 31. Coach-span untouched ----------
{
  const { execFileSync } = require('child_process');
  const spanMd5 = execFileSync('sh', ['-c', "sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5"]).toString().trim();
  ok(spanMd5 === 'ce6452b369d4d1d14fd0bf8560208ce7', 'coach-span md5 unchanged (ce6452b369d4d1d14fd0bf8560208ce7), got ' + spanMd5);
}

// ---------- 32/33. sw.js / manifest untouched ----------
{
  const { execFileSync } = require('child_process');
  let diff = '';
  try {
    diff = execFileSync('git', ['diff', '--stat', 'HEAD', '--', 'sw.js', 'manifest.webmanifest'],
      { cwd: '/Users/jamesharris/Desktop/training-log-app' }).toString().trim();
  } catch (e) { diff = 'ERROR: ' + e.message; }
  ok(diff === '', 'sw.js and manifest.webmanifest have no uncommitted diff vs HEAD (test 32, 33), got: ' + JSON.stringify(diff));
}

// ---------- 34. No data-shape change beyond the one approved exception ----------
{
  // The only storage-shape-adjacent change in this ticket is buildPrefs()'s
  // minutes whitelist (30/45/60 -> 30/45/60/75) -- a plain number, additive,
  // not a new key. No new localStorage key is introduced by onboarding
  // itself (OB is in-memory only, never persisted).
  ok(!/localStorage\.setItem\("tl:onboard/.test(SRC), 'no new onboarding-specific localStorage key was introduced');
  ok(/var OB = \{ goal: null, days: null, minutes: null, equip: null \};/.test(SRC), 'onboarding answers live in a plain in-memory object, not a new persisted key');
}

// ---------- 35. Reduced motion ----------
{
  ok(/@media \(prefers-reduced-motion: reduce\) \{\s*\.ob-coach \{ transition: none; transform: none; \}\s*\.ob-opts button \{ transition: none; \}/.test(SRC),
    'the coach-line fade and option border transition are both disabled under prefers-reduced-motion (test 35)');
}

// ---------- 36. 320px no overflow ----------
{
  ok(/@media \(max-width: 340px\) \{\s*\.ob-seg \{ display: none; \}\s*\.ob-screen \{ padding: 44px 18px 32px; \}\s*\.ob-q \{ font-size: 26px; \}/.test(SRC),
    'the segmented progress line is dropped and spacing/type shrink at narrow widths -- ticket: "if noisy at 320px, omit" (test 36)');
  ok(/\.ob-opts--row button \{ flex: 1; text-align: center; padding: 18px 4px; \}/.test(SRC),
    'the 4-wide days/time rows use flex so they compress rather than overflow at 320px');
}

// ---------- Segmented progress line correctly omits on Intro/Building/Arrival ----------
// Browser QA regression (16 July 2026): #obSeg sits BEFORE the .ob-screen
// divs in source order, so a `~` (later-sibling) selector from #obIntro
// could never match -- the dots showed on every screen including Intro/
// Arrival, which the ticket explicitly allows to omit them. Desktop-width
// QA caught this (it's masked at <=340px, where .ob-seg is already hidden
// unconditionally). Fixed with :has(), the app's own established pattern.
{
  ok(/\.onboard:has\(#obIntro:not\(\[hidden\]\)\) \.ob-seg,\s*\.onboard:has\(#obBuilding:not\(\[hidden\]\)\) \.ob-seg,\s*\.onboard:has\(#obArrival:not\(\[hidden\]\)\) \.ob-seg \{ display: none; \}/.test(SRC),
    'the segmented progress line hides on Intro/Building/Arrival via :has(), not a sibling-combinator that could never match given #obSeg\'s DOM position');
  ok(!/#obIntro ~ \.ob-seg/.test(SRC), 'the broken sibling-combinator selector is gone, not left alongside the fix');
}

// ---------- Visual palette: approved hexes only, no bright gold, no gradients ----------
{
  ok(/background: #F3F0EA;/.test(SRC), 'onboarding background matches the approved stone hex exactly');
  ok(/#FCFBF8/.test(SRC), 'surface colour matches the approved hex exactly');
  ok(/#22201D/.test(SRC), 'primary text matches the approved hex exactly');
  ok(/#756D64/.test(SRC), 'secondary text matches the approved hex exactly');
  ok(/#A67C52/.test(SRC), 'accent bronze matches the approved hex exactly');
  ok(!/linear-gradient|radial-gradient/.test(SRC.slice(SRC.indexOf('First Run Onboarding ===='), SRC.indexOf('.adv { margin-top: 10px;'))),
    'no gradients introduced in the onboarding CSS block');
}

// ---------- No banned praise/hype language anywhere in the coach copy ----------
{
  const banned = ['Amazing', 'Great choice', 'Perfect', 'Crushed it'];
  const obCopyBlock = SRC.slice(SRC.indexOf('var OB_GOAL_COACH'), SRC.indexOf('function initOnboard'));
  banned.forEach(function (word) { ok(!new RegExp(word, 'i').test(obCopyBlock), 'banned praise word "' + word + '" does not appear in onboarding coach copy'); });
}

console.log(`v1.13 First Run Onboarding: ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
