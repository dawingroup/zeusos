/**
 * recomputeSceneRollup — Cloud Function (Firestore Trigger)
 *
 * Recomputes scene totals (cabinet count, total value) when
 * cabinets subcollection changes.
 */

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

const recomputeSceneRollup = onDocumentWritten(
  {
    document: 'designScenes/{sceneId}/cabinets/{cabinetId}',
    region: 'us-central1',
  },
  async (event) => {
    const sceneId = event.params.sceneId;

    const cabinetsSnap = await db.collection('designScenes').doc(sceneId)
      .collection('cabinets').get();

    let totalValue = 0;
    for (const doc of cabinetsSnap.docs) {
      const data = doc.data();
      const price = data.estimatedPrice;
      if (price && typeof price.total === 'number') {
        totalValue += price.total;
      }
    }

    await db.collection('designScenes').doc(sceneId).update({
      totalCabinetCount: cabinetsSnap.size,
      totalEstimatedValue: totalValue,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info(`Scene ${sceneId} rollup: ${cabinetsSnap.size} cabinets, value=${totalValue}`);
  },
);

module.exports = { recomputeSceneRollup };
