/**
 * Meta WhatsApp - Broadcast Executor
 * Sends template messages in bulk to multiple recipients
 * with rate limiting and progress tracking.
 */

const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../../config/cors');
const {
  META_WHATSAPP_ACCESS_TOKEN,
  META_WHATSAPP_PHONE_NUMBER_ID,
  sendTemplateMessage,
} = require('./metaCloudApiClient');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Rate limiter - Meta allows 80 messages/second for verified businesses
 * We use a conservative 20/second to avoid hitting limits
 */
const BATCH_SIZE = 20;
const BATCH_DELAY_MS = 1100; // slightly over 1 second

/**
 * Execute a broadcast by sending templates to all recipients
 */
async function executeBroadcastInternal(broadcastId) {
  const broadcastRef = db.doc(`whatsappBroadcasts/${broadcastId}`);
  const snap = await broadcastRef.get();

  if (!snap.exists) {
    throw new Error(`Broadcast ${broadcastId} not found`);
  }

  const broadcast = snap.data();

  if (broadcast.status !== 'draft' && broadcast.status !== 'scheduled') {
    throw new Error(`Broadcast is in '${broadcast.status}' status, cannot execute`);
  }

  // Mark as sending
  await broadcastRef.update({
    status: 'sending',
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  const phones = broadcast.audience?.phones || [];
  const templateName = broadcast.templateName;
  const templateLanguage = broadcast.templateLanguage || 'en';
  const params = broadcast.parameters || {};

  // Build template components from parameters
  const components = [];
  const paramKeys = Object.keys(params).sort((a, b) => parseInt(a) - parseInt(b));
  if (paramKeys.length > 0) {
    components.push({
      type: 'body',
      parameters: paramKeys.map((key) => ({
        type: 'text',
        text: String(params[key]),
      })),
    });
  }

  let sentCount = 0;
  let failedCount = 0;

  // Process in batches
  for (let i = 0; i < phones.length; i += BATCH_SIZE) {
    const batch = phones.slice(i, i + BATCH_SIZE);
    const promises = batch.map(async (phone) => {
      const recipientRef = db.doc(`whatsappBroadcasts/${broadcastId}/recipients/${phone.replace(/\+/g, '')}`);
      try {
        const result = await sendTemplateMessage(phone, templateName, templateLanguage, components);
        const waMessageId = result.messages?.[0]?.id;

        await recipientRef.set({
          phone,
          status: 'sent',
          waMessageId: waMessageId || null,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        sentCount++;
      } catch (err) {
        logger.warn('Broadcast message failed', { phone: phone.substring(0, 6) + '...', error: err.message });
        await recipientRef.set({
          phone,
          status: 'failed',
          error: err.message,
          sentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        failedCount++;
      }
    });

    await Promise.all(promises);

    // Update progress
    await broadcastRef.update({
      sentCount,
      failedCount,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    // Rate limiting delay between batches
    if (i + BATCH_SIZE < phones.length) {
      await new Promise((resolve) => setTimeout(resolve, BATCH_DELAY_MS));
    }
  }

  // Mark as completed
  await broadcastRef.update({
    status: failedCount === phones.length ? 'failed' : 'completed',
    sentCount,
    failedCount,
    completedAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  logger.info('Broadcast completed', { broadcastId, sentCount, failedCount });
  return { sentCount, failedCount };
}

/**
 * HTTP endpoint: Execute a broadcast (admin only)
 */
const executeBroadcast = onRequest(
  {
    region: 'us-central1',
    memory: '512MiB',
    timeoutSeconds: 300,
    cors: ALLOWED_ORIGINS,
    secrets: [META_WHATSAPP_ACCESS_TOKEN, META_WHATSAPP_PHONE_NUMBER_ID],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // Verify auth
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const idToken = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(idToken);

      // Check admin access
      const userRecord = await admin.auth().getUser(decoded.uid);
      const claims = userRecord.customClaims || {};
      let isAdmin = claims.admin === true || ['admin', 'owner'].includes(claims.role);
      if (!isAdmin) {
        const userSnap = await db
          .collection('organizations/default/users')
          .where('uid', '==', decoded.uid)
          .limit(1)
          .get();
        if (!userSnap.empty) {
          const globalRole = userSnap.docs[0].data().globalRole || '';
          isAdmin = ['admin', 'owner'].includes(globalRole);
        }
      }
      if (!isAdmin) {
        return res.status(403).json({ error: 'Admin access required' });
      }

      const { broadcastId } = req.body;
      if (!broadcastId) {
        return res.status(400).json({ error: 'broadcastId is required' });
      }

      const result = await executeBroadcastInternal(broadcastId);
      return res.status(200).json({ success: true, ...result });
    } catch (err) {
      logger.error('executeBroadcast failed', { error: err.message });
      return res.status(500).json({ error: err.message });
    }
  }
);

module.exports = {
  executeBroadcast,
};
