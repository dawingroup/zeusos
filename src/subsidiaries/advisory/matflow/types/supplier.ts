/**
 * Supplier Types - Re-export from unified module
 *
 * @deprecated Import from '@/modules/suppliers' instead
 *
 * This file re-exports types from the unified supplier module for backwards compatibility.
 * All supplier types have been consolidated in src/modules/suppliers/types/supplier.ts
 */

// Re-export all types from the unified module
export {
  // Base types
  type Money,
  type AuditFields,

  // Supplier types
  type Supplier,
  type SupplierStatus,
  type SupplierAddress,
  type BankDetails,
  type SupplierDocument,
  type SupplierDocumentType,
  type SubsidiaryId,

  // Rating types
  type SupplierRating,

  // Quotation types
  type SupplierQuotation,
  type QuotationItem,

  // RFQ types
  type RequestForQuotation,
  type RFQItem,

  // Material rates
  type MaterialRate,

  // Input types
  type SupplierCategory,
  type CreateSupplierInput,
  type UpdateSupplierInput,
  type SupplierPickerValue,

  // Filter types
  type SupplierFilters,
  type SupplierSortOptions,

  // Config objects
  SUPPLIER_STATUS_CONFIG,
  SUPPLIER_CATEGORY_CONFIG,
  SUBSIDIARY_CONFIG,
} from '@/modules/suppliers/types/supplier';

// Backwards compatibility aliases
export type { Money as BOQMoney, AuditFields as BOQAuditFields } from '@/modules/suppliers/types/supplier';
