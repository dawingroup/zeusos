/**
 * ModuleGuard Component
 * Protects routes based on module access from the user's DawinUser profile.
 * Supports minimum role enforcement for sensitive modules.
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '@/shared/hooks';
import { useCurrentDawinUser } from '@/core/settings';
import { FullPageLoader } from '@/shared/components/feedback';
import type { SubsidiaryModule } from '@/types/subsidiary';
import type { GlobalRole } from '@/core/settings/types';

/** Sensitivity-tiered minimum roles per module */
const MODULE_MINIMUM_ROLES: Partial<Record<SubsidiaryModule, GlobalRole>> = {
  strategy: 'manager',
  finance: 'manager',
  capital: 'manager',
  hr: 'member', // overall HR is member+, but payroll is admin+ (handled at feature level)
};

/** Ordered role hierarchy (higher index = more privilege) */
const ROLE_HIERARCHY: GlobalRole[] = ['viewer', 'member', 'manager', 'admin', 'owner'];

function meetsMinimumRole(userRole: GlobalRole, minimumRole: GlobalRole): boolean {
  return ROLE_HIERARCHY.indexOf(userRole) >= ROLE_HIERARCHY.indexOf(minimumRole);
}

interface ModuleGuardProps {
  children: React.ReactNode;
  module: SubsidiaryModule;
  minimumRole?: GlobalRole;
  fallback?: React.ReactNode;
}

// Super user email with unrestricted access to all modules
const SUPER_USER_EMAILS = ['onzimai@zeusgroup.co.ug', 'onzimai@dawin.group'];

export function ModuleGuard({ children, module, minimumRole, fallback }: ModuleGuardProps) {
  const { user, loading } = useAuth();
  const { dawinUser, isLoading: userLoading } = useCurrentDawinUser();

  if (loading || userLoading) {
    return <FullPageLoader text="Checking module access..." />;
  }

  if (!user) {
    return <Navigate to="/auth/login" replace />;
  }

  // Super user bypasses all module checks
  if (user.email && SUPER_USER_EMAILS.includes(user.email)) {
    return <>{children}</>;
  }

  // No DawinUser profile — user needs to be invited first
  if (!dawinUser) {
    console.warn(`[ModuleGuard] BLOCKED module="${module}": no DawinUser profile for ${user.email}`);
    if (fallback) return <>{fallback}</>;
    return <Navigate to="/unauthorized" replace />;
  }

  // Admins and owners have access to all modules
  if (['admin', 'owner'].includes(dawinUser.globalRole)) {
    return <>{children}</>;
  }

  // Check subsidiaryAccess for explicit module permission
  const hasExplicitAccess = dawinUser.subsidiaryAccess?.some(
    (sa) => sa.hasAccess && sa.modules?.some((m) => m.moduleId === module && m.hasAccess)
  );

  // Enforce minimum role ONLY when there's a prop-level override (e.g., admin-only sub-routes).
  // The sensitivity-tier defaults only apply to users WITHOUT explicit module access.
  // If admin explicitly granted the module, skip the default tier check.
  if (minimumRole && !meetsMinimumRole(dawinUser.globalRole, minimumRole)) {
    console.warn(
      `[ModuleGuard] BLOCKED module="${module}": user role "${dawinUser.globalRole}" below explicit minimumRole="${minimumRole}" for ${user.email}`
    );
    if (fallback) return <>{fallback}</>;
    return <Navigate to="/unauthorized" replace />;
  }

  if (!hasExplicitAccess) {
    // No explicit grant — apply sensitivity-tier minimum as fallback check
    const tierMinRole = MODULE_MINIMUM_ROLES[module] ?? 'member';
    if (!meetsMinimumRole(dawinUser.globalRole, tierMinRole)) {
      console.warn(
        `[ModuleGuard] BLOCKED module="${module}": no explicit access and role "${dawinUser.globalRole}" below tier minimum "${tierMinRole}" for ${user.email}`
      );
      if (fallback) return <>{fallback}</>;
      return <Navigate to="/unauthorized" replace />;
    }
    console.warn(
      `[ModuleGuard] BLOCKED module="${module}": no matching access in subsidiaryAccess for ${user.email}`,
      'subsidiaryAccess:', JSON.stringify(dawinUser.subsidiaryAccess?.map(sa => ({
        sub: sa.subsidiaryId,
        access: sa.hasAccess,
        modules: sa.modules?.filter(m => m.hasAccess).map(m => m.moduleId),
      })))
    );
    if (fallback) return <>{fallback}</>;
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
