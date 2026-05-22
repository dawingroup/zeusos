/**
 * Phase 3.B + 3.D + 3.E — Assignment & Handoff Cloud Functions barrel.
 *
 * Wired into `functions/index.js` so the Firebase CLI picks them up.
 * Members:
 *   - 11 IWO state-machine callables (Phase 3.B, spec §6.1).
 *   - openMasterJobOnQuoteAccepted + signAcceptanceCriterion (Phase 3.D, spec §5).
 *   - routeDirectClientRequest (Phase 3.E, spec §7.4 Layer 3 / §11.3).
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
const { routeDirectClientRequest } = require('./routeDirectClientRequest');

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
  routeDirectClientRequest,
};
