// Product Polish Phase 1: Node-level test for the one fully pure, closure-free
// piece of this phase -- isInformativeWhy()'s anchor carve-out (item 4, J4).
// Every other scoped item (onboarding steps, injury quick-add, readiness
// prompt, block-scoped counters) is UI orchestration wired to `state`/DOM and
// is covered by live browser verification instead (see the completion
// report), per the approved plan's "pure helpers get Node tests; stateful UI
// orchestration relies on live verification" split.
const fs = require('fs');
const lines = fs.readFileSync('/Users/jamesharris/Desktop/training-log-app/index.html', 'utf8').split('\n');
const startIdx = lines.findIndex(function (l) { return l.trim() === 'var GENERIC_WHY = { "general accessory work": 1, "mobility work": 1, "conditioning work": 1, "primary lift for today\'s session": 1 };'; });
const endIdx = lines.findIndex(function (l, i) { return i > startIdx && l.trim() === 'return !!(w && !GENERIC_WHY[key]);'; }) + 2; // include the closing brace line
if (startIdx < 0 || endIdx < startIdx) { console.log('FAIL: could not locate isInformativeWhy in index.html'); process.exit(1); }
const src = lines.slice(startIdx, endIdx).join('\n') + '\n; module.exports = { isInformativeWhy: isInformativeWhy };';
const m = { exports: {} }; new Function('module', 'exports', src)(m, m.exports);
const { isInformativeWhy } = m.exports;

let pass = 0, fail = 0; const fails = [];
const ok = (c, msg) => { if (c) pass++; else { fail++; fails.push(msg); } };

// Every generic string stays suppressed on a non-anchor card, exactly as before Phase 1.
ok(isInformativeWhy('General accessory work', false) === false, 'non-anchor: "General accessory work" stays suppressed');
ok(isInformativeWhy('Mobility work', false) === false, 'non-anchor: "Mobility work" stays suppressed');
ok(isInformativeWhy('Conditioning work', false) === false, 'non-anchor: "Conditioning work" stays suppressed');
ok(isInformativeWhy('Primary lift for today\'s session', false) === false, 'non-anchor: "Primary lift for today\'s session" stays suppressed (only the anchor carve-out changes)');

// The anchor carve-out (J4) applies to exactly one string, only when isAnchor is true.
ok(isInformativeWhy('Primary lift for today\'s session', true) === true, 'anchor: "Primary lift for today\'s session" is now shown');
ok(isInformativeWhy('General accessory work', true) === false, 'anchor: every OTHER generic string stays suppressed even on the anchor card');
ok(isInformativeWhy('Mobility work', true) === false, 'anchor: "Mobility work" stays suppressed even on the anchor card');

// A genuinely informative reason (debt-based, lengthened-bias, etc.) was never
// suppressed by either the old or new logic, anchor or not -- unaffected.
ok(isInformativeWhy('You\'re 2 sets behind on horizontal push this week', false) === true, 'a real, specific reason still shows on a non-anchor card');
ok(isInformativeWhy('You\'re 2 sets behind on horizontal push this week', true) === true, 'a real, specific reason still shows on the anchor card too');

// Empty/missing why is never shown, anchor or not.
ok(isInformativeWhy('', true) === false, 'empty why is never shown, even on the anchor');
ok(isInformativeWhy(undefined, true) === false, 'missing why is never shown, even on the anchor');

// Case/whitespace-insensitive match, matching the existing GENERIC_WHY lookup convention.
ok(isInformativeWhy('  Primary Lift For Today\'s Session  ', true) === true, 'anchor carve-out matches case/whitespace-insensitively, same as the existing GENERIC_WHY lookup');

console.log(`${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
