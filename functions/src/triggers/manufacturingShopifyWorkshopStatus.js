/**
 * Firestore trigger — manufacturingOrders/{id} status change → push the linked
 * Shopify product's `dawin.workshop_status` metafield.
 *
 * Mapping (per docs/integrations/dawinos-storefront-schema.md §4.5):
 *   queue / build / finish / cure  →  "made-to-order"
 *   ship / completed                →  "in-stock"
 *
 * The MO must carry `inventoryItemId` (or `linkedInventoryItemId`) for this to
 * route to a product. Silent no-op otherwise.
 */

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const { applyProductMetafields } = require('../integrations/shopify/applyProductMetafields');

const MTO_STAGES = new Set(['queue', 'queued', 'build', 'in-progress', 'finish', 'cure', 'qa']);
const SHIP_STAGES = new Set(['ship', 'shipped', 'completed']);

function classifyStatus(status) {
  if (!status) return null;
  const s = String(status).toLowerCase();
  if (SHIP_STAGES.has(s)) return 'in-stock';
  if (MTO_STAGES.has(s)) return 'made-to-order';
  return null;
}

const manufacturingShopifyWorkshopStatus = onDocumentUpdated(
  {
    document: 'manufacturingOrders/{orderId}',
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 60,
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;
    if (before.status === after.status) return;

    const newWorkshopStatus = classifyStatus(after.status);
    if (!newWorkshopStatus) return;

    const inventoryItemId = after.inventoryItemId || after.linkedInventoryItemId || after.productId;
    if (!inventoryItemId) {
      logger.debug('manufacturingShopifyWorkshopStatus.no-product-link', { orderId: event.params.orderId });
      return;
    }

    try {
      const r = await applyProductMetafields(inventoryItemId, { workshopStatusOverride: newWorkshopStatus });
      logger.info('manufacturingShopifyWorkshopStatus.applied', {
        orderId: event.params.orderId,
        inventoryItemId,
        newWorkshopStatus,
        result: r.status,
      });
    } catch (err) {
      logger.error('manufacturingShopifyWorkshopStatus.failed', {
        orderId: event.params.orderId,
        inventoryItemId,
        error: err.message,
      });
    }
  }
);

module.exports = { manufacturingShopifyWorkshopStatus };
