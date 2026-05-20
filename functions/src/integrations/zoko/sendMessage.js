/**
 * Zoko WhatsApp - Send Message Cloud Functions
 * HTTP-callable functions for sending outbound WhatsApp messages
 */

const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../../config/cors');
const { ZOKO_API_KEY, sendTextMessage, sendTemplateMessage, sendImageMessage } = require('./zokoClient');
const { normalizePhoneNumber, isValidPhoneNumber } = require('./utils');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const COLLECTIONS = {
  CONVERSATIONS: 'whatsappConversations',
  TEMPLATES: 'whatsappTemplates',
  CONFIG: 'systemConfig',
};

/**
 * Verify Firebase ID token from Authorization header
 * @param {object} req - Express request
 * @returns {Promise<object>} Decoded token
 */
async function verifyAuth(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    throw new Error('Missing or invalid Authorization header');
  }
  const idToken = authHeader.split('Bearer ')[1];
  return admin.auth().verifyIdToken(idToken);
}

/**
 * Check if user has an allowed role for WhatsApp messaging
 * @param {string} uid - User UID
 * @returns {Promise<boolean>}
 */
async function hasWhatsAppAccess(uid) {
  // Check systemConfig for allowed roles
  const configDoc = await db.collection(COLLECTIONS.CONFIG).doc('whatsappConfig').get();
  const config = configDoc.exists ? configDoc.data() : {};
  const allowedRoles = config.allowedSenderRoles || ['admin', 'design-manager', 'client-liaison'];

  // Get user's custom claims for role
  const userRecord = await admin.auth().getUser(uid);
  const claims = userRecord.customClaims || {};
  const userRole = claims.role || '';

  return allowedRoles.includes(userRole) || claims.admin === true;
}

/**
 * Check if the 24-hour messaging window is open for a conversation
 * @param {object} conversation - Conversation document data
 * @returns {boolean}
 */
function isWindowOpen(conversation) {
  if (!conversation.lastInboundAt) return false;
  const lastInbound = conversation.lastInboundAt.toDate ? conversation.lastInboundAt.toDate() : new Date(conversation.lastInboundAt);
  const windowEnd = new Date(lastInbound.getTime() + 24 * 60 * 60 * 1000);
  return new Date() < windowEnd;
}

/**
 * Store an outbound message in Firestore
 */
async function storeOutboundMessage(conversationId, messageData) {
  const messageRef = db
    .collection(COLLECTIONS.CONVERSATIONS)
    .doc(conversationId)
    .collection('messages')
    .doc();

  const message = {
    id: messageRef.id,
    conversationId,
    direction: 'outbound',
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    ...messageData,
  };

  await messageRef.set(message);

  // Update conversation summary
  await db.collection(COLLECTIONS.CONVERSATIONS).doc(conversationId).update({
    lastMessageText: messageData.textContent || `[${messageData.messageType}]`,
    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
    lastMessageDirection: 'outbound',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  return message;
}

/**
 * Get or create a conversation for a customer + phone number
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
 * Send WhatsApp Message - HTTP endpoint
 * POST /whatsapp/send
 *
 * Body: {
 *   conversationId?: string,
 *   customerId?: string,
 *   customerName?: string,
 *   phoneNumber: string,
 *   messageType: 'text' | 'template' | 'image',
 *   text?: string,
 *   templateId?: string,
 *   templateName?: string,
 *   templateParams?: object,
 *   imageUrl?: string,
 *   imageCaption?: string,
 * }
 */
const sendWhatsAppMessage = onRequest(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 60,
    cors: ALLOWED_ORIGINS,
    secrets: [ZOKO_API_KEY],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // Verify auth
      const decodedToken = await verifyAuth(req);
      const uid = decodedToken.uid;

      // Check role access
      const hasAccess = await hasWhatsAppAccess(uid);
      if (!hasAccess) {
        return res.status(403).json({ error: 'Insufficient permissions to send WhatsApp messages' });
      }

      const {
        conversationId: existingConversationId,
        customerId,
        customerName,
        phoneNumber,
        messageType,
        text,
        templateId,
        templateName,
        templateParams,
        imageUrl,
        imageCaption,
      } = req.body;

      // Validate phone number
      const normalized = normalizePhoneNumber(phoneNumber);
      if (!isValidPhoneNumber(normalized)) {
        return res.status(400).json({ error: 'Invalid phone number' });
      }

      // Get or create conversation
      let conversation;
      if (existingConversationId) {
        const doc = await db.collection(COLLECTIONS.CONVERSATIONS).doc(existingConversationId).get();
        if (!doc.exists) {
          return res.status(404).json({ error: 'Conversation not found' });
        }
        conversation = { id: doc.id, ...doc.data() };
      } else {
        conversation = await getOrCreateConversation(customerId, customerName, normalized);
      }

      // For non-template messages, check 24-hour window
      if (messageType !== 'template' && !isWindowOpen(conversation)) {
        return res.status(400).json({
          error: 'Messaging window is closed. Use a template message to re-engage the customer.',
          windowClosed: true,
        });
      }

      // Get sender info
      const senderName = decodedToken.name || decodedToken.email || 'Unknown';

      // Send via Zoko
      let zokoResult;
      let messageData;

      switch (messageType) {
        case 'text':
          if (!text) return res.status(400).json({ error: 'Text content is required' });
          zokoResult = await sendTextMessage(normalized, text);
          messageData = {
            messageType: 'text',
            textContent: text,
            senderType: 'employee',
            senderId: uid,
            senderName,
          };
          break;

        case 'template':
          if (!templateId) return res.status(400).json({ error: 'Template ID is required' });
          zokoResult = await sendTemplateMessage(normalized, templateId, templateParams || {});
          messageData = {
            messageType: 'template',
            templateId,
            templateName: templateName || templateId,
            templateParams: templateParams || {},
            textContent: `[Template: ${templateName || templateId}]`,
            senderType: 'employee',
            senderId: uid,
            senderName,
          };
          break;

        case 'image':
          if (!imageUrl) return res.status(400).json({ error: 'Image URL is required' });
          zokoResult = await sendImageMessage(normalized, imageUrl, imageCaption || '');
          messageData = {
            messageType: 'image',
            imageUrl,
            imageCaption: imageCaption || '',
            textContent: imageCaption || '[Image]',
            senderType: 'employee',
            senderId: uid,
            senderName,
          };
          break;

        default:
          return res.status(400).json({ error: `Unsupported message type: ${messageType}` });
      }

      // Store the message with Zoko message ID for delivery tracking
      messageData.zokoMessageId = zokoResult?.messageId || zokoResult?.id || null;
      messageData.status = 'sent';
      const storedMessage = await storeOutboundMessage(conversation.id, messageData);

      logger.info('WhatsApp message sent successfully', {
        conversationId: conversation.id,
        messageType,
        zokoMessageId: messageData.zokoMessageId,
      });

      return res.status(200).json({
        success: true,
        conversationId: conversation.id,
        messageId: storedMessage.id,
        zokoMessageId: messageData.zokoMessageId,
      });
    } catch (err) {
      logger.error('Failed to send WhatsApp message', { error: err.message, stack: err.stack });
      return res.status(500).json({ error: 'Failed to send message', details: err.message });
    }
  }
);

module.exports = {
  sendWhatsAppMessage,
};
