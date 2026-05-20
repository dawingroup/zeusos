/**
 * COUNTRY DIRECTOR DASHBOARD SERVICE
 *
 * Service for the consolidated Country Director Dashboard that integrates
 * manual requisitions with system requisitions for ADD-FIN-001 compliance monitoring.
 */

import {
  collection,
  getDocs,
  query,
  where,
  orderBy,
  Firestore,
  Timestamp,
} from 'firebase/firestore';
import {
  UnifiedRequisitionSummary,
  CountryDirectorSummary,
  ComplianceAlert,
  UnifiedAgingAnalysis,
  ComplianceScore,
  ComplianceScoreBreakdown,
  InvestigationWithCountdown,
  CountryDirectorFilters,
  ProgramOption,
  createDefaultAgingBuckets,
  calculateAlertSeverity,
  calculateOverallComplianceScore,
} from '../types/country-director-dashboard';
import {
  ManualRequisition,
  calculateManualRequisitionVariance,
} from '../types/manual-requisition';
import { Requisition } from '../types/requisition';

// ─────────────────────────────────────────────────────────────────
// COLLECTION PATHS
// ─────────────────────────────────────────────────────────────────

const MANUAL_REQUISITIONS_PATH = 'manual_requisitions';
const PAYMENTS_PATH = 'payments';
const PROGRAMS_PATH = 'programs';
const PROJECTS_PATH = 'projects';

// ─────────────────────────────────────────────────────────────────
// COUNTRY DIRECTOR DASHBOARD SERVICE
// ─────────────────────────────────────────────────────────────────

export class CountryDirectorDashboardService {
  private static instance: CountryDirectorDashboardService;
  private db: Firestore;

  private constructor(db: Firestore) {
    this.db = db;
  }

  static getInstance(db: Firestore): CountryDirectorDashboardService {
    if (!CountryDirectorDashboardService.instance) {
      CountryDirectorDashboardService.instance = new CountryDirectorDashboardService(db);
    }
    return CountryDirectorDashboardService.instance;
  }

  // ─────────────────────────────────────────────────────────────────
  // PROGRAM SELECTION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get available programs for the selector
   */
  async getAvailablePrograms(): Promise<ProgramOption[]> {
    const programsSnapshot = await getDocs(collection(this.db, PROGRAMS_PATH));
    const programs: ProgramOption[] = [];

    for (const programDoc of programsSnapshot.docs) {
      const programData = programDoc.data();

      // Count projects in program
      const projectsQuery = query(
        collection(this.db, PROJECTS_PATH),
        where('programId', '==', programDoc.id)
      );
      const projectsSnapshot = await getDocs(projectsQuery);

      // Count requisitions (both manual and system)
      const manualQuery = query(
        collection(this.db, MANUAL_REQUISITIONS_PATH),
        where('linkedProgramId', '==', programDoc.id)
      );
      const manualSnapshot = await getDocs(manualQuery);

      const systemQuery = query(
        collection(this.db, PAYMENTS_PATH),
        where('programId', '==', programDoc.id),
        where('paymentType', '==', 'requisition')
      );
      const systemSnapshot = await getDocs(systemQuery);

      programs.push({
        id: programDoc.id,
        name: programData.name || 'Unnamed Program',
        projectCount: projectsSnapshot.size,
        requisitionCount: manualSnapshot.size + systemSnapshot.size,
      });
    }

    return programs.sort((a, b) => a.name.localeCompare(b.name));
  }

  // ─────────────────────────────────────────────────────────────────
  // UNIFIED REQUISITIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get unified requisitions from both manual and system sources
   */
  async getUnifiedRequisitions(
    programId: string,
    filters?: Partial<CountryDirectorFilters>
  ): Promise<UnifiedRequisitionSummary[]> {
    const unified: UnifiedRequisitionSummary[] = [];
    const now = new Date();

    // Fetch manual requisitions for this program
    const manualQuery = query(
      collection(this.db, MANUAL_REQUISITIONS_PATH),
      where('linkedProgramId', '==', programId),
      orderBy('requisitionDate', 'desc')
    );
    const manualSnapshot = await getDocs(manualQuery);

    for (const docSnap of manualSnapshot.docs) {
      const manual = { id: docSnap.id, ...docSnap.data() } as ManualRequisition;

      // Calculate variance if not already calculated
      const variance = manual.variance || calculateManualRequisitionVariance(manual);

      // Calculate days
      const paidDate = manual.paidDate
        ? (manual.paidDate instanceof Date ? manual.paidDate : (manual.paidDate as Timestamp).toDate())
        : undefined;
      const daysSinceDisbursement = paidDate
        ? Math.floor((now.getTime() - paidDate.getTime()) / (1000 * 60 * 60 * 24))
        : undefined;

      const dueDate = manual.accountabilityDueDate
        ? (manual.accountabilityDueDate instanceof Date
            ? manual.accountabilityDueDate
            : (manual.accountabilityDueDate as Timestamp).toDate())
        : undefined;
      const daysUntilDue = dueDate
        ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : undefined;

      const reqDate = manual.requisitionDate instanceof Date
        ? manual.requisitionDate
        : (manual.requisitionDate as Timestamp).toDate();

      unified.push({
        id: manual.id,
        source: 'manual',
        referenceNumber: manual.referenceNumber,
        description: manual.description,
        amount: manual.amount,
        currency: manual.currency,
        accountabilityStatus: manual.accountabilityStatus,
        totalAccountedAmount: manual.totalAccountedAmount,
        unaccountedAmount: manual.unaccountedAmount,
        accountabilityDueDate: dueDate,
        daysSinceDisbursement,
        daysUntilDue,
        varianceStatus: variance.varianceStatus,
        varianceAmount: variance.varianceAmount,
        variancePercentage: variance.variancePercentage,
        hasActiveInvestigation: manual.requiresInvestigation,
        reconciliationStatus: manual.reconciliationStatus,
        projectId: manual.linkedProjectId,
        projectName: manual.linkedProjectName,
        programId: manual.linkedProgramId,
        programName: manual.linkedProgramName,
        requisitionDate: reqDate,
        paidDate,
        linkedSystemAccountabilityId: manual.linkedSystemAccountabilityId,
      });
    }

    // Fetch system requisitions for this program
    const systemQuery = query(
      collection(this.db, PAYMENTS_PATH),
      where('programId', '==', programId),
      where('paymentType', '==', 'requisition'),
      where('status', '==', 'paid'),
      orderBy('createdAt', 'desc')
    );
    const systemSnapshot = await getDocs(systemQuery);

    // Get project info for system requisitions
    const projectIds = [...new Set(systemSnapshot.docs.map(d => d.data().projectId))];
    const projectMap = new Map<string, { name: string; programName?: string }>();

    if (projectIds.length > 0) {
      // Fetch in batches of 10 (Firestore limit)
      for (let i = 0; i < projectIds.length; i += 10) {
        const batch = projectIds.slice(i, i + 10);
        const projectsQuery = query(
          collection(this.db, PROJECTS_PATH),
          where('__name__', 'in', batch)
        );
        const projectsSnapshot = await getDocs(projectsQuery);
        projectsSnapshot.docs.forEach(doc => {
          const data = doc.data();
          projectMap.set(doc.id, { name: data.name, programName: data.programName });
        });
      }
    }

    for (const docSnap of systemSnapshot.docs) {
      const req = { id: docSnap.id, ...docSnap.data() } as Requisition;

      const paidDate = req.paidAt?.toDate();
      const daysSinceDisbursement = paidDate
        ? Math.floor((now.getTime() - paidDate.getTime()) / (1000 * 60 * 60 * 24))
        : undefined;

      const dueDate = req.accountabilityDueDate
        ? new Date(req.accountabilityDueDate)
        : undefined;
      const daysUntilDue = dueDate
        ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24))
        : undefined;

      const project = projectMap.get(req.projectId);

      unified.push({
        id: req.id,
        source: 'system',
        referenceNumber: req.requisitionNumber,
        description: req.purpose || '',
        amount: req.grossAmount,
        currency: req.currency || 'UGX',
        accountabilityStatus: req.accountabilityStatus,
        totalAccountedAmount: req.grossAmount - (req.unaccountedAmount || 0),
        unaccountedAmount: req.unaccountedAmount || 0,
        accountabilityDueDate: dueDate,
        daysSinceDisbursement,
        daysUntilDue,
        varianceStatus: req.variance?.varianceStatus as any,
        varianceAmount: req.variance?.varianceAmount,
        variancePercentage: req.variance?.variancePercentage,
        hasActiveInvestigation: req.requiresInvestigation,
        reconciliationStatus: req.reconciliationStatus as any,
        projectId: req.projectId,
        projectName: project?.name || 'Unknown Project',
        programId: req.programId,
        programName: project?.programName,
        requisitionDate: req.createdAt?.toDate() || new Date(),
        paidDate,
      });
    }

    // Apply filters
    let filtered = unified;

    if (filters?.accountabilityStatus) {
      filtered = filtered.filter(r => r.accountabilityStatus === filters.accountabilityStatus);
    }
    if (filters?.source) {
      filtered = filtered.filter(r => r.source === filters.source);
    }
    if (filters?.varianceStatus) {
      filtered = filtered.filter(r => r.varianceStatus === filters.varianceStatus);
    }
    if (filters?.dateRange) {
      filtered = filtered.filter(r => {
        if (!r.paidDate) return false;
        return r.paidDate >= filters.dateRange!.start && r.paidDate <= filters.dateRange!.end;
      });
    }

    return filtered.sort((a, b) => b.requisitionDate.getTime() - a.requisitionDate.getTime());
  }

  // ─────────────────────────────────────────────────────────────────
  // DASHBOARD SUMMARY
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get consolidated dashboard summary for a program
   */
  async getDashboardSummary(programId: string): Promise<CountryDirectorSummary> {
    const requisitions = await this.getUnifiedRequisitions(programId);
    const aging = await this.getUnifiedAging(programId);

    const manualReqs = requisitions.filter(r => r.source === 'manual');
    const systemReqs = requisitions.filter(r => r.source === 'system');

    // Calculate status counts
    const pendingCount = requisitions.filter(r => r.accountabilityStatus === 'pending').length;
    const partialCount = requisitions.filter(r => r.accountabilityStatus === 'partial').length;
    const completeCount = requisitions.filter(r => r.accountabilityStatus === 'complete').length;
    const overdueCount = requisitions.filter(r => r.accountabilityStatus === 'overdue').length;

    // Calculate financial totals
    const totalDisbursed = requisitions.reduce((sum, r) => sum + r.amount, 0);
    const totalAccounted = requisitions.reduce((sum, r) => sum + r.totalAccountedAmount, 0);
    const totalUnaccounted = requisitions.reduce((sum, r) => sum + r.unaccountedAmount, 0);

    // Calculate variance summary
    const varianceSummary = {
      compliant: requisitions.filter(r => r.varianceStatus === 'compliant').length,
      minor: requisitions.filter(r => r.varianceStatus === 'minor').length,
      moderate: requisitions.filter(r => r.varianceStatus === 'moderate').length,
      severe: requisitions.filter(r => r.varianceStatus === 'severe').length,
    };

    // Calculate compliance rate (% of zero-discrepancy)
    const complianceRate = requisitions.length > 0
      ? (varianceSummary.compliant / requisitions.length) * 100
      : 0;

    // Get investigations
    const investigations = await this.getActiveInvestigations(programId);
    const activeInvestigations = investigations.filter(i => !i.isOverdue).length;
    const overdueInvestigations = investigations.filter(i => i.isOverdue).length;

    // Count pending reconciliations
    const pendingReconciliations = requisitions.filter(
      r => r.reconciliationStatus === 'pending' || r.reconciliationStatus === 'in_progress'
    ).length;

    return {
      totalRequisitions: requisitions.length,
      systemRequisitions: systemReqs.length,
      manualRequisitions: manualReqs.length,
      totalDisbursed,
      totalAccounted,
      totalUnaccounted,
      pendingCount,
      partialCount,
      completeCount,
      overdueCount,
      complianceRate,
      varianceSummary,
      activeInvestigations,
      overdueInvestigations,
      pendingReconciliations,
      agingByBucket: aging.buckets,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // COMPLIANCE ALERTS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get compliance alerts requiring attention
   */
  async getComplianceAlerts(programId: string): Promise<ComplianceAlert[]> {
    const alerts: ComplianceAlert[] = [];
    const requisitions = await this.getUnifiedRequisitions(programId);
    const now = new Date();

    for (const req of requisitions) {
      // Overdue accountability
      if (req.accountabilityStatus === 'overdue') {
        const daysOverdue = req.daysUntilDue ? Math.abs(req.daysUntilDue) : 0;
        alerts.push({
          id: `alert-overdue-${req.id}`,
          type: 'overdue_accountability',
          severity: calculateAlertSeverity('overdue_accountability', daysOverdue),
          entityId: req.id,
          entityType: req.source === 'manual' ? 'manual_requisition' : 'system_requisition',
          message: `Accountability overdue by ${daysOverdue} days`,
          actionRequired: 'Submit accountability with supporting documents',
          deadline: req.accountabilityDueDate,
          projectName: req.projectName,
          programName: req.programName,
          amount: req.unaccountedAmount,
          createdAt: now,
        });
      }

      // Severe variance
      if (req.varianceStatus === 'severe') {
        alerts.push({
          id: `alert-variance-${req.id}`,
          type: 'severe_variance',
          severity: 'critical',
          entityId: req.id,
          entityType: req.source === 'manual' ? 'manual_requisition' : 'system_requisition',
          message: `Severe variance detected: ${req.variancePercentage?.toFixed(1)}%`,
          actionRequired: 'Complete variance investigation within 48 hours',
          projectName: req.projectName,
          programName: req.programName,
          amount: req.varianceAmount,
          createdAt: now,
        });
      }

      // Active investigation required
      if (req.hasActiveInvestigation && (req.varianceStatus === 'moderate' || req.varianceStatus === 'severe')) {
        alerts.push({
          id: `alert-investigation-${req.id}`,
          type: 'variance_investigation',
          severity: calculateAlertSeverity('variance_investigation', undefined, req.variancePercentage),
          entityId: req.id,
          entityType: req.source === 'manual' ? 'manual_requisition' : 'system_requisition',
          message: `Variance investigation required: ${req.variancePercentage?.toFixed(1)}%`,
          actionRequired: 'Document findings and root cause within 48 hours',
          projectName: req.projectName,
          programName: req.programName,
          amount: req.varianceAmount,
          createdAt: now,
        });
      }
    }

    // Sort by severity (critical first) then by date
    return alerts.sort((a, b) => {
      if (a.severity === 'critical' && b.severity !== 'critical') return -1;
      if (b.severity === 'critical' && a.severity !== 'critical') return 1;
      return b.createdAt.getTime() - a.createdAt.getTime();
    });
  }

  // ─────────────────────────────────────────────────────────────────
  // INVESTIGATIONS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get active variance investigations
   */
  async getActiveInvestigations(programId: string): Promise<InvestigationWithCountdown[]> {
    // For now, derive investigations from requisitions with variance issues
    // In a full implementation, this would query a dedicated investigations collection
    const requisitions = await this.getUnifiedRequisitions(programId);
    const now = new Date();

    const investigations: InvestigationWithCountdown[] = [];

    for (const req of requisitions) {
      if (req.hasActiveInvestigation && (req.varianceStatus === 'moderate' || req.varianceStatus === 'severe')) {
        // Calculate 48-hour deadline from when variance was detected
        // For simplicity, assume variance was detected at paid date
        const detectionDate = req.paidDate || req.requisitionDate;
        const deadline = new Date(detectionDate.getTime() + 48 * 60 * 60 * 1000);
        const hoursRemaining = Math.max(0, (deadline.getTime() - now.getTime()) / (1000 * 60 * 60));
        const isOverdue = now > deadline;

        investigations.push({
          id: `inv-${req.id}`,
          accountabilityId: req.id,
          varianceAmount: req.varianceAmount || 0,
          variancePercentage: req.variancePercentage || 0,
          assignedTo: '', // Would be populated from actual investigation record
          assignedAt: Timestamp.fromDate(detectionDate),
          deadline,
          status: isOverdue ? 'escalated' : 'pending',
          hoursRemaining,
          isOverdue,
          requisitionNumber: req.referenceNumber,
          projectName: req.projectName,
          programName: req.programName,
        });
      }
    }

    return investigations.sort((a, b) => a.hoursRemaining - b.hoursRemaining);
  }

  // ─────────────────────────────────────────────────────────────────
  // AGING ANALYSIS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get unified aging analysis for both manual and system requisitions
   */
  async getUnifiedAging(programId: string): Promise<UnifiedAgingAnalysis> {
    const requisitions = await this.getUnifiedRequisitions(programId);
    const buckets = createDefaultAgingBuckets();
    const now = new Date();

    let manualTotal = { count: 0, amount: 0 };
    let systemTotal = { count: 0, amount: 0 };

    // Filter to only pending/partial/overdue
    const pending = requisitions.filter(
      r => r.accountabilityStatus === 'pending' ||
           r.accountabilityStatus === 'partial' ||
           r.accountabilityStatus === 'overdue'
    );

    for (const req of pending) {
      if (!req.paidDate) continue;

      const daysSincePaid = Math.floor(
        (now.getTime() - req.paidDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const bucket = buckets.find(b => daysSincePaid >= b.minDays && daysSincePaid <= b.maxDays);
      if (bucket) {
        bucket.count++;
        bucket.amount += req.unaccountedAmount;

        if (req.source === 'manual') {
          bucket.manualCount++;
          bucket.manualAmount += req.unaccountedAmount;
          manualTotal.count++;
          manualTotal.amount += req.unaccountedAmount;
        } else {
          bucket.systemCount++;
          bucket.systemAmount += req.unaccountedAmount;
          systemTotal.count++;
          systemTotal.amount += req.unaccountedAmount;
        }
      }
    }

    return {
      buckets,
      totalPending: {
        count: manualTotal.count + systemTotal.count,
        amount: manualTotal.amount + systemTotal.amount,
      },
      manualTotal,
      systemTotal,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // COMPLIANCE SCORE
  // ─────────────────────────────────────────────────────────────────

  /**
   * Calculate ADD-FIN-001 compliance score for a program
   */
  async calculateComplianceScore(programId: string): Promise<ComplianceScore> {
    const requisitions = await this.getUnifiedRequisitions(programId);
    const now = new Date();

    if (requisitions.length === 0) {
      return {
        overallScore: 100,
        breakdown: {
          zeroDiscrepancyRate: 100,
          onTimeReconciliationRate: 100,
          proofOfSpendCompleteness: 100,
          investigationResolutionRate: 100,
        },
        trend: 'stable',
        lastUpdated: now,
      };
    }

    // Zero discrepancy rate
    const compliantCount = requisitions.filter(r => r.varianceStatus === 'compliant').length;
    const zeroDiscrepancyRate = (compliantCount / requisitions.length) * 100;

    // On-time reconciliation rate
    const withReconciliation = requisitions.filter(r => r.reconciliationStatus);
    const completedOnTime = withReconciliation.filter(
      r => r.reconciliationStatus === 'completed'
    ).length;
    const onTimeReconciliationRate = withReconciliation.length > 0
      ? (completedOnTime / withReconciliation.length) * 100
      : 100;

    // Proof of spend completeness (simplified - based on accountability status)
    const completeAccountability = requisitions.filter(
      r => r.accountabilityStatus === 'complete'
    ).length;
    const proofOfSpendCompleteness = (completeAccountability / requisitions.length) * 100;

    // Investigation resolution rate
    const investigations = await this.getActiveInvestigations(programId);
    const completedInvestigations = investigations.filter(i => !i.isOverdue).length;
    const investigationResolutionRate = investigations.length > 0
      ? (completedInvestigations / investigations.length) * 100
      : 100;

    const breakdown: ComplianceScoreBreakdown = {
      zeroDiscrepancyRate,
      onTimeReconciliationRate,
      proofOfSpendCompleteness,
      investigationResolutionRate,
    };

    const overallScore = calculateOverallComplianceScore(breakdown);

    // Determine trend (simplified - would need historical data for real trend)
    let trend: 'improving' | 'stable' | 'declining' = 'stable';
    if (overallScore > 90) trend = 'improving';
    else if (overallScore < 70) trend = 'declining';

    return {
      overallScore,
      breakdown,
      trend,
      lastUpdated: now,
    };
  }
}

// Export singleton factory
export function getCountryDirectorDashboardService(db: Firestore): CountryDirectorDashboardService {
  return CountryDirectorDashboardService.getInstance(db);
}
