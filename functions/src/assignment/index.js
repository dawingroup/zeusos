/**
 * Phase 3.B + 3.E + 3.F — Assignment & Handoff Cloud Functions barrel.
 *
 * Wired into `functions/index.js` so the Firebase CLI picks them up.
 * Members:
 *   - 11 IWO state-machine callables (Phase 3.B, spec §6.1).
 *   - openMasterJobOnQuoteAccepted + signAcceptanceCriterion
 *     (Phase 3.F Pass 2 closures, spec §6.1 + §11.10).
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
// Phase 6.B — brand routing recommendation surface (Addendum v1.1 §8).
const { routeBrand } = require('./routeBrand');
// Phase 6.D — ECD approval ladder (Addendum v1.1 §7 / change C5).
const { advanceApprovalRung, rejectApprovalRung } = require('./advanceRejectApprovalRung');

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
  routeBrand,
  advanceApprovalRung,
  rejectApprovalRung,
};
