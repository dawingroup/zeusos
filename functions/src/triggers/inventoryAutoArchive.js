/**
 * Inventory Auto-Archive Cloud Function
 *
 * Automatically archives inventory items when stock reaches zero under these conditions:
 * 1. Project-tier items with zero stock (and all linked projects closed)
 * 2. Non-restockable items with zero stock
 */

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Trigger: inventoryItems/{docId} onUpdate
 *
 * When an inventory item is updated, check if it should be auto-archived.
 */
exports.onInventoryItemUpdated = onDocumentUpdated(
  'inventoryItems/{docId}',
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const docId = event.params.docId;

    // Skip if already archived or not active
    if (after.status === 'archived') return;

    // Only trigger on stock changes or status changes
    const stockBefore = before.inventory?.inStock ?? 0;
    const stockAfter = after.inventory?.inStock ?? 0;

    // Only proceed if stock just hit zero (or was already zero and status changed)
    if (stockAfter > 0) return;
    if (stockBefore === 0 && stockAfter === 0 && before.status === after.status) return;

    const tier = after.tier || 'catalogue';
    const restockable = after.restockable ?? true;

    let shouldArchive = false;
    let reason = '';

    // Rule 1: Non-restockable items with zero stock → archive
    if (!restockable && stockAfter <= 0) {
      shouldArchive = true;
      reason = 'Non-restockable item reached zero stock';
    }

    // Rule 2: Project-tier items with zero stock and all linked projects closed → archive
    if (tier === 'project' && stockAfter <= 0) {
      const linkedProjectIds = after.linkedProjectIds || [];

      if (linkedProjectIds.length === 0) {
        // No linked projects — archive immediately
        shouldArchive = true;
        reason = 'Project-tier item with zero stock and no linked projects';
      } else {
        // Check if all linked projects are closed/completed
        const allClosed = await areAllProjectsClosed(linkedProjectIds);
        if (allClosed) {
          shouldArchive = true;
          reason = `Project-tier item with zero stock — all ${linkedProjectIds.length} linked project(s) closed`;
        }
      }
    }

    if (shouldArchive) {
      console.log(`[auto-archive] Archiving ${docId}: ${reason}`);
      await event.data.after.ref.update({
        status: 'archived',
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedBy: 'auto-archive-trigger',
      });
    }
  }
);

/**
 * Check if all projects in the given list are closed/completed.
 * Checks both salesOrders and projects collections.
 */
async function areAllProjectsClosed(projectIds) {
  if (!projectIds || projectIds.length === 0) return true;

  for (const projectId of projectIds) {
    // Check salesOrders collection
    const soDoc = await db.collection('salesOrders').doc(projectId).get();
    if (soDoc.exists) {
      const status = soDoc.data().status;
      if (!['closed', 'completed', 'cancelled'].includes(status)) {
        return false;
      }
      continue;
    }

    // Check projects collection
    const projDoc = await db.collection('projects').doc(projectId).get();
    if (projDoc.exists) {
      const status = projDoc.data().status;
      if (!['closed', 'completed', 'cancelled'].includes(status)) {
        return false;
      }
      continue;
    }

    // Check manufacturing orders
    const moDoc = await db.collection('manufacturingOrders').doc(projectId).get();
    if (moDoc.exists) {
      const status = moDoc.data().status;
      if (!['completed', 'cancelled'].includes(status)) {
        return false;
      }
      continue;
    }

    // Unknown project ID — treat as not closed (safe default)
    console.warn(`[auto-archive] Unknown project/MO ID: ${projectId}`);
    return false;
  }

  return true;
}
