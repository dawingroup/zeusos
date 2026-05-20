/**
 * onUpdate Drive mirror (Phase 4b follow-up to Phase 2).
 *
 * Phase 2 shipped only the `onCreate` mirror, leaving two staleness
 * gaps that were called out as deferred in the audit:
 *
 *   - `overwriteFile` mutates the same `projectFiles` doc with a new
 *     `storagePath` + `storageUrl` without firing `onCreate`; the
 *     Drive copy still points at the OLD bytes.
 *   - a policy `name` edit (operator rename, corrections, etc.)
 *     leaves the Drive file with its old filename.
 *
 * This module decides what to do given a before/after pair:
 *
 *   - `storagePath` changed         → re-mirror (delete old Drive file, upload new)
 *   - `name` changed (only)         → Drive rename-in-place
 *   - `archived` flipped true       → no-op (Phase 4 `archiveProject` handles the folder move)
 *   - other metadata-only changes   → no-op
 *
 * The trigger's before/after pair is the source of truth for what
 * changed; we never re-read the doc.
 */

const admin = require('firebase-admin');
const { logger } = require('firebase-functions');
const { FieldValue } = require('firebase-admin/firestore');

const { isDriveMirrorEnabled, getDriveAuthSettings } = require('./config');
const { getGoogleDriveAccessToken } = require('./driveAuth');
const { deleteFile, renameFile } = require('./driveClient');
const { mirrorProjectFileToDrive, recordFileSyncError } = require('./mirrorProjectFile');

/**
 * Pure diff classifier — pulled out so we can unit-test the branching
 * without stubbing Firebase/Drive. Returns one of:
 *   'noop' | 'remirror' | 'rename'
 */
function classifyFileUpdate(before, after) {
  if (!before || !after) return 'noop';

  // Archived files live under `02_Archive/{YYYY}/...` not
  // `01_Active-Projects/`. Re-mirroring them via the active-projects
  // flow would create a NEW active-tree copy AND leave the archive
  // copy behind — an immediate divergence. Skip.
  if (after.archived === true) return 'noop';

  // A storagePath swap = new bytes. This is the `overwriteFile` case.
  if (before.storagePath !== after.storagePath) return 'remirror';

  // Name-only change — only meaningful if there's already a Drive
  // mirror to rename; otherwise the `onCreate` trigger or the
  // next `onUpdate` storage change will handle it.
  if (before.name !== after.name && after.driveFileId) return 'rename';

  return 'noop';
}

/**
 * Do the re-mirror dance: delete the old Drive file, clear stale
 * `drive*` fields on the doc, then invoke the same `mirrorProjectFileToDrive`
 * function the `onCreate` trigger uses.
 */
async function remirrorForStorageChange(fileId, before, after) {
  const db = admin.firestore();
  const settings = getDriveAuthSettings();
  const accessToken = await getGoogleDriveAccessToken(settings);

  // Delete the old Drive object first — best-effort; the mirror then
  // recreates. If this fails the re-mirror still proceeds; a small
  // orphan in Drive is a lesser evil than a missing current mirror.
  if (before && before.driveFileId) {
    try {
      await deleteFile({ accessToken, fileId: before.driveFileId });
    } catch (err) {
      logger.warn('[Drive] remirror — old Drive file delete failed; continuing', {
        fileId,
        driveFileId: before.driveFileId,
        err,
      });
    }
  }

  // Clear stale mirror fields so the after-state passed to
  // `mirrorProjectFileToDrive` doesn't look already-mirrored.
  await db.collection('projectFiles').doc(fileId).update({
    driveFileId: FieldValue.delete(),
    driveWebViewLink: FieldValue.delete(),
    driveFolderSubpath: FieldValue.delete(),
    driveSyncedAt: FieldValue.delete(),
    driveSyncError: FieldValue.delete(),
    updatedAt: FieldValue.serverTimestamp(),
  });

  // The `after` snapshot has the new `storagePath`/`storageUrl`, so
  // the mirror function picks up the right bytes from Firebase Storage.
  await mirrorProjectFileToDrive(fileId, {
    ...after,
    driveFileId: null,
    driveWebViewLink: null,
    driveFolderSubpath: null,
  });
}

/** Rename the Drive copy to match the new policy `name` on the doc. */
async function renameInDrive(fileId, after) {
  const settings = getDriveAuthSettings();
  const accessToken = await getGoogleDriveAccessToken(settings);
  const result = await renameFile({
    accessToken,
    fileId: after.driveFileId,
    newName: after.name || after.fileName,
  });
  // Keep webViewLink fresh (it sometimes changes when a file's name is
  // edited, depending on Shared-Drive settings).
  const db = admin.firestore();
  await db.collection('projectFiles').doc(fileId).update({
    driveWebViewLink:
      result.webViewLink || `https://drive.google.com/file/d/${after.driveFileId}/view`,
    updatedAt: FieldValue.serverTimestamp(),
  });
}

/**
 * Main entry — called from the `onDocumentUpdated` trigger.
 * Delegates error reporting to the caller so the trigger layer can
 * stamp `driveSyncError` in one place.
 */
async function handleProjectFileUpdate(fileId, before, after) {
  if (!(await isDriveMirrorEnabled())) {
    logger.info('[Drive] onUpdate mirror disabled, skipping', { fileId });
    return;
  }
  const action = classifyFileUpdate(before, after);
  switch (action) {
    case 'remirror':
      logger.info('[Drive] onUpdate — re-mirror for storage change', { fileId });
      await remirrorForStorageChange(fileId, before, after);
      return;
    case 'rename':
      logger.info('[Drive] onUpdate — Drive rename', { fileId });
      await renameInDrive(fileId, after);
      return;
    case 'noop':
    default:
      return;
  }
}

module.exports = {
  classifyFileUpdate,
  handleProjectFileUpdate,
  // Re-exported so the trigger layer can stamp errors without pulling
  // in `./mirrorProjectFile` directly.
  recordFileSyncError,
};
