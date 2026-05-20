/**
 * QuickBooks OAuth 2.0 Handler
 */

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const crypto = require('crypto');
const { ALLOWED_ORIGINS } = require('../../config/cors');

const QBO_AUTH_URL = 'https://appcenter.intuit.com/connect/oauth2';
const QBO_TOKEN_URL = 'https://oauth.platform.intuit.com/oauth2/v1/tokens/bearer';
const FRONTEND_URL = 'https://dawinos.web.app';

// QuickBooks OAuth credentials (both stored in Secret Manager)
const QUICKBOOKS_CLIENT_ID = defineSecret('QUICKBOOKS_CLIENT_ID');
const QUICKBOOKS_CLIENT_SECRET = defineSecret('QUICKBOOKS_CLIENT_SECRET');
const QUICKBOOKS_REDIRECT_URI = defineString('QUICKBOOKS_REDIRECT_URI');

// Secret for encrypting tokens at rest
const TOKEN_ENCRYPTION_KEY = defineSecret('QBO_TOKEN_ENCRYPTION_KEY');
// Secret for HMAC signing OAuth state
const OAUTH_STATE_SECRET = defineSecret('QBO_OAUTH_STATE_SECRET');

/**
 * Encrypt sensitive data before storing
 */
function encryptToken(plaintext, key) {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', Buffer.from(key, 'hex').slice(0, 32), iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypt sensitive data when retrieving
 */
function decryptToken(ciphertext, key) {
  const [ivHex, authTagHex, encrypted] = ciphertext.split(':');
  const iv = Buffer.from(ivHex, 'hex');
  const authTag = Buffer.from(authTagHex, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', Buffer.from(key, 'hex').slice(0, 32), iv);
  decipher.setAuthTag(authTag);
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

/**
 * Generate HMAC signature for OAuth state
 */
function signState(stateData, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(JSON.stringify(stateData));
  return hmac.digest('hex');
}

/**
 * Verify HMAC signature for OAuth state
 */
function verifyState(stateData, signature, secret) {
  const expectedSignature = signState(stateData, secret);
  return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature));
}

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

function getConfig() {
  const clientId = QUICKBOOKS_CLIENT_ID.value().trim();
  const clientSecret = QUICKBOOKS_CLIENT_SECRET.value().trim();
  const redirectUri = QUICKBOOKS_REDIRECT_URI.value().trim();

  if (!clientId || !clientSecret) {
    throw new Error(
      'QuickBooks credentials not configured. Contact admin to set up QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET.'
    );
  }
  return {
    clientId,
    clientSecret,
    redirectUri,
  };
}

/**
 * Generate OAuth authorization URL
 */
exports.getAuthUrl = onCall({
  cors: ALLOWED_ORIGINS,
  secrets: [OAUTH_STATE_SECRET, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
  params: [QUICKBOOKS_REDIRECT_URI],
}, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  let config;
  try {
    config = getConfig();
  } catch (err) {
    console.error('QuickBooks config error:', err.message);
    throw new HttpsError('failed-precondition', 'QuickBooks credentials not configured. Contact admin to set up QUICKBOOKS_CLIENT_ID and QUICKBOOKS_CLIENT_SECRET.');
  }

  // Create state data with nonce for security
  const stateData = {
    userId: request.auth.uid,
    timestamp: Date.now(),
    nonce: crypto.randomBytes(16).toString('hex'),
  };

  // Sign the state data with HMAC
  const stateSecret = OAUTH_STATE_SECRET.value();
  const signature = signState(stateData, stateSecret);

  // Combine state data and signature
  const signedState = Buffer.from(JSON.stringify({
    data: stateData,
    sig: signature,
  })).toString('base64');

  const params = new URLSearchParams({
    client_id: config.clientId,
    response_type: 'code',
    scope: 'com.intuit.quickbooks.accounting',
    redirect_uri: config.redirectUri,
    state: signedState,
  });

  return {
    url: `${QBO_AUTH_URL}?${params.toString()}`,
  };
});

/**
 * Handle OAuth callback
 */
exports.handleCallback = onRequest({
  secrets: [OAUTH_STATE_SECRET, TOKEN_ENCRYPTION_KEY, QUICKBOOKS_CLIENT_ID, QUICKBOOKS_CLIENT_SECRET],
  params: [QUICKBOOKS_REDIRECT_URI],
}, async (req, res) => {
  const { code, state, realmId, error } = req.query;

  if (error) {
    console.error('QuickBooks OAuth error:', error);
    res.redirect(`${FRONTEND_URL}/settings?qb_error=auth_failed`);
    return;
  }

  if (!code || !state || !realmId) {
    res.redirect(`${FRONTEND_URL}/settings?qb_error=missing_params`);
    return;
  }

  try {
    // Decode and verify signed state
    const signedState = JSON.parse(Buffer.from(state, 'base64').toString());
    const { data: stateData, sig: signature } = signedState;

    if (!stateData || !signature) {
      console.error('Invalid state format: missing data or signature');
      res.redirect(`${FRONTEND_URL}/settings?qb_error=invalid_state`);
      return;
    }

    // Verify HMAC signature
    const stateSecret = OAUTH_STATE_SECRET.value();
    if (!verifyState(stateData, signature, stateSecret)) {
      console.error('State signature verification failed');
      res.redirect(`${FRONTEND_URL}/settings?qb_error=invalid_state`);
      return;
    }

    // Verify state is not too old (max 10 minutes)
    const stateAge = Date.now() - stateData.timestamp;
    if (stateAge > 10 * 60 * 1000) {
      console.error('State expired:', stateAge);
      res.redirect(`${FRONTEND_URL}/settings?qb_error=state_expired`);
      return;
    }

    const { userId } = stateData;

    // Exchange code for tokens
    const config = getConfig();
    const tokenResponse = await fetch(QBO_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: config.redirectUri,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      throw new Error(`Token exchange failed: ${errorText}`);
    }

    const tokens = await tokenResponse.json();

    // Encrypt tokens before storing
    const encryptionKey = TOKEN_ENCRYPTION_KEY.value();
    const encryptedAccessToken = encryptToken(tokens.access_token, encryptionKey);
    const encryptedRefreshToken = encryptToken(tokens.refresh_token, encryptionKey);

    // Store encrypted tokens in Firestore
    await db.collection('integrations').doc('quickbooks').set({
      access_token_encrypted: encryptedAccessToken,
      refresh_token_encrypted: encryptedRefreshToken,
      expires_in: tokens.expires_in,
      token_type: tokens.token_type,
      x_refresh_token_expires_in: tokens.x_refresh_token_expires_in,
      realm_id: realmId,
      created_at: Date.now(),
      connected_by: userId,
      connected_at: admin.firestore.FieldValue.serverTimestamp(),
      tokens_encrypted: true,  // Flag to indicate tokens are encrypted
      isConnected: true,  // Required by all QBO trigger functions
    });

    console.log('QuickBooks connected successfully with encrypted tokens');
    res.redirect(`${FRONTEND_URL}/settings?qb_success=true`);
  } catch (err) {
    console.error('QuickBooks callback error:', err);
    res.redirect(`${FRONTEND_URL}/settings?qb_error=token_exchange`);
  }
});

/**
 * Refresh access token
 * Note: This function requires TOKEN_ENCRYPTION_KEY secret to be available
 * It should only be called from Cloud Functions that have the secret configured
 */
async function refreshTokens(encryptionKey) {
  const doc = await db.collection('integrations').doc('quickbooks').get();
  if (!doc.exists) {
    throw new Error('QuickBooks not connected');
  }

  const storedData = doc.data();
  const config = getConfig();

  // Self-healing: backfill isConnected if missing (fixes pre-fix OAuth connections)
  if (!storedData.isConnected) {
    await db.collection('integrations').doc('quickbooks').update({ isConnected: true });
    console.log('[Auth] Backfilled isConnected: true on QuickBooks integration doc');
  }

  // Check if token needs refresh (expires in less than 5 minutes)
  const expiresAt = storedData.created_at + storedData.expires_in * 1000;
  if (Date.now() < expiresAt - 5 * 60 * 1000) {
    // Decrypt and return current tokens
    if (storedData.tokens_encrypted && encryptionKey) {
      return {
        access_token: decryptToken(storedData.access_token_encrypted, encryptionKey),
        refresh_token: decryptToken(storedData.refresh_token_encrypted, encryptionKey),
        realm_id: storedData.realm_id,
        expires_in: storedData.expires_in,
      };
    }
    // Legacy unencrypted tokens (migration needed)
    return storedData;
  }

  // Decrypt refresh token to use it
  let refreshToken;
  if (storedData.tokens_encrypted && encryptionKey) {
    refreshToken = decryptToken(storedData.refresh_token_encrypted, encryptionKey);
  } else {
    refreshToken = storedData.refresh_token;
  }

  // Refresh the token
  const response = await fetch(QBO_TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Authorization': `Basic ${Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')}`,
    },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Token refresh failed: ${errorText}`);
  }

  const newTokens = await response.json();

  // Encrypt new tokens if encryption key is available
  if (encryptionKey) {
    const encryptedAccessToken = encryptToken(newTokens.access_token, encryptionKey);
    const encryptedRefreshToken = encryptToken(newTokens.refresh_token, encryptionKey);

    await db.collection('integrations').doc('quickbooks').update({
      access_token_encrypted: encryptedAccessToken,
      refresh_token_encrypted: encryptedRefreshToken,
      expires_in: newTokens.expires_in,
      x_refresh_token_expires_in: newTokens.x_refresh_token_expires_in,
      realm_id: storedData.realm_id,
      created_at: Date.now(),
      tokens_encrypted: true,
    });

    return {
      access_token: newTokens.access_token,
      refresh_token: newTokens.refresh_token,
      realm_id: storedData.realm_id,
      expires_in: newTokens.expires_in,
    };
  }

  // Legacy path (should migrate to encrypted)
  const updatedTokens = {
    ...newTokens,
    realm_id: storedData.realm_id,
    created_at: Date.now(),
  };

  await db.collection('integrations').doc('quickbooks').update(updatedTokens);

  return updatedTokens;
}

exports.refreshTokens = refreshTokens;
exports.decryptToken = decryptToken;
exports.TOKEN_ENCRYPTION_KEY = TOKEN_ENCRYPTION_KEY;
exports.QUICKBOOKS_CLIENT_ID = QUICKBOOKS_CLIENT_ID;
exports.QUICKBOOKS_CLIENT_SECRET = QUICKBOOKS_CLIENT_SECRET;

/**
 * Check connection status
 */
exports.checkConnection = onCall({ cors: ALLOWED_ORIGINS }, async (request) => {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'User must be authenticated');
  }

  try {
    const doc = await db.collection('integrations').doc('quickbooks').get();
    if (!doc.exists) {
      return { connected: false };
    }

    const tokens = doc.data();
    const refreshExpiresAt = tokens.created_at + tokens.x_refresh_token_expires_in * 1000;

    return {
      connected: true,
      realmId: tokens.realm_id,
      refreshTokenValid: Date.now() < refreshExpiresAt,
    };
  } catch (err) {
    return { connected: false, error: 'Failed to check connection' };
  }
});
