/**
 * PricingAdminGuard — preserved import site, now a thin re-export of the
 * shared `ParentOrgGuard` (3.D). The previous placeholder logic
 * (subsidiaryAccess includes 'zeus-group') has been replaced by the
 * canonical `RoleGuard requireGlobalRole=['admin','owner']
 * requireOrgKind='PARENT'` shape that the RoleGuard already implements.
 */
export { ParentOrgGuard as PricingAdminGuard } from '@/router/guards/ParentOrgGuard';
export { ParentOrgGuard as default } from '@/router/guards/ParentOrgGuard';
