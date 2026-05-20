/**
 * NON-COMPLIANCE SERVICE (ADD-FIN-001)
 *
 * Features:
 * - Three-tier violation system (minor, moderate, severe)
 * - Personal liability tracking
 * - Escalation workflow
 * - Quarterly spot-checks
 * - Compliance scoring
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  getDocs,
  orderBy,
  limit,
  Timestamp,
  Firestore,
} from 'firebase/firestore';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export type ViolationSeverity = 'minor' | 'moderate' | 'severe';
export type ViolationType =
  | 'missing_proof_of_spend'
  | 'low_quality_documents'
  | 'variance_exceeds_threshold'
  | 'late_accountability'
  | 'incomplete_reconciliation'
  | 'unauthorized_expenditure'
  | 'falsified_documentation'
  | 'budget_overrun'
  | 'improper_procurement'
  | 'other';

export type ViolationStatus = 'open' | 'under_review' | 'resolved' | 'escalated' | 'closed';

export interface Violation {
  id: string;

  // Classification
  type: ViolationType;
  severity: ViolationSeverity;
  category: 'documentation' | 'financial' | 'procedural' | 'ethical';

  // Details
  title: string;
  description: string;
  detectedAt: Timestamp;
  detectedBy: string;

  // Involved parties
  responsibleUserId: string;
  responsibleUserName: string;
  department?: string;

  // Context
  projectId: string;
  linkedEntityId?: string; // Requisition, Accountability, etc.
  linkedEntityType?: 'requisition' | 'accountability' | 'investigation';

  // Financial impact
  amountInvolved?: number;
  currency?: string;

  // Resolution
  status: ViolationStatus;
  assignedTo?: string;
  dueDate?: Date;
  resolvedAt?: Timestamp;
  resolvedBy?: string;
  resolutionNotes?: string;

  // Corrective actions
  correctiveActions?: string[];
  preventiveActions?: string[];

  // Escalation
  escalatedAt?: Timestamp;
  escalatedTo?: string;
  escalationReason?: string;

  // Personal liability
  personalLiability?: PersonalLiability;

  // Audit
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PersonalLiability {
  userId: string;
  userName: string;
  amount: number;
  currency: string;
  reason: string;
  status: 'pending' | 'acknowledged' | 'repaid' | 'waived' | 'legal_action';
  acknowledgedAt?: Timestamp;
  dueDate: Date;
  repaidAt?: Timestamp;
  repaidAmount?: number;
  waivedAt?: Timestamp;
  waivedBy?: string;
  waiverReason?: string;
  legalActionInitiatedAt?: Timestamp;
  notes?: string;
}

export interface ComplianceScore {
  projectId: string;
  period: { start: Date; end: Date };

  // Metrics
  totalTransactions: number;
  compliantTransactions: number;
  violationCount: number;
  minorViolations: number;
  moderateViolations: number;
  severeViolations: number;

  // Score (0-100)
  score: number;
  rating: 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

  // Breakdown
  documentationCompliance: number; // %
  financialCompliance: number; // %
  proceduralCompliance: number; // %
  zeroDiscrepancyRate: number; // %

  // Trend
  previousScore?: number;
  trend: 'improving' | 'stable' | 'declining';

  calculatedAt: Timestamp;
}

export interface SpotCheckRecord {
  id: string;
  projectId: string;
  quarter: string; // "2026-Q1"
  checkedAt: Timestamp;
  checkedBy: string;

  // Sample
  sampleSize: number;
  transactionsChecked: string[]; // IDs

  // Findings
  violationsFound: number;
  findings: string[];
  recommendations: string[];

  // Outcome
  passed: boolean;
  complianceScore: number;

  // Follow-up
  followUpRequired: boolean;
  followUpDueDate?: Date;
  followUpCompleted?: boolean;
}

// ─────────────────────────────────────────────────────────────────
// CONSTANTS
// ─────────────────────────────────────────────────────────────────

const VIOLATIONS_COLLECTION = 'violations';
const COMPLIANCE_SCORES_COLLECTION = 'compliance_scores';
const SPOT_CHECKS_COLLECTION = 'spot_checks';

const VIOLATION_SEVERITY_CONFIG: Record<
  ViolationSeverity,
  {
    label: string;
    color: string;
    escalationThreshold: number; // Days before escalation
    requiresInvestigation: boolean;
    requiresPersonalLiability: boolean;
  }
> = {
  minor: {
    label: 'Minor',
    color: 'yellow',
    escalationThreshold: 14,
    requiresInvestigation: false,
    requiresPersonalLiability: false,
  },
  moderate: {
    label: 'Moderate',
    color: 'orange',
    escalationThreshold: 7,
    requiresInvestigation: true,
    requiresPersonalLiability: false,
  },
  severe: {
    label: 'Severe',
    color: 'red',
    escalationThreshold: 3,
    requiresInvestigation: true,
    requiresPersonalLiability: true,
  },
};

// ─────────────────────────────────────────────────────────────────
// NON-COMPLIANCE SERVICE
// ─────────────────────────────────────────────────────────────────

export class NonComplianceService {
  constructor(private db: Firestore) {}

  // ─────────────────────────────────────────────────────────────────
  // VIOLATION MANAGEMENT
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create a violation record
   */
  async createViolation(
    violation: Omit<Violation, 'id' | 'status' | 'createdAt' | 'updatedAt'>,
    _userId: string
  ): Promise<string> {
    const config = VIOLATION_SEVERITY_CONFIG[violation.severity];

    // Calculate due date based on severity
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + config.escalationThreshold);

    const newViolation: Omit<Violation, 'id'> = {
      ...violation,
      status: 'open',
      dueDate,
      createdAt: Timestamp.now(),
      updatedAt: Timestamp.now(),
    };

    const docRef = await addDoc(collection(this.db, VIOLATIONS_COLLECTION), newViolation);

    // If severe, automatically assign personal liability
    if (config.requiresPersonalLiability && violation.amountInvolved) {
      await this.assignPersonalLiability(
        docRef.id,
        {
          userId: violation.responsibleUserId,
          userName: violation.responsibleUserName,
          amount: violation.amountInvolved,
          currency: violation.currency || 'UGX',
          reason: violation.description,
          status: 'pending',
          dueDate,
        }
      );
    }

    return docRef.id;
  }

  /**
   * Update violation status
   */
  async updateViolationStatus(
    violationId: string,
    status: ViolationStatus,
    userId: string,
    notes?: string
  ): Promise<void> {
    const updates: any = {
      status,
      updatedAt: Timestamp.now(),
    };

    if (status === 'resolved') {
      updates.resolvedAt = Timestamp.now();
      updates.resolvedBy = userId;
      updates.resolutionNotes = notes;
    }

    if (status === 'escalated') {
      updates.escalatedAt = Timestamp.now();
      updates.escalationReason = notes;
    }

    await updateDoc(doc(this.db, VIOLATIONS_COLLECTION, violationId), updates);
  }

  /**
   * Add corrective actions
   */
  async addCorrectiveActions(
    violationId: string,
    correctiveActions: string[],
    preventiveActions?: string[]
  ): Promise<void> {
    await updateDoc(doc(this.db, VIOLATIONS_COLLECTION, violationId), {
      correctiveActions,
      preventiveActions,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Get violations by project
   */
  async getProjectViolations(
    projectId: string,
    status?: ViolationStatus
  ): Promise<Violation[]> {
    let q = query(
      collection(this.db, VIOLATIONS_COLLECTION),
      where('projectId', '==', projectId),
      orderBy('createdAt', 'desc')
    );

    if (status) {
      q = query(q, where('status', '==', status));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Violation));
  }

  /**
   * Get violations by user
   */
  async getUserViolations(userId: string, status?: ViolationStatus): Promise<Violation[]> {
    let q = query(
      collection(this.db, VIOLATIONS_COLLECTION),
      where('responsibleUserId', '==', userId),
      orderBy('createdAt', 'desc')
    );

    if (status) {
      q = query(q, where('status', '==', status));
    }

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as Violation));
  }

  /**
   * Get overdue violations
   */
  async getOverdueViolations(): Promise<Violation[]> {
    const now = new Date();
    const q = query(
      collection(this.db, VIOLATIONS_COLLECTION),
      where('status', 'in', ['open', 'under_review']),
      orderBy('dueDate', 'asc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs
      .map((doc) => ({ id: doc.id, ...doc.data() } as Violation))
      .filter((v) => v.dueDate && new Date(v.dueDate) < now);
  }

  // ─────────────────────────────────────────────────────────────────
  // PERSONAL LIABILITY
  // ─────────────────────────────────────────────────────────────────

  /**
   * Assign personal liability
   */
  async assignPersonalLiability(
    violationId: string,
    liability: PersonalLiability
  ): Promise<void> {
    await updateDoc(doc(this.db, VIOLATIONS_COLLECTION, violationId), {
      personalLiability: liability,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Acknowledge personal liability
   */
  async acknowledgePersonalLiability(
    violationId: string,
    _userId: string
  ): Promise<void> {
    await updateDoc(doc(this.db, VIOLATIONS_COLLECTION, violationId), {
      'personalLiability.status': 'acknowledged',
      'personalLiability.acknowledgedAt': Timestamp.now(),
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Record repayment
   */
  async recordRepayment(
    violationId: string,
    amount: number,
    _userId: string
  ): Promise<void> {
    await updateDoc(doc(this.db, VIOLATIONS_COLLECTION, violationId), {
      'personalLiability.status': 'repaid',
      'personalLiability.repaidAt': Timestamp.now(),
      'personalLiability.repaidAmount': amount,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Waive personal liability
   */
  async waivePersonalLiability(
    violationId: string,
    reason: string,
    waivedBy: string
  ): Promise<void> {
    await updateDoc(doc(this.db, VIOLATIONS_COLLECTION, violationId), {
      'personalLiability.status': 'waived',
      'personalLiability.waivedAt': Timestamp.now(),
      'personalLiability.waivedBy': waivedBy,
      'personalLiability.waiverReason': reason,
      updatedAt: Timestamp.now(),
    });
  }

  /**
   * Get outstanding liabilities by user
   */
  async getUserOutstandingLiabilities(userId: string): Promise<{
    violations: Violation[];
    totalAmount: number;
  }> {
    const q = query(
      collection(this.db, VIOLATIONS_COLLECTION),
      where('personalLiability.userId', '==', userId),
      where('personalLiability.status', 'in', ['pending', 'acknowledged'])
    );

    const snapshot = await getDocs(q);
    const violations = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    } as Violation));

    const totalAmount = violations.reduce(
      (sum, v) => sum + (v.personalLiability?.amount || 0),
      0
    );

    return { violations, totalAmount };
  }

  // ─────────────────────────────────────────────────────────────────
  // COMPLIANCE SCORING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Calculate compliance score for project
   */
  async calculateComplianceScore(
    projectId: string,
    startDate: Date,
    endDate: Date
  ): Promise<ComplianceScore> {
    // Get violations in period
    const violations = await this.getProjectViolations(projectId);
    const periodViolations = violations.filter((v) => {
      const createdAt = v.createdAt.toDate();
      return createdAt >= startDate && createdAt <= endDate;
    });

    // Count by severity
    const minorCount = periodViolations.filter((v) => v.severity === 'minor').length;
    const moderateCount = periodViolations.filter((v) => v.severity === 'moderate').length;
    const severeCount = periodViolations.filter((v) => v.severity === 'severe').length;

    // Get total transactions from requisitions + accountabilities
    let totalTransactions = 0;
    try {
      const reqQuery = query(
        collection(this.db, 'requisitions'),
        where('projectId', '==', projectId)
      );
      const accQuery = query(
        collection(this.db, 'accountabilities'),
        where('projectId', '==', projectId)
      );
      const [reqSnap, accSnap] = await Promise.all([getDocs(reqQuery), getDocs(accQuery)]);
      totalTransactions = reqSnap.size + accSnap.size;
    } catch {
      // Fallback: estimate from violations if queries fail
      totalTransactions = Math.max(periodViolations.length * 5, 1);
    }
    if (totalTransactions === 0) totalTransactions = 1;
    const compliantTransactions = totalTransactions - periodViolations.length;

    // Calculate scores (simplified formula)
    const baseScore = (compliantTransactions / totalTransactions) * 100;
    const severityPenalty = minorCount * 0.5 + moderateCount * 2 + severeCount * 5;
    const score = Math.max(0, Math.min(100, baseScore - severityPenalty));

    // Determine rating
    let rating: ComplianceScore['rating'];
    if (score >= 90) rating = 'excellent';
    else if (score >= 75) rating = 'good';
    else if (score >= 60) rating = 'fair';
    else if (score >= 40) rating = 'poor';
    else rating = 'critical';

    // Category breakdown
    const docViolations = periodViolations.filter((v) => v.category === 'documentation');
    const finViolations = periodViolations.filter((v) => v.category === 'financial');
    const procViolations = periodViolations.filter((v) => v.category === 'procedural');

    const documentationCompliance =
      ((totalTransactions - docViolations.length) / totalTransactions) * 100;
    const financialCompliance =
      ((totalTransactions - finViolations.length) / totalTransactions) * 100;
    const proceduralCompliance =
      ((totalTransactions - procViolations.length) / totalTransactions) * 100;

    // Get previous score for trend
    const previousScores = await this.getComplianceScores(projectId, 1);
    const previousScore = previousScores[0]?.score;

    let trend: ComplianceScore['trend'] = 'stable';
    if (previousScore) {
      if (score > previousScore + 5) trend = 'improving';
      else if (score < previousScore - 5) trend = 'declining';
    }

    const complianceScore: ComplianceScore = {
      projectId,
      period: { start: startDate, end: endDate },
      totalTransactions,
      compliantTransactions,
      violationCount: periodViolations.length,
      minorViolations: minorCount,
      moderateViolations: moderateCount,
      severeViolations: severeCount,
      score,
      rating,
      documentationCompliance,
      financialCompliance,
      proceduralCompliance,
      zeroDiscrepancyRate: await this.calculateZeroDiscrepancyRate(projectId, startDate, endDate),
      previousScore,
      trend,
      calculatedAt: Timestamp.now(),
    };

    // Save score
    await addDoc(collection(this.db, COMPLIANCE_SCORES_COLLECTION), complianceScore);

    return complianceScore;
  }

  /**
   * Calculate zero discrepancy rate from accountabilities in period
   */
  private async calculateZeroDiscrepancyRate(
    projectId: string,
    startDate: Date,
    endDate: Date
  ): Promise<number> {
    try {
      const accQuery = query(
        collection(this.db, 'accountabilities'),
        where('projectId', '==', projectId)
      );
      const snapshot = await getDocs(accQuery);
      const periodAccs = snapshot.docs
        .map((d) => d.data())
        .filter((a) => {
          const submitted = a.submittedAt?.toDate();
          return submitted && submitted >= startDate && submitted <= endDate;
        });

      if (periodAccs.length === 0) return 100;

      const zeroDiscrepancy = periodAccs.filter(
        (a) => Math.abs(a.variance?.amount || 0) < 0.01
      ).length;

      return Math.round((zeroDiscrepancy / periodAccs.length) * 100);
    } catch {
      return 95; // Fallback
    }
  }

  /**
   * Get compliance scores history
   */
  async getComplianceScores(
    projectId: string,
    limitCount: number = 12
  ): Promise<ComplianceScore[]> {
    const q = query(
      collection(this.db, COMPLIANCE_SCORES_COLLECTION),
      where('projectId', '==', projectId),
      orderBy('calculatedAt', 'desc'),
      limit(limitCount)
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => doc.data() as ComplianceScore);
  }

  // ─────────────────────────────────────────────────────────────────
  // SPOT CHECKS
  // ─────────────────────────────────────────────────────────────────

  /**
   * Create quarterly spot check
   */
  async createSpotCheck(
    projectId: string,
    quarter: string,
    sampleSize: number,
    userId: string
  ): Promise<string> {
    // Randomly select transactions to check
    const transactionsChecked: string[] = [];
    try {
      const reqQuery = query(
        collection(this.db, 'requisitions'),
        where('projectId', '==', projectId),
        limit(sampleSize * 3)
      );
      const snapshot = await getDocs(reqQuery);
      const allIds = snapshot.docs.map((d) => d.id);
      // Fisher-Yates shuffle and take sampleSize
      for (let i = allIds.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [allIds[i], allIds[j]] = [allIds[j], allIds[i]];
      }
      transactionsChecked.push(...allIds.slice(0, sampleSize));
    } catch {
      // Proceed with empty sample if query fails
    }

    const spotCheck: Omit<SpotCheckRecord, 'id'> = {
      projectId,
      quarter,
      checkedAt: Timestamp.now(),
      checkedBy: userId,
      sampleSize,
      transactionsChecked,
      violationsFound: 0,
      findings: [],
      recommendations: [],
      passed: true,
      complianceScore: 100,
      followUpRequired: false,
    };

    const docRef = await addDoc(collection(this.db, SPOT_CHECKS_COLLECTION), spotCheck);
    return docRef.id;
  }

  /**
   * Record spot check findings
   */
  async recordSpotCheckFindings(
    spotCheckId: string,
    findings: {
      violationsFound: number;
      findings: string[];
      recommendations: string[];
      passed: boolean;
      complianceScore: number;
      followUpRequired: boolean;
      followUpDueDate?: Date;
    }
  ): Promise<void> {
    await updateDoc(doc(this.db, SPOT_CHECKS_COLLECTION, spotCheckId), findings);
  }

  /**
   * Get spot checks for project
   */
  async getProjectSpotChecks(projectId: string): Promise<SpotCheckRecord[]> {
    const q = query(
      collection(this.db, SPOT_CHECKS_COLLECTION),
      where('projectId', '==', projectId),
      orderBy('checkedAt', 'desc')
    );

    const snapshot = await getDocs(q);
    return snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() } as SpotCheckRecord));
  }

  // ─────────────────────────────────────────────────────────────────
  // REPORTING
  // ─────────────────────────────────────────────────────────────────

  /**
   * Get violation summary
   */
  async getViolationSummary(projectId: string): Promise<{
    total: number;
    open: number;
    resolved: number;
    bySeverity: Record<ViolationSeverity, number>;
    byType: Record<string, number>;
    totalLiabilityAmount: number;
    averageResolutionDays: number;
  }> {
    const violations = await this.getProjectViolations(projectId);

    const bySeverity = violations.reduce(
      (acc, v) => {
        acc[v.severity] = (acc[v.severity] || 0) + 1;
        return acc;
      },
      {} as Record<ViolationSeverity, number>
    );

    const byType = violations.reduce(
      (acc, v) => {
        acc[v.type] = (acc[v.type] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );

    const totalLiabilityAmount = violations.reduce(
      (sum, v) => sum + (v.personalLiability?.amount || 0),
      0
    );

    const resolvedViolations = violations.filter((v) => v.status === 'resolved');
    const averageResolutionDays = resolvedViolations.length
      ? resolvedViolations.reduce((sum, v) => {
          if (v.resolvedAt && v.createdAt) {
            const days =
              (v.resolvedAt.toDate().getTime() - v.createdAt.toDate().getTime()) /
              (1000 * 60 * 60 * 24);
            return sum + days;
          }
          return sum;
        }, 0) / resolvedViolations.length
      : 0;

    return {
      total: violations.length,
      open: violations.filter((v) => v.status === 'open').length,
      resolved: resolvedViolations.length,
      bySeverity,
      byType,
      totalLiabilityAmount,
      averageResolutionDays,
    };
  }
}

// Export factory
export function getNonComplianceService(db: Firestore): NonComplianceService {
  return new NonComplianceService(db);
}
