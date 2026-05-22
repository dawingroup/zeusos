/**
 * Handoff-packet validator — spec §7.3 (completeness).
 *   cd functions && node --test __tests__/assignment/handoff-packet.test.js
 */
const test = require('node:test');
const assert = require('node:assert/strict');

const {
  validateHandoffPacketSync,
  validateHandoffPacket,
  __setParentOrgUserResolver,
} = require('../../src/assignment/services/handoff-packet.validator');

const baseSow = {
  startDate: '2026-01-01',
  endDate: '2026-12-31',
};

const validPacket = {
  briefMd: 'Produce 6 launch KVs for the Smirnoff Mango activation.',
  milestones: [
    { id: 'm1', name: 'First round', dueDate: '2026-06-10' },
    { id: 'm2', name: 'Final', dueDate: '2026-07-01' },
  ],
  acceptanceCriteria: [
    { id: 'c1', description: '6 KVs delivered, print + digital', required: true },
    { id: 'c2', description: 'Tone matches brand book', required: false },
  ],
  clientContextMd: 'Confident, warm tone. Hero is the bottle.',
  commsOwnerUserId: 'user_am_001',
};

test('valid packet passes sync validation', () => {
  const r = validateHandoffPacketSync({ packet: validPacket, iwo: {}, sow: baseSow });
  assert.equal(r.ok, true);
  assert.equal(r.errors.length, 0);
});

test('missing briefMd → fails', () => {
  const r = validateHandoffPacketSync({
    packet: { ...validPacket, briefMd: '' },
    iwo: {}, sow: baseSow,
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /briefMd/.test(e)));
});

test('empty milestones → fails', () => {
  const r = validateHandoffPacketSync({
    packet: { ...validPacket, milestones: [] },
    iwo: {}, sow: baseSow,
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /milestones/.test(e)));
});

test('milestone due date outside SOW window → fails', () => {
  const r = validateHandoffPacketSync({
    packet: {
      ...validPacket,
      milestones: [{ id: 'm1', name: 'X', dueDate: '2025-12-31' }],
    },
    iwo: {}, sow: baseSow,
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /precedes SOW start/.test(e)));
});

test('no required acceptance criterion → fails', () => {
  const r = validateHandoffPacketSync({
    packet: {
      ...validPacket,
      acceptanceCriteria: [{ id: 'c1', description: 'optional', required: false }],
    },
    iwo: {}, sow: baseSow,
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /required:true/.test(e)));
});

test('clientContextMd containing price terms → fails (scrubbed-of-price rule)', () => {
  const r = validateHandoffPacketSync({
    packet: {
      ...validPacket,
      clientContextMd: 'The total budget for this work is USD 4,800.',
    },
    iwo: {}, sow: baseSow,
  });
  assert.equal(r.ok, false);
  assert.ok(r.errors.some((e) => /price/.test(e)));
});

test('async — commsOwnerUserId must be a parent-org user', async () => {
  // Stub the parent-org lookup so the test doesn't need Firestore.
  __setParentOrgUserResolver(async (uid) => uid === 'user_am_001');

  const ok = await validateHandoffPacket({
    packet: validPacket,
    iwo: {}, sow: baseSow,
  });
  assert.equal(ok.ok, true);

  const bad = await validateHandoffPacket({
    packet: { ...validPacket, commsOwnerUserId: 'user_subsidiary_002' },
    iwo: {}, sow: baseSow,
  });
  assert.equal(bad.ok, false);
  assert.ok(bad.errors.some((e) => /not a parent-org/.test(e)));
});
