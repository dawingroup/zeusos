/**
 * Adobe Token Service - OAuth Server-to-Server
 *
 * Generates and caches OAuth access tokens for Adobe PDF Services API.
 * Uses Firebase secrets for secure credential storage.
 *
 * @see https://developer.adobe.com/developer-console/docs/guides/authentication/ServerToServerAuthentication/
 */

const { defineSecret } = require('firebase-functions/params');
const { logger } = require('firebase-functions');

// Define secrets for Adobe credentials (OAuth Server-to-Server)
const ADOBE_CLIENT_ID = defineSecret('ADOBE_CLIENT_ID');
const ADOBE_CLIENT_SECRET = defineSecret('ADOBE_CLIENT_SECRET');
const ADOBE_ORG_ID = defineSecret('ADOBE_ORG_ID');

// Token cache (in-memory, per function instance)
let cachedToken = null;
let tokenExpiresAt = 0;

// Adobe IMS OAuth endpoint
const ADOBE_IMS_TOKEN_URL = 'https://ims-na1.adobelogin.com/ims/token/v3';

// Token validity buffer (refresh 5 minutes before expiry)
const TOKEN_BUFFER_MS = 5 * 60 * 1000;

/**
 * Get the required secrets for Adobe operations (Gen 2 - defineSecret objects)
 * This function is used to declare secrets needed by dependent functions
 */
function getAdobeSecrets() {
  return [
    ADOBE_CLIENT_ID,
    ADOBE_CLIENT_SECRET,
    ADOBE_ORG_ID,
  ];
}

/**
 * Get the required secrets for Adobe operations (Gen 1 - string names)
 * Used with functions.runWith({ secrets: [...] })
 */
function getAdobeSecretsV1() {
  return [
    'ADOBE_CLIENT_ID',
    'ADOBE_CLIENT_SECRET',
    'ADOBE_ORG_ID',
  ];
}

/**
 * Get OAuth access token from Adobe IMS
 *
 * @returns {Promise<{accessToken: string, expiresIn: number}>}
 */
async function fetchAccessToken() {
  const clientId = ADOBE_CLIENT_ID.value();
  const clientSecret = ADOBE_CLIENT_SECRET.value();

  // Log for debugging (masked)
  logger.info('Adobe OAuth request', {
    clientIdLength: clientId?.length,
    clientSecretLength: clientSecret?.length,
    clientIdPrefix: clientId?.substring(0, 8),
  });

  // Use URLSearchParams with explicit append to ensure proper encoding
  const params = new URLSearchParams();
  params.append('grant_type', 'client_credentials');
  params.append('client_id', clientId);
  params.append('client_secret', clientSecret);
  params.append('scope', 'openid,AdobeID,DCAPI');

  const response = await fetch(ADOBE_IMS_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    logger.error('Adobe OAuth token request failed', {
      status: response.status,
      error: errorText,
    });
    throw new Error(`Adobe OAuth token request failed: ${response.status} - ${errorText}`);
  }

  const data = await response.json();

  return {
    accessToken: data.access_token,
    expiresIn: data.expires_in * 1000, // Convert seconds to ms
  };
}

/**
 * Get a valid Adobe access token
 * Uses caching to avoid unnecessary token requests
 *
 * @returns {Promise<string>} Valid access token
 */
async function getAccessToken() {
  const now = Date.now();

  // Return cached token if still valid
  if (cachedToken && tokenExpiresAt > now + TOKEN_BUFFER_MS) {
    logger.debug('Using cached Adobe access token');
    return cachedToken;
  }

  logger.info('Fetching new Adobe OAuth access token');

  try {
    const { accessToken, expiresIn } = await fetchAccessToken();

    // Cache the token
    cachedToken = accessToken;
    tokenExpiresAt = now + expiresIn - TOKEN_BUFFER_MS;

    logger.info('Adobe OAuth access token refreshed successfully');
    return accessToken;
  } catch (error) {
    logger.error('Failed to get Adobe access token', error);
    throw error;
  }
}

/**
 * Clear the cached token (useful for testing or forced refresh)
 */
function clearTokenCache() {
  cachedToken = null;
  tokenExpiresAt = 0;
  logger.info('Adobe token cache cleared');
}

/**
 * Check if Adobe credentials are configured
 *
 * @returns {boolean} True if all required secrets are available
 */
function isAdobeConfigured() {
  try {
    return !!(
      ADOBE_CLIENT_ID.value() &&
      ADOBE_CLIENT_SECRET.value() &&
      ADOBE_ORG_ID.value()
    );
  } catch {
    return false;
  }
}

/**
 * Get Adobe API configuration
 *
 * @returns {Object} Configuration object for Adobe API calls
 */
function getAdobeConfig() {
  return {
    clientId: ADOBE_CLIENT_ID.value(),
    orgId: ADOBE_ORG_ID.value(),
    pdfServicesBaseUrl: 'https://pdf-services.adobe.io',
    extractApiUrl: 'https://pdf-services.adobe.io/operation/extractpdf',
    createPdfUrl: 'https://pdf-services.adobe.io/operation/createpdf',
    exportPdfUrl: 'https://pdf-services.adobe.io/operation/exportpdf',
    combinePdfUrl: 'https://pdf-services.adobe.io/operation/combinepdf',
    splitPdfUrl: 'https://pdf-services.adobe.io/operation/splitpdf',
    ocrPdfUrl: 'https://pdf-services.adobe.io/operation/ocr',
    compressPdfUrl: 'https://pdf-services.adobe.io/operation/compresspdf',
    protectPdfUrl: 'https://pdf-services.adobe.io/operation/protectpdf',
    linearizePdfUrl: 'https://pdf-services.adobe.io/operation/linearizepdf',
    watermarkPdfUrl: 'https://pdf-services.adobe.io/operation/pdfwatermark',
    deletePagesPdfUrl: 'https://pdf-services.adobe.io/operation/deletepages',
    rotatePagesUrl: 'https://pdf-services.adobe.io/operation/rotatepages',
    reorderPagesUrl: 'https://pdf-services.adobe.io/operation/reorderpages',
  };
}

module.exports = {
  getAccessToken,
  clearTokenCache,
  isAdobeConfigured,
  getAdobeConfig,
  getAdobeSecrets,
  getAdobeSecretsV1,
};
