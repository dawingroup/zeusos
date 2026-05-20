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
    description: 'Get financial summary including revenue, expenses, outstanding invoices, and budget utilization. Can be filtered by date range, project, or subsidiary. Use when discussing financial performance or budget status.',
    input_schema: {
      type: 'object',
      properties: {
        subsidiaryId: {
          type: 'string',
          description: 'Filter by subsidiary',
        },
        projectId: {
          type: 'string',
          description: 'Filter by specific project',
        },
        dateFrom: {
          type: 'string',
          description: 'Start date (ISO format: YYYY-MM-DD)',
        },
        dateTo: {
          type: 'string',
          description: 'End date (ISO format: YYYY-MM-DD)',
        },
      },
    },
  },
  {
    name: 'get_project_costing',
    description: 'Get the complete cost breakdown for a project including material costs, labor, optimization results, margin analysis, and comparison to budget. Use when discussing project profitability or cost estimation.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project document ID',
        },
      },
      required: ['projectId'],
    },
  },
];

// ============================================================================
// HANDLERS
// ============================================================================

const handlers = {
  get_financial_summary: async (input, context) => {
    const { subsidiaryId, projectId, dateFrom, dateTo } = input;

    const summary = {
      invoices: { total: 0, outstanding: 0, paid: 0, overdue: 0 },
      bills: { total: 0, outstanding: 0, paid: 0 },
      deals: { totalPipeline: 0, weightedPipeline: 0, wonThisPeriod: 0 },
      purchaseOrders: { total: 0, openValue: 0 },
    };

    // Fetch invoices (if collection exists)
    try {
      let invoiceQuery = db.collection('invoices');
      if (projectId) invoiceQuery = invoiceQuery.where('projectId', '==', projectId);

      const invoiceSnap = await invoiceQuery.limit(100).get();
      for (const doc of invoiceSnap.docs) {
        const data = doc.data();
        summary.invoices.total += data.total || 0;
        if (data.status === 'paid') {
          summary.invoices.paid += data.total || 0;
        } else if (data.status === 'overdue') {
          summary.invoices.overdue += data.total || 0;
          summary.invoices.outstanding += data.total || 0;
        } else {
          summary.invoices.outstanding += data.total || 0;
        }
      }
      summary.invoices.count = invoiceSnap.size;
    } catch (e) {
      summary.invoices.note = 'Invoice data not available';
    }

    // Fetch deals pipeline for revenue forecast
    try {
      let dealsQuery = db.collection('crm_deals');
      const dealsSnap = await dealsQuery
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

    // Fetch open purchase orders
    try {
      const poSnap = await db.collection('purchaseOrders')
        .where('status', 'in', ['approved', 'sent', 'partially-received'])
        .limit(50)
        .get();

      for (const doc of poSnap.docs) {
        const data = doc.data();
        summary.purchaseOrders.openValue += data.total || 0;
      }
      summary.purchaseOrders.count = poSnap.size;
    } catch (e) {
      summary.purchaseOrders.note = 'PO data not available';
    }

    return summary;
  },

  get_project_costing: async (input, context) => {
    const { projectId } = input;

    const projectDoc = await db.collection('designProjects').doc(projectId).get();
    if (!projectDoc.exists) {
      return { error: 'Project not found' };
    }

    const data = projectDoc.data();
    const costing = {
      projectId,
      projectName: data.name || data.code,
      customerName: data.customerName,
      status: data.status,
    };

    // Extract costing data from project
    costing.manufacturingCost = data.manufacturingCost || {};
    costing.procurementPricing = data.procurementPricing || {};
    costing.optimizationState = data.optimizationState || {};

    // Load design items for per-item costing
    const itemsSnap = await db.collection('designProjects')
      .doc(projectId).collection('designItems')
      .get();

    costing.itemCosts = itemsSnap.docs.map(d => {
      const item = d.data();
      return {
        id: d.id,
        name: item.name,
        category: item.category,
        quantity: item.quantity,
        unitCost: item.unitCost || item.costEstimate,
        totalCost: (item.unitCost || item.costEstimate || 0) * (item.quantity || 1),
        material: item.material,
      };
    });

    costing.totalItemCost = costing.itemCosts.reduce(
      (sum, i) => sum + (i.totalCost || 0), 0
    );

    // Load linked MOs for actual costs
    try {
      const mosSnap = await db.collection('manufacturingOrders')
        .where('projectId', '==', projectId)
        .limit(10)
        .get();

      costing.manufacturingOrders = mosSnap.docs.map(d => ({
        id: d.id,
        moNumber: d.data().moNumber,
        status: d.data().status,
        estimatedCost: d.data().totalEstimatedCost,
        actualCost: d.data().totalActualCost,
        variance: (d.data().totalActualCost || 0) - (d.data().totalEstimatedCost || 0),
      }));

      costing.totalEstimatedMOCost = costing.manufacturingOrders.reduce(
        (sum, m) => sum + (m.estimatedCost || 0), 0
      );
      costing.totalActualMOCost = costing.manufacturingOrders.reduce(
        (sum, m) => sum + (m.actualCost || 0), 0
      );
    } catch (e) {
      costing.manufacturingOrders = [];
    }

    return costing;
  },
};

module.exports = { definitions, handlers };
