/**
 * Lead service — CRUD + stage transitions for the CRM pipeline.
 *
 * Allowed stage transitions (enforced here to keep the funnel honest):
 *   PROSPECT  → QUALIFIED, LOST
 *   QUALIFIED → PITCH, LOST, PROSPECT
 *   PITCH     → WON, LOST, QUALIFIED
 *   WON       → (terminal — convert to Client; reopening blocked)
 *   LOST      → PROSPECT  (re-open for nurture)
 *
 * Closing the lead (WON / LOST) sets `closedAt` and, for LOST, requires
 * a `lostReason` for audit. WON leads are converted to Phase 3.D Clients
 * via convertWonLeadToClient (records the resulting clientId on the lead
 * — no auto-create yet; that handoff is the AM team's call).
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  query,
  where,
  orderBy,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  Lead,
  LeadActivity,
  ActivityKind,
  LeadSource,
  LeadStage,
} from '../types/lead.types';

const LEADS_COLL = 'crm_leads';
const ACTIVITIES_SUBCOLL = 'activities';

/** Allowed stage transitions. Anything not in this map is rejected. */
const ALLOWED_TRANSITIONS: Record<LeadStage, LeadStage[]> = {
  PROSPECT:  ['QUALIFIED', 'LOST'],
  QUALIFIED: ['PITCH', 'LOST', 'PROSPECT'],
  PITCH:     ['WON', 'LOST', 'QUALIFIED'],
  WON:       [],                          // terminal
  LOST:      ['PROSPECT'],                // re-open
};

type CreateLeadInput = Omit<
  Lead,
  | 'id'
  | 'stage'
  | 'lastActivityAt'
  | 'closedAt'
  | 'convertedClientId'
  | 'lostReason'
  | 'createdAt'
  | 'updatedAt'
>;

export async function createLead(input: CreateLeadInput): Promise<Lead> {
  if (!input.name?.trim()) {
    throw new Error('[lead] name is required');
  }
  if (!input.source) {
    throw new Error('[lead] source is required');
  }
  if (!input.currency) {
    throw new Error('[lead] currency is required');
  }
  if (!input.orgId) {
    throw new Error('[lead] orgId is required');
  }
  if (typeof input.probability === 'number' && (input.probability < 0 || input.probability > 1)) {
    throw new Error('[lead] probability must be between 0 and 1');
  }

  const ref = await addDoc(collection(db, LEADS_COLL), {
    ...input,
    name: input.name.trim(),
    stage: 'PROSPECT' satisfies LeadStage,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as Omit<Lead, 'id'>) };
}

export async function getLead(leadId: string): Promise<Lead | null> {
  const snap = await getDoc(doc(db, LEADS_COLL, leadId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...(snap.data() as Omit<Lead, 'id'>) };
}

export async function listLeads(filters: {
  orgId: string;
  stage?: LeadStage;
  source?: LeadSource;
  ownerUserId?: string;
} = { orgId: '' }): Promise<Lead[]> {
  if (!filters.orgId) {
    throw new Error('[lead] orgId filter is required (spec §7.4 commercial gravity)');
  }

  const constraints = [where('orgId', '==', filters.orgId)];
  if (filters.stage)       constraints.push(where('stage',       '==', filters.stage));
  if (filters.source)      constraints.push(where('source',      '==', filters.source));
  if (filters.ownerUserId) constraints.push(where('ownerUserId', '==', filters.ownerUserId));

  const q = query(
    collection(db, LEADS_COLL),
    ...constraints,
    orderBy('createdAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Lead, 'id'>) }));
}

export async function updateLead(
  leadId: string,
  patch: Partial<Omit<Lead, 'id' | 'stage' | 'closedAt' | 'convertedClientId' | 'lostReason' | 'createdAt' | 'updatedAt'>>,
): Promise<void> {
  const existing = await getLead(leadId);
  if (!existing) throw new Error(`[lead] ${leadId} not found`);

  await updateDoc(doc(db, LEADS_COLL, leadId), {
    ...patch,
    ...(patch.name ? { name: patch.name.trim() } : {}),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Advance the lead to a new stage. Validates the transition against
 * ALLOWED_TRANSITIONS and emits a STAGE_CHANGE activity in the
 * sub-collection for audit. Closing (WON / LOST) sets closedAt; LOST
 * requires a non-empty `lostReason`.
 */
export async function changeLeadStage(
  leadId: string,
  nextStage: LeadStage,
  performedBy: string,
  options: { lostReason?: string; convertedClientId?: string } = {},
): Promise<void> {
  const existing = await getLead(leadId);
  if (!existing) throw new Error(`[lead] ${leadId} not found`);

  const allowedFromCurrent = ALLOWED_TRANSITIONS[existing.stage];
  if (!allowedFromCurrent.includes(nextStage)) {
    throw new Error(
      `[lead] illegal stage transition ${existing.stage} → ${nextStage}`,
    );
  }

  if (nextStage === 'LOST' && !options.lostReason?.trim()) {
    throw new Error('[lead] lostReason is required when moving to LOST');
  }

  const patch: Record<string, unknown> = {
    stage: nextStage,
    updatedAt: serverTimestamp(),
    lastActivityAt: serverTimestamp(),
  };
  if (nextStage === 'WON' || nextStage === 'LOST') {
    patch.closedAt = serverTimestamp();
  } else if (existing.stage === 'LOST' && nextStage === 'PROSPECT') {
    // re-opening — clear closedAt and lostReason
    patch.closedAt = null;
    patch.lostReason = null;
  }
  if (nextStage === 'LOST' && options.lostReason) {
    patch.lostReason = options.lostReason.trim();
  }
  if (nextStage === 'WON' && options.convertedClientId) {
    patch.convertedClientId = options.convertedClientId;
  }

  await updateDoc(doc(db, LEADS_COLL, leadId), patch);

  // Log a STAGE_CHANGE activity for the audit timeline
  await logActivity(leadId, {
    kind: 'STAGE_CHANGE',
    summary: `Stage changed: ${existing.stage} → ${nextStage}`,
    performedBy,
    stageFrom: existing.stage,
    stageTo: nextStage,
  });
}

export async function recordClientConversion(
  leadId: string,
  clientId: string,
  performedBy: string,
): Promise<void> {
  await changeLeadStage(leadId, 'WON', performedBy, { convertedClientId: clientId });
}

/* ── Activity sub-collection ─────────────────────────────────────── */

type LogActivityInput =
  Omit<LeadActivity, 'id' | 'leadId' | 'performedAt' | 'createdAt'>
  & { performedAt?: string };

export async function logActivity(
  leadId: string,
  input: LogActivityInput,
): Promise<LeadActivity> {
  if (!input.kind) throw new Error('[lead-activity] kind is required');
  if (!input.summary?.trim()) throw new Error('[lead-activity] summary is required');
  if (!input.performedBy) throw new Error('[lead-activity] performedBy is required');

  const ref = await addDoc(
    collection(db, LEADS_COLL, leadId, ACTIVITIES_SUBCOLL),
    {
      ...input,
      summary: input.summary.trim(),
      leadId,
      performedAt: input.performedAt ?? serverTimestamp(),
      createdAt: serverTimestamp(),
    },
  );
  // Touch the parent lead's lastActivityAt so list views can sort/filter
  await updateDoc(doc(db, LEADS_COLL, leadId), {
    lastActivityAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  const snap = await getDoc(ref);
  return { id: snap.id, ...(snap.data() as Omit<LeadActivity, 'id'>) };
}

export async function listActivities(leadId: string): Promise<LeadActivity[]> {
  const q = query(
    collection(db, LEADS_COLL, leadId, ACTIVITIES_SUBCOLL),
    orderBy('performedAt', 'desc'),
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<LeadActivity, 'id'>) }));
}

export function isValidStageTransition(from: LeadStage, to: LeadStage): boolean {
  return ALLOWED_TRANSITIONS[from].includes(to);
}

export function allowedNextStages(from: LeadStage): LeadStage[] {
  return [...ALLOWED_TRANSITIONS[from]];
}

/** Re-export for testing. */
export const _internal = {
  ALLOWED_TRANSITIONS,
  ACTIVITY_KIND: (k: ActivityKind) => k,
};
