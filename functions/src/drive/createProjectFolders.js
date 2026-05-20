/**
 * Bootstrap the Shared-Drive folder tree for a newly-created design
 * project: `01_Active-Projects/{code}_{client}_{type}/{01..07}/`.
 *
 * Idempotent — if the folder already exists (e.g. project re-created
 * after a restore, or retry after partial failure), `ensureFolder`
 * returns the existing ID. Writes back to `designProjects/{projectId}`:
 *
 *   - driveFolderId              — the project root folder
 *   - driveFolderUrl             — webViewLink for "Open in Drive"
 *   - driveFolderCreatedAt       — serverTimestamp on first success
 *   - driveFolderError           — only set on failure (else cleared)
 *
 * This function is safe to call repeatedly; it does not create a
 * second project folder if one already exists by the same name.
 */

const admin = require('firebase-admin');
const { logger } = require('firebase-functions');
const { FieldValue } = require('firebase-admin/firestore');

const {
  isDriveMirrorEnabled,
  getDriveAuthSettings,
  getActiveProjectsFolderId,
} = require('./config');
const { getGoogleDriveAccessToken } = require('./driveAuth');
const { ensureFolder } = require('./driveClient');
const { buildProjectFolderName } = require('./folderBuilder');
const { ALL_SUBFOLDERS } = require('./folderMapping');

/**
 * @param {string} projectId — Firestore designProjects doc ID
 * @param {object} projectData — the project doc contents (post-create snapshot)
 * @returns {Promise<{driveFolderId: string, driveFolderUrl: string} | null>}
 *          Null when mirror is disabled or inputs are too incomplete to
 *          proceed. Non-null on success. Throws on unexpected Drive errors
 *          (caller is responsible for writing the error to Firestore).
 */
async function createProjectDriveFolders(projectId, projectData) {
  if (!(await isDriveMirrorEnabled())) {
    logger.info('[Drive] createProjectDriveFolders — mirror disabled, skipping', { projectId });
    return null;
  }
  if (!projectData || !projectData.code) {
    logger.warn('[Drive] createProjectDriveFolders — project missing `code`, skipping', { projectId });
    return null;
  }

  const db = admin.firestore();
  const settings = getDriveAuthSettings();
  const accessToken = await getGoogleDriveAccessToken(settings);
  const activeProjectsFolderId = await getActiveProjectsFolderId();

  const folderName = buildProjectFolderName(projectData);

  // 1. Root project folder.
  const root = await ensureFolder({
    accessToken,
    parentId: activeProjectsFolderId,
    name: folderName,
  });

  // 2. 01..07 subfolders. Sequential (not parallel) so the API's name
  //    uniqueness check doesn't race on retries.
  for (const sub of ALL_SUBFOLDERS) {
    await ensureFolder({
      accessToken,
      parentId: root.id,
      name: sub,
    });
  }

  // 3. Write-back — clear any previous error, stamp createdAt once.
  const updates = {
    driveFolderId: root.id,
    driveFolderUrl:
      root.webViewLink || `https://drive.google.com/drive/folders/${root.id}`,
    driveFolderError: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  };
  // Only stamp createdAt the first time — subsequent ensureFolder runs
  // (retries, idempotent resyncs) should preserve the original timestamp.
  if (root.created) {
    updates.driveFolderCreatedAt = FieldValue.serverTimestamp();
  }
  await db.collection('designProjects').doc(projectId).update(updates);

  logger.info('[Drive] createProjectDriveFolders — done', {
    projectId,
    folderName,
    driveFolderId: root.id,
    created: root.created,
  });

  return { driveFolderId: root.id, driveFolderUrl: updates.driveFolderUrl };
}

/**
 * Write an error state back to Firestore so operators can triage it
 * without combing through function logs. Never throws.
 */
async function recordProjectFolderError(projectId, err) {
  try {
    const db = admin.firestore();
    await db.collection('designProjects').doc(projectId).update({
      driveFolderError: String(err && err.message ? err.message : err).slice(0, 500),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (writeErr) {
    logger.error('[Drive] Failed to record driveFolderError', { projectId, writeErr });
  }
}

module.exports = {
  createProjectDriveFolders,
  recordProjectFolderError,
};
