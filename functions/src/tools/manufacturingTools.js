/**
 * Manufacturing Domain Tools
 * Claude tool definitions and Firestore handlers for manufacturing orders and purchase orders.
 */

const admin = require('firebase-admin');
const db = admin.firestore();

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const definitions = [
  {
    name: 'get_manufacturing_orders',
    description: 'Query manufacturing orders by status, stage, project, or priority. Returns MO details including BOM summary, current stage, and timeline. Use when discussing production status or capacity.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'pending-approval', 'approved', 'in-progress', 'on-hold', 'completed', 'cancelled'],
          description: 'Filter by MO status',
        },
        currentStage: {
          type: 'string',
          enum: ['queued', 'cutting', 'assembly', 'finishing', 'qc', 'ready'],
          description: 'Filter by current production stage',
        },
        projectId: {
          type: 'string',
          description: 'Filter by linked design project',
        },
        priority: {
          type: 'string',
          enum: ['low', 'medium', 'high', 'urgent'],
          description: 'Filter by priority level',
        },
        limit: {
          type: 'number',
          description: 'Maximum results to return',
          default: 20,
        },
      },
    },
  },
  {
    name: 'get_manufacturing_order_detail',
    description: 'Get full details of a specific manufacturing order including BOM entries, material consumption records, stage transition history, quality checks, and linked purchase orders. Use when diving deep into a specific MO.',
    input_schema: {
      type: 'object',
      properties: {
        moId: {
          type: 'string',
          description: 'Manufacturing order document ID',
        },
      },
      required: ['moId'],
    },
  },
  {
    name: 'get_purchase_orders',
    description: 'Query purchase orders by status, supplier, or linked project. Returns PO details including line items, costs, and receiving status. Use when discussing procurement, supplier performance, or material sourcing.',
    input_schema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['draft', 'pending-approval', 'approved', 'sent', 'partially-received', 'received', 'closed', 'cancelled'],
          description: 'Filter by PO status',
        },
        supplierId: {
          type: 'string',
          description: 'Filter by supplier ID',
        },
        supplierName: {
          type: 'string',
          description: 'Filter by supplier name (partial match)',
        },
        projectId: {
          type: 'string',
          description: 'Filter by linked project',
        },
        limit: {
          type: 'number',
          description: 'Maximum results',
          default: 20,
        },
      },
    },
  },
];

// ============================================================================
// HANDLERS
// ============================================================================

const handlers = {
  get_manufacturing_orders: async (input, context) => {
    const { status, currentStage, projectId, priority, limit = 20 } = input;

    let query = db.collection('manufacturingOrders');

    if (status) query = query.where('status', '==', status);
    if (currentStage) query = query.where('currentStage', '==', currentStage);
    if (projectId) query = query.where('projectId', '==', projectId);
    if (priority) query = query.where('priority', '==', priority);

    // If no filters, order by most recent
    if (!status && !currentStage && !projectId && !priority) {
      query = query.orderBy('createdAt', 'desc');
    }

    const snap = await query.limit(limit).get();

    return snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        moNumber: data.moNumber || data.orderNumber,
        name: data.name,
        status: data.status,
        currentStage: data.currentStage,
        priority: data.priority,
        projectId: data.projectId,
        projectName: data.projectName,
        customerId: data.customerId,
        customerName: data.customerName,
        bomItemCount: data.bomItemCount || 0,
        startDate: data.startDate,
        targetCompletionDate: data.targetCompletionDate,
        actualCompletionDate: data.actualCompletionDate,
        totalEstimatedCost: data.totalEstimatedCost,
        totalActualCost: data.totalActualCost,
        createdAt: data.createdAt,
      };
    });
  },

  get_manufacturing_order_detail: async (input, context) => {
    const { moId } = input;

    const moDoc = await db.collection('manufacturingOrders').doc(moId).get();
    if (!moDoc.exists) {
      return { error: 'Manufacturing order not found' };
    }

    const mo = { id: moDoc.id, ...moDoc.data() };

    // Load BOM entries
    const bomSnap = await db.collection('manufacturingOrders')
      .doc(moId).collection('bomEntries')
      .get();

    mo.bomEntries = bomSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        inventoryItemId: data.inventoryItemId,
        itemName: data.itemName || data.name,
        sku: data.sku,
        quantity: data.quantity,
        unit: data.unit,
        unitCost: data.unitCost,
        totalCost: data.totalCost,
        supplierName: data.supplierName,
        status: data.status,
      };
    });

    // Load material consumptions
    const consumptionSnap = await db.collection('manufacturingOrders')
      .doc(moId).collection('materialConsumptions')
      .orderBy('consumedAt', 'desc')
      .limit(20)
      .get();

    mo.materialConsumptions = consumptionSnap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        itemName: data.itemName,
        quantity: data.quantity,
        unit: data.unit,
        costPerUnit: data.costPerUnit,
        totalCost: data.totalCost,
        consumedAt: data.consumedAt,
        consumedBy: data.consumedByName || data.consumedBy,
      };
    });

    // Load stage transitions
    const transitionsSnap = await db.collection('manufacturingOrders')
      .doc(moId).collection('stageTransitions')
      .orderBy('transitionedAt', 'desc')
      .limit(20)
      .get();

    mo.stageTransitions = transitionsSnap.docs.map(d => {
      const data = d.data();
      return {
        fromStage: data.fromStage,
        toStage: data.toStage,
        transitionedAt: data.transitionedAt,
        transitionedBy: data.transitionedByName || data.transitionedBy,
        notes: data.notes,
      };
    });

    return mo;
  },

  get_purchase_orders: async (input, context) => {
    const { status, supplierId, supplierName, projectId, limit = 20 } = input;

    let query = db.collection('purchaseOrders');

    if (status) query = query.where('status', '==', status);
    if (supplierId) query = query.where('supplierId', '==', supplierId);
    if (projectId) query = query.where('projectId', '==', projectId);

    if (!status && !supplierId && !projectId) {
      query = query.orderBy('createdAt', 'desc');
    }

    const snap = await query.limit(limit).get();

    let results = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        poNumber: data.poNumber || data.orderNumber,
        status: data.status,
        supplierId: data.supplierId,
        supplierName: data.supplierName,
        projectId: data.projectId,
        projectName: data.projectName,
        lineItemCount: data.lineItemCount || (data.lineItems || []).length,
        subtotal: data.subtotal,
        total: data.total,
        currency: data.currency,
        expectedDeliveryDate: data.expectedDeliveryDate,
        receivedDate: data.receivedDate,
        createdAt: data.createdAt,
      };
    });

    // Client-side supplier name filter
    if (supplierName) {
      const term = supplierName.toLowerCase();
      results = results.filter(r =>
        (r.supplierName || '').toLowerCase().includes(term)
      );
    }

    return results;
  },
};

module.exports = { definitions, handlers };
