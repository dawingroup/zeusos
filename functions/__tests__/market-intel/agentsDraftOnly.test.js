/**
 * D-9 (audit 2026-10): a draft-only agent proposes; a person creates the
 * commercial record. In ZeusOS this holds by construction — no agent write
 * tool creates a lead, client, deal, job or competitor — and this test pins
 * it so a future tool cannot widen the draft-only allowlist unnoticed.
 *
 *    cd functions && node --test __tests__/market-intel/agentsDraftOnly.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const COMMERCIAL_COLLECTIONS = ['crm_leads', 'crm_deals', 'clients', 'master_jobs', 'competitors', 'market_opportunities'];

test('the draft-only allowlist holds no tool that creates a commercial or market record', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'agents', 'dispatcher.js'), 'utf8');
  const m = src.match(/const DRAFT_ONLY_ALLOWED_TOOLS = new Set\(\[([\s\S]*?)\]\);/);
  assert.ok(m, 'dispatcher declares DRAFT_ONLY_ALLOWED_TOOLS');
  const tools = [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
  assert.deepEqual(tools, ['write.draft_message', 'write.create_task', 'write.create_alert', 'write.acknowledge_alert']);
  for (const t of tools) assert.doesNotMatch(t, /lead|client|deal|job|competitor|opportunit|followup/, t);
});

test('no agent write handler touches a commercial or market collection', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'agents', 'handlers', 'writes.js'), 'utf8');
  const written = [...src.matchAll(/collection\('([a-zA-Z_]+)'\)/g)].map((x) => x[1]);
  assert.ok(written.length > 0);
  for (const c of written) assert.ok(!COMMERCIAL_COLLECTIONS.includes(c), `writes.js writes ${c}`);
});

test('the tool catalogue offers competitors read-only to agents', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'agents', 'toolCatalog.js'), 'utf8');
  assert.match(src, /'read\.competitors'/);
  assert.doesNotMatch(src, /'write\.(create|update)_competitor'/);
  assert.doesNotMatch(src, /'write\.create_(lead|deal|opportunity_followup)'/);
});
