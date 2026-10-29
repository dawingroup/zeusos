/**
 * Approvals context — routing v2 + the human-approver policy + the
 * supplier-invoice approval callables. See routing.js for the model and
 * docs/APPROVAL_ROUTING_V2.md for the operator's view.
 */

'use strict';

const routing = require('./routing');
const policy = require('./policy');
const { approveTalentInvoice, approveMediaSupplierInvoice } = require('./approveSupplierInvoice');

module.exports = {
  routing,
  policy,
  approveTalentInvoice,
  approveMediaSupplierInvoice,
};
