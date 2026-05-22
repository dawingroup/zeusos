/**
 * Billing-module RBAC scopes.
 *
 * `BILLING_ADMIN` is the scope the task spec requires on every /billing/*
 * route. The full scope-system rollout happens in Phase 3.A.5 (Domain
 * re-model) — until then `hasBillingAdminScope()` in services/auth.ts
 * approximates the check via the existing globalRole hierarchy.
 */

export type BillingScope = 'BILLING_ADMIN';

export const BILLING_ADMIN: BillingScope = 'BILLING_ADMIN';
