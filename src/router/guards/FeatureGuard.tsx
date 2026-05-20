/**
 * FeatureGuard Component
 * Protects routes/sections based on feature-level (tab/section) permissions
 * within a module. Used for granular access control inside already-guarded modules.
 */

import { Navigate } from 'react-router-dom';
import { useModulePermission } from '@/hooks/useModulePermission';
import { FullPageLoader } from '@/shared/components/feedback';
import type { SubsidiaryModule } from '@/types/subsidiary';

interface FeatureGuardProps {
  children: React.ReactNode;
  module: SubsidiaryModule;
  feature: string; // e.g., 'finance:operations', 'hr:payroll'
  fallback?: React.ReactNode;
  /** If true, renders nothing instead of redirecting when access is denied */
  silent?: boolean;
}

export function FeatureGuard({ children, module, feature, fallback, silent }: FeatureGuardProps) {
  const { hasAccess, hasFeature, isLoading } = useModulePermission(module);

  if (isLoading) {
    return <FullPageLoader text="Checking access..." />;
  }

  // Must have module access first
  if (!hasAccess) {
    if (silent) return null;
    if (fallback) return <>{fallback}</>;
    return <Navigate to="/unauthorized" replace />;
  }

  // Check feature-level access
  if (!hasFeature(feature)) {
    if (silent) return null;
    if (fallback) return <>{fallback}</>;
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
