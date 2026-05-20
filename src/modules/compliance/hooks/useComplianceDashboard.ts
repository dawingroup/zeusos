/**
 * useComplianceDashboard Hook
 * Aggregated compliance health score, status breakdown, upcoming expirations, overdue obligations.
 */

import { useState, useEffect, useCallback } from 'react';
import { getComplianceDocuments } from '../services/complianceDocumentService';
import { scanUpcomingObligations } from '../services/complianceObligationService';
import { scanAndUpdateStatuses } from '../services/complianceDocumentService';
import type {
  ComplianceDocument,
  ComplianceDashboardData,
  ComplianceDocumentStatus,
} from '../types';

interface UseComplianceDashboardReturn {
  data: ComplianceDashboardData | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<void>;
}

function calculateScore(documents: ComplianceDocument[]): number {
  if (documents.length === 0) return 100;

  const applicableDocs = documents.filter(d => d.status !== 'not_applicable');
  if (applicableDocs.length === 0) return 100;

  const weights: Record<ComplianceDocumentStatus, number> = {
    valid: 100,
    pending_verification: 70,
    expiring_soon: 50,
    expired: 0,
    missing: 0,
    not_applicable: 100,
  };

  const totalScore = applicableDocs.reduce((sum, d) => sum + (weights[d.status] || 0), 0);
  return Math.round(totalScore / applicableDocs.length);
}

export function useComplianceDashboard(companyId: string): UseComplianceDashboardReturn {
  const [data, setData] = useState<ComplianceDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);

    try {
      // Scan and update document statuses first
      await scanAndUpdateStatuses(companyId);

      // Fetch all data in parallel
      const [documents, upcoming] = await Promise.all([
        getComplianceDocuments(companyId),
        scanUpcomingObligations(companyId),
      ]);

      // Status breakdown
      const statusBreakdown = {
        valid: 0,
        expiring_soon: 0,
        expired: 0,
        missing: 0,
        not_applicable: 0,
        pending_verification: 0,
      } as Record<ComplianceDocumentStatus, number>;

      documents.forEach(d => {
        statusBreakdown[d.status] = (statusBreakdown[d.status] || 0) + 1;
      });

      // Upcoming expirations (next 30 days)
      const now = new Date();
      const thirtyDaysOut = new Date();
      thirtyDaysOut.setDate(thirtyDaysOut.getDate() + 30);

      const upcomingExpirations = documents
        .filter(d => {
          if (!d.expiryDate || d.status === 'not_applicable') return false;
          const exp = d.expiryDate.toDate();
          return exp >= now && exp <= thirtyDaysOut;
        })
        .sort((a, b) => {
          const aDate = a.expiryDate?.toDate().getTime() || 0;
          const bDate = b.expiryDate?.toDate().getTime() || 0;
          return aDate - bDate;
        });

      setData({
        score: calculateScore(documents),
        statusBreakdown,
        totalDocuments: documents.length,
        upcomingExpirations,
        overdueObligations: upcoming.overdue,
        upcomingObligations: upcoming.due,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard data');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
