#!/usr/bin/env node
/**
 * Backfill Design Manager RAG status for items that already have 3D files.
 *
 * Why:
 * - Some legacy uploads existed before automatic RAG updates.
 * - Items can have 3D files in `projectFiles` but `ragStatus.designCompleteness.model3D`
 *   is still red/amber.
 *
 * What this script does:
 * 1) Finds design items that have at least one latest 3D-related file in `projectFiles`
 *    (either `category: 'cad-model'` OR `deliverableType: '3d-model'`).
 * 2) Updates `ragStatus.designCompleteness.model3D` to green when current status is
 *    not green and not not-applicable.
 * 3) Recalculates and updates `overallReadiness`.
 *
 * Safety:
 * - Dry-run by default.
 * - Pass --apply to write.
 *
 * Usage:
 *   node scripts/backfill-model3d-rag-status.cjs
 *   node scripts/backfill-model3d-rag-status.cjs --apply
 *   node scripts/backfill-model3d-rag-status.cjs --apply --limit=200
 *   node scripts/backfill-model3d-rag-status.cjs --project=<projectId>
 *   node scripts/backfill-model3d-rag-status.cjs --item=<itemId>
 *
 * Optional auth:
 *   GOOGLE_APPLICATION_CREDENTIALS=/path/to/serviceAccount.json \
 *   node scripts/backfill-model3d-rag-status.cjs --apply
 */

'use strict';

const admin = require('firebase-admin');

const argv = process.argv.slice(2);
const APPLY = argv.includes('--apply');
const LIMIT = Number((argv.find((a) => a.startsWith('--limit=')) || '').split('=')[1]) || Infinity;
const PROJECT_FILTER = (argv.find((a) => a.startsWith('--project=')) || '').split('=')[1] || null;
const ITEM_FILTER = (argv.find((a) => a.startsWith('--item=')) || '').split('=')[1] || null;
const UPDATED_BY = 'backfill-model3d-rag-status-script';

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

function calculateOverallReadiness(ragStatus) {
  if (!ragStatus) return 0;
  const allAspects = [
    ...Object.values(ragStatus.designCompleteness || {}),
    ...Object.values(ragStatus.manufacturingReadiness || {}),
    ...Object.values(ragStatus.qualityGates || {}),
  ];
  const applicable = allAspects.filter((a) => a && a.status !== 'not-applicable');
  if (applicable.length === 0) return 0;
  const total = applicable.reduce((sum, a) => {
    if (a.status === 'green') return sum + 100;
    if (a.status === 'amber') return sum + 50;
    return sum;
  }, 0);
  return Math.round(total / applicable.length);
}

function cloneRagWithModel3dGreen(ragStatus) {
  const next = {
    ...ragStatus,
    designCompleteness: {
      ...(ragStatus.designCompleteness || {}),
      model3D: {
        ...(ragStatus.designCompleteness?.model3D || {}),
        status: 'green',
        notes: 'Backfill: 3D model file exists in projectFiles',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: UPDATED_BY,
      },
    },
  };
  return next;
}

function parseItemKey(docData) {
  const projectId = docData.projectId || null;
  const itemId = docData.itemId || null;
  if (!projectId || !itemId) return null;
  return `${projectId}::${itemId}`;
}

async function getCandidateItemKeys() {
  const keyMap = new Map();

  // Query A: CAD category files (covers legacy Studio uploads).
  let cadQ = db.collection('projectFiles')
    .where('category', '==', 'cad-model')
    .where('isLatest', '==', true);
  if (PROJECT_FILTER) cadQ = cadQ.where('projectId', '==', PROJECT_FILTER);
  if (ITEM_FILTER) cadQ = cadQ.where('itemId', '==', ITEM_FILTER);
  const cadSnap = await cadQ.get();

  for (const doc of cadSnap.docs) {
    const data = doc.data();
    const key = parseItemKey(data);
    if (!key) continue;
    if (!keyMap.has(key)) {
      keyMap.set(key, {
        projectId: data.projectId,
        itemId: data.itemId,
        evidence: data.fileName || data.name || doc.id,
      });
    }
  }

  // Query B: explicit 3d-model deliverableType files (covers non-cad category cases).
  let d3Q = db.collection('projectFiles')
    .where('deliverableType', '==', '3d-model')
    .where('isLatest', '==', true);
  if (PROJECT_FILTER) d3Q = d3Q.where('projectId', '==', PROJECT_FILTER);
  if (ITEM_FILTER) d3Q = d3Q.where('itemId', '==', ITEM_FILTER);
  const d3Snap = await d3Q.get();

  for (const doc of d3Snap.docs) {
    const data = doc.data();
    const key = parseItemKey(data);
    if (!key) continue;
    if (!keyMap.has(key)) {
      keyMap.set(key, {
        projectId: data.projectId,
        itemId: data.itemId,
        evidence: data.fileName || data.name || doc.id,
      });
    }
  }

  return Array.from(keyMap.values());
}

async function main() {
  console.log(
    `[backfill-model3d-rag-status] mode=${APPLY ? 'APPLY' : 'DRY-RUN'} ` +
    `project=${PROJECT_FILTER || 'all'} item=${ITEM_FILTER || 'all'} limit=${LIMIT}`
  );

  const candidates = await getCandidateItemKeys();
  console.log(`[scan] found ${candidates.length} unique items with 3D files`);

  if (candidates.length === 0) {
    console.log('[done] no candidate items found');
    return;
  }

  const capped = Number.isFinite(LIMIT) ? candidates.slice(0, LIMIT) : candidates;
  if (capped.length < candidates.length) {
    console.log(`[scan] applying limit -> ${capped.length} items`);
  }

  const updates = [];
  let missingItems = 0;
  let noRagStatus = 0;
  let alreadyGreen = 0;
  let skippedNotApplicable = 0;

  for (const candidate of capped) {
    const itemRef = db
      .collection('designProjects')
      .doc(candidate.projectId)
      .collection('designItems')
      .doc(candidate.itemId);

    const snap = await itemRef.get();
    if (!snap.exists) {
      missingItems++;
      continue;
    }

    const item = snap.data() || {};
    const ragStatus = item.ragStatus;
    const current = ragStatus?.designCompleteness?.model3D;
    if (!ragStatus || !current) {
      noRagStatus++;
      continue;
    }
    if (current.status === 'green') {
      alreadyGreen++;
      continue;
    }
    if (current.status === 'not-applicable') {
      skippedNotApplicable++;
      continue;
    }

    const nextRagStatus = cloneRagWithModel3dGreen(ragStatus);
    const nextReadiness = calculateOverallReadiness(nextRagStatus);

    updates.push({
      ref: itemRef,
      projectId: candidate.projectId,
      itemId: candidate.itemId,
      evidence: candidate.evidence,
      from: current.status,
      to: 'green',
      nextRagStatus,
      nextReadiness,
    });
  }

  console.log(
    `[plan] updates=${updates.length} alreadyGreen=${alreadyGreen} ` +
    `skippedNA=${skippedNotApplicable} missingItems=${missingItems} noRag=${noRagStatus}`
  );

  if (updates.length === 0) {
    console.log('[done] nothing to update');
    return;
  }

  console.log('[preview] first rows to update:');
  for (const row of updates.slice(0, 10)) {
    console.log(
      `  - ${row.projectId}/${row.itemId} ${row.from} -> ${row.to} ` +
      `(evidence="${row.evidence}")`
    );
  }

  if (!APPLY) {
    console.log('[dry-run] pass --apply to write changes');
    return;
  }

  let written = 0;
  for (let i = 0; i < updates.length; i += BATCH_LIMIT) {
    const chunk = updates.slice(i, i + BATCH_LIMIT);
    const batch = db.batch();
    for (const row of chunk) {
      batch.update(row.ref, {
        ragStatus: row.nextRagStatus,
        overallReadiness: row.nextReadiness,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: UPDATED_BY,
      });
    }
    await batch.commit();
    written += chunk.length;
    console.log(
      `[write] batch ${Math.floor(i / BATCH_LIMIT) + 1} committed (${written}/${updates.length})`
    );
  }

  console.log(`[done] updated ${written} design items`);
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('[fatal]', err);
    process.exit(1);
  });

