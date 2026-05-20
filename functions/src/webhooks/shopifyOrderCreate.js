/**
 * Shopify Order Create Webhook Handler
 * Creates a CRM deal (stage: "won") for each new Shopify order.
 * Deduplicates by shopifyOrderId to prevent duplicate deals.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const crypto = require('crypto');
const { ALLOWED_ORIGINS } = require('../config/cors');

const CRM_DEALS_COLLECTION = 'crmDeals';
const CRM_ACTIVITIES_COLLECTION = 'crmActivities';

/**
 * Verify Shopify webhook signature
 */
function verifyShopifyWebhook(req, secret) {
  const hmac = req.headers['x-shopify-hmac-sha256'];
  if (!hmac) return false;

  const hash = crypto
    .createHmac('sha256', secret)
    .update(req.rawBody || JSON.stringify(req.body))
    .digest('base64');

  return crypto.timingSafeEqual(Buffer.from(hmac), Buffer.from(hash));
}

/**
 * Generate a unique deal number (timestamp-based, no Firestore queries)
 */
function generateDealNumber() {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CRM-DEAL-${dateStr}-${rand}`;
}

/**
 * Shopify order create webhook handler
 */
exports.shopifyOrderCreate = onRequest(
  {
    cors: ALLOWED_ORIGINS,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.status(405).send('Method Not Allowed');
      return;
    }

    const db = getFirestore();
    console.log('Received Shopify order create webhook');

    try {
      // Get webhook secret from config
      const configDoc = await db.doc('systemConfig/shopifyConfig').get();
      if (!configDoc.exists) {
        console.log('Shopify not configured — acknowledging webhook');
        res.status(200).send('OK');
        return;
      }

      const shopConfig = configDoc.data();

      // Verify webhook signature if secret is configured
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
      console.log(`Processing order webhook: #${order.order_number || order.name} (${shopifyOrderId})`);

      // Dedup: check if a deal already exists for this Shopify order
      const existingDeals = await db
        .collection(CRM_DEALS_COLLECTION)
        .where('shopifyOrderId', '==', shopifyOrderId)
        .limit(1)
        .get();

      if (!existingDeals.empty) {
        console.log(`Deal already exists for Shopify order ${shopifyOrderId} — skipping`);
        res.status(200).send('OK');
        return;
      }

      // Extract customer info
      const customer = order.customer || {};
      const customerName = customer.first_name && customer.last_name
        ? `${customer.first_name} ${customer.last_name}`
        : customer.email || 'Shopify Customer';
      const customerId = customer.id ? `shopify_${customer.id}` : `shopify_order_${shopifyOrderId}`;

      // Extract financial info
      const totalPrice = parseFloat(order.total_price || '0');
      const currency = (order.currency || 'UGX').toUpperCase();

      // Build line items summary for description
      const lineItems = (order.line_items || [])
        .map(item => `${item.quantity}x ${item.title}`)
        .join(', ');

      // Build site location from shipping address
      const shipping = order.shipping_address || {};
      const siteLocation = shipping.address1
        ? {
            address: [shipping.address1, shipping.address2].filter(Boolean).join(', '),
            city: shipping.city || '',
            country: shipping.country || '',
          }
        : null;

      // Shopify order URL
      const shopDomain = shopConfig.shopDomain || '';
      const shopifyOrderUrl = shopDomain
        ? `https://${shopDomain}/admin/orders/${shopifyOrderId}`
        : '';

      // Create deal
      const now = new Date();
      const dealId = `deal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      const dealNumber = generateDealNumber();

      const deal = {
        dealNumber,
        title: `Shopify Order #${order.order_number || order.name || shopifyOrderId}`,
        description: `Shopify order: ${lineItems || 'No line items'}`,
        customerId,
        customerName,
        stage: 'won',
        probability: 100,
        priority: 'medium',
        source: 'website',
        estimatedValue: totalPrice,
        currency,
        weightedValue: totalPrice,
        linkedQuoteIds: [],
        linkedMOIds: [],
        ownerId: 'system',
        ownerName: 'Shopify Integration',
        teamMemberIds: [],
        actualCloseDate: now,
        stageEnteredAt: now,
        shopifyOrderId,
        shopifyOrderNumber: String(order.order_number || order.name || ''),
        shopifyOrderUrl,
        tags: ['shopify-order', 'auto-synced'],
        subsidiaryId: 'finishes',
        createdAt: now,
        createdBy: 'system',
        updatedAt: now,
        updatedBy: 'system',
      };

      if (siteLocation) {
        deal.siteLocation = siteLocation;
      }

      await db.collection(CRM_DEALS_COLLECTION).doc(dealId).set(deal);

      // Log activity
      const activityId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
      await db.collection(CRM_ACTIVITIES_COLLECTION).doc(activityId).set({
        dealId,
        customerId,
        type: 'stage_change',
        title: `Shopify order received: #${order.order_number || order.name}`,
        description: `${lineItems} — Total: ${currency} ${totalPrice.toLocaleString()}`,
        source: 'auto_system',
        performedBy: 'system',
        performedByName: 'Shopify Integration',
        performedAt: now,
        createdAt: now,
      });

      console.log(`CRM deal created for Shopify order #${order.order_number}: ${dealId}`);
      res.status(200).send('OK');
    } catch (error) {
      console.error('Shopify order webhook error:', error);
      res.status(500).send('Internal Server Error');
    }
  }
);
