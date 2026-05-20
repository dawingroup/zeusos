/**
 * Live-editable Drive folder settings reader.
 *
 * The settings page writes to `systemSettings/driveFolders`. The
 * Cloud Functions read from it *first* (with a short in-memory
 * cache) and fall back to env-var `defineString` params when a slot
 * is empty. This means an admin can paste a new folder ID in the UI
 * and the next trigger fire picks it up — no redeploy.
 *
 * Secrets (service-account private key + email) are still `defineSecret`
 * and NOT in this file. Folder IDs are not secrets.
 *
 * Cache semantics:
 *   - TTL 60 s (tunable via CACHE_TTL_MS).
 *   - Cache is per-function-instance — Cloud Functions spawns
 *     instances on demand, so cache coherency across instances is not
 *     a concern; each picks up the new value within TTL of its next
 *     cold start.
 *   - Read errors fall back to the last cached value if one exists,
 *     else to env. Never blocks the trigger.
 */

const admin = require('firebase-admin');
const { logger } = require('firebase-functions');

const DOC_PATH = ['systemSettings', 'driveFolders'];
const CACHE_TTL_MS = 60_000;

let cachedBindings = null;
let cachedAt = 0;

/**
 * Fetch the live bindings map, using the in-memory cache when warm.
 * Returns `{}` on any error path so callers can safely `.activeProjects?.folderId`.
 *
 * @returns {Promise<Record<string, {folderId?: string, folderName?: string}>>}
 */
async function getLiveBindings() {
  const now = Date.now();
  if (cachedBindings && now - cachedAt < CACHE_TTL_MS) {
    return cachedBindings;
  }

  try {
    const snap = await admin
      .firestore()
      .doc(DOC_PATH.join('/'))
      .get();
    const data = snap.exists ? snap.data() : null;
    cachedBindings = (data && data.bindings) || {};
    cachedAt = now;
    return cachedBindings;
  } catch (err) {
    logger.warn('[Drive] liveSettings read failed — falling back to cache/env', { err });
    // Return last-known good cache if any, else empty object so the
    // caller falls through to env-var fallbacks.
    return cachedBindings || {};
  }
}

/**
 * Invalidate the cache — useful from tests or from a trigger on the
 * settings doc itself (not strictly necessary thanks to TTL, but
 * makes saves feel instant in the admin UI on the active instance).
 */
function invalidateSettingsCache() {
  cachedBindings = null;
  cachedAt = 0;
}

/**
 * Get the folder ID for a named slot. Firestore first, falls back to
 * the provided `envFallback()` thunk (which closes over the correct
 * `defineString` param) when the slot is unset or empty.
 */
async function resolveFolderId(slotName, envFallback) {
  const bindings = await getLiveBindings();
  const slot = bindings[slotName];
  const fromFirestore = slot && typeof slot.folderId === 'string' ? slot.folderId.trim() : '';
  if (fromFirestore) return fromFirestore;
  try {
    const fromEnv = envFallback();
    return typeof fromEnv === 'string' ? fromEnv.trim() : '';
  } catch {
    return '';
  }
}

module.exports = {
  getLiveBindings,
  invalidateSettingsCache,
  resolveFolderId,
};
