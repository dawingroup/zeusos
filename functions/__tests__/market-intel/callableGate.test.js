/**
 * Every market-intelligence callable calls the gate FIRST
 * (audit 2026-10, E1 / WP1). A text scan, in the shape of the stream-D
 * attribution guard: the first statement of each `async (request) => {`
 * handler in the market-intelligence callable files must be
 * `await assertMarketIntelCaller(request.auth, { need, action })`, and no
 * bare `if (!request.auth)` check may remain in those files.
 *
 *    cd functions && node --test __tests__/market-intel/callableGate.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const FILES = [
  'src/intelligence/marketIntelFunctions.js',
  'src/intelligence/digitalProfileDiscovery.js',
  'src/intelligence/socialTrackerFunctions.js',
  'src/ai/marketIntelligence.js',
];

const HANDLER = /async \(request\) => \{\n/g;
const GATE = /^await assertMarketIntelCaller\(request\.auth, \{ need: '(view|edit|admin)', action: '[^']+' \}\);$/;

function firstStatementAfter(src, index) {
  const rest = src.slice(index).split('\n');
  for (const line of rest) {
    const t = line.trim();
    if (t === '' || t.startsWith('//') || t.startsWith('/*') || t.startsWith('*')) continue;
    return t;
  }
  return '';
}

for (const rel of FILES) {
  test(`${rel}: every callable handler opens with the gate`, () => {
    const src = fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');
    assert.match(src, /require\('\.\.\/lib\/marketIntelGate'\)/, 'requires the gate');
    assert.doesNotMatch(src, /if \(!request\.auth\)/, 'no bare request.auth check remains');
    const handlers = [...src.matchAll(HANDLER)];
    assert.ok(handlers.length >= 1, 'has at least one callable handler');
    for (const h of handlers) {
      const first = firstStatementAfter(src, h.index + h[0].length);
      assert.match(first, GATE, `handler at offset ${h.index} opens with: ${first}`);
    }
  });
}

test('the needs chosen per callable: reads are view, everything that spends or writes is edit', () => {
  const read = (rel) => fs.readFileSync(path.join(__dirname, '..', '..', rel), 'utf8');
  const scan = read('src/ai/marketIntelligence.js');
  assert.match(scan, /need: 'edit', action: 'run a market intelligence scan'/);
  assert.match(scan, /need: 'view', action: 'read market intelligence reports'/);
  const edits = [...read('src/intelligence/marketIntelFunctions.js').matchAll(/need: '(\w+)'/g)].map((m) => m[1]);
  assert.deepEqual(edits, ['edit', 'edit', 'edit', 'edit', 'edit']);
});
