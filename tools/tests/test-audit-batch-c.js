// UX audit Batch C (13 July 2026, James: "do all") -- flow & navigation:
// 1. Hardware/gesture back closes layers: day / preview / progress each
//    push one history entry; popstate closes the top layer instead of
//    exiting the PWA mid-workout. UI closes consume their own entry
//    (strict fromPop === true guard, because the closers double as click
//    handlers whose first argument is the event).
// 2. Scroll memory: entering an overlay remembers the underlying scroll
//    position; returning restores it (backToWeek/closePreview/
//    closeProgress no longer dump the user at the top).
// 3. Sticky preview CTA: the primary action stays reachable while
//    reading a long preview.
// 4. Readiness prompt: Skip/Escape/backdrop all stamp "asked today"
//    (state.readinessPromptAsked) so declining once stops the re-prompt
//    on every entry, and every decline path still opens the day.
// 5. Exclusive overlays: openPreview closes Progress and vice versa --
//    no more data-mode clobber leaving a stale previewIdx or dangling
//    close path.
const fs = require('fs');
const SRC = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8');

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

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

// ---------- 1. History layers ----------
{
  ok(/function pushLayer\(name\) \{ layerDepth\+\+; try \{ history\.pushState\(\{ tl: name \}, ""\); \} catch \(e\) \{\} \}/.test(SRC),
    'pushLayer adds one history entry per overlay');
  ok(/function consumeLayer\(\) \{ if \(layerDepth > 0\) \{ layerDepth--; layerSuppress = true; try \{ history\.back\(\); \} catch \(e\) \{\} \} \}/.test(SRC),
    'consumeLayer pops the entry and suppresses its own popstate echo');
  ok(/window\.addEventListener\("popstate", function \(\) \{[\s\S]{0,600}else if \(state\.view === "day"\) backToWeek\(true\);/.test(SRC),
    'popstate closes the top layer: preview, then progress, then the day view');
  const od = extractFn('openDay');
  ok(/if \(state\.view !== "day"\) \{ rememberScroll\(\); pushLayer\("day"\); \}/.test(od),
    'openDay pushes a layer (and remembers scroll) only on a real week->day transition');
  const op = extractFn('openPreview');
  ok(/pushLayer\("preview"\)/.test(op), 'openPreview pushes its layer');
  const og = extractFn('openProgress');
  ok(/pushLayer\("progress"\)/.test(og), 'openProgress pushes its layer');
  const btw = extractFn('backToWeek');
  ok(/if \(fromPop !== true\) consumeLayer\(\);/.test(btw), 'backToWeek consumes its entry on UI back (strict guard: it is also a click handler)');
  const cp = extractFn('closePreview');
  ok(/if \(fromPop !== true\) consumeLayer\(\);/.test(cp), 'closePreview consumes its entry with the same strict guard');
  const cg = extractFn('closeProgress');
  ok(/if \(fromPop !== true\) consumeLayer\(\);/.test(cg), 'closeProgress consumes its entry with the same strict guard');
}

// ---------- 2. Scroll memory ----------
{
  ok(/function rememberScroll\(\) \{ savedScrollY = window\.scrollY \|\| 0; \}/.test(SRC), 'scroll position is captured on overlay entry');
  const btw = extractFn('backToWeek');
  ok(/renderAll\(false\); restoreScroll\(\);/.test(btw), 'backToWeek restores the week scroll position (no more top-of-list dump)');
  const cp = extractFn('closePreview');
  ok(/restoreScroll\(\)/.test(cp) && !/window\.scrollTo\(0, 0\)/.test(cp), 'closePreview restores instead of scrolling to top');
  const cg = extractFn('closeProgress');
  ok(/restoreScroll\(\)/.test(cg) && !/window\.scrollTo\(0, 0\)/.test(cg), 'closeProgress restores instead of scrolling to top');
}

// ---------- 3. Sticky preview CTA ----------
{
  ok(/#previewView \.preview__cta:not\(\.preview__cta--ghost\) \{ position: sticky; bottom: calc\(64px \+ env\(safe-area-inset-bottom, 0px\)\); z-index: 5;/.test(SRC),
    'the primary preview CTA is sticky above the bottom nav (ghost variant stays inline)');
}

// ---------- 4. Readiness prompt decline paths ----------
{
  const spr = extractFn('shouldPromptReadiness');
  ok(/state\.readinessPromptAsked === todayStr\(\)\) return false;/.test(spr),
    'a declined prompt stays declined for the day (asked-today stamp)');
  ok(/function declinePrompt\(\) \{[\s\S]{0,300}state\.readinessPromptAsked = todayStr\(\); save\(\);[\s\S]{0,100}if \(dayIdx != null\) openDay\(dayIdx\);/.test(SRC),
    'declining stamps the day AND still opens the session the user was heading into');
  ok(/\$\("readinessPromptSkip"\)\.addEventListener\("click", function \(\) \{ closeDlg\(\); declinePrompt\(\); \}\);/.test(SRC), 'Skip uses the shared decline path');
  ok(/dlg\.addEventListener\("cancel", declinePrompt\);/.test(SRC), 'Escape uses the shared decline path (was: silently swallowed the tap)');
  ok(/dlg\.addEventListener\("click", function \(ev\) \{ if \(ev\.target === dlg\) \{ closeDlg\(\); declinePrompt\(\); \} \}\);/.test(SRC),
    'backdrop tap dismisses like Skip (was: no backdrop handler at all)');
}

// ---------- 5. Exclusive overlays ----------
{
  const op = extractFn('openPreview');
  ok(/if \(appEl\.getAttribute\("data-mode"\) === "progress"\) closeProgress\(\);/.test(op), 'opening Preview over Progress closes Progress first');
  const og = extractFn('openProgress');
  ok(/if \(appEl\.getAttribute\("data-mode"\) === "preview"\) closePreview\(\);/.test(og), 'opening Progress over Preview closes Preview first');
  ok(/if \(appEl\.getAttribute\("data-mode"\) === "progress"\) return;/.test(og), 're-tapping the Progress tab while open is a no-op, not a double-push');
}

// ---------- 6. Coach-span untouched ----------
{
  const { execFileSync } = require('child_process');
  const spanMd5 = execFileSync('sh', ['-c', "sed -n '/__COACH_START__/,/__COACH_END__/p' /Users/jamesharris/Desktop/training-log-app/index.html | md5"]).toString().trim();
  ok(spanMd5 === '909fbc92112ba642ed56d6d88b114fb1', 'coach-span md5 unchanged (909fbc92112ba642ed56d6d88b114fb1), got ' + spanMd5);
}

console.log(`UX audit Batch C (flow & navigation): ${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
