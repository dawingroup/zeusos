/**
 * Tiny helper to ensure the `02_Archive/{YYYY}/` sub-folder exists on
 * the archive drive and return its ID. Pulled out of `archiveProject.js`
 * so the monthly sweep can reuse it without circular deps.
 */

const { ensureFolder } = require('./driveClient');

/**
 * @param {object} opts
 * @param {string} opts.accessToken
 * @param {string} opts.archiveRootFolderId — the `02_Archive` drive/folder
 * @param {number} [opts.year] — defaults to now() UTC year
 * @returns {Promise<string>} Drive folder ID for the year bucket
 */
async function ensureYearFolder({ accessToken, archiveRootFolderId, year }) {
  const resolvedYear = year || new Date().getUTCFullYear();
  const name = String(resolvedYear);
  const result = await ensureFolder({
    accessToken,
    parentId: archiveRootFolderId,
    name,
  });
  return result.id;
}

module.exports = { ensureYearFolder };
