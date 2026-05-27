/**
 * ADR-2026-05-25 §2.Q2 — Layer-2 (Cloud Functions) brand-direct
 * authorization tests.
 *
 * Verifies that subsidiary principals whose `homeOrgId` matches a
 * client's `primaryBrandId` CAN call commercial callables for that
 * client (the brand-direct sales premise). Companion to
 * `subsidiary-403.test.js`, which asserts subsidiaries are DENIED
 * for clients they don't own.
 *
 * Run:
 *   cd functions && node --test __tests__/contracts/brand-direct-auth.test.js
 */

const test = require('node:test');
const assert = require('node:assert/strict');
const Module = require('node:module');
const stub = require('../assignment/_firestore-stub');

let _adminDb;
const origLoad = Module._load;
Module._load = function patched(request, ...rest) {
  if (request === 'firebase-admin/firestore') {
    return {
      getFirestore: () => _adminDb,
      FieldValue: stub.FieldValueStub,
    };
  }
  if (request === 'firebase-functions/v2/https') {
    const real = origLoad.call(this, request, ...rest);
    return {
      HttpsError: real.HttpsError,
      onCall: (_opts, maybeHandler) => {
        const handler = typeof _opts === 'function' ? _opts : maybeHandler;
        return (req) => handler(req);
      },
    };
  }
  return origLoad.call(this, request, ...rest);
};

const { db: stubDb } = stub.makeFirestore();
_adminDb = stubDb;

// Real auth (no patch) so the helper exercises its production path.
const auth = require('../../src/assignment/lib/auth');

// Seed organisations + a brand-direct user (homeOrg = zeus-the-agency,
// globalRole = member; not a parent-org principal).
const PARENT_ORG = 'zeus-group';
const BRAND_ORG = 'zeus-the-agency';
const OTHER_BRAND_ORG = 'labyrinth';

stubDb._seed(`organizations/${PARENT_ORG}`, { id: PARENT_ORG, kind: 'PARENT', name: 'Zeus Group' });
stubDb._seed(`organizations/${BRAND_ORG}`, { id: BRAND_ORG, kind: 'SUBSIDIARY', name: 'Zeus The Agency' });
stubDb._seed(`organizations/${OTHER_BRAND_ORG}`, { id: OTHER_BRAND_ORG, kind: 'SUBSIDIARY', name: 'Labyrinth' });

const BRAND_AD_UID = 'user_brand_ad_001';
stubDb._seed(`users/${BRAND_AD_UID}`, {
  uid: BRAND_AD_UID,
  homeOrgId: BRAND_ORG,
  globalRole: 'member',
  subsidiaryAccess: [{ subsidiaryId: BRAND_ORG, hasAccess: true }],
});

const OTHER_BRAND_AD_UID = 'user_other_brand_ad';
stubDb._seed(`users/${OTHER_BRAND_AD_UID}`, {
  uid: OTHER_BRAND_AD_UID,
  homeOrgId: OTHER_BRAND_ORG,
  globalRole: 'member',
  subsidiaryAccess: [{ subsidiaryId: OTHER_BRAND_ORG, hasAccess: true }],
});

// Brand-owned client — primaryBrandId points at BRAND_ORG.
const BRAND_CLIENT_ID = 'client_brand_owned';
stubDb._seed(`clients/${BRAND_CLIENT_ID}`, {
  id: BRAND_CLIENT_ID,
  parentOrgId: PARENT_ORG,
  primaryBrandId: BRAND_ORG,
  name: 'Brand-direct Client',
  status: 'ACTIVE',
});

// Parent-owned client — for negative tests.
const PARENT_CLIENT_ID = 'client_parent_owned';
stubDb._seed(`clients/${PARENT_CLIENT_ID}`, {
  id: PARENT_CLIENT_ID,
  parentOrgId: PARENT_ORG,
  primaryBrandId: PARENT_ORG,
  name: 'Parent-owned Client',
  status: 'ACTIVE',
});

const brandAdAuth = { uid: BRAND_AD_UID, token: { email: 'brand-ad@zeustheagency.test' } };
const otherBrandAdAuth = { uid: OTHER_BRAND_AD_UID, token: { email: 'other@labyrinth.test' } };

// ────────────────────────────────────────────────────────────────
// assertCommercialPrincipal — direct clientId path
// ────────────────────────────────────────────────────────────────

test('assertCommercialPrincipal: home brand AD passes for their client', async () => {
  const result = await auth.assertCommercialPrincipal(brandAdAuth, BRAND_CLIENT_ID);
  assert.equal(result.uid, BRAND_AD_UID);
});

test('assertCommercialPrincipal: other-brand AD is denied for not-their-client', async () => {
  await assert.rejects(
    auth.assertCommercialPrincipal(otherBrandAdAuth, BRAND_CLIENT_ID),
    /permission-denied|COMMERCIAL_SCOPE_REQUIRED/i,
  );
});

test('assertCommercialPrincipal: home brand AD denied for parent-owned client', async () => {
  await assert.rejects(
    auth.assertCommercialPrincipal(brandAdAuth, PARENT_CLIENT_ID),
    /permission-denied|COMMERCIAL_SCOPE_REQUIRED/i,
  );
});

test('assertCommercialPrincipal: missing clientId throws invalid-argument', async () => {
  await assert.rejects(
    auth.assertCommercialPrincipal(brandAdAuth, undefined),
    /clientId is required/,
  );
});

test('assertCommercialPrincipal: missing auth throws unauthenticated', async () => {
  await assert.rejects(
    auth.assertCommercialPrincipal(null, BRAND_CLIENT_ID),
    /Authentication required/,
  );
});

test('assertCommercialPrincipal: non-existent client → permission-denied (does not leak existence)', async () => {
  // Brand AD trying to query a client that doesn't exist gets the
  // same error code as a brand mismatch — no existence leak.
  await assert.rejects(
    auth.assertCommercialPrincipal(brandAdAuth, 'client_does_not_exist'),
    (err) => err && err.code === 'permission-denied',
  );
});

// ────────────────────────────────────────────────────────────────
// assertCommercialPrincipalForResource — doc-resolved path
// ────────────────────────────────────────────────────────────────

test('assertCommercialPrincipalForResource: home brand AD passes for a doc with matching clientId', async () => {
  // Seed an MSA owned by the brand.
  stubDb._seed(`msas/msa_brand_1`, { id: 'msa_brand_1', clientId: BRAND_CLIENT_ID, status: 'DRAFT' });
  const ref = _adminDb.doc('msas/msa_brand_1');
  const result = await auth.assertCommercialPrincipalForResource(brandAdAuth, ref);
  assert.equal(result.uid, BRAND_AD_UID);
  assert.equal(result.data.clientId, BRAND_CLIENT_ID);
});

test('assertCommercialPrincipalForResource: missing doc → permission-denied for subsidiary (existence not leaked)', async () => {
  const ref = _adminDb.doc('msas/msa_does_not_exist');
  await assert.rejects(
    auth.assertCommercialPrincipalForResource(brandAdAuth, ref),
    (err) => err && err.code === 'permission-denied',
  );
});

test('assertCommercialPrincipalForResource: doc with no clientId → permission-denied (no parent fallback for brand AD)', async () => {
  stubDb._seed(`msas/msa_legacy`, { id: 'msa_legacy', status: 'DRAFT' /* no clientId */ });
  const ref = _adminDb.doc('msas/msa_legacy');
  await assert.rejects(
    auth.assertCommercialPrincipalForResource(brandAdAuth, ref),
    (err) => err && err.code === 'permission-denied',
  );
});

test('assertCommercialPrincipalForResource: other brand AD denied even when doc exists', async () => {
  stubDb._seed(`sows/sow_brand_1`, { id: 'sow_brand_1', clientId: BRAND_CLIENT_ID, status: 'DRAFT' });
  const ref = _adminDb.doc('sows/sow_brand_1');
  await assert.rejects(
    auth.assertCommercialPrincipalForResource(otherBrandAdAuth, ref),
    (err) => err && err.code === 'permission-denied',
  );
});
