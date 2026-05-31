/**
 * useComplianceCompanyId — resolves the compliance company scope for the viewer.
 *
 * Parent-org principals → 'zeus-group' (the group's own obligations/documents);
 * subsidiary members → their home brand. Mirrors how ComplianceDashboardPage
 * branches, so the Documents + Obligations tabs read the same bucket the
 * tightened firestore.rules authorise (rather than the DawinOS 'default' leftover).
 */

import { useMemo } from 'react';
import { useCurrentDawinUser } from '@/core/settings';
import { isParentOrgUser, resolveHomeSubsidiaryId } from '@/modules/delivery/components/deliveryAccess';

export function useComplianceCompanyId(): string {
  const { dawinUser } = useCurrentDawinUser();
  return useMemo(() => {
    if (!dawinUser) return 'zeus-group';
    if (isParentOrgUser(dawinUser)) return 'zeus-group';
    return resolveHomeSubsidiaryId(dawinUser) || 'zeus-group';
  }, [dawinUser]);
}
