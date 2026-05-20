/**
 * Drive bridge configuration.
 *
 * All Drive-mirror Cloud Functions read their target folder IDs and
 * feature flag from here. If `DRIVE_ACTIVE_PROJECTS_FOLDER_ID` is not
 * set, the mirror is considered DISABLED and all Drive writes are
 * short-circuited with a `logger.info` — code still deploys cleanly.
 *
 * Wire-up (Phase 0 admin action):
 *   1. Admin creates the `01_Active-Projects` Shared Drive (or supplies
 *      its existing folder ID if it already exists inside the
 *      `03_Group-Operations` hierarchy).
 *   2. Admin runs `firebase functions:config:set drive.active_projects_folder_id=<id>`
 *      OR adds `DRIVE_ACTIVE_PROJECTS_FOLDER_ID=<id>` to the functions env.
 *   3. Admin confirms the `GOOGLE_DRIVE_*` service account has Content
 *      Manager role on the Shared Drive.
 *
 * Shared-drive semantics: every API call we make includes
 * `supportsAllDrives=true`. See `driveClient.js`.
 */

const { defineSecret, defineString } = require('firebase-functions/params');
const { resolveFolderId } = require('./liveSettings');

// ── Secrets ────────────────────────────────────────────────────────────

/**
 * PKCS8 / PEM body of the Google service-account private key. Reused from
 * `document-export.js` (same account can handle both flows — see Phase 2
 * open question #2 in the audit).
 */
const GOOGLE_DRIVE_PRIVATE_KEY = defineSecret('GOOGLE_DRIVE_PRIVATE_KEY');

/**
 * Service-account email (e.g. `drive-sync@dawinos.iam.gserviceaccount.com`).
 * NOT a secret in the cryptographic sense, but carried alongside the key
 * so callers don't have to manage two surfaces.
 */
const GOOGLE_DRIVE_CLIENT_EMAIL = defineSecret('GOOGLE_DRIVE_CLIENT_EMAIL');

// ── Params (non-secret config) ─────────────────────────────────────────

/**
 * Folder ID of the `01_Active-Projects` root under which per-project
 * folders are created. Empty string means the feature is disabled.
 */
const ACTIVE_PROJECTS_FOLDER_ID = defineString('DRIVE_ACTIVE_PROJECTS_FOLDER_ID', {
  default: '',
  description:
    'Google Drive folder ID where per-project folders are created. Empty = Drive sync disabled.',
});

/**
 * Folder ID of the `02_Archive` root — Phase 4 archive lifecycle will
 * move completed project folders here. Empty = archiving disabled.
 */
const ARCHIVE_FOLDER_ID = defineString('DRIVE_ARCHIVE_FOLDER_ID', {
  default: '',
  description:
    'Google Drive folder ID for `02_Archive`. Phase 4 — empty = archiving disabled.',
});

// ── Runtime helpers ────────────────────────────────────────────────────
//
// Folder-ID getters are ASYNC: they consult the live `systemSettings/
// driveFolders` Firestore doc first (60 s cache), then fall back to
// the env-var `defineString` param. This lets admins live-edit folder
// targets from the settings page without redeploying.
//
// Secret-backed helpers (`getDriveAuthSettings`) stay synchronous —
// secrets only flow through `defineSecret` and never land in Firestore.

/**
 * Returns `true` when the Drive mirror is fully configured — i.e.
 * an active-projects folder ID is mappable (Firestore or env) AND
 * both auth secrets are set. Trigger handlers MUST call this before
 * any Drive API work and short-circuit with a log line when it
 * returns false.
 */
async function isDriveMirrorEnabled() {
  const folderId = await getActiveProjectsFolderId();
  const hasKey = Boolean(GOOGLE_DRIVE_PRIVATE_KEY.value());
  const hasEmail = Boolean(GOOGLE_DRIVE_CLIENT_EMAIL.value());
  return Boolean(folderId) && hasKey && hasEmail;
}

/**
 * Read service-account settings for `driveAuth.getGoogleDriveAccessToken()`.
 * Synchronous — secrets only. Throws if called without both set.
 */
function getDriveAuthSettings() {
  const privateKey = GOOGLE_DRIVE_PRIVATE_KEY.value();
  const serviceAccountEmail = GOOGLE_DRIVE_CLIENT_EMAIL.value();
  if (!privateKey || !serviceAccountEmail) {
    throw new Error(
      'Drive auth settings incomplete — set GOOGLE_DRIVE_PRIVATE_KEY + GOOGLE_DRIVE_CLIENT_EMAIL secrets',
    );
  }
  return { privateKey, serviceAccountEmail };
}

/** Phase 2 — `01_Active-Projects/` root. Async: Firestore-first. */
function getActiveProjectsFolderId() {
  return resolveFolderId('activeProjects', () => ACTIVE_PROJECTS_FOLDER_ID.value());
}

/** Phase 4 — `02_Archive/` root. Async: Firestore-first. */
function getArchiveFolderId() {
  return resolveFolderId('archive', () => ARCHIVE_FOLDER_ID.value());
}

/**
 * Generic slot resolver for Phase 5 slots (templatesResources,
 * finishLibrary, documentTemplates, dawinosExports, brandAssets).
 * No env-var fallback because those slots were never wired to
 * `defineString` — Firestore is the only source.
 */
function getFolderIdForSlot(slotName) {
  return resolveFolderId(slotName, () => '');
}

/**
 * The list of secrets/params each Drive-backed function must declare in
 * its `.runWith({ secrets: [...] })` / v2 `secrets: [...]` block. Import
 * this from index.js when registering the functions.
 */
const DRIVE_SECRETS = [GOOGLE_DRIVE_PRIVATE_KEY, GOOGLE_DRIVE_CLIENT_EMAIL];

module.exports = {
  GOOGLE_DRIVE_PRIVATE_KEY,
  GOOGLE_DRIVE_CLIENT_EMAIL,
  ACTIVE_PROJECTS_FOLDER_ID,
  ARCHIVE_FOLDER_ID,
  DRIVE_SECRETS,
  isDriveMirrorEnabled,
  getDriveAuthSettings,
  getActiveProjectsFolderId,
  getArchiveFolderId,
  getFolderIdForSlot,
};
