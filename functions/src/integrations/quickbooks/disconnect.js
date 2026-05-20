/**
 * QuickBooks Disconnect Handler
 * Clears stored OAuth tokens to force reconnection
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../../config/cors');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

/**
 * Disconnect QuickBooks by clearing stored tokens
 */
exports.disconnectQuickBooks = onCall({
  cors: ALLOWED_ORIGINS,
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    console.log('🔌 Disconnecting QuickBooks...');

    // Delete the QuickBooks integration document
    await db.collection('integrations').doc('quickbooks').delete();

    console.log('✅ QuickBooks disconnected successfully');

    return {
      success: true,
      message: 'QuickBooks has been disconnected. You can now reconnect with fresh credentials.',
    };
  } catch (error) {
    console.error('❌ Failed to disconnect QuickBooks:', error);
    throw new HttpsError('internal', `Failed to disconnect: ${error.message}`);
  }
});
