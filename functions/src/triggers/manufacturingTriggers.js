/**
 * Manufacturing Triggers - DawinOS v2.0
 * Cloud Function Gen 2 triggers for the manufacturing module lifecycle.
 *
 * Triggers:
 *  1. onManufacturingStepCompleted  - Step status -> 'completed' logic
 *  2. onQualityEventCreated         - Quality event handling (fail / rework)
 *  3. onManufacturingOrderCompleted  - MO status -> 'completed' final costs
 *  4. dailyProductionReport          - 6 AM daily production summary
 *  5. overdueOrderCheck              - Every 4 hours, flags overdue MOs
 */

const { onDocumentUpdated, onDocumentCreated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

const db = admin.firestore();

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

/**
 * Create a business event in the businessEvents collection.
 */
async function emitBusinessEvent({
  eventType,
  severity = 'medium',
  entityId,
  entityName,
  projectId,
  projectName,
  title,
  description,
  previousState,
  currentState,
  changedFields,
  triggeredBy,
  triggeredByName,
  metadata,
}) {
  const eventData = {
    eventType,
    category: 'production',
    severity,
    sourceModule: 'manufacturing',
    subsidiary: 'finishes',
    entityType: 'manufacturing_order',
    entityId,
    entityName: entityName || '',
    projectId: projectId || null,
    projectName: projectName || null,
    title,
    description: description || '',
    previousState: previousState || null,
    currentState: currentState || null,
    changedFields: changedFields || [],
    triggeredBy: triggeredBy || 'system',
    triggeredByName: triggeredByName || 'System',
    metadata: metadata || {},
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
    processedAt: null,
  };

  const ref = await db.collection('businessEvents').add(eventData);
  logger.info(`[ManufacturingTrigger] Business event created: ${eventType} (${ref.id})`);
  return ref.id;
}

/**
 * Create a notification document.
 */
async function createNotification({ recipientRole, title, body, entityType, entityId, severity }) {
  await db.collection('notifications').add({
    recipientRole: recipientRole || 'production_manager',
    title,
    body: body || '',
    entityType: entityType || 'manufacturing_order',
    entityId: entityId || null,
    severity: severity || 'medium',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 1. onManufacturingStepCompleted
// ────────────────────────────────────────────────────────────────────────────

/**
 * Firestore trigger: manufacturingOrders/{orderId}/steps/{stepId}
 *
 * When a manufacturing step status changes to 'completed':
 *  - Checks if all sibling steps are completed; if so, marks the MO as completed.
 *  - Advances the next sequential step to 'pending'.
 *  - Emits a business event for the step completion.
 */
const onManufacturingStepCompleted = onDocumentUpdated(
  {
    document: 'manufacturingOrders/{orderId}/steps/{stepId}',
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    // Only act when the step just transitioned to 'completed'
    if (before.status === 'completed' || after.status !== 'completed') return;

    const { orderId, stepId } = event.params;
    logger.info(`[ManufacturingTrigger] Step completed: ${stepId} on order ${orderId}`);

    try {
      // Fetch all steps for this order
      const stepsSnap = await db
        .collection('manufacturingOrders')
        .doc(orderId)
        .collection('steps')
        .orderBy('sequence', 'asc')
        .get();

      const allSteps = stepsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
      const allCompleted = allSteps.every((s) => s.id === stepId ? true : s.status === 'completed');

      if (allCompleted) {
        // All steps completed — mark the MO as completed
        await db.collection('manufacturingOrders').doc(orderId).update({
          status: 'completed',
          completedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        logger.info(`[ManufacturingTrigger] All steps done — MO ${orderId} marked completed`);
      } else {
        // Advance the next sequential step to 'pending'
        const currentIndex = allSteps.findIndex((s) => s.id === stepId);
        if (currentIndex >= 0 && currentIndex < allSteps.length - 1) {
          const nextStep = allSteps[currentIndex + 1];
          if (nextStep.status === 'queued' || nextStep.status === 'waiting') {
            await db
              .collection('manufacturingOrders')
              .doc(orderId)
              .collection('steps')
              .doc(nextStep.id)
              .update({
                status: 'pending',
                updatedAt: FieldValue.serverTimestamp(),
              });

            logger.info(
              `[ManufacturingTrigger] Next step ${nextStep.id} advanced to 'pending'`
            );
          }
        }
      }

      // Emit business event for step completion
      const moSnap = await db.collection('manufacturingOrders').doc(orderId).get();
      const moData = moSnap.exists ? moSnap.data() : {};

      await emitBusinessEvent({
        eventType: 'manufacturing_step_completed',
        severity: 'low',
        entityId: orderId,
        entityName: moData.moNumber || orderId,
        projectId: moData.projectId,
        projectName: moData.projectCode,
        title: `Step Completed: ${after.name || stepId}`,
        description: `Step "${after.name || stepId}" completed on MO ${moData.moNumber || orderId}.`,
        previousState: { stepStatus: before.status },
        currentState: { stepStatus: after.status, allCompleted },
        changedFields: ['status'],
        triggeredBy: after.completedBy || 'system',
        metadata: {
          stepId,
          stepName: after.name || null,
          sequence: after.sequence || null,
          allStepsCompleted: allCompleted,
        },
      });
    } catch (error) {
      logger.error(`[ManufacturingTrigger] Error in onManufacturingStepCompleted:`, error);
      throw error;
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// 2. onQualityEventCreated
// ────────────────────────────────────────────────────────────────────────────

/**
 * Firestore trigger: manufacturingOrders/{orderId}/quality_events/{eventId}
 *
 * When a quality event is created:
 *  - 'fail' result  → set qualityHold flag on the MO.
 *  - 'rework' result → log the rework entry on the order.
 *  - Always creates a notification for the quality manager.
 */
const onQualityEventCreated = onDocumentCreated(
  {
    document: 'manufacturingOrders/{orderId}/quality_events/{eventId}',
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const { orderId, eventId } = event.params;
    const result = data.result; // 'pass' | 'fail' | 'rework'

    logger.info(
      `[ManufacturingTrigger] Quality event created: ${eventId} (${result}) on MO ${orderId}`
    );

    try {
      const moRef = db.collection('manufacturingOrders').doc(orderId);
      const moSnap = await moRef.get();
      const moData = moSnap.exists ? moSnap.data() : {};

      if (result === 'fail') {
        // Flag the MO with a quality hold
        await moRef.update({
          qualityHold: true,
          qualityHoldReason: data.notes || 'Quality check failed',
          qualityHoldAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        logger.info(`[ManufacturingTrigger] MO ${orderId} placed on quality hold`);
      }

      if (result === 'rework') {
        // Append rework entry to the order
        await moRef.update({
          reworkLog: FieldValue.arrayUnion({
            eventId,
            reason: data.notes || 'Rework required',
            stepId: data.stepId || null,
            createdAt: new Date().toISOString(),
            createdBy: data.inspectedBy || 'system',
          }),
          reworkCount: FieldValue.increment(1),
          updatedAt: FieldValue.serverTimestamp(),
        });

        logger.info(`[ManufacturingTrigger] Rework logged on MO ${orderId}`);
      }

      // Notify quality manager for any quality event
      const severityMap = { fail: 'critical', rework: 'high', pass: 'low' };
      await createNotification({
        recipientRole: 'quality_manager',
        title: `Quality ${result.toUpperCase()}: ${moData.moNumber || orderId}`,
        body: `Quality event (${result}) on MO ${moData.moNumber || orderId}. ${data.notes || ''}`.trim(),
        entityType: 'manufacturing_order',
        entityId: orderId,
        severity: severityMap[result] || 'medium',
      });
    } catch (error) {
      logger.error(`[ManufacturingTrigger] Error in onQualityEventCreated:`, error);
      throw error;
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// 3. onManufacturingOrderCompleted
// ────────────────────────────────────────────────────────────────────────────

/**
 * Firestore trigger: manufacturingOrders/{orderId}
 *
 * When MO status changes to 'completed':
 *  - Calculate final costs from BOM actual costs.
 *  - Update linked design project status if applicable.
 *  - Create a completion business event.
 */
const onManufacturingOrderCompleted = onDocumentUpdated(
  {
    document: 'manufacturingOrders/{orderId}',
    region: 'us-central1',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async (event) => {
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    // Only act on the transition *to* 'completed'
    if (before.status === 'completed' || after.status !== 'completed') return;

    const { orderId } = event.params;
    logger.info(`[ManufacturingTrigger] MO completed: ${orderId}`);

    try {
      // ── Calculate final costs from BOM actual costs ──
      const bom = after.bom || [];
      let totalActualCost = 0;
      let totalEstimatedCost = 0;

      for (const item of bom) {
        const actualCost = item.actualCost || item.actualUnitCost || 0;
        const estimatedCost = item.estimatedCost || item.unitCost || 0;
        const qty = item.quantityUsed || item.quantity || 0;
        totalActualCost += actualCost * qty;
        totalEstimatedCost += estimatedCost * qty;
      }

      const costVariance = totalActualCost - totalEstimatedCost;
      const costVariancePercent =
        totalEstimatedCost > 0
          ? ((costVariance / totalEstimatedCost) * 100).toFixed(2)
          : 0;

      // Update the MO with final cost summary
      await db.collection('manufacturingOrders').doc(orderId).update({
        finalCost: {
          totalActual: totalActualCost,
          totalEstimated: totalEstimatedCost,
          variance: costVariance,
          variancePercent: Number(costVariancePercent),
          calculatedAt: new Date().toISOString(),
        },
        updatedAt: FieldValue.serverTimestamp(),
      });

      logger.info(
        `[ManufacturingTrigger] Final cost calculated for MO ${orderId}: ` +
          `actual=${totalActualCost}, estimated=${totalEstimatedCost}, variance=${costVariance}`
      );

      // ── Update linked design project status ──
      if (after.projectId && after.designItemId) {
        try {
          const projectRef = db.collection('projects').doc(after.projectId);
          const projectSnap = await projectRef.get();

          if (projectSnap.exists) {
            // Check if all manufacturing orders for this project are completed
            const relatedMOs = await db
              .collection('manufacturingOrders')
              .where('projectId', '==', after.projectId)
              .where('status', '!=', 'completed')
              .limit(1)
              .get();

            if (relatedMOs.empty) {
              // All MOs for the project are done — update project
              await projectRef.update({
                manufacturingStatus: 'completed',
                manufacturingCompletedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
              });

              logger.info(
                `[ManufacturingTrigger] All MOs completed for project ${after.projectId}. ` +
                  `Project manufacturing status set to completed.`
              );
            }
          }
        } catch (projectError) {
          // Non-fatal: log and continue
          logger.warn(
            `[ManufacturingTrigger] Could not update linked project ${after.projectId}:`,
            projectError
          );
        }
      }

      // ── Emit completion business event ──
      await emitBusinessEvent({
        eventType: 'manufacturing_order_completed',
        severity: 'medium',
        entityId: orderId,
        entityName: after.moNumber || orderId,
        projectId: after.projectId,
        projectName: after.projectCode,
        title: `MO Completed: ${after.moNumber || orderId}`,
        description:
          `Manufacturing order ${after.moNumber || orderId} completed. ` +
          `Actual cost: ${totalActualCost}, Variance: ${costVariance} (${costVariancePercent}%).`,
        previousState: { status: before.status },
        currentState: { status: 'completed' },
        changedFields: ['status', 'finalCost', 'completedAt'],
        triggeredBy: after.updatedBy || 'system',
        triggeredByName: after.updatedByName || 'System',
        metadata: {
          moNumber: after.moNumber,
          designItemId: after.designItemId,
          designItemName: after.designItemName,
          totalActualCost,
          totalEstimatedCost,
          costVariance,
          costVariancePercent: Number(costVariancePercent),
          bomItemCount: bom.length,
        },
      });
    } catch (error) {
      logger.error(`[ManufacturingTrigger] Error in onManufacturingOrderCompleted:`, error);
      throw error;
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// 4. dailyProductionReport
// ────────────────────────────────────────────────────────────────────────────

/**
 * Scheduled: Every day at 6 AM Africa/Kampala
 *
 * Generates a daily production summary:
 *  - Orders completed yesterday
 *  - Orders currently in progress
 *  - Average cycle time (createdAt → completedAt) for yesterday's completions
 *  - Stores the report in productionReports collection
 */
const dailyProductionReport = onSchedule(
  {
    schedule: 'every day 06:00',
    timeZone: 'Africa/Kampala',
    region: 'us-central1',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async () => {
    logger.info('[ManufacturingTrigger] Running daily production report...');

    try {
      const now = new Date();
      // Yesterday boundaries (Africa/Kampala is UTC+3)
      const yesterdayStart = new Date(now);
      yesterdayStart.setDate(yesterdayStart.getDate() - 1);
      yesterdayStart.setHours(0, 0, 0, 0);

      const yesterdayEnd = new Date(now);
      yesterdayEnd.setDate(yesterdayEnd.getDate() - 1);
      yesterdayEnd.setHours(23, 59, 59, 999);

      // ── Orders completed yesterday ──
      const completedSnap = await db
        .collection('manufacturingOrders')
        .where('status', '==', 'completed')
        .where('completedAt', '>=', yesterdayStart)
        .where('completedAt', '<=', yesterdayEnd)
        .get();

      const completedCount = completedSnap.size;

      // ── Orders currently in progress ──
      const inProgressSnap = await db
        .collection('manufacturingOrders')
        .where('status', '==', 'in-progress')
        .get();

      const inProgressCount = inProgressSnap.size;

      // ── Average cycle time (hours) ──
      let totalCycleTimeHours = 0;
      let cycleTimeCount = 0;

      for (const doc of completedSnap.docs) {
        const data = doc.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : null;
        const completedAt = data.completedAt?.toDate ? data.completedAt.toDate() : null;

        if (createdAt && completedAt) {
          const diffMs = completedAt.getTime() - createdAt.getTime();
          const diffHours = diffMs / (1000 * 60 * 60);
          totalCycleTimeHours += diffHours;
          cycleTimeCount++;
        }
      }

      const averageCycleTimeHours =
        cycleTimeCount > 0 ? Math.round((totalCycleTimeHours / cycleTimeCount) * 100) / 100 : 0;

      // ── Count orders by status for a broader snapshot ──
      const allOrdersSnap = await db.collection('manufacturingOrders').get();
      const statusBreakdown = {};
      for (const doc of allOrdersSnap.docs) {
        const s = doc.data().status || 'unknown';
        statusBreakdown[s] = (statusBreakdown[s] || 0) + 1;
      }

      // ── Calculate additional KPI metrics ──
      // On-time delivery rate (DIFOT)
      let onTimeCount = 0;
      let totalWithDueDate = 0;
      // Rework rate
      let reworkCount = 0;
      let totalCompletedAllTime = 0;

      for (const d of allOrdersSnap.docs) {
        const orderData = d.data();
        if (orderData.status === 'completed') {
          totalCompletedAllTime++;
          if (orderData.dueDate && orderData.completedAt) {
            totalWithDueDate++;
            const due = orderData.dueDate?.toDate ? orderData.dueDate.toDate() : new Date(orderData.dueDate);
            const completed = orderData.completedAt?.toDate ? orderData.completedAt.toDate() : new Date(orderData.completedAt);
            if (completed <= due) onTimeCount++;
          }
          if ((orderData.reworkCount || 0) > 0) reworkCount++;
        }
      }

      const onTimeDeliveryRate = totalWithDueDate > 0
        ? Math.round((onTimeCount / totalWithDueDate) * 10000) / 100
        : 100;
      const reworkRate = totalCompletedAllTime > 0
        ? Math.round((reworkCount / totalCompletedAllTime) * 10000) / 100
        : 0;
      const avgCycleTimeDays = averageCycleTimeHours > 0
        ? Math.round((averageCycleTimeHours / 24) * 100) / 100
        : 0;

      // ── Store report ──
      const reportDate = yesterdayStart.toISOString().split('T')[0]; // YYYY-MM-DD

      await db.collection('productionReports').add({
        reportDate,
        reportType: 'daily_summary',
        completedYesterday: completedCount,
        currentlyInProgress: inProgressCount,
        averageCycleTimeHours,
        averageCycleTimeDays: avgCycleTimeDays,
        cycleTimeSampleSize: cycleTimeCount,
        onTimeDeliveryRate,
        reworkRate,
        statusBreakdown,
        totalOrders: allOrdersSnap.size,
        generatedAt: FieldValue.serverTimestamp(),
        generatedBy: 'system:dailyProductionReport',
      });

      // ── Emit KPI data as business events for Strategy module ──
      const kpiMetrics = [
        { kpiCode: 'DIFOT', value: onTimeDeliveryRate, unit: '%' },
        { kpiCode: 'REWORK', value: reworkRate, unit: '%' },
        { kpiCode: 'OCT', value: avgCycleTimeDays, unit: 'days' },
      ];

      for (const metric of kpiMetrics) {
        await db.collection('businessEvents').add({
          eventType: 'kpi_data_point',
          category: 'production',
          severity: 'low',
          sourceModule: 'manufacturing',
          subsidiary: 'finishes',
          entityType: 'kpi',
          entityId: metric.kpiCode,
          entityName: metric.kpiCode,
          title: `Manufacturing KPI Update: ${metric.kpiCode}`,
          description: `Auto-computed ${metric.kpiCode} = ${metric.value}${metric.unit}`,
          metadata: {
            kpiCode: metric.kpiCode,
            value: metric.value,
            unit: metric.unit,
            reportDate,
            sampleSize: metric.kpiCode === 'OCT' ? cycleTimeCount : totalCompletedAllTime,
          },
          status: 'pending',
          createdAt: FieldValue.serverTimestamp(),
          processedAt: null,
        });
      }

      logger.info(
        `[ManufacturingTrigger] Daily report generated for ${reportDate}: ` +
          `completed=${completedCount}, inProgress=${inProgressCount}, avgCycleTime=${averageCycleTimeHours}h, ` +
          `DIFOT=${onTimeDeliveryRate}%, rework=${reworkRate}%, avgDays=${avgCycleTimeDays}`
      );
    } catch (error) {
      logger.error('[ManufacturingTrigger] Error in dailyProductionReport:', error);
      throw error;
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// 5. overdueOrderCheck
// ────────────────────────────────────────────────────────────────────────────

/**
 * Scheduled: Every 4 hours
 *
 * Checks for overdue manufacturing orders:
 *  - dueDate < now AND status not in ['completed', 'cancelled']
 *  - Marks them as 'at_risk' (within 24h) or 'overdue' (past due)
 *  - Creates notifications for production managers
 */
const overdueOrderCheck = onSchedule(
  {
    schedule: 'every 4 hours',
    region: 'us-central1',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async () => {
    logger.info('[ManufacturingTrigger] Running overdue order check...');

    try {
      const now = new Date();
      const in24Hours = new Date(now.getTime() + 24 * 60 * 60 * 1000);

      // Find orders with a dueDate that is in the past or within 24 hours,
      // excluding completed and cancelled.
      const ordersSnap = await db
        .collection('manufacturingOrders')
        .where('dueDate', '<=', in24Hours)
        .get();

      const terminalStatuses = new Set(['completed', 'cancelled']);
      let overdueCount = 0;
      let atRiskCount = 0;

      for (const doc of ordersSnap.docs) {
        const data = doc.data();

        // Skip terminal statuses
        if (terminalStatuses.has(data.status)) continue;

        // Skip if already marked and hasn't changed
        const dueDate = data.dueDate?.toDate ? data.dueDate.toDate() : new Date(data.dueDate);
        if (isNaN(dueDate.getTime())) continue;

        const isPastDue = dueDate < now;
        const newRiskStatus = isPastDue ? 'overdue' : 'at_risk';

        // Only update if the risk status actually changed
        if (data.riskStatus === newRiskStatus) continue;

        await db.collection('manufacturingOrders').doc(doc.id).update({
          riskStatus: newRiskStatus,
          riskStatusUpdatedAt: FieldValue.serverTimestamp(),
          updatedAt: FieldValue.serverTimestamp(),
        });

        if (isPastDue) {
          overdueCount++;
        } else {
          atRiskCount++;
        }

        // Create notification for production manager
        const daysOverdue = isPastDue
          ? Math.ceil((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24))
          : 0;
        const hoursUntilDue = !isPastDue
          ? Math.ceil((dueDate.getTime() - now.getTime()) / (1000 * 60 * 60))
          : 0;

        await createNotification({
          recipientRole: 'production_manager',
          title: isPastDue
            ? `OVERDUE: ${data.moNumber || doc.id}`
            : `AT RISK: ${data.moNumber || doc.id} (due in ${hoursUntilDue}h)`,
          body: isPastDue
            ? `MO ${data.moNumber || doc.id} is ${daysOverdue} day(s) overdue. Current status: ${data.status}.`
            : `MO ${data.moNumber || doc.id} is due within ${hoursUntilDue} hours. Current status: ${data.status}.`,
          entityType: 'manufacturing_order',
          entityId: doc.id,
          severity: isPastDue ? 'critical' : 'high',
        });
      }

      logger.info(
        `[ManufacturingTrigger] Overdue check complete: overdue=${overdueCount}, atRisk=${atRiskCount}`
      );
    } catch (error) {
      logger.error('[ManufacturingTrigger] Error in overdueOrderCheck:', error);
      throw error;
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// 6. onBOMLineCreated
// ────────────────────────────────────────────────────────────────────────────

/**
 * Firestore trigger: manufacturingOrders/{orderId}/bom/{lineId}
 *
 * When a BOM line is created with an inventoryItemId:
 *  - Attempts to reserve the required quantity from stockLevels.
 *  - Updates the BOM line procurementStatus to 'reserved' or 'shortage'.
 */
const onBOMLineCreated = onDocumentCreated(
  {
    document: 'manufacturingOrders/{orderId}/bom/{lineId}',
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return;

    const { orderId, lineId } = event.params;

    // Skip labor lines or lines without an inventory link
    if (data.category === 'labor' || !data.inventoryItemId) {
      logger.info(
        `[ManufacturingTrigger] BOM line ${lineId} skipped (no inventory link or labor)`
      );
      return;
    }

    const requiredQty = data.requiredQuantity || 0;
    if (requiredQty <= 0) return;

    logger.info(
      `[ManufacturingTrigger] BOM line created: ${lineId} on MO ${orderId}, ` +
        `material=${data.materialName}, qty=${requiredQty}`
    );

    try {
      // Check available stock
      const stockSnap = await db
        .collection('stockLevels')
        .where('inventoryItemId', '==', data.inventoryItemId)
        .get();

      let totalAvailable = 0;
      for (const stockDoc of stockSnap.docs) {
        const stockData = stockDoc.data();
        totalAvailable += (stockData.currentQuantity || 0) - (stockData.reservedQuantity || 0);
      }

      const canReserve = totalAvailable >= requiredQty;
      const lineRef = db
        .collection('manufacturingOrders')
        .doc(orderId)
        .collection('bom')
        .doc(lineId);

      if (canReserve) {
        // Reserve from first available stock level(s)
        let remaining = requiredQty;
        const batch = db.batch();

        for (const stockDoc of stockSnap.docs) {
          if (remaining <= 0) break;
          const stockData = stockDoc.data();
          const available = (stockData.currentQuantity || 0) - (stockData.reservedQuantity || 0);
          if (available <= 0) continue;

          const toReserve = Math.min(remaining, available);
          batch.update(stockDoc.ref, {
            reservedQuantity: FieldValue.increment(toReserve),
            updatedAt: FieldValue.serverTimestamp(),
          });
          remaining -= toReserve;
        }

        batch.update(lineRef, {
          reservedQuantity: requiredQty,
          procurementStatus: 'reserved',
          updatedAt: FieldValue.serverTimestamp(),
        });

        await batch.commit();
        logger.info(`[ManufacturingTrigger] Reserved ${requiredQty} for BOM line ${lineId}`);
      } else {
        // Mark as shortage
        const shortageQty = requiredQty - Math.max(0, totalAvailable);
        await lineRef.update({
          reservedQuantity: Math.max(0, totalAvailable),
          procurementStatus: totalAvailable > 0 ? 'pending' : 'shortage',
          updatedAt: FieldValue.serverTimestamp(),
        });

        // Auto-create procurement requirement for the shortage
        try {
          const moSnap = await db.collection('manufacturingOrders').doc(orderId).get();
          const moData = moSnap.exists ? moSnap.data() : {};

          await db.collection('procurementRequirements').add({
            status: 'pending',
            source: 'manufacturing_bom',
            sourceOrderId: orderId,
            sourceOrderNumber: moData.moNumber || orderId,
            bomLineId: lineId,
            inventoryItemId: data.inventoryItemId,
            materialName: data.materialName || '',
            materialCode: data.materialCode || null,
            category: data.category || 'sheet_material',
            requiredQuantity: shortageQty,
            unit: data.unit || 'pcs',
            estimatedUnitCost: data.unitCost || 0,
            estimatedTotalCost: shortageQty * (data.unitCost || 0),
            priority: moData.priority || 'medium',
            neededByDate: moData.dueDate || null,
            projectId: moData.projectId || null,
            projectCode: moData.projectCode || null,
            subsidiaryId: moData.subsidiaryId || 'finishes',
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            createdBy: 'system:onBOMLineCreated',
          });

          logger.info(
            `[ManufacturingTrigger] Procurement requirement auto-created for shortage: ` +
              `${data.materialName}, qty=${shortageQty}`
          );
        } catch (procError) {
          logger.warn(
            `[ManufacturingTrigger] Could not auto-create procurement requirement:`,
            procError
          );
        }

        logger.warn(
          `[ManufacturingTrigger] Shortage for BOM line ${lineId}: ` +
            `need=${requiredQty}, available=${totalAvailable}`
        );
      }
    } catch (error) {
      logger.error(`[ManufacturingTrigger] Error in onBOMLineCreated:`, error);
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// 7. checkBOMAvailability (callable)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Callable function: checks material availability for all BOM lines of an MO.
 * Input: { orderId: string }
 * Returns: { overallStatus, lines[], totalShortageValue }
 */
const checkBOMAvailability = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { orderId } = request.data;
    if (!orderId) {
      throw new HttpsError('invalid-argument', 'orderId is required');
    }

    logger.info(`[ManufacturingCallable] checkBOMAvailability for MO ${orderId}`);

    const bomSnap = await db
      .collection('manufacturingOrders')
      .doc(orderId)
      .collection('bom')
      .orderBy('lineNumber', 'asc')
      .get();

    const lines = [];
    let totalShortageValue = 0;

    for (const bomDoc of bomSnap.docs) {
      const line = bomDoc.data();

      if (line.category === 'labor') {
        lines.push({
          bomLineId: bomDoc.id,
          materialName: line.materialName,
          requiredQuantity: line.requiredQuantity,
          availableQuantity: line.requiredQuantity,
          shortageQuantity: 0,
          status: 'in_stock',
        });
        continue;
      }

      let availableQty = 0;
      if (line.inventoryItemId) {
        const stockSnap = await db
          .collection('stockLevels')
          .where('inventoryItemId', '==', line.inventoryItemId)
          .get();

        for (const stockDoc of stockSnap.docs) {
          const stockData = stockDoc.data();
          availableQty += (stockData.currentQuantity || 0) - (stockData.reservedQuantity || 0);
        }
      }

      const shortage = Math.max(0, (line.requiredQuantity || 0) - availableQty);
      let status = 'in_stock';
      if (availableQty === 0) status = 'out_of_stock';
      else if (availableQty < (line.requiredQuantity || 0)) status = 'partial';

      if (shortage > 0) {
        totalShortageValue += shortage * (line.unitCost || 0);
      }

      lines.push({
        bomLineId: bomDoc.id,
        materialName: line.materialName || '',
        requiredQuantity: line.requiredQuantity || 0,
        availableQuantity: availableQty,
        shortageQuantity: shortage,
        status,
      });
    }

    const hasShortages = lines.some((l) => l.shortageQuantity > 0);
    const allAvailable = lines.every((l) => l.status === 'in_stock');

    return {
      orderId,
      checkedAt: new Date().toISOString(),
      overallStatus: allAvailable ? 'all_available' : hasShortages ? 'shortages' : 'partial',
      lines,
      totalShortageValue,
    };
  }
);

// ────────────────────────────────────────────────────────────────────────────
// 8. generateBOMFromOptimization (callable)
// ────────────────────────────────────────────────────────────────────────────

/**
 * Callable function: generates BOM lines from optimization results.
 * Input: { orderId, optimizationResults: Array<{ materialName, materialCode,
 *          category, quantity, unit, unitCost, inventoryItemId, dimensions }> }
 * Returns: { created: number, lineIds: string[] }
 */
const generateBOMFromOptimization = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 120,
    memory: '256MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be authenticated');
    }

    const { orderId, optimizationResults } = request.data;
    if (!orderId || !Array.isArray(optimizationResults) || optimizationResults.length === 0) {
      throw new HttpsError(
        'invalid-argument',
        'orderId and non-empty optimizationResults array are required'
      );
    }

    logger.info(
      `[ManufacturingCallable] generateBOMFromOptimization for MO ${orderId}: ` +
        `${optimizationResults.length} items`
    );

    // Get current max line number
    const existingSnap = await db
      .collection('manufacturingOrders')
      .doc(orderId)
      .collection('bom')
      .orderBy('lineNumber', 'desc')
      .limit(1)
      .get();

    let nextLineNumber = existingSnap.empty ? 1 : (existingSnap.docs[0].data().lineNumber || 0) + 1;

    const batch = db.batch();
    const lineIds = [];

    for (const item of optimizationResults) {
      const ref = db
        .collection('manufacturingOrders')
        .doc(orderId)
        .collection('bom')
        .doc();

      const qty = item.quantity || 0;
      const unitCost = item.unitCost || 0;

      batch.set(ref, {
        orderId,
        lineNumber: nextLineNumber++,
        category: item.category || 'sheet_material',
        inventoryItemId: item.inventoryItemId || null,
        materialName: item.materialName || '',
        materialCode: item.materialCode || null,
        specification: item.specification || null,
        requiredQuantity: qty,
        unit: item.unit || 'pcs',
        reservedQuantity: 0,
        consumedQuantity: 0,
        wasteQuantity: 0,
        dimensions: item.dimensions || null,
        unitCost,
        totalEstimatedCost: qty * unitCost,
        totalActualCost: 0,
        procurementStatus: 'pending',
        fromOptimization: true,
        notes: item.notes || null,
        createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      });

      lineIds.push(ref.id);
    }

    await batch.commit();

    // Update MO BOM summary
    const allBomSnap = await db
      .collection('manufacturingOrders')
      .doc(orderId)
      .collection('bom')
      .get();

    let totalMaterialCost = 0;
    for (const d of allBomSnap.docs) {
      const data = d.data();
      if (data.category !== 'labor') {
        totalMaterialCost += data.totalEstimatedCost || 0;
      }
    }

    await db.collection('manufacturingOrders').doc(orderId).update({
      bomLineCount: allBomSnap.size,
      bomTotalMaterialCost: totalMaterialCost,
      estimatedMaterialCost: totalMaterialCost,
      updatedAt: FieldValue.serverTimestamp(),
    });

    logger.info(
      `[ManufacturingCallable] Created ${lineIds.length} BOM lines for MO ${orderId}`
    );

    return { created: lineIds.length, lineIds };
  }
);

// ────────────────────────────────────────────────────────────────────────────
// EXPORTS
// ────────────────────────────────────────────────────────────────────────────

module.exports = {
  onManufacturingStepCompleted,
  onQualityEventCreated,
  onManufacturingOrderCompleted,
  dailyProductionReport,
  overdueOrderCheck,
  onBOMLineCreated,
  checkBOMAvailability,
  generateBOMFromOptimization,
};
