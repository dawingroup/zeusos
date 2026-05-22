/**
 * BillingAccessGuard — composite guard for every /billing/* route.
 *
 * Equivalent to:
 *   <RoleGuard requireGlobalRole={['admin','owner']} requireOrgKind="PARENT">
 *
 * The canonical (post-3.A.5 / 3.D) RoleGuard implements both checks
 * natively, so this wrapper is now just a single composed call that
 * mirrors AMAccessGuard's signature. Subsidiary principals — even with
 * admin/owner globalRole — are rejected per spec §7.4 (no commercial
 * scope on SUBSIDIARY-kind orgs).
 *
 * The Cloud Function layer (functions/src/billing/lib/auth.js
 * #assertBillingAdmin) enforces the same shape server-side via
 * assertParentOrgPrincipal + globalRole admin/owner.
 */

import { RoleGuard } from '@/router/guards/RoleGuard';

export function BillingAccessGuard({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard requireGlobalRole={['admin', 'owner']} requireOrgKind="PARENT">
      {children}
    </RoleGuard>
  );
}

export default BillingAccessGuard;
