/**
 * BillingAccessGuard — composite guard for every /billing/* route.
 *
 * Today's behavior (standalone slice):
 *   - Wraps existing RoleGuard with roles=['admin', 'owner']
 *   - Adds an extra hasBillingAdminScope check that becomes a real
 *     scope-grant lookup in Phase 3.A.5
 *
 * Task-spec'd behavior (3.A.5 onwards):
 *   - Equivalent to:
 *     <RoleGuard requireGlobalRole={['admin','owner']}
 *                requireScope='BILLING_ADMIN'
 *                requireOrgKind='PARENT'>
 *   - Subsidiary users (org.kind === 'SUBSIDIARY') → 403 even if their
 *     globalRole is owner/admin within their subsidiary.
 *
 * This composite wrapper exists so Phase 3.A.5 can flip the
 * implementation in one place — every billing route already uses it.
 */

import { Navigate } from 'react-router-dom';
import { RoleGuard } from '@/router/guards/RoleGuard';
import { useAuth } from '@/shared/hooks';
import { useCurrentDawinUser } from '@/core/settings';
import { hasBillingAdminScope } from '../services/billing-scope.service';

interface BillingAccessGuardProps {
  children: React.ReactNode;
}

export function BillingAccessGuard({ children }: BillingAccessGuardProps) {
  const { user } = useAuth();
  const { dawinUser } = useCurrentDawinUser();

  return (
    <RoleGuard roles={['admin', 'owner']}>
      <BillingScopeGate user={user} dawinUser={dawinUser}>
        {children}
      </BillingScopeGate>
    </RoleGuard>
  );
}

function BillingScopeGate({
  user,
  dawinUser,
  children,
}: {
  user: { email: string | null } | null;
  dawinUser: ReturnType<typeof useCurrentDawinUser>['dawinUser'];
  children: React.ReactNode;
}) {
  if (!hasBillingAdminScope({ user, dawinUser })) {
    return <Navigate to="/unauthorized" replace />;
  }
  return <>{children}</>;
}

export default BillingAccessGuard;
