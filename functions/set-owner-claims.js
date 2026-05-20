/**
 * Set owner claims for admin user
 * Usage: node set-owner-claims.js
 */

const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const TARGET_EMAIL = 'onzimai@dawin.group';

async function main() {
  // Find user by email
  const user = await admin.auth().getUserByEmail(TARGET_EMAIL);
  console.log('User UID:', user.uid);
  console.log('Current claims:', JSON.stringify(user.customClaims || {}, null, 2));

  // Set claims
  const newClaims = {
    ...(user.customClaims || {}),
    globalRole: 'owner',
    role: 'platform_admin',
    subsidiaryId: 'dawin-finishes',
    subsidiaries: ['dawin-finishes', 'dawin-advisory'],
    isActive: true,
  };

  await admin.auth().setCustomUserClaims(user.uid, newClaims);

  // Verify
  const updated = await admin.auth().getUserByEmail(TARGET_EMAIL);
  console.log('\nUpdated claims:', JSON.stringify(updated.customClaims, null, 2));
  console.log('\nDone! The user must sign out and sign back in (or refresh the token) for claims to take effect.');
}

main().catch(console.error);
