/**
 * Backfill `commercialOwnerOrgId` on all existing clients —
 * Phase Q2 (ADR-0001).
 *
 * Pre-Q2 every client was owned by Zeus Group's Account-Management
 * team (the only commercial path). Q2 introduces brand-direct sales,
 * but every pre-existing client legitimately belongs to the group.
 * This migration sets `commercialOwnerOrgId = 'zeus-group'` on any
 * client doc that doesn't already have one.
 *
 * Idempotent: skips docs that already have the field set (so admins
 * who manually assigned a brand owner are preserved). Safe to re-run.
 *
 * Pages through the `clients` collection in batches of 200 to keep
 * each Firestore batch write under the 500-op limit.
 *
 * Admin-only callable. Run once post-Q2 deploy.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const PARENT_ORG_ID = 'zeus-group';
const BATCH_SIZE = 200;

/**
 * Pure-ish runner. Iterates pages of clients; writes
 * `commercialOwnerOrgId` on each that doesn't already have one.
 *
 * Returns `{ scanned, updated, alreadyOwned }` for observability.
 */
async function runBackfill({ firestore = db } = {}) {
  let scanned = 0;
  let updated = 0;
  let alreadyOwned = 0;
  let lastDoc = null;

  // eslint-disable-next-line no-constant-condition
  while (true) {
    let q = firestore.collection('clients').orderBy('__name__').limit(BATCH_SIZE);
    if (lastDoc) q = q.startAfter(lastDoc);
    const snap = await q.get();
    if (snap.empty) break;

    const batch = firestore.batch();
    let touchedThisPage = 0;
    for (const doc of snap.docs) {
      scanned += 1;
      const data = doc.data();
      if (data && data.commercialOwnerOrgId) {
        alreadyOwned += 1;
        continue;
      }
      batch.update(doc.ref, {
        commercialOwnerOrgId: PARENT_ORG_ID,
        updatedAt: new Date().toISOString(),
      });
      touchedThisPage += 1;
    }
    if (touchedThisPage > 0) {
      await batch.commit();
      updated += touchedThisPage;
    }

    lastDoc = snap.docs[snap.docs.length - 1];
    if (snap.size < BATCH_SIZE) break;
  }

  return { scanned, updated, alreadyOwned };
}

exports.runBackfill = runBackfill;

exports.backfillCommercialOwnerOnClients = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  async (request) => {
    if (!request.auth || !request.auth.uid) {
      throw new HttpsError('unauthenticated', 'Authentication required.');
    }
    const SUPER_EMAILS = new Set([
      'onzimai@zeusgroup.co.ug',
      'onzimai@dawin.group',
      'admin@zeusgroup.co.ug',
    ]);
    const email = request.auth.token && request.auth.token.email;
    if (!email || !SUPER_EMAILS.has(email)) {
      throw new HttpsError('permission-denied', 'Migration is super-user only.');
    }
    return runBackfill({});
  },
);
