/**
 * GL Adapter interface + Firestore audit-trail default implementation.
 *
 * Every GL post — whether eventually relayed to QBO/Xero or not — lands
 * in the `gl_postings/{id}` audit collection. That keeps the application
 * record-of-truth independent of the remote system. Adapters MUST be
 * idempotent on the supplied `idempotencyKey`.
 *
 * QBO/Xero implementations are intentionally deferred to Phase 5. The
 * fails-safe behavior for unconfigured connections lives in
 * `gl-adapter.qbo.ts`.
 */

import {
  addDoc,
  collection,
  doc,
  getDoc,
  query,
  serverTimestamp,
  where,
  getDocs,
  limit,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  GLAdapterName,
  GLConnectionConfig,
  GLConnectionHealth,
  GLJournalEntry,
  GLPostResult,
  GLPosting,
} from '../types/gl.types';
import { COLLECTIONS } from '../constants/collections';

export interface GLAdapter {
  readonly name: GLAdapterName;
  /** Post a balanced journal entry. Adapter MUST return the same
   *  remoteRef on retries with the same idempotencyKey. */
  postJournal(entry: GLJournalEntry): Promise<GLPostResult>;
  /** Health probe — drives the GL Adapter Status page. */
  status(orgId: string): Promise<GLConnectionHealth>;
}

// ─────────────────────────────────────────────────────────────────
// Default adapter — write-through audit trail in Firestore.
// ─────────────────────────────────────────────────────────────────

class FirestoreAuditGLAdapter implements GLAdapter {
  readonly name: GLAdapterName = 'firestore-audit';

  async postJournal(entry: GLJournalEntry): Promise<GLPostResult> {
    assertBalanced(entry);

    // Idempotency: if a posting with this key already exists for this
    // entity, return the prior remoteRef. Mirrors what a real GL would do.
    const existing = await this.findByIdempotencyKey(entry.entityOrgId, entry.idempotencyKey);
    if (existing) {
      return {
        remoteRef: existing.id,
        postedAt: existing.postedAt ?? new Date().toISOString(),
      };
    }

    const posting: Omit<GLPosting, 'id'> = {
      entityOrgId: entry.entityOrgId,
      sourceDocType: entry.sourceDocType,
      sourceDocId: entry.sourceDocId,
      adapter: this.name,
      status: 'POSTED',
      lines: entry.lines,
      currency: entry.currency,
      memo: entry.memo,
      idempotencyKey: entry.idempotencyKey,
      postedAt: serverTimestamp() as unknown as string,
    };

    const ref = await addDoc(collection(db, COLLECTIONS.GL_POSTINGS), posting);

    if (typeof console !== 'undefined') {
      console.info('[gl-adapter:firestore-audit] posted', {
        entityOrgId: entry.entityOrgId,
        sourceDocType: entry.sourceDocType,
        sourceDocId: entry.sourceDocId,
        currency: entry.currency,
        lines: entry.lines.length,
        memo: entry.memo,
        postingId: ref.id,
      });
    }

    return { remoteRef: ref.id, postedAt: new Date().toISOString() };
  }

  async status(orgId: string): Promise<GLConnectionHealth> {
    // The audit adapter is always reachable — Firestore IS the backing
    // store. Queue depth = pending postings for this org.
    const q = query(
      collection(db, COLLECTIONS.GL_POSTINGS),
      where('entityOrgId', '==', orgId),
      where('status', '==', 'PENDING'),
      limit(50),
    );
    let queueDepth = 0;
    try {
      const snap = await getDocs(q);
      queueDepth = snap.size;
    } catch {
      // Permissions / offline — surface zero rather than blow up the UI.
      queueDepth = 0;
    }
    return {
      adapter: this.name,
      status: 'CONNECTED',
      queueDepth,
      message: 'Audit-trail adapter (Firestore-backed).',
    };
  }

  private async findByIdempotencyKey(
    entityOrgId: string,
    key: string,
  ): Promise<GLPosting | null> {
    if (!key) return null;
    try {
      const q = query(
        collection(db, COLLECTIONS.GL_POSTINGS),
        where('entityOrgId', '==', entityOrgId),
        where('idempotencyKey', '==', key),
        limit(1),
      );
      const snap = await getDocs(q);
      if (snap.empty) return null;
      const docSnap = snap.docs[0];
      return { id: docSnap.id, ...(docSnap.data() as Omit<GLPosting, 'id'>) };
    } catch {
      return null;
    }
  }
}

export const firestoreAuditGLAdapter = new FirestoreAuditGLAdapter();

// ─────────────────────────────────────────────────────────────────
// Adapter resolver
// ─────────────────────────────────────────────────────────────────

/**
 * Resolve which adapter to use for a given org. Reads
 * `gl_connections/{orgId}` if present; otherwise defaults to the
 * Firestore audit adapter so the standalone slice works without any
 * Phase-5 config.
 */
export async function resolveAdapter(orgId: string): Promise<GLAdapter> {
  try {
    const snap = await getDoc(doc(db, COLLECTIONS.GL_CONNECTIONS, orgId));
    if (snap.exists()) {
      const cfg = snap.data() as GLConnectionConfig;
      if (cfg.adapter === 'qbo') {
        // Lazy import keeps the QBO bundle out of the default path.
        const { qboGLAdapter } = await import('./gl-adapter.qbo');
        return qboGLAdapter;
      }
      // 'xero'/'sage' fall through to the audit adapter for now (Phase 5).
    }
  } catch {
    // Fall through — audit adapter is the safe default.
  }
  return firestoreAuditGLAdapter;
}

// ─────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────

function assertBalanced(entry: GLJournalEntry): void {
  let debits = 0;
  let credits = 0;
  for (const line of entry.lines) {
    debits  += line.debitMinor  ?? 0;
    credits += line.creditMinor ?? 0;
  }
  if (debits !== credits) {
    throw new Error(
      `[gl-adapter] Unbalanced journal entry for ${entry.sourceDocId}: ` +
        `debits ${debits} ≠ credits ${credits}`,
    );
  }
  if (debits === 0) {
    throw new Error(
      `[gl-adapter] Zero-amount journal entry for ${entry.sourceDocId}`,
    );
  }
}

/**
 * Build the two journal entries (subsidiary + parent) for an IC invoice.
 *
 * Per plan §14.8:
 *  - subsidiary GL: AR (debit) ↔ Revenue (credit)
 *  - parent GL:     Cost (debit) ↔ AP (credit)
 *
 * Account codes are placeholders aligned with the existing Finance CoA
 * (1200 AR / 4000 Revenue / 5000 Cost / 2000 AP). Phase 5 wires these
 * to per-subsidiary CoA mappings.
 */
export function buildICJournalEntries(args: {
  invoiceId: string;
  fromOrgId: string;
  toOrgId: string;
  amountMinor: number;
  currency: string;
  memo: string;
  date?: string;
}): [GLJournalEntry, GLJournalEntry] {
  const date = args.date ?? new Date().toISOString().slice(0, 10);
  const idempotencyKey = `IC_INVOICE:${args.invoiceId}`;

  const subsidiaryEntry: GLJournalEntry = {
    entityOrgId: args.fromOrgId,
    sourceDocType: 'INTERCOMPANY_INVOICE',
    sourceDocId: args.invoiceId,
    date,
    currency: args.currency,
    memo: args.memo,
    idempotencyKey: `${idempotencyKey}:subsidiary`,
    lines: [
      { accountCode: '1200', debitMinor:  args.amountMinor, memo: 'IC AR — receivable from parent' },
      { accountCode: '4000', creditMinor: args.amountMinor, memo: 'IC Revenue — services rendered' },
    ],
  };

  const parentEntry: GLJournalEntry = {
    entityOrgId: args.toOrgId,
    sourceDocType: 'INTERCOMPANY_INVOICE',
    sourceDocId: args.invoiceId,
    date,
    currency: args.currency,
    memo: args.memo,
    idempotencyKey: `${idempotencyKey}:parent`,
    lines: [
      { accountCode: '5000', debitMinor:  args.amountMinor, memo: 'IC Cost — services received' },
      { accountCode: '2000', creditMinor: args.amountMinor, memo: 'IC AP — payable to subsidiary' },
    ],
  };

  return [subsidiaryEntry, parentEntry];
}
