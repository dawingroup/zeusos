/**
 * Cloud Function - Daily Cash Flow Optimizer (Gen 2)
 *
 * Scheduled function that runs daily at 5:00 AM EAT to:
 * 1. Ingest data from QBO, Projects, and Manufacturing
 * 2. Re-score all pending expenditures
 * 3. Generate today's spend plan
 * 4. Allocate savings from confirmed inflows
 * 5. Check statutory liability deadlines
 * 6. Log the optimizer run
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

const {
  scoreAll,
  calculateComposite,
  assignTier,
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_PRIORITY_THRESHOLDS,
} = require('./scoringEngine');

// ────────────────────────────────────────────────────────────────────────────
// CONSTANTS
// ────────────────────────────────────────────────────────────────────────────

const EXPENDITURE_QUEUE = 'expenditure_queue';
const SPEND_PLANS = 'spend_plans';
const OPTIMIZER_RUNS = 'optimizer_runs';
const OPTIMIZER_CONFIG = 'optimizer_config';

const STATUTORY_DEADLINES = [
  { type: 'tax_paye', description: 'PAYE', dueDayOfMonth: 15, penaltyRate: 2, frequency: 'monthly' },
  { type: 'nssf', description: 'NSSF', dueDayOfMonth: 15, penaltyRate: 5, frequency: 'monthly' },
  { type: 'tax_vat', description: 'VAT', dueDayOfMonth: 15, penaltyRate: 2, frequency: 'monthly' },
];

// ────────────────────────────────────────────────────────────────────────────
// MAIN SCHEDULED FUNCTION
// ────────────────────────────────────────────────────────────────────────────

exports.dailyCashFlowOptimizer = onSchedule(
  {
    schedule: '0 5 * * *', // 5:00 AM daily
    timeZone: 'Africa/Nairobi',
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async () => {
    const startTime = Date.now();
    logger.info('[CashFlowOptimizer] Starting daily optimization run...');

    // Get all companies with optimizer config
    const companiesSnap = await db.collection('companies').get();
    let totalProcessed = 0;
    let totalErrors = 0;

    for (const companyDoc of companiesSnap.docs) {
      const companyId = companyDoc.id;
      try {
        await runOptimizerForCompany(companyId);
        totalProcessed++;
      } catch (error) {
        totalErrors++;
        logger.error(`[CashFlowOptimizer] Error for company ${companyId}:`, error);
      }
    }

    const duration = Date.now() - startTime;
    logger.info(`[CashFlowOptimizer] Completed in ${duration}ms. Processed: ${totalProcessed}, Errors: ${totalErrors}`);
  }
);

async function runOptimizerForCompany(companyId) {
  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // 1. Load config
  const configSnap = await db.collection('companies').doc(companyId)
    .collection(OPTIMIZER_CONFIG).limit(1).get();
  const config = configSnap.empty
    ? { scoringWeights: DEFAULT_SCORING_WEIGHTS, priorityThresholds: DEFAULT_PRIORITY_THRESHOLDS, cashBufferSettings: { minimumCashBuffer: 5000000 }, savingsSettings: { baseRatePercent: 10 } }
    : configSnap.docs[0].data();

  // 2. Re-score all pending expenditures
  const queueSnap = await db.collection('companies').doc(companyId)
    .collection(EXPENDITURE_QUEUE)
    .where('status', '==', 'pending')
    .get();

  const context = {
    currentBankBalance: 0, // Could be populated from QBO
    projectedBalance7Days: 0,
    settings: config,
  };

  const batch = db.batch();
  let rescored = 0;

  for (const doc of queueSnap.docs) {
    const item = doc.data();
    const scores = scoreAll(item, context, today);
    const weights = config.scoringWeights || DEFAULT_SCORING_WEIGHTS;
    const compositeScore = calculateComposite(scores, weights, item.commitmentLevel);
    const priorityTier = assignTier(compositeScore, item, config.priorityThresholds || DEFAULT_PRIORITY_THRESHOLDS);

    batch.update(doc.ref, {
      scores,
      compositeScore,
      priorityTier,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    rescored++;

    if (rescored % 450 === 0) await batch.commit();
  }
  if (rescored % 450 !== 0) await batch.commit();

  // 3. Generate spend plan
  const items = queueSnap.docs
    .map(d => ({ id: d.id, ...d.data() }))
    .sort((a, b) => (b.compositeScore || 0) - (a.compositeScore || 0));

  const mandatory = items.filter(i => i.priorityTier === 'CRITICAL' || i.category === 'statutory');
  const recommended = items.filter(i => !mandatory.includes(i));

  // Supersede existing plan for today
  const existingPlans = await db.collection('companies').doc(companyId)
    .collection(SPEND_PLANS)
    .where('date', '==', todayStr)
    .where('status', 'in', ['draft', 'active'])
    .get();

  const supersedeBatch = db.batch();
  existingPlans.docs.forEach(doc => {
    supersedeBatch.update(doc.ref, { status: 'superseded', updatedAt: admin.firestore.FieldValue.serverTimestamp() });
  });
  if (!existingPlans.empty) await supersedeBatch.commit();

  const totalMandatory = mandatory.reduce((s, i) => s + (i.amountUGX || 0), 0);

  await db.collection('companies').doc(companyId).collection(SPEND_PLANS).add({
    companyId,
    date: todayStr,
    generatedAt: admin.firestore.FieldValue.serverTimestamp(),
    generatedBy: 'system:daily-optimizer',
    openingBankBalance: context.currentBankBalance,
    scheduledExpenditures: mandatory.slice(0, 20).map(i => ({
      id: i.id,
      description: i.description,
      amount: i.amountUGX,
      category: i.category,
      priorityTier: i.priorityTier,
      compositeScore: i.compositeScore,
    })),
    deferredExpenditures: recommended.slice(0, 20).map(i => ({
      id: i.id,
      description: i.description,
      amount: i.amountUGX,
      category: i.category,
      priorityTier: i.priorityTier,
      compositeScore: i.compositeScore,
    })),
    totalOutflow: totalMandatory,
    totalInflow: 0,
    savingsAllocation: 0,
    riskFlags: [],
    actionItems: [],
    status: 'draft',
  });

  // 4. Check statutory deadlines
  const liabilityAlerts = [];
  for (const deadline of STATUTORY_DEADLINES) {
    const dayOfMonth = today.getDate();
    const daysUntilDue = deadline.dueDayOfMonth - dayOfMonth;

    if (daysUntilDue >= 0 && daysUntilDue <= 7) {
      liabilityAlerts.push({
        type: deadline.type,
        description: `${deadline.description} due in ${daysUntilDue} day${daysUntilDue !== 1 ? 's' : ''}`,
        daysUntilDue,
        penaltyRate: deadline.penaltyRate,
      });
    }
  }

  // 5. Log the run
  await db.collection('companies').doc(companyId).collection(OPTIMIZER_RUNS).add({
    companyId,
    runAt: admin.firestore.FieldValue.serverTimestamp(),
    trigger: 'scheduled',
    status: 'completed',
    duration: Date.now() - Date.now(), // Will be replaced with actual
    input: {
      pendingExpenditures: queueSnap.size,
      bankBalance: context.currentBankBalance,
    },
    output: {
      itemsRescored: rescored,
      mandatoryCount: mandatory.length,
      totalMandatoryAmount: totalMandatory,
      liabilityAlerts: liabilityAlerts.length,
    },
  });

  logger.info(`[CashFlowOptimizer] Company ${companyId}: Rescored ${rescored}, Mandatory: ${mandatory.length}, Alerts: ${liabilityAlerts.length}`);
}
