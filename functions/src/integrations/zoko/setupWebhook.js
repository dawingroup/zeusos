/**
 * Zoko WhatsApp - Webhook Setup Cloud Function
 * One-time admin function to register the webhook URL with Zoko
 */

const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../../config/cors');
const { ZOKO_API_KEY, registerWebhook } = require('./zokoClient');
const { ZOKO_WEBHOOK_SECRET } = require('../../webhooks/zokoWebhook');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Register the Zoko webhook - Admin only
 * POST /whatsapp/setup-webhook
 *
 * This registers the zokoWebhook Cloud Function URL with Zoko
 * so that inbound messages and delivery statuses are forwarded to our system.
 */
const setupZokoWebhook = onRequest(
  {
    region: 'us-central1',
    memory: '256MiB',
    timeoutSeconds: 30,
    cors: ALLOWED_ORIGINS,
    secrets: [ZOKO_API_KEY, ZOKO_WEBHOOK_SECRET],
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
      // Verify auth - admin only
      const authHeader = req.headers.authorization;
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      const idToken = authHeader.split('Bearer ')[1];
      const decoded = await admin.auth().verifyIdToken(idToken);
      const userRecord = await admin.auth().getUser(decoded.uid);
      const claims = userRecord.customClaims || {};
      if (!claims.admin && claims.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }

      // Build the webhook URL
      // The webhook URL includes the secret as a query parameter for authentication
      const projectId = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || 'dawin-cutlist-processor';
      const webhookSecret = ZOKO_WEBHOOK_SECRET.value();
      const webhookUrl = `https://us-central1-${projectId}.cloudfunctions.net/zokoWebhook?secret=${webhookSecret}`;

      // Register with Zoko
      const result = await registerWebhook(webhookUrl);

      // Store webhook registration status
      await db.collection('systemConfig').doc('whatsappConfig').set(
        {
          webhookRegistered: true,
          webhookUrl: webhookUrl.split('?')[0], // Store URL without secret
          webhookRegisteredAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        },
        { merge: true }
      );

      logger.info('Zoko webhook registered successfully');

      return res.status(200).json({
        success: true,
        webhookUrl: webhookUrl.split('?')[0],
        zokoResponse: result,
      });
    } catch (err) {
      logger.error('Webhook setup failed', { error: err.message });
      return res.status(500).json({ error: 'Webhook setup failed', details: err.message });
    }
  }
);

module.exports = {
  setupZokoWebhook,
};
