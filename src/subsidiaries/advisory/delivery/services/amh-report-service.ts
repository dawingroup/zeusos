/**
 * AMH REPORT SERVICE
 *
 * Aggregates accountability data across multiple projects to generate
 * the 8-section AMH (Accountability, Monitoring & Harmonization) report.
 * Follows singleton service pattern used by allocation-service.ts.
 */

import {
  Firestore,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  doc,
  getDoc,
  updateDoc,
  orderBy,
  Timestamp,
  limit,
} from 'firebase/firestore';
import type { ReportPeriod } from '../reports/types/report.types';
import type {
  AMHReport,
  AMHReportSections,
  AMHProjectSummary,
  AMHBudgetOverview,
  AMHProjectBudget,
  AMHAccountabilitySection,
  AMHAccountabilityEntry,
  AMHVarianceAnalysis,
  AMHCategoryVariance,
  AMHProjectVariance,
  AMHReconciliationStatus,
  AMHDocumentation,
  AMHMissingDocument,
  AMHApprovals,
  AMHApprovalItem,
  AMHAuditTrail,
  AMHSectionKey,
  AMHReportStatus,
} from '../types/amh-report.types';
import { EXPENSE_CATEGORY_LABELS, type ExpenseCategory } from '../types/requisition';

// ─────────────────────────────────────────────────────────────────
// SERVICE
// ─────────────────────────────────────────────────────────────────

export class AMHReportService {
  private static instance: AMHReportService;
  private db: Firestore;

  private constructor(db: Firestore) {
    this.db = db;
  }

  static getInstance(db: Firestore): AMHReportService {
    if (!AMHReportService.instance) {
      AMHReportService.instance = new AMHReportService(db);
    }
    return AMHReportService.instance;
  }

  // ─────────────────────────────────────────────────────────────
  // MAIN AGGREGATION
  // ─────────────────────────────────────────────────────────────

  /**
   * Generate the full 8-section AMH report data (client-side preview).
   */
  async generateFullReport(
    orgId: string,
    projectIds: string[],
    period: ReportPeriod,
    _userId: string,
    enabledSections: AMHSectionKey[] = ['summary', 'budget', 'accountability', 'variance', 'reconciliation', 'documentation', 'approvals', 'auditTrail']
  ): Promise<AMHReportSections> {
    const [summaries, budget, accountability, reconciliation, documentation, approvals, auditTrail] =
      await Promise.all([
        enabledSections.includes('summary')
          ? this.getProjectSummaries(orgId, projectIds)
          : Promise.resolve([]),
        enabledSections.includes('budget')
          ? this.getBudgetOverview(orgId, projectIds)
          : Promise.resolve(this.emptyBudgetOverview()),
        enabledSections.includes('accountability')
          ? this.aggregateAccountabilityData(orgId, projectIds, period)
          : Promise.resolve(this.emptyAccountabilitySection()),
        enabledSections.includes('reconciliation')
          ? this.getReconciliationStatus(orgId, projectIds)
          : Promise.resolve(this.emptyReconciliation()),
        enabledSections.includes('documentation')
          ? this.getDocumentationStatus(orgId, projectIds, period)
          : Promise.resolve(this.emptyDocumentation()),
        enabledSections.includes('approvals')
          ? this.getApprovals(orgId, projectIds)
          : Promise.resolve(this.emptyApprovals()),
        enabledSections.includes('auditTrail')
          ? this.getAuditTrail(orgId, projectIds, period)
          : Promise.resolve(this.emptyAuditTrail()),
      ]);

    // Calculate variance from budget + accountability data
    const variance = enabledSections.includes('variance')
      ? this.calculateVariances(budget, accountability)
      : this.emptyVarianceAnalysis();

    return {
      summary: summaries,
      budget,
      accountability,
      variance,
      reconciliation,
      documentation,
      approvals,
      auditTrail,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION 1: PROJECT SUMMARIES
  // ─────────────────────────────────────────────────────────────

  private async getProjectSummaries(
    orgId: string,
    projectIds: string[]
  ): Promise<AMHProjectSummary[]> {
    const summaries: AMHProjectSummary[] = [];

    for (const projectId of projectIds) {
      try {
        const projectDoc = await getDoc(
          doc(this.db, `organizations/${orgId}/advisory_projects`, projectId)
        );
        if (projectDoc.exists()) {
          const data = projectDoc.data();
          summaries.push({
            projectId,
            projectName: data.name || '',
            projectCode: data.code || '',
            programName: data.programName || '',
            status: data.status || 'unknown',
            startDate: data.startDate?.toDate?.()?.toISOString?.()?.split('T')[0] || null,
            endDate: data.endDate?.toDate?.()?.toISOString?.()?.split('T')[0] || null,
            projectManager: data.projectManager || '',
            location: data.location || null,
            donor: data.donor || null,
            description: data.description || null,
          });
        }
      } catch (err) {
        console.error(`Failed to load project ${projectId}:`, err);
      }
    }

    return summaries;
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION 2: BUDGET OVERVIEW
  // ─────────────────────────────────────────────────────────────

  private async getBudgetOverview(
    orgId: string,
    projectIds: string[]
  ): Promise<AMHBudgetOverview> {
    const projectBudgets: AMHProjectBudget[] = [];

    for (const projectId of projectIds) {
      try {
        const projectDoc = await getDoc(
          doc(this.db, `organizations/${orgId}/advisory_projects`, projectId)
        );
        if (projectDoc.exists()) {
          const data = projectDoc.data();
          const budget = data.budget || {};
          const totalBudget = budget.totalBudget || 0;
          const spent = budget.totalSpent || 0;
          const committed = budget.totalCommitted || 0;

          projectBudgets.push({
            projectId,
            projectName: data.name || '',
            totalBudget,
            spent,
            committed,
            remaining: totalBudget - spent - committed,
            utilizationPercent: totalBudget > 0 ? ((spent + committed) / totalBudget) * 100 : 0,
            currency: data.currency || 'UGX',
          });
        }
      } catch (err) {
        console.error(`Failed to load budget for ${projectId}:`, err);
      }
    }

    const consolidated = {
      totalBudget: projectBudgets.reduce((s, p) => s + p.totalBudget, 0),
      totalSpent: projectBudgets.reduce((s, p) => s + p.spent, 0),
      totalCommitted: projectBudgets.reduce((s, p) => s + p.committed, 0),
      totalRemaining: projectBudgets.reduce((s, p) => s + p.remaining, 0),
      overallUtilization: 0,
    };
    consolidated.overallUtilization = consolidated.totalBudget > 0
      ? ((consolidated.totalSpent + consolidated.totalCommitted) / consolidated.totalBudget) * 100
      : 0;

    return {
      projectBudgets,
      consolidated,
      currency: projectBudgets[0]?.currency || 'UGX',
    };
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION 3: ACCOUNTABILITY ENTRIES
  // ─────────────────────────────────────────────────────────────

  async aggregateAccountabilityData(
    orgId: string,
    projectIds: string[],
    period: ReportPeriod
  ): Promise<AMHAccountabilitySection> {
    const entries: AMHAccountabilityEntry[] = [];
    let totalAccountedFor = 0;
    let pendingAmount = 0;

    const startTs = Timestamp.fromDate(period.startDate);
    const endTs = Timestamp.fromDate(period.endDate);

    for (const projectId of projectIds) {
      try {
        const q = query(
          collection(this.db, 'payments'),
          where('projectId', '==', projectId),
          where('paymentType', '==', 'accountability'),
          where('createdAt', '>=', startTs),
          where('createdAt', '<=', endTs),
          orderBy('createdAt', 'desc')
        );

        const snapshot = await getDocs(q);
        const projectDoc = await getDoc(
          doc(this.db, `organizations/${orgId}/advisory_projects`, projectId)
        );
        const projectName = projectDoc.exists() ? projectDoc.data().name : projectId;

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const expenses = data.expenses || [];

          for (const expense of expenses) {
            const amount = expense.amount || 0;
            totalAccountedFor += amount;

            if (data.status === 'pending_review') {
              pendingAmount += amount;
            }

            entries.push({
              id: `${docSnap.id}-${expense.id || entries.length}`,
              date: expense.date?.toDate?.()?.toISOString?.()?.split('T')[0] || data.createdAt?.toDate?.()?.toISOString?.()?.split('T')[0] || '',
              description: expense.description || '',
              amount,
              category: expense.category || 'contingency',
              vendor: expense.vendor || data.vendorName || null,
              projectName,
              receiptRef: expense.receiptNumber || null,
              requisitionRef: data.requisitionNumber || null,
              proofOfSpendStatus: expense.proofOfSpend?.isComplete ? 'complete'
                : expense.proofOfSpend ? 'partial' : 'missing',
              varianceStatus: data.variance?.varianceStatus || null,
            });
          }
        });
      } catch (err) {
        console.error(`Failed to load accountability for project ${projectId}:`, err);
      }
    }

    return {
      entries,
      summary: {
        totalAccountedFor,
        pendingAccountability: pendingAmount,
        unaccountedAmount: 0, // Calculated at reconciliation level
        entryCount: entries.length,
      },
    };
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION 4: VARIANCE ANALYSIS
  // ─────────────────────────────────────────────────────────────

  private calculateVariances(
    budget: AMHBudgetOverview,
    accountability: AMHAccountabilitySection
  ): AMHVarianceAnalysis {
    // By category
    const categoryTotals = new Map<ExpenseCategory, number>();
    for (const entry of accountability.entries) {
      const current = categoryTotals.get(entry.category) || 0;
      categoryTotals.set(entry.category, current + entry.amount);
    }

    const byCategory: AMHCategoryVariance[] = [];
    for (const [category, actual] of categoryTotals.entries()) {
      // Use consolidated budget for now (could be per-category if available)
      const budgeted = 0; // Per-category budget not always available
      const variance = actual - budgeted;
      const variancePercent = budgeted > 0 ? (variance / budgeted) * 100 : 0;

      byCategory.push({
        category,
        categoryLabel: EXPENSE_CATEGORY_LABELS[category] || category,
        budgeted,
        actual,
        variance,
        variancePercent,
        status: Math.abs(variancePercent) < 2 ? 'compliant'
          : Math.abs(variancePercent) < 5 ? 'minor'
          : Math.abs(variancePercent) < 10 ? 'moderate'
          : 'severe',
      });
    }

    // By project
    const byProject: AMHProjectVariance[] = budget.projectBudgets.map((pb) => {
      const projectEntries = accountability.entries.filter(
        (e) => e.projectName === pb.projectName
      );
      const actual = projectEntries.reduce((s, e) => s + e.amount, 0);
      const variance = actual - pb.totalBudget;

      return {
        projectId: pb.projectId,
        projectName: pb.projectName,
        budgeted: pb.totalBudget,
        actual,
        variance,
        variancePercent: pb.totalBudget > 0 ? (variance / pb.totalBudget) * 100 : 0,
      };
    });

    const overallVariance = budget.consolidated.totalSpent - budget.consolidated.totalBudget;

    return {
      byCategory,
      byProject,
      overallVariance,
      overallVariancePercent: budget.consolidated.totalBudget > 0
        ? (overallVariance / budget.consolidated.totalBudget) * 100
        : 0,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION 5: RECONCILIATION STATUS
  // ─────────────────────────────────────────────────────────────

  async getReconciliationStatus(
    _orgId: string,
    projectIds: string[]
  ): Promise<AMHReconciliationStatus> {
    let totalAdvances = 0;
    let totalAccountedFor = 0;
    let reconciledEntries = 0;
    let pendingEntries = 0;
    let matchedToRequisitions = 0;
    let unmatchedEntries = 0;
    let overduePendingCount = 0;

    const now = new Date();

    for (const projectId of projectIds) {
      try {
        // Get requisitions (advances)
        const reqQuery = query(
          collection(this.db, 'payments'),
          where('projectId', '==', projectId),
          where('paymentType', '==', 'requisition'),
          where('status', 'in', ['approved', 'disbursed'])
        );
        const reqSnap = await getDocs(reqQuery);
        reqSnap.forEach((d) => {
          totalAdvances += d.data().grossAmount || 0;
        });

        // Get accountabilities
        const accQuery = query(
          collection(this.db, 'payments'),
          where('projectId', '==', projectId),
          where('paymentType', '==', 'accountability')
        );
        const accSnap = await getDocs(accQuery);
        accSnap.forEach((d) => {
          const data = d.data();
          totalAccountedFor += data.totalExpenses || 0;

          if (data.reconciliationStatus === 'completed') {
            reconciledEntries++;
          } else {
            pendingEntries++;
            if (data.reconciliationDeadline?.toDate?.() < now) {
              overduePendingCount++;
            }
          }

          if (data.requisitionId) {
            matchedToRequisitions++;
          } else {
            unmatchedEntries++;
          }
        });
      } catch (err) {
        console.error(`Reconciliation query failed for project ${projectId}:`, err);
      }
    }

    return {
      totalAdvances,
      totalAccountedFor,
      outstandingBalance: totalAdvances - totalAccountedFor,
      reconciledEntries,
      pendingEntries,
      matchedToRequisitions,
      unmatchedEntries,
      overduePendingCount,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION 6: DOCUMENTATION STATUS
  // ─────────────────────────────────────────────────────────────

  async getDocumentationStatus(
    orgId: string,
    projectIds: string[],
    period: ReportPeriod
  ): Promise<AMHDocumentation> {
    let totalExpenses = 0;
    let expensesWithReceipts = 0;
    let expensesWithEFRIS = 0;
    const missingDocuments: AMHMissingDocument[] = [];

    const startTs = Timestamp.fromDate(period.startDate);
    const endTs = Timestamp.fromDate(period.endDate);

    for (const projectId of projectIds) {
      try {
        const q = query(
          collection(this.db, 'payments'),
          where('projectId', '==', projectId),
          where('paymentType', '==', 'accountability'),
          where('createdAt', '>=', startTs),
          where('createdAt', '<=', endTs)
        );
        const snapshot = await getDocs(q);

        const projectDoc = await getDoc(
          doc(this.db, `organizations/${orgId}/advisory_projects`, projectId)
        );
        const projectName = projectDoc.exists() ? projectDoc.data().name : projectId;

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const expenses = data.expenses || [];

          for (const expense of expenses) {
            totalExpenses++;

            const proofOfSpend = expense.proofOfSpend;
            if (proofOfSpend?.providedDocuments?.length > 0) {
              expensesWithReceipts++;
            }

            // Check for EFRIS documents
            const hasEFRIS = proofOfSpend?.providedDocuments?.some?.(
              (d: any) => d.notes?.includes('EFRIS') || d.notes?.includes('FDN')
            );
            if (hasEFRIS) expensesWithEFRIS++;

            // Check for missing documents
            if (!proofOfSpend?.isComplete) {
              const missing = proofOfSpend?.requiredDocuments?.filter(
                (req: string) => !proofOfSpend.providedDocuments?.some((p: any) => p.type === req)
              ) || ['receipt'];

              missingDocuments.push({
                expenseId: expense.id || docSnap.id,
                description: expense.description || 'Unknown expense',
                amount: expense.amount || 0,
                missingDocs: missing,
                projectName,
              });
            }
          }
        });
      } catch (err) {
        console.error(`Documentation query failed for project ${projectId}:`, err);
      }
    }

    return {
      totalExpenses,
      expensesWithReceipts,
      expensesWithEFRIS,
      completenessPercent: totalExpenses > 0 ? (expensesWithReceipts / totalExpenses) * 100 : 100,
      missingDocuments,
    };
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION 7: APPROVALS
  // ─────────────────────────────────────────────────────────────

  private async getApprovals(
    orgId: string,
    projectIds: string[]
  ): Promise<AMHApprovals> {
    const pending: AMHApprovalItem[] = [];
    const approved: AMHApprovalItem[] = [];
    const rejected: AMHApprovalItem[] = [];

    for (const projectId of projectIds) {
      try {
        const q = query(
          collection(this.db, 'payments'),
          where('projectId', '==', projectId),
          where('paymentType', '==', 'accountability'),
          orderBy('createdAt', 'desc'),
          limit(50)
        );
        const snapshot = await getDocs(q);

        const projectDoc = await getDoc(
          doc(this.db, `organizations/${orgId}/advisory_projects`, projectId)
        );
        const projectName = projectDoc.exists() ? projectDoc.data().name : projectId;

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          const item: AMHApprovalItem = {
            id: docSnap.id,
            description: data.description || data.expenses?.[0]?.description || '',
            amount: data.totalExpenses || 0,
            projectName,
            requestedBy: data.submittedBy || data.createdBy || '',
            requestedAt: data.createdAt?.toDate?.()?.toISOString?.() || '',
            status: data.status === 'approved' || data.status === 'verified' ? 'approved'
              : data.status === 'rejected' ? 'rejected' : 'pending',
            approvedBy: data.verifiedBy,
            approvedAt: data.verifiedAt?.toDate?.()?.toISOString?.(),
            rejectionReason: data.rejectionReason,
          };

          if (item.status === 'pending') pending.push(item);
          else if (item.status === 'approved') approved.push(item);
          else rejected.push(item);
        });
      } catch (err) {
        console.error(`Approvals query failed for project ${projectId}:`, err);
      }
    }

    return { pendingApprovals: pending, approvedItems: approved, rejectedItems: rejected };
  }

  // ─────────────────────────────────────────────────────────────
  // SECTION 8: AUDIT TRAIL
  // ─────────────────────────────────────────────────────────────

  private async getAuditTrail(
    _orgId: string,
    projectIds: string[],
    period: ReportPeriod
  ): Promise<AMHAuditTrail> {
    // For now, pull from accountability submission events
    const events: AMHAuditTrail['events'] = [];

    const startTs = Timestamp.fromDate(period.startDate);
    const endTs = Timestamp.fromDate(period.endDate);

    for (const projectId of projectIds) {
      try {
        const q = query(
          collection(this.db, 'payments'),
          where('projectId', '==', projectId),
          where('createdAt', '>=', startTs),
          where('createdAt', '<=', endTs),
          orderBy('createdAt', 'desc'),
          limit(100)
        );
        const snapshot = await getDocs(q);

        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          events.push({
            timestamp: data.createdAt?.toDate?.()?.toISOString?.() || '',
            action: `${data.paymentType} ${data.status || 'created'}`,
            user: data.createdBy || data.submittedBy || '',
            details: `${data.description || ''} - ${data.totalExpenses || data.grossAmount || 0}`,
            entityType: data.paymentType === 'requisition' ? 'requisition' : 'accountability',
            entityId: docSnap.id,
          });
        });
      } catch (err) {
        console.error(`Audit trail query failed for project ${projectId}:`, err);
      }
    }

    // Sort by timestamp descending
    events.sort((a, b) => b.timestamp.localeCompare(a.timestamp));

    return { events: events.slice(0, 200), totalEvents: events.length };
  }

  // ─────────────────────────────────────────────────────────────
  // PERSISTENCE
  // ─────────────────────────────────────────────────────────────

  async saveReport(orgId: string, report: Omit<AMHReport, 'id'>): Promise<string> {
    const docRef = await addDoc(
      collection(this.db, `organizations/${orgId}/amh_reports`),
      report
    );
    return docRef.id;
  }

  async getReport(orgId: string, reportId: string): Promise<AMHReport | null> {
    const docSnap = await getDoc(
      doc(this.db, `organizations/${orgId}/amh_reports`, reportId)
    );
    if (!docSnap.exists()) return null;
    return { id: docSnap.id, ...docSnap.data() } as AMHReport;
  }

  async listReports(orgId: string, limitCount = 20): Promise<AMHReport[]> {
    const q = query(
      collection(this.db, `organizations/${orgId}/amh_reports`),
      orderBy('generatedAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((d) => ({ id: d.id, ...d.data() } as AMHReport));
  }

  async updateReportStatus(
    orgId: string,
    reportId: string,
    status: AMHReportStatus,
    pdfUrl?: string
  ): Promise<void> {
    await updateDoc(
      doc(this.db, `organizations/${orgId}/amh_reports`, reportId),
      {
        status,
        ...(pdfUrl ? { pdfUrl } : {}),
      }
    );
  }

  // ─────────────────────────────────────────────────────────────
  // EMPTY DEFAULTS
  // ─────────────────────────────────────────────────────────────

  private emptyBudgetOverview(): AMHBudgetOverview {
    return {
      projectBudgets: [],
      consolidated: { totalBudget: 0, totalSpent: 0, totalCommitted: 0, totalRemaining: 0, overallUtilization: 0 },
      currency: 'UGX',
    };
  }

  private emptyAccountabilitySection(): AMHAccountabilitySection {
    return { entries: [], summary: { totalAccountedFor: 0, pendingAccountability: 0, unaccountedAmount: 0, entryCount: 0 } };
  }

  private emptyVarianceAnalysis(): AMHVarianceAnalysis {
    return { byCategory: [], byProject: [], overallVariance: 0, overallVariancePercent: 0 };
  }

  private emptyReconciliation(): AMHReconciliationStatus {
    return { totalAdvances: 0, totalAccountedFor: 0, outstandingBalance: 0, reconciledEntries: 0, pendingEntries: 0, matchedToRequisitions: 0, unmatchedEntries: 0, overduePendingCount: 0 };
  }

  private emptyDocumentation(): AMHDocumentation {
    return { totalExpenses: 0, expensesWithReceipts: 0, expensesWithEFRIS: 0, completenessPercent: 100, missingDocuments: [] };
  }

  private emptyApprovals(): AMHApprovals {
    return { pendingApprovals: [], approvedItems: [], rejectedItems: [] };
  }

  private emptyAuditTrail(): AMHAuditTrail {
    return { events: [], totalEvents: 0 };
  }
}

/**
 * Factory function for convenience.
 */
export function createAMHReportService(db: Firestore): AMHReportService {
  return AMHReportService.getInstance(db);
}
