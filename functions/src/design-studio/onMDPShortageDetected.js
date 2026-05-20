/**
 * onMDPShortageDetected — Firestore Trigger
 *
 * Watches the `manufacturingDataPackages` collection for new documents.
 * When an MDP is created with shortages, flags them on the MDP document
 * with supplier information so Design Manager's procurement workflow
 * can create POs.
 *
 * Design Studio does NOT create POs directly — that responsibility
 * belongs to Design Manager's procurement workflow.
 */

const { onDocumentCreated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

const onMDPShortageDetected = onDocumentCreated(
  {
    document: 'manufacturingDataPackages/{mdpId}',
    region: 'us-central1',
  },
  async (event) => {
    const mdpData = event.data?.data();
    if (!mdpData) return;

    const shortages = mdpData.shortages || [];
    if (shortages.length === 0) {
      logger.info('No shortages in MDP, skipping', { mdpId: event.params.mdpId });
      return;
    }

    logger.info('MDP shortages detected, flagging for procurement', {
      mdpId: event.params.mdpId,
      shortageCount: shortages.length,
    });

    // Enrich shortages with preferred supplier info from inventory
    const enrichedShortages = [];

    for (const shortage of shortages) {
      let preferredSupplier = null;

      if (shortage.inventoryItemId) {
        try {
          const itemSnap = await db.collection('inventoryItems').doc(shortage.inventoryItemId).get();
          if (itemSnap.exists) {
            const item = itemSnap.data();
            preferredSupplier = item.preferredSupplier || item.supplierName || null;
          }
        } catch (err) {
          logger.warn('Failed to look up inventory item for supplier', {
            inventoryItemId: shortage.inventoryItemId,
            error: err.message,
          });
        }
      }

      enrichedShortages.push({
        ...shortage,
        preferredSupplier,
      });
    }

    // Flag the MDP with shortage details for Design Manager's procurement workflow
    await event.data.ref.update({
      shortageStatus: 'flagged',
      shortageCount: enrichedShortages.length,
      enrichedShortages,
      shortagesFlaggedAt: admin.firestore.FieldValue.serverTimestamp(),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info('MDP shortages flagged for procurement', {
      mdpId: event.params.mdpId,
      shortageCount: enrichedShortages.length,
    });
  },
);

module.exports = { onMDPShortageDetected };
