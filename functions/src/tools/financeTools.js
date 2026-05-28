/**
 * Finance Domain Tools
 * Claude tool definitions and Firestore handlers for financial data.
 */

const admin = require('firebase-admin');
const db = admin.firestore();

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const definitions = [
  {
    name: 'get_financial_summary',
    description: 'Get a financial summary across the commercial-gravity collections: client invoices (revenue, outstanding, paid), open supplier purchase orders (committed spend), and the CRM deals pipeline (forecast). Optionally scope invoices to a single master job. Use when discussing financial performance or cash position.',
    input_schema: {
      type: 'object',
      properties: {
        masterJobId: {
          type: 'string',
          description: 'Scope client-invoice totals to a single master job',
        },
      },
    },
  },
  // get_project_costing was removed in the Phase 1.E tools sweep — it
  // computed DawinOS construction costing (material costs, optimization
  // state, BOM, manufacturing orders) which has no ZeusOS analog. The
  // marketing-agency cost surface is the IWO burn meter
  // (cumulativeCostMinor vs budgetMinor on internal_work_orders), exposed
  // through the delivery workspace + Burn & SLA pages, not this tool.
];

// ============================================================================
// HANDLERS
// ============================================================================

const handlers = {
  get_financial_summary: async (input, context) => {
    const { masterJobId } = input;

    const summary = {
      // Client invoices carry a `total: { amountMinor, currency }` (minor
      // units). Statuses: DRAFT | ISSUED | PART_PAID | PAID | VOID.
      clientInvoices: { totalMinor: 0, outstandingMinor: 0, paidMinor: 0, count: 0 },
      // Phase 4.1 supplier POs: `amountMinor`, status OPEN | POSTED.
      purchaseOrders: { openMinor: 0, postedMinor: 0, count: 0 },
      // CRM deals pipeline (forecast).
      deals: { totalPipeline: 0, weightedPipeline: 0, wonThisPeriod: 0, count: 0 },
    };

    // Fetch client invoices.
    try {
      let invoiceQuery = db.collection('client_invoices');
      if (masterJobId) invoiceQuery = invoiceQuery.where('masterJobId', '==', masterJobId);

      const invoiceSnap = await invoiceQuery.limit(100).get();
      for (const doc of invoiceSnap.docs) {
        const data = doc.data();
        if (data.status === 'VOID') continue;
        const amountMinor = (data.total && data.total.amountMinor) || 0;
        const paidMinor = data.paidMinor || 0;
        summary.clientInvoices.totalMinor += amountMinor;
        summary.clientInvoices.paidMinor += paidMinor;
        summary.clientInvoices.outstandingMinor += Math.max(0, amountMinor - paidMinor);
      }
      summary.clientInvoices.count = invoiceSnap.size;
    } catch (e) {
      summary.clientInvoices.note = 'Client-invoice data not available';
    }

    // Fetch deals pipeline for revenue forecast.
    try {
      const dealsSnap = await db.collection('crm_deals')
        .where('stage', 'not-in', ['lost', 'cancelled'])
        .limit(100)
        .get();

      for (const doc of dealsSnap.docs) {
        const data = doc.data();
        summary.deals.totalPipeline += data.value || 0;
        summary.deals.weightedPipeline += (data.value || 0) * ((data.probability || 0) / 100);
        if (data.stage === 'won') {
          summary.deals.wonThisPeriod += data.value || 0;
        }
      }
      summary.deals.count = dealsSnap.size;
    } catch (e) {
      summary.deals.note = 'Deal data not available';
    }

    // Fetch supplier purchase orders (Phase 4.1 procurement).
    try {
      const poSnap = await db.collection('purchase_orders').limit(100).get();
      for (const doc of poSnap.docs) {
        const data = doc.data();
        const amountMinor = data.amountMinor || 0;
        if (data.status === 'POSTED') {
          summary.purchaseOrders.postedMinor += amountMinor;
        } else {
          summary.purchaseOrders.openMinor += amountMinor;
        }
      }
      summary.purchaseOrders.count = poSnap.size;
    } catch (e) {
      summary.purchaseOrders.note = 'PO data not available';
    }

    return summary;
  },
};

module.exports = { definitions, handlers };
