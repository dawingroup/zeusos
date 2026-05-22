/**
 * BILLING_ADMIN scope check — surface for use inside React components.
 *
 * The full scope system + Organisation.kind ('PARENT' | 'SUBSIDIARY')
 * land in Phase 3.A.5. Until then this function approximates the spec
 * intent: any user whose globalRole is `owner` or `admin` AND who is
 * not scoped to a non-parent subsidiary may access /billing/*.
 *
 * When 3.A.5 lands, replace the body with the real scope grant lookup.
 * The function signature is the contract — callers will not need to
 * change.
 */

import type { DawinUser } from '@/core/settings/types';

const SUPER_USER_EMAILS = ['onzimai@zeusgroup.co.ug', 'onzimai@dawin.group'];

export interface BillingAccessContext {
  user: { email: string | null } | null;
  dawinUser: DawinUser | null;
}

export function hasBillingAdminScope(ctx: BillingAccessContext): boolean {
  // Super users always pass — mirrors RoleGuard behaviour.
  if (ctx.user?.email && SUPER_USER_EMAILS.includes(ctx.user.email)) return true;

  if (!ctx.dawinUser) return false;

  // Approximate "PARENT org kind" by checking the globalRole — only
  // owner/admin can be billing admins under the standalone slice.
  // Phase 3.A.5 replaces this with the actual scope grant table.
  return ctx.dawinUser.globalRole === 'owner' || ctx.dawinUser.globalRole === 'admin';
}
