/**
 * Migration Script: Fix legacy user documents
 *
 * Finds all user documents in organizations/default/users where the
 * Firestore doc ID does NOT match the Firebase Auth UID. For each:
 *   1. Looks up the Firebase Auth user by email to get the correct UID
 *   2. Creates a new doc at organizations/default/users/{uid} with the same data
 *   3. Deletes the old doc with the random ID
 *
 * Run as a callable cloud function from the admin panel, or via:
 *   firebase functions:shell
 *   > migrateUserDocs({})
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

const db = admin.firestore();
const DEFAULT_ORG = 'default';

const migrateUserDocs = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  // Only allow admins / super users to run this
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Must be authenticated');
  }

  const callerEmail = request.auth.token.email;
  const SUPER_USERS = ['onzimai@dawin.group'];

  if (!SUPER_USERS.includes(callerEmail)) {
    // Check if caller is admin/owner in DawinUser
    const callerSnap = await db
      .collection(`organizations/${DEFAULT_ORG}/users`)
      .where('email', '==', callerEmail)
      .limit(1)
      .get();

    if (callerSnap.empty) {
      throw new HttpsError('permission-denied', 'Not authorized to run migration');
    }
    const callerData = callerSnap.docs[0].data();
    if (!['admin', 'owner'].includes(callerData.globalRole)) {
      throw new HttpsError('permission-denied', 'Must be admin or owner');
    }
  }

  const usersSnap = await db.collection(`organizations/${DEFAULT_ORG}/users`).get();
  const results = { total: 0, migrated: 0, skipped: 0, errors: [] };

  for (const userDoc of usersSnap.docs) {
    results.total++;
    const data = userDoc.data();
    const docId = userDoc.id;
    const email = data.email;
    const storedUid = data.uid;

    // If doc ID already matches the uid field, check if uid is correct via Firebase Auth
    if (!email) {
      results.skipped++;
      logger.warn(`Skipping doc ${docId}: no email field`);
      continue;
    }

    try {
      // Look up the Firebase Auth user by email to get the authoritative UID
      let authUser;
      try {
        authUser = await admin.auth().getUserByEmail(email);
      } catch (authErr) {
        // No Firebase Auth account for this email — skip
        results.skipped++;
        logger.warn(`Skipping doc ${docId} (${email}): no Firebase Auth account — ${authErr.message}`);
        continue;
      }

      const correctUid = authUser.uid;

      // Check if doc ID AND uid field both match
      if (docId === correctUid && storedUid === correctUid) {
        results.skipped++;
        continue;
      }

      logger.info(`Migrating ${email}: docId=${docId}, storedUid=${storedUid}, correctUid=${correctUid}`);

      // Update/create the doc at the correct path
      const correctRef = db.collection(`organizations/${DEFAULT_ORG}/users`).doc(correctUid);
      const correctSnap = await correctRef.get();

      if (correctSnap.exists) {
        // A doc already exists at the correct path — just update uid field if needed
        if (correctSnap.data().uid !== correctUid) {
          await correctRef.update({ uid: correctUid, updatedAt: admin.firestore.FieldValue.serverTimestamp() });
        }
        // Delete the old doc if it's different
        if (docId !== correctUid) {
          await userDoc.ref.delete();
          logger.info(`Deleted stale doc ${docId} for ${email} (correct doc at ${correctUid} already exists)`);
        }
      } else {
        // Create new doc at correct path with all the original data
        const newData = { ...data, uid: correctUid, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
        await correctRef.set(newData);

        // Delete the old doc
        if (docId !== correctUid) {
          await userDoc.ref.delete();
          logger.info(`Migrated doc ${docId} → ${correctUid} for ${email}`);
        }
      }

      results.migrated++;
    } catch (err) {
      results.errors.push({ docId, email, error: err.message });
      logger.error(`Error migrating doc ${docId} (${email}):`, err);
    }
  }

  logger.info('Migration complete:', results);
  return results;
});

module.exports = {
  migrateUserDocs,
};
