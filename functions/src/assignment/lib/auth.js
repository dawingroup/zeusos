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

/**
 * Confirm caller can sign commercial documents for the listed brands —
 * per ADR-0001 Q2 ("brands also sell direct"). The caller satisfies
 * the check if EITHER:
 *
 *   (a) parent-org principal (existing path — Zeus Group's AM team can
 *       always sign for any brand-owned account); OR
 *   (b) homeOrgId equals one of `allowedBrandIds` AND the user carries
 *       the `commercialLeadFor` flag for that brand. `commercialLeadFor`
 *       is a `string[]` on the user doc, populated by Phase 6.F.2 admin
 *       tooling; for the 6.F rollout window we accept the legacy
 *       fallback "globalRole === 'admin' AND subsidiaryAccess includes
 *       the brand".
 *
 * `allowedBrandIds` undefined or empty = parent-org-only (back-compat
 * with the existing `assertParentOrgPrincipal` semantics — used for
 * the genuinely group-level surfaces like intercompany invoicing or
 * transfer-pricing config).
 *
 * Returns `{ uid, user, satisfiedAs }` where satisfiedAs ∈
 * {'parent', brandId} so the calling CFn can branch behavior.
 *
 * Throws HttpsError('permission-denied') with code
 * COMMERCIAL_SCOPE_REQUIRED if no path satisfies.
 */
async function assertCommercialPrincipal(auth, { allowedBrandIds = null } = {}) {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  const user = await loadUserDoc(auth.uid);
  if (!user) {
    throw new HttpsError('permission-denied', 'Caller has no user profile.');
  }

  // (a-i) Explicit super-email — always parent. Note we do NOT delegate
  //       to `isSuper()` here because that helper also auto-promotes
  //       any `globalRole === 'admin'` user, which would shadow the
  //       brand-direct path below (a brand-side admin should resolve
  //       to their brand, not to parent).
  const callerEmail = auth.token && auth.token.email;
  if (callerEmail && SUPER_EMAILS.has(callerEmail)) {
    return { uid: auth.uid, user, satisfiedAs: 'parent' };
  }

  // (a-ii) Canonical parent path — user's home org doc is kind=PARENT.
  if (user.homeOrgId) {
    const db = getFirestore();
    const orgSnap = await db.doc(`organizations/${user.homeOrgId}`).get();
    if (orgSnap.exists && orgSnap.data().kind === 'PARENT') {
      return { uid: auth.uid, user, satisfiedAs: 'parent' };
    }
  }

  // (a-iii) Legacy parent path — explicit subsidiaryAccess to PARENT_ORG_ID
  //         with admin/owner role. Only triggers when the user has NO
  //         brand-side homeOrgId (otherwise the brand path below wins).
  const hasParentLegacy =
    Array.isArray(user.subsidiaryAccess) &&
    user.subsidiaryAccess.some(
      (s) => s && s.subsidiaryId === PARENT_ORG_ID && s.hasAccess,
    ) &&
    (user.globalRole === 'admin' || user.globalRole === 'owner') &&
    (!user.homeOrgId || user.homeOrgId === PARENT_ORG_ID);
  if (hasParentLegacy) {
    return { uid: auth.uid, user, satisfiedAs: 'parent' };
  }

  // (b) Brand-direct path — caller's homeOrgId is in allowedBrandIds
  //     AND they carry commercialLeadFor flag (canonical) OR admin
  //     access to that brand (legacy fallback).
  if (Array.isArray(allowedBrandIds) && allowedBrandIds.length > 0) {
    const candidateBrandId = user.homeOrgId;
    if (candidateBrandId && allowedBrandIds.indexOf(candidateBrandId) !== -1) {
      // Canonical — explicit commercialLeadFor flag.
      if (Array.isArray(user.commercialLeadFor) &&
          user.commercialLeadFor.indexOf(candidateBrandId) !== -1) {
        return { uid: auth.uid, user, satisfiedAs: candidateBrandId };
      }
      // Legacy fallback — admin/owner with subsidiary access to this brand.
      const hasBrandAdmin =
        (user.globalRole === 'admin' || user.globalRole === 'owner') &&
        Array.isArray(user.subsidiaryAccess) &&
        user.subsidiaryAccess.some(
          (s) => s && s.subsidiaryId === candidateBrandId && s.hasAccess,
        );
      if (hasBrandAdmin) {
        return { uid: auth.uid, user, satisfiedAs: candidateBrandId };
      }
    }
  }

  // No path satisfied.
  const scope = (Array.isArray(allowedBrandIds) && allowedBrandIds.length > 0)
    ? `parent OR brand-direct (${allowedBrandIds.join(', ')})`
    : 'parent';
  throw new HttpsError(
    'permission-denied',
    `COMMERCIAL_SCOPE_REQUIRED: caller is not authorised to commit commercial documents at scope ${scope}.`,
  );
}

module.exports = {
  PARENT_ORG_ID,
  assertParentOrgPrincipal,
  assertCommercialPrincipal,
  assertDeliveryLead,
  assertSubsidiaryAccessOrParent,
  isParentOrgUser,
  loadUserDoc,
};
