/**
 * OfflineGuard Component
 * Handles routes that require online connectivity
 */

import { Navigate } from 'react-router-dom';
import { useOnlineStatus } from '@/shared/hooks';

interface OfflineGuardProps {
  children: React.ReactNode;
  requiresOnline?: boolean;
}

export function OfflineGuard({ children, requiresOnline = false }: OfflineGuardProps) {
  const { isOnline } = useOnlineStatus();

  if (requiresOnline && !isOnline) {
    return <Navigate to="/offline" replace />;
  }

  return <>{children}</>;
}
