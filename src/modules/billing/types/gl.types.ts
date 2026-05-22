/**
 * General-Ledger adapter types — pluggable per-subsidiary.
 *
 * Each subsidiary may eventually connect a different accounting system
 * (QBO, Xero, Sage). The default adapter writes to a Firestore audit
 * collection (`gl_postings/{id}`) so we can post + reconcile without an
 * external connection. Phase 5 swaps in real QBO/Xero implementations.
 *
 * See plan §14.10 ("Encode organizations/{orgId}.gl_connection_id").
 */

import type { Timestamp } from 'firebase/firestore';

export type GLAdapterName = 'firestore-audit' | 'qbo' | 'xero' | 'sage';

export interface GLConnectionConfig {
  /** Which entity this connection belongs to. */
  orgId: string;
  /** Selected adapter. */
  adapter: GLAdapterName;
  /** Whether the integration is reachable. */
  status: 'CONNECTED' | 'DISCONNECTED' | 'NOT_CONFIGURED' | 'ERROR';
  /** Last successful sync. */
  lastSyncAt?: Timestamp | string;
  /** Number of postings queued and not yet acknowledged by the remote. */
  queueDepth?: number;
  /** Last error message, if status === 'ERROR'. */
  lastError?: string;
  /** Adapter-specific config payload (OAuth tokens, realm IDs, etc.) —
   *  read+write only by the trusted Cloud Functions side; UI never reads. */
  config?: Record<string, unknown>;
}

export interface GLConnectionHealth {
  adapter: GLAdapterName;
  status: GLConnectionConfig['status'];
  lastSyncAt?: Timestamp | string;
  queueDepth: number;
  message?: string;
}

/**
 * A single posted journal entry — already balanced (sum debits = sum
 * credits). Each `InterCompanyInvoice` produces TWO posts (one to the
 * subsidiary's GL, one to the parent's) which the adapter is responsible
 * for keeping atomic.
 */
export interface GLJournalEntry {
  /** Which entity's books this posts to. */
  entityOrgId: string;
  /** Reference back to the source (IC invoice ID, client invoice ID, etc.). */
  sourceDocType: 'INTERCOMPANY_INVOICE' | 'CLIENT_INVOICE' | 'CLIENT_PAYMENT';
  sourceDocId: string;
  /** Posting date (book date). */
  date: string;             // YYYY-MM-DD
  /** Description shown on the GL. */
  memo: string;
  /** Currency of the postings — adapter does not currency-convert. */
  currency: string;
  lines: GLJournalLine[];
  /** Idempotency key — adapters MUST deduplicate by this. */
  idempotencyKey: string;
}

export interface GLJournalLine {
  accountCode: string;
  /** Exactly one of debit / credit is set per line; both in minor units. */
  debitMinor?: number;
  creditMinor?: number;
  memo?: string;
}

export interface GLPostResult {
  /** Adapter's internal reference (for QBO this is the QuickBooks entry ID;
   *  for the audit adapter it's the Firestore doc ID). */
  remoteRef: string;
  postedAt: Timestamp | string;
}

/**
 * The audit-trail document persisted at `gl_postings/{id}` regardless of
 * which adapter accepts the post. Keeps the application-side record of
 * truth even if a remote system is unreachable.
 */
export interface GLPosting {
  id: string;
  entityOrgId: string;
  sourceDocType: GLJournalEntry['sourceDocType'];
  sourceDocId: string;
  adapter: GLAdapterName;
  remoteRef?: string;
  status: 'PENDING' | 'POSTED' | 'FAILED';
  lines: GLJournalLine[];
  currency: string;
  memo: string;
  idempotencyKey: string;
  postedAt?: Timestamp | string;
  error?: string;
}
