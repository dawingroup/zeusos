/**
 * Unified Priority Service
 * Bidirectional priority scoring for design items.
 *
 * Forward: Design position + stage + manufacturing position → CRM / Procurement
 * Backward: CRM deal stage + staleness → Design item priority
 *
 * Scores are computed at read time (not persisted) so they're always accurate.
 */

import { Timestamp } from 'firebase/firestore';
import { fetchCollection, where } from '@/shared/services/firebase/firestore';
import { getDesignItems } from './firestore';
import { getManufacturingOrder } from '@/modules/manufacturing/services/manufacturingOrderService';
import { updateDeal } from '@/modules/crm/services/crmDealService';
import { logActivity } from '@/modules/crm/services/crmActivityService';
import { CRM_DEALS_COLLECTION } from '@/modules/crm/constants/crm.constants';
import { deriveHandoverStatus } from './designItemStatusDerivation';
import type { DesignItem } from '../types';
import type { CRMDeal, CRMDealStage, DealPriority } from '@/modules/crm/types';
import type { ManufacturingOrder } from '@/modules/manufacturing/types';

// ============================================
// Types
// ============================================

export interface PriorityScore {
  score: number;
  urgency: 'low' | 'medium' | 'high' | 'critical';
  breakdown: {
    crmStage: number;
    staleness: number;
    positionRank: number;
    designStage: number;
    manufacturingRank: number;
    handover: number;
  };
  signals: string[];
}

export interface PriorityContext {
  deal?: CRMDeal | null;
  totalItemsInProject: number;
  manufacturingOrder?: ManufacturingOrder | null;
  totalMOsInQueue?: number;
}

// ============================================
// Weight Constants
// ============================================

const WEIGHTS = {
  crmStage: 20,
  staleness: 10,
  positionRank: 15,
  designStage: 15,
  manufacturing: 25,
  handover: 15,
};

/** CRM stage urgency — backward signal */
const CRM_STAGE_URGENCY: Record<CRMDealStage, number> = {
  negotiation: 1.0,
  quotation: 0.7,
  design_proposal: 0.5,
  site_visit: 0.4,
  qualification: 0.3,
  lead: 0.2,
  won: 0.6,
  lost: 0.0,
  on_hold: 0.1,
};

/** Design stage weight — forward signal */
export const DESIGN_STAGE_WEIGHT: Record<string, number> = {
  'concept': 0.1, 'preliminary': 0.3, 'technical': 0.5,
  'pre-production': 0.7, 'production-ready': 1.0,
  'procure-identify': 0.2, 'procure-quote': 0.4,
  'procure-approve': 0.6, 'procure-order': 0.8, 'procure-received': 1.0,
  'const-scope': 0.1, 'const-spec': 0.3, 'const-quote': 0.5,
  'const-approve': 0.6, 'const-in-progress': 0.8, 'const-inspection': 0.9, 'const-complete': 1.0,
};

/** MO stage weight — forward signal */
export const MO_STAGE_WEIGHT: Record<string, number> = {
  'queued': 0.3, 'cutting': 0.5, 'assembly': 0.7,
  'finishing': 0.9, 'qc': 0.95, 'ready': 1.0,
};

// ============================================
// Helpers
// ============================================

function daysSince(ts: Timestamp | undefined | null): number {
  if (!ts) return 0;
  const ms = typeof ts.toMillis === 'function' ? ts.toMillis() : (ts as any).seconds * 1000;
  return Math.max(0, (Date.now() - ms) / (1000 * 60 * 60 * 24));
}

export function scoreToUrgency(score: number): 'low' | 'medium' | 'high' | 'critical' {
  if (score >= 75) return 'critical';
  if (score >= 50) return 'high';
  if (score >= 25) return 'medium';
  return 'low';
}

// ============================================
// Staleness Decay
// ============================================

function computeStalenessMultiplier(deal: CRMDeal | null | undefined): number {
  if (!deal) return 1.0;
  const days = daysSince(deal.stageEnteredAt);

  if (deal.stage === 'quotation') {
    if (days > 42) return 0.2;
    if (days > 21) return 0.5;
    return 1.0;
  }
  if (deal.stage === 'design_proposal') {
    if (days > 30) return 0.5;
    if (days > 14) return 0.7;
    return 1.0;
  }
  if (deal.stage === 'negotiation') return 1.0;
  return 1.0;
}

// ============================================
// Manufacturing Score
// ============================================

function computeManufacturingScore(
  mo: ManufacturingOrder | null | undefined,
  totalMOs: number,
): number {
  if (!mo || mo.status === 'cancelled' || mo.status === 'completed') return 0;

  const stageScore = MO_STAGE_WEIGHT[mo.currentStage] ?? 0.3;
  const rankScore = totalMOs > 0
    ? 1 - ((mo.productionRank ?? totalMOs) / totalMOs)
    : 0.5;

  return (stageScore * 0.6) + (rankScore * 0.4);
}

// ============================================
// Core Scoring
// ============================================

/**
 * Compute priority score for a single design item.
 */
export function computeItemPriority(
  item: DesignItem,
  ctx: PriorityContext,
): PriorityScore {
  const signals: string[] = [];

  // 1. CRM Stage (backward)
  const dealStage = ctx.deal?.stage;
  const crmUrgency = dealStage ? (CRM_STAGE_URGENCY[dealStage] ?? 0) : 0;
  const crmStageScore = Math.round(crmUrgency * WEIGHTS.crmStage);
  if (dealStage === 'negotiation') signals.push('Deal in negotiation');
  else if (dealStage === 'quotation') signals.push('Quote sent');
  else if (dealStage) signals.push(`Deal: ${dealStage.replace('_', ' ')}`);

  // 2. Staleness (backward)
  const stalenessMultiplier = computeStalenessMultiplier(ctx.deal);
  const stalenessScore = Math.round(stalenessMultiplier * WEIGHTS.staleness);
  if (stalenessMultiplier < 1.0) {
    const days = Math.round(daysSince(ctx.deal?.stageEnteredAt));
    signals.push(`Stale ${days}d`);
  }

  // 3. Position Rank (forward)
  const sortOrder = item.sortOrder ?? ctx.totalItemsInProject;
  const positionRaw = ctx.totalItemsInProject > 1
    ? 1 - (sortOrder / (ctx.totalItemsInProject - 1))
    : 1;
  const positionRankScore = Math.round(Math.max(0, Math.min(1, positionRaw)) * WEIGHTS.positionRank);
  if (sortOrder === 0) signals.push('Rank #1');

  // 4. Design Stage (forward)
  const designStageRaw = DESIGN_STAGE_WEIGHT[item.currentStage] ?? 0;
  const designStageScore = Math.round(designStageRaw * WEIGHTS.designStage);

  // 5. Manufacturing Position & Stage (forward — dominant)
  const moRaw = computeManufacturingScore(ctx.manufacturingOrder, ctx.totalMOsInQueue ?? 0);
  const manufacturingRankScore = Math.round(moRaw * WEIGHTS.manufacturing);
  if (ctx.manufacturingOrder && moRaw > 0) {
    const moStage = ctx.manufacturingOrder.currentStage;
    const rank = (ctx.manufacturingOrder.productionRank ?? -1) + 1;
    signals.push(`Mfg: ${moStage}${rank > 0 ? ` #${rank}` : ''}`);
  }

  // 6. Handover Status (forward)
  // P7 phase 4: derive from manufacturingOrderId rather than reading the
  // @deprecated flat `handoverStatus` field. Post-phase-3 items don't
  // carry the flat field; the derivation collapses handed-over/MO-linked
  // into a single 'handed-over' signal. This intentionally drops the
  // old 0.8 "MO-but-no-flat-field" middle tier — post-phase-3 every
  // MO-linked item legitimately scores a full 1.0, and legacy rows
  // deserialize the same way through the derivation.
  let handoverRaw = 0;
  const handover = deriveHandoverStatus(item);
  if (handover === 'handed-over') handoverRaw = 1.0;
  else if (handover === 'pending') handoverRaw = 0.5;
  const handoverScore = Math.round(handoverRaw * WEIGHTS.handover);

  const score = Math.min(100, Math.max(0,
    crmStageScore + stalenessScore + positionRankScore +
    designStageScore + manufacturingRankScore + handoverScore
  ));

  return {
    score,
    urgency: scoreToUrgency(score),
    breakdown: {
      crmStage: crmStageScore,
      staleness: stalenessScore,
      positionRank: positionRankScore,
      designStage: designStageScore,
      manufacturingRank: manufacturingRankScore,
      handover: handoverScore,
    },
    signals,
  };
}

// ============================================
// Project-Level Scoring
// ============================================

/**
 * Compute priority scores for all items in a project.
 * Fetches linked CRM deal and MOs automatically.
 */
export async function computeProjectPriorities(
  projectId: string,
): Promise<Map<string, PriorityScore>> {
  const [items, deals] = await Promise.all([
    getDesignItems(projectId),
    fetchCollection<CRMDeal>(CRM_DEALS_COLLECTION, [
      where('linkedProjectId', '==', projectId),
    ]).catch(() => [] as CRMDeal[]),
  ]);

  const deal = deals.length > 0 ? deals[0] : null;

  // Fetch MOs for items that have manufacturingOrderId
  const moMap = new Map<string, ManufacturingOrder>();
  const moIds = items
    .map((i) => (i as any).manufacturingOrderId as string | undefined)
    .filter((id): id is string => !!id);

  const uniqueMoIds = [...new Set(moIds)];
  const moResults = await Promise.all(
    uniqueMoIds.map((id) => getManufacturingOrder(id).catch(() => null)),
  );
  for (const mo of moResults) {
    if (mo) moMap.set(mo.id, mo);
  }

  const activeMOs = [...moMap.values()].filter(
    (mo) => mo.status !== 'cancelled' && mo.status !== 'completed',
  );

  const result = new Map<string, PriorityScore>();
  for (const item of items) {
    const mo = (item as any).manufacturingOrderId
      ? moMap.get((item as any).manufacturingOrderId) ?? null
      : null;

    const score = computeItemPriority(item, {
      deal,
      totalItemsInProject: items.length,
      manufacturingOrder: mo,
      totalMOsInQueue: activeMOs.length,
    });
    result.set(item.id, score);
  }

  return result;
}

// ============================================
// CRM Sync
// ============================================

/**
 * After items are reordered, sync the project's top priority to its linked CRM deal.
 * Fire-and-forget — does not throw on failure.
 */
export async function syncProjectPriorityToCRM(
  projectId: string,
  userId: string,
): Promise<void> {
  const deals = await fetchCollection<CRMDeal>(CRM_DEALS_COLLECTION, [
    where('linkedProjectId', '==', projectId),
  ]);
  if (deals.length === 0) return;

  const deal = deals[0];
  const priorities = await computeProjectPriorities(projectId);

  // Find the highest-scored item
  let maxScore = 0;
  let topSignals: string[] = [];
  for (const [, ps] of priorities) {
    if (ps.score > maxScore) {
      maxScore = ps.score;
      topSignals = ps.signals;
    }
  }

  const newPriority: DealPriority =
    maxScore >= 75 ? 'critical' :
    maxScore >= 50 ? 'high' :
    maxScore >= 25 ? 'medium' : 'low';

  if (deal.priority === newPriority) return;

  await updateDeal(deal.id, { priority: newPriority }, userId);

  await logActivity({
    dealId: deal.id,
    customerId: deal.customerId,
    // P8/F1 — forward the deal's party ref. Legacy (pre-P8-2) deals
    // leave this undefined; readers fall back to customerId.
    party: deal.party,
    projectId,
    type: 'note',
    title: `Priority updated: ${deal.priority} → ${newPriority}`,
    description: `Auto-recalculated from design item rankings. Top score: ${maxScore}/100. Signals: ${topSignals.join(', ')}`,
    source: 'auto_design_manager',
    sourceModule: 'design-manager',
    performedBy: userId,
    performedByName: 'Priority Sync',
    performedAt: Timestamp.now(),
  });
}
