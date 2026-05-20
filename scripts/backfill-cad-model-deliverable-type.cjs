#!/usr/bin/env node
/**
 * Backfill legacy CAD files in `projectFiles` so Design Manager can treat them
 * as 3D deliverables consistently.
 *
 * Why:
 * - Older Design Studio uploads were stored as `category: 'cad-model'` but
 *   often missed `deliverableType: '3d-model'`.
 * - The deliverable type is what RAG/deliverables flows key off.
 *
 * What this script updates:
 * - projectFiles docs where:
 *   - category == 'cad-model'
 *   - isLatest == true
 *   - deliverableType is missing OR not equal to '3d-model'
 * - sets:
 *   - deliverableType: '3d-model'
 *   - updatedAt: serverTimestamp()
 *
 * Safety:
 * - Dry-run by default (no writes).
 * - Pass --apply to execute writes.
 *
 * Usage:
 *   node scripts/backfill-cad-model-deliverable-type.cjs
 *   node scripts/backfill-cad-model-deliverable-type.cjs --apply
 *   node scripts/backfill-cad-model-deliverable-type.cjs --apply --limit=200
 *   node scripts/backfill-cad-model-deliverable-type.cjs --project=<projectId>
 *   node scripts/backfill-cad-model-deliverable-type.cjs --item=<itemId>
 *
 * Optional auth:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *   node scripts/backfill-cad-model-deliverable-type.cjs --apply
 */

'use strict';

const admin = require('firebase-admin');

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const LIMIT = Number((argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || Infinity;
const PROJECT_FILTER = (argv.find((a) => a.startsWith('--project=')) || '').split('=')[1] || null;
const ITEM_FILTER = (argv.find((a) => a.startsWith('--item=')) || '').split('=')[1] || null;

if (!admin.apps.length) {
  const serviceAccountPath = argv.find((a) => a.startsWith('--service-account='))?.split('=')[1];
  const credential = serviceAccountPath
    ? admin.credential.cert(require(require('path').resolve(serviceAccountPath)))
    : admin.credential.applicationDefault();
  admin.initializeApp({
    credential,
    projectId: process.env.GCLOUD_PROJECT || process.env.FIREBASE_PROJECT_ID || 'dawinos',
  });
}

const db = admin.firestore();
const BATCH_LIMIT = 400;

function shouldPatch(data) {
  const isCad = data.category === 'cad-model';
  const isLatest = data.isLatest !== false;
  const hasExpectedType = data.deliverableType === '3d-model';
  return isCad && isLatest && !hasExpectedType;
}

async function main() {
  console.log(
    `[backfill-cad-model-deliverable-type] mode=${APPLY ? 'APPLY' : 'DRY-RUN'} ` +
      `project=${PROJECT_FILTER || 'all'} item=${ITEM_FILTER || 'all'} limit=${LIMIT}`
  );

  let q = db.collection('projectFiles')
    .where('category', '==', 'cad-model')
    .where('isLatest', '==', true);

  if (PROJECT_FILTER) q = q.where('projectId', '==', PROJECT_FILTER);
  if (ITEM_FILTER) q = q.where('itemId', '==', ITEM_FILTER);

  const snap = await q.get();
  console.log(`[scan] fetched ${snap.size} candidate cad-model latest docs`);

  const toPatch = [];
  let alreadyCorrect = 0;

  for (const doc of snap.docs) {
    const data = doc.data();
    if (shouldPatch(data)) {
      toPatch.push({
        ref: doc.ref,
        id: doc.id,
        projectId: data.projectId || null,
        itemId: data.itemId || null,
        fileName: data.fileName || data.name || '(unnamed)',
        oldDeliverableType: data.deliverableType || null,
      });
    } else {
      alreadyCorrect++;
    }
  }

  console.log(
    `[scan] needsPatch=${toPatch.length} alreadyCorrect=${alreadyCorrect}`
  );

  if (toPatch.length === 0) {
    console.log('[done] nothing to backfill');
    return;
  }

  const preview = toPatch.slice(0, 10);
  console.log('[preview] first rows to patch:');
  for (const row of preview) {
    console.log(
      `  - ${row.id} | project=${row.projectId || '—'} item=${row.itemId || '—'} ` +
      `file="${row.fileName}" oldType=${row.oldDeliverableType || 'null'}`
    );
  }

  if (!APPLY) {
    console.log('[dry-run] pass --apply to write changes');
    return;
  }

  let patched = 0;
  const capped = Number.isFinite(LIMIT) ? toPatch.slice(0, LIMIT) : toPatch;

  for (let i = 0; i < capped.length; i += BATCH_LIMIT) {
    const chunk = capped.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const row of chunk) {
      batch.update(row.ref, {
        deliverableType: '3d-model',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    patched += chunk.length;
    console.log(
      `[write] batch ${Math.floor(i / BATCH_LIMIT) + 1} committed (${patched}/${capped.length})`
    );
  }

  if (capped.length < toPatch.length) {
    console.log(`[done] patched ${patched} docs (limited from ${toPatch.length} by --limit=${LIMIT})`);
  } else {
    console.log(`[done] patched ${patched} docs`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[fatal]', err);
    process.exit(1);
  });

