// ============================================================================
// CASH FLOW OPTIMIZER ENGINE
// DawinOS v2.0 - Pure calculation functions, zero I/O
// Deterministic, fully testable scoring and constraint satisfaction
// ============================================================================

import type {
  ExpenditureItem,
  ExpenditureScores,
  ExpenditureCategory,
  CommitmentLevel,
  PriorityTier,
  ScoringWeights,
  PriorityThresholds,
  ScoringContext,
  PendingReceipt,
  DailySnapshot,
  ScheduledAmount,
  PlannedExpenditure,
  RiskFlag,
  ActionItem,
  SavingsSettings,
  CashBufferSettings,
  RevenueUnlockInfo,
} from '../types/optimizer.types';
import {
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_PRIORITY_THRESHOLDS,
  CRISIS_PRIORITY_ORDER,
  NON_DEFERRABLE_CATEGORIES,
  PROBABLE_DAMPENING_FACTOR,
} from '../constants/optimizer.constants';

// ────────────────────────────────────────────────────────────────────────────
// UTILITY HELPERS
// ────────────────────────────────────────────────────────────────────────────

/** Days between two dates (positive if b is after a) */
export function daysBetween(a: Date | string, b: Date | string): number {
  const da = typeof a === 'string' ? new Date(a) : a;
  const db = typeof b === 'string' ? new Date(b) : b;
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

/** Add days to a date, return YYYY-MM-DD */
export function addDays(date: Date | string, days: number): string {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  d.setDate(d.getDate() + days);
  return formatDate(d);
}

/** Format date as YYYY-MM-DD */
export function formatDate(date: Date): string {
  return date.toISOString().split('T')[0];
}

/** Format UGX amount */
export function formatUGX(amount: number): string {
  return `UGX ${Math.round(amount).toLocaleString('en-UG')}`;
}

/** Clamp a value between min and max */
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Normalize legacy commitment levels to the canonical values.
 * 'projected' → 'probable' (legacy mapping)
 * 'approved'  → 'committed' (legacy mapping)
 */
export function normalizeCommitmentLevel(
  level?: CommitmentLevel
): 'committed' | 'probable' {
  if (!level || level === 'projected') return 'probable';
  if (level === 'approved' || level === 'committed') return 'committed';
  return 'probable';
}

// ────────────────────────────────────────────────────────────────────────────
// EXPENDITURE SCORING — 6-dimension scoring algorithm
// ────────────────────────────────────────────────────────────────────────────

/**
 * Score an expenditure on 6 dimensions.
 * Each dimension returns 0-100. Higher = more urgent to pay.
 */
export function scoreExpenditure(
  item: ExpenditureItem,
  context: ScoringContext,
  today: Date = new Date()
): ExpenditureScores {
  return {
    urgencyScore: calculateUrgency(item, today),
    revenueUnlockScore: calculateRevenueUnlock(item.revenueUnlock),
    riskScore: calculateRisk(item),
    cashPositionScore: calculateCashPosition(item, context),
    relationshipScore: calculateRelationshipImpact(item),
    operationalScore: calculateOperationalImpact(item),
  };
}

/**
 * Calculate composite score from 6 dimensions using configurable weights.
 * When commitmentLevel is 'probable', the score is dampened by PROBABLE_DAMPENING_FACTOR
 * to deprioritize uncertain expenditures.
 */
export function calculateCompositeScore(
  scores: ExpenditureScores,
  weights: ScoringWeights = DEFAULT_SCORING_WEIGHTS,
  commitmentLevel?: CommitmentLevel
): number {
  const rawScore =
    scores.urgencyScore * weights.urgency +
    scores.revenueUnlockScore * weights.revenueUnlock +
    scores.riskScore * weights.risk +
    scores.cashPositionScore * weights.cashPosition +
    scores.relationshipScore * weights.relationship +
    scores.operationalScore * weights.operational;

  const normalized = normalizeCommitmentLevel(commitmentLevel);
  const dampened = normalized === 'probable'
    ? rawScore * PROBABLE_DAMPENING_FACTOR
    : rawScore;

  return Math.round(dampened);
}

/**
 * Assign a priority tier based on composite score and override rules.
 */
export function assignPriorityTier(
  compositeScore: number,
  item: Pick<ExpenditureItem, 'category' | 'status' | 'risk'>,
  thresholds: PriorityThresholds = DEFAULT_PRIORITY_THRESHOLDS
): PriorityTier {
  // Override: statutory + contractual = always critical
  if (item.category === 'statutory' && item.risk.contractualObligation) {
    return 'CRITICAL';
  }
  // Override: overdue items
  if (item.status === 'pending' && item.risk.penaltyAmount > 0) {
    return 'CRITICAL';
  }

  if (compositeScore >= thresholds.critical) return 'CRITICAL';
  if (compositeScore >= thresholds.high) return 'HIGH';
  if (compositeScore >= thresholds.medium) return 'MEDIUM';
  if (compositeScore >= thresholds.low) return 'LOW';
  return 'DEFERRABLE';
}

// ── DIMENSION 1: URGENCY — How close to deadline? ──
function calculateUrgency(item: ExpenditureItem, today: Date): number {
  const latestDate = item.latestDate instanceof Date
    ? item.latestDate
    : (item.latestDate as unknown as { toDate: () => Date }).toDate();
  const daysUntilDeadline = daysBetween(today, latestDate);

  if (daysUntilDeadline < 0) return 100;   // OVERDUE
  if (daysUntilDeadline === 0) return 95;   // Due today
  if (daysUntilDeadline <= 2) return 85;
  if (daysUntilDeadline <= 7) return 70;
  if (daysUntilDeadline <= 14) return 50;
  if (daysUntilDeadline <= 30) return 30;
  return 15;
}

// ── DIMENSION 2: REVENUE UNLOCK — Does paying this unlock income? ──
function calculateRevenueUnlock(unlock: RevenueUnlockInfo): number {
  if (!unlock.enabled) return 0;

  const multiplier = unlock.unlockMultiplier;
  const timelineDays = unlock.unlockTimelineDays;
  const confidence = unlock.unlockConfidence;

  // Multiplier component (0-40)
  const multiplierScore = Math.min(40, multiplier * 10);

  // Timeline component (0-30) — faster unlock = higher score
  const timelineScore =
    timelineDays <= 7 ? 30 :
    timelineDays <= 14 ? 25 :
    timelineDays <= 30 ? 20 :
    timelineDays <= 60 ? 10 : 5;

  // Confidence component (0-30)
  const confidenceScore = confidence * 0.3;

  return Math.round(multiplierScore + timelineScore + confidenceScore);
}

// ── DIMENSION 3: RISK — Is the linked receipt risky? (INVERTED) ──
function calculateRisk(item: ExpenditureItem): number {
  // High receipt risk → LOW score (defer aggressively)
  // Low receipt risk → HIGH score (safe to pay)
  return 100 - item.risk.receiptRiskScore;
}

// ── DIMENSION 4: CASH POSITION — Can we afford it? ──
function calculateCashPosition(
  item: ExpenditureItem,
  context: ScoringContext
): number {
  const afterPayment = context.currentBankBalance - item.amountUGX;
  const buffer = context.settings.cashBufferSettings.minimumCashBuffer;

  if (afterPayment > buffer * 3) return 100;
  if (afterPayment > buffer * 2) return 80;
  if (afterPayment > buffer) return 60;
  if (afterPayment > 0) return 30;
  return 0; // Would go negative
}

// ── DIMENSION 5: RELATIONSHIP — Vendor/client impact ──
function calculateRelationshipImpact(item: ExpenditureItem): number {
  if (item.category === 'statutory') return 100;
  if (item.category === 'rent') return 90;
  if (item.category === 'loan_repayment') return 95;

  if (item.risk.vendorRelationshipRisk > 80) return 85;
  if (item.risk.vendorRelationshipRisk > 50) return 60;
  return 30;
}

// ── DIMENSION 6: OPERATIONAL — Impact on operations if delayed ──
function calculateOperationalImpact(item: ExpenditureItem): number {
  if (item.risk.operationalImpact > 80) return 90;
  if (item.risk.operationalImpact > 50) return 60;
  if (item.risk.operationalImpact > 20) return 30;
  return 10;
}

// ────────────────────────────────────────────────────────────────────────────
// RECEIPT CONFIDENCE SCORING
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calculate a confidence score (0-100) for a pending receipt.
 */
export function calculateReceiptConfidence(receipt: PendingReceipt): number {
  let score = 50;

  // Factor 1: Invoice status (+/- 20)
  if (receipt.isInvoiced) {
    score += 15;
    if (receipt.invoiceAcknowledged) score += 5;
  } else {
    score -= 10;
  }

  // Factor 2: Client payment history (+/- 15)
  const profile = receipt.clientPaymentProfile;
  if (profile.paymentReliability > 80) score += 15;
  else if (profile.paymentReliability > 60) score += 5;
  else if (profile.paymentReliability < 40) score -= 15;

  // Factor 3: Milestone completion (+/- 10)
  if (receipt.milestoneComplete) score += 10;
  else if (receipt.milestoneProgress > 80) score += 5;
  else score -= 5;

  // Factor 4: Contract type (+/- 10)
  if (receipt.contractType === 'government' || receipt.contractType === 'ngo') {
    score -= 5;
    if (receipt.isInvoiced) score += 5;
  } else if (receipt.contractType === 'private_corporate') {
    score += 5;
  }

  // Factor 5: Amount relative to client's usual (+/- 5)
  if (receipt.amount > profile.outstandingBalance * 2 && profile.totalHistoricalPayments > 0) {
    score -= 5;
  }

  // Factor 6: Days overdue
  if (receipt.daysOverdue > 0) {
    score -= Math.min(20, receipt.daysOverdue);
  }

  return clamp(score, 0, 100);
}

/**
 * Estimate when a receipt will arrive: optimistic, expected, pessimistic.
 */
export function estimateReceiptDate(
  receipt: PendingReceipt,
  baseDate?: string
): { optimistic: string; expected: string; pessimistic: string } {
  const base = baseDate || receipt.invoiceDate || formatDate(new Date());
  const profile = receipt.clientPaymentProfile;

  const avgDays = profile.averageDaysToPayment || 30;
  const stdDev = profile.paymentStdDeviation || avgDays * 0.3;

  // Payment method adjustment
  const methodAdj: Record<string, number> = {
    mobile_money: -2,
    bank_transfer: 0,
    cheque: 5,
  };
  const methodOffset = methodAdj[profile.paymentMethod] ?? 0;

  // Contract type adjustment
  const contractAdj: Record<string, number> = {
    private_individual: -3,
    private_corporate: 0,
    ngo: 10,
    government: 21,
  };
  const contractOffset = contractAdj[profile.contractType] ?? 0;

  const adjustedAvg = avgDays + methodOffset + contractOffset;

  return {
    optimistic: addDays(base, Math.max(1, Math.round(adjustedAvg - stdDev))),
    expected: addDays(base, Math.round(adjustedAvg)),
    pessimistic: addDays(base, Math.round(adjustedAvg + stdDev * 1.5)),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// DAILY SPEND PLAN GENERATOR
// ────────────────────────────────────────────────────────────────────────────

export interface SpendPlanInput {
  bankBalance: number;
  savingsBalance: number;
  todaysReceipts: Array<{ amount: number; confidenceLevel: string; description: string; source: string }>;
  queue: ExpenditureItem[];
  settings: {
    minimumCashBuffer: number;
    savingsRatePercent: number;
    partialPaymentThreshold: number;
    minimumPartialPayment: number;
  };
  today: Date;
}

/**
 * Generate a daily spend plan using greedy constraint satisfaction.
 */
export function generateDailySpendPlan(input: SpendPlanInput): {
  scheduled: PlannedExpenditure[];
  deferred: PlannedExpenditure[];
  savingsAllocation: number;
  riskFlags: RiskFlag[];
  actionItems: ActionItem[];
  isCrisisMode: boolean;
} {
  const { bankBalance, todaysReceipts, queue, settings, today } = input;

  // Step 1: Calculate available cash
  const confirmedReceipts = todaysReceipts
    .filter(r => r.confidenceLevel === 'confirmed')
    .reduce((sum, r) => sum + r.amount, 0);

  const availableCash = bankBalance + confirmedReceipts;
  const spendableCash = Math.max(0, availableCash - settings.minimumCashBuffer);

  // Step 2: Apply savings mandate FIRST
  const savingsAllocation = Math.round(confirmedReceipts * settings.savingsRatePercent / 100);
  const spendableAfterSavings = spendableCash - savingsAllocation;

  // Step 3: Separate mandatory from discretionary
  const mandatory = queue.filter(item =>
    item.priorityTier === 'CRITICAL' &&
    isOverdueOrDueToday(item, today)
  );

  const mandatoryTotal = mandatory.reduce((sum, item) => sum + item.amountUGX, 0);

  if (mandatoryTotal > spendableAfterSavings) {
    // CRISIS MODE
    return generateCrisisSpendPlan(mandatory, spendableAfterSavings, input.savingsBalance, settings);
  }

  // Step 4: Allocate remaining to discretionary by score
  const discretionary = queue
    .filter(item => !mandatory.some(m => m.id === item.id))
    .filter(item => isOverdueOrDueToday(item, today))
    .sort((a, b) => b.compositeScore - a.compositeScore);

  let remainingCash = spendableAfterSavings - mandatoryTotal;
  const scheduled: PlannedExpenditure[] = [];
  const deferred: PlannedExpenditure[] = [];
  const riskFlags: RiskFlag[] = [];

  // Add mandatory first
  for (const item of mandatory) {
    scheduled.push(toPlannedExpenditure(item, 'Mandatory — past deadline or due today'));
  }

  // Greedily allocate by score
  for (const item of discretionary) {
    if (item.amountUGX <= remainingCash) {
      scheduled.push(toPlannedExpenditure(item, generateRationale(item)));
      remainingCash -= item.amountUGX;
    } else if (
      item.category === 'materials' &&
      item.amountUGX > settings.partialPaymentThreshold
    ) {
      const partialAmount = Math.min(remainingCash, item.amountUGX * 0.5);
      if (partialAmount >= settings.minimumPartialPayment) {
        scheduled.push({
          expenditureId: item.id,
          description: item.description,
          amount: partialAmount,
          vendor: item.vendor,
          category: item.category,
          priorityTier: item.priorityTier,
          compositeScore: item.compositeScore,
          rationale: `Partial payment (${Math.round(partialAmount / item.amountUGX * 100)}%) — cash constrained`,
          canDefer: false,
          isPartialPayment: true,
          originalAmount: item.amountUGX,
        });
        remainingCash -= partialAmount;
      } else {
        deferred.push(toDeferredExpenditure(item));
      }
    } else {
      deferred.push(toDeferredExpenditure(item));
    }
  }

  // Generate risk flags
  if (deferred.length > 0) {
    const deferredTotal = deferred.reduce((sum, e) => sum + e.amount, 0);
    riskFlags.push({
      severity: 'warning',
      message: `${deferred.length} expenditures totalling ${formatUGX(deferredTotal)} deferred due to cash constraints`,
      suggestedAction: 'Review deferred items and accelerate collections if possible',
    });
  }

  const actionItems = generateActionItems(scheduled, deferred, remainingCash);

  return {
    scheduled,
    deferred,
    savingsAllocation,
    riskFlags,
    actionItems,
    isCrisisMode: false,
  };
}

/**
 * Crisis mode: not enough cash for mandatory spend.
 */
export function generateCrisisSpendPlan(
  mandatory: ExpenditureItem[],
  availableCash: number,
  savingsBalance: number,
  _settings: { minimumCashBuffer: number }
): {
  scheduled: PlannedExpenditure[];
  deferred: PlannedExpenditure[];
  savingsAllocation: number;
  riskFlags: RiskFlag[];
  actionItems: ActionItem[];
  isCrisisMode: boolean;
} {
  // Sort by crisis priority order
  const sorted = [...mandatory].sort((a, b) => {
    const aIdx = CRISIS_PRIORITY_ORDER.indexOf(a.category);
    const bIdx = CRISIS_PRIORITY_ORDER.indexOf(b.category);
    return (aIdx === -1 ? 99 : aIdx) - (bIdx === -1 ? 99 : bIdx);
  });

  let cash = availableCash;
  const scheduled: PlannedExpenditure[] = [];
  const deferred: PlannedExpenditure[] = [];

  for (const item of sorted) {
    if (item.amountUGX <= cash) {
      scheduled.push(toPlannedExpenditure(item, `CRISIS: Priority — ${item.category}`));
      cash -= item.amountUGX;
    } else {
      deferred.push(toDeferredExpenditure(item));
    }
  }

  const shortfallAmount = deferred.reduce((sum, e) => sum + e.amount, 0);

  const riskFlags: RiskFlag[] = [{
    severity: 'critical',
    message: `CASH SHORTFALL: ${formatUGX(shortfallAmount)} in mandatory expenditures cannot be covered. ` +
             `Savings balance: ${formatUGX(savingsBalance)}. Immediate action required.`,
    suggestedAction: shortfallAmount <= savingsBalance
      ? `Draw ${formatUGX(shortfallAmount)} from savings to cover shortfall`
      : 'Collections blitz needed: contact clients with overdue invoices immediately',
  }];

  const actionItems: ActionItem[] = [
    { priority: 1, action: 'Review and approve crisis spend plan', deadline: 'Today 9:00 AM', owner: 'CEO' },
    { priority: 2, action: `Contact top debtors to accelerate ${formatUGX(shortfallAmount)} in collections`, deadline: 'Today', owner: 'Finance' },
    { priority: 3, action: 'Evaluate cross-subsidiary cash transfer', deadline: 'Today', owner: 'CEO' },
  ];

  return {
    scheduled,
    deferred,
    savingsAllocation: 0, // No savings in crisis mode
    riskFlags,
    actionItems,
    isCrisisMode: true,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// CASH FLOW PROJECTION
// ────────────────────────────────────────────────────────────────────────────

export interface ProjectionInput {
  openingBalance: number;
  receipts: Array<{
    date: string;
    amount: number;
    confidenceLevel: string;
    confidenceScore: number;
    description: string;
  }>;
  expenditures: Array<{
    date: string;
    amount: number;
    category: ExpenditureCategory;
    priorityTier: PriorityTier;
    description: string;
  }>;
  savingsRatePercent: number;
  days: number;
  startDate?: string;
}

/**
 * Project cash flow forward for N days.
 */
export function projectCashFlow(input: ProjectionInput): DailySnapshot[] {
  const { openingBalance, receipts, expenditures, savingsRatePercent, days } = input;
  const start = input.startDate || formatDate(new Date());
  const snapshots: DailySnapshot[] = [];

  let balance = openingBalance;
  let cumulativeSavings = 0;

  for (let i = 0; i < days; i++) {
    const date = addDays(start, i);

    const dayReceipts = receipts.filter(r => r.date === date);
    const dayExpenditures = expenditures.filter(e => e.date === date);

    const confirmed = dayReceipts.filter(r => r.confidenceLevel === 'confirmed');
    const probable = dayReceipts.filter(r => r.confidenceLevel === 'probable');
    const possible = dayReceipts.filter(r => r.confidenceLevel === 'possible');

    const totalInflow =
      confirmed.reduce((s, r) => s + r.amount, 0) +
      probable.reduce((s, r) => s + r.amount * 0.7, 0) +
      possible.reduce((s, r) => s + r.amount * 0.3, 0);

    const mandatory = dayExpenditures.filter(e =>
      e.priorityTier === 'CRITICAL' || e.priorityTier === 'HIGH'
    );
    const recommended = dayExpenditures.filter(e =>
      e.priorityTier === 'MEDIUM'
    );
    const deferrable = dayExpenditures.filter(e =>
      e.priorityTier === 'LOW' || e.priorityTier === 'DEFERRABLE'
    );

    const totalOutflow = dayExpenditures.reduce((s, e) => s + e.amount, 0);
    const savings = Math.round(
      confirmed.reduce((s, r) => s + r.amount, 0) * savingsRatePercent / 100
    );
    cumulativeSavings += savings;

    const netCashFlow = totalInflow - totalOutflow - savings;
    balance += netCashFlow;

    const toScheduled = (items: typeof dayReceipts): ScheduledAmount[] =>
      items.map(r => ({
        id: `${date}-${r.description}`,
        description: r.description,
        amount: r.amount,
        currency: 'UGX' as const,
        sourceType: 'project' as const,
        sourceId: '',
        confidenceLevel: (r.confidenceLevel || 'possible') as 'confirmed' | 'probable' | 'possible',
        confidenceScore: r.confidenceScore || 50,
      }));

    const toExpScheduled = (items: typeof dayExpenditures): ScheduledAmount[] =>
      items.map(e => ({
        id: `${date}-${e.description}`,
        description: e.description,
        amount: e.amount,
        currency: 'UGX' as const,
        sourceType: 'project' as const,
        sourceId: '',
        confidenceLevel: 'confirmed' as const,
        confidenceScore: 100,
      }));

    snapshots.push({
      date,
      openingBalance: balance - netCashFlow,
      confirmedReceipts: toScheduled(confirmed),
      probableReceipts: toScheduled(probable),
      possibleReceipts: toScheduled(possible),
      totalProjectedInflow: totalInflow,
      mandatoryExpenditure: toExpScheduled(mandatory),
      recommendedExpenditure: toExpScheduled(recommended),
      deferredExpenditure: toExpScheduled(deferrable),
      savingsAllocation: savings,
      totalProjectedOutflow: totalOutflow + savings,
      closingBalance: balance,
      netCashFlow,
      cumulativeSavings,
    });
  }

  return snapshots;
}

// ────────────────────────────────────────────────────────────────────────────
// SAVINGS CALCULATION
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calculate savings allocation for an inflow.
 */
export function calculateSavingsAllocation(
  inflowAmount: number,
  inflowCategory: 'project_milestone' | 'recurring' | 'ad_hoc' | 'other',
  settings: SavingsSettings
): { amount: number; rate: number; note: string } {
  let rate = settings.baseRatePercent;

  if (inflowCategory === 'project_milestone') {
    rate = settings.categoryRates.projectMilestonePayment;
  } else if (inflowCategory === 'recurring') {
    rate = settings.categoryRates.recurringIncome;
  } else if (inflowCategory === 'ad_hoc') {
    rate = settings.categoryRates.adHocIncome;
  }

  const amount = Math.round(inflowAmount * rate / 100);

  return {
    amount,
    rate,
    note: `Auto-saved ${rate}% of ${formatUGX(inflowAmount)}`,
  };
}

// ────────────────────────────────────────────────────────────────────────────
// CRISIS DETECTION
// ────────────────────────────────────────────────────────────────────────────

/**
 * Detect if projections indicate a cash crisis.
 */
export function detectCrisisMode(
  snapshots: DailySnapshot[],
  bufferSettings: CashBufferSettings
): {
  isCrisis: boolean;
  crisisDay: number | null;
  crisisDate: string | null;
  shortfall: number;
  daysUntilCrisis: number | null;
} {
  for (let i = 0; i < snapshots.length; i++) {
    const snap = snapshots[i];
    if (snap.closingBalance < bufferSettings.minimumCashBuffer) {
      return {
        isCrisis: true,
        crisisDay: i,
        crisisDate: snap.date,
        shortfall: bufferSettings.minimumCashBuffer - snap.closingBalance,
        daysUntilCrisis: i,
      };
    }
  }

  return {
    isCrisis: false,
    crisisDay: null,
    crisisDate: null,
    shortfall: 0,
    daysUntilCrisis: null,
  };
}

/**
 * Evaluate whether an expenditure should be accelerated for revenue unlock.
 */
export function evaluateRevenueUnlockAcceleration(
  item: ExpenditureItem
): { accelerate: boolean; reason: string; adjustedPriority?: PriorityTier } {
  if (!item.revenueUnlock.enabled) return { accelerate: false, reason: '' };

  const { unlockMultiplier, unlockConfidence, unlockTimelineDays, unlockAmount } = item.revenueUnlock;

  const shouldAccelerate =
    (unlockMultiplier > 2 && unlockConfidence > 70 && unlockTimelineDays < 30) ||
    (unlockMultiplier > 3 && unlockConfidence > 50);

  if (shouldAccelerate) {
    return {
      accelerate: true,
      reason: `Spending ${formatUGX(item.amountUGX)} unlocks ${formatUGX(unlockAmount)} ` +
              `(${unlockMultiplier.toFixed(1)}x return) within ${unlockTimelineDays} days ` +
              `at ${unlockConfidence}% confidence`,
      adjustedPriority: 'CRITICAL',
    };
  }

  return { accelerate: false, reason: '' };
}

// ────────────────────────────────────────────────────────────────────────────
// HELPER FUNCTIONS
// ────────────────────────────────────────────────────────────────────────────

function isOverdueOrDueToday(item: ExpenditureItem, today: Date): boolean {
  const requestedDate = item.requestedDate instanceof Date
    ? item.requestedDate
    : (item.requestedDate as unknown as { toDate: () => Date }).toDate();
  return daysBetween(today, requestedDate) <= 0;
}

function toPlannedExpenditure(item: ExpenditureItem, rationale: string): PlannedExpenditure {
  return {
    expenditureId: item.id,
    description: item.description,
    amount: item.amountUGX,
    vendor: item.vendor,
    category: item.category,
    priorityTier: item.priorityTier,
    compositeScore: item.compositeScore,
    rationale,
    canDefer: !NON_DEFERRABLE_CATEGORIES.includes(item.category),
  };
}

function toDeferredExpenditure(item: ExpenditureItem): PlannedExpenditure {
  return {
    expenditureId: item.id,
    description: item.description,
    amount: item.amountUGX,
    vendor: item.vendor,
    category: item.category,
    priorityTier: item.priorityTier,
    compositeScore: item.compositeScore,
    rationale: 'Deferred — insufficient cash or lower priority',
    canDefer: true,
    deferUntil: addDays(new Date(), 7),
  };
}

function generateRationale(item: ExpenditureItem): string {
  const parts: string[] = [];

  if (item.compositeScore >= 80) parts.push('High priority');
  if (item.revenueUnlock.enabled && item.revenueUnlock.unlockMultiplier > 1.5) {
    parts.push(`unlocks ${item.revenueUnlock.unlockMultiplier.toFixed(1)}x revenue`);
  }
  if (item.risk.contractualObligation) parts.push('contractual obligation');
  if (item.risk.operationalImpact > 70) parts.push('operations depend on this');

  return parts.length > 0
    ? parts.join(', ').replace(/^./, s => s.toUpperCase())
    : `Score: ${item.compositeScore}/100`;
}

function generateActionItems(
  scheduled: PlannedExpenditure[],
  deferred: PlannedExpenditure[],
  remainingCash: number
): ActionItem[] {
  const items: ActionItem[] = [];

  if (scheduled.length > 0) {
    items.push({
      priority: 1,
      action: `Process ${scheduled.length} approved payments totalling ${formatUGX(scheduled.reduce((s, e) => s + e.amount, 0))}`,
      deadline: 'Today',
      owner: 'Finance',
    });
  }

  if (deferred.length > 0) {
    items.push({
      priority: 2,
      action: `Review ${deferred.length} deferred items — check if any can be rescheduled`,
      deadline: 'Today',
      owner: 'Finance Manager',
    });
  }

  if (remainingCash > 0) {
    items.push({
      priority: 3,
      action: `Surplus cash of ${formatUGX(remainingCash)} available for allocation`,
      owner: 'CFO',
    });
  }

  return items;
}
