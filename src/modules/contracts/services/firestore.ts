/**
 * Read-side Firestore helpers for the Contracts UI.
 *
 * Writes for MSA/SOW/CO are blocked at the rule layer (`allow write: if
 * false`) so they go through the Cloud Functions in `./firebase.ts`.
 * Client writes have a legacy permissive rule at `clients/{clientId}` so
 * they ALSO go through `upsertClientFn` to keep the audit + commercial-
 * gravity invariants (the legacy permissive rule is grandfather-only —
 * see firestore.rules:2144 vs 4132).
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  where,
  orderBy,
  type Unsubscribe,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase/firestore';
import type { Client } from '../types/client.types';
import type { MSA } from '../types/msa.types';
import type { SOW } from '../types/sow.types';
import type { ChangeOrder } from '../types/change-order.types';

// ─────────────────────────────────────────────────────────────────
// Clients
// ─────────────────────────────────────────────────────────────────

export async function listClients(): Promise<Client[]> {
  // The collection has historical advisory-domain client docs alongside
  // spec-aligned ones. We filter to docs with `parentOrgId == 'zeus-group'`
  // so the AM list only renders the commercial-core clients.
  const q = query(
    collection(db, 'clients'),
    where('parentOrgId', '==', 'zeus-group'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Client, 'id'>) }));
}

export function subscribeClients(cb: (rows: Client[]) => void): Unsubscribe {
  const q = query(
    collection(db, 'clients'),
    where('parentOrgId', '==', 'zeus-group'),
  );
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<Client, 'id'>) })));
  });
}

export async function getClient(clientId: string): Promise<Client | null> {
  const snap = await getDoc(doc(db, 'clients', clientId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Client, 'id'>) };
}

// ─────────────────────────────────────────────────────────────────
// MSAs
// ─────────────────────────────────────────────────────────────────

export async function listMsasForClient(clientId: string): Promise<MSA[]> {
  const q = query(collection(db, 'msas'), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<MSA, 'id'>) }));
}

export function subscribeMsasForClient(
  clientId: string,
  cb: (rows: MSA[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'msas'), where('clientId', '==', clientId));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<MSA, 'id'>) })));
  });
}

export async function listActiveMsas(): Promise<MSA[]> {
  const q = query(collection(db, 'msas'), where('status', '==', 'ACTIVE'));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<MSA, 'id'>) }));
}

export async function getMsa(msaId: string): Promise<MSA | null> {
  const snap = await getDoc(doc(db, 'msas', msaId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<MSA, 'id'>) };
}

// ─────────────────────────────────────────────────────────────────
// SOWs
// ─────────────────────────────────────────────────────────────────

export async function listSowsForMsa(msaId: string): Promise<SOW[]> {
  const q = query(collection(db, 'sows'), where('msaId', '==', msaId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<SOW, 'id'>) }));
}

export function subscribeSowsForMsa(
  msaId: string,
  cb: (rows: SOW[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'sows'), where('msaId', '==', msaId));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<SOW, 'id'>) })));
  });
}

export async function listSowsForClient(clientId: string): Promise<SOW[]> {
  const q = query(collection(db, 'sows'), where('clientId', '==', clientId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<SOW, 'id'>) }));
}

export async function listActiveSowsForClient(clientId: string): Promise<SOW[]> {
  const q = query(
    collection(db, 'sows'),
    where('clientId', '==', clientId),
    where('status', '==', 'ACTIVE'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<SOW, 'id'>) }));
}

export async function getSow(sowId: string): Promise<SOW | null> {
  const snap = await getDoc(doc(db, 'sows', sowId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<SOW, 'id'>) };
}

// ─────────────────────────────────────────────────────────────────
// Change Orders
// ─────────────────────────────────────────────────────────────────

export async function listChangeOrdersForSow(sowId: string): Promise<ChangeOrder[]> {
  const q = query(collection(db, 'change_orders'), where('sowId', '==', sowId));
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ChangeOrder, 'id'>) }));
}

export function subscribeChangeOrdersForSow(
  sowId: string,
  cb: (rows: ChangeOrder[]) => void,
): Unsubscribe {
  const q = query(collection(db, 'change_orders'), where('sowId', '==', sowId));
  return onSnapshot(q, snap => {
    cb(snap.docs.map(d => ({ id: d.id, ...(d.data() as Omit<ChangeOrder, 'id'>) })));
  });
}

export async function getChangeOrder(coId: string): Promise<ChangeOrder | null> {
  const snap = await getDoc(doc(db, 'change_orders', coId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<ChangeOrder, 'id'>) };
}
// `orderBy` import kept for future per-collection sort needs (e.g.
// list MSAs newest-first). Suppress unused-import warnings.
export { orderBy };
