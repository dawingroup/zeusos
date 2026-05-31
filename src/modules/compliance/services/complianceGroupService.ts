// ============================================================================
// COMPLIANCE GROUP SERVICE — Phase 2.1
// Holding-level rollup: fans the per-brand compliance collections out across
// every operating sibling brand and consolidates them for the Zeus Group
// (parent) view. Pure client-side aggregation.
//
// Ported from DawinOS. The only adaptation is the subsidiary source: DawinOS
// pulled a dynamic `GroupSubsidiary[]` from `useScopedCompanyId`; Zeus's five
// brands are fixed, so they're declared statically here (id/name/color mirror
// the accent list in PreferencesMenu.tsx).
// ============================================================================

import {
  getComplianceDocuments,
  scanAndUpdateStatuses,
} from './complianceDocumentService';
import {
  scanUpcomingObligations,
  getComplianceObligations,
} from './complianceObligationService';
import type {
  ComplianceDocument,
  ComplianceObligation,
  ComplianceDocumentStatus,
} from '../types';
import type { SubsidiaryId } from '@/core/settings/types';

export interface GroupSubsidiary {
  id: SubsidiaryId;
  name: string;
  color: string;
}

/**
 * The five operating sibling brands (excludes the `zeus-group` parent).
 * id/name/color mirror the canonical accent list.
 */
export const GROUP_SUBSIDIARIES: GroupSubsidiary[] = [
  { id: 'zeus-the-agency', name: 'Zeus The Agency', color: '#f5d900' },
  { id: 'zeus-digital', name: 'Zeus Digital', color: '#00c5e5' },
  { id: 'labyrinth', name: 'Labyrinth', color: '#2f9d5c' },
  { id: 'odd-gorilla', name: 'Odd Gorilla', color: '#e65b66' },
  { id: 'house-of-zeus', name: 'House of Zeus', color: '#6fa823' },
];

export type WithSubsidiary<T> = T & {
  subsidiaryId: string;
  subsidiaryName: string;
  subsidiaryColor: string;
};

export interface GroupComplianceSubsidiaryRow {
  id: string;
  name: string;
  color: string;
  score: number;
  totalDocuments: number;
  expiringCount: number;
  overdueCount: number;
}

export interface GroupComplianceDashboardData {
  subsidiaryCount: number;
  score: number;
  totalDocuments: number;
  statusBreakdown: Record<ComplianceDocumentStatus, number>;
  upcomingExpirations: WithSubsidiary<ComplianceDocument>[];
  overdueObligations: WithSubsidiary<ComplianceObligation>[];
  upcomingObligations: WithSubsidiary<ComplianceObligation>[];
  bySubsidiary: GroupComplianceSubsidiaryRow[];
}

// Mirrors the per-subsidiary weighting in useComplianceDashboard so group and
// single-subsidiary scores stay comparable.
const STATUS_WEIGHTS: Record<ComplianceDocumentStatus, number> = {
  valid: 100,
  pending_verification: 70,
  expiring_soon: 50,
  expired: 0,
  missing: 0,
  not_applicable: 100,
};

function scoreDocuments(documents: ComplianceDocument[]): number {
  const applicable = documents.filter((d) => d.status !== 'not_applicable');
  if (applicable.length === 0) return 100;
  const total = applicable.reduce((sum, d) => sum + (STATUS_WEIGHTS[d.status] ?? 0), 0);
  return Math.round(total / applicable.length);
}

function emptyBreakdown(): Record<ComplianceDocumentStatus, number> {
  return {
    valid: 0,
    pending_verification: 0,
    expiring_soon: 0,
    expired: 0,
    missing: 0,
    not_applicable: 0,
  };
}

function tag<T>(sub: GroupSubsidiary, items: T[]): WithSubsidiary<T>[] {
  return items.map((item) => ({
    ...item,
    subsidiaryId: sub.id,
    subsidiaryName: sub.name,
    subsidiaryColor: sub.color,
  }));
}

async function loadSubsidiary(sub: GroupSubsidiary) {
  try {
    await scanAndUpdateStatuses(sub.id);
  } catch {
    /* status refresh is best-effort */
  }
  const [documents, upcoming] = await Promise.all([
    getComplianceDocuments(sub.id).catch(() => [] as ComplianceDocument[]),
    scanUpcomingObligations(sub.id).catch(() => ({
      overdue: [] as ComplianceObligation[],
      due: [] as ComplianceObligation[],
    })),
  ]);
  return { sub, documents, upcoming };
}

class ComplianceGroupService {
  async getGroupDashboard(
    subsidiaries: GroupSubsidiary[] = GROUP_SUBSIDIARIES,
  ): Promise<GroupComplianceDashboardData> {
    const results = await Promise.all(subsidiaries.map(loadSubsidiary));

    const allDocuments: ComplianceDocument[] = [];
    const statusBreakdown = emptyBreakdown();
    const upcomingExpirations: WithSubsidiary<ComplianceDocument>[] = [];
    const overdueObligations: WithSubsidiary<ComplianceObligation>[] = [];
    const upcomingObligations: WithSubsidiary<ComplianceObligation>[] = [];
    const bySubsidiary: GroupComplianceSubsidiaryRow[] = [];

    const now = new Date();
    const thirtyDaysOut = new Date();
    thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

    for (const r of results) {
      allDocuments.push(...r.documents);

      r.documents.forEach((d) => {
        statusBreakdown[d.status] = (statusBreakdown[d.status] || 0) + 1;
      });

      const expiring = r.documents.filter((d) => {
        if (!d.expiryDate || d.status === 'not_applicable') return false;
        const exp = d.expiryDate.toDate();
        return exp >= now && exp <= thirtyDaysOut;
      });
      upcomingExpirations.push(...tag(r.sub, expiring));
      overdueObligations.push(...tag(r.sub, r.upcoming.overdue));
      upcomingObligations.push(...tag(r.sub, r.upcoming.due));

      bySubsidiary.push({
        id: r.sub.id,
        name: r.sub.name,
        color: r.sub.color,
        score: scoreDocuments(r.documents),
        totalDocuments: r.documents.length,
        expiringCount: expiring.length,
        overdueCount: r.upcoming.overdue.length,
      });
    }

    const dateAsc = (a?: { toDate(): Date }, b?: { toDate(): Date }) =>
      (a?.toDate().getTime() || 0) - (b?.toDate().getTime() || 0);
    upcomingExpirations.sort((a, b) => dateAsc(a.expiryDate, b.expiryDate));
    overdueObligations.sort((a, b) => dateAsc(a.nextDueDate, b.nextDueDate));
    upcomingObligations.sort((a, b) => dateAsc(a.nextDueDate, b.nextDueDate));
    bySubsidiary.sort((a, b) => a.score - b.score); // worst compliance first

    return {
      subsidiaryCount: subsidiaries.length,
      score: scoreDocuments(allDocuments),
      totalDocuments: allDocuments.length,
      statusBreakdown,
      upcomingExpirations,
      overdueObligations,
      upcomingObligations,
      bySubsidiary,
    };
  }

  /** All compliance documents across the group, subsidiary-tagged. */
  async getAllDocuments(
    subsidiaries: GroupSubsidiary[] = GROUP_SUBSIDIARIES,
  ): Promise<WithSubsidiary<ComplianceDocument>[]> {
    const perSub = await Promise.all(
      subsidiaries.map(async (s) =>
        tag(s, await getComplianceDocuments(s.id).catch(() => [])),
      ),
    );
    return perSub.flat();
  }

  /** All compliance obligations across the group, subsidiary-tagged. */
  async getAllObligations(
    subsidiaries: GroupSubsidiary[] = GROUP_SUBSIDIARIES,
  ): Promise<WithSubsidiary<ComplianceObligation>[]> {
    const perSub = await Promise.all(
      subsidiaries.map(async (s) =>
        tag(s, await getComplianceObligations(s.id).catch(() => [])),
      ),
    );
    return perSub.flat();
  }
}

export const complianceGroupService = new ComplianceGroupService();
