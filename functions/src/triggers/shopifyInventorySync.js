/**
 * Shopify Inventory Sync Trigger
 *
 * Firestore trigger that reacts to changes in the `stockLevels` collection.
 * When stock changes for an item with `shopifyInventoryPushEnabled = true`,
 * aggregates available quantity across all warehouses and pushes to Shopify.
 */

const { onDocumentWritten } = require('firebase-functions/v2/firestore');
const { getFirestore } = require('firebase-admin/firestore');

const INVENTORY_COLLECTION = 'inventoryItems';
const STOCK_LEVELS_COLLECTION = 'stockLevels';
const SHOPIFY_CONFIG_DOC = 'systemConfig/shopifyConfig';

/**
 * Aggregate available stock across all warehouse locations for an inventory item
 */
async function getAggregatedAvailable(db, inventoryItemId) {
  const stockSnapshot = await db
    .collection(STOCK_LEVELS_COLLECTION)
    .where('inventoryItemId', '==', inventoryItemId)
    .get();

  let totalAvailable = 0;
  stockSnapshot.forEach((doc) => {
    const data = doc.data();
    const onHand = data.quantityOnHand || 0;
    const reserved = data.quantityReserved || 0;
    totalAvailable += Math.max(0, onHand - reserved);
  });

  return totalAvailable;
}

/**
 * Push inventory level to Shopify
 */
async function pushToShopify(config, shopifyInventoryItemId, shopifyLocationId, available) {
  const response = await fetch(
    `https://${config.shopDomain}/admin/api/2024-01/inventory_levels/set.json`,
    {
      method: 'POST',
      headers: {
        'X-Shopify-Access-Token': config.accessToken,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        inventory_item_id: parseInt(shopifyInventoryItemId, 10),
        location_id: parseInt(shopifyLocationId, 10),
        available: Math.floor(available),
      }),
    }
  );

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Shopify inventory push failed: ${error}`);
  }

  return response.json();
}

/**
 * Firestore trigger: on stock level write, push to Shopify if enabled
 */
exports.onStockLevelChanged = onDocumentWritten(
  `${STOCK_LEVELS_COLLECTION}/{stockLevelId}`,
  async (event) => {
    const db = getFirestore();

    // Get the inventory item ID from the stock level document
    const afterData = event.data?.after?.data();
    const beforeData = event.data?.before?.data();

    // Use after data for creates/updates, before data for deletes
    const stockData = afterData || beforeData;
    if (!stockData || !stockData.inventoryItemId) {
      console.log('No inventory item ID on stock level — skipping');
      return;
    }

    const inventoryItemId = stockData.inventoryItemId;

    // Check if quantities actually changed
    if (beforeData && afterData) {
      const beforeAvail = (beforeData.quantityOnHand || 0) - (beforeData.quantityReserved || 0);
      const afterAvail = (afterData.quantityOnHand || 0) - (afterData.quantityReserved || 0);
      if (beforeAvail === afterAvail) {
        console.log(`No availability change for ${inventoryItemId} — skipping`);
        return;
      }
    }

    // Look up the inventory item
    const itemDoc = await db.collection(INVENTORY_COLLECTION).doc(inventoryItemId).get();
    if (!itemDoc.exists) {
      console.log(`Inventory item ${inventoryItemId} not found — skipping`);
      return;
    }

    const item = itemDoc.data();

    // Check if push is enabled for this item
    if (!item.shopifyInventoryPushEnabled) {
      return;
    }

    if (!item.shopifyInventoryItemId || !item.shopifyLocationId) {
      console.log(`Item ${inventoryItemId} missing Shopify inventory/location IDs — skipping`);
      return;
    }

    // Get Shopify config
    const configDoc = await db.doc(SHOPIFY_CONFIG_DOC).get();
    if (!configDoc.exists || configDoc.data().status !== 'connected') {
      console.log('Shopify not connected — skipping inventory push');
      return;
    }

    const shopConfig = configDoc.data();

    try {
      // Aggregate available stock across all warehouses
      const totalAvailable = await getAggregatedAvailable(db, inventoryItemId);

      // Push to Shopify
      await pushToShopify(
        shopConfig,
        item.shopifyInventoryItemId,
        item.shopifyLocationId,
        totalAvailable
      );

      // Update last sync timestamp on inventory item
      await itemDoc.ref.update({
        shopifyLastSyncAt: new Date(),
        updatedAt: new Date(),
      });

      console.log(
        `Pushed inventory for ${inventoryItemId}: ${totalAvailable} available → Shopify`
      );
    } catch (error) {
      console.error(`Shopify inventory push failed for ${inventoryItemId}:`, error.message);
    }
  }
);
