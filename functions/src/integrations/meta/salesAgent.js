/**
 * Meta WhatsApp - AI Sales Agent
 * Uses Claude AI to automatically respond to customer messages
 * with product recommendations, order assistance, and sales support.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../../config/cors');
const {
  META_WHATSAPP_ACCESS_TOKEN,
  META_WHATSAPP_PHONE_NUMBER_ID,
  sendTextMessage,
  sendInteractiveMessage,
} = require('./metaCloudApiClient');
const { createMessageWithRetry } = require('../../utils/claudeClient');

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const DEFAULT_SYSTEM_PROMPT = `You are a helpful sales assistant for DawinOS. You help customers:
- Find products and answer questions about them
- Provide pricing information
- Process orders and share checkout links
- Suggest related products

Be friendly, professional, and concise. Keep responses under 200 words.
If you're unsure about something, say so and offer to connect them with a human agent.`;

/**
 * Process an inbound WhatsApp message with AI and respond
 * Called internally from the webhook handler
 */
async function processWithAI(conversationId, messageText, customerName, phoneNumber) {
  logger.info('Processing message with AI sales agent', { conversationId });

  // Load automation config
  const automationSnap = await db.doc('systemConfig/whatsappAutomation').get();
  const automation = automationSnap.exists ? automationSnap.data() : {};

  if (!automation.aiAgentEnabled) {
    logger.info('AI agent is disabled, skipping');
    return null;
  }

  const systemPrompt = automation.aiSystemPrompt || DEFAULT_SYSTEM_PROMPT;

  // Load recent conversation context (last 10 messages)
  const messagesSnap = await db
    .collection(`whatsappConversations/${conversationId}/messages`)
    .orderBy('createdAt', 'desc')
    .limit(10)
    .get();

  const conversationHistory = messagesSnap.docs
    .reverse()
    .map((doc) => {
      const msg = doc.data();
      const role = msg.direction === 'inbound' ? 'Customer' : 'Assistant';
      return `${role}: ${msg.textContent || '[non-text message]'}`;
    })
    .join('\n');

  // Load available products for context
  let productContext = '';
  try {
    const productsSnap = await db
      .collection('shopifyProducts')
      .where('status', '==', 'active')
      .limit(20)
      .get();

    if (!productsSnap.empty) {
      const products = productsSnap.docs.map((doc) => {
        const p = doc.data();
        return `- ${p.title}: ${p.currency || 'UGX'} ${p.price} (${p.status})`;
      });
      productContext = `\n\nAvailable Products:\n${products.join('\n')}`;
    }
  } catch (err) {
    logger.warn('Failed to load products for AI context', { error: err.message });
  }

  const fullSystemPrompt = `${systemPrompt}${productContext}\n\nCustomer name: ${customerName}`;
  const userMessage = `Conversation history:\n${conversationHistory}\n\nLatest message from customer: ${messageText}`;

  try {
    const apiKey = ANTHROPIC_API_KEY.value();
    const aiResponse = await createMessageWithRetry(apiKey, 'fast', fullSystemPrompt, userMessage);

    if (!aiResponse || !aiResponse.trim()) {
      logger.warn('AI returned empty response');
      return null;
    }

    // Send the AI response via WhatsApp
    const result = await sendTextMessage(phoneNumber, aiResponse.trim());
    const waMessageId = result.messages?.[0]?.id;

    // Store the AI response in Firestore
    await db
      .collection(`whatsappConversations/${conversationId}/messages`)
      .add({
        direction: 'outbound',
        messageType: 'text',
        textContent: aiResponse.trim(),
        status: 'sent',
        waMessageId: waMessageId || null,
        provider: 'meta',
        senderType: 'bot',
        senderName: 'AI Sales Agent',
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });

    // Update conversation
    await db.doc(`whatsappConversations/${conversationId}`).update({
      lastMessageText: aiResponse.trim().substring(0, 200),
      lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
      lastMessageDirection: 'outbound',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    logger.info('AI sales agent responded', { conversationId, responseLength: aiResponse.length });
    return { success: true, waMessageId };
  } catch (err) {
    logger.error('AI sales agent failed', { conversationId, error: err.message });
    return null;
  }
}

/**
 * HTTP endpoint: Manually trigger AI processing for a conversation (admin/testing)
 */
const processWhatsAppWithAI = onRequest(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 120,
    cors: ALLOWED_ORIGINS,
    secrets: [META_WHATSAPP_ACCESS_TOKEN, META_WHATSAPP_PHONE_NUMBER_ID, ANTHROPIC_API_KEY],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const idToken = authHeader.split('Bearer ')[1];
      await admin.auth().verifyIdToken(idToken);

      const { conversationId, messageText, customerName, phoneNumber } = req.body;
      if (!conversationId || !messageText || !phoneNumber) {
        return res.status(400).json({ error: 'Missing required fields' });
      }

      const result = await processWithAI(conversationId, messageText, customerName || 'Customer', phoneNumber);
      return res.status(200).json({ success: true, result });
    } catch (err) {
      logger.error('processWhatsAppWithAI failed', { error: err.message });
      return res.status(500).json({ error: err.message });
    }
  }
);

module.exports = {
  processWhatsAppWithAI,
  processWithAI,
};
