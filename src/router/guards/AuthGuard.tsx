/**
 * AuthGuard Component
 * Protects routes that require authentication
 */

import { Suspense } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/shared/hooks';
import { FullPageLoader } from '@/shared/components/feedback';

interface AuthGuardProps {
  children: React.ReactNode;
}

export function AuthGuard({ children }: AuthGuardProps) {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();

  if (loading) {
    return <FullPageLoader text="Authenticating..." />;
  }

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  // Wrap children in Suspense to properly handle lazy-loaded routes after auth
  return (
    <Suspense fallback={<FullPageLoader text="Loading..." />}>
      {children}
    </Suspense>
  );
}
