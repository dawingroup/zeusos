/**
 * Phase 3.D — Layer-2 enforcement of "subsidiary never quotes" (spec §7.4).
 *
 * Every AM-side Cloud Function MUST reject subsidiary principals with
 * `permission-denied` / `COMMERCIAL_SCOPE_REQUIRED`. This test uses the
 * REAL `assertParentOrgPrincipal` (no monkey-patch) against a seeded
 * subsidiary user doc.
 *
 * Mirrors the Layer-3 enforcement in `src/router/guards/RoleGuard.tsx`
 * (`requireOrgKind: 'PARENT'`) and the Layer-1 rule in firestore.rules
 * (subsidiary principals denied at `isParentOrgPrincipal()`).
 *
 * Run:
 *   cd functions && node --test __tests__/contracts/subsidiary-403.test.js
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

// IMPORTANT: do NOT call patchAuthForTests — we want the REAL
// `assertParentOrgPrincipal` to run against seeded user docs.
const msaAdmin = require('../../src/contracts/msaAdmin');
const sowAdmin = require('../../src/contracts/sowAdmin');
const coAdmin = require('../../src/contracts/changeOrderAdmin');
const clientAdmin = require('../../src/contracts/clientAdmin');

// Seed organizations: zeus-group (PARENT) + zeus-the-agency (SUBSIDIARY).
stubDb._seed('organizations/zeus-group', {
  id: 'zeus-group', kind: 'PARENT', name: 'Zeus Group',
});
stubDb._seed('organizations/zeus-the-agency', {
  id: 'zeus-the-agency', kind: 'SUBSIDIARY', name: 'Zeus The Agency',
});

// Seed a SUBSIDIARY user (homeOrg = zeus-the-agency). Phase-3.B's
// `assertParentOrgPrincipal` has a 3.A.5 placeholder that treats
// `globalRole='admin'|'owner'` as super-user for now (the spec-aligned
// role-grant lookup arrives with 3.E). The realistic 3.D threat model
// is therefore a subsidiary EMPLOYEE — non-admin globalRole — trying
// to mutate commercial state. That's what this user models.
const SUB_UID = 'user_sub_001';
stubDb._seed(`users/${SUB_UID}`, {
  uid: SUB_UID,
  homeOrgId: 'zeus-the-agency',
  globalRole: 'member',
  subsidiaryAccess: [{ subsidiaryId: 'zeus-the-agency', hasAccess: true }],
});

const subAuth = { uid: SUB_UID, token: { email: 'sub-admin@zeus.test' } };

async function expectDenied(promise, label) {
  await assert.rejects(
    promise,
    (err) => {
      return /permission-denied|COMMERCIAL_SCOPE_REQUIRED/i.test(err?.message ?? '')
        || err?.code === 'permission-denied';
    },
    `${label} should reject subsidiary principal`,
  );
}

test('upsertClient rejects subsidiary admin', async () => {
  await expectDenied(
    clientAdmin.upsertClient({
      auth: subAuth, data: { name: 'Sneaky', billingCurrency: 'USD' },
    }),
    'upsertClient',
  );
});

test('upsertMsa rejects subsidiary admin', async () => {
  await expectDenied(
    msaAdmin.upsertMsa({
      auth: subAuth, data: { clientId: 'c1', title: 'x', effectiveFrom: '2026-01-01' },
    }),
    'upsertMsa',
  );
});

test('activateMsa rejects subsidiary admin', async () => {
  await expectDenied(
    msaAdmin.activateMsa({ auth: subAuth, data: { msaId: 'msa_x' } }),
    'activateMsa',
  );
});

test('upsertSow rejects subsidiary admin', async () => {
  await expectDenied(
    sowAdmin.upsertSow({
      auth: subAuth,
      data: { msaId: 'msa_x', title: 't', type: 'PROJECT', ceilingMinor: 1000, currency: 'USD' },
    }),
    'upsertSow',
  );
});

test('approveSow rejects subsidiary admin', async () => {
  await expectDenied(
    sowAdmin.approveSow({ auth: subAuth, data: { sowId: 'sow_x' } }),
    'approveSow',
  );
});

test('upsertChangeOrder rejects subsidiary admin', async () => {
  await expectDenied(
    coAdmin.upsertChangeOrder({
      auth: subAuth, data: { sowId: 'sow_x', deltaMinor: 1000, reason: 'try' },
    }),
    'upsertChangeOrder',
  );
});

test('approveChangeOrder rejects subsidiary admin', async () => {
  await expectDenied(
    coAdmin.approveChangeOrder({ auth: subAuth, data: { changeOrderId: 'co_x' } }),
    'approveChangeOrder',
  );
});
