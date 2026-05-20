// ============================================================================
// OPTIMIZER ENGINE UNIT TESTS
// Pure function tests — no Firestore mocking required
// ============================================================================

import { describe, it, expect } from 'vitest';
import { Timestamp } from 'firebase/firestore';
import {
  daysBetween,
  addDays,
  formatUGX,
  scoreExpenditure,
  calculateCompositeScore,
  assignPriorityTier,
  calculateReceiptConfidence,
  estimateReceiptDate,
  generateDailySpendPlan,
  projectCashFlow,
  calculateSavingsAllocation,
  detectCrisisMode,
  evaluateRevenueUnlockAcceleration,
} from '../optimizerEngine';
import type {
  ExpenditureItem,
  ExpenditureScores,
  ScoringContext,
  PendingReceipt,
  DailySnapshot,
  CashBufferSettings,
} from '../../types/optimizer.types';
import { DEFAULT_SCORING_WEIGHTS, DEFAULT_SAVINGS_SETTINGS } from '../../constants/optimizer.constants';

// ────────────────────────────────────────────────────────────────────────────
// TEST HELPERS
// ────────────────────────────────────────────────────────────────────────────

const ts = (dateStr: string) => Timestamp.fromDate(new Date(dateStr));

function makeExpenditure(overrides: Partial<ExpenditureItem> = {}): ExpenditureItem {
  return {
    id: 'exp-1',
    companyId: 'company-1',
    createdAt: ts('2026-03-01'),
    updatedAt: ts('2026-03-01'),
    subsidiaryId: 'zeus-the-agency',
    description: 'Test expenditure',
    category: 'materials',
    amount: 5_000_000,
    currency: 'UGX',
    amountUGX: 5_000_000,
    sourceType: 'project',
    sourceId: 'proj-1',
    requestedDate: ts('2026-03-07'),
    earliestDate: ts('2026-03-05'),
    latestDate: ts('2026-03-14'),
    scores: {
      urgencyScore: 50,
      revenueUnlockScore: 0,
      riskScore: 70,
      cashPositionScore: 60,
      relationshipScore: 30,
      operationalScore: 30,
    },
    compositeScore: 50,
    priorityTier: 'MEDIUM',
    revenueUnlock: {
      enabled: false,
      unlockAmount: 0,
      unlockTimelineDays: 0,
      unlockConfidence: 0,
      unlockMultiplier: 0,
      dependencyChain: [],
    },
    risk: {
      receiptRiskScore: 30,
      vendorRelationshipRisk: 40,
      operationalImpact: 30,
      penaltyAmount: 0,
      contractualObligation: false,
    },
    status: 'pending',
    statusHistory: [],
    ...overrides,
  };
}

function makeScoringContext(overrides: Partial<ScoringContext> = {}): ScoringContext {
  return {
    currentBankBalance: 50_000_000,
    projectedBalance7Days: 40_000_000,
    projectedBalance30Days: 35_000_000,
    averageDailyBurn: 1_500_000,
    confirmedUpcomingReceipts: 20_000_000,
    settings: {
      id: 'config-1',
      companyId: 'company-1',
      subsidiaryId: 'zeus-the-agency',
      scoringWeights: DEFAULT_SCORING_WEIGHTS,
      priorityThresholds: { critical: 80, high: 65, medium: 45, low: 25 },
      cashBufferSettings: {
        minimumCashBuffer: 5_000_000,
        minimumBufferDays: 14,
        targetBufferDays: 30,
        crisisThresholdDays: 7,
      },
      savingsSettings: DEFAULT_SAVINGS_SETTINGS,
      partialPaymentThreshold: 5_000_000,
      minimumPartialPayment: 1_000_000,
      updatedAt: ts('2026-03-01'),
      updatedBy: 'system',
    },
    ...overrides,
  };
}

function makeReceipt(overrides: Partial<PendingReceipt> = {}): PendingReceipt {
  return {
    id: 'receipt-1',
    amount: 10_000_000,
    clientId: 'client-1',
    clientPaymentProfile: {
      clientId: 'client-1',
      clientName: 'Test Client',
      averageDaysToPayment: 30,
      paymentStdDeviation: 10,
      paymentReliability: 75,
      outstandingBalance: 15_000_000,
      paymentMethod: 'bank_transfer',
      contractType: 'private_corporate',
      totalHistoricalPayments: 5,
      totalPaymentsTracked: 5,
      averagePaymentDelayDays: 3,
      onTimePaymentRate: 0.8,
      reliabilityScore: 75,
      recentPayments: [],
    },
    milestoneComplete: false,
    milestoneProgress: 50,
    isInvoiced: true,
    invoiceAcknowledged: false,
    daysOverdue: 0,
    contractType: 'private_corporate',
    ...overrides,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// UTILITY TESTS
// ────────────────────────────────────────────────────────────────────────────

describe('Utility functions', () => {
  it('daysBetween calculates correctly', () => {
    expect(daysBetween('2026-03-01', '2026-03-08')).toBe(7);
    expect(daysBetween('2026-03-08', '2026-03-01')).toBe(-7);
    expect(daysBetween('2026-03-01', '2026-03-01')).toBe(0);
  });

  it('addDays adds correctly', () => {
    expect(addDays('2026-03-01', 7)).toBe('2026-03-08');
    expect(addDays('2026-03-28', 5)).toBe('2026-04-02');
  });

  it('formatUGX formats correctly', () => {
    expect(formatUGX(5000000)).toMatch(/5[,.]000[,.]000/);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// SCORING TESTS
// ────────────────────────────────────────────────────────────────────────────

describe('Expenditure Scoring', () => {
  const today = new Date('2026-03-07');

  it('scores urgency based on deadline proximity', () => {
    const context = makeScoringContext();

    // Due in 7 days
    const item7 = makeExpenditure({ latestDate: ts('2026-03-14') });
    const scores7 = scoreExpenditure(item7, context, today);
    expect(scores7.urgencyScore).toBe(70);

    // Due today
    const itemToday = makeExpenditure({ latestDate: ts('2026-03-07') });
    const scoresToday = scoreExpenditure(itemToday, context, today);
    expect(scoresToday.urgencyScore).toBe(95);

    // Overdue
    const itemOverdue = makeExpenditure({ latestDate: ts('2026-03-05') });
    const scoresOverdue = scoreExpenditure(itemOverdue, context, today);
    expect(scoresOverdue.urgencyScore).toBe(100);
  });

  it('scores revenue unlock based on multiplier, timeline, confidence', () => {
    const context = makeScoringContext();

    const itemNoUnlock = makeExpenditure();
    const scoresNo = scoreExpenditure(itemNoUnlock, context, today);
    expect(scoresNo.revenueUnlockScore).toBe(0);

    const itemWithUnlock = makeExpenditure({
      revenueUnlock: {
        enabled: true,
        unlockAmount: 15_000_000,
        unlockTimelineDays: 14,
        unlockConfidence: 80,
        unlockMultiplier: 3,
        dependencyChain: [],
      },
    });
    const scoresUnlock = scoreExpenditure(itemWithUnlock, context, today);
    expect(scoresUnlock.revenueUnlockScore).toBeGreaterThan(50);
  });

  it('scores risk inversely — high receipt risk = low score', () => {
    const context = makeScoringContext();

    const lowRisk = makeExpenditure({ risk: { ...makeExpenditure().risk, receiptRiskScore: 10 } });
    const highRisk = makeExpenditure({ risk: { ...makeExpenditure().risk, receiptRiskScore: 90 } });

    const scoresLow = scoreExpenditure(lowRisk, context, today);
    const scoresHigh = scoreExpenditure(highRisk, context, today);

    expect(scoresLow.riskScore).toBe(90);
    expect(scoresHigh.riskScore).toBe(10);
  });

  it('scores cash position based on remaining balance after payment', () => {
    const context = makeScoringContext({ currentBankBalance: 10_000_000 });
    const item = makeExpenditure({ amountUGX: 3_000_000 });
    const scores = scoreExpenditure(item, context, today);
    // After payment: 7M, buffer: 5M → 7M > 5M*1 but < 5M*2 → score 60
    expect(scores.cashPositionScore).toBe(60);
  });
});

describe('Composite Score', () => {
  it('calculates weighted average', () => {
    const scores: ExpenditureScores = {
      urgencyScore: 80,
      revenueUnlockScore: 60,
      riskScore: 70,
      cashPositionScore: 50,
      relationshipScore: 40,
      operationalScore: 30,
    };
    const composite = calculateCompositeScore(scores, undefined, 'committed');
    // 80*.25 + 60*.25 + 70*.15 + 50*.15 + 40*.10 + 30*.10 = 20 + 15 + 10.5 + 7.5 + 4 + 3 = 60
    expect(composite).toBe(60);
  });
});

describe('Priority Tier Assignment', () => {
  it('assigns tiers by score', () => {
    const item = makeExpenditure();
    expect(assignPriorityTier(90, item)).toBe('CRITICAL');
    expect(assignPriorityTier(70, item)).toBe('HIGH');
    expect(assignPriorityTier(50, item)).toBe('MEDIUM');
    expect(assignPriorityTier(30, item)).toBe('LOW');
    expect(assignPriorityTier(10, item)).toBe('DEFERRABLE');
  });

  it('overrides to CRITICAL for statutory obligations', () => {
    const item = makeExpenditure({
      category: 'statutory',
      risk: { ...makeExpenditure().risk, contractualObligation: true },
    });
    expect(assignPriorityTier(20, item)).toBe('CRITICAL');
  });
});

// ────────────────────────────────────────────────────────────────────────────
// RECEIPT CONFIDENCE TESTS
// ────────────────────────────────────────────────────────────────────────────

describe('Receipt Confidence', () => {
  it('scores higher for invoiced receipts with good client history', () => {
    const receipt = makeReceipt({
      isInvoiced: true,
      invoiceAcknowledged: true,
      milestoneComplete: true,
      clientPaymentProfile: {
        ...makeReceipt().clientPaymentProfile,
        paymentReliability: 90,
      },
    });
    const score = calculateReceiptConfidence(receipt);
    expect(score).toBeGreaterThanOrEqual(85);
  });

  it('scores lower for uninvoiced receipts from unreliable clients', () => {
    const receipt = makeReceipt({
      isInvoiced: false,
      milestoneComplete: false,
      milestoneProgress: 30,
      clientPaymentProfile: {
        ...makeReceipt().clientPaymentProfile,
        paymentReliability: 30,
      },
    });
    const score = calculateReceiptConfidence(receipt);
    expect(score).toBeLessThan(30);
  });

  it('penalizes overdue receipts', () => {
    const onTime = makeReceipt({ daysOverdue: 0 });
    const overdue = makeReceipt({ daysOverdue: 15 });
    expect(calculateReceiptConfidence(onTime)).toBeGreaterThan(calculateReceiptConfidence(overdue));
  });
});

describe('Receipt Date Estimation', () => {
  it('returns optimistic < expected < pessimistic', () => {
    const receipt = makeReceipt();
    const dates = estimateReceiptDate(receipt, '2026-03-07');
    expect(dates.optimistic < dates.expected).toBe(true);
    expect(dates.expected < dates.pessimistic).toBe(true);
  });

  it('adjusts for government contracts (slower)', () => {
    const corporate = makeReceipt({
      contractType: 'private_corporate',
      clientPaymentProfile: {
        ...makeReceipt().clientPaymentProfile,
        contractType: 'private_corporate',
      },
    });
    const govt = makeReceipt({
      contractType: 'government',
      clientPaymentProfile: {
        ...makeReceipt().clientPaymentProfile,
        contractType: 'government',
      },
    });
    const corpDates = estimateReceiptDate(corporate, '2026-03-07');
    const govtDates = estimateReceiptDate(govt, '2026-03-07');
    expect(govtDates.expected > corpDates.expected).toBe(true);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// SPEND PLAN TESTS
// ────────────────────────────────────────────────────────────────────────────

describe('Daily Spend Plan Generator', () => {
  it('schedules mandatory items first, then by score', () => {
    const criticalItem = makeExpenditure({
      id: 'critical-1',
      priorityTier: 'CRITICAL',
      compositeScore: 90,
      amountUGX: 2_000_000,
      requestedDate: ts('2026-03-07'),
      latestDate: ts('2026-03-07'),
    });
    const highItem = makeExpenditure({
      id: 'high-1',
      priorityTier: 'HIGH',
      compositeScore: 70,
      amountUGX: 3_000_000,
      requestedDate: ts('2026-03-07'),
    });
    const lowItem = makeExpenditure({
      id: 'low-1',
      priorityTier: 'LOW',
      compositeScore: 20,
      amountUGX: 1_000_000,
      requestedDate: ts('2026-03-07'),
    });

    const result = generateDailySpendPlan({
      bankBalance: 20_000_000,
      savingsBalance: 5_000_000,
      todaysReceipts: [{ amount: 5_000_000, confidenceLevel: 'confirmed', description: 'Test', source: 'Client A' }],
      queue: [lowItem, criticalItem, highItem],
      settings: {
        minimumCashBuffer: 5_000_000,
        savingsRatePercent: 10,
        partialPaymentThreshold: 5_000_000,
        minimumPartialPayment: 1_000_000,
      },
      today: new Date('2026-03-07'),
    });

    expect(result.isCrisisMode).toBe(false);
    expect(result.scheduled.length).toBeGreaterThanOrEqual(2);
    // Critical item should be first
    expect(result.scheduled[0].expenditureId).toBe('critical-1');
  });

  it('enters crisis mode when mandatory exceeds available cash', () => {
    const bigMandatory = makeExpenditure({
      id: 'big-1',
      priorityTier: 'CRITICAL',
      compositeScore: 95,
      amountUGX: 30_000_000,
      category: 'statutory',
      requestedDate: ts('2026-03-07'),
      latestDate: ts('2026-03-07'),
    });

    const result = generateDailySpendPlan({
      bankBalance: 10_000_000,
      savingsBalance: 5_000_000,
      todaysReceipts: [],
      queue: [bigMandatory],
      settings: {
        minimumCashBuffer: 5_000_000,
        savingsRatePercent: 10,
        partialPaymentThreshold: 5_000_000,
        minimumPartialPayment: 1_000_000,
      },
      today: new Date('2026-03-07'),
    });

    expect(result.isCrisisMode).toBe(true);
    expect(result.riskFlags.some(f => f.severity === 'critical')).toBe(true);
  });

  it('applies savings allocation before spending', () => {
    const result = generateDailySpendPlan({
      bankBalance: 20_000_000,
      savingsBalance: 5_000_000,
      todaysReceipts: [{ amount: 10_000_000, confidenceLevel: 'confirmed', description: 'Payment', source: 'Client' }],
      queue: [],
      settings: {
        minimumCashBuffer: 5_000_000,
        savingsRatePercent: 10,
        partialPaymentThreshold: 5_000_000,
        minimumPartialPayment: 1_000_000,
      },
      today: new Date('2026-03-07'),
    });

    expect(result.savingsAllocation).toBe(1_000_000); // 10% of 10M
  });
});

// ────────────────────────────────────────────────────────────────────────────
// PROJECTION TESTS
// ────────────────────────────────────────────────────────────────────────────

describe('Cash Flow Projection', () => {
  it('projects balance forward correctly', () => {
    const snapshots = projectCashFlow({
      openingBalance: 20_000_000,
      receipts: [
        { date: '2026-03-08', amount: 5_000_000, confidenceLevel: 'confirmed', confidenceScore: 100, description: 'Invoice A' },
      ],
      expenditures: [
        { date: '2026-03-08', amount: 3_000_000, category: 'materials', priorityTier: 'HIGH', description: 'Supplier X' },
      ],
      savingsRatePercent: 10,
      days: 3,
      startDate: '2026-03-07',
    });

    expect(snapshots).toHaveLength(3);
    expect(snapshots[0].openingBalance).toBe(20_000_000);
    // Day 2 (03-08): +5M inflow, -3M outflow, -500K savings = +1.5M
    expect(snapshots[1].totalProjectedInflow).toBe(5_000_000);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// SAVINGS TESTS
// ────────────────────────────────────────────────────────────────────────────

describe('Savings Calculation', () => {
  it('applies category-specific rates', () => {
    const settings = DEFAULT_SAVINGS_SETTINGS;

    const milestone = calculateSavingsAllocation(10_000_000, 'project_milestone', settings);
    expect(milestone.rate).toBe(12);
    expect(milestone.amount).toBe(1_200_000);

    const recurring = calculateSavingsAllocation(10_000_000, 'recurring', settings);
    expect(recurring.rate).toBe(8);
    expect(recurring.amount).toBe(800_000);

    const adHoc = calculateSavingsAllocation(10_000_000, 'ad_hoc', settings);
    expect(adHoc.rate).toBe(15);
    expect(adHoc.amount).toBe(1_500_000);
  });

  it('falls back to base rate for unknown categories', () => {
    const result = calculateSavingsAllocation(10_000_000, 'other', DEFAULT_SAVINGS_SETTINGS);
    expect(result.rate).toBe(10);
    expect(result.amount).toBe(1_000_000);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// CRISIS DETECTION TESTS
// ────────────────────────────────────────────────────────────────────────────

describe('Crisis Detection', () => {
  const buffer: CashBufferSettings = {
    minimumCashBuffer: 5_000_000,
    minimumBufferDays: 14,
    targetBufferDays: 30,
    crisisThresholdDays: 7,
  };

  it('detects crisis when balance drops below buffer', () => {
    const snapshots: DailySnapshot[] = [
      { date: '2026-03-07', closingBalance: 10_000_000 } as DailySnapshot,
      { date: '2026-03-08', closingBalance: 6_000_000 } as DailySnapshot,
      { date: '2026-03-09', closingBalance: 3_000_000 } as DailySnapshot,
    ];

    const result = detectCrisisMode(snapshots, buffer);
    expect(result.isCrisis).toBe(true);
    expect(result.crisisDate).toBe('2026-03-09');
    expect(result.shortfall).toBe(2_000_000);
  });

  it('returns no crisis when balance stays healthy', () => {
    const snapshots: DailySnapshot[] = [
      { date: '2026-03-07', closingBalance: 20_000_000 } as DailySnapshot,
      { date: '2026-03-08', closingBalance: 15_000_000 } as DailySnapshot,
    ];

    const result = detectCrisisMode(snapshots, buffer);
    expect(result.isCrisis).toBe(false);
  });
});

// ────────────────────────────────────────────────────────────────────────────
// REVENUE UNLOCK ACCELERATION TESTS
// ────────────────────────────────────────────────────────────────────────────

describe('Revenue Unlock Acceleration', () => {
  it('accelerates when multiplier > 2x, confidence > 70%, timeline < 30d', () => {
    const item = makeExpenditure({
      revenueUnlock: {
        enabled: true,
        unlockAmount: 15_000_000,
        unlockTimelineDays: 14,
        unlockConfidence: 80,
        unlockMultiplier: 3,
        dependencyChain: [],
      },
    });
    const result = evaluateRevenueUnlockAcceleration(item);
    expect(result.accelerate).toBe(true);
    expect(result.adjustedPriority).toBe('CRITICAL');
  });

  it('does not accelerate when disabled', () => {
    const item = makeExpenditure();
    const result = evaluateRevenueUnlockAcceleration(item);
    expect(result.accelerate).toBe(false);
  });
});
