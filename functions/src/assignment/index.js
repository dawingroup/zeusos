/**
 * Phase 3.B — Assignment & Handoff Cloud Functions barrel.
 *
 * The 11 callables that drive the IWO state machine (spec §6.1).
 * Wired into `functions/index.js` so the Firebase CLI picks them up.
 */

const { issueWorkOrder } = require('./issueWorkOrder');
const { acceptWorkOrder, rejectWorkOrder } = require('./acceptRejectWorkOrder');
const { startWorkOrder } = require('./startWorkOrder');
const { postTimeEntry } = require('./postTimeEntry');
const { postCostEntry } = require('./postCostEntry');
const { submitDeliverable } = require('./submitDeliverable');
const { acceptInternal, requestRevision } = require('./acceptInternalRequestRevision');
const { closeWorkOrder } = require('./closeWorkOrder');
const { cancelWorkOrder } = require('./cancelWorkOrder');
const { openMasterJobOnQuoteAccepted } = require('./openMasterJobOnQuoteAccepted');
const { signAcceptanceCriterion } = require('./signAcceptanceCriterion');

module.exports = {
  issueWorkOrder,
  acceptWorkOrder,
  rejectWorkOrder,
  startWorkOrder,
  postTimeEntry,
  postCostEntry,
  submitDeliverable,
  acceptInternal,
  requestRevision,
  closeWorkOrder,
  cancelWorkOrder,
  openMasterJobOnQuoteAccepted,
  signAcceptanceCriterion,
};
