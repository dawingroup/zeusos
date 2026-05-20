/**
 * Trimble Connect Cloud Functions — SketchUp integration
 *
 * Functions:
 * - uploadToTrimbleConnect: Push STEP to Trimble Connect project
 * - checkTrimbleUpdates: Poll for file version changes
 * - importFromTrimbleConnect: Download updated model and create revision
 * - syncTrimbleConnect: Scheduled hourly sync for all linked projects
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { onSchedule } = require('firebase-functions/v2/scheduler');
const { defineSecret } = require('firebase-functions/params');
const { getStorage } = require('firebase-admin/storage');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const axios = require('axios');
const { ALLOWED_ORIGINS } = require('../config/cors');

const TRIMBLE_CLIENT_ID = defineSecret('TRIMBLE_CLIENT_ID');
const TRIMBLE_CLIENT_SECRET = defineSecret('TRIMBLE_CLIENT_SECRET');

const TRIMBLE_API_BASE = 'https://app.connect.trimble.com/tc/api/2.0';
const TRIMBLE_AUTH_URL = 'https://id.trimble.com/oauth/token';

// ============================================================================
// Auth Helper — Get access token via client credentials
// ============================================================================

async function getTrimbleAccessToken(clientId, clientSecret) {
  const response = await axios.post(
    TRIMBLE_AUTH_URL,
    new URLSearchParams({
      grant_type: 'client_credentials',
      client_id: clientId,
      client_secret: clientSecret,
      scope: 'openid',
    }).toString(),
    {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    },
  );
  return response.data.access_token;
}

// ============================================================================
// Upload STEP to Trimble Connect
// ============================================================================

exports.uploadToTrimbleConnect = onCall(
  {
    secrets: [TRIMBLE_CLIENT_ID, TRIMBLE_CLIENT_SECRET],
    timeoutSeconds: 120,
    memory: '512MiB',
    region: 'us-central1',
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    const { revisionId, projectName, moId } = request.data;
    if (!revisionId) {
      throw new HttpsError('invalid-argument', 'revisionId is required');
    }

    const clientId = (TRIMBLE_CLIENT_ID.value() || '').trim();
    const clientSecret = (TRIMBLE_CLIENT_SECRET.value() || '').trim();

    if (!clientId || !clientSecret) {
      throw new HttpsError(
        'failed-precondition',
        'Trimble Connect credentials not configured. Set TRIMBLE_CLIENT_ID and TRIMBLE_CLIENT_SECRET secrets.',
      );
    }

    try {
      const db = getFirestore();
      const revSnap = await db.doc(`designRevisions/${revisionId}`).get();
      if (!revSnap.exists) {
        throw new HttpsError('not-found', 'Revision not found');
      }

      const revision = revSnap.data();
      const stepUrl = revision.files?.stepUrl || revision.files?.xtUrl;
      if (!stepUrl) {
        throw new HttpsError('failed-precondition', 'No STEP or X_T file in this revision');
      }

      // Get Trimble access token
      const token = await getTrimbleAccessToken(clientId, clientSecret);

      // Create or find project in Trimble Connect
      const tcProjectName = projectName || `DawinOS-${moId || revisionId}`;
      let tcProjectId;

      // Search for existing project
      const projectsResp = await axios.get(`${TRIMBLE_API_BASE}/projects`, {
        headers: { Authorization: `Bearer ${token}` },
        params: { name: tcProjectName },
      });

      if (projectsResp.data.length > 0) {
        tcProjectId = projectsResp.data[0].id;
      } else {
        // Create new project
        const createResp = await axios.post(
          `${TRIMBLE_API_BASE}/projects`,
          { name: tcProjectName, description: `DawinOS Design Revision R${revision.revisionNumber}` },
          { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
        );
        tcProjectId = createResp.data.id;
      }

      // Download STEP file from Firebase Storage
      const stepResp = await axios.get(stepUrl, { responseType: 'arraybuffer' });
      const stepBuffer = Buffer.from(stepResp.data);

      // Upload to Trimble Connect root folder
      const fileName = `revision-${revision.revisionNumber}.step`;
      const uploadResp = await axios.post(
        `${TRIMBLE_API_BASE}/projects/${tcProjectId}/files`,
        stepBuffer,
        {
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/octet-stream',
            'Content-Disposition': `attachment; filename="${fileName}"`,
          },
        },
      );

      // Store Trimble link on the revision
      await revSnap.ref.update({
        status: 'editing',
        'trimbleConnect.projectId': tcProjectId,
        'trimbleConnect.fileId': uploadResp.data.id,
        'trimbleConnect.versionId': uploadResp.data.versionId,
        'trimbleConnect.uploadedAt': FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        data: {
          fileId: uploadResp.data.id,
          versionId: uploadResp.data.versionId,
          projectId: tcProjectId,
          projectUrl: `https://connect.trimble.com/projects/${tcProjectId}`,
        },
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('[uploadToTrimbleConnect] Error:', error.message);
      throw new HttpsError('internal', `Trimble Connect upload failed: ${error.message}`);
    }
  },
);

// ============================================================================
// Check for updated files
// ============================================================================

exports.checkTrimbleUpdates = onCall(
  {
    secrets: [TRIMBLE_CLIENT_ID, TRIMBLE_CLIENT_SECRET],
    timeoutSeconds: 60,
    memory: '256MiB',
    region: 'us-central1',
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    const { trimbleProjectId } = request.data;
    if (!trimbleProjectId) {
      throw new HttpsError('invalid-argument', 'trimbleProjectId is required');
    }

    const clientId = (TRIMBLE_CLIENT_ID.value() || '').trim();
    const clientSecret = (TRIMBLE_CLIENT_SECRET.value() || '').trim();

    if (!clientId || !clientSecret) {
      throw new HttpsError('failed-precondition', 'Trimble Connect credentials not configured');
    }

    try {
      const token = await getTrimbleAccessToken(clientId, clientSecret);

      const filesResp = await axios.get(
        `${TRIMBLE_API_BASE}/projects/${trimbleProjectId}/files`,
        { headers: { Authorization: `Bearer ${token}` } },
      );

      const files = (filesResp.data || []).map((f) => ({
        id: f.id,
        name: f.name,
        versionId: f.versionId,
        versionNumber: f.versionNumber || 1,
        size: f.size || 0,
        modifiedAt: f.modifiedOn || f.modifiedAt || '',
        modifiedBy: f.modifiedBy || '',
        parentFolderId: f.parentId || '',
      }));

      return {
        success: true,
        data: { updatedFiles: files, hasChanges: files.length > 0 },
      };
    } catch (error) {
      console.error('[checkTrimbleUpdates] Error:', error.message);
      throw new HttpsError('internal', `Failed to check updates: ${error.message}`);
    }
  },
);

// ============================================================================
// Import updated model from Trimble Connect
// ============================================================================

exports.importFromTrimbleConnect = onCall(
  {
    secrets: [TRIMBLE_CLIENT_ID, TRIMBLE_CLIENT_SECRET],
    timeoutSeconds: 120,
    memory: '512MiB',
    region: 'us-central1',
    cors: ALLOWED_ORIGINS,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Must be signed in');
    }

    const { trimbleFileId, trimbleProjectId, sourceRevisionId } = request.data;
    if (!trimbleFileId || !trimbleProjectId || !sourceRevisionId) {
      throw new HttpsError('invalid-argument', 'trimbleFileId, trimbleProjectId, and sourceRevisionId required');
    }

    const clientId = (TRIMBLE_CLIENT_ID.value() || '').trim();
    const clientSecret = (TRIMBLE_CLIENT_SECRET.value() || '').trim();

    if (!clientId || !clientSecret) {
      throw new HttpsError('failed-precondition', 'Trimble Connect credentials not configured');
    }

    try {
      const token = await getTrimbleAccessToken(clientId, clientSecret);
      const db = getFirestore();

      // Download file from Trimble Connect
      const downloadResp = await axios.get(
        `${TRIMBLE_API_BASE}/projects/${trimbleProjectId}/files/${trimbleFileId}/download`,
        {
          headers: { Authorization: `Bearer ${token}` },
          responseType: 'arraybuffer',
        },
      );

      const buffer = Buffer.from(downloadResp.data);

      // Store in Firebase Storage
      const timestamp = Date.now();
      const storagePath = `workshop-viewer/revisions/${request.auth.uid}/${timestamp}_trimble.step`;
      const bucket = getStorage().bucket();
      await bucket.file(storagePath).save(buffer, {
        metadata: { contentType: 'application/step' },
      });

      // Get source revision for context
      const sourceSnap = await db.doc(`designRevisions/${sourceRevisionId}`).get();
      const sourceData = sourceSnap.exists ? sourceSnap.data() : {};

      // Get next revision number
      const filter = sourceData.moId
        ? { field: 'moId', value: sourceData.moId }
        : { field: 'projectId', value: sourceData.projectId };

      const existingRevs = await db.collection('designRevisions')
        .where(filter.field, '==', filter.value)
        .orderBy('revisionNumber', 'desc')
        .limit(1)
        .get();

      const nextRevNum = existingRevs.empty ? 1 : (existingRevs.docs[0].data().revisionNumber || 0) + 1;

      // Create new revision
      const bucketName = bucket.name;
      const stepUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media`;

      const newRevRef = await db.collection('designRevisions').add({
        moId: sourceData.moId || null,
        projectId: sourceData.projectId || null,
        revisionNumber: nextRevNum,
        status: 'draft',
        source: 'external_edit',
        files: {
          stepUrl,
          glbUrl: sourceData.files?.glbUrl || '', // will be regenerated
        },
        materialMapping: sourceData.materialMapping || {},
        editNotes: `Imported from Trimble Connect (SketchUp edit)`,
        annotations: [],
        diffFromPrevious: null,
        createdBy: request.auth.uid,
        createdAt: FieldValue.serverTimestamp(),
      });

      return {
        success: true,
        data: { revisionId: newRevRef.id },
      };
    } catch (error) {
      if (error instanceof HttpsError) throw error;
      console.error('[importFromTrimbleConnect] Error:', error.message);
      throw new HttpsError('internal', `Import failed: ${error.message}`);
    }
  },
);

// ============================================================================
// Scheduled Sync — hourly poll for changes across all linked projects
// ============================================================================

exports.syncTrimbleConnect = onSchedule(
  {
    secrets: [TRIMBLE_CLIENT_ID, TRIMBLE_CLIENT_SECRET],
    schedule: 'every 60 minutes',
    timeoutSeconds: 120,
    memory: '256MiB',
    region: 'us-central1',
  },
  async () => {
    const clientId = (TRIMBLE_CLIENT_ID.value() || '').trim();
    const clientSecret = (TRIMBLE_CLIENT_SECRET.value() || '').trim();

    if (!clientId || !clientSecret) {
      console.log('[syncTrimbleConnect] Trimble credentials not configured, skipping');
      return;
    }

    const db = getFirestore();

    // Find all revisions with Trimble Connect links that are in 'editing' status
    const revisionsSnap = await db.collection('designRevisions')
      .where('status', '==', 'editing')
      .get();

    const linkedRevisions = revisionsSnap.docs.filter(
      (d) => d.data().trimbleConnect?.projectId,
    );

    if (linkedRevisions.length === 0) {
      console.log('[syncTrimbleConnect] No linked Trimble projects to sync');
      return;
    }

    console.log(`[syncTrimbleConnect] Checking ${linkedRevisions.length} linked revisions`);

    try {
      const token = await getTrimbleAccessToken(clientId, clientSecret);

      for (const revDoc of linkedRevisions) {
        const rev = revDoc.data();
        const tc = rev.trimbleConnect;

        try {
          // Check file version
          const fileResp = await axios.get(
            `${TRIMBLE_API_BASE}/projects/${tc.projectId}/files/${tc.fileId}`,
            { headers: { Authorization: `Bearer ${token}` } },
          );

          const currentVersion = fileResp.data.versionId;
          if (currentVersion !== tc.versionId) {
            console.log(`[syncTrimbleConnect] New version detected for revision ${revDoc.id}: ${tc.versionId} → ${currentVersion}`);

            // Update tracked version (actual import requires user action)
            await revDoc.ref.update({
              'trimbleConnect.latestVersionId': currentVersion,
              'trimbleConnect.hasUpdate': true,
              'trimbleConnect.lastCheckedAt': FieldValue.serverTimestamp(),
            });
          }
        } catch (err) {
          console.warn(`[syncTrimbleConnect] Failed to check revision ${revDoc.id}:`, err.message);
        }
      }
    } catch (err) {
      console.error('[syncTrimbleConnect] Auth error:', err.message);
    }
  },
);
