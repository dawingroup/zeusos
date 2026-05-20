/**
 * Shopify Order Update Webhook Handler
 *
 * Handles the `orders/updated` webhook topic from Shopify.
 * Updates the existing order document in `shopifyOrders` and the linked CRM deal.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { verifyShopifyWebhook } = require('./shopifyOrderCreate');
const { ALLOWED_ORIGINS } = require('../config/cors');

const SHOPIFY_ORDERS_COLLECTION = 'shopifyOrders';
const CRM_DEALS_COLLECTION = 'crmDeals';

/**
 * Map Shopify order data to update fields
 */
function buildOrderUpdate(order) {
  const now = new Date();

  const lineItems = (order.line_items || []).map(item => ({
    shopifyLineItemId: String(item.id),
    title: item.title || '',
    variantTitle: item.variant_title || null,
    sku: item.sku || null,
    quantity: item.quantity || 0,
    price: parseFloat(item.price || '0'),
    totalDiscount: parseFloat(item.total_discount || '0'),
    shopifyProductId: item.product_id ? String(item.product_id) : null,
    shopifyVariantId: item.variant_id ? String(item.variant_id) : null,
    fulfillableQuantity: item.fulfillable_quantity ?? item.quantity ?? 0,
    fulfillmentStatus: item.fulfillment_status || null,
  }));

  const fulfillments = (order.fulfillments || []).map(f => ({
    shopifyFulfillmentId: String(f.id),
    status: f.status || 'pending',
    trackingNumber: f.tracking_number || null,
    trackingUrl: f.tracking_url || null,
    trackingCompany: f.tracking_company || null,
    lineItems: (f.line_items || []).map(li => ({
      shopifyLineItemId: String(li.id),
      quantity: li.quantity || 0,
    })),
    createdAt: f.created_at ? new Date(f.created_at) : now,
  }));

  const totalShipping = (order.shipping_lines || []).reduce(
    (sum, line) => sum + parseFloat(line.price || '0'),
    0
  );

  return {
    // Financial
    totalPrice: parseFloat(order.total_price || '0'),
    subtotalPrice: parseFloat(order.subtotal_price || '0'),
    totalTax: parseFloat(order.total_tax || '0'),
    totalDiscounts: parseFloat(order.total_discounts || '0'),
    totalShipping,

    // Status
    financialStatus: order.financial_status || 'pending',
    fulfillmentStatus: order.fulfillment_status || null,
    cancelledAt: order.cancelled_at ? new Date(order.cancelled_at) : null,
    cancelReason: order.cancel_reason || null,

    // Line items & fulfillments
    lineItems,
    fulfillments,

    // Tags
    tags: order.tags ? order.tags.split(',').map(t => t.trim()).filter(Boolean) : [],
    note: order.note || null,

    // Timestamps
    shopifyUpdatedAt: order.updated_at ? new Date(order.updated_at) : now,
    updatedAt: now,
    syncedAt: now,
  };
}

/**
 * Shopify order update webhook handler
 */
exports.shopifyOrderUpdate = onRequest(
  {
    cors: ALLOWED_ORIGINS,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const db = getFirestore();
    console.log('Received Shopify order update webhook');

    try {
      // Get webhook secret from config
      const configDoc = await db.doc('systemConfig/shopifyConfig').get();
      if (!configDoc.exists) {
        console.log('Shopify not configured — acknowledging webhook');
        res.status(200).send('OK');
        return;
      }

      const shopConfig = configDoc.data();

      // Verify webhook signature
      if (shopConfig.webhookSecret) {
        if (!verifyShopifyWebhook(req, shopConfig.webhookSecret)) {
          console.error('Invalid webhook signature');
          res.status(401).send('Unauthorized');
          return;
        }
      }

      const order = req.body;
      if (!order || !order.id) {
        res.status(400).send('Invalid order data');
        return;
      }

      const shopifyOrderId = String(order.id);
      const orderDocId = `shopify_${shopifyOrderId}`;
      console.log(`Processing order update: #${order.order_number || order.name} (${shopifyOrderId})`);

      // Check if order document exists
      const orderRef = db.collection(SHOPIFY_ORDERS_COLLECTION).doc(orderDocId);
      const orderDoc = await orderRef.get();

      if (!orderDoc.exists) {
        console.log(`Order doc ${orderDocId} not found — skipping update`);
        res.status(200).send('OK');
        return;
      }

      // Update order document
      const updates = buildOrderUpdate(order);
      await orderRef.update(updates);

      // Update linked CRM deal if status changed significantly
      const existingOrder = orderDoc.data();
      if (existingOrder.crmDealId) {
        const dealRef = db.collection(CRM_DEALS_COLLECTION).doc(existingOrder.crmDealId);
        const dealUpdates = {};

        // If order is cancelled, update deal stage
        if (order.cancelled_at && !existingOrder.cancelledAt) {
          dealUpdates.stage = 'lost';
          dealUpdates.lostReason = `Shopify order cancelled: ${order.cancel_reason || 'No reason'}`;
          dealUpdates.updatedAt = new Date();
          dealUpdates.updatedBy = 'system';
        }

        // If order is refunded, update deal
        if (order.financial_status === 'refunded' && existingOrder.financialStatus !== 'refunded') {
          dealUpdates.stage = 'lost';
          dealUpdates.lostReason = 'Shopify order fully refunded';
          dealUpdates.updatedAt = new Date();
          dealUpdates.updatedBy = 'system';
        }

        // Update deal value if total changed
        const newTotal = parseFloat(order.total_price || '0');
        if (newTotal !== existingOrder.totalPrice) {
          dealUpdates.estimatedValue = newTotal;
          dealUpdates.weightedValue = newTotal;
          dealUpdates.updatedAt = new Date();
          dealUpdates.updatedBy = 'system';
        }

        if (Object.keys(dealUpdates).length > 0) {
          await dealRef.update(dealUpdates);
          console.log(`Updated CRM deal ${existingOrder.crmDealId} with order changes`);
        }
      }

      console.log(`Order doc ${orderDocId} updated successfully`);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Shopify order update webhook error:', error);
      res.status(500).send('Internal Server Error');
    }
  }
);
