/**
 * Memo service — the client side of the `memos` collection.
 *
 * Writes here are DRAFT writes only (create, edit, attachments, delete),
 * which the rules allow the author. Every transition after that goes through
 * the `memoAction` callable (memoActions.ts). Reads use exactly the query
 * shapes the rules can prove per document:
 *   register:   subsidiaryId == X AND confidential == false
 *   mine:       createdBy == uid
 *   recipient:  distributionUids array-contains uid
 *   route:      routeUids array-contains uid
 * Everything else (status, type, category, ordering) is applied client-side
 * so the module needs no composite index.
 *
 * Timestamps are ISO strings, as on tasks and daily plans.
 */
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  onSnapshot,
  query,
  where,
  type FirestoreError,
  type QueryConstraint,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase/firestore';
import { addDoc, deleteDoc, updateDoc } from '@/shared/services/firebase/firestore-writes';
import { deleteFile, uploadFile } from '@/shared/services/firebase/storage';
import { withTimeout } from '@/shared/utils/withTimeout';
import type {
  CreateMemoInput,
  Memo,
  MemoActor,
  MemoAttachment,
  MemoFilters,
  MemoHeader,
  MemoRecipient,
  MemoStatus,
  MemoStatusEvent,
  MemoVersion,
  UpdateMemoDraftInput,
} from '../types/memo';
import { DEFAULT_MEMO_CURRENCY, sectionsForType } from '../constants/memoTemplates';
import { memoDraftDeletion } from '../utils/memoDeletion';
import { EMPTY_MEMO_ROUTING, type MemoRoutingConfig } from '../utils/memoApproval';

export const MEMOS_COLLECTION = 'memos';
export const MEMO_VERSIONS_SUBCOLLECTION = 'versions';
export const MEMO_COMMENTS_SUBCOLLECTION = 'comments';
const DEFAULT_LIST_LIMIT = 500;

// ── helpers ─────────────────────────────────────────────────────────────────

/** Remove `undefined` deep (Firestore refuses it). Plain data only — memos carry no Timestamps. */
export function stripUndefined<T>(obj: T): T {
  if (obj === null || obj === undefined || typeof obj !== 'object') return obj;
  if (Array.isArray(obj)) return obj.map(stripUndefined) as unknown as T;
  return Object.fromEntries(
    Object.entries(obj as Record<string, unknown>).filter(([, v]) => v !== undefined).map(([k, v]) => [k, stripUndefined(v)]),
  ) as T;
}

function memoRef(id: string) {
  return doc(db, MEMOS_COLLECTION, id);
}

const nowIso = () => new Date().toISOString();
const todayIso = () => nowIso().slice(0, 10);

export function distributionUidsOf(distribution: MemoRecipient[] | undefined): string[] {
  return Array.from(new Set((distribution ?? []).map((r) => r.uid).filter(Boolean)));
}

function statusEvent(from: MemoStatus | null, to: MemoStatus, actor: MemoActor, note?: string): MemoStatusEvent {
  const event: MemoStatusEvent = { from, to, by: actor.uid, byName: actor.name, at: nowIso() };
  if (note) event.note = note;
  return event;
}

function defaultHeader(actor: MemoActor, partial?: Partial<MemoHeader>): MemoHeader {
  return {
    to: partial?.to ?? [],
    from: partial?.from ?? stripUndefined({ uid: actor.uid, name: actor.name, email: actor.email }),
    through: partial?.through ?? [],
    cc: partial?.cc ?? [],
    date: partial?.date ?? todayIso(),
  };
}

// ── create / update / delete (drafts) ───────────────────────────────────────

export async function createMemoDraft(input: CreateMemoInput, actor: MemoActor): Promise<string> {
  if (!input.subject?.trim()) throw new Error('A memo needs a subject');
  const distribution = input.distribution ?? [];
  const at = nowIso();
  const data = stripUndefined({
    subsidiaryId: input.subsidiaryId,
    type: input.type,
    category: input.category,
    impact: input.impact ?? 'low',
    confidential: input.confidential ?? false,
    subject: input.subject.trim(),
    externalRef: input.externalRef,
    header: defaultHeader(actor, input.header),
    amountMinor: input.amountMinor ?? null,
    currency: input.amountMinor != null ? (input.currency ?? DEFAULT_MEMO_CURRENCY) : (input.currency ?? null),
    sections: input.sections ?? sectionsForType(input.type),
    attachments: [],
    links: input.links ?? [],
    distribution,
    distributionUids: distributionUidsOf(distribution),
    acknowledgements: {},
    status: 'draft' as MemoStatus,
    statusHistory: [statusEvent(null, 'draft', actor)],
    version: 0,
    supersedes: input.supersedes,
    createdBy: actor.uid,
    createdByName: actor.name,
    createdAt: at,
    updatedAt: at,
    updatedBy: actor.uid,
  });
  const ref = await addDoc(collection(db, MEMOS_COLLECTION), data);
  return ref.id;
}

export async function updateMemoDraft(id: string, patch: UpdateMemoDraftInput, actor: MemoActor): Promise<void> {
  const update: Record<string, unknown> = { updatedAt: nowIso(), updatedBy: actor.uid };
  for (const [key, value] of Object.entries(patch)) {
    if (value === undefined) continue;
    update[key] = value;
  }
  if (patch.distribution) update.distributionUids = distributionUidsOf(patch.distribution);
  if (patch.amountMinor != null && !patch.currency) update.currency = DEFAULT_MEMO_CURRENCY;
  if (typeof update.subject === 'string') update.subject = (update.subject as string).trim();
  await updateDoc(memoRef(id), stripUndefined(update));
}

/**
 * Delete a DRAFT and everything hanging off it: its comments and its
 * attachment files. Who may is decided by memoDraftDeletion — the same rule
 * the Firestore gate enforces. Idempotent.
 */
export async function deleteMemoDraft(id: string, actor: MemoActor, opts: { isAdmin: boolean }): Promise<void> {
  const snap = await withTimeout(getDoc(memoRef(id)), 'Load memo');
  if (!snap.exists()) return;
  const memo = { id: snap.id, ...snap.data() } as Memo;
  const verdict = memoDraftDeletion(memo, actor.uid, opts.isAdmin);
  if (!verdict.allowed) throw new Error(verdict.reason);

  const docs = await withTimeout(getDocs(collection(db, MEMOS_COLLECTION, id, MEMO_COMMENTS_SUBCOLLECTION)), 'Load memo comments');
  for (const d of docs.docs) {
    try {
      await deleteDoc(d.ref);
    } catch (err) {
      const code = (err as { code?: string })?.code ?? '';
      if (!code.includes('permission-denied')) throw err;
    }
  }
  for (const a of memo.attachments ?? []) {
    if (!a.storagePath) continue;
    try {
      await deleteFile(a.storagePath);
    } catch (err) {
      console.warn('[memoService] could not delete attachment file', a.storagePath, err);
    }
  }
  await deleteDoc(memoRef(id));
}

// ── read ────────────────────────────────────────────────────────────────────

export async function getMemo(id: string): Promise<Memo | null> {
  const snap = await withTimeout(getDoc(memoRef(id)), 'Load memo');
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Memo;
}

export function subscribeToMemo(id: string, callback: (memo: Memo | null) => void, onError?: (error: FirestoreError) => void): Unsubscribe {
  return onSnapshot(
    memoRef(id),
    (snap) => callback(snap.exists() ? ({ id: snap.id, ...snap.data() } as Memo) : null),
    (error) => {
      console.error('[memoService] subscribeToMemo failed:', error);
      onError?.(error);
    },
  );
}

function millis(t: unknown): number {
  if (typeof t === 'string') return Date.parse(t) || 0;
  if (t && typeof (t as { toMillis?: unknown }).toMillis === 'function') return (t as { toMillis: () => number }).toMillis();
  if (t instanceof Date) return t.getTime();
  return 0;
}

function applyClientFilters(rows: Memo[], filters: MemoFilters): Memo[] {
  let out = rows;
  if (filters.status) {
    const set = new Set(Array.isArray(filters.status) ? filters.status : [filters.status]);
    out = out.filter((m) => set.has(m.status));
  }
  if (filters.type) out = out.filter((m) => m.type === filters.type);
  if (filters.category) out = out.filter((m) => m.category === filters.category);
  return out.sort((a, b) => millis(b.createdAt) - millis(a.createdAt));
}

export interface SubscribeMemosOptions {
  /** Omit the `confidential == false` constraint. Only an admin's query passes the rules without it. */
  includeConfidential?: boolean;
}

export function subscribeToMemos(
  filters: MemoFilters,
  callback: (memos: Memo[]) => void,
  onError?: (error: FirestoreError) => void,
  options: SubscribeMemosOptions = {},
): Unsubscribe {
  const constraints: QueryConstraint[] = [];
  if (filters.createdBy) {
    constraints.push(where('createdBy', '==', filters.createdBy));
  } else if (filters.recipientUid) {
    constraints.push(where('distributionUids', 'array-contains', filters.recipientUid));
  } else if (filters.routeUid) {
    constraints.push(where('routeUids', 'array-contains', filters.routeUid));
  } else {
    if (filters.subsidiaryId) constraints.push(where('subsidiaryId', '==', filters.subsidiaryId));
    if (!options.includeConfidential) constraints.push(where('confidential', '==', false));
  }
  constraints.push(limit(filters.limit ?? DEFAULT_LIST_LIMIT));

  return onSnapshot(
    query(collection(db, MEMOS_COLLECTION), ...constraints),
    (snap) => callback(applyClientFilters(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Memo), filters)),
    (error) => {
      console.error('[memoService] subscribeToMemos failed:', error);
      onError?.(error);
    },
  );
}

export async function listMemoVersions(id: string): Promise<MemoVersion[]> {
  const snap = await withTimeout(getDocs(collection(db, MEMOS_COLLECTION, id, MEMO_VERSIONS_SUBCOLLECTION)), 'Load memo versions');
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as MemoVersion).sort((a, b) => a.version - b.version);
}

// ── replacement ─────────────────────────────────────────────────────────────

/**
 * Start a new draft from an issued memo — same header, sections, links and
 * distribution — linked back with `supersedes`, so that issuing the new memo
 * marks the old one superseded (the callable does that on issue).
 */
export async function draftReplacementMemo(original: Memo, actor: MemoActor): Promise<string> {
  if (original.status !== 'issued') throw new Error('Only an issued memo can be replaced');
  const source = original.issuedSnapshot;
  const header = source?.header ?? original.header;
  const links = [...(source?.links ?? original.links ?? [])].filter((l) => l.relation !== 'supersedes');
  links.push({ type: 'memo', id: original.id, label: `${original.memoNumber ?? 'Memo'} — ${original.subject}`, relation: 'supersedes' });
  return createMemoDraft(
    {
      subsidiaryId: original.subsidiaryId,
      type: original.type,
      category: original.category,
      impact: original.impact,
      confidential: original.confidential,
      subject: original.subject,
      externalRef: original.externalRef,
      header: { ...header, from: stripUndefined({ uid: actor.uid, name: actor.name, email: actor.email }), date: todayIso() },
      amountMinor: original.amountMinor ?? null,
      currency: original.currency ?? null,
      sections: (source?.sections ?? original.sections).map((s) => ({ ...s })),
      links,
      distribution: (source?.distribution ?? original.distribution ?? []).map((r) => ({ ...r })),
      supersedes: original.id,
    },
    actor,
  );
}

// ── attachments ─────────────────────────────────────────────────────────────

export function memoAttachmentPath(memo: Pick<Memo, 'id' | 'subsidiaryId'>, fileName: string): string {
  const safe = fileName.replace(/[^\w.-]+/g, '_');
  return `memos/${memo.subsidiaryId}/${memo.id}/attachments/${Date.now()}_${safe}`;
}

export async function addMemoAttachment(memo: Memo, file: File, actor: MemoActor): Promise<MemoAttachment> {
  if (memo.status !== 'draft') throw new Error('Attachments can only be added to a draft');
  const storagePath = memoAttachmentPath(memo, file.name);
  const { url } = await uploadFile(storagePath, file);
  const attachment: MemoAttachment = stripUndefined({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: file.name,
    url,
    storagePath,
    contentType: file.type || undefined,
    size: file.size,
    addedBy: actor.uid,
    addedAt: nowIso(),
  });
  await updateDoc(memoRef(memo.id), { attachments: [...(memo.attachments ?? []), attachment], updatedAt: nowIso(), updatedBy: actor.uid });
  return attachment;
}

export async function removeMemoAttachment(memo: Memo, attachmentId: string, actor: MemoActor): Promise<void> {
  if (memo.status !== 'draft') throw new Error('Attachments can only be removed from a draft');
  await updateDoc(memoRef(memo.id), {
    attachments: (memo.attachments ?? []).filter((a) => a.id !== attachmentId),
    updatedAt: nowIso(),
    updatedBy: actor.uid,
  });
}

/** `memos/{sub}/{memoId}/{memoNumber}-v{n}.pdf` — the canonical copy. */
export function issuedMemoPdfPath(memo: Pick<Memo, 'id' | 'subsidiaryId' | 'memoNumber' | 'version'>): string {
  if (!memo.memoNumber) throw new Error('A memo needs a number before its PDF can be filed');
  return `memos/${memo.subsidiaryId}/${memo.id}/${memo.memoNumber}-v${memo.version || 1}.pdf`;
}

// ── approval routing config (preview only — the callable re-resolves) ───────

export async function loadMemoRoutingConfig(): Promise<MemoRoutingConfig> {
  try {
    const snap = await withTimeout(getDoc(doc(db, 'systemSettings', 'approvalRouting')), 'Load approval routing');
    if (!snap.exists()) return EMPTY_MEMO_ROUTING;
    const data = snap.data() as Partial<MemoRoutingConfig>;
    return { version: Number(data.version) || 0, modules: data.modules && typeof data.modules === 'object' ? data.modules : {} };
  } catch (err) {
    console.warn('[memos] could not load approval routing; previewing without bands', err);
    return EMPTY_MEMO_ROUTING;
  }
}
