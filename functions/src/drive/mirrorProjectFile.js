/**
 * Mirror a newly-uploaded `projectFiles/{id}` doc into the matching
 * `01_Active-Projects/{code}_..}/{0N}_...` Drive subfolder.
 *
 * Flow:
 *   1. Read the project the file belongs to (for driveFolderId).
 *   2. If the project folder doesn't exist yet, create it first
 *      (safety net — Phase 2 trigger order is independent).
 *   3. Resolve the correct `01..07` subfolder for this file.
 *   4. Ensure the subfolder exists under the project folder.
 *   5. Download the bytes from Firebase Storage.
 *   6. Upload to Drive with the policy-compliant display name.
 *   7. Write `driveFileId` + `driveWebViewLink` back to the file doc.
 *
 * Failure is non-fatal — we record the error on the file doc via
 * `driveSyncError` so the backfill / nightly sweep can pick it up.
 */

const admin = require('firebase-admin');
const { logger } = require('firebase-functions');
const { FieldValue } = require('firebase-admin/firestore');

const {
  isDriveMirrorEnabled,
  getDriveAuthSettings,
} = require('./config');
const { getGoogleDriveAccessToken } = require('./driveAuth');
const { ensureFolder, uploadFile } = require('./driveClient');
const { resolveDriveSubfolder } = require('./folderMapping');
const { createProjectDriveFolders } = require('./createProjectFolders');

async function recordFileSyncError(db, fileId, err) {
  try {
    await db.collection('projectFiles').doc(fileId).update({
      driveSyncError: String(err && err.message ? err.message : err).slice(0, 500),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (writeErr) {
    logger.error('[Drive] Failed to record driveSyncError', { fileId, writeErr });
  }
}

/**
 * @param {string} fileId — Firestore projectFiles doc ID
 * @param {object} fileData — the newly-created file doc contents
 * @returns {Promise<{driveFileId: string, driveWebViewLink: string} | null>}
 *          Null when mirror disabled or precondition missing; non-null on
 *          success. Throws on hard Drive errors (caller records them).
 */
async function mirrorProjectFileToDrive(fileId, fileData) {
  if (!(await isDriveMirrorEnabled())) {
    logger.info('[Drive] mirrorProjectFile — mirror disabled, skipping', { fileId });
    return null;
  }
  if (!fileData || !fileData.projectId || !fileData.storagePath) {
    logger.warn('[Drive] mirrorProjectFile — missing projectId/storagePath, skipping', {
      fileId,
    });
    return null;
  }

  const db = admin.firestore();
  const settings = getDriveAuthSettings();
  const accessToken = await getGoogleDriveAccessToken(settings);

  // 1. Resolve the project's root Drive folder.
  const projectSnap = await db.collection('designProjects').doc(fileData.projectId).get();
  if (!projectSnap.exists) {
    logger.warn('[Drive] mirrorProjectFile — project doc missing, skipping', {
      fileId,
      projectId: fileData.projectId,
    });
    return null;
  }
  let project = projectSnap.data();
  let projectFolderId = project.driveFolderId;

  // 2. If the project folder doesn't exist yet (trigger ordering /
  //    backfill / manual import), bootstrap it now.
  if (!projectFolderId) {
    const bootstrapped = await createProjectDriveFolders(fileData.projectId, project);
    if (!bootstrapped) {
      logger.warn('[Drive] mirrorProjectFile — project folder bootstrap returned null', {
        fileId,
        projectId: fileData.projectId,
      });
      return null;
    }
    projectFolderId = bootstrapped.driveFolderId;
  }

  // 3 + 4. Resolve + ensure the `01..07` subfolder.
  const subfolderName = resolveDriveSubfolder(fileData);
  const sub = await ensureFolder({
    accessToken,
    parentId: projectFolderId,
    name: subfolderName,
  });

  // 5. Download bytes from Firebase Storage.
  const bucket = admin.storage().bucket();
  const storageFile = bucket.file(fileData.storagePath);
  const [fileBuffer] = await storageFile.download();

  // 6. Upload to Drive. The display name is the policy-compliant `name`
  //    field (falling back to the raw `fileName`); both are populated by
  //    Phase 1's naming-enforcement step.
  const driveDisplayName =
    fileData.name && typeof fileData.name === 'string' && fileData.name.trim().length > 0
      ? fileData.name
      : fileData.fileName || 'untitled';
  const uploaded = await uploadFile({
    accessToken,
    parentFolderId: sub.id,
    fileName: driveDisplayName,
    mimeType: fileData.mimeType || 'application/octet-stream',
    fileBuffer,
  });

  // 7. Write-back.
  await db.collection('projectFiles').doc(fileId).update({
    driveFileId: uploaded.id,
    driveWebViewLink: uploaded.webViewLink,
    driveFolderSubpath: subfolderName,
    driveSyncedAt: FieldValue.serverTimestamp(),
    driveSyncError: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.info('[Drive] mirrorProjectFile — done', {
    fileId,
    projectId: fileData.projectId,
    driveFileId: uploaded.id,
    subpath: subfolderName,
  });

  return { driveFileId: uploaded.id, driveWebViewLink: uploaded.webViewLink };
}

module.exports = {
  mirrorProjectFileToDrive,
  recordFileSyncError,
};
