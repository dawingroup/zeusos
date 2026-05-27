/**
 * updateMasterJobBrief tests — Phase 6.UI.D.1.
 *   cd functions && node --test __tests__/account-management/updateMasterJobBrief.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');

const { makeFirestore } = require('../assignment/_firestore-stub');
const { runUpdateMasterJobBrief } = require('../../src/account-management/updateMasterJobBrief');

const SEED_AUTH = { uid: 'user-am-1' };
const stubAuth = (uid = 'user-am-1') => async () => ({ uid });

function seedMasterJob(db, overrides = {}) {
  db._seed('master_jobs/mj_1', {
    id: 'mj_1',
    sowId: 'sow_1',
    quoteId: 'q_1',
    clientId: 'client_1',
    status: 'OPEN',
    allocatedMinor: 0,
    ceilingMinor: 1_000_000,
    clientTotalMinor: 1_200_000,
    currency: 'UGX',
    campaign: {
      brief: { tier: 2, objectives: 'initial' },
      ...overrides.campaign,
    },
    createdBy: 'u_1',
    createdAt: '2026-05-01T00:00:00Z',
    updatedAt: '2026-05-01T00:00:00Z',
    ...overrides,
  });
}

test('merges co-authored brief fields into campaign.brief', async () => {
  const { db } = makeFirestore();
  seedMasterJob(db);
  const r = await runUpdateMasterJobBrief({
    db, auth: SEED_AUTH,
    data: {
      masterJobId: 'mj_1',
      brief: {
        documentDeliveredAt: '2026-05-10T10:00:00Z',
        verbalBriefingAt: '2026-05-11T15:00:00Z',
        authorContributions: [
          {
            id: 'ac1',
            principalKind: 'client',
            principalRef: 'c-jane',
            role: 'client_lead',
            contributionSummary: 'Pitched the urgency angle',
            contributedAt: '2026-05-09T12:00:00Z',
          },
        ],
      },
    },
    assertAuth: stubAuth(),
  });
  assert.equal(r.updated, true);
  const mj = db._dump()['master_jobs/mj_1'];
  assert.equal(mj.campaign.brief.documentDeliveredAt, '2026-05-10T10:00:00Z');
  assert.equal(mj.campaign.brief.verbalBriefingAt, '2026-05-11T15:00:00Z');
  assert.equal(mj.campaign.brief.authorContributions.length, 1);
  // Existing fields preserved
  assert.equal(mj.campaign.brief.tier, 2);
  assert.equal(mj.campaign.brief.objectives, 'initial');
});

test('overwrites previously-set co-author fields', async () => {
  const { db } = makeFirestore();
  seedMasterJob(db);
  await runUpdateMasterJobBrief({
    db, auth: SEED_AUTH,
    data: { masterJobId: 'mj_1', brief: { objectives: 'first pass' } },
    assertAuth: stubAuth(),
  });
  await runUpdateMasterJobBrief({
    db, auth: SEED_AUTH,
    data: { masterJobId: 'mj_1', brief: { objectives: 'second pass' } },
    assertAuth: stubAuth(),
  });
  const mj = db._dump()['master_jobs/mj_1'];
  assert.equal(mj.campaign.brief.objectives, 'second pass');
});

test('strips unknown brief fields (whitelist)', async () => {
  const { db } = makeFirestore();
  seedMasterJob(db);
  await runUpdateMasterJobBrief({
    db, auth: SEED_AUTH,
    data: { masterJobId: 'mj_1', brief: { objectives: 'safe', evilField: 'pwned' } },
    assertAuth: stubAuth(),
  });
  const mj = db._dump()['master_jobs/mj_1'];
  assert.equal(mj.campaign.brief.objectives, 'safe');
  assert.equal(mj.campaign.brief.evilField, undefined);
});

test('throws not-found when masterJobId does not exist', async () => {
  const { db } = makeFirestore();
  await assert.rejects(
    runUpdateMasterJobBrief({
      db, auth: SEED_AUTH,
      data: { masterJobId: 'mj_missing', brief: { objectives: 'x' } },
      assertAuth: stubAuth(),
    }),
    /not found/i,
  );
});

test('rejects when masterJobId or brief missing', async () => {
  const { db } = makeFirestore();
  await assert.rejects(
    runUpdateMasterJobBrief({
      db, auth: SEED_AUTH, data: { brief: { objectives: 'x' } },
      assertAuth: stubAuth(),
    }),
    /masterJobId/,
  );
  await assert.rejects(
    runUpdateMasterJobBrief({
      db, auth: SEED_AUTH, data: { masterJobId: 'mj_1' },
      assertAuth: stubAuth(),
    }),
    /brief object/,
  );
});
