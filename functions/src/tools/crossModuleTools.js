/**
 * Cross-Module Correlation Tools
 * Claude tool definitions and Firestore handlers for queries that span multiple modules.
 * These are the most powerful tools — they join data across module boundaries.
 */

const admin = require('firebase-admin');
const db = admin.firestore();

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const definitions = [
  {
    name: 'cross_module_query',
    description: 'Execute a cross-module query that joins data across DawinOS modules. Use this when you need to correlate data between design, manufacturing, inventory, CRM, and finance. For example: "all projects for customer X with their manufacturing status and outstanding invoices" or "materials used by project Y that are below reorder level".',
    input_schema: {
      type: 'object',
      properties: {
        queryType: {
          type: 'string',
          enum: [
            'customer_project_summary',
            'project_production_status',
            'material_demand_forecast',
            'supplier_spend_analysis',
            'pipeline_revenue_forecast',
            'production_bottleneck_analysis',
          ],
          description: 'The type of cross-module query to run',
        },
        parameters: {
          type: 'object',
          description: 'Query-specific parameters (e.g., customerId, projectId, supplierId, dateRange)',
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
      project_production_status: projectProductionStatus,
      material_demand_forecast: materialDemandForecast,
      supplier_spend_analysis: supplierSpendAnalysis,
      pipeline_revenue_forecast: pipelineRevenueForecast,
      production_bottleneck_analysis: productionBottleneckAnalysis,
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
 * All projects, MOs, POs, and deals for a customer
 */
async function customerProjectSummary(params, context) {
  const { customerId } = params;
  if (!customerId) return { error: 'customerId is required' };

  const [customerDoc, projectsSnap, dealsSnap, mosSnap, posSnap] = await Promise.all([
    db.collection('customers').doc(customerId).get(),
    db.collection('designProjects').where('customerId', '==', customerId).orderBy('updatedAt', 'desc').limit(10).get(),
    db.collection('crm_deals').where('customerId', '==', customerId).limit(10).get(),
    db.collection('manufacturingOrders').where('customerId', '==', customerId).limit(10).get(),
    db.collection('purchaseOrders').where('customerId', '==', customerId).limit(10).get(),
  ]);

  if (!customerDoc.exists) return { error: 'Customer not found' };

  const customer = { id: customerDoc.id, name: customerDoc.data().name };

  const projects = projectsSnap.docs.map(d => ({
    id: d.id, name: d.data().name || d.data().code, status: d.data().status, stage: d.data().stage,
  }));

  const deals = dealsSnap.docs.map(d => ({
    id: d.id, title: d.data().title, stage: d.data().stage,
    value: d.data().value, probability: d.data().probability,
  }));

  const manufacturingOrders = mosSnap.docs.map(d => ({
    id: d.id, moNumber: d.data().moNumber, status: d.data().status,
    currentStage: d.data().currentStage, projectId: d.data().projectId,
  }));

  const purchaseOrders = posSnap.docs.map(d => ({
    id: d.id, poNumber: d.data().poNumber, status: d.data().status,
    total: d.data().total, supplierName: d.data().supplierName,
  }));

  // Cross-reference: which projects have MOs, which don't
  const projectsWithMOs = new Set(manufacturingOrders.map(m => m.projectId));

  return {
    customer,
    projects: projects.map(p => ({
      ...p,
      hasManufacturingOrder: projectsWithMOs.has(p.id),
      linkedMOs: manufacturingOrders.filter(m => m.projectId === p.id),
    })),
    deals,
    purchaseOrders,
    summary: {
      totalProjects: projects.length,
      activeProjects: projects.filter(p => p.status !== 'completed' && p.status !== 'cancelled').length,
      totalDealValue: deals.reduce((s, d) => s + (d.value || 0), 0),
      activeMOs: manufacturingOrders.filter(m => m.status === 'in-progress').length,
      openPOValue: purchaseOrders.filter(p => !['closed', 'cancelled'].includes(p.status)).reduce((s, p) => s + (p.total || 0), 0),
    },
  };
}

/**
 * Project → design items → MOs → stage status → material consumption
 */
async function projectProductionStatus(params, context) {
  const { projectId } = params;
  if (!projectId) return { error: 'projectId is required' };

  const [projectDoc, itemsSnap, mosSnap] = await Promise.all([
    db.collection('designProjects').doc(projectId).get(),
    db.collection('designProjects').doc(projectId).collection('designItems').get(),
    db.collection('manufacturingOrders').where('projectId', '==', projectId).get(),
  ]);

  if (!projectDoc.exists) return { error: 'Project not found' };

  const project = { id: projectDoc.id, name: projectDoc.data().name || projectDoc.data().code, status: projectDoc.data().status };

  const designItems = itemsSnap.docs.map(d => ({
    id: d.id, name: d.data().name, stage: d.data().stage, category: d.data().category, quantity: d.data().quantity,
  }));

  const manufacturingOrders = [];
  for (const moDoc of mosSnap.docs) {
    const moData = moDoc.data();
    const mo = {
      id: moDoc.id,
      moNumber: moData.moNumber,
      status: moData.status,
      currentStage: moData.currentStage,
      priority: moData.priority,
      startDate: moData.startDate,
      targetCompletionDate: moData.targetCompletionDate,
      estimatedCost: moData.totalEstimatedCost,
      actualCost: moData.totalActualCost,
    };

    // Load BOM for each MO to check material status
    const bomSnap = await moDoc.ref.collection('bomEntries').get();
    mo.bomItems = bomSnap.docs.map(b => ({
      name: b.data().itemName || b.data().name,
      quantity: b.data().quantity,
      status: b.data().status,
    }));
    mo.bomItemCount = mo.bomItems.length;

    manufacturingOrders.push(mo);
  }

  // Determine which design items are in production vs waiting
  const moProjectItems = manufacturingOrders.flatMap(m => m.bomItems || []);

  return {
    project,
    designItems: {
      total: designItems.length,
      byStage: groupBy(designItems, 'stage'),
      byCategory: groupBy(designItems, 'category'),
    },
    manufacturingOrders,
    productionSummary: {
      totalMOs: manufacturingOrders.length,
      byStatus: groupBy(manufacturingOrders, 'status'),
      byStage: groupBy(manufacturingOrders, 'currentStage'),
      totalEstimatedCost: manufacturingOrders.reduce((s, m) => s + (m.estimatedCost || 0), 0),
      totalActualCost: manufacturingOrders.reduce((s, m) => s + (m.actualCost || 0), 0),
    },
  };
}

/**
 * Upcoming MOs → BOM requirements → stock gaps
 */
async function materialDemandForecast(params, context) {
  const { daysAhead = 30 } = params;

  // Get active and approved MOs (upcoming demand)
  const mosSnap = await db.collection('manufacturingOrders')
    .where('status', 'in', ['approved', 'in-progress'])
    .limit(20)
    .get();

  const demandMap = {}; // inventoryItemId → total required

  for (const moDoc of mosSnap.docs) {
    const bomSnap = await moDoc.ref.collection('bomEntries').get();
    for (const bomDoc of bomSnap.docs) {
      const data = bomDoc.data();
      const itemId = data.inventoryItemId;
      if (!itemId) continue;

      if (!demandMap[itemId]) {
        demandMap[itemId] = {
          inventoryItemId: itemId,
          name: data.itemName || data.name,
          totalRequired: 0,
          requiredByMOs: [],
        };
      }
      demandMap[itemId].totalRequired += data.quantity || 0;
      demandMap[itemId].requiredByMOs.push({
        moId: moDoc.id,
        moNumber: moDoc.data().moNumber,
        quantity: data.quantity,
      });
    }
  }

  // Check stock levels for demanded items
  const itemIds = Object.keys(demandMap);
  if (itemIds.length === 0) {
    return { message: 'No active manufacturing orders with BOM entries found', items: [] };
  }

  const stockChecks = await Promise.all(
    itemIds.slice(0, 30).map(id => db.collection('inventoryItems').doc(id).get())
  );

  const results = [];
  for (const doc of stockChecks) {
    if (!doc.exists) continue;
    const data = doc.data();
    const demand = demandMap[doc.id];
    const available = data.stockOnHand || 0;
    const shortage = Math.max(0, demand.totalRequired - available);

    results.push({
      inventoryItemId: doc.id,
      name: demand.name || data.name,
      category: data.category,
      stockOnHand: available,
      totalRequired: demand.totalRequired,
      shortage,
      status: shortage > 0 ? 'SHORTAGE' : 'OK',
      reorderLevel: data.reorderLevel,
      primarySupplier: data.primarySupplier,
      estimatedLeadTime: data.leadTimeDays,
      requiredByMOs: demand.requiredByMOs,
    });
  }

  // Sort by shortage severity
  results.sort((a, b) => b.shortage - a.shortage);

  return {
    summary: {
      totalMaterialsNeeded: results.length,
      shortages: results.filter(r => r.status === 'SHORTAGE').length,
      adequate: results.filter(r => r.status === 'OK').length,
    },
    items: results,
  };
}

/**
 * POs by supplier → total spend → performance
 */
async function supplierSpendAnalysis(params, context) {
  const { supplierId, dateFrom, dateTo } = params;

  let query = db.collection('purchaseOrders');
  if (supplierId) query = query.where('supplierId', '==', supplierId);

  const snap = await query.orderBy('createdAt', 'desc').limit(50).get();

  const supplierMap = {};
  for (const doc of snap.docs) {
    const data = doc.data();
    const sid = data.supplierId || 'unknown';

    if (!supplierMap[sid]) {
      supplierMap[sid] = {
        supplierId: sid,
        supplierName: data.supplierName || 'Unknown',
        totalPOs: 0,
        totalSpend: 0,
        currency: data.currency || 'USD',
        statuses: {},
        latestPO: null,
      };
    }

    supplierMap[sid].totalPOs++;
    supplierMap[sid].totalSpend += data.total || 0;
    supplierMap[sid].statuses[data.status] = (supplierMap[sid].statuses[data.status] || 0) + 1;
    if (!supplierMap[sid].latestPO || (data.createdAt && data.createdAt > supplierMap[sid].latestPO)) {
      supplierMap[sid].latestPO = data.createdAt;
    }
  }

  const suppliers = Object.values(supplierMap).sort((a, b) => b.totalSpend - a.totalSpend);

  return {
    summary: {
      totalSuppliers: suppliers.length,
      totalSpend: suppliers.reduce((s, sup) => s + sup.totalSpend, 0),
      totalPOs: snap.size,
    },
    suppliers,
  };
}

/**
 * Deals → probability → weighted pipeline → forecast
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

/**
 * MOs by stage → time in stage → material delay analysis
 */
async function productionBottleneckAnalysis(params, context) {
  const mosSnap = await db.collection('manufacturingOrders')
    .where('status', '==', 'in-progress')
    .limit(30)
    .get();

  const stageAnalysis = {};
  const bottlenecks = [];

  for (const doc of mosSnap.docs) {
    const data = doc.data();
    const stage = data.currentStage || 'unknown';

    if (!stageAnalysis[stage]) {
      stageAnalysis[stage] = { stage, count: 0, orders: [] };
    }
    stageAnalysis[stage].count++;

    const mo = {
      id: doc.id,
      moNumber: data.moNumber,
      name: data.name,
      currentStage: stage,
      priority: data.priority,
      projectName: data.projectName,
      customerName: data.customerName,
      targetCompletionDate: data.targetCompletionDate,
    };

    // Check if overdue
    if (data.targetCompletionDate) {
      const target = data.targetCompletionDate.toDate ? data.targetCompletionDate.toDate() : new Date(data.targetCompletionDate);
      if (target < new Date()) {
        mo.isOverdue = true;
        mo.daysOverdue = Math.floor((Date.now() - target.getTime()) / (1000 * 60 * 60 * 24));
        bottlenecks.push(mo);
      }
    }

    stageAnalysis[stage].orders.push(mo);
  }

  return {
    summary: {
      totalActiveMOs: mosSnap.size,
      overdueMOs: bottlenecks.length,
      stageDistribution: Object.fromEntries(
        Object.entries(stageAnalysis).map(([k, v]) => [k, v.count])
      ),
    },
    bottlenecks: bottlenecks.sort((a, b) => (b.daysOverdue || 0) - (a.daysOverdue || 0)),
    byStage: Object.values(stageAnalysis),
  };
}

// ============================================================================
// HELPERS
// ============================================================================

function groupBy(arr, key) {
  const groups = {};
  for (const item of arr) {
    const k = item[key] || 'unknown';
    if (!groups[k]) groups[k] = { value: k, count: 0, items: [] };
    groups[k].count++;
    groups[k].items.push(item);
  }
  return Object.values(groups);
}

module.exports = { definitions, handlers };
