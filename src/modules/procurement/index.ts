/**
 * Procurement Module
 * Purchase orders, procurement requirements, approval workflows, and vendor sourcing.
 * Cross-cutting "buy" module that serves inventory, assets, production, and operations.
 */

// Types
export * from './types/purchaseOrder';
export * from './types/procurement';
export * from './types/procurementRequest';
export * from './types/poPdfImport';
export * from './types/procurementAdvisor';

// Hooks
export { usePurchaseOrders } from './hooks/usePurchaseOrders';
export { usePurchaseOrder } from './hooks/usePurchaseOrder';
export { usePOItemSearch } from './hooks/usePOItemSearch';
export { useSupplierPicker } from './hooks/useSupplierPicker';
export { usePOPdfImport } from './hooks/usePOPdfImport';
export { useSmartConsolidationForSupplier, useConsolidationSummary } from './hooks/useSmartConsolidation';
export { useProcurementRequirements, useProcurementConsolidation } from './hooks/useProcurementRequirements';
export { useProcurementAdvisor } from './hooks/useProcurementAdvisor';

// Core Services
export * from './services/purchaseOrderService';
export * from './services/approvalWorkflowService';
export * from './services/procurementRequirementService';
export * from './services/smartConsolidationService';
export * from './services/supplierBridgeService';
export * from './services/procurementAdvisorService';

// Components
export { SupplierPicker } from './components/SupplierPicker';
export { CreatePurchaseOrderDialog } from './components/CreatePurchaseOrderDialog';
export { PODetailDrawer } from './components/PODetailDrawer';
export { GoodsReceiptDialog } from './components/GoodsReceiptDialog';
export { POItemPicker } from './components/POItemPicker';
export { POPdfImportDialog } from './components/POPdfImportDialog';
export { SmartConsolidationAlert } from './components/SmartConsolidationAlert';
export { SmartProcurementAdvisor } from './components/SmartProcurementAdvisor';
