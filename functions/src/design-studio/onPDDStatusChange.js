/**
 * onPDDStatusChange — Firestore Trigger
 *
 * Watches the `productDefinitions` collection for status changes.
 * - approved → auto-generate MDP
 * - archived → cleanup related data
 */

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

const onPDDStatusChange = onDocumentUpdated(
  {
    document: 'productDefinitions/{pddId}',
    region: 'us-central1',
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!before || !after) return;
    if (before.status === after.status) return;

    const pddId = event.params.pddId;
    logger.info('PDD status changed', {
      pddId,
      from: before.status,
      to: after.status,
    });

    switch (after.status) {
      case 'approved':
        await handleApproved(pddId, after);
        break;
      case 'archived':
        await handleArchived(pddId);
        break;
    }
  },
);

/**
 * When PDD is approved, create a placeholder MDP doc to signal readiness.
 */
async function handleApproved(pddId, pdd) {
  logger.info('PDD approved, creating MDP placeholder', { pddId });

  // Create a "ready for MDP" placeholder
  await db.collection('manufacturingDataPackages').add({
    pddId,
    status: 'pending_generation',
    pddName: pdd.name || pddId,
    approvedAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Fire business event
  await db.collection('businessEvents').add({
    type: 'pdd.approved',
    pddId,
    pddName: pdd.name,
    timestamp: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * When PDD is archived, mark related MDPs as archived too.
 */
async function handleArchived(pddId) {
  logger.info('PDD archived, cleaning up related MDPs', { pddId });

  const mdpSnap = await db.collection('manufacturingDataPackages')
    .where('pddId', '==', pddId)
    .get();

  if (mdpSnap.empty) return;

  const batch = db.batch();
  for (const doc of mdpSnap.docs) {
    batch.update(doc.ref, {
      status: 'archived',
      archivedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();

  logger.info('Archived MDPs', { pddId, count: mdpSnap.size });
}

module.exports = { onPDDStatusChange };
