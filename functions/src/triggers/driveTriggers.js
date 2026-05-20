/**
 * Firestore triggers that keep the Shared-Drive tree in sync with the
 * canonical Firestore collections.
 *
 *  - onDesignProjectCreatedForDrive
 *      fires on every `designProjects/{projectId}` create and bootstraps
 *      the `01_Active-Projects/{code}_..}/` folder tree.
 *
 *  - onProjectFileCreatedForDrive
 *      fires on every `projectFiles/{fileId}` create and mirrors the
 *      uploaded blob into the correct `01..07` subfolder.
 *
 * Both triggers are independent of the existing `businessEventMonitors`
 * triggers on the same collections — Firestore supports multiple
 * listeners per path. They short-circuit cleanly when the Drive mirror
 * feature flag is off (see `drive/config.js`).
 *
 * Errors are caught and written to the source doc's `drive*Error` field
 * so operators can triage without reading function logs.
 */

const {
  onDocumentCreated,
  onDocumentUpdated,
  onDocumentDeleted,
} = require('firebase-functions/v2/firestore');
const { logger } = require('firebase-functions');

const { DRIVE_SECRETS } = require('../drive/config');
const {
  createProjectDriveFolders,
  recordProjectFolderError,
} = require('../drive/createProjectFolders');
const {
  mirrorProjectFileToDrive,
  recordFileSyncError,
} = require('../drive/mirrorProjectFile');
const {
  archiveProject,
  recordArchiveError,
} = require('../drive/archiveProject');
const { handleProjectFileUpdate } = require('../drive/updateProjectFileMirror');
const { handleProjectFileDelete } = require('../drive/deleteProjectFileMirror');

const DRIVE_FN_OPTS = {
  // 1 GiB covers 500 MB cad-model uploads (max file-size limit) plus
  // headroom for base64 encoding. Memory is charged only while the
  // function runs, and these triggers are idle most of the time.
  memory: '1GiB',
  timeoutSeconds: 540,
  secrets: DRIVE_SECRETS,
};

const onDesignProjectCreatedForDrive = onDocumentCreated(
  { document: 'designProjects/{projectId}', ...DRIVE_FN_OPTS },
  async (event) => {
    const projectId = event.params.projectId;
    const snap = event.data;
    if (!snap) return;
    const projectData = snap.data();
    try {
      await createProjectDriveFolders(projectId, projectData);
    } catch (err) {
      logger.error('[Drive] Project folder bootstrap failed', { projectId, err });
      await recordProjectFolderError(projectId, err);
    }
  },
);

const onProjectFileCreatedForDrive = onDocumentCreated(
  { document: 'projectFiles/{fileId}', ...DRIVE_FN_OPTS },
  async (event) => {
    const fileId = event.params.fileId;
    const snap = event.data;
    if (!snap) return;
    const fileData = snap.data();
    try {
      await mirrorProjectFileToDrive(fileId, fileData);
    } catch (err) {
      logger.error('[Drive] File mirror failed', { fileId, err });
      // best-effort recording — Firestore rule requires uploadedBy match
      // OR admin; triggers run with admin credentials so this write always
      // succeeds regardless of the original uploader.
      const admin = require('firebase-admin');
      await recordFileSyncError(admin.firestore(), fileId, err);
    }
  },
);

/**
 * Archive trigger — fires on every `designProjects` update and archives
 * when status transitions to 'completed' (and the project isn't already
 * archived). Uses `onDocumentUpdated` so we have before/after states to
 * detect the transition — idempotent against double-completions.
 */
const onDesignProjectCompletedForDrive = onDocumentUpdated(
  { document: 'designProjects/{projectId}', ...DRIVE_FN_OPTS },
  async (event) => {
    const projectId = event.params.projectId;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!before || !after) return;

    // Only fire on a transition INTO 'completed' — cheapest possible
    // guard. Re-firing on subsequent edits of a completed project is
    // a no-op thanks to archiveProject's idempotency check, but we
    // save the round-trip here.
    const becameCompleted = before.status !== 'completed' && after.status === 'completed';
    if (!becameCompleted) return;
    if (after.archived === true) return;

    try {
      const archivedBy = after.updatedBy || 'system';
      await archiveProject(projectId, after, archivedBy);
    } catch (err) {
      logger.error('[Drive] Project archive failed', { projectId, err });
      await recordArchiveError(projectId, err);
    }
  },
);

/**
 * Phase 4b — onUpdate mirror. Fires on every `projectFiles` update
 * and re-mirrors when the storage path changed (i.e. `overwriteFile`)
 * or renames the Drive copy when the policy `name` changed. Other
 * metadata-only updates (status, portal share) are no-ops.
 */
const onProjectFileUpdatedForDrive = onDocumentUpdated(
  { document: 'projectFiles/{fileId}', ...DRIVE_FN_OPTS },
  async (event) => {
    const fileId = event.params.fileId;
    const before = event.data?.before?.data();
    const after = event.data?.after?.data();
    if (!after) return;
    try {
      await handleProjectFileUpdate(fileId, before, after);
    } catch (err) {
      logger.error('[Drive] onUpdate mirror failed', { fileId, err });
      const admin = require('firebase-admin');
      await recordFileSyncError(admin.firestore(), fileId, err);
    }
  },
);

/**
 * Phase 4b — onDelete cascade. Fires when a `projectFiles` doc is
 * deleted; cascades the delete to the Drive mirror so stale files
 * don't accumulate.
 */
const onProjectFileDeletedForDrive = onDocumentDeleted(
  { document: 'projectFiles/{fileId}', ...DRIVE_FN_OPTS },
  async (event) => {
    const fileId = event.params.fileId;
    const deletedData = event.data?.data();
    try {
      await handleProjectFileDelete(fileId, deletedData);
    } catch (err) {
      // Errors here can't be recorded anywhere — the doc is gone.
      // handleProjectFileDelete already swallows, so this catch is a
      // belt-and-braces in case the delegate function itself throws.
      logger.error('[Drive] onDelete cascade threw unexpectedly', { fileId, err });
    }
  },
);

module.exports = {
  onDesignProjectCreatedForDrive,
  onProjectFileCreatedForDrive,
  onDesignProjectCompletedForDrive,
  onProjectFileUpdatedForDrive,
  onProjectFileDeletedForDrive,
};
