/**
 * Meta OAuth 2.0 — Facebook + Instagram Business publishing
 *
 * Flow:
 *   1. Client calls metaOAuthStart({ socialMediaAccountId }) → returns Facebook Login URL
 *   2. User authorizes; Meta redirects to metaOAuthCallback with code + signed state
 *   3. metaOAuthCallback exchanges code for long-lived user token, derives Page tokens,
 *      encrypts them, and stores at integrations/social/{socialMediaAccountId}.
 *   4. metaDisconnect({ socialMediaAccountId }) deletes the token doc.
 *
 * AES-256-GCM encryption mirrors functions/src/integrations/quickbooks/auth.js so the
 * same security review applies.
 */

const { onCall, onRequest, HttpsError } = require('firebase-functions/v2/https');
const { defineSecret, defineString } = require('firebase-functions/params');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const fetch = require('node-fetch');
const crypto = require('crypto');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const META_GRAPH_VERSION = 'v20.0';
const META_BASE_URL = `https://graph.facebook.com/${META_GRAPH_VERSION}`;
const FB_LOGIN_DIALOG_URL = `https://www.facebook.com/${META_GRAPH_VERSION}/dialog/oauth`;

const META_APP_ID = defineSecret('META_APP_ID');
const META_APP_SECRET = defineSecret('META_APP_SECRET');
const META_OAUTH_STATE_SECRET = defineSecret('META_OAUTH_STATE_SECRET');
const SOCIAL_TOKEN_ENCRYPTION_KEY = defineSecret('SOCIAL_TOKEN_ENCRYPTION_KEY');
const META_OAUTH_REDIRECT_URI = defineString('META_OAUTH_REDIRECT_URI', {
  default: 'https://dawinos.web.app/marketing/accounts/oauth/meta/callback',
});

const META_SCOPES = [
  'pages_show_list',
  'pages_read_engagement',
  'pages_manage_posts',
  'instagram_basic',
  'instagram_content_publish',
  'business_management',
];

// ─── Crypto helpers (AES-256-GCM) ──────────────────────────────────────────

function getEncryptionKey(hex) {
  const buf = Buffer.from(hex, 'hex');
  if (buf.length < 32) {
    throw new Error('SOCIAL_TOKEN_ENCRYPTION_KEY must be at least 32 bytes (64 hex chars)');
  }
  return buf.slice(0, 32);
}

function encryptToken(plaintext, keyHex) {
  const key = getEncryptionKey(keyHex);
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  let encrypted = cipher.update(plaintext, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  const authTag = cipher.getAuthTag().toString('hex');
  return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

function decryptToken(payload, keyHex) {
  const key = getEncryptionKey(keyHex);
  const [ivHex, authTagHex, encrypted] = payload.split(':');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(authTagHex, 'hex'));
  let decrypted = decipher.update(encrypted, 'hex', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

// ─── State helpers ─────────────────────────────────────────────────────────

function signState(payload, secret) {
  const json = JSON.stringify(payload);
  const data = Buffer.from(json).toString('base64url');
  const sig = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  return `${data}.${sig}`;
}

function verifyState(state, secret) {
  const [data, sig] = String(state || '').split('.');
  if (!data || !sig) return null;
  const expected = crypto.createHmac('sha256', secret).update(data).digest('base64url');
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;
  try {
    return JSON.parse(Buffer.from(data, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

// ─── 1. Start OAuth ────────────────────────────────────────────────────────

const metaOAuthStart = onCall(
  {
    secrets: [META_APP_ID, META_OAUTH_STATE_SECRET],
    cors: true,
    timeoutSeconds: 30,
    memory: '256MiB',
  },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }
    const { socialMediaAccountId } = request.data || {};
    if (!socialMediaAccountId) {
      throw new HttpsError('invalid-argument', 'socialMediaAccountId is required');
    }

    const accountSnap = await db
      .collection('socialMediaAccounts')
      .doc(socialMediaAccountId)
      .get();
    if (!accountSnap.exists) {
      throw new HttpsError('not-found', 'Social account not found');
    }

    const state = signState(
      {
        accountId: socialMediaAccountId,
        uid: request.auth.uid,
        ts: Date.now(),
      },
      META_OAUTH_STATE_SECRET.value()
    );

    const url = new URL(FB_LOGIN_DIALOG_URL);
    url.searchParams.set('client_id', META_APP_ID.value());
    url.searchParams.set('redirect_uri', META_OAUTH_REDIRECT_URI.value());
    url.searchParams.set('scope', META_SCOPES.join(','));
    url.searchParams.set('response_type', 'code');
    url.searchParams.set('state', state);

    return { authUrl: url.toString() };
  }
);

// ─── 2. OAuth callback (handled server-side via onRequest) ──────────────────

async function exchangeCodeForToken(code, appId, appSecret) {
  const url = new URL(`${META_BASE_URL}/oauth/access_token`);
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('redirect_uri', META_OAUTH_REDIRECT_URI.value());
  url.searchParams.set('code', code);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`Token exchange failed: ${JSON.stringify(json)}`);
  }
  return json;
}

async function exchangeForLongLivedToken(shortToken, appId, appSecret) {
  const url = new URL(`${META_BASE_URL}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', appId);
  url.searchParams.set('client_secret', appSecret);
  url.searchParams.set('fb_exchange_token', shortToken);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok || !json.access_token) {
    throw new Error(`Long-lived token exchange failed: ${JSON.stringify(json)}`);
  }
  return json; // { access_token, token_type, expires_in (seconds, ~5184000) }
}

async function fetchUserPages(longLivedToken) {
  // Returns an array of { id, name, access_token, instagram_business_account?: { id } }
  const url = new URL(`${META_BASE_URL}/me/accounts`);
  url.searchParams.set('access_token', longLivedToken);
  url.searchParams.set('fields', 'id,name,access_token,instagram_business_account{id,username,profile_picture_url}');
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok) {
    throw new Error(`Failed to list pages: ${JSON.stringify(json)}`);
  }
  return json.data || [];
}

// Used by the data-deletion callback to look up which accounts a given
// Meta user authorized. Stored at connect time so we can resolve user_id
// → account docs without keeping a live token around.
async function fetchMetaUserId(longLivedToken) {
  const url = new URL(`${META_BASE_URL}/me`);
  url.searchParams.set('fields', 'id');
  url.searchParams.set('access_token', longLivedToken);
  const res = await fetch(url.toString());
  const json = await res.json();
  if (!res.ok || !json.id) {
    throw new Error(`Failed to fetch Meta user id: ${JSON.stringify(json)}`);
  }
  return String(json.id);
}

function htmlResponse(status, message) {
  return `<!DOCTYPE html><html><head><title>Meta OAuth ${status}</title>
<style>body{font-family:system-ui;background:#0f0f0f;color:#eee;display:flex;align-items:center;justify-content:center;height:100vh;margin:0}</style></head>
<body><div style="text-align:center"><h1 style="font-size:18px;font-weight:600">${status === 'ok' ? 'Connected.' : 'Connection failed.'}</h1>
<p style="font-size:13px;color:#aaa;max-width:340px">${message}</p>
<p style="font-size:12px;color:#666">You can close this window.</p></div>
<script>
  try { window.opener && window.opener.postMessage({source:'dawinos-meta-oauth',status:${JSON.stringify(status)},message:${JSON.stringify(message)}}, '*'); } catch(e) {}
  setTimeout(function(){ try { window.close(); } catch(e) {} }, 1200);
</script></body></html>`;
}

const metaOAuthCallback = onRequest(
  {
    secrets: [META_APP_ID, META_APP_SECRET, META_OAUTH_STATE_SECRET, SOCIAL_TOKEN_ENCRYPTION_KEY],
    timeoutSeconds: 60,
    memory: '256MiB',
    cors: false,
  },
  async (req, res) => {
    const code = req.query.code;
    const stateRaw = req.query.state;
    const errorParam = req.query.error_description || req.query.error;
    if (errorParam) {
      res.status(400).send(htmlResponse('error', `Meta declined: ${errorParam}`));
      return;
    }
    if (!code || !stateRaw) {
      res.status(400).send(htmlResponse('error', 'Missing code or state'));
      return;
    }

    const state = verifyState(stateRaw, META_OAUTH_STATE_SECRET.value());
    if (!state || !state.accountId) {
      res.status(400).send(htmlResponse('error', 'Invalid OAuth state'));
      return;
    }
    if (Date.now() - state.ts > 10 * 60 * 1000) {
      res.status(400).send(htmlResponse('error', 'OAuth state expired'));
      return;
    }

    try {
      const accountSnap = await db.collection('socialMediaAccounts').doc(state.accountId).get();
      if (!accountSnap.exists) {
        res.status(404).send(htmlResponse('error', 'Social account no longer exists'));
        return;
      }
      const account = accountSnap.data();

      const shortToken = await exchangeCodeForToken(code, META_APP_ID.value(), META_APP_SECRET.value());
      const longLived = await exchangeForLongLivedToken(
        shortToken.access_token,
        META_APP_ID.value(),
        META_APP_SECRET.value()
      );

      const pages = await fetchUserPages(longLived.access_token);
      if (pages.length === 0) {
        res.status(400).send(htmlResponse('error', 'No Facebook Pages found on your account'));
        return;
      }

      // Record the Meta-issued user_id so the data-deletion callback can find
      // this account when Meta later posts a deletion notice for that user.
      let connectedByMetaUserId = null;
      try {
        connectedByMetaUserId = await fetchMetaUserId(longLived.access_token);
      } catch (err) {
        logger.warn('[metaOAuthCallback] could not fetch meta user_id; deletion callback may miss this account', err);
      }

      // Match the page to the SocialMediaAccount by platform + handle/url.
      // For Instagram, match by instagram_business_account.username; for FB, by Page id or name.
      let match = null;
      for (const page of pages) {
        if (account.platform === 'instagram' && page.instagram_business_account) {
          // We can't be sure of the IG handle case-sensitivity, so match loosely
          match = page;
          break;
        }
        if (account.platform === 'facebook') {
          if (
            (account.platformAccountId && page.id === account.platformAccountId) ||
            (account.handle && page.name.toLowerCase().includes(String(account.handle).toLowerCase())) ||
            (!account.platformAccountId && pages.length === 1)
          ) {
            match = page;
            break;
          }
        }
      }
      if (!match) {
        // Fall back to first page; better to connect *something* than fail completely.
        match = pages[0];
      }

      const platformAccountId =
        account.platform === 'instagram' ? match.instagram_business_account?.id : match.id;
      if (!platformAccountId) {
        res.status(400).send(
          htmlResponse(
            'error',
            account.platform === 'instagram'
              ? 'The matched Page has no Instagram Business account linked.'
              : 'Could not resolve Page ID.'
          )
        );
        return;
      }

      const encKey = SOCIAL_TOKEN_ENCRYPTION_KEY.value();
      const tokenDoc = {
        accountId: state.accountId,
        platform: account.platform,
        platformAccountId,
        pageId: match.id,
        pageName: match.name,
        userTokenEncrypted: encryptToken(longLived.access_token, encKey),
        userTokenExpiresAt: admin.firestore.Timestamp.fromMillis(
          Date.now() + (longLived.expires_in || 5184000) * 1000
        ),
        pageTokenEncrypted: encryptToken(match.access_token, encKey),
        scopes: META_SCOPES,
        connectedAt: admin.firestore.FieldValue.serverTimestamp(),
        connectedBy: state.uid,
        connectedByMetaUserId,
      };

      await db
        .collection('integrations')
        .doc('social')
        .collection('accounts')
        .doc(state.accountId)
        .set(tokenDoc, { merge: true });

      await db.collection('socialMediaAccounts').doc(state.accountId).update({
        status: 'oauth_connected',
        oauthEnabled: true,
        platformAccountId,
        connectedByMetaUserId,
        lastSyncError: admin.firestore.FieldValue.delete(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      res.status(200).send(htmlResponse('ok', `${match.name} is now publish-ready.`));
    } catch (err) {
      logger.error('[metaOAuthCallback] failed', err);
      res.status(500).send(htmlResponse('error', err?.message || 'Unexpected error'));
    }
  }
);

// ─── 3. Disconnect ──────────────────────────────────────────────────────────

const metaDisconnect = onCall(
  { cors: true, timeoutSeconds: 30, memory: '256MiB' },
  async (request) => {
    if (!request.auth) {
      throw new HttpsError('unauthenticated', 'Authentication required');
    }
    const { socialMediaAccountId } = request.data || {};
    if (!socialMediaAccountId) {
      throw new HttpsError('invalid-argument', 'socialMediaAccountId is required');
    }

    await db
      .collection('integrations')
      .doc('social')
      .collection('accounts')
      .doc(socialMediaAccountId)
      .delete()
      .catch(() => {});

    await db.collection('socialMediaAccounts').doc(socialMediaAccountId).update({
      status: 'tracking',
      oauthEnabled: false,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    return { ok: true };
  }
);

// ─── Token decryption helper for other modules ─────────────────────────────

async function getDecryptedTokenForAccount(accountId, encKey) {
  const snap = await db
    .collection('integrations')
    .doc('social')
    .collection('accounts')
    .doc(accountId)
    .get();
  if (!snap.exists) {
    throw new Error(`No OAuth token found for account ${accountId}`);
  }
  const data = snap.data();
  return {
    platform: data.platform,
    platformAccountId: data.platformAccountId,
    pageId: data.pageId,
    pageName: data.pageName,
    userAccessToken: decryptToken(data.userTokenEncrypted, encKey),
    pageAccessToken: data.pageTokenEncrypted
      ? decryptToken(data.pageTokenEncrypted, encKey)
      : null,
    userTokenExpiresAt: data.userTokenExpiresAt?.toDate?.() || null,
  };
}

module.exports = {
  metaOAuthStart,
  metaOAuthCallback,
  metaDisconnect,
  // Internal helpers for publish.js + socialPublisher.js
  getDecryptedTokenForAccount,
  encryptToken,
  decryptToken,
  META_BASE_URL,
  META_APP_ID,
  META_APP_SECRET,
  META_OAUTH_STATE_SECRET,
  SOCIAL_TOKEN_ENCRYPTION_KEY,
  META_OAUTH_REDIRECT_URI,
};
