/**
 * Compose the project folder name used inside `01_Active-Projects/`.
 *
 * Per `Dawin-Shared-Drive-Architecture v3` §Project Folder Format:
 *
 *     {ProjectCode}_{Client-Name}_{Project-Type}
 *     e.g.  DF-2025-001_Smith-Residence_Kitchen-Remodel
 *
 * We kebab-case the client name and project type (matching Naming
 * Policy v4 §Kebab-case discoverability) but keep the project code in
 * its canonical upper-case `{Sub}-{Year}-{Seq}` shape.
 *
 * Inputs that arrive empty (e.g. `customerName` missing) fall back to
 * placeholder strings so the folder is still created deterministically
 * — the caller logs a warning so the data can be repaired later.
 */

/** Convert free-text to kebab-case, preserving letters and digits. */
function kebab(text, fallback = 'unknown') {
  if (!text || typeof text !== 'string') return fallback;
  const cleaned = text
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  return cleaned || fallback;
}

/**
 * Preserve capitalisation when a field is already in canonical Title-Case
 * (e.g. "Smith-Residence"). Only lowercases when the input is clearly
 * free-form. Heuristic — prefer simpler handling over cleverness.
 */
function titleKebab(text, fallback) {
  if (!text) return fallback;
  return text
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^A-Za-z0-9-]/g, '')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || fallback;
}

/**
 * @param {object} project — a DesignProject-shaped doc
 * @param {string} project.code — "DF-2025-001"
 * @param {string} [project.customerName]
 * @param {string} [project.name] — project title, used as "project type" slug
 * @returns {string} folder name
 */
function buildProjectFolderName(project) {
  const code = (project && project.code ? String(project.code).trim() : '') || 'UNKNOWN-CODE';
  const client = titleKebab(project && project.customerName, 'Unknown-Client');
  const type = titleKebab(project && project.name, 'Project');
  return `${code}_${client}_${type}`;
}

module.exports = {
  kebab,
  titleKebab,
  buildProjectFolderName,
};
