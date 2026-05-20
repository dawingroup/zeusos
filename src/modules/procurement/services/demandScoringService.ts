/**
 * Demand Scoring Service
 * Scores procurement requirements by manufacturing pipeline position.
 * Items in active production rank highest; design stage and position refine further.
 *
 * Reuses weight maps from the unified priority service.
 */

import { DESIGN_STAGE_WEIGHT, MO_STAGE_WEIGHT, scoreToUrgency } from '@/modules/design-manager/services/priorityService';
import { deriveHandoverStatus } from '@/modules/design-manager/services/designItemStatusDerivation';
import type { ProcurementRequirement } from '../types/procurement';
import type { ManufacturingOrder } from '@/modules/manufacturing/types';
import type { DesignItem } from '@/modules/design-manager/types';

// ============================================
// Types
// ============================================

export interface DemandScoredRequirement {
  requirement: ProcurementRequirement;
  demandScore: number;          // 0-100
  demandUrgency: 'low' | 'medium' | 'high' | 'critical';
  scoreBreakdown: {
    purchasePriority: number;   // 0-20
    moStage: number;            // 0-25
    moRank: number;             // 0-20
    designStage: number;        // 0-15
    positionRank: number;       // 0-10
    handover: number;           // 0-10
  };
}

// ============================================
// Weight Constants (sum to 100)
// ============================================

const DEMAND_WEIGHTS = {
  purchasePriority: 20,
  moStage: 25,
  moRank: 20,
  designStage: 15,
  positionRank: 10,
  handover: 10,
};

// ============================================
// Scoring
// ============================================

export interface DemandContext {
  mo: ManufacturingOrder | null;
  totalActiveMOs: number;
  designItem?: DesignItem | null;
  totalItemsInProject?: number;
}

/**
 * Score a single procurement requirement.
 */
export function scoreDemand(
  req: ProcurementRequirement,
  ctx: DemandContext,
): DemandScoredRequirement {
  const { mo, totalActiveMOs, designItem, totalItemsInProject } = ctx;

  // 0. Purchase Priority from design/manufacturing (20pts)
  const MAX_EXPECTED_RANK = 20;
  const purchasePriorityRaw = req.purchasePriority != null
    ? Math.max(0, 1 - (req.purchasePriority / MAX_EXPECTED_RANK))
    : 0;
  const purchasePriority = Math.round(purchasePriorityRaw * DEMAND_WEIGHTS.purchasePriority);

  // 1. MO Stage (25pts)
  const moStageRaw = mo && mo.status !== 'cancelled' && mo.status !== 'completed'
    ? (MO_STAGE_WEIGHT[mo.currentStage] ?? 0.3)
    : 0;
  const moStage = Math.round(moStageRaw * DEMAND_WEIGHTS.moStage);

  // 2. MO Production Rank (25pts)
  let moRankRaw = 0;
  if (mo && totalActiveMOs > 0 && mo.status !== 'cancelled' && mo.status !== 'completed') {
    moRankRaw = 1 - ((mo.productionRank ?? totalActiveMOs) / totalActiveMOs);
  }
  const moRank = Math.round(Math.max(0, Math.min(1, moRankRaw)) * DEMAND_WEIGHTS.moRank);

  // 3. Design Stage (20pts)
  const designStageRaw = designItem
    ? (DESIGN_STAGE_WEIGHT[designItem.currentStage] ?? 0)
    : 0;
  const designStage = Math.round(designStageRaw * DEMAND_WEIGHTS.designStage);

  // 4. Design Position Rank (15pts)
  let positionRankRaw = 0;
  if (designItem && totalItemsInProject && totalItemsInProject > 1) {
    positionRankRaw = 1 - ((designItem.sortOrder ?? totalItemsInProject) / (totalItemsInProject - 1));
  } else if (designItem) {
    positionRankRaw = 1;
  }
  const positionRank = Math.round(Math.max(0, Math.min(1, positionRankRaw)) * DEMAND_WEIGHTS.positionRank);

  // 5. Handover Status (10pts)
  // P7 phase 4: derive from manufacturingOrderId rather than reading the
  // @deprecated flat `handoverStatus` field. Post-phase-3 items don't
  // have the flat field stamped, so the legacy 'handed-over'/'pending'
  // literal comparison missed them. The derivation maps MO-linked →
  // 'handed-over' and unlinked → 'pending' — the two states the scorer
  // actually uses. Legacy rows that still carry the flat field deserialize
  // identically through the derivation (MO id drives the result).
  let handoverRaw = 0;
  if (designItem) {
    const handover = deriveHandoverStatus(designItem);
    if (handover === 'handed-over') handoverRaw = 1.0;
    else if (handover === 'pending') handoverRaw = 0.5;
  }
  const handover = Math.round(handoverRaw * DEMAND_WEIGHTS.handover);

  const demandScore = Math.min(100, Math.max(0, purchasePriority + moStage + moRank + designStage + positionRank + handover));

  return {
    requirement: req,
    demandScore,
    demandUrgency: scoreToUrgency(demandScore),
    scoreBreakdown: { purchasePriority, moStage, moRank, designStage, positionRank, handover },
  };
}

/**
 * Score and sort an array of requirements. Returns highest-score first.
 */
export function scoreAndSortRequirements(
  requirements: ProcurementRequirement[],
  contextMap: Map<string, DemandContext>,
): DemandScoredRequirement[] {
  return requirements
    .map((req) => {
      const ctx = contextMap.get(req.id) ?? { mo: null, totalActiveMOs: 0 };
      return scoreDemand(req, ctx);
    })
    .sort((a, b) => b.demandScore - a.demandScore);
}
