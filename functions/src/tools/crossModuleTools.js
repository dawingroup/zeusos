/**
 * Cross-Module Correlation Tools
 *
 * Claude tool definitions + Firestore handlers for queries that join
 * data across ZeusOS modules. Powers the `crossModuleIntelligence`
 * callable (the AI Assistant).
 *
 * Phase 1.E tools sweep: three DawinOS query types were removed because
 * they joined collections stripped from ZeusOS —
 *   • `project_production_status`     (designProjects → designItems → MOs → BOM)
 *   • `material_demand_forecast`      (MOs → BOM → inventoryItems)
 *   • `production_bottleneck_analysis`(manufacturingOrders by stage)
 * None has a marketing-agency analog. The surviving three were
 * re-pointed at ZeusOS collections:
 *   • `customer_project_summary`  → CRM customer + their crm_deals
 *                                   (the DawinOS designProjects / MO / PO
 *                                   joins were keyed on `customerId`,
 *                                   which the commercial-gravity graph —
 *                                   master_jobs on `clients/{id}` — does
 *                                   not share, so they were dropped).
 *   • `supplier_spend_analysis`   → Phase 4.1 `purchase_orders`
 *                                   (`supplierOrgId`, `amountMinor`).
 *   • `pipeline_revenue_forecast` → `crm_deals` (unchanged).
 */

const admin = require('firebase-admin');
const db = admin.firestore();

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const definitions = [
  {
    name: 'cross_module_query',
    description: 'Execute a cross-module query that joins data across ZeusOS modules. Use this to correlate CRM, commercial, and procurement data. For example: "everything we know about customer X plus their open deals", "total spend per supplier", or "weighted pipeline forecast by stage".',
    input_schema: {
      type: 'object',
      properties: {
        queryType: {
          type: 'string',
          enum: [
            'customer_project_summary',
            'supplier_spend_analysis',
            'pipeline_revenue_forecast',
          ],
          description: 'The type of cross-module query to run',
        },
        parameters: {
          type: 'object',
          description: 'Query-specific parameters (e.g., customerId, supplierId)',
        },
      },
      required: ['queryType'],
    },
  },
];

// ============================================================================
// HANDLERS
// ============================================================================

const handlers = {
  cross_module_query: async (input, context) => {
    const { queryType, parameters = {} } = input;

    const queryHandlers = {
      customer_project_summary: customerProjectSummary,
      supplier_spend_analysis: supplierSpendAnalysis,
      pipeline_revenue_forecast: pipelineRevenueForecast,
    };

    const handler = queryHandlers[queryType];
    if (!handler) {
      return { error: `Unknown query type: ${queryType}` };
    }

    return handler(parameters, context);
  },
};

// ============================================================================
// CROSS-MODULE QUERY IMPLEMENTATIONS
// ============================================================================

/**
 * A CRM customer + their open sales-pipeline deals.
 *
 * (Formerly joined designProjects / manufacturingOrders / purchaseOrders
 * keyed on `customerId`. Those collections are stripped, and the
 * commercial engagement graph lives under `clients/{id}` — a different
 * id space than CRM `customers/{id}` — so they can't be joined here.)
 */
async function customerProjectSummary(params, context) {
  const { customerId } = params;
  if (!customerId) return { error: 'customerId is required' };

  const [customerDoc, dealsSnap] = await Promise.all([
    db.collection('customers').doc(customerId).get(),
    db.collection('crm_deals').where('customerId', '==', customerId).limit(20).get(),
  ]);

  if (!customerDoc.exists) return { error: 'Customer not found' };

  const customer = { id: customerDoc.id, name: customerDoc.data().name };

  const deals = dealsSnap.docs.map(d => ({
    id: d.id,
    title: d.data().title,
    stage: d.data().stage,
    value: d.data().value,
    probability: d.data().probability,
    weightedValue: (d.data().value || 0) * ((d.data().probability || 0) / 100),
  }));

  return {
    customer,
    deals,
    summary: {
      totalDeals: deals.length,
      activeDeals: deals.filter(d => !['won', 'lost'].includes(d.stage)).length,
      totalDealValue: deals.reduce((s, d) => s + (d.value || 0), 0),
      weightedPipeline: deals.reduce((s, d) => s + (d.weightedValue || 0), 0),
    },
  };
}

/**
 * Supplier purchase orders → total spend per supplier.
 *
 * Phase 4.1 `purchase_orders`: `supplierOrgId`, `amountMinor` (minor
 * units), status OPEN | POSTED. Talent POs carry `supplierProfileId`
 * instead of `supplierOrgId`; we fall back to it for the grouping key.
 */
async function supplierSpendAnalysis(params, context) {
  const { supplierId } = params;

  let query = db.collection('purchase_orders');
  if (supplierId) query = query.where('supplierOrgId', '==', supplierId);

  const snap = await query.orderBy('raisedAt', 'desc').limit(100).get();

  const supplierMap = {};
  for (const doc of snap.docs) {
    const data = doc.data();
    const sid = data.supplierOrgId || data.supplierProfileId || 'unknown';

    if (!supplierMap[sid]) {
      supplierMap[sid] = {
        supplierId: sid,
        kind: data.kind || 'UNKNOWN',
        totalPOs: 0,
        totalSpendMinor: 0,
        currency: data.currency || 'USD',
        statuses: {},
        latestPO: null,
      };
    }

    supplierMap[sid].totalPOs++;
    supplierMap[sid].totalSpendMinor += data.amountMinor || 0;
    supplierMap[sid].statuses[data.status] = (supplierMap[sid].statuses[data.status] || 0) + 1;
    if (!supplierMap[sid].latestPO || (data.raisedAt && data.raisedAt > supplierMap[sid].latestPO)) {
      supplierMap[sid].latestPO = data.raisedAt;
    }
  }

  const suppliers = Object.values(supplierMap).sort((a, b) => b.totalSpendMinor - a.totalSpendMinor);

  return {
    summary: {
      totalSuppliers: suppliers.length,
      totalSpendMinor: suppliers.reduce((s, sup) => s + sup.totalSpendMinor, 0),
      totalPOs: snap.size,
    },
    suppliers,
  };
}

/**
 * Deals → probability → weighted pipeline → forecast.
 */
async function pipelineRevenueForecast(params, context) {
  const dealsSnap = await db.collection('crm_deals')
    .where('stage', 'not-in', ['lost', 'cancelled'])
    .limit(50)
    .get();

  const stageMap = {};
  let totalPipeline = 0;
  let totalWeighted = 0;

  for (const doc of dealsSnap.docs) {
    const data = doc.data();
    const stage = data.stage || 'unknown';
    const value = data.value || 0;
    const prob = data.probability || 0;
    const weighted = value * (prob / 100);

    totalPipeline += value;
    totalWeighted += weighted;

    if (!stageMap[stage]) {
      stageMap[stage] = { stage, count: 0, totalValue: 0, weightedValue: 0, deals: [] };
    }
    stageMap[stage].count++;
    stageMap[stage].totalValue += value;
    stageMap[stage].weightedValue += weighted;
    stageMap[stage].deals.push({
      id: doc.id,
      title: data.title,
      customerName: data.customerName,
      value,
      probability: prob,
      weightedValue: weighted,
      expectedCloseDate: data.expectedCloseDate,
    });
  }

  return {
    summary: {
      totalDeals: dealsSnap.size,
      totalPipelineValue: totalPipeline,
      weightedPipelineValue: totalWeighted,
    },
    byStage: Object.values(stageMap).sort((a, b) => b.weightedValue - a.weightedValue),
  };
}

module.exports = { definitions, handlers };
