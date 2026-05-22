/**
 * AMAccessGuard — preserved import site, now a thin re-export of the
 * shared `ParentOrgGuard` (3.D). Account-Management, Pricing, and
 * Billing all share the same authority signature.
 */
export { ParentOrgGuard as AMAccessGuard } from '@/router/guards/ParentOrgGuard';
export { ParentOrgGuard as default } from '@/router/guards/ParentOrgGuard';
