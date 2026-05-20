/**
 * inviteClientPortalUser — staff-callable Cloud Function that
 * looks up a Firebase Auth user by email and adds their UID to every
 * project of a given customer (+ mirrors the UID onto the linked
 * salesOrders so the portal security rules can read the whitelist
 * directly from each SO).
 *
 * Why a function (not a direct client write)?
 *   The client Firebase SDK can't `getUserByEmail()` — only the Admin
 *   SDK can. This function is the bridge.
 *
 * Auth:
 *   Caller must be staff-authenticated (non-anonymous) and either an
 *   admin (super-user email) or have a `/users/{uid}` doc with role
 *   admin/owner/manager. The customer-hub admin panel is the only
 *   surface that calls this; staff role is verified in the function
 *   so a leaked endpoint can't be abused.
 *
 * Returns:
 *   { uid, status: 'granted' | 'already_granted' | 'user_not_found',
 *     projectsTouched, salesOrdersTouched }
 */

const functions = require('firebase-functions');
const admin = require('firebase-admin');

const SUPERUSER_EMAILS = new Set(['onzimai@dawin.group']);

async function isCallerStaff(authContext) {
  if (!authContext?.uid) return false;
  if (authContext.token?.firebase?.sign_in_provider === 'anonymous') return false;
  if (SUPERUSER_EMAILS.has(authContext.token?.email || '')) return true;

  const userDoc = await admin.firestore().collection('users').doc(authContext.uid).get();
  if (!userDoc.exists) return false;
  const role = userDoc.data()?.globalRole;
  return role === 'admin' || role === 'owner' || role === 'manager';
}

exports.inviteClientPortalUser = functions.https.onCall(async (data, context) => {
  if (!await isCallerStaff(context.auth)) {
    throw new functions.https.HttpsError(
      'permission-denied',
      'Only Dawin staff can invite client portal users.',
    );
  }

  const { customerId, email } = data || {};
  if (!customerId || typeof customerId !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'customerId is required.');
  }
  if (!email || typeof email !== 'string') {
    throw new functions.https.HttpsError('invalid-argument', 'email is required.');
  }

  // Resolve email → Firebase Auth UID via the Admin SDK.
  let user;
  try {
    user = await admin.auth().getUserByEmail(email);
  } catch (err) {
    if (err?.code === 'auth/user-not-found') {
      return { uid: null, status: 'user_not_found', projectsTouched: 0, salesOrdersTouched: 0 };
    }
    throw new functions.https.HttpsError('internal', `Failed to look up user: ${err.message}`);
  }

  const uid = user.uid;
  const db = admin.firestore();

  // Find every project for the customer.
  const projectsSnap = await db.collection('designProjects')
    .where('customerId', '==', customerId)
    .get();

  if (projectsSnap.empty) {
    throw new functions.https.HttpsError(
      'failed-precondition',
      'This customer has no projects to grant access to yet.',
    );
  }

  let alreadyGrantedAll = true;
  let projectsTouched = 0;
  let salesOrdersTouched = 0;
  const now = admin.firestore.Timestamp.now();

  for (const projectDoc of projectsSnap.docs) {
    const projectData = projectDoc.data();
    const existing = Array.isArray(projectData.clientPortalUserIds)
      ? projectData.clientPortalUserIds
      : [];

    if (!existing.includes(uid)) {
      alreadyGrantedAll = false;
      await projectDoc.ref.update({
        clientPortalUserIds: admin.firestore.FieldValue.arrayUnion(uid),
        updatedAt: now,
        updatedBy: 'inviteClientPortalUser',
      });
      projectsTouched += 1;
    }

    // Mirror onto every salesOrder linked to this project.
    const soSnap = await db.collection('salesOrders')
      .where('designProjectId', '==', projectDoc.id)
      .get();
    for (const soDoc of soSnap.docs) {
      const soExisting = Array.isArray(soDoc.data().clientPortalUserIds)
        ? soDoc.data().clientPortalUserIds
        : [];
      if (!soExisting.includes(uid)) {
        await soDoc.ref.update({
          clientPortalUserIds: admin.firestore.FieldValue.arrayUnion(uid),
          updatedAt: now,
        });
        salesOrdersTouched += 1;
      }
    }
  }

  return {
    uid,
    status: alreadyGrantedAll ? 'already_granted' : 'granted',
    projectsTouched,
    salesOrdersTouched,
    email,
    displayName: user.displayName || null,
  };
});
