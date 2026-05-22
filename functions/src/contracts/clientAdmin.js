/**
 * Client admin callables — spec §4.2.
 *
 *   upsertClient   (create + edit; AM only)
 *
 * Clients are the parent's customers; `clients/{clientId}` is a parent-org
 * resource. Layer-2 (CFn) rejection of SUBSIDIARY principals via
 * `assertParentOrgPrincipal`. Firestore writes go through Admin SDK
 * inside the CFn so the strict `clients/{clientId}` (4132) rule's
 * `allow write: if false` is bypassed (the legacy rule at 2144 also
 * allows authenticated writes, but we route through the CFn so the
 * audit / commercial-gravity invariants stay enforced).
 */

const { onCall, HttpsError } = require('firebase-functions/v2/https');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { ALLOWED_ORIGINS } = require('../config/cors');
const { assertParentOrgPrincipal } = require('../assignment/lib/auth');
const { ulid } = require('../platform/ulid');

const PARENT_ORG_ID = 'zeus-group';
const VALID_CURRENCIES = ['UGX', 'USD', 'KES', 'EUR', 'GBP'];

exports.upsertClient = onCall(
  { cors: ALLOWED_ORIGINS, region: 'europe-west1' },
  async (request) => {
    const { uid } = await assertParentOrgPrincipal(request.auth);
    const data = request.data || {};
    const {
      id,
      name,
      code,
      billingCurrency,
      sector,
      status,
      contacts,
      relationshipManagerUserId,
      notes,
    } = data;

    if (!name || typeof name !== 'string') {
      throw new HttpsError('invalid-argument', 'name is required.');
    }
    if (!billingCurrency || !VALID_CURRENCIES.includes(billingCurrency)) {
      throw new HttpsError('invalid-argument', `billingCurrency must be one of ${VALID_CURRENCIES.join(', ')}.`);
    }
    if (contacts && !Array.isArray(contacts)) {
      throw new HttpsError('invalid-argument', 'contacts must be an array.');
    }

    const db = getFirestore();
    const clientId = id || `client_${ulid()}`;
    const ref = db.doc(`clients/${clientId}`);
    const snap = await ref.get();

    const payload = {
      id: clientId,
      parentOrgId: PARENT_ORG_ID,
      name,
      code: code || null,
      billingCurrency,
      sector: sector || null,
      status: status || (snap.exists ? snap.data().status : 'PROSPECT'),
      contacts: contacts || [],
      relationshipManagerUserId: relationshipManagerUserId || null,
      notes: notes || null,
      updatedAt: FieldValue.serverTimestamp(),
      updatedBy: uid,
    };
    if (!snap.exists) {
      payload.createdAt = FieldValue.serverTimestamp();
      payload.createdBy = uid;
    }

    await ref.set(payload, { merge: true });
    return { id: clientId, status: payload.status };
  },
);
