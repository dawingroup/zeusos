/**
 * Callable wrapper around applyProductMetafields — for the admin UI
 * "Re-apply Shopify metafields" button.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { applyProductMetafields } = require('./applyProductMetafields');

const applyProductMetafieldsFn = onCall(
  { region: 'us-central1', memory: '512MiB', timeoutSeconds: 120 },
  async (request) => {
    if (!request.auth) throw new HttpsError('unauthenticated', 'Authentication required');
    const { inventoryItemId, workshopStatusOverride } = request.data || {};
    if (!inventoryItemId) throw new HttpsError('invalid-argument', 'inventoryItemId is required');
    return applyProductMetafields(inventoryItemId, { workshopStatusOverride });
  }
);

module.exports = { applyProductMetafieldsFn };
