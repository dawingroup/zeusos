/**
 * Clear QuickBooks tokens to force reconnection
 */
const admin = require('firebase-admin');
admin.initializeApp({ projectId: 'dawinos' });

async function clearTokens() {
  try {
    const db = admin.firestore();
    await db.collection('integrations').doc('quickbooks').delete();
    console.log('✅ QuickBooks tokens cleared. Please reconnect from the UI.');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

clearTokens();
