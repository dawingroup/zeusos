/**
 * Test script to diagnose QuickBooks connection issues
 */

const admin = require('firebase-admin');

// Initialize Firebase Admin
admin.initializeApp({
  projectId: 'dawinos'
});

const db = admin.firestore();

async function testQBOConnection() {
  try {
    console.log('Checking QuickBooks connection document...');

    const doc = await db.collection('integrations').doc('quickbooks').get();

    if (!doc.exists) {
      console.error('❌ QuickBooks document does not exist in Firestore');
      console.error('   Path: /integrations/quickbooks');
      console.error('   This means OAuth connection failed or tokens were not saved');
      return;
    }

    const data = doc.data();
    console.log('\n✅ QuickBooks document exists');
    console.log('   Connected at:', data.connected_at?.toDate?.());
    console.log('   Connected by:', data.connected_by);
    console.log('   Realm ID:', data.realm_id);
    console.log('   Tokens encrypted:', data.tokens_encrypted);
    console.log('   Token type:', data.token_type);
    console.log('   Expires in:', data.expires_in, 'seconds');
    console.log('   Created at:', new Date(data.created_at));

    // Check if tokens are encrypted
    if (data.tokens_encrypted) {
      console.log('\n🔐 Tokens are encrypted');
      console.log('   Access token encrypted length:', data.access_token_encrypted?.length || 0);
      console.log('   Refresh token encrypted length:', data.refresh_token_encrypted?.length || 0);

      // Check if tokens have the correct format (iv:authTag:encrypted)
      if (data.access_token_encrypted) {
        const parts = data.access_token_encrypted.split(':');
        console.log('   Access token format: ' + (parts.length === 3 ? '✅ Valid (iv:authTag:encrypted)' : '❌ Invalid'));
      }
      if (data.refresh_token_encrypted) {
        const parts = data.refresh_token_encrypted.split(':');
        console.log('   Refresh token format: ' + (parts.length === 3 ? '✅ Valid (iv:authTag:encrypted)' : '❌ Invalid'));
      }
    } else {
      console.log('\n⚠️  Tokens are NOT encrypted (legacy format)');
    }

    // Check token expiration
    const createdAt = data.created_at;
    const expiresIn = data.expires_in;
    const expiresAt = createdAt + expiresIn * 1000;
    const now = Date.now();

    console.log('\n⏰ Token Status:');
    console.log('   Token expires at:', new Date(expiresAt));
    console.log('   Current time:', new Date(now));

    if (now < expiresAt) {
      const minutesLeft = Math.floor((expiresAt - now) / 1000 / 60);
      console.log('   Status: ✅ Valid (expires in', minutesLeft, 'minutes)');
    } else {
      console.log('   Status: ❌ EXPIRED (needs refresh)');
    }

    // Check refresh token expiration
    const refreshExpiresAt = createdAt + data.x_refresh_token_expires_in * 1000;
    console.log('\n🔄 Refresh Token Status:');
    console.log('   Refresh token expires at:', new Date(refreshExpiresAt));
    if (now < refreshExpiresAt) {
      const daysLeft = Math.floor((refreshExpiresAt - now) / 1000 / 60 / 60 / 24);
      console.log('   Status: ✅ Valid (expires in', daysLeft, 'days)');
    } else {
      console.log('   Status: ❌ EXPIRED (need to reconnect)');
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
    console.error(error);
  } finally {
    process.exit(0);
  }
}

testQBOConnection();
