/**
 * Stage Gate Utilities
 * Functions for validating stage transitions and gate requirements
 */

import type { LaunchProduct } from '../types/product.types';
import type { PipelineStage, GateRequirement, GateCheckResult, DeliverableType } from '../types/stage.types';
import { PIPELINE_STAGES, STAGE_ORDER, getStageConfig, getNextStage, getPreviousStage } from '../constants/stages';

/**
 * Check if a product can advance to a specific stage
 */
export function checkGateRequirements(
  product: LaunchProduct,
  targetStage: PipelineStage
): GateCheckResult {
  const stageConfig = getStageConfig(targetStage);

  if (!stageConfig) {
    return {
      canAdvance: false,
      passed: [],
      failed: [],
      warnings: [`Invalid stage: ${targetStage}`],
    };
  }

  const passed: GateRequirement[] = [];
  const failed: GateRequirement[] = [];
  const warnings: string[] = [];

  for (const requirement of stageConfig.gateRequirements) {
    const result = evaluateRequirement(product, requirement);

    if (result.met) {
      passed.push(requirement);
    } else if (requirement.required) {
      failed.push(requirement);
    } else {
      warnings.push(`Optional: ${requirement.label} - ${result.reason}`);
    }
  }

  return {
    canAdvance: failed.length === 0,
    passed,
    failed,
    warnings,
  };
}

/**
 * Evaluate a single gate requirement against a product
 */
function evaluateRequirement(
  product: LaunchProduct,
  requirement: GateRequirement
): { met: boolean; reason: string } {
  switch (requirement.type) {
    case 'deliverable':
      const hasDeliverable = product.deliverables?.some(
        d => d.type === requirement.id as DeliverableType
      );
      return {
        met: Boolean(hasDeliverable),
        reason: hasDeliverable ? 'Deliverable uploaded' : 'Deliverable missing',
      };

    case 'data_field':
      const fieldValue = getFieldValue(product, requirement.id);
      const hasValue = fieldValue !== undefined && fieldValue !== null && fieldValue !== '';
      return {
        met: hasValue,
        reason: hasValue ? 'Field has value' : 'Field is empty',
      };

    case 'approval':
      // For approvals, check if there's a corresponding audit or approval record
      // This is a simplified check - in production, would check against approval system
      const hasApproval = product.auditHistory?.some(
        a => a.checks?.some(c => c.id === requirement.id && c.passed)
      );
      return {
        met: Boolean(hasApproval),
        reason: hasApproval ? 'Approved' : 'Pending approval',
      };

    case 'quality_check':
      // Check if QC has been passed
      const qcPassed = product.lastAudit?.overallScore && product.lastAudit.overallScore >= 80;
      return {
        met: Boolean(qcPassed),
        reason: qcPassed ? 'QC passed' : 'QC not passed or pending',
      };

    default:
      return { met: false, reason: 'Unknown requirement type' };
  }
}

/**
 * Get a field value from the product by path (supports nested paths like 'specifications.dimensions')
 */
function getFieldValue(product: LaunchProduct, fieldPath: string): any {
  // Handle special field mappings
  const fieldMappings: Record<string, (p: LaunchProduct) => any> = {
    has_name: (p) => p.name,
    has_category: (p) => p.category,
    dimensions_set: (p) => p.specifications?.dimensions,
    materials_finalized: (p) => p.specifications?.materials?.length,
    seo_done: (p) => p.seoMetadata?.metaTitle && p.seoMetadata?.metaDescription,
    alt_text_done: (p) => p.deliverables?.every(d => !d.mimeType?.startsWith('image/') || d.metadata?.altText),
    shopify_synced: (p) => p.shopifySync?.status === 'synced',
    pricing_set: (p) => p.shopifySync?.shopifyProductId, // Price would be on Shopify
    inventory_set: (p) => p.shopifySync?.shopifyProductId, // Inventory would be on Shopify
  };

  if (fieldMappings[fieldPath]) {
    return fieldMappings[fieldPath](product);
  }

  // Generic path traversal
  const parts = fieldPath.split('.');
  let value: any = product;

  for (const part of parts) {
    if (value === undefined || value === null) return undefined;
    value = value[part];
  }

  return value;
}

/**
 * Check if a stage transition is valid (must be adjacent)
 */
export function isValidTransition(
  fromStage: PipelineStage,
  toStage: PipelineStage
): boolean {
  const fromIndex = STAGE_ORDER[fromStage];
  const toIndex = STAGE_ORDER[toStage];

  // Allow moving forward by 1 or backward by any amount
  return toIndex === fromIndex + 1 || toIndex < fromIndex;
}

/**
 * Get all possible next stages from current stage
 */
export function getAvailableTransitions(currentStage: PipelineStage): PipelineStage[] {
  const currentIndex = STAGE_ORDER[currentStage];
  const stages = Object.keys(STAGE_ORDER) as PipelineStage[];

  // Can move to next stage or any previous stage
  return stages.filter(s => {
    const targetIndex = STAGE_ORDER[s];
    return targetIndex === currentIndex + 1 || targetIndex < currentIndex;
  });
}

/**
 * Calculate completion percentage for a stage's requirements
 */
export function calculateStageCompletion(
  product: LaunchProduct,
  stage: PipelineStage
): number {
  const stageConfig = getStageConfig(stage);
  if (!stageConfig) return 0;

  const totalRequirements = stageConfig.gateRequirements.length;
  if (totalRequirements === 0) return 100;

  let passedCount = 0;
  for (const requirement of stageConfig.gateRequirements) {
    const result = evaluateRequirement(product, requirement);
    if (result.met) passedCount++;
  }

  return Math.round((passedCount / totalRequirements) * 100);
}

/**
 * Get the overall pipeline progress for a product
 */
export function calculatePipelineProgress(product: LaunchProduct): {
  currentStageIndex: number;
  totalStages: number;
  percentage: number;
  currentStageCompletion: number;
} {
  const currentStageIndex = STAGE_ORDER[product.currentStage] || 0;
  const totalStages = PIPELINE_STAGES.length;
  const currentStageCompletion = calculateStageCompletion(product, product.currentStage);

  // Progress = completed stages + partial progress on current stage
  const completedStages = currentStageIndex;
  const partialProgress = currentStageCompletion / 100;
  const percentage = Math.round(((completedStages + partialProgress) / totalStages) * 100);

  return {
    currentStageIndex,
    totalStages,
    percentage,
    currentStageCompletion,
  };
}

/**
 * Get missing requirements summary for a product
 */
export function getMissingRequirements(
  product: LaunchProduct,
  targetStage?: PipelineStage
): { stage: PipelineStage; requirements: GateRequirement[] }[] {
  const results: { stage: PipelineStage; requirements: GateRequirement[] }[] = [];
  const currentIndex = STAGE_ORDER[product.currentStage];
  const targetIndex = targetStage ? STAGE_ORDER[targetStage] : PIPELINE_STAGES.length - 1;

  for (let i = currentIndex; i <= targetIndex; i++) {
    const stage = PIPELINE_STAGES[i];
    const check = checkGateRequirements(product, stage.id);

    if (check.failed.length > 0) {
      results.push({
        stage: stage.id,
        requirements: check.failed,
      });
    }
  }

  return results;
}

export { getNextStage, getPreviousStage, getStageConfig };
