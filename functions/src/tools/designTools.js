/**
 * Design Domain Tools
 * Claude tool definitions and Firestore handlers for design projects and items.
 */

const admin = require('firebase-admin');
const db = admin.firestore();

// ============================================================================
// TOOL DEFINITIONS
// ============================================================================

const definitions = [
  {
    name: 'get_project_overview',
    description: 'Get a design project with its design items, material palette, optimization state, and customer info. Use when the user asks about a specific project or wants to understand project status.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Firestore document ID of the design project',
        },
        includeDesignItems: {
          type: 'boolean',
          description: 'Whether to include all design items in the project',
          default: true,
        },
        includeMaterialPalette: {
          type: 'boolean',
          description: 'Whether to include the material palette with mapped/unmapped materials',
          default: true,
        },
      },
      required: ['projectId'],
    },
  },
  {
    name: 'search_design_items',
    description: 'Search design items across all projects by name, stage, category, or material. Use when the user wants to find specific design items or understand what items match certain criteria.',
    input_schema: {
      type: 'object',
      properties: {
        searchTerm: {
          type: 'string',
          description: 'Text to search for in item names or descriptions',
        },
        stage: {
          type: 'string',
          enum: ['concept', 'preliminary', 'technical', 'pre-production', 'production-ready'],
          description: 'Filter by design stage',
        },
        category: {
          type: 'string',
          enum: ['MANUFACTURED', 'PROCURED', 'ACCESSORY', 'ARCHITECTURAL', 'CONSTRUCTION'],
          description: 'Filter by sourcing category',
        },
        projectId: {
          type: 'string',
          description: 'Filter by specific project',
        },
        customerId: {
          type: 'string',
          description: 'Filter by customer who owns the project',
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
    name: 'get_project_optimization',
    description: 'Get the cutting optimization results for a project including sheet usage, timber cutting, waste percentages, and cost estimates. Use when discussing production planning or material efficiency.',
    input_schema: {
      type: 'object',
      properties: {
        projectId: {
          type: 'string',
          description: 'Project document ID',
        },
        mode: {
          type: 'string',
          enum: ['estimation', 'production'],
          description: 'Optimization mode — estimation for quoting, production for actual cutting',
          default: 'estimation',
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
  get_project_overview: async (input, context) => {
    const { projectId, includeDesignItems = true, includeMaterialPalette = true } = input;

    const projectDoc = await db.collection('designProjects').doc(projectId).get();
    if (!projectDoc.exists) {
      return { error: 'Project not found' };
    }

    const project = { id: projectDoc.id, ...projectDoc.data() };

    // Load customer info if present
    if (project.customerId) {
      const customerDoc = await db.collection('customers').doc(project.customerId).get();
      if (customerDoc.exists) {
        const cData = customerDoc.data();
        project.customerName = cData.name || cData.displayName;
        project.customerEmail = cData.email;
        project.customerType = cData.type;
      }
    }

    // Load design items
    if (includeDesignItems) {
      const itemsSnap = await db.collection('designProjects')
        .doc(projectId).collection('designItems')
        .orderBy('createdAt', 'desc')
        .get();

      project.designItems = itemsSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name,
        itemType: d.data().itemType,
        category: d.data().category,
        stage: d.data().stage,
        quantity: d.data().quantity,
        status: d.data().status,
        dimensions: d.data().dimensions,
        material: d.data().material,
        finish: d.data().finish,
      }));
      project.designItemCount = project.designItems.length;
    }

    // Load material palette
    if (includeMaterialPalette) {
      const materialsSnap = await db.collection('designProjects')
        .doc(projectId).collection('materials')
        .get();

      project.materialPalette = materialsSnap.docs.map(d => ({
        id: d.id,
        name: d.data().name,
        type: d.data().type,
        category: d.data().category,
        inventoryItemId: d.data().inventoryItemId,
        mapped: !!d.data().inventoryItemId,
      }));
    }

    return project;
  },

  search_design_items: async (input, context) => {
    const { searchTerm, stage, category, projectId, customerId, limit = 20 } = input;

    // If projectId is specified, search within that project's subcollection
    if (projectId) {
      let query = db.collection('designProjects')
        .doc(projectId).collection('designItems');

      if (stage) query = query.where('stage', '==', stage);
      if (category) query = query.where('category', '==', category);

      const snap = await query.limit(limit).get();
      let items = snap.docs.map(d => ({
        id: d.id,
        projectId,
        ...pickItemFields(d.data()),
      }));

      // Client-side text filter
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        items = items.filter(i =>
          (i.name || '').toLowerCase().includes(term) ||
          (i.itemType || '').toLowerCase().includes(term) ||
          (i.material || '').toLowerCase().includes(term)
        );
      }

      return items;
    }

    // Search across all projects — query top-level designItems if it exists,
    // otherwise search recent projects and their items
    let projectQuery = db.collection('designProjects')
      .orderBy('updatedAt', 'desc')
      .limit(10);

    if (customerId) {
      projectQuery = db.collection('designProjects')
        .where('customerId', '==', customerId)
        .orderBy('updatedAt', 'desc')
        .limit(10);
    }

    const projectsSnap = await projectQuery.get();
    const allItems = [];

    for (const projDoc of projectsSnap.docs) {
      let itemQuery = projDoc.ref.collection('designItems');
      if (stage) itemQuery = itemQuery.where('stage', '==', stage);
      if (category) itemQuery = itemQuery.where('category', '==', category);

      const itemsSnap = await itemQuery.limit(limit).get();
      for (const d of itemsSnap.docs) {
        allItems.push({
          id: d.id,
          projectId: projDoc.id,
          projectName: projDoc.data().name || projDoc.data().code,
          ...pickItemFields(d.data()),
        });
      }

      if (allItems.length >= limit) break;
    }

    // Client-side text filter
    let results = allItems;
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      results = results.filter(i =>
        (i.name || '').toLowerCase().includes(term) ||
        (i.itemType || '').toLowerCase().includes(term) ||
        (i.material || '').toLowerCase().includes(term)
      );
    }

    return results.slice(0, limit);
  },

  get_project_optimization: async (input, context) => {
    const { projectId, mode = 'estimation' } = input;

    const projectDoc = await db.collection('designProjects').doc(projectId).get();
    if (!projectDoc.exists) {
      return { error: 'Project not found' };
    }

    const data = projectDoc.data();
    const optimizationState = data.optimizationState || {};

    if (mode === 'estimation') {
      return {
        projectId,
        projectName: data.name || data.code,
        mode: 'estimation',
        estimationState: optimizationState.estimation || { status: 'not_run' },
        ragStatus: data.ragStatus || {},
      };
    }

    return {
      projectId,
      projectName: data.name || data.code,
      mode: 'production',
      productionState: optimizationState.production || { status: 'not_run' },
      ragStatus: data.ragStatus || {},
    };
  },
};

// ============================================================================
// HELPERS
// ============================================================================

function pickItemFields(data) {
  return {
    name: data.name,
    itemType: data.itemType,
    category: data.category,
    stage: data.stage,
    quantity: data.quantity,
    status: data.status,
    dimensions: data.dimensions,
    material: data.material,
    finish: data.finish,
    hardware: data.hardware,
    constructionMethod: data.constructionMethod,
  };
}

module.exports = { definitions, handlers };
