/**
 * ACCOUNTABILITY HOOKS
 *
 * React hooks for accountability overview and tracking.
 */

import { useState, useEffect, useMemo, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
  Firestore,
} from 'firebase/firestore';
import { Requisition } from '../types/requisition';
import { Accountability } from '../types/accountability';
import { ManualRequisition } from '../types/manual-requisition';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface AccountabilityOverviewFilters {
  programId?: string;
  projectId?: string;
  dateRange?: { start: Date; end: Date };
}

export interface AccountabilitySummary {
  totalRequisitions: number;
  totalDisbursed: number;
  totalAccounted: number;
  totalUnaccounted: number;
  pendingCount: number;
  partialCount: number;
  completeCount: number;
  overdueCount: number;
  overdueAmount: number;
  accountabilityRate: number;
  // Manual requisition additions
  manualRequisitionCount: number;
  manualDisbursed: number;
  manualAccounted: number;
  manualUnaccounted: number;
}

export interface ProjectAccountabilitySummary {
  projectId: string;
  projectName: string;
  programName?: string;
  requisitionCount: number;
  totalDisbursed: number;
  totalAccounted: number;
  unaccountedAmount: number;
  accountabilityRate: number;
  overdueCount: number;
  pendingCount: number;
  status: 'healthy' | 'warning' | 'critical';
}

export interface AgingBucket {
  range: string;
  minDays: number;
  maxDays: number;
  count: number;
  amount: number;
  requisitions: Requisition[];
}

export interface RequisitionWithAccountabilities extends Requisition {
  accountabilities: Accountability[];
  daysUntilDue: number;
  daysSincePaid?: number;
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useAccountabilityOverview
// ─────────────────────────────────────────────────────────────────

export function useAccountabilityOverview(
  db: Firestore,
  filters: AccountabilityOverviewFilters = {}
) {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [manualRequisitions, setManualRequisitions] = useState<ManualRequisition[]>([]);
  const [accountabilities, setAccountabilities] = useState<Accountability[]>([]);
  const [projects, setProjects] = useState<Record<string, { name: string; programName?: string }>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      // Build requisition query for formal requisitions
      const reqConstraints: any[] = [
        where('paymentType', '==', 'requisition'),
        where('status', '==', 'paid'),
        orderBy('accountabilityDueDate', 'asc'),
      ];

      if (filters.programId) {
        reqConstraints.unshift(where('programId', '==', filters.programId));
      }
      if (filters.projectId) {
        reqConstraints.unshift(where('projectId', '==', filters.projectId));
      }

      const reqQuery = query(collection(db, 'payments'), ...reqConstraints);
      const reqSnapshot = await getDocs(reqQuery);
      const reqData = reqSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as Requisition[];

      // Filter by date range if provided
      let filteredReqs = reqData;
      if (filters.dateRange) {
        filteredReqs = reqData.filter(r => {
          const paidAt = r.paidAt?.toDate();
          if (!paidAt) return false;
          return paidAt >= filters.dateRange!.start && paidAt <= filters.dateRange!.end;
        });
      }

      setRequisitions(filteredReqs);

      // Fetch manual requisitions that are linked to projects
      const manualConstraints: any[] = [
        where('linkStatus', '==', 'linked'),
        orderBy('requisitionDate', 'desc'),
      ];

      if (filters.programId) {
        manualConstraints.unshift(where('linkedProgramId', '==', filters.programId));
      }
      if (filters.projectId) {
        manualConstraints.unshift(where('linkedProjectId', '==', filters.projectId));
      }

      const manualQuery = query(collection(db, 'manual_requisitions'), ...manualConstraints);
      const manualSnapshot = await getDocs(manualQuery);
      const manualData = manualSnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
      })) as ManualRequisition[];

      setManualRequisitions(manualData);

      // Fetch accountabilities for these requisitions
      if (filteredReqs.length > 0) {
        const accQuery = query(
          collection(db, 'payments'),
          where('paymentType', '==', 'accountability'),
          orderBy('createdAt', 'desc')
        );
        const accSnapshot = await getDocs(accQuery);
        const accData = accSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Accountability[];
        setAccountabilities(accData);
      }

      // Fetch project names - combine from both formal and manual requisitions
      const formalProjectIds = filteredReqs.map(r => r.projectId);
      const manualProjectIds = manualData.map(r => r.linkedProjectId).filter(Boolean) as string[];
      const allProjectIds = [...new Set([...formalProjectIds, ...manualProjectIds])];

      if (allProjectIds.length > 0) {
        const projectsQuery = query(
          collection(db, 'projects'),
          where('__name__', 'in', allProjectIds.slice(0, 10)) // Firestore limit
        );
        const projectsSnapshot = await getDocs(projectsQuery);
        const projectsMap: Record<string, { name: string; programName?: string }> = {};
        projectsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          projectsMap[doc.id] = {
            name: data.name,
            programName: data.programName,
          };
        });
        setProjects(projectsMap);
      }
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch accountability data'));
    } finally {
      setLoading(false);
    }
  }, [db, filters.programId, filters.projectId, filters.dateRange?.start, filters.dateRange?.end]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Calculate summary (including both formal and manual requisitions)
  const summary = useMemo<AccountabilitySummary>(() => {
    // Formal requisitions
    const formalDisbursed = requisitions.reduce((sum, r) => sum + r.grossAmount, 0);
    const formalUnaccounted = requisitions.reduce((sum, r) => sum + (r.unaccountedAmount || 0), 0);
    const formalAccounted = formalDisbursed - formalUnaccounted;

    // Manual requisitions
    const manualDisbursed = manualRequisitions.reduce((sum, r) => sum + r.amount, 0);
    const manualUnaccounted = manualRequisitions.reduce((sum, r) => sum + (r.unaccountedAmount || 0), 0);
    const manualAccounted = manualDisbursed - manualUnaccounted;

    // Combined totals
    const totalDisbursed = formalDisbursed + manualDisbursed;
    const totalUnaccounted = formalUnaccounted + manualUnaccounted;
    const totalAccounted = formalAccounted + manualAccounted;

    // Status counts (formal requisitions)
    const byStatus = {
      pending: requisitions.filter(r => r.accountabilityStatus === 'pending'),
      partial: requisitions.filter(r => r.accountabilityStatus === 'partial'),
      complete: requisitions.filter(r => r.accountabilityStatus === 'complete'),
      overdue: requisitions.filter(r => r.accountabilityStatus === 'overdue'),
    };

    // Add manual requisition status counts
    const manualByStatus = {
      pending: manualRequisitions.filter(r => r.accountabilityStatus === 'pending'),
      partial: manualRequisitions.filter(r => r.accountabilityStatus === 'partial'),
      complete: manualRequisitions.filter(r => r.accountabilityStatus === 'complete'),
      overdue: manualRequisitions.filter(r => r.accountabilityStatus === 'overdue'),
    };

    const overdueAmount = byStatus.overdue.reduce((sum, r) => sum + (r.unaccountedAmount || 0), 0)
      + manualByStatus.overdue.reduce((sum, r) => sum + (r.unaccountedAmount || 0), 0);

    return {
      totalRequisitions: requisitions.length + manualRequisitions.length,
      totalDisbursed,
      totalAccounted,
      totalUnaccounted,
      pendingCount: byStatus.pending.length + manualByStatus.pending.length,
      partialCount: byStatus.partial.length + manualByStatus.partial.length,
      completeCount: byStatus.complete.length + manualByStatus.complete.length,
      overdueCount: byStatus.overdue.length + manualByStatus.overdue.length,
      overdueAmount,
      accountabilityRate: totalDisbursed > 0 ? (totalAccounted / totalDisbursed) * 100 : 0,
      // Manual-specific stats
      manualRequisitionCount: manualRequisitions.length,
      manualDisbursed,
      manualAccounted,
      manualUnaccounted,
    };
  }, [requisitions, manualRequisitions]);

  // Group by project (combining formal and manual requisitions)
  const byProject = useMemo<ProjectAccountabilitySummary[]>(() => {
    // Build a map with combined data from formal and manual requisitions
    const projectMap = new Map<string, {
      formalReqs: Requisition[];
      manualReqs: ManualRequisition[];
    }>();

    // Add formal requisitions
    requisitions.forEach(req => {
      const existing = projectMap.get(req.projectId) || { formalReqs: [], manualReqs: [] };
      existing.formalReqs.push(req);
      projectMap.set(req.projectId, existing);
    });

    // Add manual requisitions
    manualRequisitions.forEach(req => {
      if (req.linkedProjectId) {
        const existing = projectMap.get(req.linkedProjectId) || { formalReqs: [], manualReqs: [] };
        existing.manualReqs.push(req);
        projectMap.set(req.linkedProjectId, existing);
      }
    });

    return Array.from(projectMap.entries()).map(([projectId, { formalReqs, manualReqs }]) => {
      // Calculate formal requisition amounts
      const formalDisbursed = formalReqs.reduce((sum, r) => sum + r.grossAmount, 0);
      const formalUnaccounted = formalReqs.reduce((sum, r) => sum + (r.unaccountedAmount || 0), 0);

      // Calculate manual requisition amounts
      const manualDisbursed = manualReqs.reduce((sum, r) => sum + r.amount, 0);
      const manualUnaccounted = manualReqs.reduce((sum, r) => sum + (r.unaccountedAmount || 0), 0);

      // Combined totals
      const totalDisbursed = formalDisbursed + manualDisbursed;
      const unaccountedAmount = formalUnaccounted + manualUnaccounted;
      const totalAccounted = totalDisbursed - unaccountedAmount;

      // Combined status counts
      const formalOverdue = formalReqs.filter(r => r.accountabilityStatus === 'overdue').length;
      const manualOverdue = manualReqs.filter(r => r.accountabilityStatus === 'overdue').length;
      const overdueCount = formalOverdue + manualOverdue;

      const formalPending = formalReqs.filter(r =>
        r.accountabilityStatus === 'pending' || r.accountabilityStatus === 'partial'
      ).length;
      const manualPending = manualReqs.filter(r =>
        r.accountabilityStatus === 'pending' || r.accountabilityStatus === 'partial'
      ).length;
      const pendingCount = formalPending + manualPending;

      const accountabilityRate = totalDisbursed > 0 ? (totalAccounted / totalDisbursed) * 100 : 0;

      let status: 'healthy' | 'warning' | 'critical' = 'healthy';
      if (overdueCount > 0) status = 'critical';
      else if (accountabilityRate < 70) status = 'warning';

      return {
        projectId,
        projectName: projects[projectId]?.name || 'Unknown Project',
        programName: projects[projectId]?.programName,
        requisitionCount: formalReqs.length + manualReqs.length,
        totalDisbursed,
        totalAccounted,
        unaccountedAmount,
        accountabilityRate,
        overdueCount,
        pendingCount,
        status,
      };
    }).sort((a, b) => {
      // Sort by status (critical first), then by unaccounted amount
      if (a.status === 'critical' && b.status !== 'critical') return -1;
      if (b.status === 'critical' && a.status !== 'critical') return 1;
      return b.unaccountedAmount - a.unaccountedAmount;
    });
  }, [requisitions, manualRequisitions, projects]);

  // Overdue requisitions (both formal and manual)
  const overdueRequisitions = useMemo(() => {
    // Map manual requisitions to a compatible format for display
    const overdueManual = manualRequisitions
      .filter(r => r.accountabilityStatus === 'overdue')
      .map(r => ({
        ...r,
        // Map manual requisition fields to formal requisition format for compatibility
        projectId: r.linkedProjectId || '',
        projectName: r.linkedProjectName || '',
        grossAmount: r.amount,
        accountabilityDueDate: r.accountabilityDueDate,
        isManualRequisition: true,
      }));

    const overdueFormal = requisitions
      .filter(r => r.accountabilityStatus === 'overdue')
      .map(r => ({ ...r, isManualRequisition: false }));

    return [...overdueFormal, ...overdueManual]
      .sort((a, b) => {
        const aDue = new Date(String(a.accountabilityDueDate)).getTime();
        const bDue = new Date(String(b.accountabilityDueDate)).getTime();
        return aDue - bDue;
      });
  }, [requisitions, manualRequisitions]);

  // Due soon (within 7 days) - both formal and manual
  const dueSoonRequisitions = useMemo(() => {
    const now = new Date();
    const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    // Manual requisitions due soon
    const manualDueSoon = manualRequisitions
      .filter(r => {
        if (r.accountabilityStatus === 'complete' || r.accountabilityStatus === 'overdue') {
          return false;
        }
        if (!r.accountabilityDueDate) return false;
        const dueDate = new Date(String(r.accountabilityDueDate));
        return dueDate >= now && dueDate <= weekFromNow;
      })
      .map(r => ({
        ...r,
        projectId: r.linkedProjectId || '',
        projectName: r.linkedProjectName || '',
        grossAmount: r.amount,
        isManualRequisition: true,
      }));

    // Formal requisitions due soon
    const formalDueSoon = requisitions
      .filter(r => {
        if (r.accountabilityStatus === 'complete' || r.accountabilityStatus === 'overdue') {
          return false;
        }
        const dueDate = new Date(String(r.accountabilityDueDate));
        return dueDate >= now && dueDate <= weekFromNow;
      })
      .map(r => ({ ...r, isManualRequisition: false }));

    return [...formalDueSoon, ...manualDueSoon]
      .sort((a, b) => {
        const aDue = new Date(String(a.accountabilityDueDate)).getTime();
        const bDue = new Date(String(b.accountabilityDueDate)).getTime();
        return aDue - bDue;
      });
  }, [requisitions, manualRequisitions]);

  return {
    summary,
    byProject,
    overdueRequisitions,
    dueSoonRequisitions,
    requisitions,
    manualRequisitions,
    accountabilities,
    loading,
    error,
    refresh: fetchData,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useAccountabilityAging
// ─────────────────────────────────────────────────────────────────

export function useAccountabilityAging(
  db: Firestore,
  projectId?: string
) {
  const [requisitions, setRequisitions] = useState<Requisition[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    const fetchRequisitions = async () => {
      setLoading(true);
      setError(null);

      try {
        const constraints: any[] = [
          where('paymentType', '==', 'requisition'),
          where('status', '==', 'paid'),
          where('accountabilityStatus', 'in', ['pending', 'partial', 'overdue']),
        ];

        if (projectId) {
          constraints.unshift(where('projectId', '==', projectId));
        }

        const q = query(collection(db, 'payments'), ...constraints);
        const snapshot = await getDocs(q);
        const data = snapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Requisition[];

        setRequisitions(data);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch aging data'));
      } finally {
        setLoading(false);
      }
    };

    fetchRequisitions();
  }, [db, projectId]);

  const aging = useMemo<AgingBucket[]>(() => {
    const now = new Date();

    const buckets: AgingBucket[] = [
      { range: '0-7 days', minDays: 0, maxDays: 7, count: 0, amount: 0, requisitions: [] },
      { range: '8-14 days', minDays: 8, maxDays: 14, count: 0, amount: 0, requisitions: [] },
      { range: '15-30 days', minDays: 15, maxDays: 30, count: 0, amount: 0, requisitions: [] },
      { range: '30+ days', minDays: 31, maxDays: Infinity, count: 0, amount: 0, requisitions: [] },
    ];

    requisitions.forEach(req => {
      const paidDate = req.paidAt?.toDate();
      if (!paidDate) return;

      const daysSincePaid = Math.floor((now.getTime() - paidDate.getTime()) / (1000 * 60 * 60 * 24));

      const bucket = buckets.find(b => daysSincePaid >= b.minDays && daysSincePaid <= b.maxDays);
      if (bucket) {
        bucket.count++;
        bucket.amount += req.unaccountedAmount || 0;
        bucket.requisitions.push(req);
      }
    });

    return buckets;
  }, [requisitions]);

  const totalPending = useMemo(() => ({
    count: requisitions.length,
    amount: requisitions.reduce((sum, r) => sum + (r.unaccountedAmount || 0), 0),
  }), [requisitions]);

  return {
    aging,
    totalPending,
    loading,
    error,
  };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useRequisitionWithAccountabilities
// ─────────────────────────────────────────────────────────────────

export function useRequisitionWithAccountabilities(
  db: Firestore,
  projectId: string | null
) {
  const [requisitions, setRequisitions] = useState<RequisitionWithAccountabilities[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!projectId) {
      setRequisitions([]);
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      setError(null);

      try {
        // Fetch requisitions
        const reqQuery = query(
          collection(db, 'payments'),
          where('projectId', '==', projectId),
          where('paymentType', '==', 'requisition'),
          orderBy('createdAt', 'desc')
        );
        const reqSnapshot = await getDocs(reqQuery);
        const reqData = reqSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Requisition[];

        // Fetch accountabilities
        const accQuery = query(
          collection(db, 'payments'),
          where('projectId', '==', projectId),
          where('paymentType', '==', 'accountability'),
          orderBy('createdAt', 'desc')
        );
        const accSnapshot = await getDocs(accQuery);
        const accData = accSnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data(),
        })) as Accountability[];

        // Map accountabilities to requisitions
        const now = new Date();
        const combined: RequisitionWithAccountabilities[] = reqData.map(req => {
          const linkedAccs = accData.filter(acc => acc.requisitionId === req.id);
          const dueDate = new Date(req.accountabilityDueDate);
          const daysUntilDue = Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
          const paidDate = req.paidAt?.toDate();
          const daysSincePaid = paidDate
            ? Math.floor((now.getTime() - paidDate.getTime()) / (1000 * 60 * 60 * 24))
            : undefined;

          return {
            ...req,
            accountabilities: linkedAccs,
            daysUntilDue,
            daysSincePaid,
          };
        });

        setRequisitions(combined);
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to fetch requisition data'));
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [db, projectId]);

  return { requisitions, loading, error };
}
