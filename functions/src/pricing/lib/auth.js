/**
 * Commercial-scope guard for pricing/contracts/billing endpoints.
 *
 * Spec §7.4 ("the subsidiary never quotes" rule) is enforced at three
 * layers. This is layer 2 — the API guard. Any caller whose `home_org_kind`
 * is SUBSIDIARY is rejected with HTTP 403 regardless of token claims, even
 * before Firestore rules are consulted.
 *
 * PHASE 3.A.5 PLACEHOLDER: until 3.A.5 introduces `organizations.kind` and
 * `users.home_org_id`, we approximate the check by requiring the caller to
 * have `globalRole IN ('admin','owner')` AND parent-org membership (i.e.
 * a `subsidiaryAccess` entry for `zeus-group`). Replace with the canonical
 * `home_org_kind === 'PARENT'` check when 3.A.5 lands.
 */

const { HttpsError } = require('firebase-functions/v2/https');
const { getFirestore } = require('firebase-admin/firestore');

const PARENT_ORG_ID = 'zeus-group';

/** Pull the caller's DawinUser doc and confirm PRICING_ADMIN preconditions. */
async function assertPricingAdmin(auth, { allowOverride = false } = {}) {
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
  // Super-user bypass — mirror src/router/guards/RoleGuard.tsx.
  const SUPERS = ['onzimai@zeusgroup.co.ug', 'onzimai@dawin.group'];
  if (auth.token && auth.token.email && SUPERS.includes(auth.token.email)) {
    return { user: u, isOverrideEligible: true };
  }
  const role = u.globalRole;
  if (!role || !['admin', 'owner'].includes(role)) {
    throw new HttpsError('permission-denied', 'PRICING_ADMIN requires globalRole admin/owner.');
  }
  const hasParent = Array.isArray(u.subsidiaryAccess)
    && u.subsidiaryAccess.some(s => s && s.subsidiaryId === PARENT_ORG_ID && s.hasAccess);
  if (!hasParent) {
    // Spec §7.4 — commercial scopes structurally ungrantable to subsidiary
    // principals. 3.A.5 will replace this with the home_org_kind check.
    throw new HttpsError('permission-denied', 'PRICING_ADMIN requires parent-org membership (subsidiary principals rejected per spec §7.4).');
  }
  const isOverrideEligible = allowOverride && (role === 'owner');
  return { user: u, isOverrideEligible };
}

module.exports = { assertPricingAdmin, PARENT_ORG_ID };
