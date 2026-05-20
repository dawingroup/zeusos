/**
 * Supplier Service - Re-export from unified module
 *
 * @deprecated Import from '@/modules/suppliers' instead
 *
 * This file re-exports the supplier service from the unified module for backwards compatibility.
 * All supplier functionality has been consolidated in src/modules/suppliers/services/supplierService.ts
 */

// Re-export everything from the unified module
export {
  supplierService,
  default,
  createSupplier,
  updateSupplier,
  getSupplier,
  deactivateSupplier,
  reactivateSupplier,
  blacklistSupplier,
  addMaterialRate,
  updateMaterialRate,
  removeMaterialRate,
  updatePerformanceMetrics,
  calculateSupplierRating,
  getSupplierPerformanceReport,
  getSuppliers,
  getActiveSuppliers,
  getSuppliersByCategory,
  getSuppliersByMaterial,
  searchSuppliers,
  subscribeToSupplier,
  subscribeToSuppliers,
  createQuotation,
  getSupplierQuotations,
  createRFQ,
  sendRFQ,
} from '@/modules/suppliers/services/supplierService';

// Re-export types for backwards compatibility
export type { SupplierCategory, CreateSupplierInput, MaterialRate } from '@/modules/suppliers/types/supplier';

// Legacy type aliases
export type { SupplierPickerValue as SupplierContact } from '@/modules/suppliers/types/supplier';

// Legacy interface for backwards compatibility
export interface SupplierPerformance {
  totalOrders: number;
  completedOrders: number;
  onTimeDeliveries: number;
  totalDeliveries: number;
  qualityPassRate: number;
  averageLeadTimeDays: number;
  rating: number;
  lastOrderDate?: import('firebase/firestore').Timestamp;
}
