/**
 * Backfill `subsidiaryId` on existing socialMediaPosts.
 *
 * Defaults missing subsidiaryId values to 'dawin-finishes' (the only subsidiary
 * historically writing to this collection). Idempotent — docs that already have
 * subsidiaryId are skipped.
 *
 * Run with:
 *   node scripts/backfill-social-post-subsidiary.cjs
 *   node scripts/backfill-social-post-subsidiary.cjs --dry-run
 *   node scripts/backfill-social-post-subsidiary.cjs --default=dawin-finishes
 */

const admin = require('firebase-admin');

admin.initializeApp({ projectId: 'dawinos' });
const db = admin.firestore();

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const defaultArg = args.find((a) => a.startsWith('--default='));
const DEFAULT_SUBSIDIARY = defaultArg ? defaultArg.split('=')[1] : 'dawin-finishes';

const COLLECTION = 'socialMediaPosts';
const BATCH_LIMIT = 400;

async function main() {
  console.log(`Backfilling ${COLLECTION}.subsidiaryId -> "${DEFAULT_SUBSIDIARY}"`);
  if (DRY_RUN) console.log('DRY RUN — no writes');

  const snap = await db.collection(COLLECTION).get();
  console.log(`Scanned ${snap.size} posts`);

  let toUpdate = 0;
  let alreadyTagged = 0;
  let batch = db.batch();
  let opsInBatch = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (data.subsidiaryId) {
      alreadyTagged++;
      continue;
    }
    toUpdate++;
    if (!DRY_RUN) {
      batch.update(doc.ref, {
        subsidiaryId: DEFAULT_SUBSIDIARY,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      opsInBatch++;
      if (opsInBatch >= BATCH_LIMIT) {
        await batch.commit();
        batch = db.batch();
        opsInBatch = 0;
      }
    }
  }

  if (!DRY_RUN && opsInBatch > 0) {
    await batch.commit();
  }

  console.log(`Already tagged: ${alreadyTagged}`);
  console.log(`Updated: ${toUpdate}${DRY_RUN ? ' (would have been)' : ''}`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Backfill failed:', err);
    process.exit(1);
  });
