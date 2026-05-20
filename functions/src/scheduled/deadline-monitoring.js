/**
 * Cloud Function - Deadline Monitoring (Gen 2)
 *
 * Scheduled function that runs hourly to check for:
 * - Overdue accountabilities
 * - Overdue variance investigations
 * - Missing monthly reconciliations
 *
 * Using v2 API (firebase-functions v4.x)
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

/**
 * Hourly deadline monitoring check
 * Runs every hour at minute 0
 */
exports.hourlyDeadlineCheck = onSchedule(
  {
    schedule: '0 * * * *', // Every hour at minute 0
    timeZone: 'Africa/Nairobi', // Kenya timezone
    timeoutSeconds: 540, // 9 minutes
    memory: '512MiB',
  },
  async (event) => {
    try {
      logger.info('[DeadlineMonitoring] Starting hourly deadline check...');
      const startTime = Date.now();

      const actions = [];

      // Check overdue accountabilities
      const accountabilityActions = await checkOverdueAccountabilities();
      actions.push(...accountabilityActions);

      // Check overdue investigations
      const investigationActions = await checkOverdueInvestigations();
      actions.push(...investigationActions);

      // Check reconciliation deadlines
      const reconciliationActions = await checkReconciliationDeadlines();
      actions.push(...reconciliationActions);

      const duration = Date.now() - startTime;

      const summary = {
        overdueAccountabilities: accountabilityActions.filter(a => a.type === 'accountability_overdue').length,
        overdueInvestigations: investigationActions.filter(a => a.type === 'investigation_overdue').length,
        overdueReconciliations: reconciliationActions.filter(a => a.type === 'reconciliation_overdue').length,
        escalations: actions.filter(a => a.type === 'escalation').length,
        notifications: actions.filter(a => a.type === 'notification').length,
      };

      logger.info('[DeadlineMonitoring] Hourly check completed:', {
        duration: `${duration}ms`,
        totalChecked: actions.length,
        summary,
      });

      // Log result to Firestore for audit trail
      await db.collection('deadline_monitoring_logs').add({
        timestamp: admin.firestore.Timestamp.now(),
        type: 'hourly_check',
        totalChecked: actions.length,
        summary,
        duration,
        status: 'success',
      });

      // Alert if significant issues found
      if (summary.overdueAccountabilities > 10 || summary.overdueInvestigations > 5) {
        logger.warn('[DeadlineMonitoring] HIGH NUMBER OF OVERDUE ITEMS:', summary);

        await db.collection('notifications').add({
          type: 'system_alert',
          severity: 'warning',
          recipientRole: 'ADMIN',
          subject: 'High Number of Overdue Items Detected',
          message: `Deadline monitoring detected ${summary.overdueAccountabilities} overdue accountabilities ` +
                   `and ${summary.overdueInvestigations} overdue investigations. ` +
                   `Please review urgently.`,
          createdAt: admin.firestore.Timestamp.now(),
          read: false,
          metadata: summary,
        });
      }
    } catch (error) {
      logger.error('[DeadlineMonitoring] Error during hourly check:', error);

      await db.collection('deadline_monitoring_logs').add({
        timestamp: admin.firestore.Timestamp.now(),
        type: 'hourly_check',
        status: 'error',
        error: error.message || String(error),
        stack: error.stack,
      });

      throw error;
    }
  }
);

/**
 * Daily summary report
 * Runs at 8:00 AM EAT every day
 */
exports.dailyDeadlineSummary = onSchedule(
  {
    schedule: '0 8 * * *', // 8:00 AM daily
    timeZone: 'Africa/Nairobi',
    timeoutSeconds: 300, // 5 minutes
    memory: '256MiB',
  },
  async (event) => {
    try {
      logger.info('[DeadlineMonitoring] Generating daily summary...');

      const summary = await getDeadlineSummary();

      // Log summary
      await db.collection('deadline_monitoring_logs').add({
        timestamp: admin.firestore.Timestamp.now(),
        type: 'daily_summary',
        summary,
        status: 'success',
      });

      // Send summary notification to finance team
      if (summary.overdueAccountabilities > 0 || summary.overdueInvestigations > 0 || summary.pendingReconciliations > 0) {
        await db.collection('notifications').add({
          type: 'daily_summary',
          severity: 'info',
          recipientRole: 'FINANCE',
          subject: 'Daily Deadline Summary',
          message: `Daily deadline status:\n\n` +
                   `- Overdue Accountabilities: ${summary.overdueAccountabilities}\n` +
                   `- Overdue Investigations: ${summary.overdueInvestigations}\n` +
                   `- Pending Reconciliations: ${summary.pendingReconciliations}\n` +
                   `- Upcoming Deadlines (3 days): ${summary.upcomingDeadlines}\n\n` +
                   `Please review and take appropriate action.`,
          createdAt: admin.firestore.Timestamp.now(),
          read: false,
          metadata: summary,
        });
      }

      logger.info('[DeadlineMonitoring] Daily summary generated:', summary);
    } catch (error) {
      logger.error('[DeadlineMonitoring] Error generating daily summary:', error);

      await db.collection('deadline_monitoring_logs').add({
        timestamp: admin.firestore.Timestamp.now(),
        type: 'daily_summary',
        status: 'error',
        error: error.message || String(error),
      });

      throw error;
    }
  }
);

/**
 * Manual trigger for deadline check
 * Callable function for admin to manually trigger deadline check
 */
exports.triggerDeadlineCheck = onCall(
  {
    timeoutSeconds: 540,
    memory: '512MiB',
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'User must be authenticated to trigger deadline check'
      );
    }

    // Verify admin role
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    const userData = userDoc.data();

    if (!userData || !['admin', 'super_admin'].includes(userData.role)) {
      throw new HttpsError(
        'permission-denied',
        'Only admins can manually trigger deadline checks'
      );
    }

    try {
      logger.info('[DeadlineMonitoring] Manual trigger by:', request.auth.uid);

      const actions = [];
      const accountabilityActions = await checkOverdueAccountabilities();
      const investigationActions = await checkOverdueInvestigations();
      const reconciliationActions = await checkReconciliationDeadlines();

      actions.push(...accountabilityActions, ...investigationActions, ...reconciliationActions);

      const summary = {
        overdueAccountabilities: accountabilityActions.filter(a => a.type === 'accountability_overdue').length,
        overdueInvestigations: investigationActions.filter(a => a.type === 'investigation_overdue').length,
        overdueReconciliations: reconciliationActions.filter(a => a.type === 'reconciliation_overdue').length,
        escalations: actions.filter(a => a.type === 'escalation').length,
        notifications: actions.filter(a => a.type === 'notification').length,
      };

      // Log result
      await db.collection('deadline_monitoring_logs').add({
        timestamp: admin.firestore.Timestamp.now(),
        type: 'manual_trigger',
        triggeredBy: request.auth.uid,
        totalChecked: actions.length,
        summary,
        status: 'success',
      });

      return {
        success: true,
        result: {
          timestamp: new Date().toISOString(),
          totalChecked: actions.length,
          summary,
        },
      };
    } catch (error) {
      logger.error('[DeadlineMonitoring] Error in manual trigger:', error);

      throw new HttpsError(
        'internal',
        'Error running deadline check',
        error.message || String(error)
      );
    }
  }
);

/**
 * Get deadline summary for project
 * Callable function for dashboard
 */
exports.getProjectDeadlineSummary = onCall(
  {
    timeoutSeconds: 60,
    memory: '256MiB',
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    try {
      const summary = await getDeadlineSummary(request.data?.projectId);

      return {
        success: true,
        summary,
      };
    } catch (error) {
      logger.error('[DeadlineMonitoring] Error getting summary:', error);

      throw new HttpsError(
        'internal',
        'Error getting deadline summary',
        error.message || String(error)
      );
    }
  }
);

// Helper functions

async function checkOverdueAccountabilities() {
  const actions = [];
  const now = new Date();

  const snapshot = await db.collection('requisitions')
    .where('accountabilityStatus', '==', 'pending')
    .where('status', '==', 'paid')
    .orderBy('accountabilityDueDate', 'asc')
    .limit(500)
    .get();

  const batch = db.batch();
  const notifications = [];

  snapshot.docs.forEach(doc => {
    const requisition = doc.data();

    if (!requisition.accountabilityDueDate) return;

    const dueDate = requisition.accountabilityDueDate.toDate();

    if (dueDate < now) {
      const daysOverdue = Math.floor((now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24));

      // Mark as overdue
      batch.update(doc.ref, {
        accountabilityStatus: 'overdue',
        updatedAt: admin.firestore.Timestamp.now(),
      });

      actions.push({
        type: 'accountability_overdue',
        entityType: 'requisition',
        entityId: doc.id,
        projectId: requisition.projectId,
        action: `Marked accountability as overdue (${daysOverdue} days past deadline)`,
        timestamp: now,
        details: { daysOverdue, dueDate, assignedTo: requisition.createdBy },
      });

      // Create notification
      notifications.push({
        type: 'accountability_overdue',
        severity: daysOverdue > 7 ? 'critical' : 'warning',
        recipientId: requisition.createdBy,
        subject: `Accountability Overdue: ${requisition.purpose}`,
        message: `Your accountability for requisition "${requisition.purpose}" is ${daysOverdue} days overdue. ` +
                 `Due date was ${dueDate.toLocaleDateString()}. ` +
                 `Please submit accountability immediately to avoid further escalation.`,
        entityId: doc.id,
        actionUrl: `/delivery/accountabilities/create?requisitionId=${doc.id}`,
        metadata: {
          requisitionNumber: requisition.requisitionNumber,
          amount: requisition.amountRequested,
          daysOverdue,
        },
        createdAt: admin.firestore.Timestamp.now(),
        read: false,
      });
    }
  });

  if (!snapshot.empty) {
    await batch.commit();
  }

  // Save notifications
  for (const notification of notifications) {
    await db.collection('notifications').add(notification);
  }

  return actions;
}

async function checkOverdueInvestigations() {
  const actions = [];
  const now = new Date();

  const snapshot = await db.collection('variance_investigations')
    .where('status', 'in', ['pending', 'in_progress'])
    .orderBy('deadline', 'asc')
    .limit(500)
    .get();

  const batch = db.batch();

  snapshot.docs.forEach(doc => {
    const investigation = doc.data();
    const deadline = investigation.deadline.toDate();

    if (deadline < now) {
      const hoursOverdue = Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60));

      batch.update(doc.ref, {
        status: 'overdue',
        updatedAt: admin.firestore.Timestamp.now(),
      });

      actions.push({
        type: 'investigation_overdue',
        entityType: 'investigation',
        entityId: doc.id,
        projectId: investigation.projectId,
        action: `Marked investigation as overdue (${hoursOverdue} hours past deadline)`,
        timestamp: now,
        details: { hoursOverdue, deadline, assignedTo: investigation.assignedTo },
      });
    }
  });

  if (!snapshot.empty) {
    await batch.commit();
  }

  return actions;
}

async function checkReconciliationDeadlines() {
  const actions = [];
  const now = new Date();

  // Get all active projects
  const projectsSnapshot = await db.collection('projects')
    .where('status', 'in', ['active', 'planning'])
    .get();

  for (const projectDoc of projectsSnapshot.docs) {
    const projectId = projectDoc.id;

    // Check if current month reconciliation is done
    const currentMonthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const deadline = calculate5thWorkingDay(currentMonthStart);

    // Only check if we're past the deadline
    if (now > deadline) {
      const reconSnapshot = await db.collection('reconciliation_reports')
        .where('projectId', '==', projectId)
        .where('month', '==', admin.firestore.Timestamp.fromDate(currentMonthStart))
        .where('type', '==', 'monthly')
        .limit(1)
        .get();

      if (reconSnapshot.empty) {
        const daysOverdue = Math.floor((now.getTime() - deadline.getTime()) / (1000 * 60 * 60 * 24));

        actions.push({
          type: 'reconciliation_overdue',
          entityType: 'reconciliation',
          entityId: `${projectId}-${currentMonthStart.toISOString()}`,
          projectId,
          action: `Monthly reconciliation missing (${daysOverdue} days past 5th working day deadline)`,
          timestamp: now,
          details: { month: currentMonthStart, deadline, daysOverdue },
        });
      }
    }
  }

  return actions;
}

async function getDeadlineSummary(projectId) {
  const now = new Date();

  // Count overdue accountabilities
  let accountabilityQuery = db.collection('requisitions')
    .where('accountabilityStatus', '==', 'overdue');

  if (projectId) {
    accountabilityQuery = accountabilityQuery.where('projectId', '==', projectId);
  }

  const accountabilitySnapshot = await accountabilityQuery.get();

  // Count overdue investigations
  let investigationQuery = db.collection('variance_investigations')
    .where('status', '==', 'overdue');

  if (projectId) {
    investigationQuery = investigationQuery.where('projectId', '==', projectId);
  }

  const investigationSnapshot = await investigationQuery.get();

  // Count upcoming deadlines (accountabilities due in next 3 days)
  const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

  let upcomingQuery = db.collection('requisitions')
    .where('accountabilityStatus', '==', 'pending')
    .where('accountabilityDueDate', '<=', admin.firestore.Timestamp.fromDate(threeDaysFromNow));

  if (projectId) {
    upcomingQuery = upcomingQuery.where('projectId', '==', projectId);
  }

  const upcomingSnapshot = await upcomingQuery.get();

  return {
    overdueAccountabilities: accountabilitySnapshot.size,
    overdueInvestigations: investigationSnapshot.size,
    pendingReconciliations: 0, // TODO: Implement
    upcomingDeadlines: upcomingSnapshot.size,
  };
}

function calculate5thWorkingDay(monthStart) {
  let workingDays = 0;
  let currentDate = new Date(monthStart);

  while (workingDays < 5) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      workingDays++;
    }

    if (workingDays < 5) {
      currentDate.setDate(currentDate.getDate() + 1);
    }
  }

  currentDate.setHours(23, 59, 59, 999);
  return currentDate;
}
