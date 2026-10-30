/**
 * Start a memo FROM a record: a record page links to `/memos/new?link=…` and
 * the editor seeds the memo's first link from it, so the author never types
 * an id. Everything is validated on the way in — a hand-edited URL cannot
 * seed an unknown type or relation.
 */
import type { RecordEntityType } from '@/shared/navigation';
import type { MemoCategory, MemoLink, MemoLinkRelation, MemoType } from '../types/memo';

const RECORD_TYPES: ReadonlySet<string> = new Set<RecordEntityType>([
  'masterJob', 'iwo', 'client', 'msa', 'sow', 'changeOrder', 'quote', 'rateCard', 'clientInvoice', 'intercompanyInvoice',
  'employee', 'roleProfile', 'mediaPlan', 'productionJob', 'talentProfile', 'purchaseOrder', 'journalEntry', 'supplier',
  'lead', 'asset', 'assetCollection', 'objective', 'kpi', 'scorecard', 'memo',
]);
const RELATIONS: ReadonlySet<string> = new Set<MemoLinkRelation>(['authorises', 'context', 'supersedes']);
const MEMO_TYPE_SET: ReadonlySet<string> = new Set<MemoType>(['decision', 'request', 'information', 'directive', 'record']);
const CATEGORIES: ReadonlySet<string> = new Set<MemoCategory>(['finance', 'admin', 'operations']);
const PARAM_KEYS = ['clientId', 'msaId', 'sowId'] as const;

export const MEMO_PREFILL_KEYS = ['link', 'label', 'relation', 'memoType', 'category', 'subject', ...PARAM_KEYS] as const;

export interface MemoPrefillSource {
  type: RecordEntityType;
  id: string;
  label?: string;
  clientId?: string;
  msaId?: string;
  sowId?: string;
  relation?: MemoLinkRelation;
  memoType?: MemoType;
  category?: MemoCategory;
  subject?: string;
}

export interface MemoPrefill {
  link: MemoLink;
  memoType?: MemoType;
  category?: MemoCategory;
  subject?: string;
}

export function memoNewUrlForRecord(src: MemoPrefillSource): string {
  const p = new URLSearchParams();
  p.set('link', `${src.type}:${src.id}`);
  if (src.label) p.set('label', src.label);
  if (src.relation) p.set('relation', src.relation);
  if (src.memoType) p.set('memoType', src.memoType);
  if (src.category) p.set('category', src.category);
  if (src.subject) p.set('subject', src.subject);
  for (const k of PARAM_KEYS) if (src[k]) p.set(k, String(src[k]));
  return `/memos/new?${p.toString()}`;
}

export function parseMemoPrefill(sp: URLSearchParams): MemoPrefill | null {
  const raw = sp.get('link');
  if (!raw) return null;
  const sep = raw.indexOf(':');
  if (sep <= 0) return null;
  const type = raw.slice(0, sep);
  const id = raw.slice(sep + 1).trim();
  if (!RECORD_TYPES.has(type) || !id) return null;
  const label = sp.get('label')?.trim();
  const relation = sp.get('relation') ?? '';
  const link: MemoLink = { type: type as RecordEntityType, id, label: label || id, relation: RELATIONS.has(relation) ? (relation as MemoLinkRelation) : 'context' };
  for (const k of PARAM_KEYS) {
    const v = sp.get(k)?.trim();
    if (v) link[k] = v;
  }
  const memoType = sp.get('memoType') ?? '';
  const category = sp.get('category') ?? '';
  const subject = sp.get('subject')?.trim();
  return {
    link,
    memoType: MEMO_TYPE_SET.has(memoType) ? (memoType as MemoType) : undefined,
    category: CATEGORIES.has(category) ? (category as MemoCategory) : undefined,
    subject: subject || undefined,
  };
}
