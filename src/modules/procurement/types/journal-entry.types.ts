/**
 * JournalEntry — Phase 4.1 GL posting primitive.
 *
 * Written by `postJournalEntryOnInvoicePaid` (finance consumer) after a
 * PurchaseOrderRaised or ClientInvoicePaid event lands. Stored under
 * `journal_entries/{jeId}` with deterministic id
 * `je_${kind.toLowerCase()}_${sourceDocId}`.
 *
 * This is the lightweight Phase 4.1 shape used by the procurement /
 * finance handshake. The full `src/modules/finance/types/journal.types.ts`
 * shape (fiscal year, currency conversion, dimensions) is the longer-
 * term target for the full GL ledger.
 *
 * Writes are CFn-only — firestore.rules blocks all client writes on
 * `journal_entries/*`.
 */

import type { Timestamp } from 'firebase/firestore';

export type JournalEntryKind =
  | 'TALENT_FREELANCER'
  | 'MEDIA_SUPPLIER'
  | 'CLIENT_REVENUE_RECOGNISED';

export type JournalEntrySourceDocKind =
  | 'PurchaseOrderRaised'
  | 'ClientInvoicePaid';

export interface JournalLine {
  accountCode: string;
  accountName: string;
  amountMinor: number;
  description: string;
}

export interface JournalEntry {
  id: string;
  kind: JournalEntryKind;
  sourceDocId: string;
  sourceDocKind: JournalEntrySourceDocKind;
  currency: string;
  debits: JournalLine[];
  credits: JournalLine[];
  postedAt: Timestamp | string;
  idempotencyKey?: string | null;
  orgId: string;
  createdAt: Timestamp | string;
  updatedAt: Timestamp | string;
}
