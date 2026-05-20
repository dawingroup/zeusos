/**
 * Shared Scoring Engine for Cash Flow Optimizer
 *
 * Single source of truth for all scoring functions used by:
 * - dailyCashFlowOptimizer (scheduled)
 * - optimizerCallable (manual trigger, rescore, spend plan)
 * - cashFlowTriggers (real-time rescore on balance change / spend plan approval)
 *
 * Eliminates drift between duplicate scoring implementations.
 */

// ────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ────────────────────────────────────────────────────────────────────────────

const DEFAULT_SCORING_WEIGHTS = {
  urgency: 0.25,
  revenueUnlock: 0.25,
  risk: 0.15,
  cashPosition: 0.15,
  relationship: 0.10,
  operational: 0.10,
};

const DEFAULT_PRIORITY_THRESHOLDS = { critical: 80, high: 65, medium: 45, low: 25 };

const PROBABLE_DAMPENING_FACTOR = 0.7;

// ────────────────────────────────────────────────────────────────────────────
// UTILITY
// ────────────────────────────────────────────────────────────────────────────

function daysBetween(a, b) {
  const da = a instanceof Date ? a : new Date(a);
  const db = b instanceof Date ? b : new Date(b);
  return Math.round((db.getTime() - da.getTime()) / (1000 * 60 * 60 * 24));
}

/**
 * Normalize legacy commitment levels to canonical values.
 * 'projected' → 'probable' (legacy)
 * 'approved'  → 'committed' (legacy)
 */
function normalizeCommitmentLevel(level) {
  if (!level || level === 'projected') return 'probable';
  if (level === 'approved' || level === 'committed') return 'committed';
  return 'probable';
}

// ────────────────────────────────────────────────────────────────────────────
// 6-DIMENSION SCORING
// ────────────────────────────────────────────────────────────────────────────

function scoreUrgency(item, today) {
  if (!item.latestDate) return 50;
  const dueDate = item.latestDate.toDate ? item.latestDate.toDate() : new Date(item.latestDate);
  const todayDate = today || new Date();
  const daysLeft = daysBetween(todayDate, dueDate);

  if (daysLeft < 0) return 100; // overdue
  if (daysLeft === 0) return 95;
  if (daysLeft <= 3) return 85;
  if (daysLeft <= 7) return 70;
  if (daysLeft <= 14) return 50;
  if (daysLeft <= 30) return 30;
  return 15;
}

function scoreRevenueUnlock(item) {
  if (!item.revenueUnlock?.enabled) return 0;
  const mul = item.revenueUnlock.unlockMultiplier || item.revenueUnlock.revenueMultiplier || 1;
  const timeline = item.revenueUnlock.unlockTimelineDays || 30;
  const confidence = item.revenueUnlock.unlockConfidence || 50;

  const multiplierScore = Math.min(40, mul * 10);
  const timelineScore = timeline <= 7 ? 30 : timeline <= 14 ? 25 : timeline <= 30 ? 20 : timeline <= 60 ? 10 : 5;
  const confidenceScore = confidence * 0.3;

  return Math.round(multiplierScore + timelineScore + confidenceScore);
}

function scoreRisk(item) {
  if (!item.risk) return 50;
  // Support both numeric receiptRiskScore and string riskLevel
  if (typeof item.risk.receiptRiskScore === 'number') {
    return 100 - item.risk.receiptRiskScore;
  }
  if (item.risk.riskLevel === 'high') return 20;
  if (item.risk.riskLevel === 'medium') return 50;
  return 80;
}

function scoreCashPosition(item, context) {
  if (!context.currentBankBalance) return 50;
  const postPayment = context.currentBankBalance - (item.amountUGX || 0);
  const buffer = context.settings?.cashBufferSettings?.minimumCashBuffer || 5000000;

  if (postPayment > buffer * 3) return 100;
  if (postPayment > buffer * 2) return 80;
  if (postPayment > buffer) return 60;
  if (postPayment > 0) return 30;
  return 0;
}

function scoreRelationship(item) {
  if (item.category === 'statutory') return 100;
  if (item.category === 'rent') return 90;
  if (item.category === 'loan_repayment') return 95;
  if (item.risk?.vendorRelationshipRisk > 80) return 85;
  if (item.risk?.vendorRelationshipRisk > 50) return 60;
  return 30;
}

function scoreOperational(item) {
  if (item.risk?.operationalImpact > 80) return 90;
  if (item.risk?.operationalImpact > 50) return 60;
  if (item.risk?.operationalImpact > 20) return 30;
  // Fallback category-based scoring
  if (item.category === 'labor' || item.category === 'rent') return 80;
  if (item.category === 'utilities') return 70;
  if (item.category === 'materials' || item.category === 'equipment') return 60;
  return 10;
}

/**
 * Score an expenditure item on all 6 dimensions.
 */
function scoreAll(item, context, today) {
  return {
    urgency: scoreUrgency(item, today),
    revenueUnlock: scoreRevenueUnlock(item),
    risk: scoreRisk(item),
    cashPosition: scoreCashPosition(item, context),
    relationship: scoreRelationship(item),
    operational: scoreOperational(item),
  };
}

// ────────────────────────────────────────────────────────────────────────────
// COMPOSITE SCORE + TIER ASSIGNMENT
// ────────────────────────────────────────────────────────────────────────────

/**
 * Calculate weighted composite score. Applies dampening for 'probable' commitment.
 */
function calculateComposite(scores, weights, commitmentLevel) {
  const w = weights || DEFAULT_SCORING_WEIGHTS;
  const rawScore = Object.keys(w).reduce((total, key) => {
    return total + (scores[key] || 0) * w[key];
  }, 0);

  const normalized = normalizeCommitmentLevel(commitmentLevel);
  const dampened = normalized === 'probable' ? rawScore * PROBABLE_DAMPENING_FACTOR : rawScore;

  return Math.round(dampened);
}

/**
 * Assign priority tier from composite score.
 */
function assignTier(score, item, thresholds) {
  const t = thresholds || DEFAULT_PRIORITY_THRESHOLDS;

  // Override: statutory + contractual = always critical
  if (item.category === 'statutory' && item.risk?.contractualObligation) {
    return 'CRITICAL';
  }
  // Override: overdue items with penalties
  if (item.status === 'pending' && item.risk?.penaltyAmount > 0) {
    return 'CRITICAL';
  }
  // Statutory/loan items always at least HIGH
  if (item.category === 'statutory' || item.category === 'loan_repayment') {
    if (score >= t.critical) return 'CRITICAL';
    return 'HIGH';
  }

  if (score >= t.critical) return 'CRITICAL';
  if (score >= t.high) return 'HIGH';
  if (score >= t.medium) return 'MEDIUM';
  if (score >= t.low) return 'LOW';
  return 'DEFERRABLE';
}

// ────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ────────────────────────────────────────────────────────────────────────────

module.exports = {
  // Constants
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_PRIORITY_THRESHOLDS,
  PROBABLE_DAMPENING_FACTOR,
  // Utilities
  daysBetween,
  normalizeCommitmentLevel,
  // Individual dimension scorers
  scoreUrgency,
  scoreRevenueUnlock,
  scoreRisk,
  scoreCashPosition,
  scoreRelationship,
  scoreOperational,
  // Composite
  scoreAll,
  calculateComposite,
  assignTier,
};
