/**
 * Cutlist Processor Services
 * Business logic and API services for the cutlist processor module
 * 
 * Re-exports from existing services during migration
 */

// PDF Export Service
export { 
  generateOptimizationPDF, 
  downloadOptimizationPDF 
} from '../../../services/pdfExportService';

// Material Mapping Service
export { 
  analyzeMaterials,
  saveMapping,
  getStockMaterials as getMaterialStockMaterials,
  incrementMappingUsage,
  getAllMappings,
  deleteMapping
} from '../../../services/materialMapping';

// Config Service
export {
  loadConfig,
  saveConfig,
  getDefaultConfig
} from '../../../services/configService';

// Stock Materials Service
export {
  getStockMaterials,
  addStockMaterial,
  updateStockMaterial,
  deleteStockMaterial
} from '../../../services/stockMaterialsService';

// Work Instance Service
export {
  createWorkInstance,
  updateWorkInstance,
  getWorkInstance,
  getProjectInstances,
  getRecentInstances,
  getAllRecentInstances,
  subscribeToInstance,
  updateInstanceStatus,
  addDriveFileLink,
  deleteWorkInstance
} from '../../../services/workInstanceService';
