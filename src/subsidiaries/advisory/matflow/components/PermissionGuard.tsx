/**
 * Permission Guard Component
 * Conditionally renders children based on user capabilities
 */

import { ReactNode } from 'react';
import { useProjectContext } from '../context/ProjectContext';
import type { MatFlowCapability } from '../types';
import { ShieldOff, Loader2 } from 'lucide-react';

interface PermissionGuardProps {
  /** Required capability to view children */
  capability: MatFlowCapability;
  /** Content to render when allowed */
  children: ReactNode;
  /** Optional fallback when denied (defaults to alert) */
  fallback?: ReactNode;
  /** If true, shows nothing instead of fallback when denied */
  silent?: boolean;
  /** If true, shows loading spinner while checking */
  showLoading?: boolean;
}

export function PermissionGuard({
  capability,
  children,
  fallback,
  silent = false,
  showLoading = false,
}: PermissionGuardProps) {
  const { hasCapability, loading } = useProjectContext();
  
  if (loading && showLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
      </div>
    );
  }
  
  if (!hasCapability(capability)) {
    if (silent) {
      return null;
    }
    
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
        <ShieldOff className="h-5 w-5 text-red-600 mt-0.5" />
        <div>
          <h4 className="font-medium text-red-900">Access Denied</h4>
          <p className="text-sm text-red-700">
            You don't have permission to access this feature. Contact your project
            administrator if you believe this is an error.
          </p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}

interface MultiPermissionGuardProps {
  /** Required capabilities */
  capabilities: MatFlowCapability[];
  /** Content to render when allowed */
  children: ReactNode;
  /** Optional fallback when denied */
  fallback?: ReactNode;
  /** If true, shows nothing instead of fallback when denied */
  silent?: boolean;
  /** If true, requires ANY capability instead of ALL */
  requireAny?: boolean;
}

/**
 * Multi-capability guard (requires ALL capabilities by default)
 */
export function MultiPermissionGuard({
  capabilities,
  children,
  fallback,
  silent = false,
  requireAny = false,
}: MultiPermissionGuardProps) {
  const { hasCapability, loading } = useProjectContext();
  
  const hasPermission = requireAny
    ? capabilities.some(cap => hasCapability(cap))
    : capabilities.every(cap => hasCapability(cap));
  
  if (loading) {
    return null;
  }
  
  if (!hasPermission) {
    if (silent) {
      return null;
    }
    
    if (fallback) {
      return <>{fallback}</>;
    }
    
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
        <ShieldOff className="h-5 w-5 text-red-600 mt-0.5" />
        <div>
          <h4 className="font-medium text-red-900">Access Denied</h4>
          <p className="text-sm text-red-700">
            You don't have the required permissions to access this feature.
          </p>
        </div>
      </div>
    );
  }
  
  return <>{children}</>;
}
