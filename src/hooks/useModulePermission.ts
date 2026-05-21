/**
 * useModulePermission Hook
 * Checks both module-level and feature-level (tab/section) access
 * for the current user against a specific module.
 */

import { useMemo } from 'react';
import { useAuth } from '@/shared/hooks';
import { useCurrentDawinUser } from '@/core/settings';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import type { SubsidiaryModule } from '@/types/subsidiary';
import type { GlobalRole, ModuleFeature } from '@/core/settings/types';
import { MODULE_FEATURES } from '@/core/settings/types';

const SUPER_USER_EMAILS = ['onzimai@zeusgroup.co.ug'];

const ROLE_HIERARCHY: GlobalRole[] = ['viewer', 'member', 'manager', 'admin', 'owner'];

function meetsMinimumRole(userRole: GlobalRole, minimumRole: GlobalRole): boolean {
  return ROLE_HIERARCHY.indexOf(userRole) >= ROLE_HIERARCHY.indexOf(minimumRole);
}

export interface ModulePermissionResult {
  /** Whether the user has access to the module */
  hasAccess: boolean;
  /** Check if user has access to a specific feature within the module */
  hasFeature: (featureId: string) => boolean;
  /** Get all features the user can access in this module */
  accessibleFeatures: ModuleFeature[];
  /** Whether data is still loading */
  isLoading: boolean;
  /** Whether user is admin/owner/super-user (bypasses all checks) */
  isPrivileged: boolean;
}

export function useModulePermission(moduleId: SubsidiaryModule): ModulePermissionResult {
  const { user } = useAuth();
  const { dawinUser, isLoading: userLoading } = useCurrentDawinUser();
  const { currentSubsidiary, isLoading: subLoading } = useSubsidiary();

  const isSuperUser = !!(user?.email && SUPER_USER_EMAILS.includes(user.email));
  const isPrivileged = isSuperUser || (dawinUser ? ['admin', 'owner'].includes(dawinUser.globalRole) : false);

  const moduleAccess = useMemo(() => {
    if (!dawinUser) return null;

    // Check all subsidiary access entries for this module
    for (const sa of dawinUser.subsidiaryAccess ?? []) {
      if (!sa.hasAccess) continue;

      // For subsidiary-specific modules, match subsidiary
      if (currentSubsidiary && sa.subsidiaryId === currentSubsidiary.id) {
        const mod = sa.modules?.find((m) => m.moduleId === moduleId && m.hasAccess);
        if (mod) return mod;
      }

      // For corporate modules, any subsidiary entry counts
      const mod = sa.modules?.find((m) => m.moduleId === moduleId && m.hasAccess);
      if (mod) return mod;
    }

    return null;
  }, [dawinUser, currentSubsidiary, moduleId]);

  const hasAccess = isPrivileged || !!moduleAccess;

  const hasFeature = useMemo(() => {
    return (featureId: string) => {
      // Privileged users bypass all feature checks
      if (isPrivileged) return true;

      if (!moduleAccess) return false;

      // Check feature minimum role
      const features = MODULE_FEATURES[moduleId] ?? [];
      const feature = features.find((f) => f.id === featureId);
      if (feature?.minimumRole && dawinUser) {
        if (!meetsMinimumRole(dawinUser.globalRole, feature.minimumRole)) {
          return false;
        }
      }

      // If no customPermissions are set, grant all features (backward compat)
      if (!moduleAccess.customPermissions || moduleAccess.customPermissions.length === 0) {
        return true;
      }

      return moduleAccess.customPermissions.includes(featureId);
    };
  }, [isPrivileged, moduleAccess, moduleId, dawinUser]);

  const accessibleFeatures = useMemo(() => {
    const features = MODULE_FEATURES[moduleId] ?? [];
    return features.filter((f) => hasFeature(f.id));
  }, [moduleId, hasFeature]);

  return {
    hasAccess,
    hasFeature,
    accessibleFeatures,
    isLoading: userLoading || subLoading,
    isPrivileged,
  };
}
