/**
 * assertCommercialPrincipal — Q2 unit tests (ADR-0001).
 *   cd functions && node --test __tests__/assignment/assertCommercialPrincipal.test.js
 *
 * The helper is shaped around the v1.1 §15.5 Q2 answer: "brands also
 * sell direct". Two acceptance paths:
 *
 *   (a) parent-org principal — always passes regardless of
 *       allowedBrandIds (Zeus Group AM can sign for any brand).
 *
 *   (b) brand-direct — caller's homeOrgId ∈ allowedBrandIds AND
 *       carries commercialLeadFor flag (canonical) OR is an admin
 *       with subsidiary access to that brand (legacy fallback).
 *
 * Backfill migration tests live in runBackfill.test.js.
 */

const test = require('node:test');
const assert = require('node:assert/strict');

// Stub firebase-admin BEFORE requiring the module under test, so the
// auth helper's `getFirestore()` calls hit the test store.
const Module = require('module');
const originalResolve = Module._resolveFilename;
const inMemoryStore = new Map();

function stubAdminFirestore() {
  const stub = {
    doc(path) {
      return {
        async get() {
          const data = inMemoryStore.get(path);
          return { exists: !!data, data: () => data };
        },
      };
    },
  };
  const originalRequire = Module.prototype.require;
  Module.prototype.require = function patched(id) {
    if (id === 'firebase-admin/firestore') {
      return { getFirestore: () => stub };
    }
    return originalRequire.apply(this, arguments);
  };
  return stub;
}

stubAdminFirestore();
const { assertCommercialPrincipal, PARENT_ORG_ID } = require('../../src/assignment/lib/auth');

function seedUser(uid, data) {
  inMemoryStore.set(`organizations/default/users/${uid}`, data);
}
function seedRootUser(uid, data) {
  inMemoryStore.set(`users/${uid}`, data);
}
function seedOrg(orgId, data) {
  inMemoryStore.set(`organizations/${orgId}`, data);
}
function resetStore() {
  inMemoryStore.clear();
  seedOrg(PARENT_ORG_ID, { kind: 'PARENT' });
  seedOrg('zeus-the-agency', { kind: 'SUBSIDIARY' });
  seedOrg('zeus-digital', { kind: 'SUBSIDIARY' });
  seedOrg('odd-gorilla', { kind: 'SUBSIDIARY' });
}

// ----- happy paths ----------------------------------------------------

test('unauthenticated → throws unauthenticated', async () => {
  resetStore();
  await assert.rejects(
    () => assertCommercialPrincipal(null),
    /Authentication required/,
  );
});

test('no user doc → permission-denied', async () => {
  resetStore();
  await assert.rejects(
    () => assertCommercialPrincipal({ uid: 'u-ghost' }),
    /no user profile/,
  );
});

test('super-user email → always passes, satisfiedAs=parent', async () => {
  resetStore();
  seedRootUser('u-daniel', { homeOrgId: 'zeus-the-agency' }); // even with a brand homeOrg
  const r = await assertCommercialPrincipal(
    { uid: 'u-daniel', token: { email: 'onzimai@zeusgroup.co.ug' } },
    { allowedBrandIds: null },
  );
  assert.equal(r.satisfiedAs, 'parent');
});

test('parent-org user (homeOrgId=zeus-group) → passes regardless of allowedBrandIds', async () => {
  resetStore();
  seedUser('u-am', { homeOrgId: PARENT_ORG_ID });
  const r1 = await assertCommercialPrincipal({ uid: 'u-am', token: {} });
  assert.equal(r1.satisfiedAs, 'parent');

  // Same caller against a brand-scoped guard — still satisfied as parent.
  const r2 = await assertCommercialPrincipal(
    { uid: 'u-am', token: {} },
    { allowedBrandIds: ['zeus-the-agency'] },
  );
  assert.equal(r2.satisfiedAs, 'parent');
});

test('parent-org legacy path (subsidiaryAccess to zeus-group + admin) → passes', async () => {
  resetStore();
  seedUser('u-legacy', {
    globalRole: 'admin',
    subsidiaryAccess: [{ subsidiaryId: PARENT_ORG_ID, hasAccess: true }],
  });
  const r = await assertCommercialPrincipal({ uid: 'u-legacy', token: {} });
  assert.equal(r.satisfiedAs, 'parent');
});

// ----- brand-direct path ----------------------------------------------

test('brand-direct with commercialLeadFor flag → passes, satisfiedAs=brandId', async () => {
  resetStore();
  seedUser('u-zd-ad', {
    homeOrgId: 'zeus-digital',
    commercialLeadFor: ['zeus-digital'],
  });
  const r = await assertCommercialPrincipal(
    { uid: 'u-zd-ad', token: {} },
    { allowedBrandIds: ['zeus-digital'] },
  );
  assert.equal(r.satisfiedAs, 'zeus-digital');
});

test('brand-direct legacy fallback (admin + subsidiaryAccess to brand) → passes', async () => {
  resetStore();
  seedUser('u-zta-admin', {
    homeOrgId: 'zeus-the-agency',
    globalRole: 'admin',
    subsidiaryAccess: [{ subsidiaryId: 'zeus-the-agency', hasAccess: true }],
  });
  const r = await assertCommercialPrincipal(
    { uid: 'u-zta-admin', token: {} },
    { allowedBrandIds: ['zeus-the-agency'] },
  );
  assert.equal(r.satisfiedAs, 'zeus-the-agency');
});

test('brand-direct caller for wrong brand → permission-denied', async () => {
  resetStore();
  seedUser('u-zta-ad', {
    homeOrgId: 'zeus-the-agency',
    commercialLeadFor: ['zeus-the-agency'],
  });
  // ZTA AD calls a CFn that's scoped to zeus-digital-owned accounts.
  await assert.rejects(
    () => assertCommercialPrincipal(
      { uid: 'u-zta-ad', token: {} },
      { allowedBrandIds: ['zeus-digital'] },
    ),
    /COMMERCIAL_SCOPE_REQUIRED/,
  );
});

test('brand-direct caller without commercialLeadFor OR admin → permission-denied', async () => {
  resetStore();
  seedUser('u-zd-junior', {
    homeOrgId: 'zeus-digital',
    // No commercialLeadFor; not admin.
  });
  await assert.rejects(
    () => assertCommercialPrincipal(
      { uid: 'u-zd-junior', token: {} },
      { allowedBrandIds: ['zeus-digital'] },
    ),
    /COMMERCIAL_SCOPE_REQUIRED/,
  );
});

test('parent-org-only guard (allowedBrandIds empty) rejects brand-direct callers', async () => {
  resetStore();
  seedUser('u-zd-ad', {
    homeOrgId: 'zeus-digital',
    commercialLeadFor: ['zeus-digital'],
  });
  // No allowedBrandIds passed — back-compat with assertParentOrgPrincipal.
  await assert.rejects(
    () => assertCommercialPrincipal({ uid: 'u-zd-ad', token: {} }),
    /COMMERCIAL_SCOPE_REQUIRED/,
  );
});

test('allowedBrandIds with multiple brands → matches if homeOrg is any of them', async () => {
  resetStore();
  seedUser('u-og-ad', {
    homeOrgId: 'odd-gorilla',
    commercialLeadFor: ['odd-gorilla'],
  });
  const r = await assertCommercialPrincipal(
    { uid: 'u-og-ad', token: {} },
    { allowedBrandIds: ['zeus-the-agency', 'odd-gorilla', 'zeus-digital'] },
  );
  assert.equal(r.satisfiedAs, 'odd-gorilla');
});

test('error message mentions allowedBrandIds for diagnostic clarity', async () => {
  resetStore();
  seedUser('u-no-scope', { homeOrgId: 'zeus-digital' });
  try {
    await assertCommercialPrincipal(
      { uid: 'u-no-scope', token: {} },
      { allowedBrandIds: ['zeus-the-agency'] },
    );
    assert.fail('expected to throw');
  } catch (err) {
    assert.match(err.message, /parent OR brand-direct/);
    assert.match(err.message, /zeus-the-agency/);
  }
});
