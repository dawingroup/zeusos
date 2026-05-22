/**
 * Seed E2E test users — Phase 3.G.
 *
 * Creates two Firebase Auth accounts AND their matching `/users/{uid}`
 * Firestore documents that the Playwright lifecycle spec
 * (e2e/tests/workflows/pricing-quote-lifecycle.spec.ts) signs in as:
 *
 *   1. pricing-admin@zeusgroup.test
 *        - globalRole: 'admin' (parent-org PRICING_ADMIN)
 *        - homeOrgId : 'zeus-group'  (PARENT)
 *        - subsidiaryAccess: all 5 sub-brands + zeus-group
 *
 *   2. subsidiary-user@zeusgroup.test
 *        - globalRole: 'member'
 *        - homeOrgId : 'zeus-the-agency'  (SUBSIDIARY)
 *        - subsidiaryAccess: zeus-the-agency only
 *
 * Both accounts share the password `e2e-test-password` for convenience.
 * The script is intended for the Firebase emulator (Auth + Firestore);
 * setting `FIREBASE_AUTH_EMULATOR_HOST` and `FIRESTORE_EMULATOR_HOST`
 * (the standard env vars) before running is enough.
 *
 * Run (under `firebase emulators:exec` or with the emulators already up):
 *   FIRESTORE_EMULATOR_HOST=localhost:8080 \
 *   FIREBASE_AUTH_EMULATOR_HOST=localhost:9099 \
 *   node scripts/seed-e2e-users.cjs
 *
 * Idempotent — re-running deletes the existing test users and re-creates
 * them with current shape (since shape may evolve as 3.A.5 / 3.E land).
 */

const admin = require('firebase-admin');

const PROJECT_ID = process.env.GCLOUD_PROJECT || 'zeusos-e2e';

admin.initializeApp({ projectId: PROJECT_ID });

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
];

async function deleteExisting(email) {
  try {
    const user = await auth.getUserByEmail(email);
    await auth.deleteUser(user.uid);
  } catch (err) {
    if (err.code !== 'auth/user-not-found') throw err;
  }
}

async function main() {
  console.log(`\n  Seeding E2E users against project "${PROJECT_ID}"`);
  if (process.env.FIREBASE_AUTH_EMULATOR_HOST) {
    console.log(`  Auth emulator     : ${process.env.FIREBASE_AUTH_EMULATOR_HOST}`);
  }
  if (process.env.FIRESTORE_EMULATOR_HOST) {
    console.log(`  Firestore emulator: ${process.env.FIRESTORE_EMULATOR_HOST}`);
  }
  console.log('');

  for (const user of USERS) {
    await deleteExisting(user.email);

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

    console.log(`  ✓ ${user.email.padEnd(34)} uid=${created.uid}  role=${user.profile.globalRole}  homeOrgId=${user.profile.homeOrgId}`);
  }

  console.log(`\n  Done. Password for both: ${TEST_PASSWORD}\n`);
}

main().catch((err) => {
  console.error('\n  FATAL:', err);
  process.exit(1);
});
