/**
 * Cloud Function - Deadline Monitoring (Gen 2)
 *
 * Scheduled function that runs hourly to check for:
 * - Overdue accountabilities
 * - Overdue variance investigations
 * - Missing monthly reconciliations
 *
 * Triggered by Cloud Scheduler (cron: 0 * * * *)
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { DeadlineMonitoringService, DeadlineCheckResult } from '../../../src/subsidiaries/advisory/delivery/core/services/deadline-monitoring.service';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Hourly deadline monitoring check
 * Runs every hour at minute 0
 */
export const hourlyDeadlineCheck = onSchedule(
  {
    schedule: '0 * * * *', // Every hour at minute 0
    timeZone: 'Africa/Nairobi', // Kenya timezone
    timeoutSeconds: 540, // 9 minutes
    memory: '512MiB',
  },
  async () => {
    const service = new DeadlineMonitoringService();

    try {
      console.log('[DeadlineMonitoring] Starting hourly deadline check...');
      const startTime = Date.now();

      const result: DeadlineCheckResult = await service.runDeadlineChecks();

      const duration = Date.now() - startTime;

      console.log('[DeadlineMonitoring] Hourly check completed:', {
        duration: `${duration}ms`,
        totalChecked: result.totalChecked,
        summary: result.summary,
      });

      // Log result to Firestore for audit trail
      await admin.firestore().collection('deadline_monitoring_logs').add({
        timestamp: admin.firestore.Timestamp.fromDate(result.timestamp),
        type: 'hourly_check',
        totalChecked: result.totalChecked,
        summary: result.summary,
        duration,
        status: 'success',
      });

      // Alert if significant issues found
      if (result.summary.overdueAccountabilities > 10 || result.summary.overdueInvestigations > 5) {
        console.warn('[DeadlineMonitoring] HIGH NUMBER OF OVERDUE ITEMS:', result.summary);

        // Send alert to admin
        await admin.firestore().collection('notifications').add({
          type: 'system_alert',
          severity: 'warning',
          recipientRole: 'ADMIN',
          subject: 'High Number of Overdue Items Detected',
          message: `Deadline monitoring detected ${result.summary.overdueAccountabilities} overdue accountabilities ` +
                   `and ${result.summary.overdueInvestigations} overdue investigations. ` +
                   `Please review urgently.`,
          createdAt: admin.firestore.Timestamp.now(),
          read: false,
          metadata: result.summary,
        });
      }
    } catch (error) {
      console.error('[DeadlineMonitoring] Error during hourly check:', error);

      // Log error to Firestore
      await admin.firestore().collection('deadline_monitoring_logs').add({
        timestamp: admin.firestore.Timestamp.now(),
        type: 'hourly_check',
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw error;
    }
  }
);

/**
 * Daily summary report
 * Runs at 8:00 AM EAT every day
 */
export const dailyDeadlineSummary = onSchedule(
  {
    schedule: '0 8 * * *', // 8:00 AM daily
    timeZone: 'Africa/Nairobi',
    timeoutSeconds: 300, // 5 minutes
    memory: '256MiB',
  },
  async () => {
    const service = new DeadlineMonitoringService();

    try {
      console.log('[DeadlineMonitoring] Generating daily summary...');

      const summary = await service.getDeadlineSummary();

      // Log summary
      await admin.firestore().collection('deadline_monitoring_logs').add({
        timestamp: admin.firestore.Timestamp.now(),
        type: 'daily_summary',
        summary,
        status: 'success',
      });

      // Send summary notification to finance team
      if (summary.overdueAccountabilities > 0 || summary.overdueInvestigations > 0 || summary.pendingReconciliations > 0) {
        await admin.firestore().collection('notifications').add({
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

      console.log('[DeadlineMonitoring] Daily summary generated:', summary);
    } catch (error) {
      console.error('[DeadlineMonitoring] Error generating daily summary:', error);

      await admin.firestore().collection('deadline_monitoring_logs').add({
        timestamp: admin.firestore.Timestamp.now(),
        type: 'daily_summary',
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    }
  }
);

/**
 * Manual trigger for deadline check
 * Callable function for admin to manually trigger deadline check
 */
export const triggerDeadlineCheck = onCall(
  {
    timeoutSeconds: 540,
    memory: '512MiB',
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
    const userDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
    const userData = userDoc.data();

    if (!userData || !['admin', 'super_admin'].includes(userData.role)) {
      throw new HttpsError(
        'permission-denied',
        'Only admins can manually trigger deadline checks'
      );
    }

    const service = new DeadlineMonitoringService();

    try {
      console.log('[DeadlineMonitoring] Manual trigger by:', request.auth.uid);

      const result = await service.runDeadlineChecks();

      // Log result
      await admin.firestore().collection('deadline_monitoring_logs').add({
        timestamp: admin.firestore.Timestamp.fromDate(result.timestamp),
        type: 'manual_trigger',
        triggeredBy: request.auth.uid,
        totalChecked: result.totalChecked,
        summary: result.summary,
        status: 'success',
      });

      return {
        success: true,
        result: {
          timestamp: result.timestamp.toISOString(),
          totalChecked: result.totalChecked,
          summary: result.summary,
        },
      };
    } catch (error) {
      console.error('[DeadlineMonitoring] Error in manual trigger:', error);

      throw new HttpsError(
        'internal',
        'Error running deadline check',
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);

/**
 * Get deadline summary for project
 * Callable function for dashboard
 */
export const getProjectDeadlineSummary = onCall(
  {
    timeoutSeconds: 60,
    memory: '256MiB',
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    const service = new DeadlineMonitoringService();
    const data = request.data as { projectId?: string };

    try {
      const summary = await service.getDeadlineSummary(data.projectId);

      return {
        success: true,
        summary,
      };
    } catch (error) {
      console.error('[DeadlineMonitoring] Error getting summary:', error);

      throw new HttpsError(
        'internal',
        'Error getting deadline summary',
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);
