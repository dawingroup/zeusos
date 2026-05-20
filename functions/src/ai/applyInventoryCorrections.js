/**
 * Apply Inventory Corrections Cloud Function
 *
 * Applies a batch of field-level corrections to inventory items.
 * Each correction specifies an item, field, and new value.
 * Returns a summary of applied/failed corrections.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { logger } = require('firebase-functions/v2');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// Fields that are allowed to be corrected
const ALLOWED_FIELDS = new Set([
  'name',
  'displayName',
  'description',
  'category',
  'subcategory',
  'classification',
  'tags',
  'aliases',
  'brand',
  'sku',
  'status',
  'grainPattern',
  'pricing.costPerUnit',
  'pricing.currency',
  'pricing.unit',
  'inventory.inStock',
  'inventory.reorderLevel',
  'structuredName.function',
  'structuredName.keySpecs',
  'structuredName.qualityTier',
  'structuredName.brandName',
]);

exports.applyInventoryCorrections = onCall(
  {
    cors: true,
    timeoutSeconds: 60,
    memory: '512MiB',
    maxInstances: 5,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const userId = request.auth.uid;
    const { corrections } = request.data;

    if (!corrections || !Array.isArray(corrections) || corrections.length === 0) {
      throw new HttpsError('invalid-argument', 'Corrections array is required and must not be empty');
    }

    if (corrections.length > 100) {
      throw new HttpsError('invalid-argument', 'Maximum 100 corrections per batch');
    }

    logger.info(`Applying ${corrections.length} inventory corrections for user ${userId}`);

    const applied = [];
    const failures = [];

    // Process in batches of 500 (Firestore limit)
    const batch = db.batch();
    let batchCount = 0;

    for (const correction of corrections) {
      try {
        const { id, itemId, field, newValue } = correction;

        if (!itemId || !field) {
          failures.push({ id: id || 'unknown', error: 'Missing itemId or field' });
          continue;
        }

        if (!ALLOWED_FIELDS.has(field)) {
          failures.push({ id, error: `Field "${field}" is not allowed for correction` });
          continue;
        }

        const itemRef = db.collection('inventoryItems').doc(itemId);
        const snap = await itemRef.get();

        if (!snap.exists) {
          failures.push({ id, error: `Item ${itemId} not found` });
          continue;
        }

        const updateData = {
          [field]: newValue,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedBy: userId,
        };

        batch.update(itemRef, updateData);
        batchCount++;
        applied.push(id);

        // Commit every 450 operations to stay under Firestore limits
        if (batchCount >= 450) {
          await batch.commit();
          batchCount = 0;
        }
      } catch (err) {
        failures.push({
          id: correction.id || 'unknown',
          error: err.message || 'Unknown error',
        });
      }
    }

    // Commit remaining
    if (batchCount > 0) {
      await batch.commit();
    }

    logger.info(
      `Corrections complete: ${applied.length} applied, ${failures.length} failed`
    );

    return {
      success: true,
      appliedCount: applied.length,
      failedCount: failures.length,
      failures,
    };
  }
);
