/**
 * Who may call the task-engine callables.
 *
 *   requireSignedIn   any staff login (anonymous portal sessions are refused)
 *   requireAdminCaller owner/admin globalRole or a super-user email — the
 *                      "run it now" callables close every plan in the org.
 *   isPrivileged      admin OR parent-org principal: may act on any task or
 *                      plan (Account Management runs the group).
 *
 * Re-uses the assignment guards so the three layers (rules, callables, UI)
 * agree on who a parent-org principal is.
 */

const { HttpsError } = require('firebase-functions/v2/https');
const { loadUserDoc, isParentOrgUser } = require('../../assignment/lib/auth');

const SUPER_EMAILS = new Set(['onzimai@zeusgroup.co.ug', 'onzimai@dawin.group', 'admin@zeusgroup.co.ug']);

function requireSignedIn(request, action = 'do that') {
  const auth = request && request.auth;
  if (!auth || !auth.uid) throw new HttpsError('unauthenticated', `Sign in to ${action}.`);
  const provider = auth.token && auth.token.firebase && auth.token.firebase.sign_in_provider;
  if (provider === 'anonymous') throw new HttpsError('permission-denied', `A portal session cannot ${action}.`);
  return auth;
}

async function isAdminCaller(auth, deps = {}) {
  if (!auth || !auth.uid) return false;
  if (auth.token && auth.token.email && SUPER_EMAILS.has(auth.token.email)) return true;
  const load = deps.loadUserDoc || loadUserDoc;
  const user = await load(auth.uid);
  return Boolean(user && (user.globalRole === 'admin' || user.globalRole === 'owner'));
}

async function requireAdminCaller(request, action = 'do that', deps = {}) {
  const auth = requireSignedIn(request, action);
  if (!(await isAdminCaller(auth, deps))) {
    throw new HttpsError('permission-denied', `Only an administrator can ${action}.`);
  }
  return auth;
}

/** Admin, or a parent-org (Account Management) principal. */
async function isPrivileged(auth, deps = {}) {
  if (await isAdminCaller(auth, deps)) return true;
  const check = deps.isParentOrgUser || isParentOrgUser;
  return check(auth.uid);
}

module.exports = { requireSignedIn, requireAdminCaller, isAdminCaller, isPrivileged, SUPER_EMAILS };
