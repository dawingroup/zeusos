/**
 * Suppliers module — shared directory of external 3rd-party vendors.
 *
 * Replaces the construction-focused DawinOS Suppliers module (removed in
 * Phase 1.C). This Phase 4 successor is marketing-domain shaped: media
 * houses, talent agencies, production houses, print shops, tech vendors.
 *
 * Owns: supplier_orgs/{supplierId}. Staff read; parent-org write.
 *
 * Linkage: `media_supplier_invoices.supplierOrgId` and
 * `purchase_orders.supplierOrgId` resolve against this directory.
 */

export type {
  Supplier,
  SupplierKind,
  SupplierStatus,
  SupplierContact,
  PaymentTerms,
  CurrencyCode,
} from './types/supplier.types';

export {
  createSupplier,
  getSupplier,
  listSuppliers,
  updateSupplier,
  activateSupplier,
  deactivateSupplier,
  blacklistSupplier,
} from './services/supplier.service';

export { SupplierKindBadge } from './components/SupplierKindBadge';
export { SupplierStatusBadge } from './components/SupplierStatusBadge';
export { SupplierForm } from './components/SupplierForm';

export { default as SuppliersListPage } from './pages/SuppliersListPage';
export { default as SupplierDetailPage } from './pages/SupplierDetailPage';
export { default as SupplierCreatePage } from './pages/SupplierCreatePage';
export { default as SupplierEditPage } from './pages/SupplierEditPage';
