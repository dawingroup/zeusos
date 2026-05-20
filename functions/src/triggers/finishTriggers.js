/**
 * Finish Triggers - DawinOS v2.0
 * Cloud Function Gen 2 trigger for finish library denormalization sync.
 *
 * When a finish document is updated (name, code, hexColor), cascade changes
 * to all documents that denormalize these fields:
 * - productVariants (finishName, finishCode, hexColor, displayName)
 * - inventoryItems (linkedFinishes array entries)
 *
 * Estimate line items are NOT updated — they are point-in-time snapshots.
 */

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

const db = admin.firestore();

// ────────────────────────────────────────────────────────────────────────────
// onFinishUpdated
// ────────────────────────────────────────────────────────────────────────────

/**
 * When a finish document is updated, cascade name/code/hexColor changes
 * to all documents that denormalize these fields.
 */
exports.onFinishUpdated = onDocumentUpdated('finishLibrary/{finishId}', async (event) => {
  const before = event.data?.before?.data();
  const after = event.data?.after?.data();
  const finishId = event.params.finishId;

  if (!before || !after) {
    logger.warn('onFinishUpdated: Missing before/after data', { finishId });
    return;
  }

  // Only cascade if denormalized fields actually changed
  const nameChanged = before.name !== after.name;
  const codeChanged = before.code !== after.code;
  const colorChanged = before.hexColor !== after.hexColor;

  if (!nameChanged && !codeChanged && !colorChanged) {
    logger.info('onFinishUpdated: No denormalized fields changed, skipping', { finishId });
    return;
  }

  logger.info('onFinishUpdated: Cascading changes', {
    finishId,
    nameChanged,
    codeChanged,
    colorChanged,
    newName: after.name,
    newCode: after.code,
  });

  // Build update payload for variants
  const variantUpdates = {};
  if (nameChanged) variantUpdates.finishName = after.name;
  if (codeChanged) variantUpdates.finishCode = after.code;
  if (colorChanged) variantUpdates.hexColor = after.hexColor || null;
  variantUpdates.updatedAt = FieldValue.serverTimestamp();

  // ── 1. Update productVariants ──────────────────────────────────────────
  try {
    const variantsSnap = await db.collection('productVariants')
      .where('finishId', '==', finishId)
      .get();

    if (!variantsSnap.empty) {
      // Process in batches of 500 (Firestore limit)
      const batches = [];
      let batch = db.batch();
      let count = 0;

      for (const variantDoc of variantsSnap.docs) {
        const updateData = { ...variantUpdates };

        // Regenerate displayName if name changed
        if (nameChanged) {
          const variant = variantDoc.data();
          // Simple display name update: replace old finish name with new one
          if (variant.displayName && typeof variant.displayName === 'string') {
            updateData.displayName = variant.displayName.replace(before.name, after.name);
          }
        }

        batch.update(variantDoc.ref, updateData);
        count++;

        if (count >= 500) {
          batches.push(batch);
          batch = db.batch();
          count = 0;
        }
      }

      if (count > 0) batches.push(batch);

      await Promise.all(batches.map(b => b.commit()));
      logger.info(`onFinishUpdated: Updated ${variantsSnap.size} variants`);
    }
  } catch (err) {
    logger.error('onFinishUpdated: Failed to update variants', { error: err.message });
  }

  // ── 2. Update linkedFinishes on inventoryItems ─────────────────────────
  try {
    const productsSnap = await db.collection('inventoryItems')
      .where('linkedFinishIds', 'array-contains', finishId)
      .get();

    if (!productsSnap.empty) {
      const batches = [];
      let batch = db.batch();
      let count = 0;

      for (const productDoc of productsSnap.docs) {
        const product = productDoc.data();
        const updatedFinishes = (product.linkedFinishes || []).map((lf) => {
          if (lf.finishId === finishId) {
            const updated = { ...lf };
            if (nameChanged) updated.finishName = after.name;
            if (codeChanged) updated.finishCode = after.code;
            return updated;
          }
          return lf;
        });

        batch.update(productDoc.ref, {
          linkedFinishes: updatedFinishes,
          updatedAt: FieldValue.serverTimestamp(),
        });
        count++;

        if (count >= 500) {
          batches.push(batch);
          batch = db.batch();
          count = 0;
        }
      }

      if (count > 0) batches.push(batch);

      await Promise.all(batches.map(b => b.commit()));
      logger.info(`onFinishUpdated: Updated linkedFinishes on ${productsSnap.size} products`);
    }
  } catch (err) {
    logger.error('onFinishUpdated: Failed to update products', { error: err.message });
  }
});
