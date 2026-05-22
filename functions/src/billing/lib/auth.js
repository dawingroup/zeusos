/**
 * Commercial-scope guard for billing endpoints — layer 2 of spec §7.4.
 *
 * Delegates the org-kind + super-user check to the canonical
 * `assertParentOrgPrincipal` (Phase 3.B/3.D in
 * `functions/src/assignment/lib/auth.js`) so all three commercial
 * surfaces — Account-Management, Pricing, Billing — share one
 * implementation. Adds the BILLING_ADMIN-specific requirement that
 * the caller's globalRole must be admin or owner on top of being a
 * parent-org principal.
 *
 * Super-users are admitted by `assertParentOrgPrincipal` regardless
 * of globalRole; that path bypasses the extra admin/owner check
 * which is the desired behaviour (Daniel needs to unstick flows).
 */

const { HttpsError } = require('firebase-functions/v2/https');
const { assertParentOrgPrincipal, PARENT_ORG_ID } = require('../../assignment/lib/auth');

const SUPER_EMAILS = new Set([
  'onzimai@zeusgroup.co.ug',
  'onzimai@dawin.group',
  'admin@zeusgroup.co.ug',
]);

async function assertBillingAdmin(auth) {
  const { uid, user } = await assertParentOrgPrincipal(auth);

  // Super-users skip the extra admin/owner requirement.
  const isSuperUser =
    !!(auth.token && auth.token.email && SUPER_EMAILS.has(auth.token.email)) ||
    user.globalRole === 'owner';
  if (isSuperUser) {
    return { uid, user, isSuperUser: true };
  }

  if (!['admin', 'owner'].includes(user.globalRole)) {
    throw new HttpsError(
      'permission-denied',
      'BILLING_ADMIN requires globalRole admin/owner on top of parent-org membership.',
    );
  }
  return { uid, user, isSuperUser: false };
}

module.exports = { assertBillingAdmin, PARENT_ORG_ID };
