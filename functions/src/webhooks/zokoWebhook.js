/**
 * Zoko WhatsApp Webhook Receiver
 * Receives inbound messages and delivery status updates from Zoko
 *
 * This is a public HTTP endpoint called by Zoko's servers.
 * Authentication is via a shared secret query parameter.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { normalizePhoneNumber } = require('../integrations/zoko/utils');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const ZOKO_WEBHOOK_SECRET = defineSecret('ZOKO_WEBHOOK_SECRET');

const COLLECTIONS = {
  CONVERSATIONS: 'whatsappConversations',
  CUSTOMERS: 'customers',
  BUSINESS_EVENTS: 'businessEvents',
};

/**
 * Find a customer by phone number
 * Checks primary phone and contacts[].phone
 * @param {string} phoneNumber - Normalized phone number
 * @returns {Promise<object|null>} Customer data or null
 */
async function findCustomerByPhone(phoneNumber) {
  // Check primary phone field
  const primaryMatch = await db
    .collection(COLLECTIONS.CUSTOMERS)
    .where('phone', '==', phoneNumber)
    .limit(1)
    .get();

  if (!primaryMatch.empty) {
    const doc = primaryMatch.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  // Also try with '+' prefix
  const withPlus = await db
    .collection(COLLECTIONS.CUSTOMERS)
    .where('phone', '==', '+' + phoneNumber)
    .limit(1)
    .get();

  if (!withPlus.empty) {
    const doc = withPlus.docs[0];
    return { id: doc.id, ...doc.data() };
  }

  // Check with leading zero format (e.g., 0XXXXXXXXX for Uganda)
  if (phoneNumber.startsWith('256') && phoneNumber.length > 3) {
    const localFormat = '0' + phoneNumber.substring(3);
    const localMatch = await db
      .collection(COLLECTIONS.CUSTOMERS)
      .where('phone', '==', localFormat)
      .limit(1)
      .get();

    if (!localMatch.empty) {
      const doc = localMatch.docs[0];
      return { id: doc.id, ...doc.data() };
    }
  }

  return null;
}

/**
 * Find or create a conversation for an inbound message
 */
async function findOrCreateConversation(phoneNumber, customer) {
  const normalized = normalizePhoneNumber(phoneNumber);

  // Try to find existing conversation
  const existing = await db
    .collection(COLLECTIONS.CONVERSATIONS)
    .where('phoneNumber', '==', normalized)
    .limit(1)
    .get();

  if (!existing.empty) {
    return { id: existing.docs[0].id, ...existing.docs[0].data(), isNew: false };
  }

  // Create new conversation
  const newRef = db.collection(COLLECTIONS.CONVERSATIONS).doc();
  const now = admin.firestore.FieldValue.serverTimestamp();
  const windowExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  const conversation = {
    id: newRef.id,
    customerId: customer?.id || null,
    customerName: customer?.name || `Unknown (${normalized})`,
    phoneNumber: normalized,
    lastInboundAt: now,
    windowExpiresAt: admin.firestore.Timestamp.fromDate(windowExpires),
    isWindowOpen: true,
    status: 'active',
    unreadCount: 1,
    lastMessageText: '',
    lastMessageAt: now,
    lastMessageDirection: 'inbound',
    createdAt: now,
    updatedAt: now,
  };

  await newRef.set(conversation);
  return { ...conversation, isNew: true };
}

/**
 * Store an inbound message
 */
async function storeInboundMessage(conversationId, messageData) {
  const messageRef = db
    .collection(COLLECTIONS.CONVERSATIONS)
    .doc(conversationId)
    .collection('messages')
    .doc();

  const message = {
    id: messageRef.id,
    conversationId,
    direction: 'inbound',
    senderType: 'customer',
    status: 'delivered',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    ...messageData,
  };

  await messageRef.set(message);
  return message;
}

/**
 * Emit a business event for the intelligence layer
 */
async function emitBusinessEvent(eventType, conversation, messageText) {
  const eventRef = db.collection(COLLECTIONS.BUSINESS_EVENTS).doc();
  await eventRef.set({
    id: eventRef.id,
    eventType,
    category: 'client_interaction',
    severity: 'medium',
    sourceModule: 'customer_hub',
    subsidiary: 'finishes',
    entityType: 'customer',
    entityId: conversation.customerId || conversation.id,
    entityName: conversation.customerName,
    title: `WhatsApp message from ${conversation.customerName}`,
    description: messageText
      ? `Customer sent: "${messageText.substring(0, 200)}${messageText.length > 200 ? '...' : ''}"`
      : 'Customer sent a WhatsApp message',
    previousState: null,
    currentState: { messageReceived: true, conversationId: conversation.id },
    triggeredBy: 'system',
    triggeredByName: 'Zoko Webhook',
    triggeredAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'pending',
    metadata: {
      conversationId: conversation.id,
      phoneNumber: conversation.phoneNumber,
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Process an inbound message from a customer
 */
async function handleInboundMessage(payload) {
  const senderPhone = payload.sender || payload.from || payload.phone;
  if (!senderPhone) {
    logger.warn('Inbound message missing sender phone', { payload });
    return;
  }

  const normalized = normalizePhoneNumber(senderPhone);
  const customer = await findCustomerByPhone(normalized);
  const conversation = await findOrCreateConversation(normalized, customer);
  const windowExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Determine message type and content
  const messageType = payload.type || 'text';
  const messageData = {
    messageType,
    textContent: payload.text || payload.message || payload.body || '',
    zokoMessageId: payload.messageId || payload.id || null,
  };

  if (messageType === 'image') {
    messageData.imageUrl = payload.url || payload.mediaUrl || '';
    messageData.imageCaption = payload.caption || '';
    messageData.textContent = messageData.imageCaption || '[Image]';
  }

  // Store the message
  await storeInboundMessage(conversation.id, messageData);

  // Update conversation metadata
  await db.collection(COLLECTIONS.CONVERSATIONS).doc(conversation.id).update({
    lastInboundAt: admin.firestore.FieldValue.serverTimestamp(),
    windowExpiresAt: admin.firestore.Timestamp.fromDate(windowExpires),
    isWindowOpen: true,
    lastMessageText: messageData.textContent.substring(0, 200),
    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
    lastMessageDirection: 'inbound',
    unreadCount: admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    // Link to customer if found and not already linked
    ...(customer && !conversation.customerId
      ? { customerId: customer.id, customerName: customer.name }
      : {}),
  });

  // Emit business event for intelligence layer
  await emitBusinessEvent('whatsapp_message_received', conversation, messageData.textContent);

  logger.info('Inbound WhatsApp message processed', {
    conversationId: conversation.id,
    customerId: customer?.id || 'unknown',
    isNewConversation: conversation.isNew,
  });
}

/**
 * Process a delivery status update
 */
async function handleStatusUpdate(payload) {
  const zokoMessageId = payload.messageId || payload.id;
  if (!zokoMessageId) {
    logger.warn('Status update missing messageId', { payload });
    return;
  }

  const status = payload.status || payload.event;
  const statusMap = {
    sent: 'sent',
    delivered: 'delivered',
    read: 'read',
    failed: 'failed',
    error: 'failed',
  };

  const mappedStatus = statusMap[status] || status;

  // Find the message by zokoMessageId across all conversations
  // This requires a collection group query
  const messagesQuery = await db
    .collectionGroup('messages')
    .where('zokoMessageId', '==', zokoMessageId)
    .limit(1)
    .get();

  if (messagesQuery.empty) {
    logger.warn('Message not found for status update', { zokoMessageId, status });
    return;
  }

  const messageDoc = messagesQuery.docs[0];
  const updateData = { status: mappedStatus, updatedAt: admin.firestore.FieldValue.serverTimestamp() };

  if (mappedStatus === 'delivered') {
    updateData.deliveredAt = admin.firestore.FieldValue.serverTimestamp();
  } else if (mappedStatus === 'read') {
    updateData.readAt = admin.firestore.FieldValue.serverTimestamp();
  } else if (mappedStatus === 'failed') {
    updateData.errorMessage = payload.error || payload.reason || 'Delivery failed';
  }

  await messageDoc.ref.update(updateData);

  logger.info('Message status updated', { zokoMessageId, status: mappedStatus });
}

/**
 * Zoko Webhook Receiver - Public HTTP endpoint
 * Called by Zoko servers when messages are received or delivery status changes
 */
const zokoWebhook = onRequest(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 30,
    secrets: [ZOKO_WEBHOOK_SECRET],
  },
  async (req, res) => {
    // Only accept POST
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    // Verify webhook secret
    const secret = req.query.secret;
    const expectedSecret = ZOKO_WEBHOOK_SECRET.value();
    if (expectedSecret && secret !== expectedSecret) {
      logger.warn('Webhook authentication failed', { providedSecret: secret ? 'present' : 'missing' });
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Respond quickly to avoid Zoko timeout
    res.status(200).json({ received: true });

    try {
      const payload = req.body;
      logger.info('Zoko webhook received', { type: payload.type || payload.event || 'unknown' });

      // Route by event type
      const eventType = payload.type || payload.event || '';

      if (['message', 'text', 'image', 'document', 'video', 'audio'].includes(eventType)) {
        await handleInboundMessage(payload);
      } else if (['sent', 'delivered', 'read', 'failed', 'error', 'status'].includes(eventType)) {
        await handleStatusUpdate(payload);
      } else {
        logger.info('Unhandled webhook event type', { eventType, payload });
      }
    } catch (err) {
      // Log but don't fail - we already sent 200
      logger.error('Error processing Zoko webhook', { error: err.message, stack: err.stack });
    }
  }
);

module.exports = {
  zokoWebhook,
  ZOKO_WEBHOOK_SECRET,
};
