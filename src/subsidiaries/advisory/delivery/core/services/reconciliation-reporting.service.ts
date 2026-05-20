/**
 * RECONCILIATION REPORTING SERVICE (ADD-FIN-001)
 *
 * Features:
 * - Monthly reconciliation reports (by 5th working day)
 * - Opening balance + Funds received - Expenditure = Closing balance
 * - Outstanding commitments tracking
 * - Variance investigation tracking
 * - Export to PDF/Excel
 */

import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Firestore,
} from 'firebase/firestore';
import type { Requisition } from '../../types/requisition';
import type { Accountability } from '../../types/accountability';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface MonthlyReconciliationReport {
  projectId: string;
  projectCode: string;
  month: Date; // First day of month
  generatedAt: Date;
  generatedBy: string;
  dueDate: Date; // 5th working day

  // Cash flow
  cashFlow: {
    openingBalance: number;
    fundsReceived: number; // Requisitions paid in month
    totalExpenditure: number; // Accountabilities submitted
    closingBalance: number;
  };

  // Outstanding commitments
  outstandingCommitments: {
    approvedRequisitions: number; // Approved but not yet paid
    pendingAccountabilities: number; // Paid but not yet accounted
    totalOutstanding: number;
  };

  // Detailed transactions
  requisitions: RequisitionSummary[];
  accountabilities: AccountabilitySummary[];

  // Variance analysis
  varianceAnalysis: {
    totalVariance: number;
    byCategory: Record<string, number>;
    investigationRequired: VarianceInvestigationSummary[];
  };

  // Reconciliation status
  reconciliationStatus: {
    allReceiptsVerified: boolean;
    allProofOfSpendComplete: boolean;
    zeroDiscrepancyAchieved: boolean;
    outstandingIssues: string[];
  };

  // Compliance metrics
  compliance: {
    zeroDiscrepancyRate: number; // %
    onTimeAccountabilityRate: number; // % submitted before deadline
    proofOfSpendCompleteness: number; // %
    varianceWithinThreshold: number; // % with variance < 2%
  };
}

export interface RequisitionSummary {
  requisitionId: string;
  requisitionNumber: string;
  purpose: string;
  requestedBy: string;
  approvedDate?: Date;
  paidDate?: Date;
  amount: number;
  status: string;
  accountabilityStatus: string;
  accountabilityDueDate?: Date;
}

export interface AccountabilitySummary {
  accountabilityId: string;
  accountabilityNumber: string;
  requisitionNumber: string;
  submittedBy: string;
  submittedDate: Date;
  requisitionAmount: number;
  totalExpenses: number;
  unspentReturned: number;
  varianceAmount: number;
  variancePercentage: number;
  isZeroDiscrepancy: boolean;
  proofOfSpendComplete: boolean;
}

export interface VarianceInvestigationSummary {
  accountabilityId: string;
  accountabilityNumber: string;
  varianceAmount: number;
  variancePercentage: number;
  investigationStatus: 'pending' | 'in_progress' | 'completed' | 'escalated';
  deadline: Date;
  isOverdue: boolean;
}

export interface QuarterlyReconciliationReport {
  projectId: string;
  projectCode: string;
  quarter: string; // "2026-Q1"
  quarterStart: Date;
  quarterEnd: Date;
  generatedAt: Date;

  // Aggregate cash flow
  aggregateCashFlow: {
    openingBalance: number;
    totalFundsReceived: number;
    totalExpenditure: number;
    closingBalance: number;
  };

  // Monthly breakdown
  monthlyReports: MonthlyReconciliationReport[];

  // Quarterly metrics
  quarterlyMetrics: {
    totalRequisitions: number;
    totalAccountabilities: number;
    averageVariancePercentage: number;
    zeroDiscrepancyRate: number;
    onTimeSubmissionRate: number;
    totalVarianceAmount: number;
  };

  // Trends
  trends: {
    month: string;
    fundsReceived: number;
    expenditure: number;
    variance: number;
    zeroDiscrepancyRate: number;
  }[];

  // Issues and recommendations
  outstandingIssues: string[];
  recommendations: string[];
}

export interface AnnualReconciliationSummary {
  projectId: string;
  projectCode: string;
  year: number;
  generatedAt: Date;

  // Annual cash flow
  annualCashFlow: {
    openingBalance: number;
    totalFundsReceived: number;
    totalExpenditure: number;
    closingBalance: number;
  };

  // Quarterly breakdown
  quarterlyReports: QuarterlyReconciliationReport[];

  // Annual metrics
  annualMetrics: {
    totalRequisitions: number;
    totalAccountabilities: number;
    averageMonthlyExpenditure: number;
    largestMonthlyExpenditure: number;
    smallestMonthlyExpenditure: number;
    averageZeroDiscrepancyRate: number;
    totalVarianceAmount: number;
    complianceScore: number;
  };

  // Year-over-year comparison
  yearOverYear?: {
    previousYear: number;
    previousYearExpenditure: number;
    changePercentage: number;
    trend: 'increasing' | 'stable' | 'decreasing';
  };
}

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────

const PAYMENTS_COLLECTION = 'payments';

// ─────────────────────────────────────────────────────────────────
// RECONCILIATION REPORTING SERVICE
// ─────────────────────────────────────────────────────────────────

export class ReconciliationReportingService {
  constructor(private db: Firestore) {}

  // ─────────────────────────────────────────────────────────────────
  // MONTHLY RECONCILIATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Generate monthly reconciliation report
   */
  async generateMonthlyReconciliationReport(
    projectId: string,
    projectCode: string,
    month: Date, // First day of month
    userId: string,
    openingBalance: number = 0
  ): Promise<MonthlyReconciliationReport> {
    const monthStart = new Date(month.getFullYear(), month.getMonth(), 1);
    const monthEnd = new Date(month.getFullYear(), month.getMonth() + 1, 0, 23, 59, 59);
    const generatedAt = new Date();
    const dueDate = this.calculate5thWorkingDay(monthStart);

    // Get requisitions paid in month
    const requisitionsQuery = query(
      collection(this.db, PAYMENTS_COLLECTION),
      where('projectId', '==', projectId),
      where('paymentType', '==', 'requisition'),
      orderBy('createdAt', 'desc')
    );
    const requisitionsSnapshot = await getDocs(requisitionsQuery);
    const allRequisitions = requisitionsSnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Requisition)
    );

    // Filter paid requisitions in month
    const paidRequisitions = allRequisitions.filter((req) => {
      if (!req.updatedAt || req.status !== 'paid') return false;
      const paidDate = req.updatedAt.toDate();
      return paidDate >= monthStart && paidDate <= monthEnd;
    });

    const fundsReceived = paidRequisitions.reduce((sum, r) => sum + r.grossAmount, 0);

    // Get accountabilities submitted in month
    const accountabilitiesQuery = query(
      collection(this.db, PAYMENTS_COLLECTION),
      where('projectId', '==', projectId),
      where('paymentType', '==', 'accountability'),
      orderBy('createdAt', 'desc')
    );
    const accountabilitiesSnapshot = await getDocs(accountabilitiesQuery);
    const allAccountabilities = accountabilitiesSnapshot.docs.map(
      (doc) => ({ id: doc.id, ...doc.data() } as Accountability)
    );

    // Filter accountabilities submitted in month
    const monthAccountabilities = allAccountabilities.filter((acc) => {
      const submittedDate = acc.createdAt.toDate();
      return submittedDate >= monthStart && submittedDate <= monthEnd;
    });

    const totalExpenditure = monthAccountabilities.reduce(
      (sum, a) => sum + a.totalExpenses,
      0
    );

    // Calculate closing balance
    const closingBalance = openingBalance + fundsReceived - totalExpenditure;

    // Outstanding commitments
    const approvedNotPaid = allRequisitions.filter(
      (r) => r.status === 'approved'
    );
    const paidNotAccounted = allRequisitions.filter(
      (r) =>
        r.status as string === 'paid' &&
        r.accountabilityStatus !== 'complete' &&
        r.accountabilityStatus !== 'overdue'
    );

    const outstandingCommitments = {
      approvedRequisitions: approvedNotPaid.reduce((sum, r) => sum + r.grossAmount, 0),
      pendingAccountabilities: paidNotAccounted.reduce(
        (sum, r) => sum + r.unaccountedAmount,
        0
      ),
      totalOutstanding: 0,
    };
    outstandingCommitments.totalOutstanding =
      outstandingCommitments.approvedRequisitions +
      outstandingCommitments.pendingAccountabilities;

    // Requisition summaries
    const requisitions: RequisitionSummary[] = paidRequisitions.map((req) => ({
      requisitionId: req.id,
      requisitionNumber: req.requisitionNumber,
      purpose: req.purpose,
      requestedBy: req.createdBy,
      approvedDate: req.updatedAt?.toDate(),
      paidDate: req.updatedAt?.toDate(),
      amount: req.grossAmount,
      status: req.status,
      accountabilityStatus: req.accountabilityStatus,
      accountabilityDueDate: req.accountabilityDueDate
        ? new Date(req.accountabilityDueDate)
        : undefined,
    }));

    // Accountability summaries
    const accountabilities: AccountabilitySummary[] = monthAccountabilities.map((acc) => ({
      accountabilityId: acc.id,
      accountabilityNumber: acc.paymentNumber,
      requisitionNumber: acc.requisitionNumber,
      submittedBy: acc.createdBy,
      submittedDate: acc.createdAt.toDate(),
      requisitionAmount: acc.requisitionAmount,
      totalExpenses: acc.totalExpenses,
      unspentReturned: acc.unspentReturned,
      varianceAmount: acc.variance.varianceAmount,
      variancePercentage: acc.variance.variancePercentage,
      isZeroDiscrepancy: acc.isZeroDiscrepancy,
      proofOfSpendComplete: acc.expenses.every(
        (e) => e.proofOfSpend?.isComplete || false
      ),
    }));

    // Variance analysis
    const varianceByCategory: Record<string, number> = {};
    monthAccountabilities.forEach((acc) => {
      acc.expenses.forEach((exp) => {
        const variance = exp.variance || 0;
        if (!varianceByCategory[exp.category]) {
          varianceByCategory[exp.category] = 0;
        }
        varianceByCategory[exp.category] += variance;
      });
    });

    const investigationRequired: VarianceInvestigationSummary[] = monthAccountabilities
      .filter((acc) => acc.requiresInvestigation)
      .map((acc) => ({
        accountabilityId: acc.id,
        accountabilityNumber: acc.paymentNumber,
        varianceAmount: acc.variance.varianceAmount,
        variancePercentage: acc.variance.variancePercentage,
        investigationStatus: acc.variance.investigationStatus || 'pending',
        deadline: acc.variance.investigationDeadline || new Date(),
        isOverdue: acc.variance.investigationDeadline
          ? new Date(acc.variance.investigationDeadline) < new Date()
          : false,
      }));

    const totalVariance = monthAccountabilities.reduce(
      (sum, a) => sum + Math.abs(a.variance.varianceAmount),
      0
    );

    // Reconciliation status
    const allReceiptsVerified = monthAccountabilities.every((acc) =>
      acc.expenses.every((e) => e.status === 'verified')
    );
    const allProofOfSpendComplete = monthAccountabilities.every((acc) =>
      acc.expenses.every((e) => e.proofOfSpend?.isComplete || false)
    );
    const zeroDiscrepancyAchieved = monthAccountabilities.every(
      (acc) => acc.isZeroDiscrepancy
    );

    const outstandingIssues: string[] = [];
    if (!allReceiptsVerified) {
      outstandingIssues.push('Not all receipts have been verified');
    }
    if (!allProofOfSpendComplete) {
      outstandingIssues.push('Some proof of spend documentation is incomplete');
    }
    if (!zeroDiscrepancyAchieved) {
      outstandingIssues.push('Zero discrepancy not achieved for all accountabilities');
    }
    if (investigationRequired.some((inv) => inv.isOverdue)) {
      outstandingIssues.push('Some variance investigations are overdue');
    }

    // Compliance metrics
    const zeroDiscrepancyRate =
      monthAccountabilities.length > 0
        ? (monthAccountabilities.filter((a) => a.isZeroDiscrepancy).length /
            monthAccountabilities.length) *
          100
        : 100;

    const onTimeAccountabilityRate =
      paidRequisitions.length > 0
        ? (paidRequisitions.filter((r) => {
            const acc = monthAccountabilities.find(
              (a) => a.requisitionId === r.id
            );
            if (!acc || !r.accountabilityDueDate) return true;
            return acc.createdAt.toDate() <= new Date(r.accountabilityDueDate);
          }).length /
            paidRequisitions.length) *
          100
        : 100;

    const proofOfSpendCompleteness =
      monthAccountabilities.length > 0
        ? (monthAccountabilities.filter((a) =>
            a.expenses.every((e) => e.proofOfSpend?.isComplete || false)
          ).length /
            monthAccountabilities.length) *
          100
        : 100;

    const varianceWithinThreshold =
      monthAccountabilities.length > 0
        ? (monthAccountabilities.filter(
            (a) => Math.abs(a.variance.variancePercentage) < 2
          ).length /
            monthAccountabilities.length) *
          100
        : 100;

    return {
      projectId,
      projectCode,
      month: monthStart,
      generatedAt,
      generatedBy: userId,
      dueDate,
      cashFlow: {
        openingBalance,
        fundsReceived,
        totalExpenditure,
        closingBalance,
      },
      outstandingCommitments,
      requisitions,
      accountabilities,
      varianceAnalysis: {
        totalVariance,
        byCategory: varianceByCategory,
        investigationRequired,
      },
      reconciliationStatus: {
        allReceiptsVerified,
        allProofOfSpendComplete,
        zeroDiscrepancyAchieved,
        outstandingIssues,
      },
      compliance: {
        zeroDiscrepancyRate,
        onTimeAccountabilityRate,
        proofOfSpendCompleteness,
        varianceWithinThreshold,
      },
    };
  }

  /**
   * Calculate 5th working day of month (excluding weekends)
   */
  private calculate5thWorkingDay(monthStart: Date): Date {
    let workingDays = 0;
    let currentDate = new Date(monthStart);

    while (workingDays < 5) {
      // Skip weekends
      if (currentDate.getDay() !== 0 && currentDate.getDay() !== 6) {
        workingDays++;
      }
      if (workingDays < 5) {
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    return currentDate;
  }

  // ─────────────────────────────────────────────────────────────────
  // QUARTERLY RECONCILIATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Generate quarterly reconciliation report
   */
  async generateQuarterlyReconciliationReport(
    projectId: string,
    projectCode: string,
    year: number,
    quarter: number, // 1-4
    userId: string
  ): Promise<QuarterlyReconciliationReport> {
    const quarterStart = new Date(year, (quarter - 1) * 3, 1);
    const quarterEnd = new Date(year, quarter * 3, 0, 23, 59, 59);
    const quarterString = `${year}-Q${quarter}`;

    // Generate monthly reports for the quarter
    const monthlyReports: MonthlyReconciliationReport[] = [];
    let openingBalance = 0;

    for (let month = 0; month < 3; month++) {
      const monthDate = new Date(year, (quarter - 1) * 3 + month, 1);
      const monthlyReport = await this.generateMonthlyReconciliationReport(
        projectId,
        projectCode,
        monthDate,
        userId,
        openingBalance
      );
      monthlyReports.push(monthlyReport);
      openingBalance = monthlyReport.cashFlow.closingBalance;
    }

    // Aggregate cash flow
    const aggregateCashFlow = {
      openingBalance: monthlyReports[0].cashFlow.openingBalance,
      totalFundsReceived: monthlyReports.reduce(
        (sum, m) => sum + m.cashFlow.fundsReceived,
        0
      ),
      totalExpenditure: monthlyReports.reduce(
        (sum, m) => sum + m.cashFlow.totalExpenditure,
        0
      ),
      closingBalance: monthlyReports[monthlyReports.length - 1].cashFlow.closingBalance,
    };

    // Quarterly metrics
    const quarterlyMetrics = {
      totalRequisitions: monthlyReports.reduce(
        (sum, m) => sum + m.requisitions.length,
        0
      ),
      totalAccountabilities: monthlyReports.reduce(
        (sum, m) => sum + m.accountabilities.length,
        0
      ),
      averageVariancePercentage:
        monthlyReports.reduce(
          (sum, m) =>
            sum +
            (m.accountabilities.length > 0
              ? m.accountabilities.reduce(
                  (s, a) => s + Math.abs(a.variancePercentage),
                  0
                ) / m.accountabilities.length
              : 0),
          0
        ) / monthlyReports.length,
      zeroDiscrepancyRate:
        monthlyReports.reduce((sum, m) => sum + m.compliance.zeroDiscrepancyRate, 0) /
        monthlyReports.length,
      onTimeSubmissionRate:
        monthlyReports.reduce((sum, m) => sum + m.compliance.onTimeAccountabilityRate, 0) /
        monthlyReports.length,
      totalVarianceAmount: monthlyReports.reduce(
        (sum, m) => sum + m.varianceAnalysis.totalVariance,
        0
      ),
    };

    // Trends
    const trends = monthlyReports.map((m) => ({
      month: m.month.toISOString().substring(0, 7),
      fundsReceived: m.cashFlow.fundsReceived,
      expenditure: m.cashFlow.totalExpenditure,
      variance: m.varianceAnalysis.totalVariance,
      zeroDiscrepancyRate: m.compliance.zeroDiscrepancyRate,
    }));

    // Outstanding issues and recommendations
    const outstandingIssues: string[] = [];
    const recommendations: string[] = [];

    monthlyReports.forEach((m) => {
      outstandingIssues.push(...m.reconciliationStatus.outstandingIssues);
    });

    if (quarterlyMetrics.zeroDiscrepancyRate < 95) {
      recommendations.push(
        `Zero-discrepancy rate (${quarterlyMetrics.zeroDiscrepancyRate.toFixed(1)}%) is below target. Strengthen proof of spend requirements.`
      );
    }

    if (quarterlyMetrics.onTimeSubmissionRate < 90) {
      recommendations.push(
        `On-time submission rate (${quarterlyMetrics.onTimeSubmissionRate.toFixed(1)}%) needs improvement. Enforce accountability deadlines.`
      );
    }

    return {
      projectId,
      projectCode,
      quarter: quarterString,
      quarterStart,
      quarterEnd,
      generatedAt: new Date(),
      aggregateCashFlow,
      monthlyReports,
      quarterlyMetrics,
      trends,
      outstandingIssues: [...new Set(outstandingIssues)],
      recommendations,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // ANNUAL RECONCILIATION
  // ─────────────────────────────────────────────────────────────────

  /**
   * Generate annual reconciliation summary
   */
  async generateAnnualReconciliationSummary(
    projectId: string,
    projectCode: string,
    year: number,
    userId: string
  ): Promise<AnnualReconciliationSummary> {
    // Generate quarterly reports
    const quarterlyReports: QuarterlyReconciliationReport[] = [];
    for (let quarter = 1; quarter <= 4; quarter++) {
      const quarterlyReport = await this.generateQuarterlyReconciliationReport(
        projectId,
        projectCode,
        year,
        quarter,
        userId
      );
      quarterlyReports.push(quarterlyReport);
    }

    // Aggregate annual cash flow
    const annualCashFlow = {
      openingBalance: quarterlyReports[0].aggregateCashFlow.openingBalance,
      totalFundsReceived: quarterlyReports.reduce(
        (sum, q) => sum + q.aggregateCashFlow.totalFundsReceived,
        0
      ),
      totalExpenditure: quarterlyReports.reduce(
        (sum, q) => sum + q.aggregateCashFlow.totalExpenditure,
        0
      ),
      closingBalance:
        quarterlyReports[quarterlyReports.length - 1].aggregateCashFlow.closingBalance,
    };

    // Annual metrics
    const monthlyExpenditures = quarterlyReports.flatMap((q) =>
      q.monthlyReports.map((m) => m.cashFlow.totalExpenditure)
    );

    const annualMetrics = {
      totalRequisitions: quarterlyReports.reduce(
        (sum, q) => sum + q.quarterlyMetrics.totalRequisitions,
        0
      ),
      totalAccountabilities: quarterlyReports.reduce(
        (sum, q) => sum + q.quarterlyMetrics.totalAccountabilities,
        0
      ),
      averageMonthlyExpenditure:
        monthlyExpenditures.reduce((sum, e) => sum + e, 0) / monthlyExpenditures.length,
      largestMonthlyExpenditure: Math.max(...monthlyExpenditures),
      smallestMonthlyExpenditure: Math.min(...monthlyExpenditures),
      averageZeroDiscrepancyRate:
        quarterlyReports.reduce((sum, q) => sum + q.quarterlyMetrics.zeroDiscrepancyRate, 0) /
        quarterlyReports.length,
      totalVarianceAmount: quarterlyReports.reduce(
        (sum, q) => sum + q.quarterlyMetrics.totalVarianceAmount,
        0
      ),
      complianceScore: 0, // TODO: Calculate from compliance service
    };

    return {
      projectId,
      projectCode,
      year,
      generatedAt: new Date(),
      annualCashFlow,
      quarterlyReports,
      annualMetrics,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Export monthly reconciliation to text format
   */
  exportMonthlyToText(report: MonthlyReconciliationReport): string {
    const lines: string[] = [];
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push(`MONTHLY RECONCILIATION REPORT - ${report.projectCode}`);
    lines.push(`Month: ${report.month.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}`);
    lines.push(`Generated: ${report.generatedAt.toDateString()}`);
    lines.push(`Due Date: ${report.dueDate.toDateString()}`);
    lines.push('═══════════════════════════════════════════════════════════');
    lines.push('');
    lines.push('CASH FLOW STATEMENT:');
    lines.push(`  Opening Balance:      ${report.cashFlow.openingBalance.toLocaleString()}`);
    lines.push(`  Funds Received:    (+) ${report.cashFlow.fundsReceived.toLocaleString()}`);
    lines.push(`  Total Expenditure: (-) ${report.cashFlow.totalExpenditure.toLocaleString()}`);
    lines.push(`  ${'─'.repeat(50)}`);
    lines.push(`  Closing Balance:       ${report.cashFlow.closingBalance.toLocaleString()}`);
    lines.push('');
    lines.push('OUTSTANDING COMMITMENTS:');
    lines.push(`  Approved Requisitions: ${report.outstandingCommitments.approvedRequisitions.toLocaleString()}`);
    lines.push(`  Pending Accountabilities: ${report.outstandingCommitments.pendingAccountabilities.toLocaleString()}`);
    lines.push(`  Total Outstanding:     ${report.outstandingCommitments.totalOutstanding.toLocaleString()}`);
    lines.push('');
    lines.push('COMPLIANCE METRICS:');
    lines.push(`  Zero-Discrepancy Rate:     ${report.compliance.zeroDiscrepancyRate.toFixed(1)}%`);
    lines.push(`  On-Time Submission:        ${report.compliance.onTimeAccountabilityRate.toFixed(1)}%`);
    lines.push(`  Proof of Spend Complete:   ${report.compliance.proofOfSpendCompleteness.toFixed(1)}%`);
    lines.push(`  Variance Within Threshold: ${report.compliance.varianceWithinThreshold.toFixed(1)}%`);
    lines.push('');

    if (report.varianceAnalysis.investigationRequired.length > 0) {
      lines.push('VARIANCE INVESTIGATIONS REQUIRED:');
      report.varianceAnalysis.investigationRequired.forEach((inv) => {
        lines.push(
          `  ${inv.accountabilityNumber}: ${inv.varianceAmount.toLocaleString()} (${inv.variancePercentage.toFixed(2)}%) - ${inv.investigationStatus} ${inv.isOverdue ? '[OVERDUE]' : ''}`
        );
      });
      lines.push('');
    }

    if (report.reconciliationStatus.outstandingIssues.length > 0) {
      lines.push('OUTSTANDING ISSUES:');
      report.reconciliationStatus.outstandingIssues.forEach((issue, i) => {
        lines.push(`  ${i + 1}. ${issue}`);
      });
    }

    return lines.join('\n');
  }

  /**
   * Export to JSON
   */
  exportToJSON(
    report:
      | MonthlyReconciliationReport
      | QuarterlyReconciliationReport
      | AnnualReconciliationSummary
  ): string {
    return JSON.stringify(report, null, 2);
  }
}

// Export factory
export function getReconciliationReportingService(
  db: Firestore
): ReconciliationReportingService {
  return new ReconciliationReportingService(db);
}
