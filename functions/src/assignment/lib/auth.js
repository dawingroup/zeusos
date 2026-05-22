/**
 * Assignment & Handoff auth guards — spec §7.4.
 *
 * Three actor classes the IWO callables care about:
 *   1. PARENT_ORG_PRINCIPAL  (Account-Management, plus owner/admin globalRole)
 *      — can issue / cancel / accept_internal / request_revision / close.
 *   2. DELIVERY_LEAD(subsidiaryOrgId)
 *      — accept / reject / start / deliver, scoped to the receiving sub.
 *      A "delivery lead" is a user whose home org doc matches the IWO's
 *      `subsidiaryOrgId` AND who carries the `DELIVERY_LEAD` flag (set on
 *      `users/{uid}.deliveryLeadFor: [subsidiaryId, …]`). Falls back to
 *      "any user with subsidiary access" in absence of the array (Phase
 *      3.E will introduce the explicit role grant).
 *   3. TIMEKEEPER(iwoId)
 *      — anyone with subsidiary access for the receiving sub. The
 *      callable post-validates that the entry's `userId` matches the
 *      caller (or that the caller is a parent-org actor posting on
 *      behalf of someone, which is the AM-on-delivery edge case).
 */

const { HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

const PARENT_ORG_ID = 'zeus-group';

const SUPER_EMAILS = new Set([
  'onzimai@zeusgroup.co.ug',
  'onzimai@dawin.group',
  'admin@zeusgroup.co.ug',
]);

/** Load the caller's user doc (organizations/default first, then root). */
async function loadUserDoc(uid) {
  const db = getFirestore();
  let snap = await db.doc(`organizations/default/users/${uid}`).get();
  if (!snap.exists) snap = await db.doc(`users/${uid}`).get();
  if (!snap.exists) return null;
  return snap.data();
}

function isSuper(authToken, user) {
  if (authToken && authToken.email && SUPER_EMAILS.has(authToken.email)) return true;
  if (user && (user.globalRole === 'admin' || user.globalRole === 'owner')) return true;
  return false;
}

/**
 * Confirm caller is a parent-org principal (AM / Account-Management /
 * super-user). Throws HttpsError('permission-denied') if not.
 *
 * Returns `{ uid, user }` so callers don't re-fetch.
 */
async function assertParentOrgPrincipal(auth) {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  const user = await loadUserDoc(auth.uid);
  if (!user) {
    throw new HttpsError('permission-denied', 'Caller has no user profile.');
  }
  if (isSuper(auth.token, user)) return { uid: auth.uid, user };

  // Canonical (post-3.A.5) check — home org doc must be PARENT.
  if (user.homeOrgId) {
    const db = getFirestore();
    const orgSnap = await db.doc(`organizations/${user.homeOrgId}`).get();
    if (orgSnap.exists && orgSnap.data().kind === 'PARENT') {
      return { uid: auth.uid, user };
    }
  }

  // Fallback for users not yet migrated to homeOrgId — accept any user
  // with explicit subsidiaryAccess to `zeus-group`.
  const hasParent =
    Array.isArray(user.subsidiaryAccess) &&
    user.subsidiaryAccess.some(
      (s) => s && s.subsidiaryId === PARENT_ORG_ID && s.hasAccess,
    );
  if (hasParent && (user.globalRole === 'admin' || user.globalRole === 'owner')) {
    return { uid: auth.uid, user };
  }

  // Layer-2 enforcement of spec §7.4 — subsidiary principals rejected.
  throw new HttpsError(
    'permission-denied',
    'COMMERCIAL_SCOPE_REQUIRED: caller is not a parent-org (Account-Management) principal.',
  );
}

/**
 * Confirm caller is the delivery lead of `subsidiaryOrgId`. Throws
 * HttpsError('permission-denied') if not. Parent-org users do NOT
 * satisfy this — accept/reject is exclusively the receiving sub's
 * authority per spec §6.1.1.
 */
async function assertDeliveryLead(auth, subsidiaryOrgId) {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  const user = await loadUserDoc(auth.uid);
  if (!user) {
    throw new HttpsError('permission-denied', 'Caller has no user profile.');
  }
  // Super-users CAN accept on behalf of a sub (Daniel needs to unstick flows).
  if (isSuper(auth.token, user)) return { uid: auth.uid, user };

  // Explicit delivery-lead flag (canonical).
  if (Array.isArray(user.deliveryLeadFor) && user.deliveryLeadFor.indexOf(subsidiaryOrgId) !== -1) {
    return { uid: auth.uid, user };
  }
  // homeOrg matches receiving sub + has access.
  if (user.homeOrgId === subsidiaryOrgId) {
    return { uid: auth.uid, user };
  }
  // Phase-2 fallback: subsidiaryAccess entry with hasAccess.
  const hasSubAccess =
    Array.isArray(user.subsidiaryAccess) &&
    user.subsidiaryAccess.some(
      (s) => s && s.subsidiaryId === subsidiaryOrgId && s.hasAccess,
    );
  if (hasSubAccess) return { uid: auth.uid, user };

  throw new HttpsError(
    'permission-denied',
    `DELIVERY_LEAD_REQUIRED: caller is not a delivery lead of ${subsidiaryOrgId}.`,
  );
}

/**
 * Anyone with access to the receiving subsidiary (incl. parent users)
 * can post a time/cost entry. Used by `postTimeEntry` + `postCostEntry`.
 */
async function assertSubsidiaryAccessOrParent(auth, subsidiaryOrgId) {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  const user = await loadUserDoc(auth.uid);
  if (!user) {
    throw new HttpsError('permission-denied', 'Caller has no user profile.');
  }
  if (isSuper(auth.token, user)) return { uid: auth.uid, user };
  if (user.homeOrgId === subsidiaryOrgId || user.homeOrgId === PARENT_ORG_ID) {
    return { uid: auth.uid, user };
  }
  const hasAccess =
    Array.isArray(user.subsidiaryAccess) &&
    user.subsidiaryAccess.some(
      (s) =>
        s &&
        (s.subsidiaryId === subsidiaryOrgId || s.subsidiaryId === PARENT_ORG_ID) &&
        s.hasAccess,
    );
  if (hasAccess) return { uid: auth.uid, user };
  throw new HttpsError(
    'permission-denied',
    `Access to subsidiary ${subsidiaryOrgId} required.`,
  );
}

/**
 * Verify a user id refers to a PARENT-org user. Used by the handoff-packet
 * validator to enforce "comms owner is always Account-Management."
 */
async function isParentOrgUser(userId) {
  if (!userId) return false;
  const db = getFirestore();
  let snap = await db.doc(`organizations/default/users/${userId}`).get();
  if (!snap.exists) snap = await db.doc(`users/${userId}`).get();
  if (!snap.exists) return false;
  const u = snap.data();
  // Same fallback chain as assertParentOrgPrincipal.
  if (u.homeOrgId) {
    const orgSnap = await db.doc(`organizations/${u.homeOrgId}`).get();
    if (orgSnap.exists && orgSnap.data().kind === 'PARENT') return true;
  }
  const hasParent =
    Array.isArray(u.subsidiaryAccess) &&
    u.subsidiaryAccess.some(
      (s) => s && s.subsidiaryId === PARENT_ORG_ID && s.hasAccess,
    );
  return hasParent;
}

module.exports = {
  PARENT_ORG_ID,
  assertParentOrgPrincipal,
  assertDeliveryLead,
  assertSubsidiaryAccessOrParent,
  isParentOrgUser,
  loadUserDoc,
};
