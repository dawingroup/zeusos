import { initializeApp, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue, type Firestore, type DocumentData } from 'firebase-admin/firestore';

export { FieldValue };
export const serverTimestamp = () => FieldValue.serverTimestamp();
import { CHARACTER_LIMIT } from '../constants.js';

// ─── Firebase Admin init ──────────────────────────────────────────────────────
// Double-init guard: when loaded inside Cloud Functions, admin is already initialized.
// initializeApp() with no args uses Application Default Credentials (ADC).
// For local dev, set GOOGLE_APPLICATION_CREDENTIALS to a service account JSON path.
if (!getApps().length) {
  initializeApp();
}

export function getDb(): Firestore {
  return getFirestore();
}

// ─── Serialization ────────────────────────────────────────────────────────────
// MCP tool responses must be pure JSON. Firestore Timestamps are not JSON-serializable,
// so we recursively convert them to ISO strings throughout the response.

export function serializeDoc(data: DocumentData): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(data)) {
    result[key] = serializeValue(val);
  }
  return result;
}

function serializeValue(val: unknown): unknown {
  if (val === null || val === undefined) return val;
  // Firestore Timestamp — has a toDate() method
  if (typeof (val as { toDate?: unknown }).toDate === 'function') {
    return (val as { toDate: () => Date }).toDate().toISOString();
  }
  if (Array.isArray(val)) {
    return val.map(serializeValue);
  }
  if (typeof val === 'object') {
    return serializeDoc(val as DocumentData);
  }
  return val;
}

// ─── Formatting helpers ───────────────────────────────────────────────────────

export function formatTimestamp(ts: unknown): string {
  if (!ts) return 'N/A';
  if (typeof (ts as { toDate?: unknown }).toDate === 'function') {
    return (ts as { toDate: () => Date }).toDate().toISOString().split('T')[0];
  }
  if (typeof ts === 'string') return ts.split('T')[0];
  return 'N/A';
}

export function formatCurrency(amount: number | undefined | null, currency = 'UGX'): string {
  if (amount === null || amount === undefined || isNaN(amount)) return 'N/A';
  const code = (currency || 'UGX').toUpperCase();
  if (code === 'USD') {
    return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (code === 'EUR') {
    return `€${amount.toLocaleString('en-IE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  if (code === 'GBP') {
    return `£${amount.toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  // Decimal currencies kept as-is (AED, KES, etc.) — UGX is the only one we round.
  if (code === 'UGX') {
    return `UGX ${Math.round(amount).toLocaleString('en-UG')}`;
  }
  return `${code} ${amount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function truncateIfNeeded(text: string): string {
  if (text.length <= CHARACTER_LIMIT) return text;
  const truncated = text.slice(0, CHARACTER_LIMIT);
  return (
    truncated +
    '\n\n⚠️ **Response truncated** (exceeded 50,000 chars). ' +
    'Use filters (`status`, `date_from`/`date_to`, `limit`) or reduce page size to get more specific results.'
  );
}

// ─── Query helpers ────────────────────────────────────────────────────────────

export interface QueryFilter {
  field: string;
  op: FirebaseFirestore.WhereFilterOp;
  value: unknown;
}

export interface QueryOptions {
  filters?: QueryFilter[];
  orderByField?: string;
  orderByDirection?: 'asc' | 'desc';
  limit?: number;
  offset?: number;
}

/**
 * Query a Firestore collection with filters, ordering, and pagination.
 * Returns raw document data (not serialized — callers handle that).
 */
export async function queryCollection<T extends { id: string }>(
  collectionPath: string,
  options: QueryOptions = {}
): Promise<{ items: T[]; total: number }> {
  const db = getDb();
  const { filters = [], orderByField, orderByDirection = 'desc', limit = 20, offset = 0 } = options;

  let query: FirebaseFirestore.Query = db.collection(collectionPath);

  for (const f of filters) {
    query = query.where(f.field, f.op, f.value);
  }

  if (orderByField) {
    query = query.orderBy(orderByField, orderByDirection);
  }

  // Get total count using a count query (efficient — no document reads)
  let total = 0;
  try {
    const countSnap = await query.count().get();
    total = countSnap.data().count;
  } catch {
    // count() may fail on some query combinations — fall back to 0
    total = 0;
  }

  // Apply pagination
  if (offset > 0) {
    const offsetSnap = await query.limit(offset).get();
    if (!offsetSnap.empty) {
      const lastDoc = offsetSnap.docs[offsetSnap.docs.length - 1];
      query = query.startAfter(lastDoc);
    }
  }

  query = query.limit(limit);

  const snap = await query.get();
  const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as T);

  return { items, total };
}

/**
 * Fetch ALL documents matching a set of filters by paging via cursors.
 * Use when you need to apply client-side filtering (text search, nested-field
 * filters) on a small-to-medium collection. Hard-capped to avoid runaway reads.
 */
export async function fetchAllMatching<T extends { id: string }>(
  collectionPath: string,
  options: { filters?: QueryFilter[]; orderByField?: string; orderByDirection?: 'asc' | 'desc'; hardCap?: number } = {}
): Promise<T[]> {
  const db = getDb();
  const { filters = [], orderByField, orderByDirection = 'desc', hardCap = 5000 } = options;

  let query: FirebaseFirestore.Query = db.collection(collectionPath);
  for (const f of filters) query = query.where(f.field, f.op, f.value);
  // Cursor pagination requires a stable order. Use docId if no orderByField given.
  if (orderByField) {
    query = query.orderBy(orderByField, orderByDirection);
  } else {
    query = query.orderBy('__name__');
  }

  const PAGE = 500;
  const results: T[] = [];
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;

  while (results.length < hardCap) {
    let pageQuery = query.limit(PAGE);
    if (cursor) pageQuery = pageQuery.startAfter(cursor);
    const snap = await pageQuery.get();
    if (snap.empty) break;
    for (const doc of snap.docs) {
      results.push({ id: doc.id, ...doc.data() } as T);
    }
    if (snap.docs.length < PAGE) break;
    cursor = snap.docs[snap.docs.length - 1];
  }

  return results;
}

/**
 * Fetch a single document by ID.
 */
export async function getDocument<T extends { id: string }>(
  collectionPath: string,
  documentId: string
): Promise<T | null> {
  const db = getDb();
  const snap = await db.collection(collectionPath).doc(documentId).get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as T;
}

/**
 * Fetch a single document from a subcollection, e.g. designItems under a project.
 */
export async function getSubDocument<T extends { id: string }>(
  parentCollectionPath: string,
  parentId: string,
  subcollectionName: string,
  documentId: string,
): Promise<T | null> {
  const db = getDb();
  const snap = await db
    .collection(parentCollectionPath)
    .doc(parentId)
    .collection(subcollectionName)
    .doc(documentId)
    .get();
  if (!snap.exists) return null;
  return { id: snap.id, ...snap.data() } as T;
}

/**
 * Fetch a subcollection from a document.
 */
export async function getSubcollection<T extends { id: string }>(
  parentCollectionPath: string,
  parentId: string,
  subcollectionName: string,
  options: { orderByField?: string; orderByDirection?: 'asc' | 'desc'; limit?: number } = {}
): Promise<T[]> {
  const db = getDb();
  const { orderByField, orderByDirection = 'asc', limit = 100 } = options;

  let query: FirebaseFirestore.Query = db
    .collection(parentCollectionPath)
    .doc(parentId)
    .collection(subcollectionName);

  if (orderByField) {
    query = query.orderBy(orderByField, orderByDirection);
  }

  query = query.limit(limit);

  const snap = await query.get();
  return snap.docs.map(doc => ({ id: doc.id, ...doc.data() }) as T);
}
