/**
 * Design Manager Services
 * Business logic and API services for the design manager module
 */

// Firestore operations
export {
  // Project operations
  createProject,
  updateProject,
  getProject,
  getProjects,
  subscribeToProject,
  subscribeToProjects,
  
  // Design Item operations
  createDesignItem,
  updateDesignItem,
  deleteDesignItem,
  getDesignItem,
  getDesignItems,
  subscribeToDesignItems,
  subscribeToDesignItem,
  
  // RAG operations
  updateRAGAspect,
  batchUpdateRAGAspects,
  
  // Stage operations
  transitionStage,
  
  // Client Interaction operations
  createClientInteraction,
  updateClientInteraction,
  deleteClientInteraction,
  getClientInteraction,
  getClientInteractions,
  subscribeToClientInteractions,

  // Deliverable operations
  createDeliverable,
  subscribeToDeliverables,
  updateDeliverableStatus,
  deleteDeliverable,
} from './firestore';

// Material Harvester operations
export {
  harvestMaterials,
  mapMaterialToInventory,
  unmapMaterial,
  normalizeMaterialName,
  extractThickness,
  detectMaterialType,
  getPaletteStats,
  allMaterialsMapped,
  type HarvestResult,
  type MaterialUsage,
} from './materialHarvester';
