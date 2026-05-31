/**
 * Client Strategy Assistant service — Phase 3.5.
 *
 * Typed wrapper around the `generateClientStrategyBrief` callable + live
 * subscriptions to a client's strategy-brief history and stakeholder contacts.
 */

import {
  collection,
  query,
  orderBy,
  onSnapshot,
  addDoc,
  serverTimestamp,
  type Unsubscribe,
} from 'firebase/firestore';
import { getFunctions, httpsCallable, type HttpsCallable } from 'firebase/functions';
import { db } from '@/core/services/firebase/firestore';
import { app } from '@/core/services/firebase/config';

const functions = getFunctions(app, 'europe-west1');

// ── Brief types (mirror functions/src/ai/clientStrategyBrief.js) ────────────
export type Influence = 'high' | 'medium' | 'low';

export interface StrategyStakeholder {
  name: string;
  role?: string;
  influence?: Influence | string;
  approach?: string;
}
export interface StrategyRegulatory {
  title: string;
  impact?: string;
  implication?: string;
}
export interface StrategyCompetitivePositioning {
  summary: string;
  threats: string[];
  opportunities: string[];
}
export interface StrategyPlay {
  play: string;
  rationale?: string;
  priority?: number;
}
export interface ClientStrategyBrief {
  id: string;
  clientId: string;
  clientName?: string;
  generatedAt?: { toDate(): Date } | string;
  generatedBy?: string;
  executiveSummary: string;
  stakeholderMap: StrategyStakeholder[];
  regulatoryExposure: StrategyRegulatory[];
  competitivePositioning: StrategyCompetitivePositioning;
  recommendedPlays: StrategyPlay[];
  sourceCounts?: { stakeholders: number; competitors: number; regulatory: number; memories: number };
}

export interface ClientContactRecord {
  id: string;
  name: string;
  role?: string;
  organization?: string;
  influence?: Influence | string;
  sentiment?: string;
  source?: string;
}

// ── Callable ────────────────────────────────────────────────────────────────
const generateBriefCallable: HttpsCallable<
  { clientId: string },
  { success: boolean; briefId: string; brief: ClientStrategyBrief }
> = httpsCallable(functions, 'generateClientStrategyBrief');

export async function generateClientStrategyBrief(clientId: string): Promise<ClientStrategyBrief> {
  const { data } = await generateBriefCallable({ clientId });
  return data.brief;
}

// ── Subscriptions ─────────────────────────────────────────────────────────--
export function subscribeStrategyBriefs(
  clientId: string,
  cb: (briefs: ClientStrategyBrief[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(
    collection(db, `clients/${clientId}/strategy_briefs`),
    orderBy('generatedAt', 'desc'),
  );
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClientStrategyBrief, 'id'>) }))),
    (err) => onError?.(err),
  );
}

export function subscribeClientContacts(
  clientId: string,
  cb: (rows: ClientContactRecord[]) => void,
  onError?: (e: Error) => void,
): Unsubscribe {
  const q = query(collection(db, `clients/${clientId}/client_contacts`));
  return onSnapshot(
    q,
    (snap) => cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<ClientContactRecord, 'id'>) }))),
    (err) => onError?.(err),
  );
}

export async function addClientContact(
  clientId: string,
  contact: Omit<ClientContactRecord, 'id'>,
): Promise<string> {
  const ref = await addDoc(collection(db, `clients/${clientId}/client_contacts`), {
    ...contact,
    source: contact.source || 'manual',
    createdAt: serverTimestamp(),
  });
  return ref.id;
}
