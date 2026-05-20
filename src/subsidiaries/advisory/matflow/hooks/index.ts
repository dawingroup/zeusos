/**
 * MatFlow Hooks Index
 * 
 * Central export for all MatFlow React hooks.
 */

// Existing hooks
export * from './useBOQ';
export * from './useBOQParsing';
export * from './useBOQReview';
export * from './useCustomers';
export * from './useEFRIS';
export * from './useExport';
export * from './useFormulaSuggestions';
export * from './useFormulas';
export * from './useMatFlow';
export * from './useMaterialCalculator';
export * from './useMediaQuery';
export * from './useNetworkStatus';
export * from './usePermissions';
export * from './useProcurement';
export * from './useProjects';
export * from './usePushNotifications';
export * from './useStageProgress';
export * from './useSyncStatus';
export * from './useVariance';

// New BOQ document hooks
export {
  useBOQ,
  useProjectBOQs,
  useBOQMutations,
  useSectionMutations,
  useItemMutations,
  useBOQVariations,
  useVariationMutations
} from './boq-hooks';

// New Material hooks
export {
  useMaterial,
  useMaterials,
  useMaterialsByCategory,
  useMaterialSearch,
  useMaterialMutations,
  useProjectMaterials,
  useProjectMaterialMutations,
  useProjectTransfers,
  useTransferMutations
} from './material-hooks';

// New Requisition hooks
export {
  useRequisition,
  useProjectRequisitions,
  useRequisitionsByStatus,
  usePendingApprovalRequisitions,
  useRequisitionMutations,
  useRequisitionItemMutations,
  useRequisitionWorkflow
} from './requisition-hooks';

// New Procurement hooks
export {
  useProjectProcurement,
  useMaterialProcurement,
  useProcurementMutations,
  usePurchaseOrder,
  useProjectPurchaseOrders,
  usePurchaseOrderMutations,
  useSupplier,
  useActiveSuppliers,
  useSuppliersByCategory,
  useSupplierMutations,
  useProjectQuotations,
  useQuotationMutations
} from './procurement-hooks';

// AI Parsing hooks
export {
  useParsingJob,
  useFileUpload,
  useLocalParsing,
  useParsingReview,
  useApplyToBOQ,
  type UseParsingJobReturn,
  type UseFileUploadReturn,
  type UseLocalParsingReturn,
  type UseParsingReviewReturn,
  type UseApplyToBOQReturn,
} from './parsing-hooks';

// Supplier hooks (from supplier-hooks.ts)
export {
  useSupplier as useSupplierDetail,
  useSuppliers,
  useActiveSuppliers as useActiveSuppliersNew,
  useSuppliersByCategory as useSuppliersByCategoryNew,
  useSuppliersByMaterial,
  useSupplierSearch,
  useCreateSupplier,
  useSupplierPerformance,
  useMaterialRates,
  type UseSupplierReturn,
  type UseSuppliersReturn,
  type UseSupplierSearchReturn,
  type UseCreateSupplierReturn,
  type UseSupplierPerformanceReturn,
  type UseMaterialRatesReturn,
} from './supplier-hooks';

// Dashboard hooks
export {
  useBudgetSummary,
  useProjectMetrics,
  type BudgetSummary,
  type ProjectMetrics,
  type UseBudgetSummaryReturn,
  type UseProjectMetricsReturn,
} from './dashboard-hooks';

// Offline hooks
export {
  useOfflineStatus,
  type UseOfflineStatusReturn,
} from './offline-hooks';
