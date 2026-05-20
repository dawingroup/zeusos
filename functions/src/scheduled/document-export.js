/**
 * Cloud Function - Document Export (Gen 2)
 *
 * Scheduled function that exports documents to external storage:
 * - SharePoint
 * - Google Drive
 *
 * Using v2 API (firebase-functions v4.x)
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { ALLOWED_ORIGINS } = require('../config/cors');

// Initialize Firebase Admin if not already initialized
if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();
const storage = admin.storage();

// Secrets for external providers
const SHAREPOINT_CLIENT_SECRET = defineSecret('SHAREPOINT_CLIENT_SECRET');
const GOOGLE_DRIVE_PRIVATE_KEY = defineSecret('GOOGLE_DRIVE_PRIVATE_KEY');

/**
 * Get SharePoint access token
 */
async function getSharePointAccessToken(settings) {
  const tokenUrl = `https://login.microsoftonline.com/${settings.tenantId}/oauth2/v2.0/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      client_id: settings.clientId,
      client_secret: settings.clientSecret,
      scope: 'https://graph.microsoft.com/.default',
      grant_type: 'client_credentials',
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get SharePoint access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Get Google Drive access token using service account JWT
 */
async function getGoogleDriveAccessToken(settings) {
  const jwt = require('jsonwebtoken');

  const now = Math.floor(Date.now() / 1000);
  const payload = {
    iss: settings.serviceAccountEmail,
    scope: 'https://www.googleapis.com/auth/drive.file',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const token = jwt.sign(payload, settings.privateKey, { algorithm: 'RS256' });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: token,
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Failed to get Google Drive access token: ${error}`);
  }

  const data = await response.json();
  return data.access_token;
}

/**
 * Export document to Google Drive
 */
async function exportToGoogleDrive(fileBuffer, fileName, mimeType, folderId, accessToken) {
  const metadata = {
    name: fileName,
    parents: [folderId],
  };

  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;

  // For binary files, use base64 encoding
  const fileContent = fileBuffer.toString('base64');

  const multipartRequestBody =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType}\r\n` +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    fileContent +
    closeDelimiter;

  const uploadResponse = await fetch(
    'https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart',
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body: multipartRequestBody,
    }
  );

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`Google Drive upload failed: ${uploadResponse.status} - ${errorText}`);
  }

  const result = await uploadResponse.json();
  return {
    success: true,
    externalUrl: `https://drive.google.com/file/d/${result.id}/view`,
    externalId: result.id,
  };
}

/**
 * Export document to SharePoint
 */
async function exportToSharePoint(fileBuffer, fileName, folderPath, settings, accessToken) {
  // Ensure folder exists (simplified - in production, create recursively)
  const uploadUrl = `${settings.siteUrl}/_api/web/GetFolderByServerRelativeUrl('${folderPath}')/Files/add(url='${encodeURIComponent(fileName)}',overwrite=true)`;

  const uploadResponse = await fetch(uploadUrl, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: 'application/json;odata=verbose',
      'Content-Type': 'application/octet-stream',
    },
    body: fileBuffer,
  });

  if (!uploadResponse.ok) {
    const errorText = await uploadResponse.text();
    throw new Error(`SharePoint upload failed: ${uploadResponse.status} - ${errorText}`);
  }

  const result = await uploadResponse.json();
  const fileServerRelativeUrl = result.d.ServerRelativeUrl;
  const fileUrl = `${settings.siteUrl}${fileServerRelativeUrl}`;

  return {
    success: true,
    externalUrl: fileUrl,
    externalId: result.d.UniqueId,
  };
}

/**
 * Process export for a single configuration
 */
async function processExportConfiguration(configId, configData) {
  const bucket = storage.bucket();
  const results = {
    exported: 0,
    failed: 0,
    skipped: 0,
    errors: [],
  };

  // Get documents to export
  const documentsQuery = await db
    .collection('documents')
    .where('category', 'in', ['requisition', 'accountability', 'receipt', 'invoice', 'delivery_note'])
    .orderBy('createdAt', 'desc')
    .limit(100)
    .get();

  if (documentsQuery.empty) {
    logger.info(`[DocumentExport] No documents to export for config ${configId}`);
    return results;
  }

  // Get access token based on provider
  let accessToken;
  try {
    if (configData.provider === 'google_drive') {
      accessToken = await getGoogleDriveAccessToken(configData.settings);
    } else if (configData.provider === 'sharepoint') {
      accessToken = await getSharePointAccessToken(configData.settings);
    } else {
      throw new Error(`Unknown provider: ${configData.provider}`);
    }
  } catch (authError) {
    logger.error(`[DocumentExport] Auth failed for ${configId}:`, authError);
    results.errors.push({ error: authError.message, type: 'auth' });
    return results;
  }

  // Process each document
  for (const docSnap of documentsQuery.docs) {
    const docData = docSnap.data();
    const documentId = docSnap.id;

    try {
      // Check if already exported
      const exportStatusRef = db.collection('document_export_status').doc(documentId);
      const exportStatusSnap = await exportStatusRef.get();

      if (exportStatusSnap.exists) {
        const existingStatus = exportStatusSnap.data();
        const providerExport = existingStatus.exports?.find(
          (e) => e.provider === configData.provider && e.status === 'exported'
        );
        if (providerExport) {
          results.skipped++;
          continue;
        }
      }

      // Download file from Firebase Storage
      if (!docData.storagePath) {
        results.skipped++;
        continue;
      }

      const file = bucket.file(docData.storagePath);
      const [exists] = await file.exists();

      if (!exists) {
        results.skipped++;
        continue;
      }

      const [fileBuffer] = await file.download();

      // Export based on provider
      let exportResult;
      if (configData.provider === 'google_drive') {
        const folderId = configData.settings.rootFolderId;
        exportResult = await exportToGoogleDrive(
          fileBuffer,
          docData.filename || `document_${documentId}`,
          docData.mimeType || 'application/octet-stream',
          folderId,
          accessToken
        );
      } else if (configData.provider === 'sharepoint') {
        const folderPath = configData.settings.rootFolderPath || '/Shared Documents';
        exportResult = await exportToSharePoint(
          fileBuffer,
          docData.filename || `document_${documentId}`,
          folderPath,
          configData.settings,
          accessToken
        );
      }

      if (exportResult && exportResult.success) {
        // Update export status
        await exportStatusRef.set(
          {
            documentId,
            exports: admin.firestore.FieldValue.arrayUnion({
              provider: configData.provider,
              status: 'exported',
              externalUrl: exportResult.externalUrl,
              externalId: exportResult.externalId,
              lastExportedAt: admin.firestore.Timestamp.now(),
            }),
          },
          { merge: true }
        );
        results.exported++;
      } else {
        results.failed++;
        results.errors.push({
          documentId,
          error: exportResult?.error || 'Unknown error',
        });
      }
    } catch (docError) {
      results.failed++;
      results.errors.push({
        documentId,
        error: docError.message || String(docError),
      });
    }
  }

  return results;
}

/**
 * Daily document export
 * Runs at 2:00 AM EAT every day
 */
exports.dailyDocumentExport = onSchedule(
  {
    schedule: '0 2 * * *', // 2:00 AM daily
    timeZone: 'Africa/Nairobi',
    timeoutSeconds: 540, // 9 minutes
    memory: '1GiB',
    secrets: [SHAREPOINT_CLIENT_SECRET, GOOGLE_DRIVE_PRIVATE_KEY],
  },
  async (event) => {
    try {
      logger.info('[DocumentExport] Starting daily export...');
      const startTime = Date.now();

      // Get all enabled export configurations
      const configurationsSnapshot = await db
        .collection('export_configurations')
        .where('enabled', '==', true)
        .where('syncFrequency', 'in', ['daily', 'hourly'])
        .get();

      if (configurationsSnapshot.empty) {
        logger.info('[DocumentExport] No enabled export configurations found');
        return;
      }

      const results = [];

      // Process each configuration
      for (const configDoc of configurationsSnapshot.docs) {
        const configId = configDoc.id;
        const configData = configDoc.data();

        try {
          logger.info(`[DocumentExport] Processing configuration: ${configId} (${configData.provider})`);

          // Process the export configuration
          const exportResults = await processExportConfiguration(configId, configData);

          results.push({
            configurationId: configId,
            status: exportResults.failed > 0 && exportResults.exported === 0 ? 'failed' : 'success',
            exportedCount: exportResults.exported,
            failedCount: exportResults.failed,
            skippedCount: exportResults.skipped,
            errors: exportResults.errors.slice(0, 10), // Limit errors stored
          });

          // Update configuration last sync time
          await db.collection('export_configurations').doc(configId).update({
            lastSyncAt: admin.firestore.Timestamp.now(),
          });

          logger.info(`[DocumentExport] Config ${configId}: exported=${exportResults.exported}, failed=${exportResults.failed}, skipped=${exportResults.skipped}`);
        } catch (error) {
          logger.error(`[DocumentExport] Error processing configuration ${configId}:`, error);

          results.push({
            configurationId: configId,
            status: 'failed',
            exportedCount: 0,
            error: error.message || String(error),
          });
        }
      }

      const duration = Date.now() - startTime;
      const totalExported = results.reduce((sum, r) => sum + (r.exportedCount || 0), 0);

      // Log summary
      await db.collection('document_export_logs').add({
        timestamp: admin.firestore.Timestamp.now(),
        type: 'daily_export',
        totalConfigurations: configurationsSnapshot.size,
        totalExported,
        results,
        duration,
        status: 'success',
      });

      logger.info('[DocumentExport] Daily export completed:', {
        duration: `${duration}ms`,
        configurations: configurationsSnapshot.size,
        totalExported,
      });
    } catch (error) {
      logger.error('[DocumentExport] Error during daily export:', error);

      // Log error
      await db.collection('document_export_logs').add({
        timestamp: admin.firestore.Timestamp.now(),
        type: 'daily_export',
        status: 'error',
        error: error.message || String(error),
        stack: error.stack,
      });

      throw error;
    }
  }
);

/**
 * Manual export trigger
 * Callable function for admin to manually trigger export
 */
exports.triggerDocumentExport = onCall(
  {
    timeoutSeconds: 540,
    memory: '1GiB',
    cors: ALLOWED_ORIGINS,
    secrets: [SHAREPOINT_CLIENT_SECRET, GOOGLE_DRIVE_PRIVATE_KEY],
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
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    const userData = userDoc.data();

    if (!userData || !['admin', 'super_admin'].includes(userData.role)) {
      throw new HttpsError(
        'permission-denied',
        'Only admins can manually trigger document export'
      );
    }

    const configurationId = request.data?.configurationId;

    try {
      logger.info('[DocumentExport] Manual trigger by:', request.auth.uid, 'for config:', configurationId);

      // Create job record
      const jobId = 'manual-' + Date.now();
      const jobRef = db.collection('export_jobs').doc(jobId);

      await jobRef.set({
        id: jobId,
        configurationId,
        triggeredBy: request.auth.uid,
        status: 'in_progress',
        totalDocuments: 0,
        exportedDocuments: 0,
        failedDocuments: 0,
        skippedDocuments: 0,
        startedAt: admin.firestore.Timestamp.now(),
      });

      let exportResults = {
        exported: 0,
        failed: 0,
        skipped: 0,
        errors: [],
      };

      if (configurationId) {
        // Export for specific configuration
        const configDoc = await db.collection('export_configurations').doc(configurationId).get();

        if (!configDoc.exists) {
          throw new HttpsError('not-found', `Configuration ${configurationId} not found`);
        }

        const configData = configDoc.data();

        if (!configData.enabled) {
          throw new HttpsError('failed-precondition', 'Export configuration is disabled');
        }

        exportResults = await processExportConfiguration(configurationId, configData);

        // Update configuration last sync time
        await db.collection('export_configurations').doc(configurationId).update({
          lastSyncAt: admin.firestore.Timestamp.now(),
        });
      } else {
        // Export for all enabled configurations
        const configurationsSnapshot = await db
          .collection('export_configurations')
          .where('enabled', '==', true)
          .get();

        for (const configDoc of configurationsSnapshot.docs) {
          const configId = configDoc.id;
          const configData = configDoc.data();

          try {
            const results = await processExportConfiguration(configId, configData);
            exportResults.exported += results.exported;
            exportResults.failed += results.failed;
            exportResults.skipped += results.skipped;
            exportResults.errors.push(...results.errors);

            await db.collection('export_configurations').doc(configId).update({
              lastSyncAt: admin.firestore.Timestamp.now(),
            });
          } catch (configError) {
            exportResults.errors.push({
              configurationId: configId,
              error: configError.message || String(configError),
            });
          }
        }
      }

      // Update job record
      const job = {
        id: jobId,
        configurationId,
        status: 'completed',
        totalDocuments: exportResults.exported + exportResults.failed + exportResults.skipped,
        exportedDocuments: exportResults.exported,
        failedDocuments: exportResults.failed,
        skippedDocuments: exportResults.skipped,
        completedAt: admin.firestore.Timestamp.now(),
        errors: exportResults.errors.slice(0, 50),
      };

      await jobRef.update(job);

      // Log result
      await db.collection('document_export_logs').add({
        timestamp: admin.firestore.Timestamp.now(),
        type: 'manual_trigger',
        triggeredBy: request.auth.uid,
        configurationId,
        jobId: job.id,
        status: 'success',
        exportedCount: job.exportedDocuments,
        failedCount: job.failedDocuments,
        skippedCount: job.skippedDocuments,
      });

      logger.info('[DocumentExport] Manual export completed:', job);

      return {
        success: true,
        job,
      };
    } catch (error) {
      logger.error('[DocumentExport] Error in manual trigger:', error);

      // Log error
      await db.collection('document_export_logs').add({
        timestamp: admin.firestore.Timestamp.now(),
        type: 'manual_trigger',
        triggeredBy: request.auth.uid,
        configurationId,
        status: 'error',
        error: error.message || String(error),
      });

      throw new HttpsError(
        'internal',
        'Error running document export',
        error.message || String(error)
      );
    }
  }
);

/**
 * Retry failed exports
 * Callable function to retry failed exports from a previous job
 */
exports.retryFailedExports = onCall(
  {
    timeoutSeconds: 540,
    memory: '1GiB',
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

    // Verify admin role
    const userDoc = await db.collection('users').doc(request.auth.uid).get();
    const userData = userDoc.data();

    if (!userData || !['admin', 'super_admin'].includes(userData.role)) {
      throw new HttpsError(
        'permission-denied',
        'Only admins can retry failed exports'
      );
    }

    try {
      logger.info('[DocumentExport] Retry failed exports for job:', request.data?.jobId);

      // Placeholder for retry logic
      const job = {
        id: request.data?.jobId,
        status: 'completed',
        exportedDocuments: 0,
        failedDocuments: 0,
      };

      return {
        success: true,
        job,
      };
    } catch (error) {
      logger.error('[DocumentExport] Error retrying failed exports:', error);

      throw new HttpsError(
        'internal',
        'Error retrying failed exports',
        error.message || String(error)
      );
    }
  }
);

/**
 * Get export job status
 * Callable function to get status of an export job
 */
exports.getExportJobStatus = onCall(
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
      const jobDoc = await db.collection('export_jobs').doc(request.data?.jobId).get();

      if (!jobDoc.exists) {
        throw new HttpsError(
          'not-found',
          `Export job ${request.data?.jobId} not found`
        );
      }

      const job = jobDoc.data();

      return {
        success: true,
        job: {
          id: jobDoc.id,
          status: job.status,
          totalDocuments: job.totalDocuments,
          exportedDocuments: job.exportedDocuments,
          failedDocuments: job.failedDocuments,
          skippedDocuments: job.skippedDocuments,
          startedAt: job.startedAt?.toDate().toISOString(),
          completedAt: job.completedAt?.toDate().toISOString(),
          duration: job.duration,
          errors: job.errors,
        },
      };
    } catch (error) {
      logger.error('[DocumentExport] Error getting job status:', error);

      if (error instanceof HttpsError) {
        throw error;
      }

      throw new HttpsError(
        'internal',
        'Error getting export job status',
        error.message || String(error)
      );
    }
  }
);
