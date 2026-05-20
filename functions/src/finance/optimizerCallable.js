/**
 * Cloud Function - Cash Flow Optimizer Callable Functions (Gen 2)
 *
 * onCall functions for:
 * - triggerOptimizer: Manually trigger the daily optimization
 * - generateSpendPlan: Generate a spend plan for a specific date
 * - rescoreExpenditures: Re-score all pending expenditures
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

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
// TRIGGER OPTIMIZER
// ────────────────────────────────────────────────────────────────────────────

exports.triggerOptimizer = onCall(
  {
    cors: ALLOWED_ORIGINS,
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { companyId } = request.data;
    if (!companyId) {
      throw new HttpsError('invalid-argument', 'companyId is required');
    }

    logger.info(`[OptimizerCallable] Manual trigger for company ${companyId} by ${request.auth.uid}`);
    const startTime = Date.now();

    try {
      // Re-score pending items
      const queueSnap = await db.collection('companies').doc(companyId)
        .collection('expenditure_queue')
        .where('status', '==', 'pending')
        .get();

      const batch = db.batch();
      let count = 0;

      const context = {
        currentBankBalance: 0,
        settings: { cashBufferSettings: { minimumCashBuffer: 5000000 } },
      };

      for (const doc of queueSnap.docs) {
        const item = doc.data();
        const scores = scoreAll(item, context, new Date());
        const composite = calculateComposite(scores, DEFAULT_SCORING_WEIGHTS, item.commitmentLevel);
        const tier = assignTier(composite, item, DEFAULT_PRIORITY_THRESHOLDS);

        batch.update(doc.ref, {
          scores,
          compositeScore: composite,
          priorityTier: tier,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        count++;
        if (count % 450 === 0) await batch.commit();
      }
      if (count % 450 !== 0) await batch.commit();

      const duration = Date.now() - startTime;

      // Log the run
      await db.collection('companies').doc(companyId).collection('optimizer_runs').add({
        companyId,
        runAt: admin.firestore.FieldValue.serverTimestamp(),
        trigger: 'manual',
        triggeredBy: request.auth.uid,
        status: 'completed',
        duration,
        input: { pendingExpenditures: queueSnap.size },
        output: { itemsRescored: count },
      });

      return {
        success: true,
        itemsRescored: count,
        duration,
      };
    } catch (error) {
      logger.error('[OptimizerCallable] Error:', error);
      throw new HttpsError('internal', error.message);
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// GENERATE SPEND PLAN
// ────────────────────────────────────────────────────────────────────────────

exports.generateSpendPlan = onCall(
  {
    cors: ALLOWED_ORIGINS,
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { companyId, bankBalance, savingsBalance, date } = request.data;
    if (!companyId) {
      throw new HttpsError('invalid-argument', 'companyId is required');
    }

    const targetDate = date || new Date().toISOString().split('T')[0];
    logger.info(`[OptimizerCallable] Generating spend plan for ${companyId} on ${targetDate}`);

    // Get pending items sorted by score
    const queueSnap = await db.collection('companies').doc(companyId)
      .collection('expenditure_queue')
      .where('status', '==', 'pending')
      .orderBy('compositeScore', 'desc')
      .get();

    const items = queueSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    const mandatory = items.filter(i => i.priorityTier === 'CRITICAL' || i.category === 'statutory');
    const totalMandatory = mandatory.reduce((s, i) => s + (i.amountUGX || 0), 0);

    // Supersede existing plans
    const existing = await db.collection('companies').doc(companyId)
      .collection('spend_plans')
      .where('date', '==', targetDate)
      .where('status', 'in', ['draft', 'active'])
      .get();

    const batch = db.batch();
    existing.docs.forEach(d => batch.update(d.ref, { status: 'superseded' }));
    if (!existing.empty) await batch.commit();

    const isCrisis = totalMandatory > (bankBalance || 0);

    // Create new plan
    const planRef = await db.collection('companies').doc(companyId).collection('spend_plans').add({
      companyId,
      date: targetDate,
      generatedAt: admin.firestore.FieldValue.serverTimestamp(),
      generatedBy: request.auth.uid,
      openingBankBalance: bankBalance || 0,
      openingSavingsBalance: savingsBalance || 0,
      scheduledExpenditures: mandatory.slice(0, 30).map(i => ({
        id: i.id,
        description: i.description,
        amount: i.amountUGX,
        category: i.category,
        priorityTier: i.priorityTier,
        compositeScore: i.compositeScore,
      })),
      deferredExpenditures: items
        .filter(i => !mandatory.includes(i))
        .slice(0, 30)
        .map(i => ({
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
      closingBalance: (bankBalance || 0) - totalMandatory,
      riskFlags: isCrisis ? [{ severity: 'critical', message: 'Mandatory spend exceeds available cash — crisis mode triggered' }] : [],
      actionItems: [],
      status: 'draft',
    });

    return {
      success: true,
      planId: planRef.id,
      mandatoryCount: mandatory.length,
      totalMandatory,
      isCrisis,
    };
  }
);

// ────────────────────────────────────────────────────────────────────────────
// RESCORE EXPENDITURES
// ────────────────────────────────────────────────────────────────────────────

exports.rescoreExpenditures = onCall(
  {
    cors: ALLOWED_ORIGINS,
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }

    const { companyId } = request.data;
    if (!companyId) {
      throw new HttpsError('invalid-argument', 'companyId is required');
    }

    const queueSnap = await db.collection('companies').doc(companyId)
      .collection('expenditure_queue')
      .where('status', '==', 'pending')
      .get();

    const batch = db.batch();
    let count = 0;
    const today = new Date();

    const context = {
      currentBankBalance: 0,
      settings: { cashBufferSettings: { minimumCashBuffer: 5000000 } },
    };

    for (const doc of queueSnap.docs) {
      const item = doc.data();
      const scores = scoreAll(item, context, today);
      const composite = calculateComposite(scores, DEFAULT_SCORING_WEIGHTS, item.commitmentLevel);
      const tier = assignTier(composite, item, DEFAULT_PRIORITY_THRESHOLDS);

      batch.update(doc.ref, {
        scores,
        compositeScore: composite,
        priorityTier: tier,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      count++;
      if (count % 450 === 0) await batch.commit();
    }
    if (count % 450 !== 0) await batch.commit();

    return { success: true, itemsRescored: count };
  }
);
