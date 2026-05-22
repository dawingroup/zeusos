/**
 * Billing-module RBAC scopes.
 *
 * `BILLING_ADMIN` is the scope the task spec requires on every
 * /billing/* route. Now that Phase 3.A.5 / 3.D landed the canonical
 * `Organization.kind === 'PARENT'` check on RoleGuard, the scope is
 * enforced as the composite of:
 *   - requireGlobalRole ∈ ('admin','owner')
 *   - requireOrgKind === 'PARENT'
 * See BillingAccessGuard (route side) and assertBillingAdmin (Cloud
 * Function side).
 */

export type BillingScope = 'BILLING_ADMIN';

export const BILLING_ADMIN: BillingScope = 'BILLING_ADMIN';
