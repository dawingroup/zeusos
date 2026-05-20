/**
 * Business Event Monitors - DawinOS v2.0
 * Cloud Function triggers that monitor source databases and create business events
 * 
 * These triggers watch for changes in:
 * - Design Manager (designProjects, designItems)
 * - Launch Pipeline (launchProducts)
 * - Advisory Engagements
 * - And other modules
 * 
 * When changes occur, they create business events that trigger task generation.
 */

const { onDocumentCreated, onDocumentUpdated, onDocumentDeleted } = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');

const db = admin.firestore();

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Create a business event document
 */
async function createBusinessEvent({
  eventType,
  category,
  severity,
  sourceModule,
  subsidiary,
  entityType,
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
    category,
    severity: severity || 'medium',
    sourceModule,
    subsidiary,
    entityType,
    entityId,
    entityName,
    projectId: projectId || null,
    projectName: projectName || null,
    title,
    description,
    previousState: previousState || null,
    currentState: currentState || null,
    changedFields: changedFields || [],
    triggeredBy: triggeredBy || null,
    triggeredByName: triggeredByName || null,
    triggeredAt: admin.firestore.FieldValue.serverTimestamp(),
    status: 'pending',
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    metadata: metadata || {},
  };

  const docRef = await db.collection('businessEvents').add(eventData);
  
  logger.info('Business event created', {
    eventId: docRef.id,
    eventType,
    entityId,
    sourceModule,
  });

  return docRef.id;
}

/**
 * Detect which fields changed between two documents
 */
function detectChangedFields(before, after, fieldsToWatch) {
  const changed = [];
  
  for (const field of fieldsToWatch) {
    const beforeVal = getNestedValue(before, field);
    const afterVal = getNestedValue(after, field);
    
    if (JSON.stringify(beforeVal) !== JSON.stringify(afterVal)) {
      changed.push(field);
    }
  }
  
  return changed;
}

/**
 * Get nested value from object using dot notation
 */
function getNestedValue(obj, path) {
  return path.split('.').reduce((current, key) => current?.[key], obj);
}

// ============================================================================
// DESIGN MANAGER TRIGGERS
// ============================================================================

/**
 * Monitor Design Items for stage changes
 */
const onDesignItemUpdated = onDocumentUpdated(
  {
    document: 'designProjects/{projectId}/designItems/{itemId}',
    region: 'us-central1',
  },
  async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();
    
    if (!beforeData || !afterData) {
      logger.warn('Missing before/after data in design item update');
      return null;
    }

    const { projectId, itemId } = event.params;
    const itemName = afterData.name || afterData.itemCode || itemId;

    // Fields to monitor for changes
    const watchedFields = ['currentStage', 'ragStatus', 'approvals', 'sourcingType'];
    const changedFields = detectChangedFields(beforeData, afterData, watchedFields);

    if (changedFields.length === 0) {
      return null; // No relevant changes
    }

    // Stage Change Event
    if (changedFields.includes('currentStage')) {
      const prevStage = beforeData.currentStage;
      const newStage = afterData.currentStage;

      // Determine severity based on stage
      let severity = 'info';
      if (newStage === 'production-ready') {
        severity = 'high';
      } else if (newStage === 'pre-production' || newStage === 'technical') {
        severity = 'medium';
      }

      await createBusinessEvent({
        eventType: 'design_item_stage_changed',
        category: 'workflow_transition',
        severity,
        sourceModule: 'design_manager',
        subsidiary: 'finishes',
        entityType: 'designItems',
        entityId: itemId,
        entityName: itemName,
        projectId,
        projectName: afterData.projectCode || projectId,
        title: `Design Item Stage Changed: ${itemName}`,
        description: `Design item "${itemName}" moved from ${prevStage} to ${newStage} stage.`,
        previousState: { currentStage: prevStage },
        currentState: { currentStage: newStage },
        changedFields: ['currentStage'],
        triggeredBy: afterData.updatedBy,
      });
    }

    // RAG Status Change Event
    if (changedFields.includes('ragStatus')) {
      // Check if any RAG went red
      const hasRed = JSON.stringify(afterData.ragStatus).includes('"status":"red"');
      
      await createBusinessEvent({
        eventType: 'design_item_rag_updated',
        category: 'quality_gate',
        severity: hasRed ? 'high' : 'low',
        sourceModule: 'design_manager',
        subsidiary: 'finishes',
        entityType: 'designItems',
        entityId: itemId,
        entityName: itemName,
        projectId,
        projectName: afterData.projectCode || projectId,
        title: `RAG Status Updated: ${itemName}`,
        description: `RAG status has been updated for design item "${itemName}".${hasRed ? ' Some items are now RED.' : ''}`,
        previousState: { ragStatus: beforeData.ragStatus },
        currentState: { ragStatus: afterData.ragStatus },
        changedFields: ['ragStatus'],
        triggeredBy: afterData.updatedBy,
      });
    }

    // Approval Requested Event
    if (changedFields.includes('approvals')) {
      const prevApprovals = beforeData.approvals || [];
      const newApprovals = afterData.approvals || [];
      
      // Check if new approval was added
      if (newApprovals.length > prevApprovals.length) {
        const latestApproval = newApprovals[newApprovals.length - 1];
        
        if (latestApproval?.status === 'pending') {
          await createBusinessEvent({
            eventType: 'design_item_approval_requested',
            category: 'approval_required',
            severity: 'medium',
            sourceModule: 'design_manager',
            subsidiary: 'finishes',
            entityType: 'designItems',
            entityId: itemId,
            entityName: itemName,
            projectId,
            projectName: afterData.projectCode || projectId,
            title: `Approval Requested: ${itemName}`,
            description: `A ${latestApproval.type || 'design'} approval has been requested for "${itemName}".`,
            currentState: { approval: latestApproval },
            changedFields: ['approvals'],
            triggeredBy: latestApproval.requestedBy,
          });
        }
      }
    }

    // Sourcing Type Changed (Procurement Started)
    if (changedFields.includes('sourcingType')) {
      if (afterData.sourcingType === 'PROCURED' && beforeData.sourcingType !== 'PROCURED') {
        await createBusinessEvent({
          eventType: 'design_item_procurement_started',
          category: 'workflow_transition',
          severity: 'high',
          sourceModule: 'design_manager',
          subsidiary: 'finishes',
          entityType: 'designItems',
          entityId: itemId,
          entityName: itemName,
          projectId,
          projectName: afterData.projectCode || projectId,
          title: `Procurement Started: ${itemName}`,
          description: `Design item "${itemName}" has been marked as a PROCURED item. Procurement process should begin.`,
          previousState: { sourcingType: beforeData.sourcingType },
          currentState: { sourcingType: afterData.sourcingType },
          changedFields: ['sourcingType'],
          triggeredBy: afterData.updatedBy,
        });
      }
    }

    return { processed: true, changedFields };
  }
);

/**
 * Monitor new Design Items created
 */
const onDesignItemCreated = onDocumentCreated(
  {
    document: 'designProjects/{projectId}/designItems/{itemId}',
    region: 'us-central1',
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return null;

    const { projectId, itemId } = event.params;
    const itemName = data.name || data.itemCode || itemId;

    await createBusinessEvent({
      eventType: 'design_item_created',
      category: 'workflow_transition',
      severity: 'info',
      sourceModule: 'design_manager',
      subsidiary: 'finishes',
      entityType: 'designItems',
      entityId: itemId,
      entityName: itemName,
      projectId,
      projectName: data.projectCode || projectId,
      title: `New Design Item Created: ${itemName}`,
      description: `A new design item "${itemName}" has been created in stage "${data.currentStage || 'concept'}".`,
      currentState: {
        currentStage: data.currentStage,
        category: data.category,
        sourcingType: data.sourcingType,
      },
      triggeredBy: data.createdBy,
    });

    return { created: true };
  }
);

/**
 * Monitor new Design Projects created
 */
const onDesignProjectCreated = onDocumentCreated(
  {
    document: 'designProjects/{projectId}',
    region: 'us-central1',
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return null;

    const { projectId } = event.params;
    const projectName = data.name || data.code || projectId;

    await createBusinessEvent({
      eventType: 'design_project_created',
      category: 'workflow_transition',
      severity: 'high',
      sourceModule: 'design_manager',
      subsidiary: 'finishes',
      entityType: 'designProjects',
      entityId: projectId,
      entityName: projectName,
      title: `New Design Project Created: ${projectName}`,
      description: `A new design project "${projectName}" has been created for client "${data.clientName || 'Unknown'}".`,
      currentState: {
        status: data.status || null,
        clientName: data.clientName || null,
        projectType: data.projectType || null,
      },
      triggeredBy: data.createdBy || null,
    });

    return { created: true };
  }
);

/**
 * Monitor Design Project status changes
 */
const onDesignProjectUpdated = onDocumentUpdated(
  {
    document: 'designProjects/{projectId}',
    region: 'us-central1',
  },
  async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();
    
    if (!beforeData || !afterData) return null;

    const { projectId } = event.params;
    const projectName = afterData.name || afterData.code || projectId;

    // Status change
    if (beforeData.status !== afterData.status) {
      await createBusinessEvent({
        eventType: 'design_project_status_changed',
        category: 'workflow_transition',
        severity: 'medium',
        sourceModule: 'design_manager',
        subsidiary: 'finishes',
        entityType: 'designProjects',
        entityId: projectId,
        entityName: projectName,
        title: `Project Status Changed: ${projectName}`,
        description: `Project "${projectName}" status changed from ${beforeData.status} to ${afterData.status}.`,
        previousState: { status: beforeData.status },
        currentState: { status: afterData.status },
        changedFields: ['status'],
        triggeredBy: afterData.updatedBy,
      });
    }

    return { processed: true };
  }
);

// ============================================================================
// LAUNCH PIPELINE TRIGGERS
// ============================================================================

/**
 * Monitor Launch Products for stage changes
 */
const onLaunchProductUpdated = onDocumentUpdated(
  {
    document: 'launchProducts/{productId}',
    region: 'us-central1',
  },
  async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();
    
    if (!beforeData || !afterData) return null;

    const { productId } = event.params;
    const productName = afterData.name || afterData.title || productId;

    // Stage change
    if (beforeData.stage !== afterData.stage) {
      const isLaunched = afterData.stage === 'launched';
      
      await createBusinessEvent({
        eventType: isLaunched ? 'product_launched' : 'product_stage_changed',
        category: 'workflow_transition',
        severity: isLaunched ? 'high' : 'medium',
        sourceModule: 'launch_pipeline',
        subsidiary: 'finishes',
        entityType: 'launchProducts',
        entityId: productId,
        entityName: productName,
        title: isLaunched 
          ? `Product Launched: ${productName}` 
          : `Product Stage Changed: ${productName}`,
        description: isLaunched
          ? `Product "${productName}" has been launched!`
          : `Product "${productName}" moved from ${beforeData.stage} to ${afterData.stage}.`,
        previousState: { stage: beforeData.stage },
        currentState: { stage: afterData.stage },
        changedFields: ['stage'],
        triggeredBy: afterData.updatedBy,
      });
    }

    return { processed: true };
  }
);

// ============================================================================
// ADVISORY ENGAGEMENT TRIGGERS
// ============================================================================

/**
 * Monitor new Engagements created
 */
const onEngagementCreated = onDocumentCreated(
  {
    document: 'engagements/{engagementId}',
    region: 'us-central1',
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return null;

    const { engagementId } = event.params;
    const engagementName = data.name || data.title || engagementId;

    await createBusinessEvent({
      eventType: 'engagement_created',
      category: 'workflow_transition',
      severity: 'high',
      sourceModule: 'engagements',
      subsidiary: 'advisory',
      entityType: 'engagements',
      entityId: engagementId,
      entityName: engagementName,
      title: `New Engagement Created: ${engagementName}`,
      description: `A new client engagement "${engagementName}" has been created.`,
      currentState: {
        status: data.status,
        clientName: data.clientName,
        engagementType: data.engagementType,
      },
      triggeredBy: data.createdBy,
    });

    return { created: true };
  }
);

/**
 * Monitor Engagement status changes
 */
const onEngagementUpdated = onDocumentUpdated(
  {
    document: 'engagements/{engagementId}',
    region: 'us-central1',
  },
  async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();
    
    if (!beforeData || !afterData) return null;

    const { engagementId } = event.params;
    const engagementName = afterData.name || afterData.title || engagementId;

    // Status change
    if (beforeData.status !== afterData.status) {
      await createBusinessEvent({
        eventType: 'engagement_status_changed',
        category: 'workflow_transition',
        severity: 'medium',
        sourceModule: 'engagements',
        subsidiary: 'advisory',
        entityType: 'engagements',
        entityId: engagementId,
        entityName: engagementName,
        title: `Engagement Status Changed: ${engagementName}`,
        description: `Engagement "${engagementName}" status changed from ${beforeData.status} to ${afterData.status}.`,
        previousState: { status: beforeData.status },
        currentState: { status: afterData.status },
        changedFields: ['status'],
        triggeredBy: afterData.updatedBy,
      });
    }

    return { processed: true };
  }
);

/**
 * Monitor Disbursement requests
 */
const onDisbursementCreated = onDocumentCreated(
  {
    document: 'engagements/{engagementId}/fundingSources/{fundingSourceId}/disbursements/{disbursementId}',
    region: 'us-central1',
  },
  async (event) => {
    const data = event.data?.data();
    if (!data) return null;

    const { engagementId, fundingSourceId, disbursementId } = event.params;

    await createBusinessEvent({
      eventType: 'disbursement_requested',
      category: 'approval_required',
      severity: 'high',
      sourceModule: 'funding',
      subsidiary: 'advisory',
      entityType: 'disbursements',
      entityId: disbursementId,
      entityName: `Disbursement Request - ${data.amount || 'N/A'}`,
      projectId: engagementId,
      title: `Disbursement Requested`,
      description: `A disbursement of ${data.amount} has been requested from funding source.`,
      currentState: {
        amount: data.amount,
        fundingSourceId,
        status: data.status,
      },
      triggeredBy: data.requestedBy,
      metadata: { fundingSourceId },
    });

    return { created: true };
  }
);

// ============================================================================
// DELIVERY PROJECT TRIGGERS (new)
// ============================================================================

/**
 * Monitor Delivery Projects for updates
 */
const onDeliveryProjectUpdated = onDocumentUpdated(
  {
    document: 'projects/{projectId}',
    region: 'us-central1',
  },
  async (event) => {
    const beforeData = event.data?.before?.data();
    const afterData = event.data?.after?.data();
    
    if (!beforeData || !afterData) return null;

    const { projectId } = event.params;
    const projectName = afterData.name || afterData.code || projectId;

    // Status change
    if (beforeData.status !== afterData.status) {
      await createBusinessEvent({
        eventType: 'project_status_changed',
        category: 'workflow_transition',
        severity: 'medium',
        sourceModule: 'engagements',
        subsidiary: 'advisory',
        entityType: 'projects',
        entityId: projectId,
        entityName: projectName,
        title: `Project Status Changed: ${projectName}`,
        description: `Project "${projectName}" status changed from ${beforeData.status} to ${afterData.status}.`,
        previousState: { status: beforeData.status },
        currentState: { status: afterData.status },
        changedFields: ['status'],
        triggeredBy: afterData.updatedBy,
      });
    }

    return { processed: true };
  }
);

// ============================================================================
// EXPORTS
// ============================================================================

module.exports = {
  // Design Manager
  onDesignItemUpdated,
  onDesignItemCreated,
  onDesignProjectCreated,
  onDesignProjectUpdated,
  
  // Launch Pipeline
  onLaunchProductUpdated,
  
  // Advisory
  onEngagementCreated,
  onEngagementUpdated,
  onDisbursementCreated,
  
  // Delivery
  onDeliveryProjectUpdated,
};
