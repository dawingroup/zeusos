/**
 * Sales Order Triggers - DawinOS v2.0
 * Cloud Function Gen 2 triggers for the sales order module lifecycle.
 *
 * Triggers:
 *  1. onSalesOrderStatusChanged    - Status transitions → business events
 *  2. onChangeOrderApproved        - Approved CO → invalidate design sign-offs
 *  3. onSalesOrderReleased         - Released to production → create contract + MO
 *  4. staleSalesOrderCheck          - Daily 8 AM EAT, flags stale orders
 *  5. autoDetectRisks              - On SO update, detect risk flags
 */

const { onDocumentUpdated } = require('firebase-functions/v2/firestore');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

const db = admin.firestore();

// ────────────────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────────────────

async function emitBusinessEvent({
  eventType,
  severity = 'medium',
  entityId,
  entityName,
  projectId,
  title,
  description,
  previousState,
  currentState,
  changedFields,
  triggeredBy,
  metadata,
}) {
  const eventData = {
    eventType,
    category: 'commercial',
    severity,
    sourceModule: 'sales_orders',
    subsidiary: 'finishes',
    entityType: 'sales_order',
    entityId,
    entityName: entityName || '',
    projectId: projectId || null,
    projectName: null,
    title,
    description: description || '',
    previousState: previousState || null,
    currentState: currentState || null,
    changedFields: changedFields || [],
    triggeredBy: triggeredBy || 'system',
    triggeredByName: 'System',
    metadata: metadata || {},
    status: 'pending',
    createdAt: FieldValue.serverTimestamp(),
    processedAt: null,
  };

  const ref = await db.collection('businessEvents').add(eventData);
  logger.info(`[SalesOrderTrigger] Business event created: ${eventType} (${ref.id})`);
  return ref.id;
}

async function createNotification({ recipientRole, title, body, entityType, entityId, severity }) {
  await db.collection('notifications').add({
    recipientRole: recipientRole || 'sales_manager',
    title,
    body,
    entityType: entityType || 'sales_order',
    entityId,
    severity: severity || 'medium',
    read: false,
    createdAt: FieldValue.serverTimestamp(),
  });
}

// ────────────────────────────────────────────────────────────────────────────
// 1. ON SALES ORDER STATUS CHANGED
// ────────────────────────────────────────────────────────────────────────────

const onSalesOrderStatusChanged = onDocumentUpdated(
  {
    document: 'salesOrders/{orderId}',
    region: 'us-central1',
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const orderId = event.params.orderId;

    if (before.status === after.status) return;

    logger.info(
      `[SalesOrder] ${orderId} status: ${before.status} → ${after.status}`
    );

    // Emit business event for status change
    await emitBusinessEvent({
      eventType: `sales_order_${after.status}`,
      severity: after.status === 'cancelled' ? 'high' : 'medium',
      entityId: orderId,
      entityName: after.orderNumber,
      projectId: after.designProjectId,
      title: `Sales Order ${after.orderNumber} — ${after.status.replace(/_/g, ' ')}`,
      description: `Order moved from ${before.status} to ${after.status}`,
      previousState: before.status,
      currentState: after.status,
      changedFields: ['status'],
      triggeredBy: after.updatedBy,
      metadata: {
        customerName: after.customerName,
        currentAmount: after.currentAmount,
        currency: after.currency,
      },
    });

    // Specific notifications
    if (after.status === 'client_accepted') {
      await createNotification({
        recipientRole: 'sales_manager',
        title: `Client Accepted: ${after.orderNumber}`,
        body: `${after.customerName} has accepted the quote. Proceed with design review.`,
        entityId: orderId,
        severity: 'medium',
      });
    }

    if (after.status === 'awaiting_deposit') {
      await createNotification({
        recipientRole: 'finance_manager',
        title: `Deposit Required: ${after.orderNumber}`,
        body: `Sales order ${after.orderNumber} awaiting deposit of ${after.paymentTerms?.depositAmount || 0} ${after.currency}.`,
        entityId: orderId,
        severity: 'high',
      });
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// 2. ON CHANGE ORDER APPROVED
// ────────────────────────────────────────────────────────────────────────────

const onChangeOrderApproved = onDocumentUpdated(
  {
    document: 'changeOrders/{coId}',
    region: 'us-central1',
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const coId = event.params.coId;

    // Only act when CO transitions to 'approved'
    if (before.status === after.status || after.status !== 'approved') return;

    logger.info(`[ChangeOrder] ${coId} approved — checking design sign-off invalidation`);

    // Emit business event
    await emitBusinessEvent({
      eventType: 'change_order_approved',
      severity: after.isPostScopeFreeze ? 'high' : 'medium',
      entityId: coId,
      entityName: after.changeOrderNumber,
      projectId: null,
      title: `Change Order Approved: ${after.changeOrderNumber}`,
      description: `${after.title} — price impact: ${after.priceImpact}`,
      previousState: before.status,
      currentState: 'approved',
      changedFields: ['status'],
      metadata: {
        salesOrderId: after.salesOrderId,
        priceImpact: after.priceImpact,
        isPostScopeFreeze: after.isPostScopeFreeze,
      },
    });

    // Notify if post-scope-freeze
    if (after.isPostScopeFreeze) {
      await createNotification({
        recipientRole: 'sales_manager',
        title: `Post-Freeze CO Approved: ${after.changeOrderNumber}`,
        body: `A change order was approved after scope freeze. Design sign-off may need to be re-collected.`,
        entityType: 'change_order',
        entityId: coId,
        severity: 'high',
      });
    }
  }
);

// ────────────────────────────────────────────────────────────────────────────
// 3. ON SALES ORDER RELEASED TO PRODUCTION
// ────────────────────────────────────────────────────────────────────────────

const onSalesOrderReleased = onDocumentUpdated(
  {
    document: 'salesOrders/{orderId}',
    region: 'us-central1',
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const orderId = event.params.orderId;

    // Only act on transition to released_to_production
    if (after.status !== 'released_to_production' || before.status === 'released_to_production') return;

    logger.info(`[SalesOrder] ${orderId} released to production`);

    // Create contract record
    const contractRef = await db.collection('contracts').add({
      salesOrderId: orderId,
      orderNumber: after.orderNumber,
      subsidiaryId: after.subsidiaryId,
      customerId: after.customerId,
      customerName: after.customerName,
      designProjectId: after.designProjectId,
      contractValue: after.currentAmount,
      currency: after.currency,
      scopeVersion: after.scopeVersion,
      scopeDescription: after.scopeDescription,
      paymentTerms: after.paymentTerms,
      status: 'active',
      signedAt: FieldValue.serverTimestamp(),
      createdAt: FieldValue.serverTimestamp(),
    });

    // Link contract back to SO
    await event.data.after.ref.update({
      contractId: contractRef.id,
      updatedAt: FieldValue.serverTimestamp(),
    });

    // Emit business event
    await emitBusinessEvent({
      eventType: 'sales_order_released_to_production',
      severity: 'high',
      entityId: orderId,
      entityName: after.orderNumber,
      projectId: after.designProjectId,
      title: `Order Released: ${after.orderNumber}`,
      description: `${after.customerName} — ${after.currentAmount} ${after.currency}. Contract ${contractRef.id} created.`,
      currentState: 'released_to_production',
      metadata: {
        contractId: contractRef.id,
        customerName: after.customerName,
        currentAmount: after.currentAmount,
      },
    });

    await createNotification({
      recipientRole: 'production_manager',
      title: `New Production Order: ${after.orderNumber}`,
      body: `Sales order ${after.orderNumber} has been released. Contract created. Begin production planning.`,
      entityId: orderId,
      severity: 'high',
    });
  }
);

// ────────────────────────────────────────────────────────────────────────────
// 4. STALE SALES ORDER CHECK (Daily 8 AM EAT = 5 AM UTC)
// ────────────────────────────────────────────────────────────────────────────

const staleSalesOrderCheck = onSchedule(
  {
    schedule: '0 5 * * *',
    timeZone: 'Africa/Kampala',
    region: 'us-central1',
  },
  async () => {
    logger.info('[SalesOrder] Running daily stale order check');

    const staleThresholdDays = 14;
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - staleThresholdDays);

    // Find orders in active statuses that haven't been updated
    const activeStatuses = [
      'draft',
      'sent_to_client',
      'negotiation',
      'client_accepted',
      'design_review',
      'awaiting_design_signoff',
      'design_approved',
      'scope_frozen',
      'awaiting_deposit',
    ];

    let staleCount = 0;

    for (const status of activeStatuses) {
      const snap = await db
        .collection('salesOrders')
        .where('status', '==', status)
        .where('updatedAt', '<', admin.firestore.Timestamp.fromDate(cutoff))
        .get();

      for (const doc of snap.docs) {
        const data = doc.data();
        const daysSinceUpdate = Math.floor(
          (Date.now() - data.updatedAt.toMillis()) / (1000 * 60 * 60 * 24)
        );

        // Check if already flagged
        const existingStaleFlag = (data.riskFlags || []).find(
          (f) => f.type === 'expired_quote' && !f.resolvedAt
        );
        if (existingStaleFlag) continue;

        // Add risk flag
        const riskFlags = data.riskFlags || [];
        riskFlags.push({
          id: `stale-${Date.now()}`,
          type: 'expired_quote',
          severity: daysSinceUpdate > 30 ? 'critical' : 'high',
          message: `Order stale for ${daysSinceUpdate} days without progress.`,
          createdAt: admin.firestore.Timestamp.now(),
          autoDetected: true,
        });

        await doc.ref.update({
          riskFlags,
          updatedAt: FieldValue.serverTimestamp(),
        });

        staleCount++;
      }
    }

    if (staleCount > 0) {
      await createNotification({
        recipientRole: 'sales_manager',
        title: `${staleCount} Stale Sales Orders`,
        body: `${staleCount} orders have not been updated in ${staleThresholdDays}+ days. Review and take action.`,
        entityType: 'sales_order',
        entityId: 'batch',
        severity: 'high',
      });
    }

    logger.info(`[SalesOrder] Stale check complete: ${staleCount} orders flagged`);
  }
);

// ────────────────────────────────────────────────────────────────────────────
// 5. AUTO DETECT RISKS ON SO UPDATE
// ────────────────────────────────────────────────────────────────────────────

const autoDetectRisks = onDocumentUpdated(
  {
    document: 'salesOrders/{orderId}',
    region: 'us-central1',
  },
  async (event) => {
    const before = event.data.before.data();
    const after = event.data.after.data();
    const orderId = event.params.orderId;

    // Skip if only riskFlags changed (prevent infinite loop)
    const significantFields = ['status', 'currentAmount', 'totalDiscountAmount', 'scopeFrozen', 'pendingChangeOrders', 'scopeVersion'];
    const hasSignificantChange = significantFields.some(
      (field) => JSON.stringify(before[field]) !== JSON.stringify(after[field])
    );
    if (!hasSignificantChange) return;

    const riskFlags = [];
    const now = admin.firestore.Timestamp.now();

    // Discount exceeds margin (estimate cost at 60% of original)
    const estimatedCost = after.originalQuoteAmount * 0.6;
    const effectivePrice = after.currentAmount;
    const margin = effectivePrice > 0 ? ((effectivePrice - estimatedCost) / effectivePrice) * 100 : 0;
    if (margin < 15 && after.totalDiscountAmount > 0) {
      riskFlags.push({
        id: `risk-margin-${Date.now()}`,
        type: 'discount_exceeds_margin',
        severity: margin < 5 ? 'critical' : 'high',
        message: `Estimated margin ${margin.toFixed(1)}% is below minimum. Review discount approvals.`,
        createdAt: now,
        autoDetected: true,
      });
    }

    // Multiple revisions
    if ((after.pendingChangeOrders || 0) + (after.changeOrders || []).length > 3) {
      riskFlags.push({
        id: `risk-revisions-${Date.now()}`,
        type: 'multiple_revisions',
        severity: 'medium',
        message: `${(after.changeOrders || []).length} change orders filed. Scope instability risk.`,
        createdAt: now,
        autoDetected: true,
      });
    }

    // No deposit collected after scope frozen
    if (
      after.scopeFrozen &&
      after.paymentTerms?.depositRequired &&
      after.gates?.depositReceived?.status !== 'approved' &&
      after.status !== 'awaiting_deposit'
    ) {
      // Check if waiting a while
      if (after.scopeFrozenAt) {
        const daysSinceFreeze = Math.floor(
          (Date.now() - after.scopeFrozenAt.toMillis()) / (1000 * 60 * 60 * 24)
        );
        if (daysSinceFreeze > 7) {
          riskFlags.push({
            id: `risk-nodeposit-${Date.now()}`,
            type: 'no_deposit',
            severity: 'high',
            message: `Scope frozen ${daysSinceFreeze} days ago but deposit not yet collected.`,
            createdAt: now,
            autoDetected: true,
          });
        }
      }
    }

    // Unsigned design after scope freeze
    if (
      after.scopeFrozen &&
      after.gates?.designSignOff?.status !== 'approved'
    ) {
      riskFlags.push({
        id: `risk-unsigned-${Date.now()}`,
        type: 'unsigned_design',
        severity: 'high',
        message: 'Scope is frozen but design has not been signed off by client.',
        createdAt: now,
        autoDetected: true,
      });
    }

    // Only update if new risks detected
    if (riskFlags.length > 0) {
      // Merge with existing non-auto-detected flags and resolved flags
      const existingManual = (after.riskFlags || []).filter((f) => !f.autoDetected);
      const existingResolved = (after.riskFlags || []).filter((f) => f.resolvedAt);
      const allFlags = [...existingManual, ...existingResolved, ...riskFlags];

      await event.data.after.ref.update({
        riskFlags: allFlags,
        updatedAt: FieldValue.serverTimestamp(),
        updatedBy: 'system:risk_detection',
      });

      logger.info(`[SalesOrder] ${orderId}: ${riskFlags.length} new risk flags detected`);
    }
  }
);

module.exports = {
  onSalesOrderStatusChanged,
  onChangeOrderApproved,
  onSalesOrderReleased,
  staleSalesOrderCheck,
  autoDetectRisks,
};
