/**
 * Cloud Function - Cash Flow Triggers (Gen 2)
 *
 * Firestore triggers for cash flow optimizer:
 * - Auto-allocate savings on confirmed inflows
 * - Re-ingest on QBO data changes
 */

const { onDocumentCreated, onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const {
  scoreAll,
  calculateComposite,
  assignTier,
  DEFAULT_SCORING_WEIGHTS,
  DEFAULT_PRIORITY_THRESHOLDS,
} = require('../finance/scoringEngine');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

// ────────────────────────────────────────────────────────────────────────────
// AUTO-ALLOCATE SAVINGS ON INFLOW
// ────────────────────────────────────────────────────────────────────────────

exports.autoAllocateSavingsOnInflow = onDocumentCreated(
  {
    document: 'companies/{companyId}/qbo_bank_transactions/{txnId}',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (event) => {
    const { companyId, txnId } = event.params;
    const data = event.data?.data();

    if (!data || data.type !== 'deposit' || !data.amount || data.amount <= 0) {
      return;
    }

    logger.info(`[CashFlowTrigger] Inflow detected for ${companyId}: ${data.amount} UGX`);

    try {
      // Get savings config
      const configSnap = await db.collection('companies').doc(companyId)
        .collection('optimizer_config').limit(1).get();

      const config = configSnap.empty
        ? { savingsSettings: { baseRatePercent: 10, enableRoundUp: true, roundUpUnit: 10000 } }
        : configSnap.docs[0].data();

      const settings = config.savingsSettings || { baseRatePercent: 10 };
      const rate = settings.baseRatePercent || 10;
      let allocation = data.amount * (rate / 100);

      if (allocation <= 0) return;

      // Round up if enabled
      if (settings.enableRoundUp && settings.roundUpUnit) {
        const remainder = allocation % settings.roundUpUnit;
        if (remainder > 0) {
          allocation = allocation + (settings.roundUpUnit - remainder);
        }
      }

      // Get current balance
      const latestSnap = await db.collection('companies').doc(companyId)
        .collection('savings_ledger')
        .orderBy('createdAt', 'desc')
        .limit(1)
        .get();

      const currentBalance = latestSnap.empty ? 0 : (latestSnap.docs[0].data().runningBalance || 0);

      // Create savings entry
      await db.collection('companies').doc(companyId).collection('savings_ledger').add({
        companyId,
        type: 'allocation',
        amount: allocation,
        runningBalance: currentBalance + allocation,
        description: `Auto-allocation from inflow: ${data.description || data.memo || 'Bank deposit'}`,
        sourceType: 'auto',
        sourceId: txnId,
        category: 'recurringIncome',
        rateApplied: rate,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        createdBy: 'system:auto-savings',
      });

      logger.info(`[CashFlowTrigger] Savings allocated: ${allocation} UGX (${rate}% of ${data.amount})`);
    } catch (error) {
      logger.error(`[CashFlowTrigger] Savings allocation error:`, error);
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// RE-INGEST ON QBO SYNC
// ────────────────────────────────────────────────────────────────────────────

exports.reingestOnQBOSync = onDocumentUpdated(
  {
    document: 'companies/{companyId}/qbo_sync_jobs/{jobId}',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async (event) => {
    const { companyId, jobId } = event.params;
    const after = event.data?.after?.data();

    if (!after || after.status !== 'completed') return;

    logger.info(`[CashFlowTrigger] QBO sync completed for ${companyId}, re-ingesting bills...`);

    try {
      // Refresh expenditure queue from synced bills
      const billsSnap = await db.collection('companies').doc(companyId)
        .collection('qbo_synced_data')
        .where('dataType', '==', 'bills')
        .get();

      let ingested = 0;
      for (const billDoc of billsSnap.docs) {
        const billData = billDoc.data();
        const items = billData.data || [];

        for (const bill of items) {
          if (bill.Balance <= 0 || bill.Balance === undefined) continue;

          // Check if already exists
          const existing = await db.collection('companies').doc(companyId)
            .collection('expenditure_queue')
            .where('sourceId', '==', `qbo-bill-${bill.Id}`)
            .limit(1)
            .get();

          if (!existing.empty) continue;

          await db.collection('companies').doc(companyId).collection('expenditure_queue').add({
            companyId,
            description: `Bill: ${bill.VendorRef?.name || 'Unknown'} - ${bill.DocNumber || ''}`,
            amountUGX: bill.Balance || 0,
            currency: 'UGX',
            category: 'overhead',
            sourceType: 'qbo_bill',
            sourceId: `qbo-bill-${bill.Id}`,
            vendor: bill.VendorRef?.name || '',
            status: 'pending',
            compositeScore: 50,
            priorityTier: 'MEDIUM',
            scores: { urgency: 50, revenueUnlock: 0, risk: 50, cashPosition: 50, relationship: 50, operational: 40 },
            statusHistory: [{ from: '', to: 'pending', changedAt: admin.firestore.FieldValue.serverTimestamp(), changedBy: 'system:qbo-sync' }],
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });
          ingested++;
        }
      }

      logger.info(`[CashFlowTrigger] Ingested ${ingested} new bills from QBO sync`);
    } catch (error) {
      logger.error(`[CashFlowTrigger] Re-ingestion error:`, error);
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// B1: RESCORE ON BALANCE CHANGE
// Triggers when a new bank transaction is recorded, re-scores all pending
// expenditures with the updated cash position.
// ────────────────────────────────────────────────────────────────────────────

const RESCORE_RATE_LIMIT_MS = 30 * 60 * 1000; // 30 minutes
const RESCORE_BALANCE_THRESHOLD = 500000; // 500K UGX

exports.rescoreOnBalanceChange = onDocumentCreated(
  {
    document: 'companies/{companyId}/qbo_bank_transactions/{txnId}',
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (event) => {
    const { companyId } = event.params;
    const data = event.data?.data();

    if (!data) return;

    const txnAmount = Math.abs(data.amount || 0);
    if (txnAmount < RESCORE_BALANCE_THRESHOLD) {
      logger.info(`[RescoreOnBalance] Skipping — amount ${txnAmount} below threshold`);
      return;
    }

    // Rate-limit via semaphore document
    const semaphoreRef = db.collection('companies').doc(companyId)
      .collection('optimizer_semaphores').doc('rescore');
    const semaphoreSnap = await semaphoreRef.get();

    if (semaphoreSnap.exists) {
      const lastRun = semaphoreSnap.data().lastRunAt?.toMillis() || 0;
      if (Date.now() - lastRun < RESCORE_RATE_LIMIT_MS) {
        logger.info(`[RescoreOnBalance] Rate-limited for ${companyId}, skipping`);
        return;
      }
    }

    // Set semaphore
    await semaphoreRef.set({
      lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
      trigger: 'balance_change',
    });

    logger.info(`[RescoreOnBalance] Rescoring pending items for ${companyId}`);

    try {
      const queueSnap = await db.collection('companies').doc(companyId)
        .collection('expenditure_queue')
        .where('status', '==', 'pending')
        .get();

      // Build context with updated balance
      const balanceSnap = await db.collection('companies').doc(companyId)
        .collection('qbo_bank_balances')
        .orderBy('updatedAt', 'desc').limit(1).get();
      const bankBalance = balanceSnap.empty ? 0 : (balanceSnap.docs[0].data().totalBalance || 0);

      const configSnap = await db.collection('companies').doc(companyId)
        .collection('optimizer_config').limit(1).get();
      const config = configSnap.empty ? {} : configSnap.docs[0].data();

      const context = {
        currentBankBalance: bankBalance,
        settings: config,
      };

      const batch = db.batch();
      let count = 0;

      for (const doc of queueSnap.docs) {
        const item = doc.data();
        const scores = scoreAll(item, context, new Date());
        const weights = config.scoringWeights || DEFAULT_SCORING_WEIGHTS;
        const composite = calculateComposite(scores, weights, item.commitmentLevel);
        const tier = assignTier(composite, item, config.priorityThresholds || DEFAULT_PRIORITY_THRESHOLDS);

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

      logger.info(`[RescoreOnBalance] Rescored ${count} items for ${companyId}`);
    } catch (error) {
      logger.error(`[RescoreOnBalance] Error:`, error);
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// B2: RESCORE ON SPEND PLAN APPROVAL
// When a spend plan is activated, re-score remaining pending items with
// reduced available cash.
// ────────────────────────────────────────────────────────────────────────────

exports.rescoreOnSpendPlanApproval = onDocumentUpdated(
  {
    document: 'companies/{companyId}/spend_plans/{planId}',
    timeoutSeconds: 300,
    memory: '512MiB',
  },
  async (event) => {
    const { companyId } = event.params;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!before || !after) return;

    // Only fire when status transitions to 'active'
    if (before.status === after.status || after.status !== 'active') return;

    logger.info(`[RescoreOnPlanApproval] Spend plan activated for ${companyId}`);

    // Rate-limit
    const semaphoreRef = db.collection('companies').doc(companyId)
      .collection('optimizer_semaphores').doc('rescore');
    const semaphoreSnap = await semaphoreRef.get();
    if (semaphoreSnap.exists) {
      const lastRun = semaphoreSnap.data().lastRunAt?.toMillis() || 0;
      if (Date.now() - lastRun < RESCORE_RATE_LIMIT_MS) {
        logger.info(`[RescoreOnPlanApproval] Rate-limited, skipping`);
        return;
      }
    }
    await semaphoreRef.set({
      lastRunAt: admin.firestore.FieldValue.serverTimestamp(),
      trigger: 'spend_plan_approval',
    });

    try {
      // Get scheduled expenditure IDs from the activated plan
      const scheduledIds = new Set(
        (after.scheduledExpenditures || []).map((e) => e.id || e.expenditureId)
      );

      // Re-score remaining pending items (excluding those in the plan)
      const queueSnap = await db.collection('companies').doc(companyId)
        .collection('expenditure_queue')
        .where('status', '==', 'pending')
        .get();

      const balanceSnap = await db.collection('companies').doc(companyId)
        .collection('qbo_bank_balances')
        .orderBy('updatedAt', 'desc').limit(1).get();
      const bankBalance = balanceSnap.empty ? 0 : (balanceSnap.docs[0].data().totalBalance || 0);
      const committedAmount = after.totalOutflow || 0;

      const configSnap = await db.collection('companies').doc(companyId)
        .collection('optimizer_config').limit(1).get();
      const config = configSnap.empty ? {} : configSnap.docs[0].data();

      const context = {
        currentBankBalance: bankBalance - committedAmount,
        settings: config,
      };

      const batch = db.batch();
      let count = 0;

      for (const doc of queueSnap.docs) {
        if (scheduledIds.has(doc.id)) continue; // Skip items in the active plan
        const item = doc.data();
        const scores = scoreAll(item, context, new Date());
        const weights = config.scoringWeights || DEFAULT_SCORING_WEIGHTS;
        const composite = calculateComposite(scores, weights, item.commitmentLevel);
        const tier = assignTier(composite, item, config.priorityThresholds || DEFAULT_PRIORITY_THRESHOLDS);

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

      logger.info(`[RescoreOnPlanApproval] Rescored ${count} remaining items for ${companyId}`);
    } catch (error) {
      logger.error(`[RescoreOnPlanApproval] Error:`, error);
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// C1: DETECT LIABILITIES FROM QBO
// Scans QBO bills for recurring patterns and creates liability register entries.
// ────────────────────────────────────────────────────────────────────────────

exports.detectLiabilitiesFromQBO = onDocumentUpdated(
  {
    document: 'companies/{companyId}/qbo_sync_jobs/{jobId}',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async (event) => {
    const { companyId } = event.params;
    const after = event.data?.after?.data();

    if (!after || after.status !== 'completed') return;

    logger.info(`[DetectLiabilities] QBO sync completed for ${companyId}, scanning for recurring bills...`);

    try {
      const billsSnap = await db.collection('companies').doc(companyId)
        .collection('qbo_synced_data')
        .where('dataType', '==', 'bills')
        .get();

      // Build vendor frequency map
      const vendorMap = new Map();

      for (const billDoc of billsSnap.docs) {
        const bills = billDoc.data().data || [];
        for (const bill of bills) {
          const vendorName = bill.VendorRef?.name || '';
          if (!vendorName) continue;

          if (!vendorMap.has(vendorName)) {
            vendorMap.set(vendorName, { amounts: [], vendorId: bill.VendorRef?.value });
          }
          vendorMap.get(vendorName).amounts.push(bill.TotalAmt || 0);
        }
      }

      let detected = 0;

      for (const [vendorName, data] of vendorMap) {
        // Must appear 3+ times to be considered recurring
        if (data.amounts.length < 3) continue;

        // Check amount consistency (within 20% of average)
        const avg = data.amounts.reduce((s, a) => s + a, 0) / data.amounts.length;
        const allConsistent = data.amounts.every(
          (a) => Math.abs(a - avg) <= avg * 0.2
        );
        if (!allConsistent) continue;

        // Classify by vendor name
        const name = vendorName.toLowerCase();
        let liabilityType = 'other';
        if (name.includes('landlord') || name.includes('rent') || name.includes('property')) liabilityType = 'rent';
        else if (name.includes('bank') || name.includes('loan') || name.includes('finance')) liabilityType = 'loan';
        else if (name.includes('umeme') || name.includes('nwsc') || name.includes('electric') || name.includes('water')) liabilityType = 'utility_contract';
        else if (name.includes('insurance') || name.includes('aua') || name.includes('jubilee')) liabilityType = 'insurance';
        else if (name.includes('ura') || name.includes('nssf') || name.includes('tax')) liabilityType = 'other'; // Statutory handled separately

        // Check if liability already exists for this vendor+type
        const existingSnap = await db.collection('companies').doc(companyId)
          .collection('liability_register')
          .where('vendorName', '==', vendorName)
          .where('type', '==', liabilityType)
          .limit(1)
          .get();

        if (!existingSnap.empty) continue;

        // Determine priority from type
        const priorityMap = {
          rent: 'contractual',
          loan: 'contractual',
          utility_contract: 'operational',
          insurance: 'contractual',
          other: 'operational',
        };
        const isStatutory = ['tax_paye', 'tax_vat', 'tax_corporate', 'nssf'].includes(liabilityType);
        const estimatedAmt = Math.round(avg);

        // Calculate next due date (next month, 1st)
        const now = new Date();
        const nextMonth = new Date(now.getFullYear(), now.getMonth() + 1, 1);

        // Create new liability
        await db.collection('companies').doc(companyId).collection('liability_register').add({
          companyId,
          type: liabilityType,
          description: `${vendorName} — recurring ${liabilityType.replace(/_/g, ' ')}`,
          vendorName,
          vendorId: data.vendorId,
          totalAmount: estimatedAmt,
          amountPaid: 0,
          amountRemaining: estimatedAmt,
          currency: 'UGX',
          frequency: 'monthly',
          nextDueDate: admin.firestore.Timestamp.fromDate(nextMonth),
          gracePeriodDays: liabilityType === 'rent' ? 5 : 15,
          priority: isStatutory ? 'statutory' : (priorityMap[liabilityType] || 'operational'),
          isNonNegotiable: isStatutory || liabilityType === 'rent',
          autoDetected: true,
          status: 'current',
          paymentHistory: [],
          detectedFromBillCount: data.amounts.length,
          subsidiaryId: 'dawin-finishes',
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        detected++;
      }

      logger.info(`[DetectLiabilities] Detected ${detected} new recurring liabilities for ${companyId}`);
    } catch (error) {
      logger.error(`[DetectLiabilities] Error:`, error);
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// C2: UPDATE CLIENT PAYMENT PROFILE
// When a projected receipt transitions to 'received', update the client's
// payment profile with rolling averages for reliability scoring.
// ────────────────────────────────────────────────────────────────────────────

exports.updateClientPaymentProfile = onDocumentUpdated(
  {
    document: 'companies/{companyId}/projected_receipts/{receiptId}',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (event) => {
    const { companyId, receiptId } = event.params;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();

    if (!before || !after) return;

    // Only fire when status transitions to 'received'
    if (before.status === after.status || after.status !== 'received') return;

    const customerId = after.customerId;
    if (!customerId) {
      logger.info(`[ClientProfile] No customerId on receipt ${receiptId}, skipping`);
      return;
    }

    logger.info(`[ClientProfile] Receipt ${receiptId} received, updating profile for customer ${customerId}`);

    try {
      const expectedDate = after.expectedDate?.toDate ? after.expectedDate.toDate() : new Date(after.expectedDate);
      const actualDate = after.actualReceivedDate?.toDate
        ? after.actualReceivedDate.toDate()
        : new Date();
      const varianceDays = Math.round(
        (actualDate.getTime() - expectedDate.getTime()) / (1000 * 60 * 60 * 24)
      );

      const profileRef = db.collection('companies').doc(companyId)
        .collection('client_payment_profiles').doc(customerId);
      const profileSnap = await profileRef.get();

      const paymentRecord = {
        receiptId,
        projectedDate: expectedDate.toISOString().split('T')[0],
        actualDate: actualDate.toISOString().split('T')[0],
        varianceDays,
        amount: after.actualAmount || after.amount || 0,
      };

      if (profileSnap.exists) {
        const existing = profileSnap.data();
        const recentPayments = (existing.recentPayments || []).slice(0, 9); // Keep last 10
        recentPayments.unshift(paymentRecord);

        const totalTracked = (existing.totalPaymentsTracked || 0) + 1;
        const totalDelay = (existing.averagePaymentDelayDays || 0) * (existing.totalPaymentsTracked || 0) + varianceDays;
        const avgDelay = Math.round(totalDelay / totalTracked);

        const onTimeCount = recentPayments.filter((p) => p.varianceDays <= 3).length;
        const onTimeRate = Math.round((onTimeCount / recentPayments.length) * 100);

        // Reliability score: 100 = always on time, 0 = always very late
        const reliabilityScore = Math.max(0, Math.min(100,
          100 - Math.min(50, avgDelay * 2) + (onTimeRate > 80 ? 10 : 0)
        ));

        await profileRef.update({
          totalPaymentsTracked: totalTracked,
          averagePaymentDelayDays: avgDelay,
          onTimePaymentRate: onTimeRate,
          reliabilityScore,
          recentPayments,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      } else {
        // Create new profile
        const onTimeRate = varianceDays <= 3 ? 100 : 0;
        const reliabilityScore = Math.max(0, Math.min(100, 100 - Math.min(50, varianceDays * 2)));

        await profileRef.set({
          customerId,
          customerName: after.customerName || null,
          companyId,
          totalPaymentsTracked: 1,
          averagePaymentDelayDays: varianceDays,
          onTimePaymentRate: onTimeRate,
          reliabilityScore,
          recentPayments: [paymentRecord],
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }

      logger.info(`[ClientProfile] Updated profile for ${customerId}: delay=${varianceDays}d`);
    } catch (error) {
      logger.error(`[ClientProfile] Error:`, error);
    }
  }
);
