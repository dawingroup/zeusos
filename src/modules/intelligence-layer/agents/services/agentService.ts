/**
 * Agent service — Firestore CRUD for the `agents` registry.
 *
 * Reads are open to authenticated staff; writes are admin-gated by
 * `firestore.rules` (the UI also gates the controls). The dispatcher
 * (Cloud Function) is the only writer of `agentAuditEntries`.
 */
import {
  collection,
  doc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  limit as fbLimit,
  setDoc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getFunctions, httpsCallable } from 'firebase/functions';
import { db } from '@/shared/services/firebase/firestore';
import { app } from '@/shared/services/firebase';
import type { Agent, AgentSettings, AgentAuditEntry } from '../types/agent';

const AGENTS = 'agents';
const AUDIT = 'agentAuditEntries';

// Agent functions live in europe-west1 (the shared `functions` export is us-central1).
const euFunctions = getFunctions(app, 'europe-west1');

export interface AgentReasonResult {
  agentId: string;
  model: string;
  iterations: number;
  finalText: string;
  toolCalls: Array<{ toolId: string; ok: boolean; auditId?: string; summary?: string; error?: string }>;
}

/** Run an agent's live Claude reasoning loop (needs ANTHROPIC_API_KEY set). */
export async function runAgentReasoning(agentId: string, prompt?: string): Promise<AgentReasonResult> {
  const fn = httpsCallable<{ agentId: string; prompt?: string }, AgentReasonResult>(euFunctions, 'agentReason');
  const res = await fn({ agentId, prompt });
  return res.data;
}

/** Run the deterministic rule-based watcher sweep on demand. */
export async function runAgentWatchersNow(): Promise<{ ok: boolean; results: unknown[] }> {
  const fn = httpsCallable<Record<string, never>, { ok: boolean; results: unknown[] }>(euFunctions, 'runAgentWatchersNow');
  const res = await fn({});
  return res.data;
}

export function subscribeAgents(
  onNext: (agents: Agent[]) => void,
  onError?: (e: Error) => void,
): () => void {
  const q = query(collection(db, AGENTS), orderBy('id', 'asc'));
  return onSnapshot(
    q,
    (snap) => onNext(snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Agent)),
    (err) => onError?.(err as Error),
  );
}

export async function listAgents(): Promise<Agent[]> {
  const snap = await getDocs(query(collection(db, AGENTS), orderBy('id', 'asc')));
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }) as Agent);
}

/** Create or overwrite an agent doc (admin only — enforced by rules). */
export async function upsertAgent(id: string, agent: Partial<Agent>, uid?: string): Promise<void> {
  await setDoc(
    doc(db, AGENTS, id),
    {
      ...agent,
      id,
      updatedAt: serverTimestamp(),
      updatedBy: uid ?? null,
      ...(agent.createdAt === undefined ? { createdAt: serverTimestamp() } : {}),
    },
    { merge: true },
  );
}

/** Patch the editable settings of an agent (bumps promptVersion when the prompt changes). */
export async function updateAgentSettings(
  id: string,
  patch: Partial<AgentSettings>,
  uid?: string,
): Promise<void> {
  await updateDoc(doc(db, AGENTS, id), {
    ...patch,
    updatedAt: serverTimestamp(),
    updatedBy: uid ?? null,
  });
}

export async function deleteAgent(id: string): Promise<void> {
  await deleteDoc(doc(db, AGENTS, id));
}

/** Latest audit entries for an agent (admin-read). */
export function subscribeAgentAudit(
  agentId: string,
  onNext: (entries: AgentAuditEntry[]) => void,
  max = 50,
): () => void {
  const q = query(
    collection(db, AUDIT),
    orderBy('createdAt', 'desc'),
    fbLimit(max),
  );
  return onSnapshot(q, (snap) => {
    const rows = snap.docs
      .map((d) => ({ id: d.id, ...d.data() }) as AgentAuditEntry)
      .filter((e) => e.agentId === agentId);
    onNext(rows);
  });
}
