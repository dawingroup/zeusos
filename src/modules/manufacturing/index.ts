export { default as ManufacturingModule } from './ManufacturingModule';

// Types (MO-specific only)
export * from './types';

// Hooks (MO-specific only)
export * from './hooks';

// Shared Components
export * from './components/shared';

// Core Services
export * from './services/manufacturingOrderService';
export * from './services/handoverService';

// Integration Services
// Note: inventoryIntegrationService has its own checkMaterialAvailability that conflicts with handoverService
// Use explicit imports if you need both: import { checkMaterialAvailability as checkMaterialAvailabilityEnhanced } from './services/inventoryIntegrationService'
export {
  generateProcurementFromShortages,
  getReorderAlerts,
  getMOStockStatus,
} from './services/inventoryIntegrationService';
export * from './services/bulkOperationsService';
export * from './services/unifiedDashboardService';

// MES Services
export { manufacturingExecutionService } from './services/manufacturingExecutionService';
export { bomService } from './services/bomService';
export { workstationService } from './services/workstationService';
export { designToManufacturingService } from './services/designToManufacturingService';
export { manufacturingAnalyticsService } from './services/manufacturingAnalyticsService';
