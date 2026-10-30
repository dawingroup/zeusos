/**
 * Who may start anything on the AI layer — internal staff only.
 *
 * The AI callables run on the Admin SDK, so the rules never see the caller, and
 * they used to check only `request.auth`, which an anonymous client-portal
 * session passes. Staff is decided the one way the market-intelligence gate
 * decides "may view": not anonymous, and an active staff profile, an executive
 * claim, or a super-user. A second definition here would drift from it.
 *
 * Ported from DawinOS auth/staffGate.js (docs/PROMPT_INJECTION in that repo,
 * findings #3, #8-#10). `onAiCall` applies it to every AI callable at once.
 */
'use strict';

const { HttpsError } = require('firebase-functions/v2/https');
const { loadUserDoc: loadUserDocFromFirestore } = require('../assignment/lib/auth');
const { marketIntelAllows } = require('../lib/marketIntelGate');

/** Pure policy: is the principal `{ token, user }` internal staff? */
function isStaffPrincipal(principal) {
  return marketIntelAllows(principal, 'view');
}

/**
 * Throws `unauthenticated` without a sign-in and `permission-denied` for a
 * portal identity or anyone without an active staff profile. Call it BEFORE any
 * read, model call or rate-limit write. `deps.loadUserDoc` is for tests.
 */
async function assertStaffCaller(auth, action, deps = {}) {
  if (!auth || !auth.uid) throw new HttpsError('unauthenticated', `Sign in to ${action}.`);
  const token = auth.token || {};
  const provider = token.firebase && token.firebase.sign_in_provider;
  if (provider === 'anonymous') throw new HttpsError('permission-denied', `A client-portal session cannot ${action}.`);
  const load = deps.loadUserDoc || loadUserDocFromFirestore;
  const user = await load(auth.uid);
  if (!isStaffPrincipal({ token, user })) {
    throw new HttpsError('permission-denied', `You need an active ZeusOS staff profile to ${action}.`);
  }
  return { uid: auth.uid, user };
}

module.exports = { assertStaffCaller, isStaffPrincipal };
