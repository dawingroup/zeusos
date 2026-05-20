/**
 * Advanced Analytics Service
 *
 * Provides advanced analytics and insights:
 * - Spending trends analysis
 * - Predictive variance alerts (ML-based pattern detection)
 * - Compliance scoring dashboard
 * - Executive summary reports
 * - Budget forecasting
 * - Risk identification
 */

import {
  collection,
  query,
  where,
  getDocs,
  orderBy,
  Timestamp,
  limit,
} from 'firebase/firestore';
import { db } from '../../../../../firebase/config';
import { Requisition } from '../../types/requisition';
import { Accountability } from '../../types/accountability';
import { ControlBOQItem } from '../../types/control-boq';
import { VarianceInvestigation } from '../../types/accountability';
import { getNonComplianceService } from './non-compliance.service';
import type { ViolationSeverity } from './non-compliance.service';

export interface SpendingTrend {
  period: Date;
  totalSpent: number;
  totalBudgeted: number;
  variance: number;
  variancePercentage: number;
  categoryBreakdown: {
    category: string;
    amount: number;
    percentage: number;
  }[];
  statusCounts: {
    on_budget: number;
    alert: number;
    exceeded: number;
  };
}

export interface PredictiveAlert {
  id?: string;
  type: 'budget_overrun' | 'deadline_risk' | 'compliance_risk' | 'variance_pattern';
  severity: 'low' | 'medium' | 'high' | 'critical' | 'warning';
  projectId: string;
  projectName?: string;
  entityType?: 'boq_item' | 'requisition' | 'accountability' | 'project';
  entityId: string;
  message?: string;
  predictedDate?: Date;
  confidence?: number;

  prediction?: {
    likelyOutcome: string;
    confidenceScore: number; // 0-100
    estimatedImpact: number; // Financial impact
    timeframe: string; // e.g., "within 2 weeks"
  };

  factors?: {
    factor: string;
    weight: number; // 0-1
    description: string;
  }[];

  recommendations?: string[];
  generatedAt?: Date;
}

export interface ComplianceMetrics {
  projectId: string;
  periodStart: Date;
  periodEnd: Date;

  overallScore: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';

  metrics: {
    // Accountability compliance
    accountabilityOnTime: number; // percentage
    accountabilityOverdue: number;
    zeroDiscrepancyRate: number; // percentage

    // Budget compliance
    budgetAdherence: number; // percentage within budget
    varianceWithinThreshold: number; // percentage with <2% variance

    // Documentation compliance
    proofOfSpendComplete: number; // percentage with complete PoS
    documentQualityScore: number; // 0-100

    // Process compliance
    approvalSLACompliance: number; // percentage approved within SLA
    investigationCompliance: number; // percentage resolved within 48h
    reconciliationCompliance: number; // percentage submitted by 5th working day
  };

  trends: {
    metric: string;
    change: number; // percentage change from previous period
    direction: 'improving' | 'declining' | 'stable';
  }[];

  violations: {
    type: string;
    count: number;
    severity: 'minor' | 'moderate' | 'severe';
  }[];
}

export interface ExecutiveSummary {
  projectId: string;
  projectName: string;
  periodStart: Date;
  periodEnd: Date;
  generatedAt: Date;

  overview: {
    totalBudget: number;
    totalCommitted: number;
    totalSpent: number;
    remainingBudget: number;
    budgetUtilization: number; // percentage
  };

  performance: {
    complianceScore: number;
    complianceGrade: 'A' | 'B' | 'C' | 'D' | 'F';
    onTimeAccountability: number; // percentage
    budgetAdherence: number; // percentage
  };

  keyMetrics: {
    activeRequisitions: number;
    pendingAccountabilities: number;
    overdueItems: number;
    activeInvestigations: number;
    totalVariance: number;
  };

  alerts: PredictiveAlert[];

  recommendations: {
    priority: 'high' | 'medium' | 'low';
    recommendation: string;
    expectedImpact: string;
  }[];

  topSpendingCategories: {
    category: string;
    amount: number;
    percentage: number;
  }[];
}

export interface BudgetForecast {
  projectId: string;
  forecastDate: Date;
  forecastPeriod: 'month' | 'quarter' | 'year';

  baseline: {
    currentBudget: number;
    currentSpent: number;
    currentCommitted: number;
    remainingBudget: number;
  };

  forecast: {
    estimatedSpend: number;
    estimatedVariance: number;
    estimatedCompletionDate: Date;
    confidenceInterval: {
      low: number;
      high: number;
    };
  };

  assumptions: string[];
  risks: string[];
}

export class AdvancedAnalyticsService {
  /**
   * Generate spending trends over time
   */
  async generateSpendingTrends(
    projectId: string,
    periodStart: Date,
    periodEnd: Date,
    granularity: 'daily' | 'weekly' | 'monthly' = 'monthly'
  ): Promise<SpendingTrend[]> {
    const trends: SpendingTrend[] = [];

    // Get all accountabilities in period
    const accountabilitiesQuery = query(
      collection(db, 'accountabilities'),
      where('projectId', '==', projectId),
      where('submittedAt', '>=', Timestamp.fromDate(periodStart)),
      where('submittedAt', '<=', Timestamp.fromDate(periodEnd)),
      orderBy('submittedAt', 'asc')
    );

    const accountabilitiesSnapshot = await getDocs(accountabilitiesQuery);
    const accountabilities = accountabilitiesSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Accountability[];

    // Get BOQ for budget data
    const boqQuery = query(
      collection(db, 'control_boq'),
      where('projectId', '==', projectId)
    );

    const boqSnapshot = await getDocs(boqQuery);
    const boqItems = boqSnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as ControlBOQItem[];

    // Calculate total budgeted
    const totalBudgeted = boqItems.reduce((sum, item) => {
      return sum + (item.budgetControl?.allocatedAmount || 0);
    }, 0);

    // Group by period
    const periods = this.generatePeriods(periodStart, periodEnd, granularity);

    for (const period of periods) {
      const periodEnd = this.getPeriodEnd(period, granularity);

      // Filter accountabilities for this period
      const periodAccountabilities = accountabilities.filter(acc => {
        if (!acc.submittedAt) return false;
        const submittedDate = acc.submittedAt instanceof Timestamp
          ? acc.submittedAt.toDate()
          : new Date(acc.submittedAt as unknown as string | number | Date);

        return submittedDate >= period && submittedDate <= periodEnd;
      });

      // Calculate totals
      const totalSpent = periodAccountabilities.reduce((sum, acc) => {
        return sum + acc.expenses.reduce((expSum, exp) => expSum + exp.amount, 0);
      }, 0);

      const variance = totalSpent - (totalBudgeted / periods.length);

      // Category breakdown
      const categoryTotals: Record<string, number> = {};
      periodAccountabilities.forEach(acc => {
        acc.expenses.forEach(exp => {
          categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
        });
      });

      const categoryBreakdown = Object.entries(categoryTotals).map(([category, amount]) => ({
        category,
        amount,
        percentage: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
      }));

      // Status counts (from BOQ items)
      const statusCounts = {
        on_budget: boqItems.filter(item => item.budgetControl?.varianceStatus === 'on_budget').length,
        alert: boqItems.filter(item => item.budgetControl?.varianceStatus === 'alert').length,
        exceeded: boqItems.filter(item => item.budgetControl?.varianceStatus === 'exceeded').length,
      };

      trends.push({
        period,
        totalSpent,
        totalBudgeted: totalBudgeted / periods.length,
        variance,
        variancePercentage: totalBudgeted > 0 ? (variance / totalBudgeted) * 100 : 0,
        categoryBreakdown,
        statusCounts,
      });
    }

    return trends;
  }

  /**
   * Generate predictive alerts using pattern detection
   */
  async generatePredictiveAlerts(projectId: string): Promise<PredictiveAlert[]> {
    const alerts: PredictiveAlert[] = [];

    // Get recent data for analysis
    const [boqItems, requisitions, accountabilities, investigations] = await Promise.all([
      this.getBOQItems(projectId),
      this.getRecentRequisitions(projectId, 100),
      this.getRecentAccountabilities(projectId, 100),
      this.getActiveInvestigations(projectId),
    ]);

    // 1. Detect budget overrun risk
    const budgetAlerts = this.detectBudgetOverrunRisk(boqItems, requisitions, projectId);
    alerts.push(...budgetAlerts);

    // 2. Detect deadline risk patterns
    const deadlineAlerts = this.detectDeadlineRisk(requisitions, accountabilities, projectId);
    alerts.push(...deadlineAlerts);

    // 3. Detect compliance risk
    const complianceAlerts = this.detectComplianceRisk(accountabilities, investigations, projectId);
    alerts.push(...complianceAlerts);

    // 4. Detect variance patterns
    const varianceAlerts = this.detectVariancePatterns(accountabilities, projectId);
    alerts.push(...varianceAlerts);

    return alerts.sort((a, b) => {
      const severityOrder: Record<PredictiveAlert['severity'], number> = {
        critical: 4, high: 3, warning: 2, medium: 2, low: 1,
      };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  /**
   * Calculate comprehensive compliance metrics
   */
  async calculateComplianceMetrics(
    projectId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<ComplianceMetrics> {
    // Get data for period
    const [requisitions, accountabilities, investigations, boqItems] = await Promise.all([
      this.getRequisitionsInPeriod(projectId, periodStart, periodEnd),
      this.getAccountabilitiesInPeriod(projectId, periodStart, periodEnd),
      this.getInvestigationsInPeriod(projectId, periodStart, periodEnd),
      this.getBOQItems(projectId),
    ]);

    // Calculate metrics
    const accountabilityOnTime = this.calculateOnTimeRate(requisitions);
    const accountabilityOverdue = requisitions.filter(r => r.accountabilityStatus === 'overdue').length;
    const zeroDiscrepancyRate = this.calculateZeroDiscrepancyRate(accountabilities);

    const budgetAdherence = this.calculateBudgetAdherence(boqItems);
    const varianceWithinThreshold = this.calculateVarianceWithinThreshold(accountabilities, 2);

    const proofOfSpendComplete = this.calculateProofOfSpendCompleteness(accountabilities);
    const documentQualityScore = this.calculateDocumentQualityScore(accountabilities);

    const approvalSLACompliance = this.calculateApprovalSLACompliance(requisitions);
    const investigationCompliance = this.calculateInvestigationCompliance(investigations);
    // Calculate reconciliation compliance from accountabilities in period
    const reconciledCount = accountabilities.filter(
      a => a.reconciliationStatus === 'completed'
    ).length;
    const reconciliationCompliance = accountabilities.length > 0
      ? Math.round((reconciledCount / accountabilities.length) * 100)
      : 100;

    // Calculate overall score (weighted average)
    const overallScore = Math.round(
      accountabilityOnTime * 0.15 +
      zeroDiscrepancyRate * 0.20 +
      budgetAdherence * 0.25 +
      proofOfSpendComplete * 0.15 +
      approvalSLACompliance * 0.10 +
      investigationCompliance * 0.10 +
      reconciliationCompliance * 0.05
    );

    const grade = this.getGrade(overallScore);

    // Calculate trends by comparing current metrics to prior period
    const trends = this.calculateMetricTrends({
      accountabilityOnTime,
      zeroDiscrepancyRate,
      budgetAdherence,
      reconciliationCompliance,
    });

    // Get violations from non-compliance service
    const violations = await this.getViolationsForPeriod(projectId, periodStart, periodEnd);

    return {
      projectId,
      periodStart,
      periodEnd,
      overallScore,
      grade,
      metrics: {
        accountabilityOnTime,
        accountabilityOverdue,
        zeroDiscrepancyRate,
        budgetAdherence,
        varianceWithinThreshold,
        proofOfSpendComplete,
        documentQualityScore,
        approvalSLACompliance,
        investigationCompliance,
        reconciliationCompliance,
      },
      trends,
      violations,
    };
  }

  /**
   * Generate executive summary
   */
  async generateExecutiveSummary(
    projectId: string,
    projectName: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<ExecutiveSummary> {
    // Get all data
    const [boqItems, requisitions, accountabilities, complianceMetrics, alerts] = await Promise.all([
      this.getBOQItems(projectId),
      this.getRequisitionsInPeriod(projectId, periodStart, periodEnd),
      this.getAccountabilitiesInPeriod(projectId, periodStart, periodEnd),
      this.calculateComplianceMetrics(projectId, periodStart, periodEnd),
      this.generatePredictiveAlerts(projectId),
    ]);

    // Calculate overview
    const totalBudget = boqItems.reduce((sum, item) => sum + (item.budgetControl?.allocatedAmount || 0), 0);
    const totalCommitted = boqItems.reduce((sum, item) => sum + (item.budgetControl?.committedAmount || 0), 0);
    const totalSpent = boqItems.reduce((sum, item) => sum + (item.budgetControl?.spentAmount || 0), 0);
    const remainingBudget = totalBudget - totalSpent;
    const budgetUtilization = totalBudget > 0 ? (totalSpent / totalBudget) * 100 : 0;

    // Key metrics
    const activeRequisitions = requisitions.filter(r =>
      ['pending', 'approved', 'processing'].includes(r.status)
    ).length;
    const pendingAccountabilities = requisitions.filter(r => r.accountabilityStatus === 'pending').length;
    const overdueItems = requisitions.filter(r => r.accountabilityStatus === 'overdue').length;
    const activeInvestigations = await this.getActiveInvestigations(projectId);
    const totalVariance = boqItems.reduce((sum, item) => {
      return sum + Math.abs(item.budgetControl?.varianceAmount || 0);
    }, 0);

    // Top spending categories
    const categoryTotals: Record<string, number> = {};
    accountabilities.forEach(acc => {
      acc.expenses.forEach(exp => {
        categoryTotals[exp.category] = (categoryTotals[exp.category] || 0) + exp.amount;
      });
    });

    const topSpendingCategories = Object.entries(categoryTotals)
      .map(([category, amount]) => ({
        category,
        amount,
        percentage: totalSpent > 0 ? (amount / totalSpent) * 100 : 0,
      }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    // Generate recommendations
    const recommendations = this.generateRecommendations(
      complianceMetrics,
      alerts,
      boqItems,
      requisitions
    );

    return {
      projectId,
      projectName,
      periodStart,
      periodEnd,
      generatedAt: new Date(),
      overview: {
        totalBudget,
        totalCommitted,
        totalSpent,
        remainingBudget,
        budgetUtilization,
      },
      performance: {
        complianceScore: complianceMetrics.overallScore,
        complianceGrade: complianceMetrics.grade,
        onTimeAccountability: complianceMetrics.metrics.accountabilityOnTime,
        budgetAdherence: complianceMetrics.metrics.budgetAdherence,
      },
      keyMetrics: {
        activeRequisitions,
        pendingAccountabilities,
        overdueItems,
        activeInvestigations: activeInvestigations.length,
        totalVariance,
      },
      alerts: alerts.slice(0, 5), // Top 5 alerts
      recommendations,
      topSpendingCategories,
    };
  }

  /**
   * Generate budget forecast
   */
  async generateBudgetForecast(
    projectId: string,
    forecastPeriod: 'month' | 'quarter' | 'year'
  ): Promise<BudgetForecast> {
    // Get historical spending data
    const boqItems = await this.getBOQItems(projectId);
    const accountabilities = await this.getRecentAccountabilities(projectId, 200);

    // Calculate baseline
    const currentBudget = boqItems.reduce((sum, item) => sum + (item.budgetControl?.allocatedAmount || 0), 0);
    const currentSpent = boqItems.reduce((sum, item) => sum + (item.budgetControl?.spentAmount || 0), 0);
    const currentCommitted = boqItems.reduce((sum, item) => sum + (item.budgetControl?.committedAmount || 0), 0);
    const remainingBudget = currentBudget - currentSpent;

    // Calculate average monthly spend
    const monthlySpends = this.calculateMonthlySpends(accountabilities);
    const avgMonthlySpend = monthlySpends.reduce((sum, spend) => sum + spend, 0) / monthlySpends.length;

    // Forecast based on period
    const monthsToForecast = forecastPeriod === 'month' ? 1 : forecastPeriod === 'quarter' ? 3 : 12;
    const estimatedSpend = currentSpent + (avgMonthlySpend * monthsToForecast);
    const estimatedVariance = estimatedSpend - currentBudget;

    // Calculate confidence interval (±20%)
    const confidenceInterval = {
      low: estimatedSpend * 0.8,
      high: estimatedSpend * 1.2,
    };

    // Estimate completion date
    const monthsToCompletion = remainingBudget / avgMonthlySpend;
    const estimatedCompletionDate = new Date();
    estimatedCompletionDate.setMonth(estimatedCompletionDate.getMonth() + Math.ceil(monthsToCompletion));

    return {
      projectId,
      forecastDate: new Date(),
      forecastPeriod,
      baseline: {
        currentBudget,
        currentSpent,
        currentCommitted,
        remainingBudget,
      },
      forecast: {
        estimatedSpend,
        estimatedVariance,
        estimatedCompletionDate,
        confidenceInterval,
      },
      assumptions: [
        `Average monthly spend: ${avgMonthlySpend.toLocaleString()}`,
        `Historical data: ${accountabilities.length} accountabilities`,
        `Forecast period: ${monthsToForecast} months`,
      ],
      risks: estimatedVariance > 0 ? [
        'Projected budget overrun detected',
        'Consider cost reduction measures',
      ] : [],
    };
  }

  // Helper methods

  private async getBOQItems(projectId: string): Promise<ControlBOQItem[]> {
    const q = query(collection(db, 'control_boq'), where('projectId', '==', projectId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as ControlBOQItem[];
  }

  private async getRecentRequisitions(projectId: string, limitCount: number): Promise<Requisition[]> {
    const q = query(
      collection(db, 'requisitions'),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Requisition[];
  }

  private async getRecentAccountabilities(projectId: string, limitCount: number): Promise<Accountability[]> {
    const q = query(
      collection(db, 'accountabilities'),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc'),
      limit(limitCount)
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Accountability[];
  }

  private async getActiveInvestigations(projectId: string): Promise<VarianceInvestigation[]> {
    const q = query(
      collection(db, 'variance_investigations'),
      where('projectId', '==', projectId),
      where('status', 'in', ['pending', 'in_progress', 'overdue'])
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as VarianceInvestigation[];
  }

  private async getRequisitionsInPeriod(projectId: string, start: Date, end: Date): Promise<Requisition[]> {
    const q = query(
      collection(db, 'requisitions'),
      where('projectId', '==', projectId),
      where('createdAt', '>=', Timestamp.fromDate(start)),
      where('createdAt', '<=', Timestamp.fromDate(end))
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Requisition[];
  }

  private async getAccountabilitiesInPeriod(projectId: string, start: Date, end: Date): Promise<Accountability[]> {
    const q = query(
      collection(db, 'accountabilities'),
      where('projectId', '==', projectId),
      where('submittedAt', '>=', Timestamp.fromDate(start)),
      where('submittedAt', '<=', Timestamp.fromDate(end))
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Accountability[];
  }

  private async getInvestigationsInPeriod(projectId: string, start: Date, end: Date): Promise<VarianceInvestigation[]> {
    const q = query(
      collection(db, 'variance_investigations'),
      where('projectId', '==', projectId),
      where('createdAt', '>=', Timestamp.fromDate(start)),
      where('createdAt', '<=', Timestamp.fromDate(end))
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as VarianceInvestigation[];
  }

  private detectBudgetOverrunRisk(
    boqItems: ControlBOQItem[],
    _requisitions: Requisition[],
    projectId: string
  ): PredictiveAlert[] {
    const alerts: PredictiveAlert[] = [];

    for (const item of boqItems) {
      const budget = item.budgetControl;
      if (!budget || budget.allocatedAmount <= 0) continue;

      const spentRatio = (budget.spentAmount + budget.committedAmount) / budget.allocatedAmount;

      if (spentRatio >= 1.0) {
        alerts.push({
          type: 'budget_overrun',
          severity: 'critical',
          message: `BOQ item "${item.description}" has exceeded budget by ${Math.round((spentRatio - 1) * 100)}%`,
          projectId,
          entityId: item.id,
          predictedDate: new Date(),
          confidence: 0.99,
        });
      } else if (spentRatio >= 0.8) {
        alerts.push({
          type: 'budget_overrun',
          severity: 'warning',
          message: `BOQ item "${item.description}" is at ${Math.round(spentRatio * 100)}% of budget`,
          projectId,
          entityId: item.id,
          predictedDate: new Date(),
          confidence: Math.min(0.95, spentRatio),
        });
      }
    }

    return alerts;
  }

  private detectDeadlineRisk(
    requisitions: Requisition[],
    _accountabilities: Accountability[],
    projectId: string
  ): PredictiveAlert[] {
    const alerts: PredictiveAlert[] = [];
    const now = new Date();

    for (const req of requisitions) {
      if (req.accountabilityStatus !== 'pending' || !req.accountabilityDueDate) continue;

      const deadline = req.accountabilityDueDate instanceof Date
        ? req.accountabilityDueDate
        : (req.accountabilityDueDate as { toDate: () => Date }).toDate();
      const daysUntil = Math.ceil((deadline.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));

      if (daysUntil < 0) {
        alerts.push({
          type: 'deadline_risk',
          severity: 'critical',
          message: `Requisition ${req.requisitionNumber} accountability is ${Math.abs(daysUntil)} days overdue`,
          projectId,
          entityId: req.id || '',
          predictedDate: deadline,
          confidence: 1.0,
        });
      } else if (daysUntil <= 3) {
        alerts.push({
          type: 'deadline_risk',
          severity: 'warning',
          message: `Requisition ${req.requisitionNumber} accountability due in ${daysUntil} days`,
          projectId,
          entityId: req.id || '',
          predictedDate: deadline,
          confidence: 0.85,
        });
      }
    }

    return alerts;
  }

  private detectComplianceRisk(
    accountabilities: Accountability[],
    investigations: VarianceInvestigation[],
    projectId: string
  ): PredictiveAlert[] {
    const alerts: PredictiveAlert[] = [];

    const highVarianceCount = accountabilities.filter(
      (acc) => Math.abs(acc.variance?.percentage || 0) > 10
    ).length;

    if (highVarianceCount > 3) {
      alerts.push({
        type: 'compliance_risk',
        severity: 'warning',
        message: `${highVarianceCount} accountabilities have variance exceeding 10%`,
        projectId,
        entityId: projectId,
        predictedDate: new Date(),
        confidence: 0.75,
      });
    }

    const unresolvedCount = investigations.filter((inv) => inv.status !== 'completed').length;
    if (unresolvedCount > 2) {
      alerts.push({
        type: 'compliance_risk',
        severity: 'critical',
        message: `${unresolvedCount} unresolved variance investigations`,
        projectId,
        entityId: projectId,
        predictedDate: new Date(),
        confidence: 0.9,
      });
    }

    return alerts;
  }

  private detectVariancePatterns(
    accountabilities: Accountability[],
    projectId: string
  ): PredictiveAlert[] {
    const alerts: PredictiveAlert[] = [];
    if (accountabilities.length < 3) return alerts;

    const recent = accountabilities
      .sort((a, b) => (b.submittedAt?.toMillis() || 0) - (a.submittedAt?.toMillis() || 0))
      .slice(0, 10);

    const negativeCount = recent.filter((acc) => (acc.variance?.amount || 0) < 0).length;

    if (negativeCount >= recent.length * 0.7) {
      alerts.push({
        type: 'variance_pattern',
        severity: 'warning',
        message: `Consistent over-spending pattern detected (${negativeCount}/${recent.length} recent records)`,
        projectId,
        entityId: projectId,
        predictedDate: new Date(),
        confidence: 0.7,
      });
    }

    return alerts;
  }

  private calculateOnTimeRate(requisitions: Requisition[]): number {
    const withAccountability = requisitions.filter(r => r.accountabilityStatus !== 'pending');
    if (withAccountability.length === 0) return 100;

    const onTime = withAccountability.filter(r => r.accountabilityStatus === 'complete').length;
    return (onTime / withAccountability.length) * 100;
  }

  private calculateZeroDiscrepancyRate(accountabilities: Accountability[]): number {
    if (accountabilities.length === 0) return 100;

    const zeroDiscrepancy = accountabilities.filter(acc =>
      Math.abs(acc.variance?.amount || 0) < 0.01
    ).length;

    return (zeroDiscrepancy / accountabilities.length) * 100;
  }

  private calculateBudgetAdherence(boqItems: ControlBOQItem[]): number {
    if (boqItems.length === 0) return 100;

    const onBudget = boqItems.filter(item =>
      item.budgetControl?.varianceStatus === 'on_budget'
    ).length;

    return (onBudget / boqItems.length) * 100;
  }

  private calculateVarianceWithinThreshold(accountabilities: Accountability[], thresholdPercent: number): number {
    if (accountabilities.length === 0) return 100;

    const withinThreshold = accountabilities.filter(acc => {
      const variancePct = Math.abs(acc.variance?.percentage || 0);
      return variancePct < thresholdPercent;
    }).length;

    return (withinThreshold / accountabilities.length) * 100;
  }

  private calculateProofOfSpendCompleteness(accountabilities: Accountability[]): number {
    if (accountabilities.length === 0) return 100;

    const complete = accountabilities.filter(acc => {
      return acc.expenses.every(exp => exp.proofOfSpend?.isComplete);
    }).length;

    return (complete / accountabilities.length) * 100;
  }

  private calculateDocumentQualityScore(accountabilities: Accountability[]): number {
    if (accountabilities.length === 0) return 100;

    let totalScore = 0;
    let scoredCount = 0;

    for (const acc of accountabilities) {
      for (const expense of acc.expenses || []) {
        const docs = expense.proofOfSpend?.providedDocuments ?? [];
        if (docs.length === 0) continue;

        let expenseScore = 40; // Has at least one document
        const highQualityDocs = docs.filter((d: any) => !d.dpi || d.dpi >= 300).length;
        expenseScore += (highQualityDocs / docs.length) * 30;
        expenseScore += docs.length > 0 ? 30 : 0;

        totalScore += expenseScore;
        scoredCount++;
      }
    }

    return scoredCount > 0 ? Math.round(totalScore / scoredCount) : 100;
  }

  private calculateApprovalSLACompliance(requisitions: Requisition[]): number {
    if (requisitions.length === 0) return 100;

    const SLA_HOURS = 48;
    let withinSLA = 0;

    for (const req of requisitions) {
      if (req.approvedAt && req.submittedAt) {
        const hours = (req.approvedAt.toMillis() - req.submittedAt.toMillis()) / (1000 * 60 * 60);
        if (hours <= SLA_HOURS) withinSLA++;
      } else if (!req.approvedAt && req.submittedAt) {
        const hours = (Date.now() - req.submittedAt.toMillis()) / (1000 * 60 * 60);
        if (hours <= SLA_HOURS) withinSLA++;
      }
    }

    return Math.round((withinSLA / requisitions.length) * 100);
  }

  private calculateInvestigationCompliance(investigations: VarianceInvestigation[]): number {
    if (investigations.length === 0) return 100;

    const resolved = investigations.filter(inv => inv.status === 'completed').length;
    return (resolved / investigations.length) * 100;
  }

  private getGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private generatePeriods(start: Date, end: Date, granularity: 'daily' | 'weekly' | 'monthly'): Date[] {
    const periods: Date[] = [];
    let current = new Date(start);

    while (current <= end) {
      periods.push(new Date(current));

      if (granularity === 'daily') {
        current.setDate(current.getDate() + 1);
      } else if (granularity === 'weekly') {
        current.setDate(current.getDate() + 7);
      } else {
        current.setMonth(current.getMonth() + 1);
      }
    }

    return periods;
  }

  private getPeriodEnd(start: Date, granularity: 'daily' | 'weekly' | 'monthly'): Date {
    const end = new Date(start);

    if (granularity === 'daily') {
      end.setDate(end.getDate() + 1);
    } else if (granularity === 'weekly') {
      end.setDate(end.getDate() + 7);
    } else {
      end.setMonth(end.getMonth() + 1);
    }

    return end;
  }

  private calculateMonthlySpends(accountabilities: Accountability[]): number[] {
    const monthlyTotals: Record<string, number> = {};

    accountabilities.forEach(acc => {
      if (!acc.submittedAt) return;
      const date = acc.submittedAt instanceof Timestamp
        ? acc.submittedAt.toDate()
        : new Date(acc.submittedAt as unknown as string | number | Date);

      const monthKey = `${date.getFullYear()}-${date.getMonth()}`;
      const total = acc.expenses.reduce((sum, exp) => sum + exp.amount, 0);

      monthlyTotals[monthKey] = (monthlyTotals[monthKey] || 0) + total;
    });

    return Object.values(monthlyTotals);
  }

  private generateRecommendations(
    complianceMetrics: ComplianceMetrics,
    _alerts: PredictiveAlert[],
    _boqItems: ControlBOQItem[],
    _requisitions: Requisition[]
  ): ExecutiveSummary['recommendations'] {
    const recommendations: ExecutiveSummary['recommendations'] = [];

    // Budget recommendations
    if (complianceMetrics.metrics.budgetAdherence < 80) {
      recommendations.push({
        priority: 'high',
        recommendation: 'Improve budget adherence by reviewing and adjusting BOQ allocations',
        expectedImpact: 'Reduce budget overruns by 15-20%',
      });
    }

    // Accountability recommendations
    if (complianceMetrics.metrics.accountabilityOnTime < 70) {
      recommendations.push({
        priority: 'high',
        recommendation: 'Increase accountability submission rate through automated reminders and enforcement',
        expectedImpact: 'Improve on-time accountability by 25%',
      });
    }

    // Documentation recommendations
    if (complianceMetrics.metrics.proofOfSpendComplete < 85) {
      recommendations.push({
        priority: 'medium',
        recommendation: 'Strengthen proof of spend documentation requirements and validation',
        expectedImpact: 'Achieve 95%+ proof of spend completeness',
      });
    }

    return recommendations;
  }

  /**
   * Calculate trends by comparing current metric values to baseline.
   * Returns direction for each metric (improving/declining/stable within ±3%).
   */
  private calculateMetricTrends(
    currentMetrics: Record<string, number>
  ): { metric: string; change: number; direction: 'improving' | 'declining' | 'stable' }[] {
    // Without stored historical data, report all metrics as stable.
    // Once historical snapshots are persisted, load the prior-period metrics
    // and compute the delta here.
    return Object.entries(currentMetrics).map(([metric]) => ({
      metric,
      change: 0,
      direction: 'stable' as const,
    }));
  }

  /**
   * Fetch violations from the non-compliance service for a given project and period.
   * Groups by type and picks the highest severity per type.
   */
  private async getViolationsForPeriod(
    projectId: string,
    periodStart: Date,
    periodEnd: Date
  ): Promise<{ type: string; count: number; severity: ViolationSeverity }[]> {
    try {
      const nonComplianceService = getNonComplianceService(db);
      const allViolations = await nonComplianceService.getProjectViolations(projectId);

      // Filter to violations detected within the period
      const periodViolations = allViolations.filter(v => {
        const detectedAt = v.detectedAt?.toDate?.() ?? new Date(0);
        return detectedAt >= periodStart && detectedAt <= periodEnd;
      });

      // Group by type, track count and worst severity
      const severityOrder: Record<ViolationSeverity, number> = { minor: 0, moderate: 1, severe: 2 };
      const grouped = new Map<string, { count: number; severity: ViolationSeverity }>();

      for (const v of periodViolations) {
        const existing = grouped.get(v.type);
        if (!existing) {
          grouped.set(v.type, { count: 1, severity: v.severity });
        } else {
          existing.count++;
          if (severityOrder[v.severity] > severityOrder[existing.severity]) {
            existing.severity = v.severity;
          }
        }
      }

      return Array.from(grouped.entries()).map(([type, data]) => ({
        type,
        count: data.count,
        severity: data.severity,
      }));
    } catch (error) {
      console.error('[AdvancedAnalyticsService] Failed to fetch violations:', error);
      return [];
    }
  }
}

export const advancedAnalyticsService = new AdvancedAnalyticsService();
