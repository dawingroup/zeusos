/**
 * Shopify Fulfillment Webhook Handler
 *
 * Handles `fulfillments/create` and `fulfillments/update` webhook topics.
 * Updates the fulfillment data on the order document in `shopifyOrders`.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');
const { verifyShopifyWebhook } = require('./shopifyOrderCreate');
const { ALLOWED_ORIGINS } = require('../config/cors');

const SHOPIFY_ORDERS_COLLECTION = 'shopifyOrders';

/**
 * Shopify fulfillment create/update webhook handler
 */
exports.shopifyFulfillmentCreate = onRequest(
  {
    cors: ALLOWED_ORIGINS,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const db = getFirestore();
    console.log('Received Shopify fulfillment webhook');

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

      const fulfillment = req.body;
      if (!fulfillment || !fulfillment.id) {
        res.status(400).send('Invalid fulfillment data');
        return;
      }

      const shopifyOrderId = String(fulfillment.order_id);
      const orderDocId = `shopify_${shopifyOrderId}`;
      console.log(`Processing fulfillment for order ${shopifyOrderId}: ${fulfillment.status}`);

      // Find the order document
      const orderRef = db.collection(SHOPIFY_ORDERS_COLLECTION).doc(orderDocId);
      const orderDoc = await orderRef.get();

      if (!orderDoc.exists) {
        console.log(`Order doc ${orderDocId} not found — skipping fulfillment update`);
        res.status(200).send('OK');
        return;
      }

      const existingOrder = orderDoc.data();
      const now = new Date();

      // Build fulfillment entry
      const fulfillmentEntry = {
        shopifyFulfillmentId: String(fulfillment.id),
        status: fulfillment.status || 'pending',
        trackingNumber: fulfillment.tracking_number || null,
        trackingUrl: fulfillment.tracking_url || null,
        trackingCompany: fulfillment.tracking_company || null,
        lineItems: (fulfillment.line_items || []).map(li => ({
          shopifyLineItemId: String(li.id),
          quantity: li.quantity || 0,
        })),
        createdAt: fulfillment.created_at ? new Date(fulfillment.created_at) : now,
      };

      // Update or append fulfillment
      const existingFulfillments = existingOrder.fulfillments || [];
      const existingIdx = existingFulfillments.findIndex(
        f => f.shopifyFulfillmentId === String(fulfillment.id)
      );

      if (existingIdx >= 0) {
        existingFulfillments[existingIdx] = fulfillmentEntry;
      } else {
        existingFulfillments.push(fulfillmentEntry);
      }

      // Determine overall fulfillment status
      const totalLineItems = existingOrder.lineItems?.length || 0;
      const fulfilledLineItemIds = new Set();
      for (const f of existingFulfillments) {
        if (f.status === 'success') {
          for (const li of f.lineItems) {
            fulfilledLineItemIds.add(li.shopifyLineItemId);
          }
        }
      }

      let overallFulfillmentStatus = 'unfulfilled';
      if (fulfilledLineItemIds.size >= totalLineItems && totalLineItems > 0) {
        overallFulfillmentStatus = 'fulfilled';
      } else if (fulfilledLineItemIds.size > 0) {
        overallFulfillmentStatus = 'partial';
      }

      // Update order document
      await orderRef.update({
        fulfillments: existingFulfillments,
        fulfillmentStatus: overallFulfillmentStatus,
        updatedAt: now,
        syncedAt: now,
      });

      // Update line item fulfillment statuses
      if (existingOrder.lineItems) {
        const updatedLineItems = existingOrder.lineItems.map(li => {
          const isFulfilled = fulfilledLineItemIds.has(li.shopifyLineItemId);
          return {
            ...li,
            fulfillmentStatus: isFulfilled ? 'fulfilled' : li.fulfillmentStatus,
            fulfillableQuantity: isFulfilled ? 0 : li.fulfillableQuantity,
          };
        });
        await orderRef.update({ lineItems: updatedLineItems });
      }

      console.log(`Fulfillment updated for order ${orderDocId}: ${overallFulfillmentStatus}`);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Shopify fulfillment webhook error:', error);
      res.status(500).send('Internal Server Error');
    }
  }
);
