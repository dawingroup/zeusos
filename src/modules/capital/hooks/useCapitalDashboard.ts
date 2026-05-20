import { useState, useEffect, useCallback } from 'react';
import type { CapitalDashboardData } from '../types/capital.types';
import { capitalNeedsService } from '../services/capitalNeedsService';
import { applicationService } from '../services/applicationService';
import { facilityService } from '../services/facilityService';
import { readinessService } from '../services/readinessService';

export function useCapitalDashboard(companyId: string) {
  const [data, setData] = useState<CapitalDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!companyId) return;
    setLoading(true);
    setError(null);
    try {
      const [needs, apps, facilitySummary, assessment] = await Promise.all([
        capitalNeedsService.getNeeds(companyId),
        applicationService.getApplications(companyId),
        facilityService.getFacilitySummary(companyId),
        readinessService.getLatestAssessment(companyId),
      ]);

      const activeNeeds = needs.filter(
        n => !['resolved', 'deferred'].includes(n.status),
      );
      const pendingApps = apps.filter(
        a => !['completed', 'declined', 'withdrawn'].includes(a.stage),
      );

      const facilities = await facilityService.getFacilities(companyId, {
        status: 'active',
      });

      setData({
        readinessScore: assessment?.overallScore ?? 0,
        activeNeeds,
        activeFacilities: facilities,
        pendingApplications: pendingApps,
        totalOutstandingDebt: facilitySummary.totalOutstanding,
        totalFacilityLimit: facilitySummary.totalFacilityLimit,
        totalUtilized: facilitySummary.totalOutstanding,
        upcomingRepayments: facilitySummary.upcomingRepayments as any,
        cashRunwayDays: assessment?.financialHealth.metrics.cashRunwayDays ?? 0,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dashboard');
    } finally {
      setLoading(false);
    }
  }, [companyId]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { data, loading, error, refresh };
}
