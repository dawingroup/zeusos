/**
 * Meta User Data Deletion Callback
 *
 * Meta requires every app that holds user data to expose a deletion URL that
 * accepts a signed_request, removes the user's data, and returns a
 * confirmation URL + code. This endpoint satisfies that requirement for the
 * DawinOS Marketing → Social Publishing feature.
 *
 * Pasted into Facebook App Settings → Basic → User Data Deletion.
 *
 * Request:  POST /metaDataDeletionCallback  (form-encoded)
 *           signed_request=<base64url(sig)>.<base64url(payload)>
 * Response: 200 { url, confirmation_code }
 *
 * The signed_request format is documented at:
 * https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 */

const { onRequest } = require('firebase-functions/v2/https');
const { logger } = require('firebase-functions');
const admin = require('firebase-admin');
const crypto = require('crypto');

const {
  META_APP_SECRET,
} = require('./auth');

if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();

const PUBLIC_BASE_URL = 'https://dawinos.web.app';

function base64UrlDecode(input) {
  const pad = input.length % 4 === 0 ? '' : '='.repeat(4 - (input.length % 4));
  return Buffer.from(input.replace(/-/g, '+').replace(/_/g, '/') + pad, 'base64');
}

function parseSignedRequest(signedRequest, appSecret) {
  if (typeof signedRequest !== 'string' || !signedRequest.includes('.')) {
    return null;
  }
  const [encodedSig, encodedPayload] = signedRequest.split('.', 2);
  if (!encodedSig || !encodedPayload) return null;

  let sig;
  try {
    sig = base64UrlDecode(encodedSig);
  } catch {
    return null;
  }

  const expected = crypto
    .createHmac('sha256', appSecret)
    .update(encodedPayload)
    .digest();

  if (sig.length !== expected.length) return null;
  if (!crypto.timingSafeEqual(sig, expected)) return null;

  let payload;
  try {
    payload = JSON.parse(base64UrlDecode(encodedPayload).toString('utf8'));
  } catch {
    return null;
  }

  if (!payload || typeof payload !== 'object') return null;
  if (payload.algorithm && payload.algorithm.toUpperCase() !== 'HMAC-SHA256') {
    return null;
  }
  return payload;
}

async function deleteAccountsForMetaUser(metaUserId) {
  const snap = await db
    .collection('socialMediaAccounts')
    .where('connectedByMetaUserId', '==', metaUserId)
    .get();

  const accountIds = [];
  const accountDisplayNames = [];

  if (snap.empty) {
    return { accountIds, accountDisplayNames };
  }

  const batch = db.batch();
  for (const doc of snap.docs) {
    const data = doc.data() || {};
    accountIds.push(doc.id);
    const displayName =
      data.displayName ||
      data.handle ||
      data.platformAccountId ||
      doc.id;
    accountDisplayNames.push(String(displayName));

    const tokenRef = db
      .collection('integrations')
      .doc('social')
      .collection('accounts')
      .doc(doc.id);
    batch.delete(tokenRef);

    batch.update(doc.ref, {
      status: 'tracking',
      oauthEnabled: false,
      lastSyncError: 'Disconnected via Meta deletion callback',
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  }
  await batch.commit();

  return { accountIds, accountDisplayNames };
}

const metaDataDeletionCallback = onRequest(
  {
    secrets: [META_APP_SECRET],
    timeoutSeconds: 60,
    memory: '256MiB',
    cors: false,
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      res.set('Allow', 'POST');
      res.status(405).json({ error: 'method_not_allowed' });
      return;
    }

    const signedRequest =
      (req.body && req.body.signed_request) ||
      (req.query && req.query.signed_request);

    if (!signedRequest) {
      res.status(400).json({ error: 'missing_signed_request' });
      return;
    }

    const payload = parseSignedRequest(signedRequest, META_APP_SECRET.value());
    if (!payload || !payload.user_id) {
      logger.warn('[metaDataDeletionCallback] invalid signed_request');
      res.status(400).json({ error: 'invalid_signed_request' });
      return;
    }

    const metaUserId = String(payload.user_id);
    const ticketId = crypto.randomBytes(16).toString('hex');

    try {
      const { accountIds, accountDisplayNames } = await deleteAccountsForMetaUser(metaUserId);

      const requestedAt = admin.firestore.FieldValue.serverTimestamp();
      await db.collection('dataDeletionRequests').doc(ticketId).set({
        ticketId,
        source: 'meta',
        metaUserId,
        accountIds,
        accountDisplayNames,
        requestedAt,
        completedAt: requestedAt,
        status: 'completed',
      });

      await db.collection('publicDataDeletionTickets').doc(ticketId).set({
        ticketId,
        completedAt: requestedAt,
        accountDisplayNames,
      });

      logger.info('[metaDataDeletionCallback] completed', {
        ticketId,
        metaUserId,
        accountCount: accountIds.length,
      });

      res.status(200).json({
        url: `${PUBLIC_BASE_URL}/privacy/data-deletion?ticket=${ticketId}`,
        confirmation_code: `DAWINOS-${ticketId}`,
      });
    } catch (err) {
      logger.error('[metaDataDeletionCallback] failed', err);
      res.status(500).json({ error: 'internal_error' });
    }
  }
);

module.exports = {
  metaDataDeletionCallback,
  // Exposed for tests / local invocation.
  parseSignedRequest,
};
