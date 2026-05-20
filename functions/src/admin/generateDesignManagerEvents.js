/**
 * Cloud Function to Generate Business Events for Design Manager Projects
 * This runs with Firebase Admin privileges, bypassing the need for service account keys
 */

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const cors = require('cors')({ origin: true });

/**
 * Event type mapping for Design Manager project stages
 * Maps to actual event-catalog.ts events
 */
const EVENT_TYPES = {
  'brief': 'finishes.client_consultation_scheduled',
  'scoping': 'finishes.space_planning_requested',
  'design': 'finishes.design_concepts_created',
  'review': 'finishes.design_approval_requested',
  'approval': 'finishes.client_feedback_received',
  'production': 'finishes.design_production_ready',
  'delivery': 'finishes.installation_scheduled',
  'completed': 'finishes.installation_complete',
};

/**
 * Get appropriate event type based on project stage and status
 */
function getEventType(project) {
  const stage = project.currentStage || 'brief';
  const status = project.status || 'active';

  if (status === 'completed') {
    return 'finishes.installation_complete';
  }

  return EVENT_TYPES[stage] || 'finishes.client_consultation_scheduled';
}

/**
 * Generate business event for a Design Manager project
 */
function generateEventForProject(project, projectId) {
  const eventType = getEventType(project);

  return {
    eventType,
    sourceModule: 'design_manager',
    subsidiary: 'finishes',
    entityType: 'project',
    entityId: projectId,

    // Event metadata
    timestamp: admin.firestore.Timestamp.now(),
    createdAt: admin.firestore.Timestamp.now(),
    processedAt: null,
    status: 'pending',

    // Project context
    context: {
      projectId,
      projectName: project.name || 'Unnamed Project',
      customerId: project.customerId || null,
      customerName: project.customerName || null,
      currentStage: project.currentStage || 'brief',
      status: project.status || 'active',
      priority: project.priority || 'medium',

      // Team information
      assignedDesigner: project.assignedTo || null,
      projectManager: project.createdBy || null,

      // Dates
      createdDate: project.createdAt || null,
      dueDate: project.dueDate || null,
      updatedDate: project.updatedAt || null,

      // Additional context
      scope: project.scope || null,
      budget: project.budget || null,
      deliverables: project.deliverables || [],
    },

    // Processing metadata
    taskGenerationAttempts: 0,
    lastProcessingError: null,
    retryCount: 0,
  };
}

/**
 * Cloud Function: Generate Business Events for Design Manager Projects
 *
 * @param {Object} data - Request data
 * @param {boolean} data.dryRun - If true, only simulate without creating events
 * @returns {Object} Summary of events created
 */
exports.generateDesignManagerEvents = onCall({
  timeoutSeconds: 540,
  memory: '512MiB',
  // Remove 'invoker: public' to require authentication
}, async (request) => {
  // Require authentication
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated to generate events');
  }

  const { dryRun = false } = request.data || {};
  const db = admin.firestore();

  try {
    // Log authentication info
    const uid = request.auth.uid;
    console.log('Starting Business Event Generation for Design Manager Projects');
    console.log(`Authenticated user: ${uid}`);
    console.log(`Dry Run: ${dryRun}`);

    // Fetch all Design Manager projects
    const projectsSnapshot = await db.collection('designProjects').get();

    if (projectsSnapshot.empty) {
      return {
        success: true,
        message: 'No Design Manager projects found',
        stats: {
          total: 0,
          processed: 0,
          skipped: 0,
          errors: 0,
        },
      };
    }

    console.log(`Found ${projectsSnapshot.size} projects`);

    // Statistics
    const stats = {
      total: projectsSnapshot.size,
      processed: 0,
      skipped: 0,
      errors: 0,
      byEventType: {},
      byStage: {},
    };

    const createdEvents = [];
    const errors = [];

    // Process each project
    for (const doc of projectsSnapshot.docs) {
      const projectId = doc.id;
      const project = doc.data();

      try {
        // Check if event already exists
        const existingEventQuery = await db.collection('businessEvents')
          .where('entityType', '==', 'project')
          .where('entityId', '==', projectId)
          .where('sourceModule', '==', 'design_manager')
          .limit(1)
          .get();

        if (!existingEventQuery.empty) {
          console.log(`Skipping ${projectId} - Event already exists`);
          stats.skipped++;
          continue;
        }

        // Generate event
        const event = generateEventForProject(project, projectId);
        const eventType = event.eventType;
        const stage = project.currentStage || 'unknown';

        // Update statistics
        stats.byEventType[eventType] = (stats.byEventType[eventType] || 0) + 1;
        stats.byStage[stage] = (stats.byStage[stage] || 0) + 1;

        if (!dryRun) {
          // Create the business event
          const docRef = await db.collection('businessEvents').add(event);
          console.log(`Created event for project: ${project.name || projectId} (${docRef.id})`);

          createdEvents.push({
            projectId,
            projectName: project.name,
            eventType,
            stage,
            eventId: docRef.id,
          });
        } else {
          console.log(`[DRY RUN] Would create event for: ${project.name || projectId}`);

          createdEvents.push({
            projectId,
            projectName: project.name,
            eventType,
            stage,
            dryRun: true,
          });
        }

        stats.processed++;

      } catch (error) {
        console.error(`Error processing project ${projectId}:`, error.message);
        stats.errors++;
        errors.push({
          projectId,
          error: error.message,
        });
      }
    }

    const result = {
      success: true,
      dryRun,
      message: dryRun
        ? `Dry run completed. Would create ${stats.processed} events.`
        : `Successfully created ${stats.processed} business events.`,
      stats,
      events: createdEvents.slice(0, 50), // Return first 50 events
      totalEvents: createdEvents.length,
      errors: errors.slice(0, 10), // Return first 10 errors if any
    };

    console.log('Event generation completed:', result.message);
    return result;

  } catch (error) {
    console.error('Fatal error in generateDesignManagerEvents:', error);
    throw new HttpsError('internal', `Failed to generate events: ${error.message}`);
  }
});

/**
 * HTTP endpoint version with CORS support
 */
exports.generateDesignManagerEventsHTTP = onRequest({
  timeoutSeconds: 540,
  memory: '512MiB',
  cors: ['https://dawinos.web.app', 'https://dawinos.firebaseapp.com'],
  // Remove 'invoker: public' to require authentication
}, async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  // Require Firebase ID token authentication
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    res.status(401).json({ error: 'Unauthorized: Missing or invalid authorization header' });
    return;
  }

  try {
    const idToken = authHeader.substring(7);
    const decodedToken = await admin.auth().verifyIdToken(idToken);
    console.log('Authenticated user:', decodedToken.uid, decodedToken.email);
  } catch (error) {
    console.error('Token verification failed:', error.message);
    res.status(401).json({ error: 'Unauthorized: Invalid token' });
    return;
  }

  try {
    const { dryRun = false } = req.body;
    const db = admin.firestore();

    console.log('Starting Business Event Generation for Design Manager Projects');
    console.log(`Dry Run: ${dryRun}`);

    // Fetch all Design Manager projects
    const projectsSnapshot = await db.collection('designProjects').get();

    if (projectsSnapshot.empty) {
      res.json({
        success: true,
        message: 'No Design Manager projects found',
        stats: {
          total: 0,
          processed: 0,
          skipped: 0,
          errors: 0,
        },
      });
      return;
    }

    console.log(`Found ${projectsSnapshot.size} projects`);

    // Statistics
    const stats = {
      total: projectsSnapshot.size,
      processed: 0,
      skipped: 0,
      errors: 0,
      byEventType: {},
      byStage: {},
    };

    const createdEvents = [];
    const errors = [];

    // Process each project
    for (const doc of projectsSnapshot.docs) {
      const projectId = doc.id;
      const project = doc.data();

      try {
        // Check if event already exists
        const existingEventQuery = await db.collection('businessEvents')
          .where('entityType', '==', 'project')
          .where('entityId', '==', projectId)
          .where('sourceModule', '==', 'design_manager')
          .limit(1)
          .get();

        if (!existingEventQuery.empty) {
          console.log(`Skipping ${projectId} - Event already exists`);
          stats.skipped++;
          continue;
        }

        // Generate event
        const event = generateEventForProject(project, projectId);
        const eventType = event.eventType;
        const stage = project.currentStage || 'unknown';

        // Update statistics
        stats.byEventType[eventType] = (stats.byEventType[eventType] || 0) + 1;
        stats.byStage[stage] = (stats.byStage[stage] || 0) + 1;

        if (!dryRun) {
          // Create the business event
          const docRef = await db.collection('businessEvents').add(event);
          console.log(`Created event for project: ${project.name || projectId} (${docRef.id})`);

          createdEvents.push({
            projectId,
            projectName: project.name,
            eventType,
            stage,
            eventId: docRef.id,
          });
        } else {
          console.log(`[DRY RUN] Would create event for: ${project.name || projectId}`);

          createdEvents.push({
            projectId,
            projectName: project.name,
            eventType,
            stage,
            dryRun: true,
          });
        }

        stats.processed++;

      } catch (error) {
        console.error(`Error processing project ${projectId}:`, error.message);
        stats.errors++;
        errors.push({
          projectId,
          error: error.message,
        });
      }
    }

    const result = {
      success: true,
      dryRun,
      message: dryRun
        ? `Dry run completed. Would create ${stats.processed} events.`
        : `Successfully created ${stats.processed} business events.`,
      stats,
      events: createdEvents.slice(0, 50), // Return first 50 events
      totalEvents: createdEvents.length,
      errors: errors.slice(0, 10), // Return first 10 errors if any
    };

    console.log('Event generation completed:', result.message);
    res.json(result);

  } catch (error) {
    console.error('Fatal error in generateDesignManagerEventsHTTP:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// ============================================
// Process Pending Events — reuses task generation logic from taskGeneration.js
// ============================================

/**
 * Process all pending business events and generate tasks with assignment
 * This is for backfilling events that were created before the trigger was fixed
 */
exports.processPendingEvents = onCall(
  {
    region: 'us-central1',
    timeoutSeconds: 540,
    memory: '512MiB',
    // Remove 'invoker: public' to require authentication
  },
  async (request) => {
    // Require authentication
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'User must be authenticated to process events');
    }

    const db = admin.firestore();
    const dryRun = request.data?.dryRun ?? false;

    logger.info('Processing pending business events', { dryRun, uid: request.auth.uid });

    // Task rules (inline copy to avoid import issues)
    const TASK_RULES = {
      design_item_created: [
        { title: 'Review new design item: {{entityName}}', description: 'A new design item needs initial review.', defaultPriority: 'medium', assignToRole: 'design-manager', checklist: ['Review design brief', 'Verify specifications', 'Set initial RAG status', 'Assign to designer'] },
      ],
      design_project_created: [
        { title: 'Set up new design project: {{entityName}}', description: 'Complete initial project setup.', defaultPriority: 'high', assignToRole: 'project-manager', checklist: ['Review project scope', 'Assign project team', 'Set milestones', 'Create initial design items'] },
        { title: 'Prepare project brief for: {{entityName}}', description: 'Compile the project brief.', defaultPriority: 'medium', assignToRole: 'designer', checklist: ['Gather client requirements', 'Document preferences', 'Identify constraints', 'Share brief'] },
      ],
      project_brief_received: [
        { title: 'Review project brief: {{entityName}}', description: 'Review requirements and prepare project plan.', defaultPriority: 'high', assignToRole: 'design-manager', checklist: ['Review client brief', 'Assess feasibility', 'Identify deliverables', 'Prepare estimate'] },
        { title: 'Schedule client consultation: {{entityName}}', description: 'Arrange initial consultation meeting.', defaultPriority: 'medium', assignToRole: 'client-liaison', checklist: ['Contact client', 'Prepare agenda', 'Book meeting', 'Send invite'] },
        { title: 'Site assessment: {{entityName}}', description: 'Conduct site visit or assessment.', defaultPriority: 'medium', assignToRole: 'space-planner', checklist: ['Schedule visit', 'Take measurements', 'Document conditions', 'Note constraints'] },
      ],
      'finishes.client_consultation_scheduled': [
        { title: 'Prepare for client consultation: {{entityName}}', description: 'Prepare materials and agenda.', defaultPriority: 'high', assignToRole: 'designer', checklist: ['Review client history', 'Prepare design options', 'Gather samples', 'Prepare presentation'] },
        { title: 'Coordinate consultation logistics: {{entityName}}', description: 'Ensure logistics are in place.', defaultPriority: 'medium', assignToRole: 'client-liaison', checklist: ['Confirm attendance', 'Prepare meeting space', 'Arrange samples', 'Brief team'] },
      ],
      'finishes.space_planning_requested': [
        { title: 'Complete space planning: {{entityName}}', description: 'Conduct analysis and prepare layout options.', defaultPriority: 'high', assignToRole: 'space-planner', checklist: ['Review measurements', 'Create layout options', 'Assess constraints', 'Prepare deliverable'] },
      ],
      'finishes.design_concepts_created': [
        { title: 'Review design concepts: {{entityName}}', description: 'Internal review before client presentation.', defaultPriority: 'high', assignToRole: 'design-manager', checklist: ['Review quality', 'Check brand alignment', 'Verify feasibility', 'Approve for presentation'] },
      ],
      'finishes.design_approval_requested': [
        { title: 'Process design approval: {{entityName}}', description: 'Design requires approval.', defaultPriority: 'high', assignToRole: 'design-manager', checklist: ['Review final design', 'Check compliance', 'Verify costs', 'Provide approval'] },
      ],
      'finishes.design_production_ready': [
        { title: 'Prepare production package: {{entityName}}', description: 'Prepare manufacturing documentation.', defaultPriority: 'critical', assignToRole: 'production-planner', checklist: ['Finalize drawings', 'Generate cutlists', 'Verify materials', 'Schedule production'] },
        { title: 'Procure materials: {{entityName}}', description: 'Order required materials.', defaultPriority: 'high', assignToRole: 'procurement-coordinator', checklist: ['Review BOM', 'Check stock', 'Place orders', 'Confirm delivery'] },
      ],
      'finishes.installation_scheduled': [
        { title: 'Coordinate installation: {{entityName}}', description: 'Prepare team and logistics.', defaultPriority: 'high', assignToRole: 'installation-coordinator', checklist: ['Confirm date', 'Assign crew', 'Arrange transport', 'Prepare checklist'] },
      ],
      'finishes.installation_complete': [
        { title: 'Post-installation review: {{entityName}}', description: 'Final inspection and project close.', defaultPriority: 'medium', assignToRole: 'quality-inspector', checklist: ['Final inspection', 'Completion photos', 'Client sign-off', 'Close project'] },
      ],
      'hr.employee.created': [
        { title: 'Onboard new employee: {{entityName}}', description: 'Complete onboarding process.', defaultPriority: 'high', assignToRole: 'hr-manager', checklist: ['Prepare workstation', 'Set up access', 'Schedule orientation', 'Assign mentor'] },
        { title: 'Set up role profile: {{entityName}}', description: 'Configure role and workload settings.', defaultPriority: 'medium', assignToRole: 'hr-manager', checklist: ['Assign role profile', 'Set workload capacity', 'Configure capabilities', 'Add to department'] },
      ],
      'hr.employee.updated': [
        { title: 'Review employee update: {{entityName}}', description: 'Review changes and take action.', defaultPriority: 'low', assignToRole: 'hr-manager', checklist: ['Review changes', 'Verify accuracy', 'Update related records'] },
      ],
      'finishes.client_feedback_received': [
        { title: 'Process client feedback: {{entityName}}', description: 'Review and action client feedback.', defaultPriority: 'high', assignToRole: 'designer', checklist: ['Review comments', 'Identify revisions', 'Update design', 'Schedule follow-up'] },
      ],
    };

    function interpolate(template, eventData) {
      return template
        .replace(/\{\{entityName\}\}/g, eventData.entityName || eventData.context?.projectName || eventData.payload?.entityName || 'Unknown')
        .replace(/\{\{projectName\}\}/g, eventData.projectName || eventData.context?.projectName || '')
        .replace(/\{\{eventType\}\}/g, eventData.eventType || '');
    }

    const SLA_HOURS = { critical: 4, high: 8, medium: 24, low: 72 };
    function calcDueDate(priority) {
      const hours = SLA_HOURS[priority] || 24;
      const d = new Date();
      let left = hours;
      while (left > 0) { d.setHours(d.getHours() + 1); if (d.getDay() !== 0 && d.getDay() !== 6) left--; }
      return admin.firestore.Timestamp.fromDate(d);
    }

    // Find best employee for a role
    async function findEmployee(roleSlug) {
      if (!roleSlug) return null;
      try {
        const snap = await db.collection('employees')
          .where('employmentStatus', 'in', ['active', 'probation'])
          .limit(50).get();
        if (snap.empty) return null;

        const candidates = [];
        for (const doc of snap.docs) {
          const d = doc.data();
          const empRole = d.roleProfileId || d.position?.roleProfileId || '';
          const accessRoles = d.systemAccess?.accessRoles || [];
          const accessRoleMatch = accessRoles.includes(roleSlug);
          const titleMatch = (d.position?.title || '').toLowerCase().replace(/[\s_-]+/g, '-').includes(roleSlug.toLowerCase());
          if (accessRoleMatch || empRole === roleSlug || titleMatch) {
            const tasks = d.workload?.activeTaskCount ?? 0;
            const max = d.workload?.maxConcurrent ?? 40;
            candidates.push({ id: doc.id, name: `${d.firstName || ''} ${d.lastName || ''}`.trim() || 'Unknown', email: d.email || '', tasks, util: max > 0 ? Math.round((tasks / max) * 100) : 100 });
          }
        }
        if (!candidates.length) return null;
        candidates.sort((a, b) => a.util - b.util || a.tasks - b.tasks);
        return candidates[0];
      } catch { return null; }
    }

    // Fetch pending events
    const pendingSnapshot = await db.collection('businessEvents')
      .where('status', '==', 'pending')
      .limit(200)
      .get();

    // Also check events without a processing.status
    const unprocessedSnapshot = await db.collection('businessEvents')
      .limit(200)
      .get();

    // Merge and deduplicate
    const allEventDocs = new Map();
    for (const doc of pendingSnapshot.docs) allEventDocs.set(doc.id, doc);
    for (const doc of unprocessedSnapshot.docs) {
      const data = doc.data();
      const procStatus = data.processing?.status;
      if (!procStatus || procStatus === 'pending') {
        allEventDocs.set(doc.id, doc);
      }
    }

    const stats = { total: allEventDocs.size, processed: 0, skipped: 0, errors: 0, tasksCreated: 0, byEventType: {} };
    const results = [];

    for (const [eventId, eventDoc] of allEventDocs) {
      const eventData = { id: eventId, ...eventDoc.data() };
      const eventType = eventData.eventType;
      const rules = TASK_RULES[eventType];

      if (!rules || rules.length === 0) {
        stats.skipped++;
        continue;
      }

      stats.byEventType[eventType] = (stats.byEventType[eventType] || 0) + 1;

      if (dryRun) {
        stats.processed++;
        results.push({ eventId, eventType, entityName: eventData.entityName || eventData.context?.projectName || 'N/A', tasksToCreate: rules.length, dryRun: true });
        continue;
      }

      try {
        // Idempotency: skip if already processed
        const procStatus = eventData.processing?.status;
        if (procStatus === 'processed' || procStatus === 'processing') {
          stats.skipped++;
          continue;
        }

        // Mark as processing
        await eventDoc.ref.update({
          'processing.status': 'processing',
          'processing.processedAt': admin.firestore.FieldValue.serverTimestamp(),
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        const generatedTaskIds = [];

        for (const rule of rules) {
          const assignee = await findEmployee(rule.assignToRole);
          const priority = rule.defaultPriority || 'medium';

          const taskDoc = await db.collection('generatedTasks').add({
            title: interpolate(rule.title, eventData),
            description: rule.description || '',
            priority,
            status: 'pending',
            stage: assignee ? 'assigned' : 'pending_assignment',
            sourceEventId: eventId,
            sourceEventType: eventType,
            sourceModule: eventData.sourceModule || 'unknown',
            subsidiary: eventData.subsidiary || eventData.context?.subsidiary || 'finishes',
            entityType: eventData.entityType || 'unknown',
            entityId: eventData.entityId || eventData.context?.entityId || null,
            entityName: eventData.entityName || eventData.context?.projectName || null,
            projectId: eventData.projectId || eventData.context?.projectId || null,
            projectName: eventData.projectName || eventData.context?.projectName || null,
            assignedTo: assignee?.id || null,
            assignedToName: assignee?.name || null,
            assignment: assignee ? {
              assigneeId: assignee.id,
              assigneeRef: { id: assignee.id, name: assignee.name, email: assignee.email },
              assignedAt: admin.firestore.FieldValue.serverTimestamp(),
              assignedBy: 'system',
              assignmentMethod: 'workload_based',
              assignedRole: rule.assignToRole,
            } : null,
            dueDate: calcDueDate(priority),
            checklistItems: (rule.checklist || []).map(t => ({ text: t, completed: false })),
            checklistProgress: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
          });

          generatedTaskIds.push(taskDoc.id);
          stats.tasksCreated++;
        }

        // Mark event as processed
        await eventDoc.ref.update({
          'processing.status': 'processed',
          'processing.tasksGenerated': generatedTaskIds.length,
          'processing.generatedTaskIds': generatedTaskIds,
          'processing.completedAt': admin.firestore.FieldValue.serverTimestamp(),
          status: 'processed',
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });

        stats.processed++;
        results.push({ eventId, eventType, entityName: eventData.entityName || eventData.context?.projectName || 'N/A', tasksCreated: generatedTaskIds.length, taskIds: generatedTaskIds });

      } catch (error) {
        stats.errors++;
        logger.error('Failed to process event', { eventId, error: error.message });
        await eventDoc.ref.update({
          'processing.status': 'failed',
          'processing.errorMessage': error.message,
          updatedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
    }

    const message = dryRun
      ? `Dry run: would process ${stats.processed} events, creating ~${results.reduce((s, r) => s + (r.tasksToCreate || 0), 0)} tasks`
      : `Processed ${stats.processed} events, created ${stats.tasksCreated} tasks`;

    logger.info(message, stats);

    return { success: true, dryRun, message, stats, results: results.slice(0, 50) };
  }
);
