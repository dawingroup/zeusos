/**
 * CRM & Customer Domain Tools
 * Claude tool definitions and Firestore handlers for customers and CRM deals.
 */

const admin = require('firebase-admin');
const db = admin.firestore();

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const definitions = [
  {
    name: 'get_customer_360',
    description: 'Get a complete 360-degree view of a customer including their projects, deals, manufacturing orders, communication history, and financial summary. Use when discussing a specific customer or their relationship with the company.',
    input_schema: {
      type: 'object',
      properties: {
        customerId: {
          type: 'string',
          description: 'Customer document ID',
        },
        includeProjects: {
          type: 'boolean',
          description: 'Include linked design projects',
          default: true,
        },
        includeDeals: {
          type: 'boolean',
          description: 'Include CRM deals',
          default: true,
        },
        includeManufacturingOrders: {
          type: 'boolean',
          description: 'Include manufacturing orders',
          default: true,
        },
      },
      required: ['customerId'],
    },
  },
  {
    name: 'search_customers',
    description: 'Search customers by name, email, company, or type. Use when looking up a customer or finding customers matching criteria.',
    input_schema: {
      type: 'object',
      properties: {
        searchTerm: {
          type: 'string',
          description: 'Text to search for in customer names, emails, or company names',
        },
        type: {
          type: 'string',
          enum: ['residential', 'commercial', 'contractor', 'designer', 'architect', 'developer'],
          description: 'Filter by customer type',
        },
        status: {
          type: 'string',
          enum: ['active', 'inactive', 'prospect', 'archived'],
          description: 'Filter by customer status',
        },
        limit: {
          type: 'number',
          description: 'Maximum results',
          default: 10,
        },
      },
      required: ['searchTerm'],
    },
  },
  {
    name: 'get_deals_pipeline',
    description: 'Get CRM deals filtered by stage, owner, priority, or customer. Returns deal values, probabilities, weighted values, and linked entities. Use when discussing sales pipeline, revenue forecasting, or deal status.',
    input_schema: {
      type: 'object',
      properties: {
        stage: {
          type: 'string',
          enum: ['lead', 'qualification', 'site_visit', 'design_proposal', 'quotation', 'negotiation', 'won', 'lost', 'on_hold'],
          description: 'Filter by pipeline stage',
        },
        ownerId: {
          type: 'string',
          description: 'Filter by deal owner (user ID)',
        },
        customerId: {
          type: 'string',
          description: 'Filter by customer',
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
  get_customer_360: async (input, context) => {
    const { customerId, includeProjects = true, includeDeals = true, includeManufacturingOrders = true } = input;

    const customerDoc = await db.collection('customers').doc(customerId).get();
    if (!customerDoc.exists) {
      return { error: 'Customer not found' };
    }

    const customer = { id: customerDoc.id, ...customerDoc.data() };

    // Parallel fetch of related data
    const promises = [];

    if (includeProjects) {
      promises.push(
        db.collection('designProjects')
          .where('customerId', '==', customerId)
          .orderBy('updatedAt', 'desc')
          .limit(10)
          .get()
          .then(snap => ({
            key: 'projects',
            data: snap.docs.map(d => ({
              id: d.id,
              name: d.data().name || d.data().code,
              status: d.data().status,
              stage: d.data().stage,
              createdAt: d.data().createdAt,
              updatedAt: d.data().updatedAt,
            })),
          }))
      );
    }

    if (includeDeals) {
      promises.push(
        db.collection('crm_deals')
          .where('customerId', '==', customerId)
          .orderBy('updatedAt', 'desc')
          .limit(10)
          .get()
          .then(snap => ({
            key: 'deals',
            data: snap.docs.map(d => ({
              id: d.id,
              title: d.data().title,
              stage: d.data().stage,
              value: d.data().value,
              currency: d.data().currency,
              probability: d.data().probability,
              weightedValue: (d.data().value || 0) * ((d.data().probability || 0) / 100),
              ownerName: d.data().ownerName,
              expectedCloseDate: d.data().expectedCloseDate,
            })),
          }))
      );
    }

    if (includeManufacturingOrders) {
      promises.push(
        db.collection('manufacturingOrders')
          .where('customerId', '==', customerId)
          .orderBy('createdAt', 'desc')
          .limit(10)
          .get()
          .then(snap => ({
            key: 'manufacturingOrders',
            data: snap.docs.map(d => ({
              id: d.id,
              moNumber: d.data().moNumber || d.data().orderNumber,
              name: d.data().name,
              status: d.data().status,
              currentStage: d.data().currentStage,
              totalEstimatedCost: d.data().totalEstimatedCost,
              createdAt: d.data().createdAt,
            })),
          }))
      );
    }

    const results = await Promise.all(promises);
    for (const r of results) {
      customer[r.key] = r.data;
    }

    // Summary stats
    customer.summary = {
      projectCount: (customer.projects || []).length,
      activeDeals: (customer.deals || []).filter(d => !['won', 'lost'].includes(d.stage)).length,
      totalDealValue: (customer.deals || []).reduce((sum, d) => sum + (d.value || 0), 0),
      activeMOs: (customer.manufacturingOrders || []).filter(m => m.status === 'in-progress').length,
    };

    return customer;
  },

  search_customers: async (input, context) => {
    const { searchTerm, type, status, limit = 10 } = input;

    let query = db.collection('customers');

    if (type) query = query.where('type', '==', type);
    if (status) query = query.where('status', '==', status);

    // Firestore doesn't support full-text search, so we fetch and filter client-side
    const snap = await query.limit(limit * 3).get();

    let customers = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || data.displayName,
        email: data.email,
        phone: data.phone,
        company: data.company,
        type: data.type,
        status: data.status,
        createdAt: data.createdAt,
      };
    });

    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      customers = customers.filter(c =>
        (c.name || '').toLowerCase().includes(term) ||
        (c.email || '').toLowerCase().includes(term) ||
        (c.company || '').toLowerCase().includes(term)
      );
    }

    return customers.slice(0, limit);
  },

  get_deals_pipeline: async (input, context) => {
    const { stage, ownerId, customerId, limit = 20 } = input;

    let query = db.collection('crm_deals');

    if (stage) query = query.where('stage', '==', stage);
    if (ownerId) query = query.where('ownerId', '==', ownerId);
    if (customerId) query = query.where('customerId', '==', customerId);

    if (!stage && !ownerId && !customerId) {
      query = query.orderBy('updatedAt', 'desc');
    }

    const snap = await query.limit(limit).get();

    const deals = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        title: data.title,
        stage: data.stage,
        value: data.value,
        currency: data.currency,
        probability: data.probability,
        weightedValue: (data.value || 0) * ((data.probability || 0) / 100),
        customerName: data.customerName,
        customerId: data.customerId,
        ownerName: data.ownerName,
        ownerId: data.ownerId,
        expectedCloseDate: data.expectedCloseDate,
        linkedProjectId: data.linkedProjectId,
        linkedMoId: data.linkedMoId,
        createdAt: data.createdAt,
        updatedAt: data.updatedAt,
      };
    });

    // Pipeline summary
    const pipelineSummary = {
      totalDeals: deals.length,
      totalValue: deals.reduce((sum, d) => sum + (d.value || 0), 0),
      totalWeightedValue: deals.reduce((sum, d) => sum + (d.weightedValue || 0), 0),
      byStage: {},
    };

    for (const deal of deals) {
      if (!pipelineSummary.byStage[deal.stage]) {
        pipelineSummary.byStage[deal.stage] = { count: 0, value: 0 };
      }
      pipelineSummary.byStage[deal.stage].count++;
      pipelineSummary.byStage[deal.stage].value += deal.value || 0;
    }

    return { summary: pipelineSummary, deals };
  },
};

module.exports = { definitions, handlers };
