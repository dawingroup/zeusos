/**
 * Commercial-scope guard for billing endpoints — layer 2 of spec §7.4.
 *
 * Same shape as functions/src/pricing/lib/auth.js#assertPricingAdmin
 * but the scope label is BILLING_ADMIN. Today's check approximates
 * "home_org_kind === 'PARENT'" via globalRole admin/owner + parent-org
 * membership. When Phase 3.A.5 lands, replace with the canonical check.
 */

const { HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

const PARENT_ORG_ID = 'zeus-group';
const SUPERS = ['onzimai@zeusgroup.co.ug', 'onzimai@dawin.group'];

async function assertBillingAdmin(auth) {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  const db = getFirestore();
  let userDoc = await db.doc(`organizations/default/users/${auth.uid}`).get();
  if (!userDoc.exists) {
    userDoc = await db.doc(`users/${auth.uid}`).get();
  }
  if (!userDoc.exists) {
    throw new HttpsError('permission-denied', 'Caller has no user profile.');
  }
  const u = userDoc.data() || {};
  if (auth.token && auth.token.email && SUPERS.includes(auth.token.email)) {
    return { user: u, isSuperUser: true };
  }
  const role = u.globalRole;
  if (!role || !['admin', 'owner'].includes(role)) {
    throw new HttpsError(
      'permission-denied',
      'BILLING_ADMIN requires globalRole admin/owner.',
    );
  }
  const hasParent = Array.isArray(u.subsidiaryAccess)
    && u.subsidiaryAccess.some(s => s && s.subsidiaryId === PARENT_ORG_ID && s.hasAccess);
  if (!hasParent) {
    throw new HttpsError(
      'permission-denied',
      'BILLING_ADMIN requires parent-org membership (subsidiary principals rejected per spec §7.4).',
    );
  }
  return { user: u, isSuperUser: false };
}

module.exports = { assertBillingAdmin, PARENT_ORG_ID };
