// ============================================================================
// USE SECTION AUDIT LOG HOOK - Strategy Plan Update Tool
// React hook for reading section audit trail
// ============================================================================

import { useQuery } from '@tanstack/react-query';
import { getAuditLog } from '../services/sectionAuditLog.service';
import type { SectionAuditEntry } from '../types/documentSection.types';

export function useSectionAuditLog(
  companyId: string,
  reviewId: string,
  sectionId?: string
) {
  const queryKey = ['section-audit-log', companyId, reviewId, sectionId ?? 'all'];

  const auditQuery = useQuery<SectionAuditEntry[]>({
    queryKey,
    queryFn: () => getAuditLog(companyId, reviewId, sectionId),
    enabled: !!companyId && !!reviewId,
  });

  return {
    data: auditQuery.data ?? [],
    isLoading: auditQuery.isLoading,
    error: auditQuery.error,
  };
}
