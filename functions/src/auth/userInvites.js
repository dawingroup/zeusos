/**
 * User Invites - DawinOS v2.0
 * Cloud Functions for processing user invitations
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

const db = admin.firestore();
const DEFAULT_ORG = 'default';

/**
 * Process a new user invite on first login
 * Called from the frontend after Google OAuth when no DawinUser exists.
 * Checks for a pending invite matching the user's email, and if found,
 * creates a DawinUser profile and sets custom claims.
 */
const processNewUserInvite = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }

  const email = request.auth.token.email;
  const uid = request.auth.uid;

  if (!email) {
    throw new HttpsError('failed-precondition', 'User email is required');
  }

  // Find pending invite for this email
  const invitesSnap = await db
    .collection(`organizations/${DEFAULT_ORG}/invites`)
    .where('email', '==', email.toLowerCase())
    .where('status', '==', 'pending')
    .limit(1)
    .get();

  if (invitesSnap.empty) {
    return { hasInvite: false };
  }

  const inviteDoc = invitesSnap.docs[0];
  const inviteData = inviteDoc.data();

  // Check if invite has expired
  const expiresAt = inviteData.expiresAt?.toDate?.() || new Date(inviteData.expiresAt);
  if (expiresAt < new Date()) {
    await inviteDoc.ref.update({ status: 'expired' });
    return { hasInvite: false, reason: 'expired' };
  }

  // Check if a DawinUser already exists for this uid
  const existingUser = await db
    .collection(`organizations/${DEFAULT_ORG}/users`)
    .where('uid', '==', uid)
    .limit(1)
    .get();

  if (!existingUser.empty) {
    // User already exists, just mark invite as accepted
    await inviteDoc.ref.update({
      status: 'accepted',
      acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    return { hasInvite: true, alreadyExists: true };
  }

  // Create DawinUser document from invite data — use Firebase Auth UID as doc ID
  const userRef = db.collection(`organizations/${DEFAULT_ORG}/users`).doc(uid);
  await userRef.set({
    uid,
    email: email.toLowerCase(),
    displayName: request.auth.token.name || email,
    photoUrl: request.auth.token.picture || '',
    globalRole: inviteData.globalRole || 'member',
    isActive: true,
    subsidiaryAccess: inviteData.subsidiaryAccess || [],
    invitedBy: inviteData.invitedBy || '',
    invitedAt: inviteData.createdAt || null,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Mark invite as accepted
  await inviteDoc.ref.update({
    status: 'accepted',
    acceptedAt: admin.firestore.FieldValue.serverTimestamp(),
  });

  // Set custom claims
  const moduleIds = (inviteData.subsidiaryAccess || [])
    .flatMap(sa => (sa.modules || []).filter(m => m.hasAccess).map(m => m.moduleId));
  const subsidiaryIds = (inviteData.subsidiaryAccess || [])
    .filter(sa => sa.hasAccess)
    .map(sa => sa.subsidiaryId);

  try {
    await admin.auth().setCustomUserClaims(uid, {
      globalRole: inviteData.globalRole || 'member',
      modules: moduleIds,
      subsidiaries: subsidiaryIds,
      isActive: true,
    });
  } catch (error) {
    logger.error('Error setting claims for new user:', error);
    // Don't fail the whole operation — user was created, claims can be synced later
  }

  logger.info(`New user created from invite: ${email}`, {
    userId: userRef.id,
    globalRole: inviteData.globalRole,
  });

  return {
    hasInvite: true,
    globalRole: inviteData.globalRole,
    userId: userRef.id,
  };
});

module.exports = {
  processNewUserInvite,
};
