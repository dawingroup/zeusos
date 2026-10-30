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
 */

const { onCall } = require('firebase-functions/v2/https');
const { withAiContext } = require('./aiUsageLedger');

const TRIGGER = 'user';

function onAiCall(optionsOrHandler, maybeHandler) {
  const hasOptions = typeof optionsOrHandler !== 'function';
  const handler = hasOptions ? maybeHandler : optionsOrHandler;
  const wrapped = (request) =>
    withAiContext({ trigger: TRIGGER, userId: (request && request.auth && request.auth.uid) || undefined }, () => handler(request));
  return hasOptions ? onCall(optionsOrHandler, wrapped) : onCall(wrapped);
}

module.exports = { onAiCall, TRIGGER };
