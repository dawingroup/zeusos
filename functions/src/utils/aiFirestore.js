/**
 * Firestore triggers, with the AI ledger told who is calling: a data-change
 * trigger sets `trigger: 'event'` for every model call beneath it. All four
 * builders are wrapped so the next trigger that calls a model finds a wrapper
 * waiting rather than a reason to skip one. Drop-ins for the v2 builders.
 */

const firestore = require('firebase-functions/v2/firestore');
const { withAiContext } = require('./aiUsageLedger');

const TRIGGER = 'event';

function attribute(builder) {
  return (options, handler) => builder(options, (event) => withAiContext({ trigger: TRIGGER }, () => handler(event)));
}

module.exports = {
  onAiDocumentCreated: attribute(firestore.onDocumentCreated),
  onAiDocumentUpdated: attribute(firestore.onDocumentUpdated),
  onAiDocumentDeleted: attribute(firestore.onDocumentDeleted),
  onAiDocumentWritten: attribute(firestore.onDocumentWritten),
  TRIGGER,
};
