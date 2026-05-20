/**
 * Cloud Function - Document Export (Gen 2)
 *
 * Scheduled function that exports documents to external storage:
 * - SharePoint
 * - Google Drive
 *
 * Triggered by Cloud Scheduler (configurable frequency)
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { onCall, HttpsError } from 'firebase-functions/v2/https';
import * as admin from 'firebase-admin';
import { DocumentExportService, ExportJob } from '../../../src/subsidiaries/advisory/delivery/core/services/document-export.service';

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

/**
 * Daily document export
 * Runs at 2:00 AM EAT every day
 */
export const dailyDocumentExport = onSchedule(
  {
    schedule: '0 2 * * *', // 2:00 AM daily
    timeZone: 'Africa/Nairobi',
    timeoutSeconds: 540, // 9 minutes
    memory: '1GiB',
  },
  async () => {
    const service = new DocumentExportService();

    try {
      console.log('[DocumentExport] Starting daily export...');
      const startTime = Date.now();

      // Get all enabled export configurations
      const configurationsSnapshot = await admin
        .firestore()
        .collection('export_configurations')
        .where('enabled', '==', true)
        .where('syncFrequency', 'in', ['daily', 'hourly'])
        .get();

      if (configurationsSnapshot.empty) {
        console.log('[DocumentExport] No enabled export configurations found');
        return;
      }

      const results: { configurationId: string; status: string; exportedCount: number }[] = [];

      // Process each configuration
      for (const configDoc of configurationsSnapshot.docs) {
        const configId = configDoc.id;
        const configData = configDoc.data();

        try {
          console.log(`[DocumentExport] Processing configuration: ${configId} (${configData.provider})`);

          const job: ExportJob = await service.exportPendingDocuments(configId);

          results.push({
            configurationId: configId,
            status: job.status,
            exportedCount: job.exportedDocuments,
          });

          console.log(`[DocumentExport] Configuration ${configId} completed:`, {
            exported: job.exportedDocuments,
            failed: job.failedDocuments,
            skipped: job.skippedDocuments,
          });
        } catch (error) {
          console.error(`[DocumentExport] Error processing configuration ${configId}:`, error);

          results.push({
            configurationId: configId,
            status: 'failed',
            exportedCount: 0,
          });
        }
      }

      const duration = Date.now() - startTime;

      // Log summary
      await admin.firestore().collection('document_export_logs').add({
        timestamp: admin.firestore.Timestamp.now(),
        type: 'daily_export',
        totalConfigurations: configurationsSnapshot.size,
        results,
        duration,
        status: 'success',
      });

      console.log('[DocumentExport] Daily export completed:', {
        duration: `${duration}ms`,
        configurations: configurationsSnapshot.size,
        results,
      });
    } catch (error) {
      console.error('[DocumentExport] Error during daily export:', error);

      // Log error
      await admin.firestore().collection('document_export_logs').add({
        timestamp: admin.firestore.Timestamp.now(),
        type: 'daily_export',
        status: 'error',
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });

      throw error;
    }
  }
);

/**
 * Manual export trigger
 * Callable function for admin to manually trigger export
 */
export const triggerDocumentExport = onCall(
  {
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'User must be authenticated to trigger document export'
      );
    }

    // Verify admin role
    const userDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
    const userData = userDoc.data();

    if (!userData || !['admin', 'super_admin'].includes(userData.role)) {
      throw new HttpsError(
        'permission-denied',
        'Only admins can manually trigger document export'
      );
    }

    const service = new DocumentExportService();
    const data = request.data as { configurationId: string };

    try {
      console.log('[DocumentExport] Manual trigger by:', request.auth.uid);

      const job = await service.exportPendingDocuments(data.configurationId);

      // Log result
      await admin.firestore().collection('document_export_logs').add({
        timestamp: admin.firestore.Timestamp.now(),
        type: 'manual_trigger',
        triggeredBy: request.auth.uid,
        configurationId: data.configurationId,
        jobId: job.id,
        status: 'success',
        exportedCount: job.exportedDocuments,
        failedCount: job.failedDocuments,
      });

      return {
        success: true,
        job: {
          id: job.id,
          status: job.status,
          totalDocuments: job.totalDocuments,
          exportedDocuments: job.exportedDocuments,
          failedDocuments: job.failedDocuments,
          skippedDocuments: job.skippedDocuments,
        },
      };
    } catch (error) {
      console.error('[DocumentExport] Error in manual trigger:', error);

      throw new HttpsError(
        'internal',
        'Error running document export',
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);

/**
 * Retry failed exports
 * Callable function to retry failed exports from a previous job
 */
export const retryFailedExports = onCall(
  {
    timeoutSeconds: 540,
    memory: '1GiB',
  },
  async (request) => {
    // Verify authentication
    if (!request.auth) {
      throw new HttpsError(
        'unauthenticated',
        'User must be authenticated'
      );
    }

    // Verify admin role
    const userDoc = await admin.firestore().collection('users').doc(request.auth.uid).get();
    const userData = userDoc.data();

    if (!userData || !['admin', 'super_admin'].includes(userData.role)) {
      throw new HttpsError(
        'permission-denied',
        'Only admins can retry failed exports'
      );
    }

    const service = new DocumentExportService();
    const data = request.data as { jobId: string };

    try {
      console.log('[DocumentExport] Retry failed exports for job:', data.jobId);

      const job = await service.retryFailedExports(data.jobId);

      return {
        success: true,
        job: {
          id: job.id,
          status: job.status,
          exportedDocuments: job.exportedDocuments,
          failedDocuments: job.failedDocuments,
        },
      };
    } catch (error) {
      console.error('[DocumentExport] Error retrying failed exports:', error);

      throw new HttpsError(
        'internal',
        'Error retrying failed exports',
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);

/**
 * Get export job status
 * Callable function to get status of an export job
 */
export const getExportJobStatus = onCall(
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

    const data = request.data as { jobId: string };

    try {
      const jobDoc = await admin.firestore().collection('export_jobs').doc(data.jobId).get();

      if (!jobDoc.exists) {
        throw new HttpsError(
          'not-found',
          `Export job ${data.jobId} not found`
        );
      }

      const job = jobDoc.data();

      return {
        success: true,
        job: {
          id: jobDoc.id,
          status: job!.status,
          totalDocuments: job!.totalDocuments,
          exportedDocuments: job!.exportedDocuments,
          failedDocuments: job!.failedDocuments,
          skippedDocuments: job!.skippedDocuments,
          startedAt: job!.startedAt.toDate().toISOString(),
          completedAt: job!.completedAt?.toDate().toISOString(),
          duration: job!.duration,
          errors: job!.errors,
        },
      };
    } catch (error) {
      console.error('[DocumentExport] Error getting job status:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        'internal',
        'Error getting export job status',
        error instanceof Error ? error.message : String(error)
      );
    }
  }
);
