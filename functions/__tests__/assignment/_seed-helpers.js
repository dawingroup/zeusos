/**
 * Test fixture builders + stubs shared by the edge-case integration tests.
 *
 * Each builder writes the documents the runners expect to find in
 * Firestore: a PARENT-org user (super), a SUBSIDIARY org doc, the
 * receiving subsidiary user, an ACTIVE SOW, an ACCEPTED Quote, an
 * OPEN MasterJob with a known ceiling.
 *
 * Auth helpers are stubbed by re-pointing `assertParentOrgPrincipal` /
 * `assertDeliveryLead` / `assertSubsidiaryAccessOrParent` etc. via the
 * test seam below. The runners require the auth module at load time, so
 * we monkey-patch its exports after-the-fact.
 */

const path = require('node:path');
const { makeFirestore } = require('./_firestore-stub');

const PARENT_ORG_ID = 'zeus-group';
const SUBSIDIARY = 'zeus-the-agency';
const AM_USER = 'user_am_001';
const DELIVERY_USER = 'user_dl_001';

function patchAuthForTests() {
  // Lazy-require to avoid loading firebase-functions before the test
  // bootstrap. Then overwrite the four async asserters with passthroughs
  // so tests don't have to seed user docs.
  const auth = require('../../src/assignment/lib/auth');

  auth.assertParentOrgPrincipal = async (a) => {
    if (!a || !a.uid) throw new Error('unauth');
    return { uid: a.uid, user: { homeOrgId: PARENT_ORG_ID } };
  };
  // ADR-2026-05-25 §2.Q2 — new commercial-principal helpers. Tests
  // treat any authenticated caller as a parent-org principal (same
  // semantics as the assertParentOrgPrincipal patch above) so we
  // don't have to seed primaryBrandId fixtures across the board.
  auth.assertCommercialPrincipal = async (a /* , clientId */) => {
    if (!a || !a.uid) throw new Error('unauth');
    return { uid: a.uid, user: { homeOrgId: PARENT_ORG_ID } };
  };
  auth.assertCommercialPrincipalForResource = async (a, ref) => {
    if (!a || !a.uid) throw new Error('unauth');
    // Mirror the production helper's contract: returns `{ uid, user, data }`
    // where `data` is the resource's data. Try to fetch it for tests
    // that consume the data (e.g. upsertSow reads `data.clientId`).
    let data = {};
    try {
      const snap = await ref.get();
      if (snap.exists) data = snap.data();
    } catch { /* test fixture may not have the doc — that's ok */ }
    return { uid: a.uid, user: { homeOrgId: PARENT_ORG_ID }, data };
  };
  auth.assertDeliveryLead = async (a /* , sub */) => {
    if (!a || !a.uid) throw new Error('unauth');
    return { uid: a.uid, user: { homeOrgId: SUBSIDIARY } };
  };
  auth.assertSubsidiaryAccessOrParent = async (a) => {
    if (!a || !a.uid) throw new Error('unauth');
    return { uid: a.uid, user: { homeOrgId: SUBSIDIARY } };
  };
  auth.isParentOrgUser = async (uid) => uid === AM_USER || uid === 'user_am_002';

  // Also re-point the resolver inside the validator (it captured the
  // ORIGINAL reference at require time).
  const validator = require('../../src/assignment/services/handoff-packet.validator');
  validator.__setParentOrgUserResolver(auth.isParentOrgUser);
}

function patchRatePinningForTests() {
  // Monkey-patch `resolveTimeEntryCost` so tests don't have to set up
  // rate cards. Default: 100_00 minor / hour → 1_667 minor / minute
  // rounded to nearest integer.
  const rp = require('../../src/assignment/lib/rate-pinning');
  rp.resolveTimeEntryCost = async ({ minutes }) => ({
    costMinor: Math.round((minutes / 60) * 100_00),
    roleCode: 'STAFF',
    rateCardId: 'rc_test_v1',
    rateCardLineId: 'rcl_test_1',
  });
}

/**
 * Seed enough Firestore docs for a complete `issueWorkOrder` happy path.
 */
function seedHappyPath(db, opts = {}) {
  const masterJobId = opts.masterJobId || 'mj_test_1';
  const sowId = opts.sowId || 'sow_test_1';
  const quoteId = opts.quoteId || 'q_test_1';
  const ceilingMinor = opts.ceilingMinor || 1_500_00;

  db._seed(`sows/${sowId}`, {
    id: sowId,
    status: 'ACTIVE',
    ceilingMinor,
    currency: 'USD',
    startDate: '2026-01-01',
    endDate: '2026-12-31',
  });
  db._seed(`quotes/${quoteId}`, {
    id: quoteId,
    sowId,
    status: 'ACCEPTED',
    clientTotalMinor: 2_000_00,
    pinnedRateCardIdsBySubsidiary: { [SUBSIDIARY]: 'rc_test_v1' },
  });
  db._seed(`master_jobs/${masterJobId}`, {
    id: masterJobId,
    sowId,
    quoteId,
    clientId: 'client_diageo',
    code: 'MJ-TEST-001',
    status: 'OPEN',
    allocatedMinor: 0,
    ceilingMinor,
    clientTotalMinor: 2_000_00,
    currency: 'USD',
  });
  return { masterJobId, sowId, quoteId, ceilingMinor };
}

/** Validated example handoff packet — meets every §7.3 rule. */
function validHandoffPacket() {
  return {
    briefMd: 'Produce 6 launch KVs for the Smirnoff Mango activation.',
    milestones: [
      { id: 'm1', name: 'First round', dueDate: '2026-06-10' },
    ],
    acceptanceCriteria: [
      { id: 'c1', description: '6 KVs delivered, print + digital', required: true },
    ],
    clientContextMd: 'Confident, warm tone. Hero is the bottle.',
    commsOwnerUserId: AM_USER,
  };
}

const auth = { am: { uid: AM_USER, token: { email: 'am@zeus.test' } }, dl: { uid: DELIVERY_USER, token: { email: 'dl@zeus.test' } } };

module.exports = {
  PARENT_ORG_ID, SUBSIDIARY, AM_USER, DELIVERY_USER,
  makeFirestore,
  patchAuthForTests,
  patchRatePinningForTests,
  seedHappyPath,
  validHandoffPacket,
  auth,
};
