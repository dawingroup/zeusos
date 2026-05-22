/**
 * Pure access-check helpers for the delivery workspace guard. Split out of
 * the React component so they can be unit-tested without rendering.
 *
 * PHASE 3.A.5 PLACEHOLDER — these approximate "home org kind" via
 * `subsidiaryAccess` + `globalRole`, matching the placeholder used by
 * `PricingAdminGuard`. When 3.A.5 migrates `DawinUser` to carry
 * `homeOrgId`, replace these with a single `home_org_kind` lookup.
 */

import type { DawinUser, SubsidiaryAccess } from '@/core/settings/types';

const PARENT_SUBSIDIARY_ID = 'zeus-group';

function hasSubsidiaryAccess(user: DawinUser, subsidiaryId: string): boolean {
  return (
    Array.isArray(user.subsidiaryAccess) &&
    user.subsidiaryAccess.some(
      (s: SubsidiaryAccess) => s.subsidiaryId === subsidiaryId && s.hasAccess,
    )
  );
}

/**
 * Parent-org users are the AM / commercial staff. Approximated as:
 *   globalRole ∈ {admin, owner} AND subsidiaryAccess includes 'zeus-group'.
 * They are excluded from the subsidiary delivery workspace and routed to
 * the AM-side IWO view (Phase 3.D).
 */
export function isParentOrgUser(user: DawinUser): boolean {
  const isAdminOrOwner = user.globalRole === 'admin' || user.globalRole === 'owner';
  return isAdminOrOwner && hasSubsidiaryAccess(user, PARENT_SUBSIDIARY_ID);
}

/**
 * Subsidiary-org users are anyone who has access to at least one of the
 * five operating sub-brand orgs. Includes users with concurrent
 * zeus-group access ONLY if they do NOT also have admin/owner — i.e.
 * regular employees who are members of zeus-group plus their delivery
 * sub-brand pass through.
 */
export function isSubsidiaryUser(user: DawinUser): boolean {
  if (!Array.isArray(user.subsidiaryAccess)) return false;
  return user.subsidiaryAccess.some(
    (s: SubsidiaryAccess) =>
      s.hasAccess &&
      s.subsidiaryId !== PARENT_SUBSIDIARY_ID,
  );
}

/**
 * Resolve the user's "home" subsidiary org id for IWO inbox filtering.
 * Picks the first non-parent subsidiary they have access to. Returns
 * `null` if they only have parent membership or no access at all.
 */
export function resolveHomeSubsidiaryId(user: DawinUser): string | null {
  if (!Array.isArray(user.subsidiaryAccess)) return null;
  const sub = user.subsidiaryAccess.find(
    (s) => s.hasAccess && s.subsidiaryId !== PARENT_SUBSIDIARY_ID,
  );
  return sub?.subsidiaryId ?? null;
}
