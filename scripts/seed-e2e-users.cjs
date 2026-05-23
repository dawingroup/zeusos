/**
 * Seed E2E test users + Firestore fixtures — Phase 3.H.
 *
 * Creates Auth accounts and matching /users/{uid} Firestore documents
 * for every user the Playwright e2e suite signs in as.  Also writes the
 * static Firestore fixtures that the delivery-iwo-lifecycle spec needs
 * (org docs, a seeded IWO in ISSUED state, a matching master_job).
 *
 * Users
 * ─────
 *   1. pricing-admin@zeusgroup.test
 *        - globalRole: 'admin' (parent-org PRICING_ADMIN / AM)
 *        - homeOrgId : 'zeus-group'  (PARENT)
 *        - subsidiaryAccess: all 5 sub-brands + zeus-group
 *
 *   2. subsidiary-user@zeusgroup.test
 *        - globalRole: 'member'
 *        - homeOrgId : 'zeus-the-agency'  (SUBSIDIARY)
 *        - subsidiaryAccess: zeus-the-agency only
 *
 *   3. delivery-lead-zta@zeusgroup.test
 *        - globalRole: 'member'
 *        - homeOrgId : 'zeus-the-agency'  (SUBSIDIARY — delivery workspace)
 *        - subsidiaryAccess: zeus-the-agency
 *
 *   4. am@zeusgroup.test
 *        - globalRole: 'admin'
 *        - homeOrgId : 'zeus-group'  (PARENT — AM role)
 *        - subsidiaryAccess: all
 *
 * All accounts share password `e2e-test-password`.
 *
 * Firestore fixtures (idempotent upserts)
 * ───────────────────────────────────────
 *   organizations/zeus-group               (PARENT)
 *   organizations/zeus-the-agency          (SUBSIDIARY)
 *   organizations/labyrinth                (SUBSIDIARY)
 *   master_jobs/mj-seed-001                (OPEN, owned by zeus-group)
 *   internal_work_orders/iwo-seed-001      (ISSUED to zeus-the-agency)
 *   internal_work_orders/iwo-lab-seed-001  (ISSUED to labyrinth — isolation test)
 *
 * Intended for the Firebase emulator (Auth + Firestore):
 *
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   node scripts/seed-e2e-users.cjs
 *
 * Idempotent: re-running deletes then re-creates Auth users; Firestore
 * docs are set() with { merge: false } so shape stays canonical.
 */

// ──────────────────────────────────────────────────────────────────────────────
// Early-fail diagnostics — the rest of this file performs Admin SDK work
// that, on `firebase-admin@13.6.0`, can wedge for the full GH Actions 6h
// max-duration when ADC credential discovery fails to short-circuit even
// with emulator env vars set. The block below makes the hang visible
// inside 90s with a descriptive FATAL line, instead of silent 6h burn.
//
// See PR #39 investigation for the upstream firebase-admin issue.
// ──────────────────────────────────────────────────────────────────────────────

// Print BEFORE requiring firebase-admin so a wedged Admin-SDK init still
// leaves a visible CI log line.
process.stdout.write('[seed-e2e-users] starting\n');

const SEED_TIMEOUT_MS = Number(process.env.SEED_TIMEOUT_MS) || 90_000;
const timeoutHandle = setTimeout(() => {
  console.error(
    `\n  FATAL: seed-e2e-users.cjs timed out after ${SEED_TIMEOUT_MS}ms.\n` +
      `  Likely causes: Auth/Firestore emulator not ready, or Admin SDK\n` +
      `  hanging on credential discovery (FIREBASE_AUTH_EMULATOR_HOST=` +
      `${process.env.FIREBASE_AUTH_EMULATOR_HOST || 'unset'},\n` +
      `  FIRESTORE_EMULATOR_HOST=${process.env.FIRESTORE_EMULATOR_HOST || 'unset'}).\n`,
  );
  process.exit(2);
}, SEED_TIMEOUT_MS);

const admin = require('firebase-admin');
const crypto = require('crypto');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'zeusos-e2e';

// ──────────────────────────────────────────────────────────────────────────────
// Root-cause workaround for the firebase-admin@13 emulator hang.
//
// In v13, admin.initializeApp() lazily triggers Application Default
// Credential discovery on the first SDK call (e.g. auth.getUserByEmail()).
// In a CI runner without a GCE metadata server, the discovery wedges
// indefinitely on `compute.googleapis.com/.../metadata` lookups — even
// when FIREBASE_AUTH_EMULATOR_HOST and FIRESTORE_EMULATOR_HOST are set
// (the SDK still discovers credentials before consulting emulator env).
//
// Bypass by passing an explicit `cert()` credential built from an
// ephemeral in-memory RSA key. The Firestore init type-checks for
// ServiceAccountCredential (the class `cert()` produces) and accepts
// it, so initialization succeeds without ADC discovery. Every SDK
// operation then routes to the localhost emulator via the env vars
// above, which never validates the credential — the key never touches
// the network.
// ──────────────────────────────────────────────────────────────────────────────
const { privateKey: stubPrivateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  publicKeyEncoding: { type: 'spki', format: 'pem' },
});

admin.initializeApp({
  projectId: PROJECT_ID,
  credential: admin.credential.cert({
    projectId: PROJECT_ID,
    clientEmail: `seed-stub@${PROJECT_ID}.iam.gserviceaccount.com`,
    privateKey: stubPrivateKey,
  }),
});

const auth = admin.auth();
const db = admin.firestore();
db.settings({ ignoreUndefinedProperties: true });

const TEST_PASSWORD = process.env.E2E_USER_PASSWORD || 'e2e-test-password';

const ALL_SUB_BRANDS = [
  'zeus-the-agency',
  'zeus-digital',
  'labyrinth',
  'odd-gorilla',
  'house-of-zeus',
];

const ALL_MODULES = [
  'campaigns', 'media', 'production', 'talent', 'asset-library',
  'asset-registry', 'advisory', 'pricing', 'billing', 'finance',
];

function fullAccess(subsidiaryId) {
  return {
    subsidiaryId,
    hasAccess: true,
    modules: ALL_MODULES.map((moduleId) => ({
      moduleId,
      hasAccess: true,
    })),
  };
}

const USERS = [
  {
    email: 'pricing-admin@zeusgroup.test',
    password: TEST_PASSWORD,
    displayName: 'Phase 3.G Pricing Admin',
    profile: {
      globalRole: 'admin',
      homeOrgId: 'zeus-group',
      subsidiaryAccess: [
        fullAccess('zeus-group'),
        ...ALL_SUB_BRANDS.map(fullAccess),
      ],
    },
  },
  {
    email: 'subsidiary-user@zeusgroup.test',
    password: TEST_PASSWORD,
    displayName: 'Phase 3.G Subsidiary User',
    profile: {
      globalRole: 'member',
      homeOrgId: 'zeus-the-agency',
      subsidiaryAccess: [fullAccess('zeus-the-agency')],
    },
  },
  {
    // Delivery-workspace spec (Phase 3.E) signs in as this user.
    email: 'delivery-lead-zta@zeusgroup.test',
    password: TEST_PASSWORD,
    displayName: 'Zeus The Agency Delivery Lead',
    profile: {
      globalRole: 'member',
      homeOrgId: 'zeus-the-agency',
      subsidiaryAccess: [fullAccess('zeus-the-agency')],
    },
  },
  {
    // Parent-org AM — used in the isolation test "parent is blocked from /delivery/inbox".
    email: 'am@zeusgroup.test',
    password: TEST_PASSWORD,
    displayName: 'Account Manager (Parent)',
    profile: {
      globalRole: 'admin',
      homeOrgId: 'zeus-group',
      subsidiaryAccess: [
        fullAccess('zeus-group'),
        ...ALL_SUB_BRANDS.map(fullAccess),
      ],
    },
  },
];

// ──────────────────────────────────────────────────────────────────────────────
// Firestore fixtures
// ──────────────────────────────────────────────────────────────────────────────

const NOW = new Date().toISOString();
const PAST = '2026-01-01T00:00:00.000Z';

const FIRESTORE_FIXTURES = [
  // Organizations (mirrors scripts/seed-zeus-legal-entities.cjs)
  {
    collection: 'organizations',
    id: 'zeus-group',
    data: {
      id: 'zeus-group',
      name: 'Zeus Group Ltd',
      kind: 'PARENT',
      is_legal_entity: true,
      base_currency: 'USD',
      createdAt: PAST,
    },
  },
  {
    collection: 'organizations',
    id: 'zeus-the-agency',
    data: {
      id: 'zeus-the-agency',
      name: 'Zeus The Agency',
      kind: 'SUBSIDIARY',
      is_legal_entity: true,
      base_currency: 'UGX',
      createdAt: PAST,
    },
  },
  {
    collection: 'organizations',
    id: 'labyrinth',
    data: {
      id: 'labyrinth',
      name: 'Labyrinth',
      kind: 'SUBSIDIARY',
      is_legal_entity: true,
      base_currency: 'UGX',
      createdAt: PAST,
    },
  },

  // Master job backing iwo-seed-001
  {
    collection: 'master_jobs',
    id: 'mj-seed-001',
    data: {
      id: 'mj-seed-001',
      code: 'MJ-SEED-001',
      status: 'OPEN',
      clientId: 'client-seed-001',
      sowId: 'sow-seed-001',
      ceilingMinor: 50000000,   // 500,000 UGX
      allocatedMinor: 15000000, // 150,000 UGX (= iwo-seed-001 budget)
      currency: 'UGX',
      createdAt: PAST,
      updatedAt: NOW,
    },
  },

  // IWO issued to zeus-the-agency — this is what the delivery spec operates on
  {
    collection: 'internal_work_orders',
    id: 'iwo-seed-001',
    data: {
      id: 'iwo-seed-001',
      code: 'IWO-ZTA-SEED-001',
      masterJobId: 'mj-seed-001',
      subsidiaryId: 'zeus-the-agency',
      state: 'ISSUED',
      budgetMinor: 15000000,  // 150,000 UGX
      currency: 'UGX',
      handoffPacketId: 'hp-seed-001',
      createdAt: PAST,
      updatedAt: NOW,
      issuedAt: NOW,
    },
  },

  // IWO issued to labyrinth — must NOT appear in the zeus-the-agency inbox
  {
    collection: 'internal_work_orders',
    id: 'iwo-lab-seed-001',
    data: {
      id: 'iwo-lab-seed-001',
      code: 'IWO-LAB-SEED-001',
      masterJobId: 'mj-seed-001',
      subsidiaryId: 'labyrinth',
      state: 'ISSUED',
      budgetMinor: 8000000,
      currency: 'UGX',
      handoffPacketId: 'hp-lab-seed-001',
      createdAt: PAST,
      updatedAt: NOW,
      issuedAt: NOW,
    },
  },

  // Handoff packet for iwo-seed-001 (must exist for acceptWorkOrder to succeed)
  {
    collection: 'handoff_packets',
    id: 'hp-seed-001',
    data: {
      id: 'hp-seed-001',
      iwoId: 'iwo-seed-001',
      brief_md: '## E2E seed brief\n\nDeliver the Phase 3.H acceptance-gate campaign assets.',
      milestones: [{ id: 'ms-1', title: 'Kick-off', dueDate: '2026-06-01' }],
      acceptance_criteria: [
        { id: 'ac-1', description: 'Brand-compliant assets delivered', signedBy: null, signedAt: null },
      ],
      comms_owner: 'am@zeusgroup.test',
      createdAt: PAST,
      updatedAt: NOW,
    },
  },
];

// ──────────────────────────────────────────────────────────────────────────────

async function deleteExistingUser(email) {
  try {
    const user = await auth.getUserByEmail(email);
    await auth.deleteUser(user.uid);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
  }
}

async function main() {
  console.log(`\n  Seeding E2E users + fixtures against project "${PROJECT_ID}"`);
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    console.log(`  Auth emulator     : ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  }
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.log(`  Firestore emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  }
  console.log('');

  // ── Auth + user docs ──────────────────────────────────────────────────────
  for (const user of USERS) {
    await deleteExistingUser(user.email);

    const created = await auth.createUser({
      email: user.email,
      emailVerified: true,
      password: user.password,
      displayName: user.displayName,
      disabled: false,
    });

    const now = new Date().toISOString();
    await db.collection('users').doc(created.uid).set({
      uid: created.uid,
      email: user.email,
      displayName: user.displayName,
      ...user.profile,
      createdAt: now,
      updatedAt: now,
    });

    console.log(`  ✓ user    ${user.email.padEnd(38)} role=${user.profile.globalRole}  homeOrgId=${user.profile.homeOrgId}`);
  }

  // ── Firestore fixtures ────────────────────────────────────────────────────
  console.log('');
  for (const { collection, id, data } of FIRESTORE_FIXTURES) {
    await db.collection(collection).doc(id).set(data);
    console.log(`  ✓ fixture ${collection}/${id}`);
  }

  // Default password is documented in the file header (line 31).
  // Override via E2E_USER_PASSWORD env var. Not logged here — see header.
  console.log(`\n  Done. ${USERS.length} users + ${FIRESTORE_FIXTURES.length} fixtures seeded.\n`);
}

main()
  .then(() => clearTimeout(timeoutHandle))
  .catch((err) => {
    clearTimeout(timeoutHandle);
    console.error('\n  FATAL:', err);
    process.exit(1);
  });
