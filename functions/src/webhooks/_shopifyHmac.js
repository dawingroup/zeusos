/**
 * Shared HMAC verification for Shopify-originated webhooks.
 *
 * Two flavours, two secrets:
 *
 *   1. Native Shopify webhooks (e.g. customers/create):
 *      Signed by Shopify itself via `X-Shopify-Hmac-Sha256` (base64 HMAC of
 *      the raw body with the *Shopify app's API secret*). Reads
 *      systemConfig/shopifyConfig.apiSecret.
 *
 *   2. Shopify Flow / contact-form bridges (e.g. sample-order, project
 *      enquiry): we control the signing on the Flow side. Custom header
 *      `X-Dawin-Signature: sha256=<hex>` keyed off
 *      systemConfig/shopifyConfig.webhookSecret.
 *
 * Caller must pass `req.rawBody` (Firebase Functions provides this on
 * Express requests).
 */

const crypto = require('crypto');
const { getFirestore } = require('firebase-admin/firestore');

async function getSecrets() {
  const snap = await getFirestore().doc('systemConfig/shopifyConfig').get();
  if (!snap.exists) return { apiSecret: null, webhookSecret: null };
  const d = snap.data();
  return {
    apiSecret: d.apiSecret || null,
    webhookSecret: d.webhookSecret || null,
  };
}

function timingSafeEqual(a, b) {
  if (!a || !b) return false;
  const aBuf = Buffer.from(a);
  const bBuf = Buffer.from(b);
  if (aBuf.length !== bBuf.length) return false;
  return crypto.timingSafeEqual(aBuf, bBuf);
}

/**
 * Verify a Shopify-native HMAC. Returns true if valid.
 */
function verifyShopifyHmac(rawBody, hmacHeader, secret) {
  if (!hmacHeader || !secret || !rawBody) return false;
  const calc = crypto.createHmac('sha256', secret).update(rawBody).digest('base64');
  return timingSafeEqual(calc, hmacHeader);
}

/**
 * Verify a custom X-Dawin-Signature header. Returns true if valid.
 */
function verifyDawinSignature(rawBody, sigHeader, secret) {
  if (!sigHeader || !secret || !rawBody) return false;
  const value = sigHeader.startsWith('sha256=') ? sigHeader.slice(7) : sigHeader;
  const calc = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return timingSafeEqual(calc, value);
}

/**
 * High-level verifier — accepts either signature header.
 *
 * Tries native first (Shopify-signed, keyed off `apiSecret`), then falls
 * back to our custom signed header (Flow-driven, keyed off `webhookSecret`).
 * Returns `{ ok, flavor }` on success, or `{ ok: false, reason }`.
 */
async function verifyRequest(req) {
  const { apiSecret, webhookSecret } = await getSecrets();
  const raw = req.rawBody || (req.body ? Buffer.from(JSON.stringify(req.body)) : null);
  if (!raw) return { ok: false, reason: 'no-raw-body' };

  const shopifyHmac = req.headers['x-shopify-hmac-sha256'];
  if (shopifyHmac) {
    if (!apiSecret) return { ok: false, reason: 'no-api-secret-configured' };
    if (verifyShopifyHmac(raw, shopifyHmac, apiSecret)) return { ok: true, flavor: 'native' };
    return { ok: false, reason: 'bad-shopify-hmac' };
  }

  const dawinSig = req.headers['x-dawin-signature'];
  if (dawinSig) {
    if (!webhookSecret) return { ok: false, reason: 'no-webhook-secret-configured' };
    if (verifyDawinSignature(raw, dawinSig, webhookSecret)) return { ok: true, flavor: 'dawin' };
    return { ok: false, reason: 'bad-dawin-signature' };
  }

  return { ok: false, reason: 'no-signature-header' };
}

module.exports = { verifyRequest, verifyShopifyHmac, verifyDawinSignature };
