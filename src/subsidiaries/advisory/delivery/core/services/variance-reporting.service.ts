/**
 * VARIANCE REPORTING SERVICE (ADD-FIN-001)
 *
 * Features:
 * - BOQ variance reports (budget vs. actual)
 * - Accountability variance reports (zero-discrepancy tracking)
 * - Variance trend analysis
 * - Alert generation for threshold breaches
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
import type { ControlBOQItem, VarianceBudgetStatus } from '../../types/control-boq';
import type { Accountability, VarianceStatus } from '../../types/accountability';
// BOQControlService and EnhancedAccountabilityService available for future use:
// import { BOQControlService } from './boq-control.service';
// import { EnhancedAccountabilityService } from './enhanced-accountability.service';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface BOQVarianceReport {
  projectId: string;
  projectCode: string;
  reportDate: Date;
  periodStart: Date;
  periodEnd: Date;

  // Summary
  summary: {
    totalBOQItems: number;
    totalAllocated: number;
    totalCommitted: number;
    totalSpent: number;
    totalRemaining: number;
    overallVariance: number;
    overallVariancePercentage: number;
  };

  // Status breakdown
  statusBreakdown: {
    onBudget: number;
    alert: number;
    exceeded: number;
  };

  // Top variances
  topPositiveVariances: BOQItemVariance[]; // Under budget
  topNegativeVariances: BOQItemVariance[]; // Over budget

  // All items
  items: BOQItemVariance[];

  // Alerts
  alerts: VarianceAlert[];
}

export interface BOQItemVariance {
  boqItemId: string;
  itemCode: string;
  description: string;
  billNumber: string;
  billName: string;

  allocatedAmount: number;
  committedAmount: number;
  spentAmount: number;
  remainingBudget: number;

  varianceAmount: number;
  variancePercentage: number;
  varianceStatus: VarianceBudgetStatus;

  commitmentPercentage: number; // % of budget committed
  utilizationPercentage: number; // % of committed actually spent
}

export interface VarianceAlert {
  severity: 'high' | 'medium' | 'low';
  type: 'budget_exceeded' | 'approaching_limit' | 'zero_remaining' | 'high_variance';
  boqItemId?: string;
  accountabilityId?: string;
  itemCode?: string;
  message: string;
  amount?: number;
  percentage?: number;
  actionRequired: string;
}

export interface AccountabilityVarianceReport {
  projectId: string;
  reportDate: Date;
  periodStart: Date;
  periodEnd: Date;

  // Summary
  summary: {
    totalAccountabilities: number;
    totalRequisitioned: number;
    totalExpenses: number;
    totalUnspentReturned: number;
    totalVariance: number;
    zeroDiscrepancyRate: number; // %
  };

  // Variance status breakdown
  statusBreakdown: {
    compliant: number;
    minor: number;
    moderate: number;
    severe: number;
  };

  // Investigation status
  investigationStatus: {
    pending: number;
    inProgress: number;
    completed: number;
    overdue: number;
  };

  // Details
  accountabilities: AccountabilityVarianceDetail[];

  // Trends
  trends: VarianceTrend[];

  // Alerts
  alerts: VarianceAlert[];
}

export interface AccountabilityVarianceDetail {
  accountabilityId: string;
  accountabilityNumber: string;
  requisitionNumber: string;
  createdAt: Date;
  createdBy: string;

  requisitionAmount: number;
  totalExpenses: number;
  unspentReturned: number;
  varianceAmount: number;
  variancePercentage: number;
  varianceStatus: VarianceStatus;

  isZeroDiscrepancy: boolean;
  requiresInvestigation: boolean;
  investigationStatus?: 'pending' | 'in_progress' | 'completed' | 'escalated';
  investigationDeadline?: Date;

  proofOfSpendComplete: boolean;
}

export interface VarianceTrend {
  period: string; // "2026-01" (YYYY-MM)
  totalVariance: number;
  averageVariancePercentage: number;
  zeroDiscrepancyRate: number;
  complianceScore: number;
}

export interface CombinedVarianceReport {
  projectId: string;
  reportDate: Date;
  periodStart: Date;
  periodEnd: Date;

  boqReport: BOQVarianceReport;
  accountabilityReport: AccountabilityVarianceReport;

  // Overall metrics
  overallCompliance: {
    budgetCompliance: number; // % of BOQ items on budget
    accountabilityCompliance: number; // % zero discrepancy
    combinedScore: number; // Weighted average
    rating: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';
  };

  // Critical issues
  criticalIssues: {
    budgetExceeded: number;
    severeVariances: number;
    overdueInvestigations: number;
    totalFinancialImpact: number;
  };

  // Recommendations
  recommendations: string[];
}

// ─────────────────────────────────────────────────────────────────
// VARIANCE REPORTING SERVICE
// ─────────────────────────────────────────────────────────────────

export class VarianceReportingService {
  constructor(private db: Firestore) {
  }

  // ─────────────────────────────────────────────────────────────────
  // BOQ VARIANCE REPORTING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Generate BOQ variance report
   */
  async generateBOQVarianceReport(
    projectId: string,
    projectCode: string,
    periodStart?: Date,
    periodEnd?: Date
  ): Promise<BOQVarianceReport> {
    const reportDate = new Date();
    const start = periodStart || new Date(reportDate.getFullYear(), 0, 1); // Year start
    const end = periodEnd || reportDate;

    // Get all BOQ items for project
    const q = query(
      collection(this.db, 'control_boq'),
      where('projectId', '==', projectId)
    );
    const snapshot = await getDocs(q);
    const boqItems = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as ControlBOQItem));

    // Calculate variance for each item
    const itemVariances: BOQItemVariance[] = boqItems
      .filter((item) => item.budgetControl)
      .map((item) => {
        const bc = item.budgetControl!;
        const commitmentPercentage =
          bc.allocatedAmount > 0 ? (bc.committedAmount / bc.allocatedAmount) * 100 : 0;
        const utilizationPercentage =
          bc.committedAmount > 0 ? (bc.spentAmount / bc.committedAmount) * 100 : 0;

        return {
          boqItemId: item.id,
          itemCode: item.itemCode,
          description: item.description,
          billNumber: item.billNumber,
          billName: item.billName || '',
          allocatedAmount: bc.allocatedAmount,
          committedAmount: bc.committedAmount,
          spentAmount: bc.spentAmount,
          remainingBudget: bc.remainingBudget,
          varianceAmount: bc.varianceAmount,
          variancePercentage: bc.variancePercentage,
          varianceStatus: bc.varianceStatus,
          commitmentPercentage,
          utilizationPercentage,
        };
      });

    // Calculate summary
    const summary = {
      totalBOQItems: itemVariances.length,
      totalAllocated: itemVariances.reduce((sum, i) => sum + i.allocatedAmount, 0),
      totalCommitted: itemVariances.reduce((sum, i) => sum + i.committedAmount, 0),
      totalSpent: itemVariances.reduce((sum, i) => sum + i.spentAmount, 0),
      totalRemaining: itemVariances.reduce((sum, i) => sum + i.remainingBudget, 0),
      overallVariance: itemVariances.reduce((sum, i) => sum + i.varianceAmount, 0),
      overallVariancePercentage: 0,
    };
    summary.overallVariancePercentage =
      summary.totalCommitted > 0
        ? (summary.overallVariance / summary.totalCommitted) * 100
        : 0;

    // Status breakdown
    const statusBreakdown = {
      onBudget: itemVariances.filter((i) => i.varianceStatus === 'on_budget').length,
      alert: itemVariances.filter((i) => i.varianceStatus === 'alert').length,
      exceeded: itemVariances.filter((i) => i.varianceStatus === 'exceeded').length,
    };

    // Top variances
    const sortedByVariance = [...itemVariances].sort(
      (a, b) => a.varianceAmount - b.varianceAmount
    );
    const topPositiveVariances = sortedByVariance.slice(0, 10); // Most under budget
    const topNegativeVariances = sortedByVariance.slice(-10).reverse(); // Most over budget

    // Generate alerts
    const alerts: VarianceAlert[] = [];
    itemVariances.forEach((item) => {
      if (item.varianceStatus === 'exceeded') {
        alerts.push({
          severity: 'high',
          type: 'budget_exceeded',
          boqItemId: item.boqItemId,
          itemCode: item.itemCode,
          message: `${item.itemCode}: Budget exceeded by ${Math.abs(item.variancePercentage).toFixed(1)}%`,
          amount: Math.abs(item.varianceAmount),
          percentage: Math.abs(item.variancePercentage),
          actionRequired: 'Investigate overspending and implement corrective measures',
        });
      } else if (item.varianceStatus === 'alert') {
        alerts.push({
          severity: 'medium',
          type: 'approaching_limit',
          boqItemId: item.boqItemId,
          itemCode: item.itemCode,
          message: `${item.itemCode}: ${item.commitmentPercentage.toFixed(1)}% of budget committed`,
          percentage: item.commitmentPercentage,
          actionRequired: 'Monitor closely to prevent budget overrun',
        });
      }

      if (item.remainingBudget <= 0) {
        alerts.push({
          severity: 'high',
          type: 'zero_remaining',
          boqItemId: item.boqItemId,
          itemCode: item.itemCode,
          message: `${item.itemCode}: No remaining budget`,
          actionRequired: 'No further requisitions can be approved for this item',
        });
      }
    });

    // Sort alerts by severity
    alerts.sort((a, b) => {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    });

    return {
      projectId,
      projectCode,
      reportDate,
      periodStart: start,
      periodEnd: end,
      summary,
      statusBreakdown,
      topPositiveVariances,
      topNegativeVariances,
      items: itemVariances,
      alerts,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // ACCOUNTABILITY VARIANCE REPORTING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Generate accountability variance report
   */
  async generateAccountabilityVarianceReport(
    projectId: string,
    periodStart?: Date,
    periodEnd?: Date
  ): Promise<AccountabilityVarianceReport> {
    const reportDate = new Date();
    const start = periodStart || new Date(reportDate.getFullYear(), 0, 1);
    const end = periodEnd || reportDate;

    // Get all accountabilities for project in period
    const q = query(
      collection(this.db, 'payments'),
      where('projectId', '==', projectId),
      where('paymentType', '==', 'accountability'),
      orderBy('createdAt', 'desc')
    );
    const snapshot = await getDocs(q);
    const allAccountabilities = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Accountability));

    // Filter by period
    const accountabilities = allAccountabilities.filter((acc) => {
      const createdAt = acc.createdAt.toDate();
      return createdAt >= start && createdAt <= end;
    });

    // Calculate summary
    const summary = {
      totalAccountabilities: accountabilities.length,
      totalRequisitioned: accountabilities.reduce(
        (sum, a) => sum + a.requisitionAmount,
        0
      ),
      totalExpenses: accountabilities.reduce((sum, a) => sum + a.totalExpenses, 0),
      totalUnspentReturned: accountabilities.reduce(
        (sum, a) => sum + a.unspentReturned,
        0
      ),
      totalVariance: accountabilities.reduce(
        (sum, a) => sum + a.variance.varianceAmount,
        0
      ),
      zeroDiscrepancyRate: 0,
    };
    summary.zeroDiscrepancyRate =
      accountabilities.length > 0
        ? (accountabilities.filter((a) => a.isZeroDiscrepancy).length /
            accountabilities.length) *
          100
        : 0;

    // Status breakdown
    const statusBreakdown = {
      compliant: accountabilities.filter((a) => a.variance.varianceStatus === 'compliant')
        .length,
      minor: accountabilities.filter((a) => a.variance.varianceStatus === 'minor').length,
      moderate: accountabilities.filter(
        (a) => a.variance.varianceStatus === 'moderate'
      ).length,
      severe: accountabilities.filter((a) => a.variance.varianceStatus === 'severe')
        .length,
    };

    // Investigation status
    const investigationStatus = {
      pending: accountabilities.filter(
        (a) => a.variance.investigationStatus === 'pending'
      ).length,
      inProgress: accountabilities.filter(
        (a) => a.variance.investigationStatus === 'in_progress'
      ).length,
      completed: accountabilities.filter(
        (a) => a.variance.investigationStatus === 'completed'
      ).length,
      overdue: accountabilities.filter((a) => {
        if (!a.variance.investigationDeadline) return false;
        return new Date(a.variance.investigationDeadline) < new Date();
      }).length,
    };

    // Details
    const accountabilityDetails: AccountabilityVarianceDetail[] = accountabilities.map(
      (acc) => ({
        accountabilityId: acc.id,
        accountabilityNumber: acc.paymentNumber,
        requisitionNumber: acc.requisitionNumber,
        createdAt: acc.createdAt.toDate(),
        createdBy: acc.createdBy,
        requisitionAmount: acc.requisitionAmount,
        totalExpenses: acc.totalExpenses,
        unspentReturned: acc.unspentReturned,
        varianceAmount: acc.variance.varianceAmount,
        variancePercentage: acc.variance.variancePercentage,
        varianceStatus: acc.variance.varianceStatus,
        isZeroDiscrepancy: acc.isZeroDiscrepancy,
        requiresInvestigation: acc.requiresInvestigation,
        investigationStatus: acc.variance.investigationStatus,
        investigationDeadline: acc.variance.investigationDeadline,
        proofOfSpendComplete: acc.expenses.every(
          (e) => e.proofOfSpend?.isComplete || false
        ),
      })
    );

    // Calculate trends (monthly)
    const trends = this.calculateVarianceTrends(accountabilities);

    // Generate alerts
    const alerts: VarianceAlert[] = [];
    accountabilities.forEach((acc) => {
      if (acc.variance.varianceStatus === 'severe') {
        alerts.push({
          severity: 'high',
          type: 'high_variance',
          accountabilityId: acc.id,
          message: `${acc.paymentNumber}: Severe variance of ${acc.variance.variancePercentage.toFixed(2)}%`,
          amount: Math.abs(acc.variance.varianceAmount),
          percentage: acc.variance.variancePercentage,
          actionRequired:
            'Personal liability assigned. Investigation required within 48 hours.',
        });
      } else if (acc.variance.varianceStatus === 'moderate') {
        alerts.push({
          severity: 'medium',
          type: 'high_variance',
          accountabilityId: acc.id,
          message: `${acc.paymentNumber}: Moderate variance of ${acc.variance.variancePercentage.toFixed(2)}%`,
          amount: Math.abs(acc.variance.varianceAmount),
          percentage: acc.variance.variancePercentage,
          actionRequired: 'Investigation required within 48 hours.',
        });
      }
    });

    return {
      projectId,
      reportDate,
      periodStart: start,
      periodEnd: end,
      summary,
      statusBreakdown,
      investigationStatus,
      accountabilities: accountabilityDetails,
      trends,
      alerts,
    };
  }

  /**
   * Calculate variance trends over time
   */
  private calculateVarianceTrends(accountabilities: Accountability[]): VarianceTrend[] {
    const monthlyData = new Map<string, Accountability[]>();

    accountabilities.forEach((acc) => {
      const month = acc.createdAt.toDate().toISOString().substring(0, 7); // YYYY-MM
      if (!monthlyData.has(month)) {
        monthlyData.set(month, []);
      }
      monthlyData.get(month)!.push(acc);
    });

    const trends: VarianceTrend[] = [];
    monthlyData.forEach((accs, month) => {
      const totalVariance = accs.reduce(
        (sum, a) => sum + Math.abs(a.variance.varianceAmount),
        0
      );
      const averageVariancePercentage =
        accs.reduce((sum, a) => sum + Math.abs(a.variance.variancePercentage), 0) /
        accs.length;
      const zeroDiscrepancyRate =
        (accs.filter((a) => a.isZeroDiscrepancy).length / accs.length) * 100;

      // Compliance score (simplified)
      const complianceScore = Math.max(
        0,
        100 - averageVariancePercentage * 10 - (100 - zeroDiscrepancyRate)
      );

      trends.push({
        period: month,
        totalVariance,
        averageVariancePercentage,
        zeroDiscrepancyRate,
        complianceScore,
      });
    });

    return trends.sort((a, b) => a.period.localeCompare(b.period));
  }

  // ─────────────────────────────────────────────────────────────────
  // COMBINED REPORTING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Generate combined variance report (BOQ + Accountability)
   */
  async generateCombinedVarianceReport(
    projectId: string,
    projectCode: string,
    periodStart?: Date,
    periodEnd?: Date
  ): Promise<CombinedVarianceReport> {
    const [boqReport, accountabilityReport] = await Promise.all([
      this.generateBOQVarianceReport(projectId, projectCode, periodStart, periodEnd),
      this.generateAccountabilityVarianceReport(projectId, periodStart, periodEnd),
    ]);

    // Calculate overall compliance
    const budgetCompliance =
      boqReport.statusBreakdown.onBudget / boqReport.summary.totalBOQItems * 100;
    const accountabilityCompliance = accountabilityReport.summary.zeroDiscrepancyRate;
    const combinedScore = (budgetCompliance * 0.6 + accountabilityCompliance * 0.4); // Weighted

    let rating: CombinedVarianceReport['overallCompliance']['rating'];
    if (combinedScore >= 90) rating = 'excellent';
    else if (combinedScore >= 75) rating = 'good';
    else if (combinedScore >= 60) rating = 'fair';
    else if (combinedScore >= 40) rating = 'poor';
    else rating = 'critical';

    // Critical issues
    const criticalIssues = {
      budgetExceeded: boqReport.statusBreakdown.exceeded,
      severeVariances: accountabilityReport.statusBreakdown.severe,
      overdueInvestigations: accountabilityReport.investigationStatus.overdue,
      totalFinancialImpact:
        Math.abs(boqReport.summary.overallVariance) +
        Math.abs(accountabilityReport.summary.totalVariance),
    };

    // Generate recommendations
    const recommendations: string[] = [];
    if (boqReport.statusBreakdown.exceeded > 0) {
      recommendations.push(
        `Review ${boqReport.statusBreakdown.exceeded} BOQ items that have exceeded budget. Implement cost control measures.`
      );
    }
    if (accountabilityReport.statusBreakdown.severe > 0) {
      recommendations.push(
        `Address ${accountabilityReport.statusBreakdown.severe} severe accountability variances immediately. Personal liability has been assigned.`
      );
    }
    if (accountabilityReport.investigationStatus.overdue > 0) {
      recommendations.push(
        `Complete ${accountabilityReport.investigationStatus.overdue} overdue variance investigations. Escalate if necessary.`
      );
    }
    if (accountabilityReport.summary.zeroDiscrepancyRate < 95) {
      recommendations.push(
        `Zero-discrepancy rate is ${accountabilityReport.summary.zeroDiscrepancyRate.toFixed(1)}%. Strengthen proof of spend requirements.`
      );
    }
    if (boqReport.statusBreakdown.alert > 0) {
      recommendations.push(
        `Monitor ${boqReport.statusBreakdown.alert} BOQ items approaching budget limits to prevent overruns.`
      );
    }

    return {
      projectId,
      reportDate: new Date(),
      periodStart: boqReport.periodStart,
      periodEnd: boqReport.periodEnd,
      boqReport,
      accountabilityReport,
      overallCompliance: {
        budgetCompliance,
        accountabilityCompliance,
        combinedScore,
        rating,
      },
      criticalIssues,
      recommendations,
    };
  }

  // ─────────────────────────────────────────────────────────────────
  // EXPORT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Export report to JSON (can be used for PDF/Excel generation)
   */
  exportToJSON(report: CombinedVarianceReport): string {
    return JSON.stringify(report, null, 2);
  }

  /**
   * Generate executive summary
   */
  generateExecutiveSummary(report: CombinedVarianceReport): string {
    const lines: string[] = [];
    lines.push(`VARIANCE REPORT - ${report.projectId}`);
    lines.push(`Report Date: ${report.reportDate.toDateString()}`);
    lines.push(`Period: ${report.periodStart.toDateString()} - ${report.periodEnd.toDateString()}`);
    lines.push('');
    lines.push(`Overall Compliance Score: ${report.overallCompliance.combinedScore.toFixed(1)}% (${report.overallCompliance.rating.toUpperCase()})`);
    lines.push('');
    lines.push('BOQ SUMMARY:');
    lines.push(`  Total Allocated: ${report.boqReport.summary.totalAllocated.toLocaleString()}`);
    lines.push(`  Total Committed: ${report.boqReport.summary.totalCommitted.toLocaleString()}`);
    lines.push(`  Total Spent: ${report.boqReport.summary.totalSpent.toLocaleString()}`);
    lines.push(`  Variance: ${report.boqReport.summary.overallVariance.toLocaleString()} (${report.boqReport.summary.overallVariancePercentage.toFixed(2)}%)`);
    lines.push('');
    lines.push('ACCOUNTABILITY SUMMARY:');
    lines.push(`  Total Accountabilities: ${report.accountabilityReport.summary.totalAccountabilities}`);
    lines.push(`  Zero-Discrepancy Rate: ${report.accountabilityReport.summary.zeroDiscrepancyRate.toFixed(1)}%`);
    lines.push(`  Total Variance: ${report.accountabilityReport.summary.totalVariance.toLocaleString()}`);
    lines.push('');
    lines.push('CRITICAL ISSUES:');
    lines.push(`  Budget Exceeded: ${report.criticalIssues.budgetExceeded} items`);
    lines.push(`  Severe Variances: ${report.criticalIssues.severeVariances}`);
    lines.push(`  Overdue Investigations: ${report.criticalIssues.overdueInvestigations}`);
    lines.push(`  Total Financial Impact: ${report.criticalIssues.totalFinancialImpact.toLocaleString()}`);
    lines.push('');
    lines.push('RECOMMENDATIONS:');
    report.recommendations.forEach((rec, i) => {
      lines.push(`  ${i + 1}. ${rec}`);
    });

    return lines.join('\n');
  }
}

// Export factory
export function getVarianceReportingService(db: Firestore): VarianceReportingService {
  return new VarianceReportingService(db);
}
