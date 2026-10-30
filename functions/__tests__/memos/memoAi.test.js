/**
 * draftMemoSection — "Draft with AI" on a memo section: dark without a key,
 * the author's only, drafts only, grounded in the memo's own context, and
 * never written.
 *
 *    cd functions && node --test __tests__/memos/memoAi.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore } = require('../assignment/_firestore-stub');
const { draftSection, buildMemoDraftPrompt, summariseRecord } = require('../../src/memos/ai/draftMemoSection');

const NOW = '2026-10-29T09:00:00.000Z';
const auth = (uid) => ({ uid, token: { email: `${uid}@zeus.co.ke` } });
const notConfigured = async () => { const e = new Error('no key'); e.code = 'NOT_CONFIGURED'; throw e; };
const fakeModel = (text, capture) => async () => ({
  model: 'claude-test',
  client: { messages: { create: async (req) => { if (capture) capture(req); return { content: [{ type: 'text', text }] }; } } },
});

function seed(db) {
  db._seed('users/u-author', { uid: 'u-author', displayName: 'Amina', globalRole: 'member' });
  db._seed('users/u-grace', { uid: 'u-grace', displayName: 'Grace', globalRole: 'admin' });
  db._seed('users/u-ben', { uid: 'u-ben', displayName: 'Ben', globalRole: 'member' });
  db._seed('internal_work_orders/iwo-1', { code: 'IWO-ZTA-014', title: 'Diageo shoot', state: 'IN_PROGRESS', budgetMinor: 900000, currency: 'KES', nested: { x: 1 }, empty: '' });
  db._seed('memos/m1', {
    status: 'draft', createdBy: 'u-author', type: 'request', category: 'finance', impact: 'medium', amountMinor: 180000, currency: 'KES',
    subject: 'Generator hire', memoNumber: null,
    header: { to: [{ uid: 'u-grace', name: 'Grace', title: 'MD' }], from: { uid: 'u-author', name: 'Amina' }, through: [], cc: [], date: '2026-10-29' },
    sections: [
      { key: 'purpose', heading: 'Purpose', content: '', enabled: true },
      { key: 'background', heading: 'Justification', content: 'The venue has no mains power.', enabled: true },
      { key: 'risks', heading: 'Risks', content: 'Disabled text', enabled: false },
    ],
    links: [{ type: 'iwo', id: 'iwo-1', label: 'IWO-ZTA-014', relation: 'authorises' }, { type: 'other', id: 'x', label: 'Supplier quote email', relation: 'context' }],
    attachments: [{ name: 'quote.pdf' }],
  });
}

test('without a key the callable refuses with a sentence the editor can show — nothing written', async () => {
  const { db } = makeFirestore();
  seed(db);
  await assert.rejects(
    draftSection(db, { memoId: 'm1', sectionKey: 'purpose' }, { auth: auth('u-author'), getAnthropic: notConfigured, nowIso: NOW }),
    (e) => e.code === 'failed-precondition' && /ANTHROPIC_API_KEY/.test(e.message),
  );
  assert.equal(db._dump_prefix('agent_audit_entries').length, 0);
  assert.equal(db._store.get('memos/m1').sections[0].content, '');
});

test('the author drafts one section from the memo\'s own context; the text comes back, never written', async () => {
  const { db } = makeFirestore();
  seed(db);
  let req = null;
  const r = await draftSection(
    db,
    { memoId: 'm1', sectionKey: 'purpose', hint: 'Lead with the ask.', typeHint: 'Justifies a spend.', instruction: 'Mention the six weeks.' },
    { auth: auth('u-author'), getAnthropic: fakeModel('  We request approval to hire a generator for [weeks] weeks.  ', (x) => { req = x; }), nowIso: NOW },
  );
  assert.equal(r.sectionKey, 'purpose');
  assert.equal(r.content, 'We request approval to hire a generator for [weeks] weeks.');
  assert.equal(r.characters, r.content.length);
  assert.equal(r.linkedRecordsUsed, 1, 'the IWO summarised; the "other" link has no record');
  assert.equal(r.model, 'claude-test');
  const prompt = req.messages[0].content;
  assert.match(prompt, /Draft the "Purpose" section/);
  assert.match(prompt, /Lead with the ask\./);
  assert.match(prompt, /request — Justifies a spend\./);
  assert.match(prompt, /Amount: KES 180,000 \(minor units\)/);
  assert.match(prompt, /To: Grace, MD/);
  assert.match(prompt, /## Justification\nThe venue has no mains power\./, 'the other written sections are context');
  assert.doesNotMatch(prompt, /Disabled text/, 'a disabled section is not');
  assert.match(prompt, /IWO-ZTA-014 \(authorises\)\n    code: IWO-ZTA-014/);
  assert.match(prompt, /budgetMinor: 900000/);
  assert.doesNotMatch(prompt, /nested/, 'only scalars are quoted');
  assert.match(prompt, /Supplier quote email \(context\)/);
  assert.match(prompt, /- quote\.pdf/);
  assert.match(prompt, /INSTRUCTION FROM THE AUTHOR\nMention the six weeks\./);
  assert.match(prompt, /one or two sentences/);
  assert.match(req.system, /Zeus Group/);
  assert.equal(req.temperature, 0.3);
  assert.equal(db._store.get('memos/m1').sections[0].content, '', 'nothing written');
  const audit = db._dump_prefix('agent_audit_entries');
  assert.equal(audit.length, 1);
  assert.equal(audit[0].data.toolId, 'memo.draft_section');
  assert.equal(audit[0].data.outputSnapshot.linkedRecordsUsed, 1);
});

test('only the author (or an admin) drafts; only a draft; only a section the memo has', async () => {
  const { db } = makeFirestore();
  seed(db);
  const model = fakeModel('text');
  await assert.rejects(draftSection(db, { memoId: 'm1', sectionKey: 'purpose' }, { auth: auth('u-ben'), getAnthropic: model }), (e) => e.code === 'permission-denied');
  const ok = await draftSection(db, { memoId: 'm1', sectionKey: 'purpose' }, { auth: auth('u-grace'), getAnthropic: model });
  assert.equal(ok.content, 'text', 'an admin may help');
  await assert.rejects(draftSection(db, { memoId: 'm1', sectionKey: 'nope' }, { auth: auth('u-author'), getAnthropic: model }), (e) => e.code === 'invalid-argument');
  await assert.rejects(draftSection(db, { memoId: 'm1' }, { auth: auth('u-author'), getAnthropic: model }), (e) => e.code === 'invalid-argument');
  await assert.rejects(draftSection(db, { memoId: 'gone', sectionKey: 'purpose' }, { auth: auth('u-author'), getAnthropic: model }), (e) => e.code === 'not-found');
  db._seed('memos/m1', { ...db._store.get('memos/m1'), status: 'submitted' });
  await assert.rejects(draftSection(db, { memoId: 'm1', sectionKey: 'purpose' }, { auth: auth('u-author'), getAnthropic: model }), (e) => e.code === 'failed-precondition' && /froze/.test(e.message));
  await assert.rejects(draftSection(db, { memoId: 'm1', sectionKey: 'purpose' }, { auth: auth('u-author'), getAnthropic: fakeModel('   ') }), (e) => e.code === 'failed-precondition');
});

test('an empty answer is an error, not an empty section', async () => {
  const { db } = makeFirestore();
  seed(db);
  await assert.rejects(draftSection(db, { memoId: 'm1', sectionKey: 'purpose' }, { auth: auth('u-author'), getAnthropic: fakeModel('   ') }), (e) => e.code === 'internal' && /empty draft/.test(e.message));
});

test('pure helpers: summariseRecord quotes scalars in order; the prompt carries the current text when improving', () => {
  assert.equal(summariseRecord('iwo', { code: 'X', title: 'T', nested: {}, state: '' }), 'code: X\ntitle: T');
  assert.equal(summariseRecord('iwo', null), null);
  assert.equal(summariseRecord('dragon', { a: 1 }), null);
  const p = buildMemoDraftPrompt({
    memo: { type: 'decision', category: 'admin', impact: 'low', subject: 'S', header: {}, sections: [] },
    section: { key: 'recommendation', heading: 'Recommendation', content: 'Old text.' },
    linkedSummaries: [],
  });
  assert.match(p, /Amount: not stated/);
  assert.match(p, /CURRENT TEXT OF THIS SECTION \(improve it; keep what is right\)\nOld text\./);
  assert.match(p, /\(none linked\)/);
  assert.match(p, /between 60 and 220 words/);
});
