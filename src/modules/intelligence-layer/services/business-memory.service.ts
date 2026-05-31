/**
 * Business memory service — Phase 3.2.
 *
 * Typed wrappers around the memory callables + a live read of recent memories
 * for the group brain. The assistant + CFO/strategy briefs write here; this
 * surface lets staff search and manually curate the store.
 */

import {
  collection,
  query,
  where,
  orderBy,
  limit as fbLimit,
  onSnapshot,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFunctions, httpsCallable, type HttpsCallable } from 'firebase/functions';
import { db } from '@/core/services/firebase/firestore';
import { app } from '@/core/services/firebase/config';

const functions = getFunctions(app, 'europe-west1');

/** The group-brain scope (mirrors functions/src/ai/aiMemory.js SCOPE_GROUP). */
export const GROUP_BRAIN_SCOPE = 'zeus-group';

export type MemoryCategory =
  | 'business_fact'
  | 'user_preference'
  | 'project_insight'
  | 'customer_intel'
  | 'process_knowledge'
  | 'decision_record'
  | 'market_intel'
  | 'financial_insight';

export const MEMORY_CATEGORY_LABELS: Record<MemoryCategory, string> = {
  business_fact: 'Business fact',
  user_preference: 'User preference',
  project_insight: 'Project insight',
  customer_intel: 'Customer intel',
  process_knowledge: 'Process knowledge',
  decision_record: 'Decision record',
  market_intel: 'Market intel',
  financial_insight: 'Financial insight',
};

export type MemoryImportance = 'critical' | 'high' | 'medium' | 'low';

export interface BusinessMemory {
  id: string;
  companyId: string;
  category: MemoryCategory | string;
  content: string;
  summary?: string;
  tags?: string[];
  importance?: MemoryImportance | string;
  createdBy?: string;
  createdAt?: { toDate(): Date } | string;
  similarity?: number;
}

const searchCallable: HttpsCallable<
  { companyId: string; query: string; topK?: number; minSimilarity?: number; categories?: string[] },
  { results: BusinessMemory[] }
> = httpsCallable(functions, 'semanticMemorySearch');

const saveCallable: HttpsCallable<
  { companyId: string; category: string; content: string; summary?: string; tags?: string[]; importance?: string },
  { id: string }
> = httpsCallable(functions, 'saveManualMemory');

export async function searchMemories(
  queryText: string,
  opts?: { categories?: string[]; topK?: number },
): Promise<BusinessMemory[]> {
  const { data } = await searchCallable({
    companyId: GROUP_BRAIN_SCOPE,
    query: queryText,
    topK: opts?.topK ?? 15,
    categories: opts?.categories,
  });
  return data.results ?? [];
}

export async function saveMemory(input: {
  category: MemoryCategory;
  content: string;
  summary?: string;
  tags?: string[];
  importance?: MemoryImportance;
}): Promise<string> {
  const { data } = await saveCallable({ companyId: GROUP_BRAIN_SCOPE, ...input });
  return data.id;
}

/** Live read of recent group-brain memories (newest first). */
export function subscribeRecentMemories(
  cb: (rows: BusinessMemory[]) => void,
  onError?: (e: Error) => void,
  max = 50,
): Unsubscribe {
  const q = query(
    collection(db, 'ai_memory'),
    where('companyId', '==', GROUP_BRAIN_SCOPE),
    orderBy('createdAt', 'desc'),
    fbLimit(max),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<BusinessMemory, 'id'>) }))),
    (err) => onError?.(err),
  );
}
