/**
 * Procurement module — Phase 4.1.
 *
 * Owns: purchase_orders and journal_entries.
 * TALENT_FREELANCER + MEDIA_SUPPLIER POs are written by Phase 4.1 outbox
 * consumers (CFn / Admin SDK). VENDOR_OTHER POs additionally support a
 * manual-entry UI for admin users — see PurchaseOrderCreatePage and the
 * createManualPurchaseOrder service. Subsidiary principals cannot read
 * any of this (supplier costs are commercial-gravity-sensitive).
 */

export type {
  PurchaseOrder,
  PurchaseOrderKind,
  PurchaseOrderStatus,
  CurrencyCode,
} from './types/purchase-order.types';
export { buildPurchaseOrderId } from './types/purchase-order.types';

export type {
  JournalEntry,
  JournalEntryKind,
  JournalEntrySourceDocKind,
  JournalLine,
} from './types/journal-entry.types';

export {
  getPurchaseOrder,
  listPurchaseOrders,
  getPurchaseOrderBySourceInvoice,
  createManualPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder,
} from './services/purchase-order.service';

export {
  getJournalEntry,
  listJournalEntries,
  getJournalEntryForPO,
  isBalanced,
} from './services/journal-entry.service';

export { PurchaseOrderStatusBadge } from './components/PurchaseOrderStatusBadge';
export { PurchaseOrderKindBadge } from './components/PurchaseOrderKindBadge';

export { default as PurchaseOrdersListPage } from './pages/PurchaseOrdersListPage';
export { default as PurchaseOrderCreatePage } from './pages/PurchaseOrderCreatePage';
export { default as PurchaseOrderDetailPage } from './pages/PurchaseOrderDetailPage';
export { default as JournalEntriesListPage } from './pages/JournalEntriesListPage';
export { default as JournalEntryDetailPage } from './pages/JournalEntryDetailPage';
