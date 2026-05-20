/**
 * onDelete Drive cascade (Phase 4b follow-up to Phase 2).
 *
 * When a `projectFiles` doc is deleted (via the unified file manager
 * or any admin tool), the Drive mirror should go too — otherwise
 * stale copies accumulate under `01_Active-Projects/.../0{N}_...`
 * with no Firestore reference to ever remove them.
 *
 * Behaviour:
 *   - Drive mirror disabled     → no-op (log only).
 *   - No `driveFileId` on the deleted doc → no-op (nothing to delete).
 *   - Delete fails              → logged but swallowed; we can't
 *     stamp an error back onto a doc that no longer exists, and
 *     blowing up the trigger just leaves the orphan without helping.
 *
 * Archiving is not deletion — the archive lifecycle moves files, it
 * doesn't remove them. This cascade only fires on a real Firestore
 * document delete.
 */

const { logger } = require('firebase-functions');

const { isDriveMirrorEnabled, getDriveAuthSettings } = require('./config');
const { getGoogleDriveAccessToken } = require('./driveAuth');
const { deleteFile } = require('./driveClient');

/**
 * @param {string} fileId — the deleted `projectFiles` doc ID
 * @param {object | undefined} deletedData — snapshot of the doc at deletion time
 */
async function handleProjectFileDelete(fileId, deletedData) {
  if (!(await isDriveMirrorEnabled())) {
    logger.info('[Drive] onDelete cascade disabled, skipping', { fileId });
    return;
  }
  if (!deletedData || !deletedData.driveFileId) {
    logger.info('[Drive] onDelete — no driveFileId, nothing to cascade', { fileId });
    return;
  }

  try {
    const settings = getDriveAuthSettings();
    const accessToken = await getGoogleDriveAccessToken(settings);
    await deleteFile({ accessToken, fileId: deletedData.driveFileId });
    logger.info('[Drive] onDelete — Drive mirror deleted', {
      fileId,
      driveFileId: deletedData.driveFileId,
    });
  } catch (err) {
    // Silent failures leave a Drive orphan behind. That's strictly
    // worse than a no-op but better than blowing up a trigger the
    // user's already moved on from. A future reconciliation script
    // can sweep orphans (listing `01_Active-Projects/**` and
    // cross-checking against `projectFiles` is straightforward).
    logger.error('[Drive] onDelete cascade failed — Drive orphan likely', {
      fileId,
      driveFileId: deletedData.driveFileId,
      err,
    });
  }
}

module.exports = { handleProjectFileDelete };
