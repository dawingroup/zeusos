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
 * ADR-2026-05-25 §2.Q2 — commercial principal for a specific client.
 *
 * Accepts:
 *   - PARENT-org principals (group-level AMs / admins / super-users)
 *   - SUBSIDIARY principals whose homeOrgId matches the client's
 *     `primaryBrandId` ("home brand AD")
 *
 * Throws HttpsError('permission-denied') otherwise. Throws
 * HttpsError('not-found') if the client doc doesn't exist.
 *
 * Backward-compatible: clients without `primaryBrandId` (pre-ADR
 * data) fall back to PARENT-only access — preserves Phase 3.A.5
 * behaviour until backfill completes.
 *
 * The callable handlers swap their `assertParentOrgPrincipal(auth)`
 * calls for `assertCommercialPrincipal(auth, clientId)` so the
 * function-layer gate (spec §7.4 layer 2) matches the rules-layer
 * gate (`canActOnClient` in firestore.rules).
 */
async function assertCommercialPrincipal(auth, clientId) {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  if (!clientId || typeof clientId !== 'string') {
    throw new HttpsError('invalid-argument', 'clientId is required.');
  }
  const user = await loadUserDoc(auth.uid);
  if (!user) {
    throw new HttpsError('permission-denied', 'Caller has no user profile.');
  }
  if (isSuper(auth.token, user)) return { uid: auth.uid, user };

  // Parent-org principal — same check as assertParentOrgPrincipal,
  // inlined so we share the user-doc fetch.
  const db = getFirestore();
  if (user.homeOrgId) {
    const orgSnap = await db.doc(`organizations/${user.homeOrgId}`).get();
    if (orgSnap.exists && orgSnap.data().kind === 'PARENT') {
      return { uid: auth.uid, user };
    }
  }
  const hasParent =
    Array.isArray(user.subsidiaryAccess) &&
    user.subsidiaryAccess.some(
      (s) => s && s.subsidiaryId === PARENT_ORG_ID && s.hasAccess,
    );
  if (hasParent && (user.globalRole === 'admin' || user.globalRole === 'owner')) {
    return { uid: auth.uid, user };
  }

  // Brand-direct path — caller's homeOrgId matches the client's
  // primaryBrandId. Any rejection here (missing client, no
  // primaryBrandId, mismatched brand) reports `permission-denied`
  // so we (a) don't leak client existence to a non-permitted caller
  // and (b) keep the error code stable for callers that expect
  // permission-denied for "subsidiary tried to act on a commercial
  // doc they don't own."
  try {
    const clientSnap = await db.doc(`clients/${clientId}`).get();
    if (clientSnap.exists) {
      const clientData = clientSnap.data();
      if (
        user.homeOrgId &&
        clientData.primaryBrandId &&
        clientData.primaryBrandId === user.homeOrgId
      ) {
        return { uid: auth.uid, user };
      }
    }
  } catch {
    /* fall through to permission-denied */
  }

  throw new HttpsError(
    'permission-denied',
    `COMMERCIAL_SCOPE_REQUIRED: caller is neither a parent-org principal nor the home brand for client ${clientId}.`,
  );
}

/**
 * Resource-scoped variant of `assertCommercialPrincipal` — resolves
 * the `clientId` from a Firestore doc reference rather than from a
 * caller-supplied arg. Use this in lifecycle callables (activateMsa,
 * approveSow, approveChangeOrder, etc.) that take an aggregate id and
 * need to dereference the `clientId` from the existing doc.
 *
 * Failure ordering preserves the §7.4 boundary (don't leak existence
 * to subsidiary callers):
 *   1. Cheap parent-org check — if pass, allow (regardless of whether
 *      the resource exists).
 *   2. Otherwise read the resource. If missing OR has no `clientId` →
 *      throw permission-denied (treat as if subsidiary caller has no
 *      authorization, don't reveal existence).
 *   3. If resource exists and has clientId → delegate to
 *      assertCommercialPrincipal, which evaluates brand-direct match.
 *
 * @param {object} auth — request.auth
 * @param {FirebaseFirestore.DocumentReference} ref — the resource doc
 * @returns {Promise<{ uid: string, user: object, data: object }>}
 *   where `data` is the snapshot data (so callers don't re-read).
 */
async function assertCommercialPrincipalForResource(auth, ref) {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', 'Authentication required.');
  }
  // Try parent-org first — cheap, no resource read.
  try {
    const result = await assertParentOrgPrincipal(auth);
    // Parent-org passed; still read the resource for the caller.
    const snap = await ref.get();
    if (!snap.exists) {
      throw new HttpsError('not-found', `Resource ${ref.path} not found.`);
    }
    return { ...result, data: snap.data() };
  } catch (e) {
    if (e && e.code === 'unauthenticated') throw e;
    if (e && e.code === 'not-found') throw e;
    if (e && e.code !== 'permission-denied') throw e;
    // Parent-org rejection — fall through to brand-direct.
  }

  // Brand-direct attempt — pre-read the resource to get clientId.
  // Wrap in try/catch so missing-doc reports permission-denied (don't
  // reveal existence to subsidiary callers).
  let snap;
  try {
    snap = await ref.get();
  } catch {
    throw new HttpsError(
      'permission-denied',
      `COMMERCIAL_SCOPE_REQUIRED: caller is not authorized for ${ref.path}.`,
    );
  }
  if (!snap.exists) {
    throw new HttpsError(
      'permission-denied',
      `COMMERCIAL_SCOPE_REQUIRED: caller is not authorized for ${ref.path}.`,
    );
  }
  const data = snap.data();
  const clientId = data && data.clientId;
  if (!clientId) {
    // No denormalised clientId — fall back to parent-only (which
    // already failed above). Reject.
    throw new HttpsError(
      'permission-denied',
      `COMMERCIAL_SCOPE_REQUIRED: resource ${ref.path} has no clientId; parent-org access required.`,
    );
  }
  const result = await assertCommercialPrincipal(auth, clientId);
  return { ...result, data };
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
  assertCommercialPrincipal,
  assertCommercialPrincipalForResource,
  assertDeliveryLead,
  assertSubsidiaryAccessOrParent,
  isParentOrgUser,
  loadUserDoc,
};
