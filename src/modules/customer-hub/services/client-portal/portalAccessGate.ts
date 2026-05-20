/**
 * portalAccessGate — single source of truth for "can this user see
 * this project from the portal?". Used by every read hook in the
 * portal so we don't reimplement the rule in each one.
 *
 * Three classes of viewer:
 *
 *   1. **Anonymous** — only the legacy token-portal pages reach this.
 *      The portal v2 routes always require a non-anonymous session
 *      upstream (sign-in page redirect), so we treat anonymous as
 *      "no access" here.
 *
 *   2. **Dawin staff** — heuristically detected by `@dawin.group`
 *      email. Staff bypass the per-project whitelist so they can
 *      preview what each client sees (and to see existing projects
 *      that were never explicitly opened to the portal). Firestore
 *      rules independently allow this via `isAdmin()` / `isProjectMember`,
 *      so this is purely a client-side relaxation matching the
 *      server-side capability.
 *
 *   3. **Portal client** — non-anonymous, non-staff. Must be in the
 *      project's `clientPortalUserIds`.
 */

import type { User } from 'firebase/auth';
import type { DesignProject } from '@/modules/design-manager/types';

export function isPortalStaff(user: User | null | undefined): boolean {
  if (!user) return false;
  if (user.isAnonymous) return false;
  const email = user.email?.toLowerCase() ?? '';
  return email.endsWith('@dawin.group');
}

/**
 * Returns true if the user is allowed to see the project through the
 * portal. Staff are always allowed; clients need to be in the
 * project's `clientPortalUserIds`.
 */
export function canViewProject(
  user: User | null | undefined,
  project: Pick<DesignProject, 'clientPortalUserIds'> | null | undefined,
): boolean {
  if (!user || !project) return false;
  if (isPortalStaff(user)) return true;
  const ids = project.clientPortalUserIds;
  return Array.isArray(ids) && !!user.uid && ids.includes(user.uid);
}

/**
 * Same as `canViewProject` but throws the canonical error message
 * used by every portal hook's `useEffect` body. Keeps error wording
 * consistent across screens.
 */
export function assertProjectAccess(
  user: User | null | undefined,
  project: Pick<DesignProject, 'clientPortalUserIds'> | null | undefined,
): void {
  if (canViewProject(user, project)) return;
  throw new Error('You do not have access to this project');
}
