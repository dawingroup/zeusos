/**
 * Supplier Hooks - Re-export from unified module
 *
 * @deprecated Import from '@/modules/suppliers' instead
 *
 * This file re-exports hooks from the unified supplier module for backwards compatibility.
 * All supplier hooks have been consolidated in src/modules/suppliers/hooks/useSuppliers.ts
 */

// Re-export all hooks from the unified module
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
  default,
} from '@/modules/suppliers/hooks/useSuppliers';

// Re-export hook return types
export type {
  UseSupplierReturn,
  UseSuppliersReturn,
  UseSuppliersOptions,
  UseSupplierSearchReturn,
  UseCreateSupplierReturn,
  UseSupplierPerformanceReturn,
  UseMaterialRatesReturn,
} from '@/modules/suppliers/hooks/useSuppliers';
