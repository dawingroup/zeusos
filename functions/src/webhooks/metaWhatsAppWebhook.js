/**
 * Meta WhatsApp Cloud API Webhook Receiver
 * Receives inbound messages, delivery status updates, and read notifications
 * directly from Meta's servers (replaces Zoko webhook).
 *
 * This is a public HTTP endpoint called by Meta's WhatsApp Cloud API.
 * Authentication is via HMAC-SHA256 signature verification.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { META_WHATSAPP_APP_SECRET } = require('../integrations/meta/metaCloudApiClient');
const { META_WEBHOOK_VERIFY_TOKEN, verifyWebhookChallenge, validateSignature } = require('../integrations/meta/webhookVerification');
const { normalizePhoneNumber } = require('../integrations/meta/utils');
const {
  META_WHATSAPP_ACCESS_TOKEN,
  META_WHATSAPP_PHONE_NUMBER_ID,
  sendTextMessage,
} = require('../integrations/meta/metaCloudApiClient');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const COLLECTIONS = {
  CONVERSATIONS: 'whatsappConversations',
  CUSTOMERS: 'customers',
  BUSINESS_EVENTS: 'businessEvents',
};

/**
 * Find a customer by phone number
 * Checks primary phone and various formats
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

  // Try with '+' prefix
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
async function findOrCreateConversation(phoneNumber, customer, profileName) {
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
    customerName: customer?.name || profileName || `Unknown (${normalized})`,
    phoneNumber: normalized,
    waProfileName: profileName || null,
    provider: 'meta',
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
    provider: 'meta',
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
    triggeredByName: 'Meta WhatsApp Webhook',
    triggeredAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'pending',
    metadata: {
      conversationId: conversation.id,
      phoneNumber: conversation.phoneNumber,
      provider: 'meta',
    },
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

/**
 * Handle quote approval/rejection via interactive button reply
 * Button reply IDs: quote_approve_{quoteId} or quote_reject_{quoteId}
 */
async function handleQuoteButtonReply(buttonReplyId, phoneNumber, conversationId) {
  const match = buttonReplyId.match(/^quote_(approve|reject)_(.+)$/);
  if (!match) return false;

  const action = match[1]; // 'approve' or 'reject'
  const quoteId = match[2];

  try {
    const quoteRef = db.collection('clientQuotes').doc(quoteId);
    const quoteSnap = await quoteRef.get();

    if (!quoteSnap.exists) {
      logger.warn('Quote not found for button reply', { quoteId, action });
      return true; // Consumed the event even though quote wasn't found
    }

    const quote = quoteSnap.data();
    const newStatus = action === 'approve' ? 'approved' : 'rejected';

    // Only process if quote is in a respondable state
    if (!['sent', 'viewed'].includes(quote.status)) {
      logger.info('Quote not in respondable state', { quoteId, currentStatus: quote.status });
      await sendTextMessage(
        phoneNumber,
        `This quote has already been ${quote.status}. No further action needed.`
      );
      return true;
    }

    // Update quote status
    const now = admin.firestore.FieldValue.serverTimestamp();
    await quoteRef.update({
      status: newStatus,
      respondedAt: now,
      clientResponse: {
        status: newStatus,
        notes: `${action === 'approve' ? 'Approved' : 'Rejected'} via WhatsApp`,
        respondedAt: now,
        respondedBy: phoneNumber,
      },
      updatedAt: now,
    });

    // Log activity on the quote
    await quoteRef.collection('activity').add({
      action: newStatus,
      timestamp: now,
      details: `Client responded via WhatsApp button: ${action}`,
      performedBy: phoneNumber,
    });

    // Update linked CRM deal if exists
    if (quote.projectId) {
      const dealsQuery = await db.collection('deals')
        .where('linkedProjectId', '==', quote.projectId)
        .limit(1)
        .get();

      if (!dealsQuery.empty) {
        const dealDoc = dealsQuery.docs[0];
        await dealDoc.ref.collection('activities').add({
          type: 'quote_response',
          activityType: `quote_${newStatus}`,
          title: `Quote ${quote.quoteNumber} ${newStatus} via WhatsApp`,
          details: {
            quoteId,
            quoteNumber: quote.quoteNumber,
            quoteTotal: quote.total,
            quoteCurrency: quote.currency,
            responseChannel: 'whatsapp',
          },
          createdAt: now,
          createdBy: 'system',
        });
      }
    }

    // Send confirmation message back to the customer
    const confirmMsg = action === 'approve'
      ? `Thank you! Your quote *${quote.quoteNumber}* for *${quote.title}* has been *approved*. Our team will be in touch shortly to proceed.`
      : `Your quote *${quote.quoteNumber}* for *${quote.title}* has been *rejected*. If you'd like to discuss alternatives, please reply to this message.`;

    await sendTextMessage(phoneNumber, confirmMsg);

    // Store the confirmation as an outbound message
    if (conversationId) {
      const confirmMsgRef = db
        .collection(COLLECTIONS.CONVERSATIONS)
        .doc(conversationId)
        .collection('messages')
        .doc();

      await confirmMsgRef.set({
        id: confirmMsgRef.id,
        conversationId,
        direction: 'outbound',
        messageType: 'text',
        textContent: confirmMsg,
        senderType: 'system',
        senderName: 'System',
        status: 'sent',
        provider: 'meta',
        createdAt: now,
        sentAt: now,
      });
    }

    logger.info('Quote button reply processed', { quoteId, action, newStatus });
    return true;
  } catch (err) {
    logger.error('Error processing quote button reply', { quoteId, action, error: err.message });
    return true; // Still consumed the event
  }
}

/**
 * Process an inbound message from Meta's webhook
 * Meta payload: entry[].changes[].value.messages[]
 */
async function handleInboundMessage(contact, message, metadata) {
  const senderPhone = message.from;
  if (!senderPhone) {
    logger.warn('Inbound message missing sender phone', { message });
    return;
  }

  const normalized = normalizePhoneNumber(senderPhone);
  const profileName = contact?.profile?.name || null;
  const customer = await findCustomerByPhone(normalized);
  const conversation = await findOrCreateConversation(normalized, customer, profileName);
  const windowExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);

  // Determine message type and content
  const messageType = message.type || 'text';
  const messageData = {
    messageType,
    waMessageId: message.id || null,
  };

  switch (messageType) {
    case 'text':
      messageData.textContent = message.text?.body || '';
      break;
    case 'image':
      messageData.imageUrl = message.image?.id || ''; // Media ID - needs download
      messageData.imageCaption = message.image?.caption || '';
      messageData.textContent = message.image?.caption || '[Image]';
      break;
    case 'document':
      messageData.textContent = message.document?.caption || '[Document]';
      break;
    case 'video':
      messageData.textContent = message.video?.caption || '[Video]';
      break;
    case 'audio':
      messageData.textContent = '[Audio]';
      break;
    case 'location':
      messageData.locationLatitude = message.location?.latitude || null;
      messageData.locationLongitude = message.location?.longitude || null;
      messageData.locationName = message.location?.name || '';
      messageData.locationAddress = message.location?.address || '';
      messageData.textContent = message.location?.name || '[Location]';
      break;
    case 'interactive':
      messageData.interactiveType = message.interactive?.type || '';
      if (message.interactive?.button_reply) {
        messageData.textContent = message.interactive.button_reply.title || '';
        messageData.interactiveBody = message.interactive.button_reply;
      } else if (message.interactive?.list_reply) {
        messageData.textContent = message.interactive.list_reply.title || '';
        messageData.interactiveBody = message.interactive.list_reply;
      }
      break;
    case 'button':
      // Template quick-reply button responses
      // message.button.text = button label, message.button.payload = custom payload
      messageData.textContent = message.button?.text || '';
      messageData.interactiveType = 'quick_reply';
      messageData.interactiveBody = {
        payload: message.button?.payload || '',
        text: message.button?.text || '',
      };
      break;
    default:
      messageData.textContent = `[${messageType}]`;
  }

  // Store the message
  await storeInboundMessage(conversation.id, messageData);

  // Check for quote approval/rejection button replies (interactive reply buttons)
  if (messageType === 'interactive' && message.interactive?.button_reply?.id) {
    const handled = await handleQuoteButtonReply(
      message.interactive.button_reply.id,
      normalized,
      conversation.id
    );
    if (handled) {
      logger.info('Quote button reply handled', { buttonId: message.interactive.button_reply.id });
    }
  }

  // Check for template quick-reply button responses
  // Template buttons arrive as type: 'button' with button.payload
  if (messageType === 'button' && message.button?.payload) {
    const handled = await handleQuoteButtonReply(
      message.button.payload,
      normalized,
      conversation.id
    );
    if (handled) {
      logger.info('Template quick-reply button handled', { payload: message.button.payload });
    }
  }

  // Update conversation metadata
  await db.collection(COLLECTIONS.CONVERSATIONS).doc(conversation.id).update({
    lastInboundAt: admin.firestore.FieldValue.serverTimestamp(),
    windowExpiresAt: admin.firestore.Timestamp.fromDate(windowExpires),
    isWindowOpen: true,
    lastMessageText: (messageData.textContent || '').substring(0, 200),
    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
    lastMessageDirection: 'inbound',
    unreadCount: admin.firestore.FieldValue.increment(1),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    provider: 'meta',
    ...(profileName ? { waProfileName: profileName } : {}),
    // Link to customer if found and not already linked
    ...(customer && !conversation.customerId
      ? { customerId: customer.id, customerName: customer.name }
      : {}),
  });

  // Emit business event for intelligence layer
  await emitBusinessEvent('whatsapp_message_received', conversation, messageData.textContent);

  logger.info('Inbound WhatsApp message processed (Meta)', {
    conversationId: conversation.id,
    customerId: customer?.id || 'unknown',
    messageType,
    isNewConversation: conversation.isNew,
  });
}

/**
 * Process a delivery status update from Meta's webhook
 * Meta payload: entry[].changes[].value.statuses[]
 */
async function handleStatusUpdate(status) {
  const waMessageId = status.id;
  if (!waMessageId) {
    logger.warn('Status update missing message ID', { status });
    return;
  }

  const statusMap = {
    sent: 'sent',
    delivered: 'delivered',
    read: 'read',
    failed: 'failed',
  };

  const mappedStatus = statusMap[status.status] || status.status;

  // Find the message by waMessageId across all conversations
  const messagesQuery = await db
    .collectionGroup('messages')
    .where('waMessageId', '==', waMessageId)
    .limit(1)
    .get();

  if (messagesQuery.empty) {
    logger.debug('Message not found for status update', { waMessageId, status: mappedStatus });
    return;
  }

  const messageDoc = messagesQuery.docs[0];
  const updateData = {
    status: mappedStatus,
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  };

  if (mappedStatus === 'delivered') {
    updateData.deliveredAt = admin.firestore.FieldValue.serverTimestamp();
  } else if (mappedStatus === 'read') {
    updateData.readAt = admin.firestore.FieldValue.serverTimestamp();
  } else if (mappedStatus === 'failed') {
    const errors = status.errors || [];
    updateData.errorMessage = errors.length > 0
      ? `${errors[0].code}: ${errors[0].title}`
      : 'Delivery failed';
  }

  await messageDoc.ref.update(updateData);
  logger.info('Message status updated (Meta)', { waMessageId, status: mappedStatus });
}

/**
 * Process all webhook events from Meta
 */
async function processWebhookEvents(body) {
  if (body.object !== 'whatsapp_business_account') {
    logger.warn('Unexpected webhook object type', { object: body.object });
    return;
  }

  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      if (change.field !== 'messages') continue;

      const value = change.value;
      if (!value) continue;

      const contacts = value.contacts || [];

      // Process inbound messages
      for (const message of value.messages || []) {
        const contact = contacts.find((c) => c.wa_id === message.from) || contacts[0] || null;
        try {
          await handleInboundMessage(contact, message, value.metadata);
        } catch (err) {
          logger.error('Error processing inbound message', {
            error: err.message,
            messageId: message.id,
          });
        }
      }

      // Process status updates
      for (const statusUpdate of value.statuses || []) {
        try {
          await handleStatusUpdate(statusUpdate);
        } catch (err) {
          logger.error('Error processing status update', {
            error: err.message,
            messageId: statusUpdate.id,
          });
        }
      }
    }
  }
}

/**
 * Meta WhatsApp Webhook - Public HTTP endpoint
 * Handles both verification (GET) and event processing (POST)
 */
const metaWhatsAppWebhook = onRequest(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 30,
    secrets: [META_WHATSAPP_APP_SECRET, META_WEBHOOK_VERIFY_TOKEN, META_WHATSAPP_ACCESS_TOKEN, META_WHATSAPP_PHONE_NUMBER_ID],
  },
  async (req, res) => {
    // GET: Webhook verification challenge
    if (req.method === 'GET') {
      const handled = verifyWebhookChallenge(req, res);
      if (handled) return;
      return res.status(400).json({ error: 'Invalid verification request' });
    }

    // POST: Process webhook events
    if (req.method === 'POST') {
      // Validate HMAC-SHA256 signature
      if (!validateSignature(req, META_WHATSAPP_APP_SECRET.value())) {
        return res.status(403).json({ error: 'Invalid signature' });
      }

      // Respond immediately (Meta requires 200 within 20 seconds)
      res.status(200).json({ received: true });

      // Process events asynchronously
      try {
        await processWebhookEvents(req.body);
      } catch (err) {
        logger.error('Error processing Meta webhook', { error: err.message, stack: err.stack });
      }
      return;
    }

    return res.status(405).json({ error: 'Method not allowed' });
  }
);

module.exports = {
  metaWhatsAppWebhook,
  META_WHATSAPP_APP_SECRET,
  META_WEBHOOK_VERIFY_TOKEN,
};
