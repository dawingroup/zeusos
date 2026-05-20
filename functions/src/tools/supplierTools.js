/**
 * Supplier Domain Tools
 * Claude tool definitions and Firestore handlers for suppliers/vendors.
 */

const admin = require('firebase-admin');
const db = admin.firestore();

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const definitions = [
  {
    name: 'search_suppliers',
    description: 'Search suppliers by name, category, or status. Returns supplier details including contact info, ratings, and material categories they supply. Use when looking for sourcing options or evaluating suppliers.',
    input_schema: {
      type: 'object',
      properties: {
        searchTerm: {
          type: 'string',
          description: 'Text to search for in supplier names or categories',
        },
        category: {
          type: 'string',
          description: 'Filter by material category they supply (e.g., sheet-goods, hardware)',
        },
        status: {
          type: 'string',
          enum: ['active', 'inactive', 'blacklisted', 'pending_approval'],
          description: 'Filter by supplier status',
        },
        limit: {
          type: 'number',
          description: 'Maximum results',
          default: 10,
        },
      },
    },
  },
  {
    name: 'get_supplier_detail',
    description: 'Get complete supplier information including contact details, performance ratings, material categories, pricing history, and linked purchase orders. Use when evaluating a specific supplier.',
    input_schema: {
      type: 'object',
      properties: {
        supplierId: {
          type: 'string',
          description: 'Supplier document ID',
        },
      },
      required: ['supplierId'],
    },
  },
];

// ============================================================================
// HANDLERS
// ============================================================================

const handlers = {
  search_suppliers: async (input, context) => {
    const { searchTerm, category, status, limit = 10 } = input;

    // Try 'suppliers' collection first, fall back to 'vendors'
    let snap;
    try {
      let query = db.collection('suppliers');
      if (status) query = query.where('status', '==', status);
      snap = await query.limit(limit * 3).get();
    } catch (e) {
      snap = { empty: true, docs: [] };
    }

    if (snap.empty) {
      try {
        let query = db.collection('vendors');
        if (status) query = query.where('status', '==', status);
        snap = await query.limit(limit * 3).get();
      } catch (e) {
        return [];
      }
    }

    let suppliers = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name || data.companyName,
        contactPerson: data.contactPerson || data.contactName,
        email: data.email,
        phone: data.phone,
        status: data.status,
        categories: data.categories || data.materialCategories || [],
        rating: data.rating,
        leadTimeDays: data.leadTimeDays || data.averageLeadTime,
        currency: data.currency,
        country: data.country,
        city: data.city,
        paymentTerms: data.paymentTerms,
      };
    });

    // Client-side filters
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      suppliers = suppliers.filter(s =>
        (s.name || '').toLowerCase().includes(term) ||
        (s.contactPerson || '').toLowerCase().includes(term) ||
        (s.categories || []).some(c => c.toLowerCase().includes(term))
      );
    }

    if (category) {
      const cat = category.toLowerCase();
      suppliers = suppliers.filter(s =>
        (s.categories || []).some(c => c.toLowerCase().includes(cat))
      );
    }

    return suppliers.slice(0, limit);
  },

  get_supplier_detail: async (input, context) => {
    const { supplierId } = input;

    // Try both collections
    let doc = await db.collection('suppliers').doc(supplierId).get();
    if (!doc.exists) {
      doc = await db.collection('vendors').doc(supplierId).get();
    }
    if (!doc.exists) {
      return { error: 'Supplier not found' };
    }

    const supplier = { id: doc.id, ...doc.data() };

    // Load recent POs for this supplier
    try {
      const poSnap = await db.collection('purchaseOrders')
        .where('supplierId', '==', supplierId)
        .orderBy('createdAt', 'desc')
        .limit(5)
        .get();

      supplier.recentPurchaseOrders = poSnap.docs.map(d => ({
        id: d.id,
        poNumber: d.data().poNumber,
        status: d.data().status,
        total: d.data().total,
        currency: d.data().currency,
        createdAt: d.data().createdAt,
      }));
    } catch (e) {
      supplier.recentPurchaseOrders = [];
    }

    return supplier;
  },
};

module.exports = { definitions, handlers };
