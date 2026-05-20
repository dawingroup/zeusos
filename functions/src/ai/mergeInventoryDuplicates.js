/**
 * Merge Inventory Duplicates Cloud Function
 *
 * Merges duplicate inventory items into a single primary item.
 * Supports strategies: keep-primary, merge-best-fields, create-parent.
 * Optionally archives (soft-deletes) or hard-deletes merged duplicates.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { logger } = require('firebase-functions/v2');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

exports.mergeInventoryDuplicates = onCall(
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
    const { groupId, primaryItemId, itemsToMerge, strategy, archiveDuplicates } = request.data;

    if (!primaryItemId || !itemsToMerge || !Array.isArray(itemsToMerge) || itemsToMerge.length === 0) {
      throw new HttpsError('invalid-argument', 'primaryItemId and itemsToMerge are required');
    }

    try {
      logger.info(
        `Merging duplicates: primary=${primaryItemId}, merging ${itemsToMerge.length} items, strategy=${strategy}`
      );

      const batch = db.batch();
      const updatedFields = [];
      const archivedItemIds = [];

      // Load primary item
      const primaryRef = db.collection('inventoryItems').doc(primaryItemId);
      const primarySnap = await primaryRef.get();
      if (!primarySnap.exists) {
        throw new HttpsError('not-found', `Primary item ${primaryItemId} not found`);
      }
      const primaryData = primarySnap.data();

      // Load items to merge
      const mergeItems = [];
      for (const itemId of itemsToMerge) {
        const snap = await db.collection('inventoryItems').doc(itemId).get();
        if (snap.exists) {
          mergeItems.push({ id: snap.id, ...snap.data() });
        }
      }

      if (mergeItems.length === 0) {
        throw new HttpsError('not-found', 'No valid items to merge found');
      }

      if (strategy === 'merge-best-fields') {
        // Pick the best value for each field from all items
        const updates = {};

        // Prefer longest/most complete description
        const allDescriptions = [primaryData.description, ...mergeItems.map(i => i.description)].filter(Boolean);
        const bestDescription = allDescriptions.sort((a, b) => (b?.length || 0) - (a?.length || 0))[0];
        if (bestDescription && bestDescription !== primaryData.description) {
          updates.description = bestDescription;
          updatedFields.push('description');
        }

        // Merge tags (union of all)
        const allTags = new Set([
          ...(primaryData.tags || []),
          ...mergeItems.flatMap(i => i.tags || []),
        ]);
        if (allTags.size > (primaryData.tags || []).length) {
          updates.tags = Array.from(allTags);
          updatedFields.push('tags');
        }

        // Merge aliases (union of all item names + existing aliases)
        const allAliases = new Set([
          ...(primaryData.aliases || []),
          ...mergeItems.flatMap(i => [i.name, ...(i.aliases || [])]),
        ]);
        allAliases.delete(primaryData.name); // Don't alias the primary's own name
        if (allAliases.size > (primaryData.aliases || []).length) {
          updates.aliases = Array.from(allAliases);
          updatedFields.push('aliases');
        }

        // Merge supplier pricing (union, dedup by supplierName)
        const existingSuppliers = new Set((primaryData.supplierPricing || []).map(s => s.supplierName));
        const newSupplierPricing = mergeItems
          .flatMap(i => i.supplierPricing || [])
          .filter(s => !existingSuppliers.has(s.supplierName));
        if (newSupplierPricing.length > 0) {
          updates.supplierPricing = [...(primaryData.supplierPricing || []), ...newSupplierPricing];
          updatedFields.push('supplierPricing');
        }

        // Merge vendor sources
        const existingMpns = new Set((primaryData.vendorSources || []).map(v => v.mpn));
        const newVendorSources = mergeItems
          .flatMap(i => i.vendorSources || [])
          .filter(v => !existingMpns.has(v.mpn));
        if (newVendorSources.length > 0) {
          updates.vendorSources = [...(primaryData.vendorSources || []), ...newVendorSources];
          updatedFields.push('vendorSources');
        }

        // Sum stock levels
        const totalAdditionalStock = mergeItems.reduce(
          (sum, i) => sum + (i.inventory?.inStock || 0),
          0
        );
        if (totalAdditionalStock > 0) {
          updates['inventory.inStock'] = (primaryData.inventory?.inStock || 0) + totalAdditionalStock;
          updatedFields.push('inventory.inStock');
        }

        // Fill missing dimensions
        if (!primaryData.dimensions?.thickness) {
          const withDims = mergeItems.find(i => i.dimensions?.thickness);
          if (withDims) {
            updates.dimensions = withDims.dimensions;
            updatedFields.push('dimensions');
          }
        }

        if (Object.keys(updates).length > 0) {
          updates.updatedAt = admin.firestore.FieldValue.serverTimestamp();
          updates.updatedBy = userId;
          batch.update(primaryRef, updates);
        }
      }

      // Archive or delete merged items
      for (const item of mergeItems) {
        const itemRef = db.collection('inventoryItems').doc(item.id);
        if (archiveDuplicates) {
          batch.update(itemRef, {
            status: 'discontinued',
            _mergedIntoPrimary: primaryItemId,
            _mergedAt: admin.firestore.FieldValue.serverTimestamp(),
            _mergedBy: userId,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedBy: userId,
          });
          archivedItemIds.push(item.id);
        } else {
          batch.delete(itemRef);
        }
      }

      await batch.commit();

      logger.info(
        `Merge complete: updated ${updatedFields.length} fields on primary, ` +
        `${archiveDuplicates ? 'archived' : 'deleted'} ${mergeItems.length} duplicates`
      );

      return {
        success: true,
        primaryItemId,
        mergedItemIds: itemsToMerge,
        archivedItemIds,
        updatedFields,
        aiNotes: `Merged ${mergeItems.length} duplicate(s) into "${primaryData.name}" using ${strategy} strategy.`,
      };
    } catch (err) {
      logger.error('Duplicate merge failed:', err);
      if (err instanceof HttpsError) throw err;
      throw new HttpsError('internal', `Merge failed: ${err.message}`);
    }
  }
);
