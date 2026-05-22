/**
 * SubsidiaryDeliveryGuard — layer 1 of the §7.4 "subsidiary never quotes"
 * boundary, applied **inversely**: this guard admits subsidiary-org users
 * and redirects parent-org users away. It is the mirror of
 * `PricingAdminGuard` and shares the same placeholder approximation of
 * "home org kind" until 3.A.5's `users.homeOrgId` migration lands.
 *
 * Layer 1 of the three layers (this file):
 *   parent-org users (AM staff) → `/admin/iwo/:id` AM-side view (Phase 3.D)
 *     If the AM view is not yet wired up, fall through to `/unauthorized`.
 *   subsidiary-org users        → pass through to the delivery workspace.
 *
 * Layer 2 (nav filtering)        — `AppShell` does not surface pricing /
 *   contracts / engagements in the menu for subsidiary users.
 * Layer 3 (workflow / API)        — the matching Cloud Functions reject any
 *   pricing / contracts / billing mutation from a SUBSIDIARY principal
 *   with HTTP 403; Firestore rules block direct reads of cost fields.
 *
 * Super-users (Daniel + admin/owner globalRole) currently pass through so
 * the workspace remains smoke-testable end-to-end during Phase 3.E. When
 * 3.A.5's home-org-id migration ships, replace the access check with the
 * canonical `home_org_kind === 'SUBSIDIARY'` lookup and drop the bypass.
 */

import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/shared/hooks';
import { useCurrentDawinUser } from '@/core/settings';
import { FullPageLoader } from '@/shared/components/feedback';
import { isParentOrgUser, isSubsidiaryUser } from './deliveryAccess';

const SUPER_USER_EMAILS = ['onzimai@zeusgroup.co.ug', 'onzimai@dawin.group'];

export function SubsidiaryDeliveryGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { dawinUser, isLoading } = useCurrentDawinUser();
  const location = useLocation();

  if (loading || isLoading) {
    return <FullPageLoader text="Checking delivery access…" />;
  }
  if (!user) return <Navigate to="/auth/login" replace />;

  const isSuperUser = !!(user.email && SUPER_USER_EMAILS.includes(user.email));
  if (isSuperUser) return <>{children}</>;

  if (!dawinUser) return <Navigate to="/unauthorized" replace />;

  if (isParentOrgUser(dawinUser)) {
    // 3.D precondition: an AM-side IWO view at `/admin/iwo/:id` will be
    // the canonical destination for parent-org users. Until that route
    // lands we fall through to /unauthorized so the boundary still holds.
    const iwoMatch = location.pathname.match(/^\/delivery\/iwo\/([^/]+)/);
    if (iwoMatch) {
      // TODO(3.D): when AM-side IWO view ships, route to `/admin/iwo/${iwoMatch[1]}`.
      return <Navigate to="/unauthorized" replace />;
    }
    return <Navigate to="/unauthorized" replace />;
  }

  if (!isSubsidiaryUser(dawinUser)) {
    return <Navigate to="/unauthorized" replace />;
  }

  return <>{children}</>;
}
