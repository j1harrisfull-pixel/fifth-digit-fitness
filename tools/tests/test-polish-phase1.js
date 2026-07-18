// Product Polish Phase 1 originally added isInformativeWhy()'s anchor
// carve-out (item 4, J4): "Primary lift for today's session" was shown only
// on the session's anchor slot. Reversed 18 July 2026 (James: "a lot of
// information on these pages, can it be simplified?") -- the line said the
// identical thing on every anchor, every day, so it was filler, not a real
// coach note. isInformativeWhy is back to a plain single-argument generic-
// string filter; this test now guards THAT.
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

// Every generic string is suppressed, unconditionally -- no anchor exception.
ok(isInformativeWhy('General accessory work') === false, '"General accessory work" is suppressed');
ok(isInformativeWhy('Mobility work') === false, '"Mobility work" is suppressed');
ok(isInformativeWhy('Conditioning work') === false, '"Conditioning work" is suppressed');
ok(isInformativeWhy('Primary lift for today\'s session') === false, '"Primary lift for today\'s session" is suppressed -- the anchor carve-out is gone, no exceptions left');

// Passing a second (now-nonexistent) argument changes nothing -- confirms
// there is no hidden anchor branch left to accidentally re-trigger.
ok(isInformativeWhy('Primary lift for today\'s session', true) === false, 'a truthy second argument has no effect -- the anchor parameter is gone, not just defaulted');

// A genuinely informative reason (debt-based, lengthened-bias, etc.) still shows.
ok(isInformativeWhy('You\'re 2 sets behind on horizontal push this week') === true, 'a real, specific reason still shows');

// Empty/missing why is never shown.
ok(isInformativeWhy('') === false, 'empty why is never shown');
ok(isInformativeWhy(undefined) === false, 'missing why is never shown');

// Case/whitespace-insensitive match, matching the existing GENERIC_WHY lookup convention.
ok(isInformativeWhy('  Primary Lift For Today\'s Session  ') === false, 'the generic-string match stays case/whitespace-insensitive');

console.log(`${pass} passed, ${fail} failed`);
if (fail) { fails.forEach(f => console.log('FAIL:', f)); process.exit(1); }
