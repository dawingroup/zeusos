/**
 * recordLabels — what a linked record is CALLED, looked up by type + id.
 *
 * A foreign key is never what a person expects to read: a master job is
 * "MJ-2026-0142", a client is its name, an IWO its code. `recordRoutes` owns
 * "where does this record live"; this module owns "what is it called".
 *
 * DESIGN
 * ------
 * - One resolver per record TYPE, reading the record's own collection with a
 *   single `getDoc` and picking the display fields. A module whose records
 *   live under a scoped path registers its own resolver with
 *   `registerRecordLabelResolver` from its service module, so nothing here
 *   imports module code.
 * - Cache keyed by `type:id`: in-flight promises are shared (a table with
 *   forty rows of the same IWO issues one read), successes live for ten
 *   minutes, and a FAILED lookup (permission denied, missing doc) is cached
 *   as `null` for one minute — a label lookup must never throw into render
 *   and must never hammer a collection the user cannot read.
 * - Where a page already holds the record, `primeRecordLabel` seeds the
 *   cache so no read happens at all.
 */
import { doc, getDoc, type DocumentData } from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import type { RecordEntityType } from './recordRoutes';

export type LabelledRecordType = RecordEntityType;

export interface RecordLabel {
  /** The number or name a person recognises — "MJ-2026-0142", "Safaricom". */
  primary: string;
  /** Optional second line — the title beside its code, the supplier beside a PO number. */
  secondary?: string;
}

export type LabelResolver = (id: string) => Promise<RecordLabel | null>;

/** Neutral noun shown when a record cannot be named (unresolved, no access). */
export const RECORD_TYPE_NOUN: Record<LabelledRecordType, string> = {
  masterJob: 'Master job',
  iwo: 'Work order',
  client: 'Client',
  msa: 'MSA',
  sow: 'SOW',
  changeOrder: 'Change order',
  quote: 'Quote',
  rateCard: 'Rate card',
  clientInvoice: 'Client invoice',
  intercompanyInvoice: 'Inter-company invoice',
  employee: 'Employee',
  roleProfile: 'Role profile',
  mediaPlan: 'Media plan',
  productionJob: 'Production job',
  talentProfile: 'Talent',
  purchaseOrder: 'Purchase order',
  journalEntry: 'Journal entry',
  supplier: 'Supplier',
  lead: 'Lead',
  asset: 'Asset',
  assetCollection: 'Collection',
  objective: 'Objective',
  kpi: 'KPI',
  scorecard: 'Scorecard',
  memo: 'Memo',
};

const str = (v: unknown): string | undefined => (typeof v === 'string' && v.trim() ? v.trim() : undefined);

function lab(primary: string | undefined, secondary?: string): RecordLabel | null {
  return primary ? { primary, secondary } : null;
}

/** A code-first record: the code is the name, the title is the second line. */
const codeThenTitle = (d: DocumentData) => lab(str(d.code) ?? str(d.title) ?? str(d.name), str(d.code) ? str(d.title) ?? str(d.name) : undefined);

/** Root-level collections: `[collection path, pick]`. */
const BUILT_IN: Partial<Record<LabelledRecordType, [string, (d: DocumentData) => RecordLabel | null]>> = {
  masterJob: ['master_jobs', codeThenTitle],
  iwo: ['internal_work_orders', codeThenTitle],
  client: ['clients', (d) => lab(str(d.name) ?? str(d.title), str(d.code))],
  msa: ['msas', codeThenTitle],
  sow: ['sows', codeThenTitle],
  changeOrder: ['change_orders', codeThenTitle],
  quote: ['quotes', codeThenTitle],
  rateCard: ['rate_cards', (d) => lab(str(d.name) ?? str(d.code), str(d.name) ? str(d.code) : undefined)],
  clientInvoice: ['client_invoices', (d) => lab(str(d.invoiceNumber) ?? str(d.code) ?? str(d.number), str(d.clientName))],
  intercompanyInvoice: ['intercompany_invoices', (d) => lab(str(d.invoiceNumber) ?? str(d.code) ?? str(d.number))],
  employee: ['employees', (d) => lab(
    str(d.fullName) ?? str([str(d.firstName), str(d.lastName)].filter(Boolean).join(' ')) ?? str(d.email),
    str(d.jobTitle) ?? str(d.position),
  )],
  roleProfile: ['role_profiles', (d) => lab(str(d.name) ?? str(d.title), str(d.code))],
  mediaPlan: ['media_plans', (d) => lab(str(d.title) ?? str(d.name), str(d.code))],
  productionJob: ['production_jobs', (d) => lab(str(d.title) ?? str(d.code) ?? str(d.name), str(d.title) ? str(d.code) : undefined)],
  talentProfile: ['talent_profiles', (d) => lab(str(d.name) ?? str(d.displayName) ?? str(d.stageName))],
  purchaseOrder: ['purchase_orders', (d) => lab(str(d.poNumber) ?? str(d.code) ?? str(d.number), str(d.supplierName))],
  supplier: ['suppliers', (d) => lab(str(d.name) ?? str(d.companyName))],
  lead: ['crm_leads', (d) => lab(str(d.name) ?? str(d.companyName) ?? str(d.contactName), str(d.contactName))],
  memo: ['memos', (d) => lab(str(d.memoNumber) ?? str(d.subject), str(d.memoNumber) ? str(d.subject) : undefined)],
};

const resolvers = new Map<LabelledRecordType, LabelResolver>();

/** A module whose records live under a scoped path registers how to name them. */
export function registerRecordLabelResolver(type: LabelledRecordType, resolver: LabelResolver): void {
  resolvers.set(type, resolver);
}

function resolverFor(type: LabelledRecordType): LabelResolver | undefined {
  const registered = resolvers.get(type);
  if (registered) return registered;
  const builtIn = BUILT_IN[type];
  if (!builtIn) return undefined;
  const [path, pick] = builtIn;
  return async (id) => {
    const segments = path.split('/');
    const snap = await getDoc(doc(db, segments[0]!, ...segments.slice(1), id));
    return snap.exists() ? pick(snap.data() ?? {}) : null;
  };
}

interface CacheEntry {
  promise: Promise<RecordLabel | null>;
  value?: RecordLabel | null;
  settledAt?: number;
}

const SUCCESS_TTL_MS = 10 * 60 * 1000;
const FAILURE_TTL_MS = 60 * 1000;
const MAX_ENTRIES = 500;

const cache = new Map<string, CacheEntry>();
const listeners = new Set<() => void>();

function key(type: LabelledRecordType, id: string): string {
  return `${type}:${id}`;
}

function fresh(entry: CacheEntry, now: number): boolean {
  if (entry.settledAt === undefined) return true; // in flight
  const ttl = entry.value ? SUCCESS_TTL_MS : FAILURE_TTL_MS;
  return now - entry.settledAt < ttl;
}

function evict() {
  while (cache.size > MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest === undefined) break;
    cache.delete(oldest);
  }
}

function notify() {
  for (const l of listeners) l();
}

/** Resolve (or reuse) the label for a record. Never rejects. */
export function resolveRecordLabel(type: LabelledRecordType, id: string | null | undefined): Promise<RecordLabel | null> {
  if (!id) return Promise.resolve(null);
  const k = key(type, id);
  const now = Date.now();
  const hit = cache.get(k);
  if (hit && fresh(hit, now)) return hit.promise;

  const resolver = resolverFor(type);
  const entry: CacheEntry = { promise: Promise.resolve(null) };
  entry.promise = (resolver ? resolver(id) : Promise.resolve(null))
    .catch(() => null)
    .then((value) => {
      entry.value = value;
      entry.settledAt = Date.now();
      notify();
      return value;
    });
  cache.delete(k);
  cache.set(k, entry);
  evict();
  return entry.promise;
}

/** Synchronous read of a settled label, or undefined while unresolved. */
export function peekRecordLabel(type: LabelledRecordType, id: string | null | undefined): RecordLabel | null | undefined {
  if (!id) return null;
  const hit = cache.get(key(type, id));
  if (!hit || hit.settledAt === undefined || !fresh(hit, Date.now())) return undefined;
  return hit.value ?? null;
}

/** Seed the cache from data the page already holds — no read is issued. */
export function primeRecordLabel(type: LabelledRecordType, id: string, label: RecordLabel | null): void {
  const k = key(type, id);
  cache.delete(k);
  cache.set(k, { promise: Promise.resolve(label), value: label, settledAt: Date.now() });
  evict();
  notify();
}

export function subscribeRecordLabels(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/** Test seam. */
export function resetRecordLabelCache(): void {
  cache.clear();
  resolvers.clear();
}
