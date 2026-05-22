/**
 * Idempotency-Key handling for billing callables — spec §9.
 *
 * Stores caller-supplied keys in `idempotency_keys/{key}` with the
 * response shape so retries return the prior response byte-for-byte.
 *
 * Cloud-Function callables receive the key in `request.data.idempotencyKey`
 * (the SDK doesn't expose custom headers to onCall). The Firestore rules
 * deny client reads of this collection — only Admin SDK touches it.
 */

const { getFirestore, FieldValue } = require('firebase-admin/firestore');

const TTL_SECONDS = 60 * 60 * 24 * 30; // 30 days; spec doesn't pin, but
                                       // long enough to cover legitimate
                                       // retries / SDK auto-retry windows.

async function readIdempotentResponse(key) {
  if (!key) return null;
  const db = getFirestore();
  const snap = await db.doc(`idempotency_keys/${key}`).get();
  if (!snap.exists) return null;
  const data = snap.data() || {};
  // TTL check — if the stored response is past TTL, treat as miss.
  if (data.expiresAtMs && typeof data.expiresAtMs === 'number' && Date.now() > data.expiresAtMs) {
    return null;
  }
  return data.response ?? null;
}

async function storeIdempotentResponse(key, callableName, response) {
  if (!key) return;
  const db = getFirestore();
  await db.doc(`idempotency_keys/${key}`).set({
    callableName,
    response,
    storedAt: FieldValue.serverTimestamp(),
    expiresAtMs: Date.now() + TTL_SECONDS * 1000,
  });
}

module.exports = { readIdempotentResponse, storeIdempotentResponse };
