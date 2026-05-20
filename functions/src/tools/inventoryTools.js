/**
 * Inventory Domain Tools
 * Claude tool definitions and Firestore handlers for inventory items and stock levels.
 */

const admin = require('firebase-admin');
const db = admin.firestore();

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const definitions = [
  {
    name: 'search_inventory',
    description: 'Search inventory items by name, SKU, category, or tags. Returns stock levels, pricing, and supplier info. Use when looking up materials, parts, or products in the inventory system.',
    input_schema: {
      type: 'object',
      properties: {
        searchTerm: {
          type: 'string',
          description: 'Text to search for in item names, SKUs, or descriptions',
        },
        category: {
          type: 'string',
          enum: ['sheet-goods', 'solid-wood', 'hardware', 'edge-banding', 'finishing', 'adhesives', 'fasteners', 'other'],
          description: 'Filter by inventory category',
        },
        classification: {
          type: 'string',
          enum: ['material', 'product', 'kit'],
          description: 'Filter by item classification',
        },
        status: {
          type: 'string',
          enum: ['active', 'discontinued', 'out-of-stock'],
          description: 'Filter by item status',
        },
        lowStockOnly: {
          type: 'boolean',
          description: 'Only return items below their reorder level',
        },
        limit: {
          type: 'number',
          description: 'Maximum results',
          default: 20,
        },
      },
    },
  },
  {
    name: 'get_inventory_item',
    description: 'Get full details of a specific inventory item including all pricing tiers, supplier sources, stock levels, linked materials, and variant information. Use when diving into a specific item.',
    input_schema: {
      type: 'object',
      properties: {
        itemId: {
          type: 'string',
          description: 'Inventory item document ID',
        },
      },
      required: ['itemId'],
    },
  },
  {
    name: 'check_material_availability',
    description: 'Check stock availability for a list of materials required by a project or manufacturing order. Returns available quantities, shortages, and alternative supplier options. Use when planning production or quoting.',
    input_schema: {
      type: 'object',
      properties: {
        materialIds: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of inventory item IDs to check',
        },
        requiredQuantities: {
          type: 'array',
          items: { type: 'number' },
          description: 'Required quantity for each material (same order as materialIds)',
        },
      },
      required: ['materialIds', 'requiredQuantities'],
    },
  },
];

// ============================================================================
// HANDLERS
// ============================================================================

const handlers = {
  search_inventory: async (input, context) => {
    const { searchTerm, category, classification, status, lowStockOnly, limit = 20 } = input;

    let query = db.collection('inventoryItems');

    if (category) query = query.where('category', '==', category);
    if (classification) query = query.where('classification', '==', classification);
    if (status) query = query.where('status', '==', status);

    // Default: active items ordered by name
    if (!category && !classification && !status) {
      query = query.where('status', '==', 'active');
    }

    const snap = await query.limit(limit * 2).get(); // Over-fetch for client-side filtering

    let items = snap.docs.map(d => {
      const data = d.data();
      return {
        id: d.id,
        name: data.name,
        sku: data.sku,
        category: data.category,
        classification: data.classification,
        status: data.status,
        unit: data.unit,
        stockOnHand: data.stockOnHand || 0,
        reorderLevel: data.reorderLevel || 0,
        reorderQuantity: data.reorderQuantity || 0,
        costPrice: data.costPrice,
        sellPrice: data.sellPrice,
        currency: data.currency,
        primarySupplier: data.primarySupplier,
        tags: data.tags || [],
        dimensions: data.dimensions,
      };
    });

    // Client-side text search
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      items = items.filter(i =>
        (i.name || '').toLowerCase().includes(term) ||
        (i.sku || '').toLowerCase().includes(term) ||
        (i.tags || []).some(t => t.toLowerCase().includes(term))
      );
    }

    // Low stock filter
    if (lowStockOnly) {
      items = items.filter(i =>
        i.stockOnHand <= i.reorderLevel && i.reorderLevel > 0
      );
    }

    return items.slice(0, limit);
  },

  get_inventory_item: async (input, context) => {
    const { itemId } = input;

    const doc = await db.collection('inventoryItems').doc(itemId).get();
    if (!doc.exists) {
      return { error: 'Inventory item not found' };
    }

    return { id: doc.id, ...doc.data() };
  },

  check_material_availability: async (input, context) => {
    const { materialIds, requiredQuantities } = input;

    if (materialIds.length !== requiredQuantities.length) {
      return { error: 'materialIds and requiredQuantities must have the same length' };
    }

    const results = [];

    // Batch fetch all items
    const docs = await Promise.all(
      materialIds.map(id => db.collection('inventoryItems').doc(id).get())
    );

    for (let i = 0; i < materialIds.length; i++) {
      const doc = docs[i];
      const required = requiredQuantities[i];

      if (!doc.exists) {
        results.push({
          materialId: materialIds[i],
          status: 'not_found',
          required,
          available: 0,
          shortage: required,
        });
        continue;
      }

      const data = doc.data();
      const available = data.stockOnHand || 0;
      const shortage = Math.max(0, required - available);

      results.push({
        materialId: materialIds[i],
        name: data.name,
        sku: data.sku,
        status: shortage > 0 ? 'shortage' : 'available',
        required,
        available,
        shortage,
        unit: data.unit,
        reorderLevel: data.reorderLevel || 0,
        primarySupplier: data.primarySupplier,
        estimatedLeadTime: data.leadTimeDays,
        costPerUnit: data.costPrice,
        totalCostForShortage: shortage > 0 ? shortage * (data.costPrice || 0) : 0,
      });
    }

    const summary = {
      totalItems: results.length,
      availableItems: results.filter(r => r.status === 'available').length,
      shortageItems: results.filter(r => r.status === 'shortage').length,
      notFoundItems: results.filter(r => r.status === 'not_found').length,
      totalShortageCost: results.reduce((sum, r) => sum + (r.totalCostForShortage || 0), 0),
    };

    return { summary, items: results };
  },
};

module.exports = { definitions, handlers };
