/**
 * Archive lifecycle (Phase 4 — Shared Drive Architecture v3 §02_Archive).
 *
 * When a `designProjects` doc transitions to `status: 'completed'`, this
 * CF:
 *
 *   1. Ensures `02_Archive/{YYYY}/` exists on the archive Shared Drive.
 *   2. Moves the project's root folder from under `01_Active-Projects/`
 *      into `02_Archive/{YYYY}/` via Drive `files.update` (addParents +
 *      removeParents). Children move with the parent — no recursion.
 *   3. Batch-writes `archived: true`, `archivedAt`, `archivedBy` onto
 *      every `projectFiles` doc for the project.
 *   4. Stamps the same flags + the new `driveFolderUrl` back on the
 *      `designProjects/{id}` doc so operators can reach the archived
 *      folder in one click.
 *
 * Idempotent — if the project is already marked `archived: true` the
 * function returns early. The Drive move is also idempotent by virtue
 * of addParents/removeParents being a set operation.
 *
 * Errors are recorded on the project doc (`archiveError` field) so
 * operators can retry without digging through function logs; the
 * monthly sweep picks up any project that has `status='completed'` +
 * `archived != true` regardless of the error reason.
 */

const admin = require('firebase-admin');
const { logger } = require('firebase-functions');
const { FieldValue } = require('firebase-admin/firestore');

const {
  isDriveMirrorEnabled,
  getDriveAuthSettings,
  getActiveProjectsFolderId,
  getArchiveFolderId,
} = require('./config');
const { getGoogleDriveAccessToken } = require('./driveAuth');
const { moveItem } = require('./driveClient');
const { ensureYearFolder } = require('./archiveYearFolder');

const PROJECT_FILES_BATCH_SIZE = 400; // Firestore batch limit is 500; leave headroom.

/**
 * Check whether archiving is fully configured (mirror enabled AND an
 * `02_Archive` folder ID set). Archiving is a superset of mirroring.
 * Async since the underlying config getters consult Firestore.
 */
async function isArchiveEnabled() {
  const [mirrorEnabled, archiveFolderId] = await Promise.all([
    isDriveMirrorEnabled(),
    getArchiveFolderId(),
  ]);
  return mirrorEnabled && Boolean(archiveFolderId);
}

/**
 * Flag every `projectFiles` doc for the project as archived. Chunks the
 * writes into Firestore batches so very large projects don't blow the
 * 500-ops-per-batch limit.
 */
async function flagFilesArchived(projectId, archivedBy) {
  const db = admin.firestore();
  const snap = await db
    .collection('projectFiles')
    .where('projectId', '==', projectId)
    .get();
  if (snap.empty) return 0;

  let written = 0;
  for (let i = 0; i < snap.docs.length; i += PROJECT_FILES_BATCH_SIZE) {
    const batch = db.batch();
    const slice = snap.docs.slice(i, i + PROJECT_FILES_BATCH_SIZE);
    for (const fileDoc of slice) {
      batch.update(fileDoc.ref, {
        archived: true,
        archivedAt: FieldValue.serverTimestamp(),
        archivedBy,
        updatedAt: FieldValue.serverTimestamp(),
      });
    }
    await batch.commit();
    written += slice.length;
  }
  return written;
}

/**
 * @param {string} projectId
 * @param {object} projectData — current project doc (post-update snapshot)
 * @param {string} [archivedBy] — who triggered archival (defaults to 'system')
 * @returns {Promise<{moved: boolean, driveFolderUrl?: string, filesFlagged: number} | null>}
 */
async function archiveProject(projectId, projectData, archivedBy = 'system') {
  if (!(await isArchiveEnabled())) {
    logger.info('[Drive] archiveProject — mirror or archive disabled, skipping', { projectId });
    return null;
  }
  if (!projectData) return null;

  // Idempotency — project already archived.
  if (projectData.archived === true) {
    logger.info('[Drive] archiveProject — already archived, skipping', { projectId });
    return { moved: false, filesFlagged: 0 };
  }

  const db = admin.firestore();
  const settings = getDriveAuthSettings();
  const accessToken = await getGoogleDriveAccessToken(settings);

  let driveFolderUrl = projectData.driveFolderUrl || null;

  // Only perform the Drive move if we actually have a folder to move.
  // Projects that predated Phase 2 or whose bootstrap failed can still
  // be flagged archived — the Drive folder stays where it is (or
  // doesn't exist), and the flag accurately reflects Firestore state.
  if (projectData.driveFolderId) {
    const [activeProjectsFolderId, archiveRootFolderId] = await Promise.all([
      getActiveProjectsFolderId(),
      getArchiveFolderId(),
    ]);

    const yearFolderId = await ensureYearFolder({
      accessToken,
      archiveRootFolderId,
      // Use the project's completedDate year if present, else current year.
      year:
        projectData.completedDate && projectData.completedDate.toDate
          ? projectData.completedDate.toDate().getUTCFullYear()
          : undefined,
    });

    const moved = await moveItem({
      accessToken,
      fileId: projectData.driveFolderId,
      addParentId: yearFolderId,
      removeParentId: activeProjectsFolderId,
    });
    driveFolderUrl =
      moved.webViewLink || `https://drive.google.com/drive/folders/${projectData.driveFolderId}`;
  } else {
    logger.info('[Drive] archiveProject — no driveFolderId; flagging-only', { projectId });
  }

  // Flag every projectFiles doc before stamping the project — so a
  // reader that sees `project.archived===true` never briefly sees
  // `file.archived===false` on the same project.
  const filesFlagged = await flagFilesArchived(projectId, archivedBy);

  await db.collection('designProjects').doc(projectId).update({
    archived: true,
    archivedAt: FieldValue.serverTimestamp(),
    archivedBy,
    archiveError: FieldValue.delete(),
    driveFolderUrl: driveFolderUrl || FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  logger.info('[Drive] archiveProject — done', {
    projectId,
    filesFlagged,
    moved: Boolean(projectData.driveFolderId),
  });

  return {
    moved: Boolean(projectData.driveFolderId),
    driveFolderUrl: driveFolderUrl || undefined,
    filesFlagged,
  };
}

/** Write an error state back to Firestore so operators can triage. */
async function recordArchiveError(projectId, err) {
  try {
    const db = admin.firestore();
    await db.collection('designProjects').doc(projectId).update({
      archiveError: String(err && err.message ? err.message : err).slice(0, 500),
      updatedAt: FieldValue.serverTimestamp(),
    });
  } catch (writeErr) {
    logger.error('[Drive] Failed to record archiveError', { projectId, writeErr });
  }
}

module.exports = {
  archiveProject,
  recordArchiveError,
  isArchiveEnabled,
  flagFilesArchived,
};
