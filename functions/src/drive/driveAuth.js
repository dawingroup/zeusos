/**
 * Google Drive service-account auth.
 *
 * Mirrors the pattern originally inlined in `functions/src/scheduled/
 * document-export.js`, but scoped broader (`drive` instead of
 * `drive.file`) so the same token can create folders we don't own yet —
 * required for the per-project folder bootstrap. A 15-second skew on the
 * token expiry avoids edge-case clock drift.
 *
 * Tokens are cached in-memory per cold start (~50 minutes); Drive returns
 * 3600-second tokens, we refresh at 3300 to stay safely inside the window.
 */

const jwt = require('jsonwebtoken');

const CACHE_WINDOW_SECONDS = 3300; // 55 minutes of a 60-minute token
let cachedToken = null;
let cachedExpiry = 0;

/**
 * Returns a fresh access token, reusing an in-memory cache.
 *
 * @param {{serviceAccountEmail: string, privateKey: string}} settings
 * @returns {Promise<string>} access token
 */
async function getGoogleDriveAccessToken(settings) {
  const now = Math.floor(Date.now() / 1000);
  if (cachedToken && cachedExpiry > now + 30) {
    return cachedToken;
  }

  const payload = {
    iss: settings.serviceAccountEmail,
    // `drive` scope (not `drive.file`) — we need to read/write arbitrary
    // folders under the `01_Active-Projects` Shared Drive, not just
    // files the service account created itself.
    scope: 'https://www.googleapis.com/auth/drive',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
  };

  const token = jwt.sign(payload, settings.privateKey, { algorithm: 'RS256' });

  const response = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: token,
    }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to get Google Drive access token: ${response.status} ${text}`);
  }

  const data = await response.json();
  cachedToken = data.access_token;
  cachedExpiry = now + CACHE_WINDOW_SECONDS;
  return cachedToken;
}

/** Force a fresh token on the next call. Useful for tests. */
function clearTokenCache() {
  cachedToken = null;
  cachedExpiry = 0;
}

module.exports = {
  getGoogleDriveAccessToken,
  clearTokenCache,
};
