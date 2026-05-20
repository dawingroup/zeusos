/**
 * Permissions Hook
 * Provides permission checking for MatFlow features
 */

import { useMemo } from 'react';
import { useProjectContext } from '../context/ProjectContext';
import type { MatFlowCapability } from '../types';

export interface PermissionSet {
  // BOQ Permissions
  canViewBOQ: boolean;
  canEditBOQ: boolean;
  canCreateBOQ: boolean;
  canDeleteBOQ: boolean;
  canApproveBOQ: boolean;
  canImportBOQ: boolean;
  
  // Formula Permissions
  canViewFormulas: boolean;
  canManageFormulas: boolean;
  
  // Procurement Permissions
  canViewProcurement: boolean;
  canCreateProcurement: boolean;
  canEditProcurement: boolean;
  canDeleteProcurement: boolean;
  
  // Project Permissions
  canViewProject: boolean;
  canEditProject: boolean;
  canCreateProject: boolean;
  canDeleteProject: boolean;
  
  // Reports Permissions
  canViewReports: boolean;
  canExportReports: boolean;
}

export function usePermissions(): PermissionSet {
  const { hasCapability, project, currentMember } = useProjectContext();
  
  return useMemo(() => {
    // If no project or member, deny all
    if (!project || !currentMember) {
      return {
        canViewBOQ: false,
        canEditBOQ: false,
        canCreateBOQ: false,
        canDeleteBOQ: false,
        canApproveBOQ: false,
        canImportBOQ: false,
        canViewFormulas: false,
        canManageFormulas: false,
        canViewProcurement: false,
        canCreateProcurement: false,
        canEditProcurement: false,
        canDeleteProcurement: false,
        canViewProject: false,
        canEditProject: false,
        canCreateProject: false,
        canDeleteProject: false,
        canViewReports: false,
        canExportReports: false,
      };
    }
    
    return {
      // BOQ Permissions
      canViewBOQ: hasCapability('boq:view'),
      canEditBOQ: hasCapability('boq:edit'),
      canCreateBOQ: hasCapability('boq:create'),
      canDeleteBOQ: hasCapability('boq:delete'),
      canApproveBOQ: hasCapability('boq:approve'),
      canImportBOQ: hasCapability('boq:import'),
      
      // Formula Permissions
      canViewFormulas: hasCapability('formula:view'),
      canManageFormulas: hasCapability('formula:manage'),
      
      // Procurement Permissions
      canViewProcurement: hasCapability('procurement:view'),
      canCreateProcurement: hasCapability('procurement:create'),
      canEditProcurement: hasCapability('procurement:edit'),
      canDeleteProcurement: hasCapability('procurement:delete'),
      
      // Project Permissions
      canViewProject: hasCapability('project:view'),
      canEditProject: hasCapability('project:edit'),
      canCreateProject: hasCapability('project:create'),
      canDeleteProject: hasCapability('project:delete'),
      
      // Reports Permissions
      canViewReports: hasCapability('reports:view'),
      canExportReports: hasCapability('reports:export'),
    };
  }, [hasCapability, project, currentMember]);
}

/**
 * Hook for checking a single permission with loading state
 */
export function usePermission(capability: MatFlowCapability): {
  allowed: boolean;
  loading: boolean;
} {
  const { hasCapability, loading } = useProjectContext();
  
  return {
    allowed: hasCapability(capability),
    loading,
  };
}

/**
 * Hook for requiring permissions (throws if not allowed)
 */
export function useRequirePermission(capability: MatFlowCapability): void {
  const { allowed, loading } = usePermission(capability);
  
  if (!loading && !allowed) {
    throw new Error(`Permission denied: ${capability}`);
  }
}
