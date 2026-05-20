/**
 * Inventory Category Sync Triggers
 *
 * Keeps inventoryCategories.itemCount in sync when inventory items
 * are created, updated (category or status change), or deleted.
 */

const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const FieldValue = admin.firestore.FieldValue;

function isCounted(data) {
  return data && data.category && data.status !== 'archived';
}

/**
 * On inventory item create — increment the category count.
 */
exports.onInventoryItemCreatedCategorySync = onDocumentCreated({
  document: 'inventoryItems/{itemId}',
}, async (event) => {
  const data = event.data.data();
  if (!isCounted(data)) return;

  try {
    await db.collection('inventoryCategories').doc(data.category)
      .update({ itemCount: FieldValue.increment(1) });
  } catch (err) {
    // Category doc may not exist yet (pre-migration)
    console.warn(`Category sync: could not increment "${data.category}"`, err.message);
  }
});

/**
 * On inventory item update — handle category change and archive/unarchive.
 */
exports.onInventoryItemUpdatedCategorySync = onDocumentUpdated({
  document: 'inventoryItems/{itemId}',
}, async (event) => {
  const before = event.data.before.data();
  const after = event.data.after.data();

  const oldCat = before?.category;
  const newCat = after?.category;
  const wasCounted = isCounted(before);
  const nowCounted = isCounted(after);

  // No category-relevant change
  if (oldCat === newCat && wasCounted === nowCounted) return;

  const updates = [];

  if (wasCounted && oldCat && (oldCat !== newCat || !nowCounted)) {
    // Decrement old category
    updates.push(
      db.collection('inventoryCategories').doc(oldCat)
        .update({ itemCount: FieldValue.increment(-1) })
        .catch(err => console.warn(`Category sync: decrement "${oldCat}" failed`, err.message))
    );
  }

  if (nowCounted && newCat && (oldCat !== newCat || !wasCounted)) {
    // Increment new category
    updates.push(
      db.collection('inventoryCategories').doc(newCat)
        .update({ itemCount: FieldValue.increment(1) })
        .catch(err => console.warn(`Category sync: increment "${newCat}" failed`, err.message))
    );
  }

  await Promise.all(updates);
});

/**
 * On inventory item delete — decrement the category count.
 */
exports.onInventoryItemDeletedCategorySync = onDocumentDeleted({
  document: 'inventoryItems/{itemId}',
}, async (event) => {
  const data = event.data.data();
  if (!isCounted(data)) return;

  try {
    await db.collection('inventoryCategories').doc(data.category)
      .update({ itemCount: FieldValue.increment(-1) });
  } catch (err) {
    console.warn(`Category sync: could not decrement "${data.category}"`, err.message);
  }
});
