/**
 * Procurement module — Phase 4.1.
 *
 * Owns: purchase_orders and journal_entries (parent-org-only read; CFn-only write).
 * The PO + JE docs are written by the Phase 4.1 outbox consumers; this module
 * provides the read-side UI for finance / leadership.
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
export { default as PurchaseOrderDetailPage } from './pages/PurchaseOrderDetailPage';
export { default as JournalEntriesListPage } from './pages/JournalEntriesListPage';
export { default as JournalEntryDetailPage } from './pages/JournalEntryDetailPage';
