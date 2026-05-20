/**
 * CRM Deal Service
 * CRUD operations and pipeline management for deals/opportunities
 */

import {
  fetchDocument,
  fetchCollection,
  saveDocument,
  updateDocument,
  removeDocument,
  subscribeToCollection,
  where,
  orderBy,
  limit,
  type QueryConstraint,
} from '@/shared/services/firebase/firestore';
import { Timestamp } from 'firebase/firestore';
import type { CRMDeal, CRMDealFormData, CRMDealStage, CRMActivity } from '../types';
import {
  CRM_DEALS_COLLECTION,
  CRM_ACTIVITIES_COLLECTION,
  CRM_DEAL_STAGE_PROBABILITY,
} from '../constants/crm.constants';
import { partyRef } from '@/shared/types/party';

/**
 * Generate a unique deal number using timestamp + random suffix.
 * Synchronous — no Firestore queries needed.
 * Format: CRM-DEAL-YYYYMMDD-XXXX
 */
function generateDealNumberSync(): string {
  const now = new Date();
  const dateStr = now.toISOString().slice(0, 10).replace(/-/g, '');
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `CRM-DEAL-${dateStr}-${rand}`;
}

/**
 * Create a new deal
 */
export async function createDeal(
  data: CRMDealFormData,
  userId: string,
  userName: string
): Promise<string> {
  const dealNumber = generateDealNumberSync();
  const now = Timestamp.now();
  const probability = CRM_DEAL_STAGE_PROBABILITY[data.stage] ?? 0;
  const weightedValue = data.estimatedValue * (probability / 100);

  const id = `deal_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  // P8/F1 — populate the shared party ref alongside the legacy
  // `customerId`. Caller can pass their own `party` for the rare
  // cross-subsidiary case (e.g. an advisory-origin deal); otherwise
  // default to finishes_customer since that's where CRMDeals live.
  const dealParty = data.party ?? partyRef('finishes_customer', data.customerId);

  const deal: Record<string, unknown> = {
    dealNumber,
    title: data.title,
    customerId: data.customerId,
    customerName: data.customerName,
    party: dealParty,
    stage: data.stage,
    probability,
    priority: data.priority,
    source: data.source,
    estimatedValue: data.estimatedValue,
    currency: data.currency,
    weightedValue,
    linkedQuoteIds: data.linkedQuoteIds || [],
    linkedMOIds: data.linkedMOIds || [],
    ownerId: data.ownerId,
    ownerName: data.ownerName,
    teamMemberIds: data.teamMemberIds || [],
    stageEnteredAt: now,
    tags: data.tags || [],
    subsidiaryId: data.subsidiaryId,
    createdAt: now,
    createdBy: userId,
    updatedAt: now,
    updatedBy: userId,
  };

  // Only include optional fields if they have values (Firestore rejects undefined)
  if (data.description) deal.description = data.description;
  if (data.linkedProjectId) deal.linkedProjectId = data.linkedProjectId;
  if (data.expectedCloseDate) deal.expectedCloseDate = data.expectedCloseDate;
  if (data.lastContactDate) deal.lastContactDate = data.lastContactDate;
  if (data.nextFollowUpDate) deal.nextFollowUpDate = data.nextFollowUpDate;
  if (data.siteLocation) {
    // Strip undefined values from nested siteLocation object
    const loc: Record<string, string> = {};
    if (data.siteLocation.address) loc.address = data.siteLocation.address;
    if (data.siteLocation.city) loc.city = data.siteLocation.city;
    if (data.siteLocation.country) loc.country = data.siteLocation.country;
    if (Object.keys(loc).length > 0) deal.siteLocation = loc;
  }
  if (data.notes) deal.notes = data.notes;

  await saveDocument(CRM_DEALS_COLLECTION, id, deal as Record<string, any>);

  // Create an auto-activity for deal creation. Propagate the same
  // party ref so the activity carries cross-subsidiary attribution
  // without a separate lookup (readers will migrate to `party` in P8-3).
  const activityId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const activity: Omit<CRMActivity, 'id'> = {
    dealId: id,
    customerId: data.customerId,
    party: dealParty,
    type: 'stage_change',
    title: `Deal created: ${data.title}`,
    description: `New deal created in ${data.stage} stage`,
    source: 'auto_system',
    performedBy: userId,
    performedByName: userName,
    performedAt: now,
    createdAt: now,
  };
  await saveDocument(CRM_ACTIVITIES_COLLECTION, activityId, activity);

  return id;
}

/**
 * Update a deal
 */
export async function updateDeal(
  dealId: string,
  data: Partial<CRMDeal>,
  userId: string
): Promise<void> {
  const updates: Partial<CRMDeal> = {
    ...data,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  };

  // Recalculate weighted value if stage or estimated value changed
  if (data.stage || data.estimatedValue !== undefined) {
    const existing = await fetchDocument<CRMDeal>(CRM_DEALS_COLLECTION, dealId);
    if (existing) {
      const stage = data.stage ?? existing.stage;
      const value = data.estimatedValue ?? existing.estimatedValue;
      const probability = CRM_DEAL_STAGE_PROBABILITY[stage] ?? 0;
      updates.probability = probability;
      updates.weightedValue = value * (probability / 100);
    }
  }

  await updateDocument(CRM_DEALS_COLLECTION, dealId, updates);
}

/**
 * Update deal stage with activity logging
 */
export async function updateDealStage(
  dealId: string,
  newStage: CRMDealStage,
  userId: string,
  userName: string,
  notes?: string
): Promise<void> {
  const existing = await fetchDocument<CRMDeal>(CRM_DEALS_COLLECTION, dealId);
  if (!existing) throw new Error('Deal not found');

  const now = Timestamp.now();
  const oldStage = existing.stage;
  const probability = CRM_DEAL_STAGE_PROBABILITY[newStage] ?? 0;

  await updateDocument(CRM_DEALS_COLLECTION, dealId, {
    stage: newStage,
    probability,
    weightedValue: existing.estimatedValue * (probability / 100),
    stageEnteredAt: now,
    updatedAt: now,
    updatedBy: userId,
    ...(newStage === 'won' || newStage === 'lost' ? { actualCloseDate: now, closedReason: notes ?? null } : {}),
  });

  // Log stage change activity
  const activityId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const activity: Omit<CRMActivity, 'id'> = {
    dealId,
    customerId: existing.customerId,
    type: 'stage_change',
    title: `Stage changed: ${oldStage} → ${newStage}`,
    description: notes ?? '',
    source: 'auto_system',
    performedBy: userId,
    performedByName: userName,
    performedAt: now,
    createdAt: now,
  };
  await saveDocument(CRM_ACTIVITIES_COLLECTION, activityId, activity);
}

/**
 * Delete a deal
 */
export async function deleteDeal(dealId: string): Promise<void> {
  await removeDocument(CRM_DEALS_COLLECTION, dealId);
}

/**
 * Fetch a single deal
 */
export async function getDeal(dealId: string): Promise<CRMDeal | null> {
  const deal = await fetchDocument<CRMDeal>(CRM_DEALS_COLLECTION, dealId);
  return deal ? { ...deal, id: dealId } : null;
}

/**
 * Fetch deals with optional filters
 */
export async function getDeals(filters?: {
  stage?: CRMDealStage;
  ownerId?: string;
  customerId?: string;
}): Promise<CRMDeal[]> {
  const constraints: QueryConstraint[] = [];
  if (filters?.stage) constraints.push(where('stage', '==', filters.stage));
  if (filters?.ownerId) constraints.push(where('ownerId', '==', filters.ownerId));
  if (filters?.customerId) constraints.push(where('customerId', '==', filters.customerId));
  constraints.push(orderBy('updatedAt', 'desc'));

  return fetchCollection<CRMDeal>(CRM_DEALS_COLLECTION, constraints);
}

const DEFAULT_SUBSCRIBE_DEALS_LIMIT = 500;

/**
 * Subscribe to deals in real-time
 */
export function subscribeToDeals(
  callback: (deals: CRMDeal[]) => void,
  filters?: {
    stage?: CRMDealStage;
    ownerId?: string;
    customerId?: string;
    maxResults?: number;
    /** Skip the default safety cap. Use only for analytics/exports. */
    unbounded?: boolean;
  },
  onError?: (error: Error) => void
) {
  const constraints: QueryConstraint[] = [];
  if (filters?.stage) constraints.push(where('stage', '==', filters.stage));
  if (filters?.ownerId) constraints.push(where('ownerId', '==', filters.ownerId));
  if (filters?.customerId) constraints.push(where('customerId', '==', filters.customerId));
  constraints.push(orderBy('updatedAt', 'desc'));

  const effectiveLimit = filters?.unbounded
    ? undefined
    : (filters?.maxResults ?? DEFAULT_SUBSCRIBE_DEALS_LIMIT);
  if (effectiveLimit !== undefined) {
    constraints.push(limit(effectiveLimit));
  }

  return subscribeToCollection<CRMDeal>(CRM_DEALS_COLLECTION, callback, constraints, onError);
}

/**
 * Link a design project to a deal
 */
export async function linkProjectToDeal(
  dealId: string,
  projectId: string,
  userId: string
): Promise<void> {
  await updateDocument(CRM_DEALS_COLLECTION, dealId, {
    linkedProjectId: projectId,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });
}

/**
 * Update the estimated value of the CRM deal linked to a design project.
 * Called when an estimate or quote is generated in Design Manager.
 * Finds the deal by linkedProjectId and updates its estimatedValue + weightedValue.
 */
export async function updateDealValueForProject(
  projectId: string,
  newValue: number,
  currency: string,
  source: 'estimate' | 'quotation',
  userId: string
): Promise<void> {
  // Find the deal linked to this project
  const deals = await fetchCollection<CRMDeal>(CRM_DEALS_COLLECTION, [
    where('linkedProjectId', '==', projectId),
  ]);

  if (deals.length === 0) {
    console.log(`[CRM] No deal linked to project ${projectId} — skipping value update`);
    return;
  }

  const deal = deals[0];
  const probability = CRM_DEAL_STAGE_PROBABILITY[deal.stage] ?? 0;
  const weightedValue = newValue * (probability / 100);

  await updateDocument(CRM_DEALS_COLLECTION, deal.id, {
    estimatedValue: newValue,
    currency,
    weightedValue,
    updatedAt: Timestamp.now(),
    updatedBy: userId,
  });

  // Log activity. P8/F1 — forward the deal's party ref when the
  // deal was created post-P8-2; legacy deals leave it undefined.
  const activityId = `act_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const activity: Omit<CRMActivity, 'id'> = {
    dealId: deal.id,
    customerId: deal.customerId,
    party: deal.party,
    type: source === 'quotation' ? 'quote_sent' : 'note',
    title: source === 'estimate'
      ? `Deal value updated from estimate: ${currency} ${newValue.toLocaleString()}`
      : `Deal value updated from quotation: ${currency} ${newValue.toLocaleString()}`,
    description: `${source === 'estimate' ? 'Consolidated estimate' : 'Client quotation'} generated — deal value auto-updated`,
    source: 'auto_design_manager',
    performedBy: userId,
    performedByName: 'Design Manager',
    performedAt: Timestamp.now(),
    createdAt: Timestamp.now(),
  };
  await saveDocument(CRM_ACTIVITIES_COLLECTION, activityId, activity);

  console.log(`[CRM] Updated deal ${deal.id} value to ${currency} ${newValue} (from ${source})`);
}
