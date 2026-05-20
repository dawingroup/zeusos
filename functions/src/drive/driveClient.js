/**
 * Google Drive REST client helpers.
 *
 * We use the raw Drive v3 REST API over `fetch` rather than the
 * `googleapis` SDK to keep the bundle small and match the existing
 * pattern in `document-export.js`. Every call includes
 * `supportsAllDrives=true` because our target is a Shared Drive
 * (a.k.a. Team Drive); omitting the flag causes 404s on folder lookups.
 *
 * All functions throw on non-2xx responses with the Drive error body
 * attached so the trigger can write the failure to `driveSyncError`.
 */

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const SHARED_DRIVES_QS = 'supportsAllDrives=true&includeItemsFromAllDrives=true';

/**
 * Create a folder under a given parent, or return the existing folder
 * if one with the same name already exists (idempotent).
 *
 * @param {object} opts
 * @param {string} opts.accessToken
 * @param {string} opts.parentId — folder to create under
 * @param {string} opts.name — folder display name
 * @param {string} [opts.driveId] — Shared-Drive ID if parent is a drive root
 * @returns {Promise<{id: string, webViewLink?: string, created: boolean}>}
 */
async function ensureFolder({ accessToken, parentId, name, driveId }) {
  // Drive's `q` syntax escaping — wrap single-quotes in the name.
  const safeName = name.replace(/'/g, "\\'");
  const q = encodeURIComponent(
    `'${parentId}' in parents and name = '${safeName}' ` +
      `and mimeType = 'application/vnd.google-apps.folder' and trashed = false`,
  );
  const driveScope = driveId
    ? `&driveId=${encodeURIComponent(driveId)}&corpora=drive`
    : '&corpora=allDrives';

  const searchResp = await fetch(
    `${DRIVE_API}/files?q=${q}&fields=files(id,webViewLink,name)&${SHARED_DRIVES_QS}${driveScope}`,
    {
      method: 'GET',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );

  if (!searchResp.ok) {
    const text = await searchResp.text();
    throw new Error(`Drive folder search failed: ${searchResp.status} ${text}`);
  }
  const search = await searchResp.json();
  if (search.files && search.files.length > 0) {
    return { id: search.files[0].id, webViewLink: search.files[0].webViewLink, created: false };
  }

  const metadata = {
    name,
    mimeType: 'application/vnd.google-apps.folder',
    parents: [parentId],
  };
  const createResp = await fetch(
    `${DRIVE_API}/files?fields=id,webViewLink&${SHARED_DRIVES_QS}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(metadata),
    },
  );
  if (!createResp.ok) {
    const text = await createResp.text();
    throw new Error(`Drive folder create failed for "${name}": ${createResp.status} ${text}`);
  }
  const created = await createResp.json();
  return { id: created.id, webViewLink: created.webViewLink, created: true };
}

/**
 * Upload a file (multipart) to the given folder. Returns the Drive
 * file ID and `webViewLink`.
 *
 * @param {object} opts
 * @param {string} opts.accessToken
 * @param {string} opts.parentFolderId
 * @param {string} opts.fileName — display name on Drive (should be policy-compliant)
 * @param {string} opts.mimeType
 * @param {Buffer} opts.fileBuffer
 * @returns {Promise<{id: string, webViewLink: string}>}
 */
async function uploadFile({ accessToken, parentFolderId, fileName, mimeType, fileBuffer }) {
  const metadata = {
    name: fileName,
    parents: [parentFolderId],
  };
  const boundary = '-------314159265358979323846';
  const delimiter = `\r\n--${boundary}\r\n`;
  const closeDelimiter = `\r\n--${boundary}--`;
  const body =
    delimiter +
    'Content-Type: application/json; charset=UTF-8\r\n\r\n' +
    JSON.stringify(metadata) +
    delimiter +
    `Content-Type: ${mimeType || 'application/octet-stream'}\r\n` +
    'Content-Transfer-Encoding: base64\r\n\r\n' +
    fileBuffer.toString('base64') +
    closeDelimiter;

  const resp = await fetch(
    `${DRIVE_UPLOAD_API}/files?uploadType=multipart&fields=id,webViewLink&${SHARED_DRIVES_QS}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': `multipart/related; boundary=${boundary}`,
      },
      body,
    },
  );
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Drive file upload failed for "${fileName}": ${resp.status} ${text}`);
  }
  const result = await resp.json();
  return {
    id: result.id,
    webViewLink: result.webViewLink || `https://drive.google.com/file/d/${result.id}/view`,
  };
}

/**
 * Move a file or folder between parents (used by Phase 4 archive lifecycle).
 */
async function moveItem({ accessToken, fileId, addParentId, removeParentId }) {
  const resp = await fetch(
    `${DRIVE_API}/files/${fileId}?addParents=${encodeURIComponent(addParentId)}&removeParents=${encodeURIComponent(removeParentId)}&fields=id,parents,webViewLink&${SHARED_DRIVES_QS}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    },
  );
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Drive move failed: ${resp.status} ${text}`);
  }
  return resp.json();
}

/**
 * Delete a Drive file (hard — sends it to trash per Drive semantics).
 */
async function deleteFile({ accessToken, fileId }) {
  const resp = await fetch(
    `${DRIVE_API}/files/${fileId}?${SHARED_DRIVES_QS}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
  if (!resp.ok && resp.status !== 404) {
    const text = await resp.text();
    throw new Error(`Drive delete failed: ${resp.status} ${text}`);
  }
}

/**
 * Rename a Drive file in place (no bytes touched). Used when the
 * policy `name` on a `projectFiles` doc changes but the underlying
 * storage blob does not (e.g. version bump via `replaceFile` is
 * handled by creating a new doc, but an operator could edit the
 * display name directly).
 */
async function renameFile({ accessToken, fileId, newName }) {
  const resp = await fetch(
    `${DRIVE_API}/files/${fileId}?fields=id,name,webViewLink&${SHARED_DRIVES_QS}`,
    {
      method: 'PATCH',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ name: newName }),
    },
  );
  if (!resp.ok) {
    const text = await resp.text();
    throw new Error(`Drive rename failed for "${fileId}": ${resp.status} ${text}`);
  }
  return resp.json();
}

module.exports = {
  ensureFolder,
  uploadFile,
  moveItem,
  deleteFile,
  renameFile,
};
