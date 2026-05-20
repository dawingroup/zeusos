/**
 * Meta WhatsApp - Auto-Reply Processor
 * Checks automation rules and sends appropriate auto-responses
 * Called from the webhook handler before AI agent processing.
 */

const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const {
  sendTemplateMessage,
} = require('./metaCloudApiClient');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Check if current time is within business hours
 */
function isWithinBusinessHours(businessHours) {
  if (!businessHours) return true;

  const { start, end, timezone, days } = businessHours;

  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone || 'Africa/Kampala',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      weekday: 'short',
    });

    const parts = formatter.formatToParts(now);
    const hour = parseInt(parts.find((p) => p.type === 'hour')?.value || '0');
    const minute = parseInt(parts.find((p) => p.type === 'minute')?.value || '0');
    const dayName = parts.find((p) => p.type === 'weekday')?.value || '';

    const dayMap = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    const currentDay = dayMap[dayName] ?? new Date().getDay();

    // Check day
    if (days && !days.includes(currentDay)) return false;

    // Check time
    const currentMinutes = hour * 60 + minute;
    const [startH, startM] = (start || '09:00').split(':').map(Number);
    const [endH, endM] = (end || '17:00').split(':').map(Number);
    const startMinutes = startH * 60 + startM;
    const endMinutes = endH * 60 + endM;

    return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
  } catch (err) {
    logger.warn('Business hours check failed', { error: err.message });
    return true; // Default to within hours on error
  }
}

/**
 * Process auto-reply rules for an inbound message
 * Returns true if an auto-reply was sent, false otherwise
 */
async function processAutoReply(conversationId, messageText, phoneNumber) {
  logger.info('Checking auto-reply rules', { conversationId });

  const automationSnap = await db.doc('systemConfig/whatsappAutomation').get();
  if (!automationSnap.exists) return false;

  const automation = automationSnap.data();

  // 1. Check welcome message (first message from this contact)
  if (automation.welcomeMessageEnabled && automation.welcomeTemplateId) {
    const convSnap = await db.doc(`whatsappConversations/${conversationId}`).get();
    const conv = convSnap.data();

    // Check if this is the first inbound message (no prior lastInboundAt)
    if (!conv.lastInboundAt || conv.lastInboundAt === null) {
      try {
        const templateSnap = await db.doc(`whatsappTemplates/${automation.welcomeTemplateId}`).get();
        if (templateSnap.exists) {
          const template = templateSnap.data();
          await sendTemplateMessage(
            phoneNumber,
            template.metaTemplateName || template.name,
            template.language || 'en'
          );
          await storeAutoReply(conversationId, `[Welcome template: ${template.name}]`);
          logger.info('Welcome auto-reply sent', { conversationId });
          return true;
        }
      } catch (err) {
        logger.warn('Welcome auto-reply failed', { error: err.message });
      }
    }
  }

  // 2. Check away message (outside business hours)
  if (automation.awayMessageEnabled && automation.awayTemplateId) {
    if (!isWithinBusinessHours(automation.businessHours)) {
      try {
        const templateSnap = await db.doc(`whatsappTemplates/${automation.awayTemplateId}`).get();
        if (templateSnap.exists) {
          const template = templateSnap.data();
          await sendTemplateMessage(
            phoneNumber,
            template.metaTemplateName || template.name,
            template.language || 'en'
          );
          await storeAutoReply(conversationId, `[Away template: ${template.name}]`);
          logger.info('Away auto-reply sent', { conversationId });
          return true;
        }
      } catch (err) {
        logger.warn('Away auto-reply failed', { error: err.message });
      }
    }
  }

  // 3. Check keyword triggers
  if (automation.keywordTriggers && automation.keywordTriggers.length > 0 && messageText) {
    const lowerMessage = messageText.toLowerCase().trim();

    for (const trigger of automation.keywordTriggers) {
      if (!trigger.keyword || !trigger.templateId) continue;

      const match = trigger.exact
        ? lowerMessage === trigger.keyword.toLowerCase()
        : lowerMessage.includes(trigger.keyword.toLowerCase());

      if (match) {
        try {
          const templateSnap = await db.doc(`whatsappTemplates/${trigger.templateId}`).get();
          if (templateSnap.exists) {
            const template = templateSnap.data();
            await sendTemplateMessage(
              phoneNumber,
              template.metaTemplateName || template.name,
              template.language || 'en'
            );
            await storeAutoReply(
              conversationId,
              `[Keyword "${trigger.keyword}" → template: ${template.name}]`
            );
            logger.info('Keyword auto-reply sent', {
              conversationId,
              keyword: trigger.keyword,
            });
            return true;
          }
        } catch (err) {
          logger.warn('Keyword auto-reply failed', { keyword: trigger.keyword, error: err.message });
        }
      }
    }
  }

  return false;
}

/**
 * Store an auto-reply message in Firestore
 */
async function storeAutoReply(conversationId, text) {
  await db.collection(`whatsappConversations/${conversationId}/messages`).add({
    direction: 'outbound',
    messageType: 'template',
    textContent: text,
    status: 'sent',
    provider: 'meta',
    senderType: 'system',
    senderName: 'Auto-Reply',
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  await db.doc(`whatsappConversations/${conversationId}`).update({
    lastMessageText: text.substring(0, 200),
    lastMessageAt: admin.firestore.FieldValue.serverTimestamp(),
    lastMessageDirection: 'outbound',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });
}

module.exports = {
  processAutoReply,
  isWithinBusinessHours,
};
