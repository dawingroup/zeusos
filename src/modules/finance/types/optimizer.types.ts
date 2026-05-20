// ============================================================================
// CASH FLOW OPTIMIZER TYPES
// DawinOS v2.0 - Cash Flow Optimization & Expenditure Prioritization Engine
// TypeScript interfaces for the algorithmic CFO system
// ============================================================================

import { Timestamp } from 'firebase/firestore';

// ----------------------------------------------------------------------------
// CASH FLOW PROJECTION — Rolling 90-day forward view
// ----------------------------------------------------------------------------

export interface CashFlowProjection {
  id: string;
  companyId: string;
  generatedAt: Timestamp;
  generatedBy: 'system' | 'manual';
  periodStart: Timestamp;
  periodEnd: Timestamp;
  subsidiaryId: string;

  openingBalance: number;

  /** Daily granularity for first 14 days */
  dailySnapshots: DailySnapshot[];
  /** Weekly granularity for days 15-90 */
  weeklySnapshots: WeeklySnapshot[];

  // Summary metrics
  minimumBalanceDate: string;
  minimumBalanceAmount: number;
  averageDailyBurn: number;
  runwayDays: number;

  metadata: {
    qboSyncedAt: Timestamp | null;
    projectsSyncedAt: Timestamp | null;
    manufacturingSyncedAt: Timestamp | null;
    confidenceScore: number; // 0-100
  };
}

export interface DailySnapshot {
  date: string; // YYYY-MM-DD
  openingBalance: number;

  confirmedReceipts: ScheduledAmount[];
  probableReceipts: ScheduledAmount[];
  possibleReceipts: ScheduledAmount[];
  totalProjectedInflow: number;

  mandatoryExpenditure: ScheduledAmount[];
  recommendedExpenditure: ScheduledAmount[];
  deferredExpenditure: ScheduledAmount[];
  savingsAllocation: number;
  totalProjectedOutflow: number;

  closingBalance: number;
  netCashFlow: number;
  cumulativeSavings: number;
}

export interface WeeklySnapshot {
  weekStartDate: string;
  weekEndDate: string;
  projectedInflow: number;
  projectedOutflow: number;
  netCashFlow: number;
  closingBalance: number;
}

export interface ScheduledAmount {
  id: string;
  description: string;
  amount: number;
  currency: 'UGX' | 'USD';
  exchangeRate?: number;
  sourceType: ExpenditureSourceType;
  sourceId: string;
  confidenceLevel: ConfidenceLevel;
  confidenceScore: number; // 0-100
}

export type ConfidenceLevel = 'confirmed' | 'probable' | 'possible';

export type ExpenditureSourceType =
  | 'project'
  | 'project_receipt'
  | 'purchase_order'
  | 'procurement_requirement'
  | 'manufacturing_order'
  | 'qbo_bill'
  | 'qbo_invoice'
  | 'recurring'
  | 'statutory'
  | 'vendor'
  | 'salary'
  | 'savings';

// ----------------------------------------------------------------------------
// EXPENDITURE QUEUE — Every pending expenditure scored and queued
// ----------------------------------------------------------------------------

export interface ExpenditureItem {
  id: string;
  companyId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;

  // Source identification
  projectId?: string;
  projectName?: string;
  subsidiaryId: string;
  phaseId?: string;
  phaseName?: string;

  // Financial details
  description: string;
  category: ExpenditureCategory;
  vendor?: string;
  vendorId?: string;
  amount: number;
  currency: 'UGX' | 'USD';
  exchangeRate?: number;
  amountUGX: number;

  // Source tracking
  sourceType: ExpenditureSourceType;
  sourceId: string; // PO ID, Bill ID, project phase ID, etc.

  // Timing
  requestedDate: Timestamp;
  earliestDate: Timestamp;
  latestDate: Timestamp;
  scheduledDate?: Timestamp;
  actualPaidDate?: Timestamp;

  // Scoring
  scores: ExpenditureScores;
  compositeScore: number; // 0-100
  priorityTier: PriorityTier;

  // Revenue unlock metadata
  revenueUnlock: RevenueUnlockInfo;

  // Risk metadata
  risk: ExpenditureRiskInfo;

  // Cost breakdown (enriched during ingestion — pure costs only, no markup)
  costBreakdown?: ItemCostBreakdown;

  /** If sourced from an outsourced PO, flag it */
  isOutsourcedPO?: boolean;

  // Cross-module links for navigation
  crossLinks?: ExpenditureCrossLinks;

  // Commitment tracking
  commitmentLevel?: CommitmentLevel;
  commitmentSource?: CommitmentSource;
  projectApprovalStatus?: string;

  // Status
  status: ExpenditureStatus;
  approvedBy?: string;
  approvalNote?: string;
  deferralReason?: string;

  // Audit trail
  statusHistory: StatusChange[];
}

export type ExpenditureCategory =
  | 'materials'
  | 'subcontractor'
  | 'labor'
  | 'equipment'
  | 'transport'
  | 'statutory'
  | 'rent'
  | 'utilities'
  | 'professional_fees'
  | 'overhead'
  | 'loan_repayment'
  | 'savings'
  | 'other';

export type PriorityTier = 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'DEFERRABLE';

export type ExpenditureStatus =
  | 'pending'
  | 'scheduled'
  | 'approved'
  | 'paid'
  | 'deferred'
  | 'cancelled';

export interface ExpenditureScores {
  urgencyScore: number;        // 0-100
  revenueUnlockScore: number;  // 0-100
  riskScore: number;           // 0-100
  cashPositionScore: number;   // 0-100
  relationshipScore: number;   // 0-100
  operationalScore: number;    // 0-100
}

export interface RevenueUnlockInfo {
  enabled: boolean;
  unlockAmount: number;
  unlockTimelineDays: number;
  unlockConfidence: number; // 0-100
  unlockMultiplier: number;
  dependencyChain: string[];
}

export interface ExpenditureRiskInfo {
  receiptRiskScore: number;         // 0-100
  vendorRelationshipRisk: number;
  operationalImpact: number;
  penaltyAmount: number;
  contractualObligation: boolean;
}

// ----------------------------------------------------------------------------
// ITEM COST BREAKDOWN — Granular pure-cost decomposition (no profit/overhead)
// ----------------------------------------------------------------------------

export interface ItemCostBreakdown {
  materialsCost: number;      // Raw materials (sheets, timber, linear, edging, hardware, procured goods)
  laborCost: number;          // Labor hours/days × rate
  processingCost: number;     // Machine processing (panel saw, edge banding, CNC)
  logisticsCost: number;      // Shipping, freight, customs, handling
  subcontractorCost: number;  // External contractor prices (lump sum, measured, quotes)
  totalPureCost: number;      // Sum of above — NO profit, NO overhead, NO management fee
  sourcingType: string;
  confidenceLevel: CostConfidenceLevel;
}

export type CostConfidenceLevel = 'estimated' | 'quoted' | 'actual';

// ----------------------------------------------------------------------------
// CROSS-MODULE LINKS — Navigation references to related entities
// ----------------------------------------------------------------------------

export interface ExpenditureCrossLinks {
  customerId?: string;
  customerName?: string;
  designProjectId?: string;
  designProjectName?: string;
  designItemId?: string;
  designItemName?: string;
  manufacturingOrderId?: string;
  manufacturingOrderRef?: string;
  purchaseOrderId?: string;
  purchaseOrderRef?: string;
  supplierId?: string;
  supplierName?: string;
  assetId?: string;
  assetName?: string;
  dealId?: string;
  dealName?: string;
}

// 'committed' = CRM deal won, quote approved + MO/PO exists, Shopify order, in production
// 'probable'  = CRM deal in negotiation/quotation, quote sent, active design
// 'projected' = LEGACY — treated as 'probable' at runtime
// 'approved'  = LEGACY — treated as 'committed' at runtime
export type CommitmentLevel = 'committed' | 'probable' | 'projected' | 'approved';

/** Evidence chain used to determine commitment level */
export interface CommitmentSource {
  level: 'committed' | 'probable';
  reason: string;
  crmDealId?: string;
  crmDealStage?: string;
  salesOrderId?: string;
  salesOrderStatus?: string;
  quoteApproved: boolean;
  hasMO: boolean;
  hasPO: boolean;
  hasShopifyOrder: boolean;
  evaluatedAt: string; // ISO date
}

export interface StatusChange {
  from: string;
  to: string;
  changedAt: Timestamp;
  changedBy: string;
  reason?: string;
}

// ----------------------------------------------------------------------------
// SPEND PLAN — Daily spend plan generated by the algorithm
// ----------------------------------------------------------------------------

export interface SpendPlan {
  id: string;
  companyId: string;
  date: string; // YYYY-MM-DD
  generatedAt: Timestamp;
  subsidiaryId: string;

  openingBankBalance: number;
  openingSavingsBalance: number;

  expectedReceipts: ExpectedReceipt[];
  scheduledExpenditures: PlannedExpenditure[];
  deferredExpenditures: PlannedExpenditure[];
  savingsAllocation: number;

  totalInflow: number;
  totalOutflow: number;
  netMovement: number;
  closingBalance: number;
  closingSavingsBalance: number;

  // AI CFO commentary
  advisoryBriefing?: string;
  riskFlags: RiskFlag[];
  actionItems: ActionItem[];

  // Lookahead
  next7DaysOutlook: WeekOutlook;

  // Override tracking
  manualOverrides: SpendOverride[];
  status: 'draft' | 'active' | 'closed' | 'superseded';
}

export interface PlannedExpenditure {
  expenditureId: string;
  description: string;
  amount: number;
  vendor?: string;
  category: ExpenditureCategory;
  priorityTier: PriorityTier;
  compositeScore: number;
  rationale: string;
  canDefer: boolean;
  deferUntil?: string;
  isPartialPayment?: boolean;
  originalAmount?: number;
}

export interface ExpectedReceipt {
  id: string;
  description: string;
  amount: number;
  source: string;
  sourceType: ExpenditureSourceType;
  sourceId: string;
  confidenceLevel: ConfidenceLevel;
  confidenceScore: number;
  expectedTime?: 'morning' | 'afternoon' | 'unknown';
}

export interface RiskFlag {
  severity: 'critical' | 'warning' | 'info';
  message: string;
  relatedExpenditureId?: string;
  suggestedAction: string;
}

export interface ActionItem {
  priority: number;
  action: string;
  deadline?: string;
  owner?: string;
}

export interface WeekOutlook {
  totalInflow: number;
  totalOutflow: number;
  minimumBalance: number;
  minimumBalanceDate: string;
  criticalActions: string[];
}

export interface SpendOverride {
  expenditureId: string;
  originalSchedule: string;
  overrideTo: string;
  overrideBy: string;
  reason: string;
  timestamp: Timestamp;
}

// ----------------------------------------------------------------------------
// SAVINGS LEDGER — Every savings allocation and withdrawal
// ----------------------------------------------------------------------------

export interface SavingsEntry {
  id: string;
  companyId: string;
  date: Timestamp;
  type: 'allocation' | 'withdrawal' | 'interest' | 'adjustment';

  triggerType?: 'auto_inflow' | 'manual' | 'surplus' | 'round_up';
  triggerSourceId?: string;
  inflowAmount?: number;

  amount: number; // Positive for allocations, negative for withdrawals
  runningBalance: number;

  withdrawalApprovedBy?: string;
  withdrawalReason?: string;
  withdrawalCategory?: 'emergency' | 'planned' | 'investment' | 'liability';

  subsidiaryId: string;
  note?: string;
  status?: 'pending_approval' | 'approved' | 'completed';
}

export interface SavingsPosition {
  totalBalance: number;
  totalAllocated: number;
  totalWithdrawn: number;
  subsidiaryId: string;
  lastAllocationDate?: Timestamp;
  monthlyAllocationTotal: number;
  monthlyWithdrawalTotal: number;
  settings: SavingsSettings;
}

export interface SavingsSettings {
  baseRatePercent: number;
  surplusRatePercent: number;
  surplusThreshold: number;
  categoryRates: {
    projectMilestonePayment: number;
    recurringIncome: number;
    adHocIncome: number;
  };
  withdrawalRequiresApproval: boolean;
  autoWithdrawForStatutory: boolean;
  minimumSavingsBalance: number;
  enableRoundUp: boolean;
  roundUpUnit: number;
}

// ----------------------------------------------------------------------------
// LIABILITY REGISTER — Known liabilities with deadlines
// ----------------------------------------------------------------------------

export interface Liability {
  id: string;
  companyId: string;
  type: LiabilityType;
  description: string;

  totalAmount: number;
  amountPaid: number;
  amountRemaining: number;
  currency: 'UGX' | 'USD';

  frequency: 'once' | 'monthly' | 'quarterly' | 'annually';
  nextDueDate: Timestamp;
  gracePeriodDays: number;
  penaltyRate?: number;

  priority: 'statutory' | 'contractual' | 'operational' | 'discretionary';
  isNonNegotiable: boolean;

  status: 'current' | 'due_soon' | 'overdue' | 'paid' | 'disputed';
  paymentHistory: LiabilityPayment[];

  vendorId?: string;
  vendorName?: string;
  contractReference?: string;
  qboLinkedBillId?: string;

  subsidiaryId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export type LiabilityType =
  | 'tax_paye'
  | 'tax_vat'
  | 'tax_corporate'
  | 'nssf'
  | 'rent'
  | 'loan'
  | 'vendor_credit'
  | 'retention'
  | 'guarantee'
  | 'insurance'
  | 'license'
  | 'utility_contract'
  | 'other';

export interface LiabilityPayment {
  date: Timestamp;
  amount: number;
  reference: string;
  method: string;
}

// ----------------------------------------------------------------------------
// OPTIMIZER CONFIG — Configurable weights and thresholds
// ----------------------------------------------------------------------------

export interface OptimizerConfig {
  id: string;
  companyId: string;
  subsidiaryId: string;

  scoringWeights: ScoringWeights;
  priorityThresholds: PriorityThresholds;
  cashBufferSettings: CashBufferSettings;
  savingsSettings: SavingsSettings;

  // Partial payment controls
  partialPaymentThreshold: number;
  minimumPartialPayment: number;

  updatedAt: Timestamp;
  updatedBy: string;
}

export interface ScoringWeights {
  urgency: number;
  revenueUnlock: number;
  risk: number;
  cashPosition: number;
  relationship: number;
  operational: number;
}

export interface PriorityThresholds {
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export interface CashBufferSettings {
  minimumCashBuffer: number;    // Absolute amount in UGX
  minimumBufferDays: number;    // Days of operating expenses
  targetBufferDays: number;
  crisisThresholdDays: number;
}

// ----------------------------------------------------------------------------
// OPTIMIZER RUN — Audit log of every optimization run
// ----------------------------------------------------------------------------

export interface OptimizerRun {
  id: string;
  companyId: string;
  subsidiaryId: string;
  runAt: Timestamp;
  runBy: 'system' | string;
  triggerType: 'scheduled' | 'manual' | 'event';

  inputSummary: {
    bankBalance: number;
    expenditureCount: number;
    receiptCount: number;
    dataSourcesFreshnessHours: Record<string, number>;
  };

  outputSummary: {
    planId: string;
    totalApproved: number;
    totalDeferred: number;
    savingsAllocated: number;
    crisisDetected: boolean;
    riskFlagsCount: number;
  };

  durationMs: number;
  status: 'success' | 'partial' | 'error';
  errorMessage?: string;
}

// ----------------------------------------------------------------------------
// SCORING CONTEXT — Runtime context for scoring decisions
// ----------------------------------------------------------------------------

export interface ScoringContext {
  currentBankBalance: number;
  projectedBalance7Days: number;
  projectedBalance30Days: number;
  averageDailyBurn: number;
  confirmedUpcomingReceipts: number;
  settings: OptimizerConfig;
  /** Client payment profiles keyed by customerId — used for receipt confidence scoring */
  clientPaymentProfiles?: Map<string, ClientPaymentProfile>;
}

// ----------------------------------------------------------------------------
// DATA INGESTION — Types for the multi-source ingestion pipeline
// ----------------------------------------------------------------------------

export interface IngestionResult {
  source: 'qbo' | 'projects' | 'manufacturing' | 'receipts' | 'liabilities';
  timestamp: Timestamp;
  itemsIngested: number;
  itemsUpdated: number;
  itemsSkipped: number;
  errors: string[];
}

export interface FullIngestionResult {
  startedAt: Timestamp;
  completedAt: Timestamp;
  sources: Record<string, IngestionResult>;
  totalExpenditureItems: number;
  totalReceiptItems: number;
}

// ----------------------------------------------------------------------------
// RECEIPT PROJECTION — Client payment profile for confidence scoring
// ----------------------------------------------------------------------------

export interface ClientPaymentProfile {
  clientId: string;
  clientName: string;
  averageDaysToPayment: number;
  paymentStdDeviation: number;
  paymentReliability: number; // 0-100
  outstandingBalance: number;
  lastPaymentDate?: string;
  paymentMethod: 'bank_transfer' | 'cheque' | 'mobile_money';
  contractType: 'private_individual' | 'private_corporate' | 'ngo' | 'government';
  totalHistoricalPayments: number;

  // Learning fields (populated by updateClientPaymentProfile trigger)
  totalPaymentsTracked: number;
  averagePaymentDelayDays: number; // Negative = pays early
  onTimePaymentRate: number;       // 0-1 (percent paid within 3 days)
  reliabilityScore: number;        // 0-100 (weighted recent history)
  recentPayments: PaymentRecord[];
  updatedAt?: Timestamp;
}

/** Historical payment record for client profile learning */
export interface PaymentRecord {
  receiptId: string;
  projectedDate: string;
  actualDate: string;
  varianceDays: number; // Positive = late, negative = early
  amount: number;
}

// ----------------------------------------------------------------------------
// PROJECTED RECEIPT — Firestore document for the projected_receipts collection
// Represents expected client income, NOT an expenditure
// ----------------------------------------------------------------------------

export interface ProjectedReceipt {
  id: string;
  companyId: string;
  sourceType: 'project_milestone' | 'project_final' | 'shopify_order' | 'qbo_invoice';
  sourceId: string;
  sourceName: string;
  customerId?: string;
  customerName?: string;

  amount: number;
  currency: 'UGX' | 'USD';

  expectedDate: Timestamp;
  confidenceLevel: ConfidenceLevel;
  confidenceScore: number; // 0-100

  // Milestone payments
  milestoneId?: string;
  milestoneName?: string;
  milestoneCompletionPercent?: number;

  // Status lifecycle
  status: 'projected' | 'invoiced' | 'overdue' | 'received' | 'cancelled';
  actualReceivedDate?: Timestamp;
  actualAmount?: number;

  subsidiaryId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PendingReceipt {
  id: string;
  amount: number;
  clientId: string;
  clientPaymentProfile: ClientPaymentProfile;
  projectId?: string;
  projectName?: string;
  milestoneId?: string;
  milestoneName?: string;
  milestoneComplete: boolean;
  milestoneProgress: number; // 0-100
  isInvoiced: boolean;
  invoiceDate?: string;
  invoiceAcknowledged?: boolean;
  daysOverdue: number;
  contractType: string;
  confidenceScore?: number;
  estimatedDate?: {
    optimistic: string;
    expected: string;
    pessimistic: string;
  };
}

// ----------------------------------------------------------------------------
// AI CFO ADVISORY — Types for the AI advisory layer
// ----------------------------------------------------------------------------

export interface CFOBriefing {
  id: string;
  companyId: string;
  subsidiaryId: string;
  date: string;
  generatedAt: Timestamp;

  executiveSummary: string;
  keyDecisions: CFODecision[];
  riskAlerts: RiskFlag[];
  recommendations: CFORecommendation[];
  cashOutlookNarrative: string;

  // Context used to generate
  contextSnapshot: {
    bankBalance: number;
    projectedMinBalance: number;
    criticalExpenditures: number;
    upcomingReceipts: number;
    savingsBalance: number;
    liabilitiesDueSoon: number;
  };
}

export interface CFODecision {
  decision: string;
  options: string[];
  recommendation: string;
  rationale: string;
  urgency: 'immediate' | 'today' | 'this_week';
}

export interface CFORecommendation {
  action: string;
  expectedImpact: string;
  priority: number;
  category: 'collections' | 'payments' | 'savings' | 'liabilities' | 'operations';
}

// ----------------------------------------------------------------------------
// SCENARIO ANALYSIS — What-if types
// ----------------------------------------------------------------------------

export interface ScenarioInput {
  id?: string;
  name: string;
  description: string;
  modifications: ScenarioModification[];
}

export interface ScenarioModification {
  type: 'delay_payment' | 'delay_receipt' | 'add_expense' | 'remove_expense' | 'change_amount' | 'late_receipt' | 'cash_injection' | 'cost_increase';
  targetId?: string;
  targetDescription?: string;
  originalValue?: number;
  newValue?: number;
  delayDays?: number;
  amount?: number;
  description?: string;
}

export interface ScenarioResult {
  scenarioId: string;
  scenarioName?: string;
  baseProjection: DailySnapshot[];
  scenarioProjection: DailySnapshot[];
  impactSummary: {
    minBalanceChange: number;
    crisisRiskChange: 'increased' | 'decreased' | 'unchanged';
    runwayDaysChange: number;
  };
  aiNarrative: string;

  // Enriched analysis from AI
  baseline?: { cashPosition: number };
  modified?: { cashPosition: number };
  analysis?: {
    impact: 'positive' | 'negative' | 'neutral';
    impactSummary: string;
    keyInsights: string[];
    recommendations: string[];
    tradeoffs: string[];
    riskAssessment: 'low' | 'medium' | 'high' | 'critical';
  };
}

// ----------------------------------------------------------------------------
// FILTER & QUERY TYPES
// ----------------------------------------------------------------------------

export interface ExpenditureFilters {
  priorityTier?: PriorityTier;
  category?: ExpenditureCategory;
  status?: ExpenditureStatus;
  sourceType?: ExpenditureSourceType;
  commitmentLevel?: CommitmentLevel;
  subsidiaryId?: string;
  projectId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
  searchTerm?: string;
}

export interface SpendPlanFilters {
  dateFrom?: string;
  dateTo?: string;
  status?: SpendPlan['status'];
  subsidiaryId?: string;
}

export interface LiabilityFilters {
  type?: LiabilityType;
  priority?: Liability['priority'];
  status?: Liability['status'];
  subsidiaryId?: string;
  dueBefore?: Date;
}

// ----------------------------------------------------------------------------
// PROJECTED RECEIPT FILTERS
// ----------------------------------------------------------------------------

export interface ReceiptFilters {
  confidenceLevel?: ConfidenceLevel;
  status?: ProjectedReceipt['status'];
  sourceType?: ProjectedReceipt['sourceType'];
  subsidiaryId?: string;
  customerId?: string;
  dateFrom?: Date;
  dateTo?: Date;
  minAmount?: number;
  maxAmount?: number;
  searchTerm?: string;
}
