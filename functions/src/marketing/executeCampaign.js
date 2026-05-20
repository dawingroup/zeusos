/**
 * Execute Marketing Campaign Cloud Function
 * Sends WhatsApp campaign messages to targeted audience
 */

const { onCall } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { sendTemplateMessage } = require('../integrations/zoko/zokoClient');
const { normalizePhoneNumber, isValidPhoneNumber } = require('../integrations/zoko/utils');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const COLLECTIONS = {
  CAMPAIGNS: 'marketingCampaigns',
  CUSTOMERS: 'customers',
  CONVERSATIONS: 'whatsappConversations',
};

/**
 * Resolve audience segment to list of customers
 */
async function resolveAudience(companyId, targetAudience) {
  let query = db.collection(COLLECTIONS.CUSTOMERS)
    .where('companyId', '==', companyId);

  if (targetAudience.type === 'all') {
    // No additional filters
  } else if (targetAudience.type === 'filtered') {
    const filters = targetAudience.filters || {};

    if (filters.status) {
      query = query.where('status', '==', filters.status);
    }
    if (filters.type) {
      query = query.where('type', '==', filters.type);
    }
    if (filters.tags && filters.tags.length > 0) {
      query = query.where('tags', 'array-contains-any', filters.tags);
    }
  } else if (targetAudience.type === 'specific' && targetAudience.customerIds) {
    // For specific customers, we'll fetch them individually
    const customerDocs = await Promise.all(
      targetAudience.customerIds.map(id =>
        db.collection(COLLECTIONS.CUSTOMERS).doc(id).get()
      )
    );
    return customerDocs
      .filter(doc => doc.exists)
      .map(doc => ({ id: doc.id, ...doc.data() }));
  }

  const snapshot = await query.get();
  let customers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

  // Client-side filtering for hasWhatsApp
  if (targetAudience.type === 'filtered' && targetAudience.filters?.hasWhatsApp) {
    customers = customers.filter(c => c.phone && isValidPhoneNumber(normalizePhoneNumber(c.phone)));
  }

  return customers;
}

/**
 * Get or create conversation for campaign tracking
 */
async function getOrCreateConversation(customerId, customerName, phoneNumber) {
  const normalized = normalizePhoneNumber(phoneNumber);

  // Try to find existing conversation
  const existing = await db
    .collection(COLLECTIONS.CONVERSATIONS)
    .where('phoneNumber', '==', normalized)
    .limit(1)
    .get();

  if (!existing.empty) {
    return { id: existing.docs[0].id, ...existing.docs[0].data() };
  }

  // Create new conversation
  const newRef = db.collection(COLLECTIONS.CONVERSATIONS).doc();
  const conversation = {
    id: newRef.id,
    customerId: customerId || null,
    customerName: customerName || 'Unknown',
    phoneNumber: normalized,
    lastInboundAt: null,
    windowExpiresAt: null,
    isWindowOpen: false,
    status: 'active',
    unreadCount: 0,
    lastMessageText: '',
    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
    lastMessageDirection: 'outbound',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  await newRef.set(conversation);
  return conversation;
}

/**
 * Create a send record in the campaign sends sub-collection
 */
async function createSendRecord(campaignId, customer, zokoMessageId, conversationId) {
  const sendRef = db
    .collection(COLLECTIONS.CAMPAIGNS)
    .doc(campaignId)
    .collection('sends')
    .doc();

  const send = {
    id: sendRef.id,
    campaignId,
    customerId: customer.id,
    recipientName: customer.name,
    recipientPhone: customer.phone,
    conversationId,
    channel: 'whatsapp',
    status: 'sent',
    zokoMessageId,
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    deliveredAt: null,
    readAt: null,
    repliedAt: null,
  };

  await sendRef.set(send);
  return send;
}

/**
 * Send campaign message to a single customer with throttling
 */
async function sendToCustomer(campaign, customer, delay = 0) {
  // Wait for throttle delay
  if (delay > 0) {
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  try {
    // Validate phone number
    const normalized = normalizePhoneNumber(customer.phone);
    if (!isValidPhoneNumber(normalized)) {
      logger.warn('Invalid phone number for customer', { customerId: customer.id, phone: customer.phone });
      return {
        success: false,
        customerId: customer.id,
        error: 'Invalid phone number',
      };
    }

    // Get or create conversation
    const conversation = await getOrCreateConversation(
      customer.id,
      customer.name,
      normalized
    );

    // Prepare template parameters with customer personalization
    const templateParams = campaign.whatsappConfig.templateParams || {};
    const personalizedParams = {
      ...templateParams,
      customer_name: customer.name,
      // Add more personalization fields as needed
    };

    // Send via Zoko
    const zokoResult = await sendTemplateMessage(
      normalized,
      campaign.whatsappConfig.templateId,
      personalizedParams
    );

    // Create send record
    await createSendRecord(
      campaign.id,
      customer,
      zokoResult?.messageId || zokoResult?.id || null,
      conversation.id
    );

    // Update conversation with campaign message
    await db.collection(COLLECTIONS.CONVERSATIONS).doc(conversation.id).update({
      lastMessageText: `[Campaign: ${campaign.name}]`,
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      lastMessageDirection: 'outbound',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return {
      success: true,
      customerId: customer.id,
      conversationId: conversation.id,
      zokoMessageId: zokoResult?.messageId || zokoResult?.id || null,
    };
  } catch (error) {
    logger.error('Failed to send to customer', {
      customerId: customer.id,
      error: error.message,
    });
    return {
      success: false,
      customerId: customer.id,
      error: error.message,
    };
  }
}

/**
 * Execute Campaign - Callable Function
 *
 * Called from the UI to start campaign execution
 *
 * @param {Object} data - { campaignId: string }
 * @param {Object} context - Auth context
 */
const executeCampaign = onCall(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 540, // 9 minutes (max for callable functions)
  },
  async (request) => {
    const { campaignId } = request.data;
    const uid = request.auth?.uid;

    if (!uid) {
      throw new Error('Unauthenticated');
    }

    logger.info('Starting campaign execution', { campaignId, uid });

    try {
      // Get campaign
      const campaignDoc = await db.collection(COLLECTIONS.CAMPAIGNS).doc(campaignId).get();
      if (!campaignDoc.exists) {
        throw new Error('Campaign not found');
      }

      const campaign = { id: campaignDoc.id, ...campaignDoc.data() };

      // Validate campaign is ready to execute
      if (campaign.status !== 'draft' && campaign.status !== 'scheduled') {
        throw new Error(`Cannot execute campaign with status: ${campaign.status}`);
      }

      // Validate WhatsApp config exists for WhatsApp campaigns
      if (
        (campaign.campaignType === 'whatsapp' || campaign.campaignType === 'hybrid') &&
        (!campaign.whatsappConfig || !campaign.whatsappConfig.templateId)
      ) {
        throw new Error('WhatsApp configuration is required');
      }

      // Resolve target audience
      logger.info('Resolving audience', { campaignId });
      const customers = await resolveAudience(campaign.companyId, campaign.targetAudience);

      if (customers.length === 0) {
        throw new Error('No customers match the target audience');
      }

      logger.info('Audience resolved', { campaignId, customerCount: customers.length });

      // Update campaign status to active
      await db.collection(COLLECTIONS.CAMPAIGNS).doc(campaignId).update({
        status: 'active',
        'metrics.totalSent': 0,
        'metrics.totalReached': 0,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      // Calculate throttle delay (milliseconds between messages)
      const throttleConfig = campaign.whatsappConfig?.throttleConfig;
      const messagesPerMinute = throttleConfig?.messagesPerMinute || 20;
      const delayMs = (60 * 1000) / messagesPerMinute;

      logger.info('Starting message sending', {
        campaignId,
        customerCount: customers.length,
        messagesPerMinute,
        delayMs,
      });

      // Send messages with throttling
      const results = [];
      for (let i = 0; i < customers.length; i++) {
        const customer = customers[i];
        const delay = i > 0 ? delayMs : 0;

        const result = await sendToCustomer(campaign, customer, delay);
        results.push(result);

        // Update campaign metrics every 10 messages
        if ((i + 1) % 10 === 0 || i === customers.length - 1) {
          const successCount = results.filter(r => r.success).length;
          await db.collection(COLLECTIONS.CAMPAIGNS).doc(campaignId).update({
            'metrics.totalSent': successCount,
            'metrics.totalReached': successCount, // Will be updated by engagement tracking
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
      }

      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      logger.info('Campaign execution completed', {
        campaignId,
        successCount,
        failureCount,
      });

      // Update final campaign status
      await db.collection(COLLECTIONS.CAMPAIGNS).doc(campaignId).update({
        status: 'completed',
        'metrics.totalSent': successCount,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        campaignId,
        totalCustomers: customers.length,
        successCount,
        failureCount,
        results,
      };
    } catch (error) {
      logger.error('Campaign execution failed', {
        campaignId,
        error: error.message,
        stack: error.stack,
      });

      // Update campaign status to failed (we'll need to add this status)
      try {
        await db.collection(COLLECTIONS.CAMPAIGNS).doc(campaignId).update({
          status: 'draft', // Revert to draft on failure
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } catch (updateError) {
        logger.error('Failed to update campaign status', { error: updateError.message });
      }

      throw new Error(`Campaign execution failed: ${error.message}`);
    }
  }
);

module.exports = {
  executeCampaign,
};
