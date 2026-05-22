/**
 * AMAccessGuard — composite guard for every /clients/*, /master-jobs/*,
 * and /account-mgmt/* route in Phase 3.D.
 *
 * Equivalent to:
 *   <RoleGuard requireGlobalRole={['admin','owner']} requireOrgKind="PARENT">
 *
 * Mirrors the BillingAccessGuard pattern from Phase 3.F so the three
 * commercial surfaces share the same authority signature.
 */

import { RoleGuard } from '@/router/guards/RoleGuard';

export function AMAccessGuard({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard requireGlobalRole={['admin', 'owner']} requireOrgKind="PARENT">
      {children}
    </RoleGuard>
  );
}

export default AMAccessGuard;
