/**
 * ParentOrgGuard — the in-browser layer of the §7.4 "commercial gravity"
 * boundary: only parent-org admins/owners may transit any AM, Pricing, or
 * Billing route. The matching API-side rejection happens in the Cloud
 * Function `assertParentOrgPrincipal` helpers; the Firestore rules layer
 * blocks the writes a subsidiary principal could otherwise attempt
 * directly. All three layers say the same thing so a discipline failure
 * on any one cannot defeat the invariant.
 *
 * Lifted out of `PricingAdminGuard` (3.C) and `AMAccessGuard` (3.D) so
 * the three commercial surfaces share one authority signature. Both of
 * those now re-export this component.
 */
import { RoleGuard } from './RoleGuard';

export function ParentOrgGuard({ children }: { children: React.ReactNode }) {
  return (
    <RoleGuard requireGlobalRole={['admin', 'owner']} requireOrgKind="PARENT">
      {children}
    </RoleGuard>
  );
}

export default ParentOrgGuard;
