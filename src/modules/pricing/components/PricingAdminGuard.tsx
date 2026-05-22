/**
 * PricingAdminGuard — the in-browser layer of the §7.4 "subsidiary never
 * quotes" boundary. The matching API-side rejection happens in
 * `functions/src/pricing/lib/auth.js#assertPricingAdmin`; the Firestore
 * rules layer guards `rate_card_lines.cost_minor`. All three say the same
 * thing so a discipline failure on any one cannot defeat the invariant.
 *
 * PHASE 3.A.5 PLACEHOLDER: we approximate "home org kind = PARENT" by
 * checking that the user has the `zeus-group` subsidiary in their
 * `subsidiaryAccess` list. When 3.A.5 introduces `organizations.kind` and
 * `users.home_org_id`, replace this with the canonical
 * `home_org_kind === 'PARENT'` check.
 */

import { Navigate } from 'react-router-dom';
import { useAuth } from '@/shared/hooks';
import { useCurrentDawinUser } from '@/core/settings';
import { FullPageLoader } from '@/shared/components/feedback';

const SUPER_USER_EMAILS = ['onzimai@zeusgroup.co.ug', 'onzimai@dawin.group'];
const PARENT_SUBSIDIARY_ID = 'zeus-group';

export function PricingAdminGuard({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { dawinUser, isLoading } = useCurrentDawinUser();

  if (loading || isLoading) {
    return <FullPageLoader text="Checking pricing access…" />;
  }
  if (!user) return <Navigate to="/auth/login" replace />;
  if (user.email && SUPER_USER_EMAILS.includes(user.email)) return <>{children}</>;
  if (!dawinUser) return <Navigate to="/unauthorized" replace />;

  const isAdminOrOwner = dawinUser.globalRole === 'admin' || dawinUser.globalRole === 'owner';
  const hasParentMembership =
    Array.isArray(dawinUser.subsidiaryAccess) &&
    dawinUser.subsidiaryAccess.some(s => s.subsidiaryId === PARENT_SUBSIDIARY_ID && s.hasAccess);

  if (!isAdminOrOwner || !hasParentMembership) {
    return <Navigate to="/unauthorized" replace />;
  }
  return <>{children}</>;
}
