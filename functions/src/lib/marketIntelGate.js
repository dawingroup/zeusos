/**
 * Who may call a Market Intelligence callable
 * (docs/MARKET_INTELLIGENCE_DATA_MODEL_AUDIT_2026_10.md, finding E1 / WP1).
 *
 * Every market-intelligence callable used to check only `request.auth`,
 * which an anonymous client-portal identity passes. The callables run on the
 * Admin SDK, so the rules never applied to them: any signed-in identity could
 * run a paid scan, rewrite a competitor through the enrichment, or pull every
 * report. The gate mirrors the rules helpers `canReadMarketIntel()` /
 * `canWriteMarketIntel()` so a person who can do a thing on the screen can do
 * it through the callable and nobody else can:
 *
 *   'view'   an active staff profile (`users/{uid}` or
 *            `organizations/default/users/{uid}`, not `isActive: false`), or
 *            an executive claim, or a super-user
 *   'edit'   the same, except a `viewer` globalRole is refused — members,
 *            managers, admins and owners may write market intelligence
 *   'admin'  super-users only (operational backfills nothing in the app calls)
 *
 * Portal identities (`sign_in_provider == 'anonymous'`) are refused at every
 * level. Call it FIRST in the handler — before any read, model call or
 * write; functions/__tests__/market-intel/callableGate.test.js fails when a
 * market-intelligence callable does not.
 */
'use strict';

const { HttpsError } = require('firebase-functions/v2/https');
const { loadUserDoc: loadUserDocFromFirestore, isSuper } = require('../assignment/lib/auth');

/** firestore.rules isExecutive(): a role claim in this list. */
const EXECUTIVE_ROLES = Object.freeze(['platform_admin', 'ceo', 'executive', 'director']);

const NEEDS = Object.freeze(['view', 'edit', 'admin']);

/** The globalRole that may read but never write market intelligence. */
const READ_ONLY_GLOBAL_ROLE = 'viewer';

function isAnonymousToken(token) {
  return !!token && !!token.firebase && token.firebase.sign_in_provider === 'anonymous';
}

function isExecutiveToken(token) {
  return !!token && EXECUTIVE_ROLES.includes(token.role);
}

function isActiveStaff(user) {
  return !!user && typeof user === 'object' && user.isActive !== false;
}

/**
 * Pure policy: may a principal `{ token, user }` do `need`? `user` is the
 * caller's staff document (or null when they have none).
 */
function marketIntelAllows(principal, need) {
  if (!NEEDS.includes(need)) throw new Error(`marketIntelAllows: unknown need "${need}"`);
  const token = (principal && principal.token) || null;
  const user = (principal && principal.user) || null;
  if (!token || isAnonymousToken(token)) return false;
  if (isSuper(token, user)) return true;
  if (need === 'admin') return false;
  if (isExecutiveToken(token)) return true;
  if (!isActiveStaff(user)) return false;
  if (need === 'view') return true;
  const role = typeof user.globalRole === 'string' ? user.globalRole : 'member';
  return role !== READ_ONLY_GLOBAL_ROLE;
}

function refusal(need, action, principal) {
  if (need === 'admin') return `Only an administrator can ${action}.`;
  if (!isActiveStaff(principal.user) && !isExecutiveToken(principal.token)) {
    return `You need an active ZeusOS staff profile to ${action}.`;
  }
  return `Viewers cannot ${action}. Ask an administrator for member access to Market Intelligence.`;
}

/**
 * Throws `unauthenticated` without a sign-in, `permission-denied` for a
 * portal identity or a staff member without the grant. Returns
 * `{ uid, user }` so the handler need not re-read the profile.
 * `deps.loadUserDoc` is for tests.
 */
async function assertMarketIntelCaller(auth, { need, action }, deps = {}) {
  if (!auth || !auth.uid) {
    throw new HttpsError('unauthenticated', `Sign in to ${action}.`);
  }
  const token = auth.token || {};
  if (isAnonymousToken(token)) {
    throw new HttpsError('permission-denied', `A client-portal session cannot ${action}.`);
  }
  const load = deps.loadUserDoc || loadUserDocFromFirestore;
  const user = await load(auth.uid);
  const principal = { token, user };
  if (!marketIntelAllows(principal, need)) {
    throw new HttpsError('permission-denied', refusal(need, action, principal));
  }
  return { uid: auth.uid, user };
}

module.exports = {
  EXECUTIVE_ROLES,
  NEEDS,
  READ_ONLY_GLOBAL_ROLE,
  marketIntelAllows,
  assertMarketIntelCaller,
};
