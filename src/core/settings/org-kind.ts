/**
 * Single source of truth for "is this principal a PARENT-org actor?"
 *
 * Historically three places answered this question with slightly different
 * logic: RoleGuard (super-user email OR homeOrgId OR zeus-group access),
 * AppShell's nav builder, and the DashboardPage (both of which only checked
 * the zeus-group-subsidiaryAccess branch). The mismatch let a Zeus Group
 * owner whose `subsidiaryAccess` lists only a sub-brand — or a super-user
 * email with no zeus-group access at all — pass the route guards yet get an
 * empty sidebar + the subsidiary dashboard, because the shell resolved them
 * as SUBSIDIARY. Consolidating here so every layer agrees.
 *
 * Resolution order (matches the original RoleGuard logic):
 *   1. super-user email           → PARENT
 *   2. homeOrgId set              → PARENT iff homeOrgId === 'zeus-group'
 *   3. admin/owner + zeus-group   → PARENT
 *      in subsidiaryAccess
 *   4. otherwise                  → SUBSIDIARY
 */

export const PARENT_ORG_ID = 'zeus-group';

export const SUPER_USER_EMAILS: ReadonlySet<string> = new Set<string>([
  'onzimai@zeusgroup.co.ug',
  'onzimaid@gmail.com',
  'onzimai@dawin.group',
]);

/** Case-insensitive super-user check. */
export function isSuperUserEmail(email: string | null | undefined): boolean {
  return SUPER_USER_EMAILS.has((email ?? '').toLowerCase());
}

export type OrgKind = 'PARENT' | 'SUBSIDIARY';

/** Minimal shape we need off the DawinUser to resolve org kind. */
export interface OrgKindUser {
  globalRole?: string;
  homeOrgId?: string;
  subsidiaryAccess?: Array<{ subsidiaryId: string; hasAccess: boolean }>;
}

export function resolveOrgKind(
  email: string | null | undefined,
  dawinUser: OrgKindUser | null | undefined,
): OrgKind {
  if (!dawinUser) return 'SUBSIDIARY';

  const e = (email ?? '').toLowerCase();
  if (SUPER_USER_EMAILS.has(e)) return 'PARENT';

  const homeOrgId = dawinUser.homeOrgId;
  if (homeOrgId) return homeOrgId === PARENT_ORG_ID ? 'PARENT' : 'SUBSIDIARY';

  if (
    (dawinUser.globalRole === 'admin' || dawinUser.globalRole === 'owner') &&
    Array.isArray(dawinUser.subsidiaryAccess) &&
    dawinUser.subsidiaryAccess.some((s) => s.subsidiaryId === PARENT_ORG_ID && s.hasAccess)
  ) {
    return 'PARENT';
  }

  return 'SUBSIDIARY';
}

/** Convenience boolean — true when the principal may act as parent-org. */
export function isParentOrgPrincipal(
  email: string | null | undefined,
  dawinUser: OrgKindUser | null | undefined,
): boolean {
  return resolveOrgKind(email, dawinUser) === 'PARENT';
}
