/**
 * Callables, with the AI ledger told who is calling — and WHO.
 *
 * A callable is the one entry point where `trigger: 'user'` is genuinely true:
 * a person clicked something. This wrapper carries `request.auth.uid`, which
 * turns "users spent $X" into "which user". An unauthenticated call leaves
 * `userId` unset rather than guessing.
 *
 * `feature` is deliberately NOT set: the ledger falls back to the deployed
 * function's name. A callable wanting a better label nests its own
 * `withAiContext`. Drop-in for `onCall`: same arguments, same return value.
 *
 * Every AI callable is also staff-only, here, once (auth/staffGate.js): the
 * gate runs before the handler, so a portal identity never reaches a model or
 * an Admin-SDK read, and a new AI callable cannot forget it.
 */

const { onCall } = require('firebase-functions/v2/https');
const { withAiContext } = require('./aiUsageLedger');
const { assertStaffCaller } = require('../auth/staffGate');

const TRIGGER = 'user';

function onAiCall(optionsOrHandler, maybeHandler) {
  const hasOptions = typeof optionsOrHandler !== 'function';
  const handler = hasOptions ? maybeHandler : optionsOrHandler;
  const wrapped = async (request) => {
    await assertStaffCaller(request && request.auth, 'use the AI tools');
    return withAiContext({ trigger: TRIGGER, userId: request.auth.uid }, () => handler(request));
  };
  return hasOptions ? onCall(optionsOrHandler, wrapped) : onCall(wrapped);
}

module.exports = { onAiCall, TRIGGER };
