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
import { db } from '@/shared/services/firebase/firestore';
import type { Agent, AgentSettings, AgentAuditEntry } from '../types/agent';

const AGENTS = 'agents';
const AUDIT = 'agentAuditEntries';

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
