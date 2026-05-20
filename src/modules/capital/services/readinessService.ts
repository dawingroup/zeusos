// ============================================================================
// READINESS SERVICE
// DawinOS v2.0 — Business readiness assessment for capital applications
// ============================================================================

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  orderBy,
  limit,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type {
  ReadinessAssessment,
  ChecklistItem,
  FinancialHealthMetrics,
} from '../types/capital.types';
import {
  CAPITAL_READINESS_COLLECTION,
  DOCUMENT_CHECKLIST_TEMPLATE,
  COMPLIANCE_CHECKLIST_TEMPLATE,
  READINESS_THRESHOLDS,
} from '../constants/capital.constants';
import { optimizerService } from '@/modules/finance/services/optimizerService';
import { liabilityService } from '@/modules/finance/services/liabilityService';

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

function companyCol(companyId: string) {
  return collection(db, 'companies', companyId, CAPITAL_READINESS_COLLECTION);
}

function companyDoc(companyId: string, docId: string) {
  return doc(db, 'companies', companyId, CAPITAL_READINESS_COLLECTION, docId);
}

function calculateChecklistScore(items: ChecklistItem[]): number {
  if (items.length === 0) return 0;
  const applicable = items.filter(i => i.status !== 'not_applicable');
  if (applicable.length === 0) return 100;

  const points = applicable.reduce((sum, item) => {
    switch (item.status) {
      case 'complete': return sum + 1;
      case 'partial': return sum + 0.5;
      default: return sum;
    }
  }, 0);

  return Math.round((points / applicable.length) * 100);
}

export function getReadinessLevel(score: number): string {
  if (score >= READINESS_THRESHOLDS.excellent) return 'excellent';
  if (score >= READINESS_THRESHOLDS.good) return 'good';
  if (score >= READINESS_THRESHOLDS.fair) return 'fair';
  return 'poor';
}

// ────────────────────────────────────────────────────────────────────────────
// SERVICE CLASS
// ────────────────────────────────────────────────────────────────────────────

class ReadinessService {

  // ══════════════════════════════════════════════════════════════════════════
  // ASSESSMENTS
  // ══════════════════════════════════════════════════════════════════════════

  async getLatestAssessment(companyId: string): Promise<ReadinessAssessment | null> {
    const q = query(
      companyCol(companyId),
      orderBy('assessedAt', 'desc'),
      limit(1),
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;
    const d = snapshot.docs[0];
    return { id: d.id, ...d.data() } as ReadinessAssessment;
  }

  async getAssessmentHistory(
    companyId: string,
    count: number = 10,
  ): Promise<ReadinessAssessment[]> {
    const q = query(
      companyCol(companyId),
      orderBy('assessedAt', 'desc'),
      limit(count),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as ReadinessAssessment));
  }

  async saveAssessment(
    companyId: string,
    assessment: Omit<ReadinessAssessment, 'id'>,
  ): Promise<string> {
    const docRef = await addDoc(companyCol(companyId), assessment);
    return docRef.id;
  }

  async updateChecklistItem(
    companyId: string,
    assessmentId: string,
    section: 'documentReadiness' | 'complianceStatus',
    itemId: string,
    updates: Partial<ChecklistItem>,
  ): Promise<void> {
    const ref = companyDoc(companyId, assessmentId);
    const docSnap = await getDoc(ref);
    if (!docSnap.exists()) throw new Error('Assessment not found');

    const assessment = docSnap.data() as ReadinessAssessment;
    const sectionData = assessment[section];
    const items = sectionData.items.map(item =>
      item.id === itemId ? { ...item, ...updates } : item,
    );
    const score = calculateChecklistScore(items);

    const overallScore = Math.round(
      (assessment.financialHealth.score +
        (section === 'documentReadiness' ? score : assessment.documentReadiness.score) +
        (section === 'complianceStatus' ? score : assessment.complianceStatus.score)) / 3,
    );

    await updateDoc(ref, {
      [section]: { score, items },
      overallScore,
    });
  }

  // ══════════════════════════════════════════════════════════════════════════
  // GENERATE ASSESSMENT — Pulls from Finance module
  // ══════════════════════════════════════════════════════════════════════════

  async generateAssessment(companyId: string): Promise<ReadinessAssessment> {
    const financialMetrics = await this.calculateFinancialHealth(companyId);
    const financialScore = this.scoreFinancialHealth(financialMetrics);

    // Initialize document checklist from template
    const documentItems: ChecklistItem[] = DOCUMENT_CHECKLIST_TEMPLATE.map(t => ({
      id: t.id,
      label: t.label,
      category: t.category,
      status: 'missing' as const,
    }));

    // Initialize compliance checklist from template
    const complianceItems: ChecklistItem[] = COMPLIANCE_CHECKLIST_TEMPLATE.map(t => ({
      id: t.id,
      label: t.label,
      category: t.category,
      status: 'missing' as const,
    }));

    // Try to merge with existing assessment's checklist statuses
    const existing = await this.getLatestAssessment(companyId);
    if (existing) {
      const existingDocMap = new Map(
        existing.documentReadiness.items.map(i => [i.id, i]),
      );
      const existingCompMap = new Map(
        existing.complianceStatus.items.map(i => [i.id, i]),
      );

      for (let i = 0; i < documentItems.length; i++) {
        const prev = existingDocMap.get(documentItems[i].id);
        if (prev) {
          documentItems[i] = { ...documentItems[i], ...prev };
        }
      }
      for (let i = 0; i < complianceItems.length; i++) {
        const prev = existingCompMap.get(complianceItems[i].id);
        if (prev) {
          complianceItems[i] = { ...complianceItems[i], ...prev };
        }
      }
    }

    const docScore = calculateChecklistScore(documentItems);
    const compScore = calculateChecklistScore(complianceItems);
    const overallScore = Math.round((financialScore + docScore + compScore) / 3);

    const assessment: Omit<ReadinessAssessment, 'id'> = {
      companyId,
      assessedAt: Timestamp.now(),
      overallScore,
      financialHealth: {
        score: financialScore,
        metrics: financialMetrics,
      },
      documentReadiness: {
        score: docScore,
        items: documentItems,
      },
      complianceStatus: {
        score: compScore,
        items: complianceItems,
      },
    };

    const id = await this.saveAssessment(companyId, assessment);
    return { id, ...assessment };
  }

  // ══════════════════════════════════════════════════════════════════════════
  // FINANCIAL HEALTH — Calculated from Finance module data
  // ══════════════════════════════════════════════════════════════════════════

  private async calculateFinancialHealth(
    companyId: string,
  ): Promise<FinancialHealthMetrics> {
    const defaults: FinancialHealthMetrics = {
      monthlyRevenue: 0,
      revenueGrowthPercent: 0,
      profitMarginPercent: 0,
      currentRatio: 0,
      debtToEquityRatio: 0,
      debtServiceCoverageRatio: 0,
      cashRunwayDays: 0,
      averageDailyBurn: 0,
    };

    try {
      const projection = await optimizerService.getLatestProjection(companyId);
      if (projection) {
        defaults.cashRunwayDays = projection.runwayDays;
        defaults.averageDailyBurn = projection.averageDailyBurn;

        // Estimate monthly revenue from inflows
        const totalInflow = projection.dailySnapshots.reduce(
          (s, d) => s + d.totalProjectedInflow,
          0,
        );
        const days = projection.dailySnapshots.length || 1;
        defaults.monthlyRevenue = (totalInflow / days) * 30;
      }

      // Get liabilities for debt ratios
      const liabilities = await liabilityService.getLiabilities(companyId);
      let totalDebt = 0;
      let monthlyDebtService = 0;
      for (const l of liabilities) {
        if (l.status === 'current' || l.status === 'due_soon') {
          totalDebt += l.amountRemaining;
          switch (l.frequency) {
            case 'monthly': monthlyDebtService += l.totalAmount; break;
            case 'quarterly': monthlyDebtService += l.totalAmount / 3; break;
            case 'annually': monthlyDebtService += l.totalAmount / 12; break;
          }
        }
      }

      if (monthlyDebtService > 0 && defaults.monthlyRevenue > 0) {
        const expenses = defaults.monthlyRevenue * 0.75;
        defaults.debtServiceCoverageRatio =
          Math.round(((defaults.monthlyRevenue - expenses) / monthlyDebtService) * 100) / 100;
      }

      // Simple debt-to-equity estimate
      if (defaults.monthlyRevenue > 0) {
        const annualRevenue = defaults.monthlyRevenue * 12;
        defaults.debtToEquityRatio =
          Math.round((totalDebt / Math.max(annualRevenue * 0.1, 1)) * 100) / 100;
      }
    } catch {
      // Finance data may not be available
    }

    return defaults;
  }

  private scoreFinancialHealth(metrics: FinancialHealthMetrics): number {
    let score = 0;
    let factors = 0;

    // Cash runway (weight: 30%)
    if (metrics.cashRunwayDays > 0) {
      factors += 30;
      if (metrics.cashRunwayDays >= 90) score += 30;
      else if (metrics.cashRunwayDays >= 60) score += 25;
      else if (metrics.cashRunwayDays >= 30) score += 15;
      else score += 5;
    }

    // DSCR (weight: 30%)
    if (metrics.debtServiceCoverageRatio > 0) {
      factors += 30;
      if (metrics.debtServiceCoverageRatio >= 2) score += 30;
      else if (metrics.debtServiceCoverageRatio >= 1.5) score += 25;
      else if (metrics.debtServiceCoverageRatio >= 1.2) score += 15;
      else score += 5;
    }

    // Revenue (weight: 20%)
    if (metrics.monthlyRevenue > 0) {
      factors += 20;
      score += 20; // Has revenue = positive signal
    }

    // Debt-to-equity (weight: 20%)
    factors += 20;
    if (metrics.debtToEquityRatio <= 1) score += 20;
    else if (metrics.debtToEquityRatio <= 2) score += 15;
    else if (metrics.debtToEquityRatio <= 3) score += 10;
    else score += 5;

    return factors > 0 ? Math.round((score / factors) * 100) : 50;
  }
}

export const readinessService = new ReadinessService();
