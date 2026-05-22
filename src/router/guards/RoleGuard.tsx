/**
 * RoleGuard Component
 * Protects routes based on user roles from the DawinUser profile.
 *
 * Phase 3.D adds the spec §7.4 commercial-gravity props:
 *   - `requireGlobalRole`: alias of `roles`, kept for clarity at call sites
 *     ("require admin or owner" vs "the user has one of these roles").
 *   - `requireOrgKind`: 'PARENT' | 'SUBSIDIARY'. When set to 'PARENT', the
 *     guard rejects subsidiary principals — equivalent to the
 *     `assertParentOrgPrincipal` check in the Cloud Function layer.
 *
 * Until Phase 3.E migrates every user doc to carry `homeOrgId`, the
 * org-kind check falls back to: super-user email OR (globalRole ∈
 * admin/owner AND subsidiaryAccess includes 'zeus-group'). Same fallback
 * pattern as PricingAdminGuard and assignment/lib/auth.js.
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '@/shared/hooks';
import { useCurrentDawinUser } from '@/core/settings';
import { FullPageLoader } from '@/shared/components/feedback';

type UserRole = string;
type OrgKind = 'PARENT' | 'SUBSIDIARY';

interface RoleGuardProps {
  children: React.ReactNode;
  /** Legacy prop — keep for back-compat with existing callers. */
  roles?: UserRole[];
  /** Phase 3.D alias for `roles`; either may be passed. */
  requireGlobalRole?: UserRole[];
  /** Phase 3.D — when 'PARENT', subsidiary principals see 403. */
  requireOrgKind?: OrgKind;
  fallback?: React.ReactNode;
}

// Super user email with unrestricted access to all functions
const SUPER_USER_EMAILS = ['onzimai@zeusgroup.co.ug', 'onzimai@dawin.group'];

const PARENT_ORG_ID = 'zeus-group';

export function RoleGuard({ children, roles, requireGlobalRole, requireOrgKind, fallback }: RoleGuardProps) {
  const { user, loading } = useAuth();
  const { dawinUser, isLoading: userLoading } = useCurrentDawinUser();

  // Wait for auth to load before making decisions
  if (loading || userLoading) {
    return <FullPageLoader text="Checking permissions..." />;
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  // Super user bypasses all role checks
  if (user.email && SUPER_USER_EMAILS.includes(user.email)) {
    return <>{children}</>;
  }

  if (!dawinUser) {
    if (fallback) return <>{fallback}</>;
    return <Navigate to="/unauthorized" replace />;
  }

  // Check if user has required role in their DawinUser profile (with hierarchy)
  const roleMapping: Record<string, string> = {
    'admin': 'admin',
    'super_admin': 'owner',
    'owner': 'owner',
    'manager': 'manager',
    'member': 'member',
    'viewer': 'viewer',
  };

  // Ordered role hierarchy: higher index = more privilege
  const roleHierarchy = ['viewer', 'member', 'manager', 'admin', 'owner'];
  const userRoleIndex = roleHierarchy.indexOf(dawinUser.globalRole);

  const effectiveRoles = requireGlobalRole ?? roles ?? [];

  // User passes if their role is at or above ANY listed role
  const hasRequiredRole = effectiveRoles.length === 0
    ? true
    : effectiveRoles.some((role) => {
        const mapped = roleMapping[role] || role;
        const requiredIndex = roleHierarchy.indexOf(mapped);
        return requiredIndex >= 0 && userRoleIndex >= requiredIndex;
      });

  if (!hasRequiredRole) {
    if (fallback) return <>{fallback}</>;
    return <Navigate to="/unauthorized" replace />;
  }

  // Phase 3.D — org-kind gate (spec §7.4). 'PARENT' rejects subsidiary
  // principals; 'SUBSIDIARY' would reject parent principals (not yet
  // used). Until 3.E lands homeOrgId on every user, fall back to
  // "subsidiaryAccess includes 'zeus-group'" as the PARENT proxy.
  if (requireOrgKind === 'PARENT') {
    const hasParentMembership =
      Array.isArray(dawinUser.subsidiaryAccess) &&
      dawinUser.subsidiaryAccess.some(
        (s) => s.subsidiaryId === PARENT_ORG_ID && s.hasAccess,
      );
    if (!hasParentMembership) {
      if (fallback) return <>{fallback}</>;
      return <Navigate to="/unauthorized" replace />;
    }
  }
  if (requireOrgKind === 'SUBSIDIARY') {
    const onlyParent =
      Array.isArray(dawinUser.subsidiaryAccess) &&
      dawinUser.subsidiaryAccess.every(
        (s) => !s.hasAccess || s.subsidiaryId === PARENT_ORG_ID,
      );
    if (onlyParent) {
      if (fallback) return <>{fallback}</>;
      return <Navigate to="/unauthorized" replace />;
    }
  }

  return <>{children}</>;
}
