/**
 * Admin-invoked Drive-folder verification callable.
 *
 * Takes a folder ID pasted by an admin into the Drive Folder
 * Settings page and confirms the service account can reach it.
 * Returns `{ ok, name, webViewLink, itemCount, error }` — the UI
 * displays a green check + folder name on success, a red alert with
 * the error message on failure.
 *
 * Uses the same service-account auth as the Drive-bridge triggers
 * so "pasted ID works in the UI" == "the triggers will be able to
 * use it". If the service account can't see the folder, the admin
 * needs to share it (Drive folder → Share → paste the service
 * account's email as Content Manager).
 *
 * Auth: caller must be signed in. The rules layer doesn't gate this
 * any stricter; leaking "folder X exists and has N children" to an
 * authenticated non-admin is low-risk given they still can't write
 * to it without the service-account credentials.
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const { FieldValue } = require('firebase-admin/firestore');

// (CORS config uses the simpler `cors: true` form — see `onCall` block.)
const { DRIVE_SECRETS, getDriveAuthSettings } = require('../drive/config');
const { getGoogleDriveAccessToken } = require('../drive/driveAuth');

const SETTINGS_DOC = ['systemSettings', 'driveFolders'];

/**
 * Stamp the Drive service-account email onto the settings doc so
 * the admin UI can show "share folders with <email>". Best-effort —
 * a failure here doesn't fail the verify response.
 */
async function stampServiceAccountEmail(email) {
  if (!email) return;
  try {
    await admin
      .firestore()
      .doc(SETTINGS_DOC.join('/'))
      .set(
        {
          serviceAccountEmail: email,
          serviceAccountEmailSyncedAt: FieldValue.serverTimestamp(),
        },
        { merge: true },
      );
  } catch (err) {
    logger.warn('[verifyDriveFolder] Failed to stamp service-account email', { err });
  }
}

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const SHARED_DRIVES_QS = 'supportsAllDrives=true&includeItemsFromAllDrives=true';

const verifyDriveFolder = onCall(
  {
    secrets: DRIVE_SECRETS,
    // `onCall` security comes from the `request.auth` check below, not
    // from CORS. `cors: true` matches the working pattern used by
    // other admin callables in this codebase (aiMemory, assistantChat,
    // applyInventoryCorrections). Passing `cors: ALLOWED_ORIGINS`
    // failed the preflight check from https://dawinos.web.app in
    // production — the array form isn't honoured by Functions v2
    // `onCall` in firebase-functions 4.9.0.
    cors: true,
    memory: '256MiB',
    timeoutSeconds: 30,
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Sign in required');
    }
    const folderId =
      typeof request.data?.folderId === 'string' ? request.data.folderId.trim() : '';
    if (!folderId) {
      throw new HttpsError('invalid-argument', 'folderId is required');
    }

    let accessToken;
    try {
      accessToken = await getGoogleDriveAccessToken(getDriveAuthSettings());
    } catch (err) {
      logger.warn('[verifyDriveFolder] auth setup failed', { err });
      return {
        ok: false,
        folderId,
        error:
          'Drive service account not fully configured. Set GOOGLE_DRIVE_PRIVATE_KEY + GOOGLE_DRIVE_CLIENT_EMAIL secrets first.',
      };
    }

    // 1. Fetch folder metadata — confirms the ID resolves AND is a folder.
    try {
      const metaResp = await fetch(
        `${DRIVE_API}/files/${encodeURIComponent(folderId)}?fields=id,name,mimeType,webViewLink,driveId&${SHARED_DRIVES_QS}`,
        { headers: { Authorization: `Bearer ${accessToken}` } },
      );
      if (!metaResp.ok) {
        const text = await metaResp.text();
        return {
          ok: false,
          folderId,
          error:
            metaResp.status === 404
              ? `Folder not found or not shared with the service account. Share the folder with ${getServiceAccountEmailSafe()} as Content Manager.`
              : `Drive error ${metaResp.status}: ${text.slice(0, 300)}`,
        };
      }
      const meta = await metaResp.json();
      if (meta.mimeType !== 'application/vnd.google-apps.folder') {
        return {
          ok: false,
          folderId,
          error: `That ID is not a folder (mimeType=${meta.mimeType}). Paste a folder URL/ID, not a file.`,
        };
      }

      // 2. Shallow child count — a zero count is valid (empty folder)
      //    but worth surfacing in case the admin pasted the wrong ID.
      let itemCount = 0;
      try {
        const listResp = await fetch(
          `${DRIVE_API}/files?q=${encodeURIComponent(`'${folderId}' in parents and trashed = false`)}&fields=files(id)&pageSize=100&${SHARED_DRIVES_QS}`,
          { headers: { Authorization: `Bearer ${accessToken}` } },
        );
        if (listResp.ok) {
          const body = await listResp.json();
          itemCount = Array.isArray(body.files) ? body.files.length : 0;
        }
      } catch (err) {
        // Listing failure isn't fatal — the folder resolved, we just
        // can't count children. Leave itemCount=0 and move on.
        logger.warn('[verifyDriveFolder] child list failed — returning zero count', { err });
      }

      // Stamp the service-account email onto the settings doc so the
      // admin UI can show the correct "share with" address. Fire-and-
      // forget — we already have everything we need to respond to the
      // caller, and a settings-doc failure shouldn't fail the verify.
      try {
        const { serviceAccountEmail } = getDriveAuthSettings();
        void stampServiceAccountEmail(serviceAccountEmail);
      } catch {
        // getDriveAuthSettings can throw if secrets are unset —
        // already covered by the earlier auth block; ignore here.
      }

      return {
        ok: true,
        folderId,
        name: meta.name,
        webViewLink:
          meta.webViewLink || `https://drive.google.com/drive/folders/${meta.id}`,
        itemCount,
        driveId: meta.driveId || null,
      };
    } catch (err) {
      logger.error('[verifyDriveFolder] unexpected failure', { err });
      return {
        ok: false,
        folderId,
        error: err instanceof Error ? err.message : String(err),
      };
    }
  },
);

function getServiceAccountEmailSafe() {
  try {
    return getDriveAuthSettings().serviceAccountEmail || 'the Drive service account';
  } catch {
    return 'the Drive service account';
  }
}

module.exports = { verifyDriveFolder };
