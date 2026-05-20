/**
 * Unified Supplier Module
 *
 * Platform-wide supplier management with subsidiary filtering.
 * This module consolidates supplier functionality that was previously
 * in src/subsidiaries/advisory/matflow/
 *
 * Usage:
 * ```ts
 * import { useSuppliers, supplierService, SuppliersPage } from '@/modules/suppliers';
 *
 * // With subsidiary filtering
 * const { suppliers } = useSuppliers({ subsidiaryId: 'finishes' });
 *
 * // Get all suppliers
 * const allSuppliers = await supplierService.getSuppliers();
 * ```
 */

// Types
export * from './types/supplier';

// Service
export { supplierService, default as supplierServiceDefault } from './services/supplierService';
export {
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
} from './services/supplierService';

// Hooks
export {
  useSupplier,
  useSuppliers,
  useActiveSuppliers,
  useSuppliersByCategory,
  useSuppliersByMaterial,
  useSupplierSearch,
  useCreateSupplier,
  useSupplierPerformance,
  useMaterialRates,
} from './hooks/useSuppliers';

export type {
  UseSupplierReturn,
  UseSuppliersReturn,
  UseSuppliersOptions,
  UseSupplierSearchReturn,
  UseCreateSupplierReturn,
  UseSupplierPerformanceReturn,
  UseMaterialRatesReturn,
} from './hooks/useSuppliers';

// Pages
export { default as SuppliersPage } from './pages/SuppliersPage';
export { default as SupplierDetailPage } from './pages/SupplierDetailPage';
