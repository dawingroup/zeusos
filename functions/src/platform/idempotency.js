/**
 * Idempotency helper — wraps a Firestore transaction body so retries
 * with the same `Idempotency-Key` return the cached response without
 * re-executing the txn.
 *
 * Spec §9 / §11.7 / §12. Storage at `idempotency_keys/{key}`.
 *
 * Usage:
 *   const result = await withIdempotency(db, {
 *     key: request.data.idempotencyKey,   // optional; if absent, skip cache
 *     endpoint: 'issueWorkOrder',
 *   }, async (tx, recordCache) => {
 *     // do work inside tx ...
 *     const response = { iwoId, status: 'ISSUED' };
 *     recordCache(response);
 *     return response;
 *   });
 *
 * The `recordCache` callback writes the cache row inside the same
 * transaction so we never end up with a "did the work but lost the
 * cache" inconsistency. TTL is enforced by a separate sweeper (not in
 * scope for 3.B); records auto-stamp `expiresAt = now + 24h`.
 */

const { HttpsError } = require('firebase-functions/v2/https');
const { FieldValue } = require('firebase-admin/firestore');

const IDEMPOTENCY_TTL_HOURS = 24;
const IDEMPOTENCY_COLLECTION = 'idempotency_keys';

class IdempotencyConflictError extends Error {
  constructor(message) {
    super(message);
    this.code = 'IDEMPOTENCY_CONFLICT';
  }
}

/**
 * Reads the cache row before the txn body and short-circuits if present.
 * If absent, runs the body inside a transaction and writes the cache row
 * atomically. The body must call `recordCache(response)` to mark which
 * response should be cached.
 *
 * @param {FirebaseFirestore.Firestore} db
 * @param {{ key?: string, endpoint: string }} ctx
 * @param {(tx: FirebaseFirestore.Transaction, recordCache: (resp:any)=>void) => Promise<any>} body
 */
async function withIdempotency(db, ctx, body) {
  const { key, endpoint } = ctx;
  if (!key || typeof key !== 'string' || key.length < 8) {
    // No idempotency key — run without cache. Caller already validated if required.
    return db.runTransaction(async (tx) => {
      let _cached = null;
      const recordCache = (resp) => { _cached = resp; };
      const out = await body(tx, recordCache);
      return out !== undefined ? out : _cached;
    });
  }

  const cacheRef = db.collection(IDEMPOTENCY_COLLECTION).doc(key);

  return db.runTransaction(async (tx) => {
    const existing = await tx.get(cacheRef);
    if (existing.exists) {
      const cached = existing.data();
      if (cached.endpoint !== endpoint) {
        // Same key reused across unrelated endpoints — reject loud per
        // Stripe semantics. Surfaced as 409 by Cloud Functions.
        throw new IdempotencyConflictError(
          `Idempotency-Key ${key} previously used for endpoint ${cached.endpoint}, not ${endpoint}.`,
        );
      }
      // Cache hit — return the cached response without re-running work.
      try {
        return JSON.parse(cached.responseJson);
      } catch (e) {
        return cached.responseJson; // best-effort
      }
    }
    let _cached;
    const recordCache = (resp) => { _cached = resp; };
    const result = await body(tx, recordCache);
    const cachedValue = _cached !== undefined ? _cached : result;
    const expiresAt = new Date(Date.now() + IDEMPOTENCY_TTL_HOURS * 60 * 60 * 1000);
    tx.set(cacheRef, {
      key,
      endpoint,
      responseJson: JSON.stringify(cachedValue),
      responseStatus: 200,
      createdAt: FieldValue.serverTimestamp(),
      expiresAt,
    });
    return cachedValue;
  });
}

/**
 * Convert our internal errors to HttpsError. The runtime-level error
 * mapping all callables use — keeps the catch blocks tiny.
 */
function toHttpsError(err) {
  if (err instanceof HttpsError) return err;
  if (err && err.code === 'IDEMPOTENCY_CONFLICT') {
    return new HttpsError('aborted', err.message);
  }
  if (err && err.code === 'CEILING_EXCEEDED') {
    return new HttpsError('aborted', err.message, { code: 'CEILING_EXCEEDED', ...err.details });
  }
  if (err && err.code === 'BUDGET_EXCEEDED') {
    return new HttpsError('failed-precondition', err.message, { code: 'BUDGET_EXCEEDED', ...err.details });
  }
  if (err && err.code === 'HANDOFF_PACKET_INCOMPLETE') {
    return new HttpsError('failed-precondition', err.message, { code: 'HANDOFF_PACKET_INCOMPLETE', errors: err.errors });
  }
  if (err && err.code === 'INVALID_STATE_TRANSITION') {
    return new HttpsError('failed-precondition', err.message, { code: 'INVALID_STATE_TRANSITION', from: err.from, event: err.event });
  }
  // Default — let it surface as 'unknown'.
  return new HttpsError('internal', err && err.message ? err.message : String(err));
}

module.exports = {
  withIdempotency,
  toHttpsError,
  IdempotencyConflictError,
  IDEMPOTENCY_COLLECTION,
  IDEMPOTENCY_TTL_HOURS,
};
