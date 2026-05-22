/**
 * BILLING_ADMIN scope check — programmatic surface.
 *
 * Use the React `<BillingAccessGuard>` (RoleGuard requireGlobalRole +
 * requireOrgKind="PARENT") at route boundaries. This function exists
 * for non-route call sites that need a synchronous yes/no — e.g.
 * conditionally rendering a "Bill client" button outside the /billing
 * subtree, or short-circuiting an analytics fetch.
 *
 * Mirrors `assertParentOrgPrincipal` in
 * functions/src/assignment/lib/auth.js (the Cloud Function side) and
 * the org-kind branch of RoleGuard (the route side). Until every user
 * doc is migrated to carry `homeOrgId`, falls back to the
 * subsidiaryAccess-based heuristic.
 */

import type { DawinUser } from '@/core/settings/types';

const SUPER_USER_EMAILS = [
  'onzimai@zeusgroup.co.ug',
  'onzimai@dawin.group',
  'admin@zeusgroup.co.ug',
];

const PARENT_ORG_ID = 'zeus-group';

export interface BillingAccessContext {
  user: { email: string | null } | null;
  dawinUser: DawinUser | null;
}

export function hasBillingAdminScope(ctx: BillingAccessContext): boolean {
  // Super users always pass — mirrors RoleGuard + assertParentOrgPrincipal.
  if (ctx.user?.email && SUPER_USER_EMAILS.includes(ctx.user.email)) return true;
  if (!ctx.dawinUser) return false;

  // Layer-1 of spec §7.4: caller must be a parent-org principal. We have
  // two ways of expressing that today:
  //   (a) canonical: dawinUser.homeOrgId points at an org with
  //       Organization.kind === 'PARENT'. Requires a Firestore read
  //       which we don't do here — that's why this function is
  //       advisory, not authoritative. The route guard + Cloud
  //       Function are authoritative.
  //   (b) fallback: explicit subsidiaryAccess entry for `zeus-group`.
  // We only check (b) here. If (b) is true and globalRole is admin/owner,
  // the user is overwhelmingly likely a parent principal; if they're
  // not, the Cloud Function will reject the actual mutation anyway.
  const hasParent =
    Array.isArray(ctx.dawinUser.subsidiaryAccess) &&
    ctx.dawinUser.subsidiaryAccess.some(
      (s) => s.subsidiaryId === PARENT_ORG_ID && s.hasAccess,
    );
  if (!hasParent) return false;

  return ctx.dawinUser.globalRole === 'owner' || ctx.dawinUser.globalRole === 'admin';
}
