/**
 * `onSchedule`, with the AI ledger told who is calling: a scheduled job sets
 * `trigger: 'scheduled'` for every model call beneath it — one wrap at the
 * scheduler boundary covers the whole call tree (AsyncLocalStorage), which is
 * what makes "how much of the bill runs with nobody watching?" answerable.
 * Drop-in for `onSchedule`.
 */

const { onSchedule } = require('firebase-functions/v2/scheduler');
const { withAiContext } = require('./aiUsageLedger');

function onAiSchedule(options, handler) {
  return onSchedule(options, (event) => withAiContext({ trigger: 'scheduled' }, () => handler(event)));
}

module.exports = { onAiSchedule };
