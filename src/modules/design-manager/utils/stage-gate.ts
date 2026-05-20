/**
 * Stage Gate Validation Utilities
 * Functions for validating stage transitions and gate criteria
 */

import type { Approval, ApprovalType, DesignItem, DesignStage, RAGStatus, RAGStatusValue } from '../types';
import { normalizeSourcingType, CONSTRUCTION_STAGES, CONSTRUCTION_STAGE_CHECKLIST } from '../types/deliverables';
import type { COStage, ConstructionOrder } from '@/modules/construction/types';
import { CO_STAGE_LABELS } from '@/modules/construction/types';
import { calculateOverallReadiness, getWorstStatus } from './rag-calculations';

/**
 * Extra context passed into `canAdvanceToStage` for the generalised gate
 * model — approvals live in a subcollection and the ConstructionOrder is
 * a separate document, so neither can be read off `DesignItem` directly.
 */
export interface StageGateContext {
  approvals?: Approval[];
  constructionOrder?: ConstructionOrder | null;
}

/**
 * Gate criterion definition
 */
interface GateCriterion {
  aspect: string;
  requiredStatus: RAGStatusValue | RAGStatusValue[];
  allowNA?: boolean;
}

/**
 * Set of criteria for a gate
 */
interface GateCriteriaSet {
  mustMeet: GateCriterion[];
  shouldMeet: GateCriterion[];
  minimumReadiness: number;
  /** Construction checklist keys (from `CONSTRUCTION_STAGE_CHECKLIST`) that must be ticked. */
  requiredChecks?: string[];
  /** Approval types that must exist with status='approved' on the item. */
  requiredApprovals?: ApprovalType[];
  /** Linked ConstructionOrder must be at (one of) these stage(s). */
  requiresConstructionOrderStage?: COStage | COStage[];
}

export const MANUFACTURING_STAGE_ORDER: DesignStage[] = [
  'concept',
  'preliminary',
  'technical',
  'pre-production',
  'production-ready',
];

export const PROCUREMENT_STAGE_ORDER: DesignStage[] = [
  'procure-identify',
  'procure-quote',
  'procure-approve',
  'procure-order',
  'procure-received',
];

export const ARCHITECTURAL_STAGE_ORDER: DesignStage[] = [
  'arch-brief',
  'arch-schematic',
  'arch-development',
  'arch-construction-docs',
  'arch-approved',
];

export function isProcurementStage(stage: DesignStage): boolean {
  return PROCUREMENT_STAGE_ORDER.includes(stage);
}

export function isManufacturingStage(stage: DesignStage): boolean {
  return MANUFACTURING_STAGE_ORDER.includes(stage);
}

export function isArchitecturalStage(stage: DesignStage): boolean {
  return ARCHITECTURAL_STAGE_ORDER.includes(stage);
}

export function isConstructionStage(stage: DesignStage): boolean {
  return CONSTRUCTION_STAGES.includes(stage);
}

export function getStageOrderForItem(item: Pick<DesignItem, 'sourcingType'>): DesignStage[] {
  const normalizedType = normalizeSourcingType(item.sourcingType);

  switch (normalizedType) {
    case 'PROCURED':
      return PROCUREMENT_STAGE_ORDER;
    case 'DESIGN_DOCUMENT':
      return ARCHITECTURAL_STAGE_ORDER;
    case 'CONSTRUCTION':
      return CONSTRUCTION_STAGES;
    case 'CUSTOM_FURNITURE_MILLWORK':
    default:
      return MANUFACTURING_STAGE_ORDER;
  }
}

export function getFinalStageForItem(item: Pick<DesignItem, 'sourcingType'>): DesignStage {
  const order = getStageOrderForItem(item);
  return order[order.length - 1] || 'production-ready';
}

export function isAtFinalStageForItem(item: Pick<DesignItem, 'currentStage' | 'sourcingType'>): boolean {
  return item.currentStage === getFinalStageForItem(item);
}

/**
 * Gate criteria for each design stage
 */
export const GATE_CRITERIA: Record<DesignStage, GateCriteriaSet> = {
  concept: {
    mustMeet: [],
    shouldMeet: [],
    minimumReadiness: 0,
  },
  preliminary: {
    mustMeet: [
      { aspect: 'designCompleteness.overallDimensions', requiredStatus: 'green' },
    ],
    shouldMeet: [
      { aspect: 'designCompleteness.materialSpecs', requiredStatus: ['green', 'amber'] },
    ],
    minimumReadiness: 40,
  },
  technical: {
    mustMeet: [
      { aspect: 'designCompleteness.model3D', requiredStatus: 'green' },
      { aspect: 'designCompleteness.materialSpecs', requiredStatus: 'green' },
      { aspect: 'designCompleteness.hardwareSpecs', requiredStatus: 'green' },
      { aspect: 'qualityGates.clientApproval', requiredStatus: 'green' },
    ],
    shouldMeet: [
      { aspect: 'designCompleteness.productionDrawings', requiredStatus: ['green', 'amber'] },
    ],
    minimumReadiness: 60,
  },
  'pre-production': {
    mustMeet: [
      { aspect: 'designCompleteness.productionDrawings', requiredStatus: 'green' },
      { aspect: 'designCompleteness.joineryDetails', requiredStatus: 'green' },
      { aspect: 'designCompleteness.tolerances', requiredStatus: 'green' },
      { aspect: 'qualityGates.manufacturingReview', requiredStatus: 'green' },
    ],
    shouldMeet: [
      { aspect: 'manufacturingReadiness.materialAvailability', requiredStatus: ['green', 'amber'] },
      { aspect: 'manufacturingReadiness.costValidation', requiredStatus: ['green', 'amber'] },
    ],
    minimumReadiness: 80,
  },
  'production-ready': {
    mustMeet: [
      { aspect: 'ALL', requiredStatus: 'green', allowNA: true },
    ],
    shouldMeet: [],
    minimumReadiness: 95,
  },

  // Procurement workflow stages (gates to be expanded later)
  'procure-identify': {
    mustMeet: [],
    shouldMeet: [],
    minimumReadiness: 0,
  },
  'procure-quote': {
    mustMeet: [],
    shouldMeet: [],
    minimumReadiness: 0,
  },
  'procure-approve': {
    mustMeet: [],
    shouldMeet: [],
    minimumReadiness: 0,
  },
  'procure-order': {
    mustMeet: [],
    shouldMeet: [],
    minimumReadiness: 0,
  },
  'procure-received': {
    mustMeet: [],
    shouldMeet: [],
    minimumReadiness: 0,
  },

  // Architectural workflow stages
  'arch-brief': {
    mustMeet: [],
    shouldMeet: [],
    minimumReadiness: 0,
  },
  'arch-schematic': {
    mustMeet: [],
    shouldMeet: [],
    minimumReadiness: 20,
  },
  'arch-development': {
    mustMeet: [],
    shouldMeet: [],
    minimumReadiness: 40,
  },
  'arch-construction-docs': {
    mustMeet: [],
    shouldMeet: [],
    minimumReadiness: 70,
  },
  'arch-approved': {
    mustMeet: [],
    shouldMeet: [],
    minimumReadiness: 95,
  },

  // Construction workflow stages
  'const-scope': {
    mustMeet: [],
    shouldMeet: [],
    minimumReadiness: 0,
  },
  'const-spec': {
    mustMeet: [],
    shouldMeet: [],
    minimumReadiness: 15,
    requiredChecks: (CONSTRUCTION_STAGE_CHECKLIST['const-scope'] || []).map((c) => c.key),
  },
  'const-quote': {
    mustMeet: [],
    shouldMeet: [],
    minimumReadiness: 30,
    requiredChecks: (CONSTRUCTION_STAGE_CHECKLIST['const-spec'] || []).map((c) => c.key),
    requiredApprovals: ['design-review'],
  },
  'const-approve': {
    mustMeet: [],
    shouldMeet: [],
    minimumReadiness: 50,
    requiredChecks: (CONSTRUCTION_STAGE_CHECKLIST['const-quote'] || []).map((c) => c.key),
    requiredApprovals: ['client-approval'],
  },
  'const-in-progress': {
    mustMeet: [],
    shouldMeet: [],
    minimumReadiness: 60,
    requiredChecks: (CONSTRUCTION_STAGE_CHECKLIST['const-approve'] || []).map((c) => c.key),
    requiresConstructionOrderStage: ['mobilisation', 'execution'],
  },
  'const-inspection': {
    mustMeet: [],
    shouldMeet: [],
    minimumReadiness: 85,
    requiresConstructionOrderStage: ['qc', 'handover'],
  },
  'const-complete': {
    mustMeet: [],
    shouldMeet: [],
    minimumReadiness: 100,
    requiresConstructionOrderStage: 'handover',
    requiredApprovals: ['construction-signoff'],
  },
};

/**
 * Result of a gate check
 */
export interface GateCheckResult {
  canAdvance: boolean;
  failures: string[];
  warnings: string[];
}

/**
 * Check if an item can advance to a target stage
 * @param item - Design item to check
 * @param targetStage - Target stage to advance to
 * @returns Gate check result
 */
export function canAdvanceToStage(
  item: DesignItem,
  targetStage: DesignStage,
  ctx: StageGateContext = {},
): GateCheckResult {
  const normalizedType = normalizeSourcingType(item.sourcingType);
  const validStages = getStageOrderForItem(item);

  // Enforce workflow branching based on normalized sourcing type
  if (!validStages.includes(targetStage)) {
    const typeLabel = {
      'CUSTOM_FURNITURE_MILLWORK': 'Custom furniture/millwork',
      'PROCURED': 'Procured',
      'DESIGN_DOCUMENT': 'Design document',
      'CONSTRUCTION': 'Construction',
    }[normalizedType] || normalizedType;

    return {
      canAdvance: false,
      failures: [`${typeLabel} items can only move through their designated workflow stages`],
      warnings: [],
    };
  }

  const criteria = GATE_CRITERIA[targetStage];
  if (!criteria) return { canAdvance: true, failures: [], warnings: [] };
  
  const failures: string[] = [];
  const warnings: string[] = [];
  const computedReadiness = calculateOverallReadiness(item.ragStatus);
  
  // Check must-meet criteria
  for (const criterion of criteria.mustMeet) {
    if (criterion.aspect === 'ALL') {
      const worstStatus = getWorstStatus(item.ragStatus);
      if (worstStatus !== 'green') {
        failures.push('All aspects must be green for production release');
      }
    } else {
      const status = getAspectStatus(item.ragStatus, criterion.aspect);
      const required = Array.isArray(criterion.requiredStatus) 
        ? criterion.requiredStatus 
        : [criterion.requiredStatus];
      
      if (!required.includes(status) && status !== 'not-applicable') {
        failures.push(`${formatAspectName(criterion.aspect)} must be ${required.join(' or ')}`);
      }
    }
  }
  
  // Check should-meet criteria (warnings only)
  for (const criterion of criteria.shouldMeet) {
    const status = getAspectStatus(item.ragStatus, criterion.aspect);
    const required = Array.isArray(criterion.requiredStatus) 
      ? criterion.requiredStatus 
      : [criterion.requiredStatus];
    
    if (!required.includes(status) && status !== 'not-applicable') {
      warnings.push(`${formatAspectName(criterion.aspect)} should be ${required.join(' or ')}`);
    }
  }
  
  // Check minimum readiness
  if (criteria.minimumReadiness && computedReadiness < criteria.minimumReadiness) {
    failures.push(`Overall readiness must be at least ${criteria.minimumReadiness}%`);
    const nonGreenAspects = getNonGreenAspectNames(item.ragStatus);
    if (nonGreenAspects.length > 0) {
      const preview = nonGreenAspects.slice(0, 4).join(', ');
      const more = nonGreenAspects.length > 4 ? ` (+${nonGreenAspects.length - 4} more)` : '';
      failures.push(`Pending RAG aspects: ${preview}${more}`);
    }
  }

  // Construction-specific: pricing must be completed before approval
  if (targetStage === 'const-approve' && normalizedType === 'CONSTRUCTION') {
    const construction = (item as any).construction as
      import('../types/deliverables').ConstructionPricing | undefined;
    if (!construction || !construction.totalCost || construction.totalCost <= 0) {
      failures.push('Construction pricing must be completed with a total cost greater than zero');
    }
  }

  // Required construction checks — tickets in the per-stage checklist.
  if (criteria.requiredChecks && criteria.requiredChecks.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const checks = ((item as any).constructionReadiness || {}) as Record<string, boolean>;
    const missing = criteria.requiredChecks.filter((k) => !checks[k]);
    if (missing.length > 0) {
      const labels = missing.map((k) => {
        for (const items of Object.values(CONSTRUCTION_STAGE_CHECKLIST)) {
          const found = items.find((c) => c.key === k);
          if (found) return found.label;
        }
        return k;
      });
      failures.push(`Outstanding checks: ${labels.join(', ')}`);
    }
  }

  // Required approvals — subcollection on DesignItem, passed via ctx.
  if (criteria.requiredApprovals && criteria.requiredApprovals.length > 0) {
    const approvals = ctx.approvals || [];
    for (const type of criteria.requiredApprovals) {
      const approved = approvals.some(
        (a) => a.type === type && a.status === 'approved',
      );
      if (!approved) {
        failures.push(`${formatApprovalType(type)} approval is required`);
      }
    }
  }

  // Required Construction Order stage.
  if (criteria.requiresConstructionOrderStage) {
    const co = ctx.constructionOrder;
    const allowed = Array.isArray(criteria.requiresConstructionOrderStage)
      ? criteria.requiresConstructionOrderStage
      : [criteria.requiresConstructionOrderStage];
    if (!co) {
      failures.push(
        `Construction Order must be created and at: ${allowed.map((s) => CO_STAGE_LABELS[s]).join(' or ')}`,
      );
    } else if (!allowed.includes(co.currentStage)) {
      failures.push(
        `Construction Order must be in ${allowed.map((s) => CO_STAGE_LABELS[s]).join(' or ')} (currently ${CO_STAGE_LABELS[co.currentStage]})`,
      );
    }
  }

  // Final construction sign-off also requires the execution timestamp.
  if (targetStage === 'const-complete') {
    const co = ctx.constructionOrder;
    if (co && !co.execution?.signoffAt) {
      failures.push('Final signoff must be recorded on the Construction Order');
    }
  }

  return { canAdvance: failures.length === 0, failures, warnings };
}

function formatApprovalType(type: ApprovalType): string {
  switch (type) {
    case 'design-review': return 'Design review';
    case 'manufacturing-review': return 'Manufacturing review';
    case 'client-approval': return 'Client';
    case 'prototype-approval': return 'Prototype';
    case 'production-release': return 'Production release';
    case 'construction-signoff': return 'Construction sign-off';
    default: return type;
  }
}

/**
 * Get status of a specific aspect by path
 * @param ragStatus - RAG status object
 * @param path - Dot-notation path (e.g., 'designCompleteness.model3D')
 * @returns Status value
 */
function getAspectStatus(ragStatus: RAGStatus, path: string): RAGStatusValue {
  const parts = path.split('.');
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let current: any = ragStatus;
  for (const part of parts) {
    current = current?.[part];
  }
  return current?.status || 'red';
}

/**
 * Format aspect path to human-readable name
 * @param path - Dot-notation path
 * @returns Formatted name
 */
function formatAspectName(path: string): string {
  const lastPart = path.split('.').pop() || path;
  return lastPart
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, str => str.toUpperCase())
    .trim();
}

function getNonGreenAspectNames(ragStatus: RAGStatus): string[] {
  const categories: Array<keyof RAGStatus> = [
    'designCompleteness',
    'manufacturingReadiness',
    'qualityGates',
  ];
  const names: string[] = [];

  for (const category of categories) {
    const aspects = ragStatus[category] as unknown as Record<string, { status?: RAGStatusValue }>;
    for (const [key, value] of Object.entries(aspects || {})) {
      if (value.status && value.status !== 'green' && value.status !== 'not-applicable') {
        names.push(formatAspectName(`${category}.${key}`));
      }
    }
  }

  return names;
}

/**
 * Ordered list of design stages (all workflows)
 */
export const STAGE_ORDER: DesignStage[] = [
  ...MANUFACTURING_STAGE_ORDER,
  ...PROCUREMENT_STAGE_ORDER,
  ...ARCHITECTURAL_STAGE_ORDER,
  ...CONSTRUCTION_STAGES,
];

/**
 * Get the next stage in the workflow
 * @param currentStage - Current stage
 * @returns Next stage or null if at end
 */
export function getNextStage(currentStage: DesignStage): DesignStage | null {
  const currentIndex = MANUFACTURING_STAGE_ORDER.indexOf(currentStage);
  if (currentIndex === -1 || currentIndex === MANUFACTURING_STAGE_ORDER.length - 1) {
    return null;
  }
  return MANUFACTURING_STAGE_ORDER[currentIndex + 1];
}

export function getNextStageForItem(item: Pick<DesignItem, 'currentStage' | 'sourcingType'>): DesignStage | null {
  const order = getStageOrderForItem(item);
  const currentIndex = order.indexOf(item.currentStage);
  if (currentIndex === -1) {
    return order[0] || null;
  }
  if (currentIndex === order.length - 1) {
    return null;
  }
  return order[currentIndex + 1];
}

/**
 * Get the previous stage in the workflow
 * @param currentStage - Current stage
 * @returns Previous stage or null if at start
 */
export function getPreviousStage(currentStage: DesignStage): DesignStage | null {
  const currentIndex = MANUFACTURING_STAGE_ORDER.indexOf(currentStage);
  if (currentIndex <= 0) {
    return null;
  }
  return MANUFACTURING_STAGE_ORDER[currentIndex - 1];
}

export function getPreviousStageForItem(item: Pick<DesignItem, 'currentStage' | 'sourcingType'>): DesignStage | null {
  const order = getStageOrderForItem(item);
  const currentIndex = order.indexOf(item.currentStage);
  if (currentIndex === -1) {
    return null;
  }
  if (currentIndex <= 0) {
    return null;
  }
  return order[currentIndex - 1];
}

/**
 * Get stage index (0-based)
 * @param stage - Design stage
 * @returns Index in STAGE_ORDER
 */
export function getStageIndex(stage: DesignStage): number {
  return STAGE_ORDER.indexOf(stage);
}

/**
 * Check if stage A comes before stage B
 * @param stageA - First stage
 * @param stageB - Second stage
 * @returns True if stageA comes before stageB
 */
export function isStageBeforeOrEqual(stageA: DesignStage, stageB: DesignStage): boolean {
  return getStageIndex(stageA) <= getStageIndex(stageB);
}

/**
 * Get all stages up to and including the given stage
 * @param stage - Target stage
 * @returns Array of stages
 */
export function getStagesUpTo(stage: DesignStage): DesignStage[] {
  const index = getStageIndex(stage);
  return STAGE_ORDER.slice(0, index + 1);
}

/**
 * Get completion percentage through the stages
 * @param stage - Current stage
 * @returns Percentage 0-100
 */
export function getStageProgress(stage: DesignStage): number {
  const index = getStageIndex(stage);
  return Math.round((index / (STAGE_ORDER.length - 1)) * 100);
}
