/**
 * Who the approvals inbox is for.
 *
 * Mirrors the dual-scope rule TeamTimePage uses: a parent-org (Account
 * Management) principal sees every queue; a brand's own staff see their
 * brand's IWO rows; anyone without an org scope sees nothing. The Firestore
 * rules enforce the same split on the underlying collections — this only
 * decides which feeds to open so a brand user is never shown a
 * permission error for a queue that was never theirs.
 */

import type { DawinUser } from '@/core/settings/types';
import { isParentOrgUser, resolveHomeSubsidiaryId } from '@/modules/delivery/components/deliveryAccess';
import type { ApprovalsScope } from './types';

export function resolveApprovalsScope(user: DawinUser | null | undefined): ApprovalsScope {
  if (!user) return { kind: 'none' };
  if (isParentOrgUser(user)) return { kind: 'parent' };
  const home = resolveHomeSubsidiaryId(user);
  return home ? { kind: 'brand', orgId: home } : { kind: 'none' };
}
