/**
 * The ledger and the Claude boundary: every `messages.create` is recorded with
 * attribution from the entry-point context, provider failures are translated
 * (prompt-level ones are not), a paused feature costs nothing and is recorded,
 * and bookkeeping never fails a model call.
 *
 *    cd functions && node --test __tests__/ai-usage/ledger.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore } = require('../assignment/_firestore-stub');
const ledger = require('../../src/utils/aiUsageLedger');
const { wrapClientForApiSafety, sanitizeForApi, attemptBudget, answerTimeoutMs } = require('../../src/utils/claudeClient');
const { resetAiPolicyCache } = require('../../src/utils/aiPolicy');
const { instrumentModel } = require('../../src/utils/geminiClient');
const { mapAnthropicError, classifyAnthropicError, classifyGoogleError } = require('../../src/utils/aiProviderErrors');

const rows = (db) => db._dump_prefix('ai_usage_events').map((r) => r.data);
const tick = () => new Promise((r) => setImmediate(r));

function fakeClient(impl) {
  return { messages: { create: impl }, other: () => 'passthrough' };
}

test('a row prices the call and carries the entry-point attribution; no context → unknown trigger, deployed function as feature', async () => {
  const { db } = makeFirestore();
  delete process.env.K_SERVICE; delete process.env.FUNCTION_TARGET;
  const row = await ledger.recordAiUsage({ model: 'claude-sonnet-4-6', usage: { input: 1000, output: 500 }, latencyMs: 812.4 }, { db, now: Date.parse('2026-10-29T10:00:00Z') });
  assert.equal(row.trigger, 'unknown');
  assert.equal(row.feature, 'unattributed');
  assert.equal(row.provider, 'anthropic');
  assert.equal(row.priced, true);
  assert.ok(Math.abs(row.costUsd - 0.0105) < 1e-9);
  assert.equal(row.costUgx, Math.round(0.0105 * 3700));
  assert.equal(row.latencyMs, 812);
  assert.equal(row.isWaste, false);
  const stored = rows(db)[0];
  assert.equal(stored.createdAt, '2026-10-29T10:00:00.000Z');
  assert.ok(stored.expiresAt > '2027-02-01', 'TTL 120 days out');

  process.env.K_SERVICE = 'draftmemosection'; process.env.FUNCTION_TARGET = 'draftMemoSection';
  const attributed = await ledger.withAiContext({ trigger: 'user', userId: 'u1', subsidiaryId: 'zeus-the-agency' }, () =>
    ledger.recordAiUsage({ model: 'gemini-2.0-flash', usage: { input: 10 }, outcome: 'empty' }, { db }));
  assert.equal(attributed.trigger, 'user');
  assert.equal(attributed.userId, 'u1');
  assert.equal(attributed.subsidiaryId, 'zeus-the-agency');
  assert.equal(attributed.feature, 'draftMemoSection', 'the exported name, not the lowercased service');
  assert.equal(attributed.isWaste, true);
  delete process.env.K_SERVICE; delete process.env.FUNCTION_TARGET;
  // inner context merges over outer
  await ledger.withAiContext({ trigger: 'scheduled' }, () => ledger.withAiContext({ agentId: 'ZA-003' }, async () => {
    assert.deepEqual(ledger.currentAiContext(), { trigger: 'scheduled', agentId: 'ZA-003' });
  }));
  assert.equal(await ledger.recordAiUsage({ model: 'x' }, { db: { collection: () => { throw new Error('boom'); } } }), null, 'never throws');
});

test('the Claude boundary records every call — ok, refused, failed — and translates only provider failures', async () => {
  const { db } = makeFirestore();
  resetAiPolicyCache();
  const calls = [];
  const client = wrapClientForApiSafety(fakeClient(async (params) => {
    calls.push(params);
    if (params.messages[0].content === 'refuse') return { model: 'claude-sonnet-4-6', stop_reason: 'refusal', usage: { input_tokens: 5, output_tokens: 1 }, content: [] };
    if (params.messages[0].content === 'credit') { const e = new Error('Your credit balance is too low to access the Anthropic API'); e.status = 400; throw e; }
    if (params.messages[0].content === 'bad') { const e = new Error('no low surrogate in string'); e.status = 400; throw e; }
    return { model: 'claude-sonnet-4-6', stop_reason: 'end_turn', usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 400 }, content: [{ type: 'text', text: 'ok' }] };
  }), { db });
  assert.equal(client.other(), 'passthrough', 'everything else passes through');

  const res = await ledger.withAiContext({ trigger: 'user', userId: 'u1', feature: 'memos.draft' }, () =>
    client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 10, messages: [{ role: 'user', content: 'hi \ud83d' }] }));
  assert.equal(res.content[0].text, 'ok');
  assert.equal(calls[0].messages[0].content, 'hi ', 'the lone surrogate was stripped before the call');
  await tick();
  let r = rows(db);
  assert.equal(r.length, 1);
  assert.deepEqual([r[0].outcome, r[0].feature, r[0].userId, r[0].usage.cacheRead], ['ok', 'memos.draft', 'u1', 400]);

  await client.messages.create({ model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: 'refuse' }] });
  await tick();
  assert.equal(rows(db)[1].outcome, 'refused');

  await assert.rejects(client.messages.create({ model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: 'credit' }] }), (e) => e.code === 'resource-exhausted' && /run out of credit/.test(e.message) && e.status === 400 && /credit balance/.test(e.cause.message));
  await tick();
  assert.equal(rows(db)[2].outcome, 'billing_blocked');
  assert.match(rows(db)[2].errorMessage, /credit balance/, 'the provider\'s own wording is booked');

  await assert.rejects(client.messages.create({ model: 'claude-sonnet-4-6', messages: [{ role: 'user', content: 'bad' }] }), (e) => e.message === 'no low surrogate in string' && e.status === 400, 'a prompt-level failure is returned untouched');
  await tick();
  assert.equal(rows(db)[3].outcome, 'bad_request');
});

test('a paused feature is refused before the call and recorded as avoided spend', async () => {
  const { db } = makeFirestore();
  resetAiPolicyCache();
  db._seed('ai_policy/global', { features: { 'memos.draft': { enabled: false, note: 'Until the invoice is paid.' } }, agents: { 'ZA-003': { enabled: false } } });
  let called = 0;
  const client = wrapClientForApiSafety(fakeClient(async () => { called++; return { usage: {}, content: [] }; }), { db });
  await assert.rejects(
    ledger.withAiContext({ feature: 'memos.draft' }, () => client.messages.create({ model: 'claude-sonnet-4-6', messages: [] })),
    (e) => e.code === 'failed-precondition' && /paused by an administrator/.test(e.message) && /invoice/.test(e.message) && e.aiPolicyReason === 'feature_paused',
  );
  await assert.rejects(
    ledger.withAiContext({ feature: 'other', agentId: 'ZA-003' }, () => client.messages.create({ model: 'claude-sonnet-4-6', messages: [] })),
    (e) => e.aiPolicyReason === 'agent_paused',
  );
  assert.equal(called, 0);
  await tick();
  const r = rows(db);
  assert.equal(r.length, 2);
  assert.equal(r[0].outcome, 'paused');
  assert.equal(r[0].costUsd, 0);
  // Not paused: an unlisted feature runs.
  await ledger.withAiContext({ feature: 'listed-nowhere' }, () => client.messages.create({ model: 'claude-sonnet-4-6', messages: [] }));
  assert.equal(called, 1);
  resetAiPolicyCache();
});

test('the Gemini boundary records usage incl. thinking tokens and translates a billing outage', async () => {
  const { db } = makeFirestore();
  const model = instrumentModel({
    generateContent: async (p) => {
      if (p === 'down') throw new Error('[403 Forbidden] Lightning dunning decision is deny');
      if (p === 'blank') return { response: { text: () => '', usageMetadata: { promptTokenCount: 5, candidatesTokenCount: 0 } } };
      return { response: { text: () => 'hi', usageMetadata: { promptTokenCount: 100, candidatesTokenCount: 20, thoughtsTokenCount: 30 } } };
    },
  }, 'gemini-2.5-flash', { db });
  await model.generateContent('ok');
  await model.generateContent('blank');
  await assert.rejects(model.generateContent('down'), (e) => e.code === 'failed-precondition' && /billing disabled/.test(e.message));
  await tick();
  const r = rows(db);
  assert.deepEqual(r.map((x) => x.outcome), ['ok', 'empty', 'billing_blocked']);
  assert.equal(r[0].usage.thoughts, 30);
  assert.ok(Math.abs(r[0].costUsd - ((100 * 0.3 + 50 * 2.5) / 1e6)) < 1e-12, 'thinking billed as output');
  assert.equal(instrumentModel(model, 'x').__aiInstrumented, true, 'wrapping twice is a no-op');
});

test('provider classification, sanitising and the attempt budget', () => {
  assert.equal(classifyAnthropicError({ status: 529 }).code, 'unavailable');
  assert.equal(classifyAnthropicError({ status: 401 }).type, 'authentication_error');
  assert.equal(classifyAnthropicError({ status: 429 }).code, 'resource-exhausted');
  assert.equal(classifyAnthropicError({ status: 400, message: 'bad prompt' }), null);
  assert.equal(classifyAnthropicError(new Error('no status')), null);
  assert.equal(mapAnthropicError('not an error object'), 'not an error object');
  assert.equal(classifyGoogleError({ message: 'API_KEY_INVALID' }).type, 'api_key_invalid');
  assert.equal(classifyGoogleError({ message: 'RESOURCE_EXHAUSTED' }).code, 'resource-exhausted');
  assert.equal(classifyGoogleError({ message: '[503 Service Unavailable] overloaded' }).code, 'unavailable');
  assert.equal(classifyGoogleError({ message: 'prompt too long' }), null);

  assert.deepEqual(sanitizeForApi({ a: 'x\ud83d', b: ['\udc00y', { c: 'fine 😀' }], d: 3 }), { a: 'x', b: ['y', { c: 'fine 😀' }], d: 3 });

  assert.equal(answerTimeoutMs(4096), 120_000);
  assert.equal(answerTimeoutMs(10000), 400_000);
  assert.equal(answerTimeoutMs(16384), 600_000, 'capped at ten minutes');
  assert.equal(answerTimeoutMs(100_000), 600_000);
  const now = 1_000_000;
  assert.deepEqual(attemptBudget(null, 4096, now), { timeoutMs: 120_000, remainingMs: null, exhausted: false, canRetry: true });
  const tight = attemptBudget(now + 50_000, 16384, now);
  assert.deepEqual(tight, { timeoutMs: 50_000, remainingMs: 50_000, exhausted: false, canRetry: false });
  assert.equal(attemptBudget(now + 10_000, 4096, now).exhausted, true);
  assert.equal(attemptBudget(now + 400_000, 4096, now).canRetry, true);
});
