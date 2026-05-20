/**
 * Constraint Validation Service
 * Validates design items against strategy constraints (budget, space, materials, timeline)
 */

import type {
  DesignItem,
  ProjectStrategy,
  BudgetTier,
} from '../types';

// ============================================
// Constraint Violation Types
// ============================================

export type ViolationType = 'budget' | 'space' | 'timeline' | 'material' | 'quality';
export type ViolationSeverity = 'error' | 'warning' | 'info';

export interface ConstraintViolation {
  id: string;
  itemId: string;
  itemName: string;
  violationType: ViolationType;
  severity: ViolationSeverity;
  message: string;
  suggestedAction?: string;
  actualValue?: number | string;
  expectedValue?: number | string;
  variance?: number;
}

export interface ValidationSummary {
  totalViolations: number;
  byType: Record<ViolationType, number>;
  bySeverity: Record<ViolationSeverity, number>;
  criticalIssues: ConstraintViolation[];
  hasBlockingIssues: boolean;
}

// ============================================
// Budget Constraint Validation
// ============================================

/**
 * Validate budget constraints for design items
 */
export function validateBudgetConstraints(
  items: DesignItem[],
  strategy: ProjectStrategy
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  const targetBudget = strategy.budgetFramework.targetAmount;
  const currency = strategy.budgetFramework.currency || 'USD';

  // Calculate total cost across all items
  let totalCost = 0;
  const itemCosts: Record<string, number> = {};

  for (const item of items) {
    let itemCost = 0;

    // Get cost based on sourcing type
    if (item.manufacturing?.totalCost) {
      itemCost = item.manufacturing.totalCost;
    } else if (item.procurement?.totalLandedCost) {
      itemCost = item.procurement.totalLandedCost;
    } else if (item.architectural?.totalCost) {
      itemCost = item.architectural.totalCost;
    } else if (item.construction?.totalCost) {
      itemCost = (item.construction as any).totalCost || 0;
    }

    itemCosts[item.id] = itemCost;
    totalCost += itemCost;

    // Check item-level budget allocation
    if (item.budgetTracking?.allocatedBudget) {
      const allocated = item.budgetTracking.allocatedBudget;
      const variance = itemCost - allocated;
      const variancePercent = (variance / allocated) * 100;

      if (variance > 0 && variancePercent > 10) {
        violations.push({
          id: `budget-item-${item.id}`,
          itemId: item.id,
          itemName: item.name,
          violationType: 'budget',
          severity: variancePercent > 25 ? 'error' : 'warning',
          message: `Item cost (${currency} ${itemCost.toFixed(2)}) exceeds allocated budget (${currency} ${allocated.toFixed(2)}) by ${variancePercent.toFixed(1)}%`,
          suggestedAction: 'Review item specifications or increase budget allocation',
          actualValue: itemCost,
          expectedValue: allocated,
          variance: variancePercent,
        });
      }
    }
  }

  // Check total project budget
  if (targetBudget && totalCost > targetBudget) {
    const variance = totalCost - targetBudget;
    const variancePercent = (variance / targetBudget) * 100;

    violations.push({
      id: 'budget-project-total',
      itemId: 'project',
      itemName: 'Total Project Cost',
      violationType: 'budget',
      severity: 'error',
      message: `Total project cost (${currency} ${totalCost.toFixed(2)}) exceeds target budget (${currency} ${targetBudget.toFixed(2)}) by ${variancePercent.toFixed(1)}%`,
      suggestedAction: 'Reduce item costs, remove optional items, or adjust budget',
      actualValue: totalCost,
      expectedValue: targetBudget,
      variance: variancePercent,
    });
  }

  // Check budget tier consistency
  for (const item of items) {
    if (item.strategyContext?.budgetTier) {
      const itemTier = item.strategyContext.budgetTier;
      const strategyTier = strategy.budgetFramework.tier;

      if (itemTier !== strategyTier) {
        violations.push({
          id: `budget-tier-${item.id}`,
          itemId: item.id,
          itemName: item.name,
          violationType: 'budget',
          severity: 'info',
          message: `Item budget tier (${itemTier}) differs from project tier (${strategyTier})`,
          suggestedAction: 'Verify if tier mismatch is intentional',
          actualValue: itemTier,
          expectedValue: strategyTier,
        });
      }
    }
  }

  return violations;
}

// ============================================
// Space Constraint Validation
// ============================================

/**
 * Calculate item footprint (for space validation)
 */
function calculateItemFootprint(item: DesignItem): number {
  // Try to get dimensions from parameters
  const params = (item as any).parameters;
  if (params?.dimensions) {
    const { width, depth, unit } = params.dimensions;
    if (width && depth) {
      // Convert to sqm
      let area = width * depth;
      if (unit === 'mm') {
        area = area / 1000000; // mm² to m²
      } else if (unit === 'inches') {
        area = area * 0.00064516; // in² to m²
      }
      return area * (item.requiredQuantity || 1);
    }
  }

  // Fallback: estimate based on category
  const categoryAreas: Record<string, number> = {
    casework: 2.0,
    furniture: 1.5,
    millwork: 1.0,
    doors: 2.0,
    fixtures: 0.5,
    specialty: 1.0,
  };

  return (categoryAreas[item.category] || 1.0) * (item.requiredQuantity || 1);
}

/**
 * Validate space constraints
 */
export function validateSpaceConstraints(
  items: DesignItem[],
  strategy: ProjectStrategy
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];
  const spaceParams = strategy.spaceParameters;

  if (!spaceParams || !spaceParams.totalArea) {
    return violations; // No space validation possible
  }

  // Convert area to sqm for consistent calculations
  let totalAreaSqm = spaceParams.totalArea;
  if (spaceParams.areaUnit === 'sqft') {
    totalAreaSqm = totalAreaSqm * 0.092903; // sqft to sqm
  }

  // Calculate available space (accounting for circulation)
  const circulationPercent = spaceParams.circulationPercent || 30;
  const availableSpace = totalAreaSqm * (1 - circulationPercent / 100);

  // Calculate total item footprint
  let totalFootprint = 0;
  const itemFootprints: Record<string, number> = {};

  for (const item of items) {
    const footprint = calculateItemFootprint(item);
    itemFootprints[item.id] = footprint;
    totalFootprint += footprint;
  }

  // Check if total footprint exceeds available space
  if (totalFootprint > availableSpace) {
    const exceededBy = totalFootprint - availableSpace;
    const exceededPercent = (exceededBy / availableSpace) * 100;

    violations.push({
      id: 'space-total-exceeded',
      itemId: 'project',
      itemName: 'Total Space Utilization',
      violationType: 'space',
      severity: exceededPercent > 20 ? 'error' : 'warning',
      message: `Total item footprint (${totalFootprint.toFixed(2)} m²) exceeds available space (${availableSpace.toFixed(2)} m²) by ${exceededPercent.toFixed(1)}%`,
      suggestedAction: 'Reduce item sizes, quantities, or increase circulation space allocation',
      actualValue: totalFootprint,
      expectedValue: availableSpace,
      variance: exceededPercent,
    });
  }

  // Check capacity vs. space type
  if (spaceParams.calculatedCapacity && strategy.projectContext?.targetUsers?.capacity) {
    const targetCapacity = strategy.projectContext.targetUsers.capacity;
    const optimalCapacity = spaceParams.calculatedCapacity.optimal;

    if (targetCapacity > optimalCapacity * 1.2) {
      violations.push({
        id: 'space-capacity-mismatch',
        itemId: 'project',
        itemName: 'Space Capacity',
        violationType: 'space',
        severity: 'warning',
        message: `Target capacity (${targetCapacity}) significantly exceeds optimal capacity for space (${optimalCapacity})`,
        suggestedAction: 'Review space parameters or adjust target capacity',
        actualValue: targetCapacity,
        expectedValue: optimalCapacity,
      });
    }
  }

  return violations;
}

// ============================================
// Material Constraint Validation
// ============================================

/**
 * Extract materials from design item
 */
function extractItemMaterials(item: DesignItem): string[] {
  const materials: string[] = [];

  // From manufacturing
  if (item.manufacturing?.sheetMaterials) {
    item.manufacturing.sheetMaterials.forEach((mat) => {
      materials.push(mat.materialName);
    });
  }
  if ((item.manufacturing as any)?.timberMaterials) {
    (item.manufacturing as any).timberMaterials.forEach((mat: any) => {
      materials.push(mat.materialName);
    });
  }
  if ((item.manufacturing as any)?.linearMaterials) {
    (item.manufacturing as any).linearMaterials.forEach((mat: any) => {
      materials.push(mat.materialName);
    });
  }

  // From parameters
  const params = (item as any).parameters;
  if (params?.primaryMaterial?.name) {
    materials.push(params.primaryMaterial.name);
  }
  if (params?.secondaryMaterials) {
    params.secondaryMaterials.forEach((mat: any) => {
      if (mat.name) materials.push(mat.name);
    });
  }

  return materials;
}

/**
 * Validate material constraints
 */
export function validateMaterialConstraints(
  items: DesignItem[],
  strategy: ProjectStrategy
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  const preferredMaterials = strategy.projectContext?.style?.materialPreferences || [];
  const avoidMaterials = strategy.projectContext?.style?.avoidStyles || [];

  for (const item of items) {
    const itemMaterials = extractItemMaterials(item);

    // Check for avoided materials
    for (const material of itemMaterials) {
      const conflicts = avoidMaterials.filter((avoid) =>
        material.toLowerCase().includes(avoid.toLowerCase()) ||
        avoid.toLowerCase().includes(material.toLowerCase())
      );

      if (conflicts.length > 0) {
        violations.push({
          id: `material-avoid-${item.id}-${material}`,
          itemId: item.id,
          itemName: item.name,
          violationType: 'material',
          severity: 'warning',
          message: `Item uses material "${material}" which conflicts with style preferences: ${conflicts.join(', ')}`,
          suggestedAction: 'Review material selection or update style preferences',
          actualValue: material,
          expectedValue: `Not in avoid list: ${avoidMaterials.join(', ')}`,
        });
      }
    }

    // Check if using preferred materials
    if (preferredMaterials.length > 0) {
      const usesPreferred = itemMaterials.some((material) =>
        preferredMaterials.some((pref) =>
          material.toLowerCase().includes(pref.toLowerCase()) ||
          pref.toLowerCase().includes(material.toLowerCase())
        )
      );

      if (!usesPreferred && itemMaterials.length > 0) {
        violations.push({
          id: `material-preference-${item.id}`,
          itemId: item.id,
          itemName: item.name,
          violationType: 'material',
          severity: 'info',
          message: `Item does not use any preferred materials (${preferredMaterials.join(', ')})`,
          suggestedAction: 'Consider using preferred materials if appropriate',
        });
      }
    }

    // Check sustainability requirements
    if (strategy.projectContext?.requirements?.sustainability) {
      // This is a placeholder - in real implementation, you'd check material certifications
      violations.push({
        id: `material-sustainability-${item.id}`,
        itemId: item.id,
        itemName: item.name,
        violationType: 'material',
        severity: 'info',
        message: 'Project requires sustainable materials - verify material certifications',
        suggestedAction: 'Ensure materials have FSC, GREENGUARD, or equivalent certifications',
      });
    }
  }

  return violations;
}

// ============================================
// Timeline Constraint Validation
// ============================================

/**
 * Validate timeline constraints
 */
export function validateTimelineConstraints(
  items: DesignItem[],
  strategy: ProjectStrategy
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  const timeline = strategy.projectContext?.timeline;
  if (!timeline || !timeline.targetCompletion) {
    return violations; // No timeline validation possible
  }

  const targetDate = new Date(timeline.targetCompletion);
  const now = new Date();

  for (const item of items) {
    if (item.dueDate) {
      const itemDue = item.dueDate instanceof Date ? item.dueDate : (item.dueDate as any).toDate();

      // Check if item due date is after project completion
      if (itemDue > targetDate) {
        const daysOver = Math.ceil((itemDue.getTime() - targetDate.getTime()) / (1000 * 60 * 60 * 24));

        violations.push({
          id: `timeline-overdue-${item.id}`,
          itemId: item.id,
          itemName: item.name,
          violationType: 'timeline',
          severity: 'error',
          message: `Item due date (${itemDue.toLocaleDateString()}) is ${daysOver} days after project completion (${targetDate.toLocaleDateString()})`,
          suggestedAction: 'Adjust item timeline or extend project completion date',
          actualValue: itemDue.toISOString(),
          expectedValue: targetDate.toISOString(),
        });
      }

      // Check if item is overdue
      if (itemDue < now && item.currentStage !== 'production-ready') {
        const daysOverdue = Math.ceil((now.getTime() - itemDue.getTime()) / (1000 * 60 * 60 * 24));

        violations.push({
          id: `timeline-past-due-${item.id}`,
          itemId: item.id,
          itemName: item.name,
          violationType: 'timeline',
          severity: 'warning',
          message: `Item is ${daysOverdue} days past its due date`,
          suggestedAction: 'Update due date or prioritize completion',
        });
      }
    }

    // Check urgency vs. stage
    if (timeline.urgency === 'urgent' || timeline.urgency === 'critical') {
      const earlyStages: any[] = ['concept', 'preliminary', 'procure-identify', 'arch-brief', 'const-scope'];
      if (earlyStages.includes(item.currentStage)) {
        violations.push({
          id: `timeline-urgency-${item.id}`,
          itemId: item.id,
          itemName: item.name,
          violationType: 'timeline',
          severity: 'warning',
          message: `Project urgency is ${timeline.urgency} but item is still in early stage (${item.currentStage})`,
          suggestedAction: 'Prioritize advancing this item to later stages',
        });
      }
    }
  }

  return violations;
}

// ============================================
// Quality Constraint Validation
// ============================================

/**
 * Validate quality/complexity constraints
 */
export function validateQualityConstraints(
  items: DesignItem[],
  strategy: ProjectStrategy
): ConstraintViolation[] {
  const violations: ConstraintViolation[] = [];

  const budgetTier = strategy.budgetFramework.tier;
  const customFinishesRequired = strategy.projectContext?.requirements?.customFinishes;

  for (const item of items) {
    // Check AWI grade vs budget tier
    const params = (item as any).parameters;
    if (params?.awiGrade) {
      const expectedGrade = getExpectedAWIGrade(budgetTier);
      if (params.awiGrade !== expectedGrade) {
        const severity = isQualityMismatchSignificant(params.awiGrade, expectedGrade) ? 'warning' : 'info';

        violations.push({
          id: `quality-awi-${item.id}`,
          itemId: item.id,
          itemName: item.name,
          violationType: 'quality',
          severity,
          message: `Item AWI grade (${params.awiGrade}) differs from expected grade for ${budgetTier} tier (${expectedGrade})`,
          suggestedAction: 'Verify quality level aligns with budget expectations',
          actualValue: params.awiGrade,
          expectedValue: expectedGrade,
        });
      }
    }

    // Check custom finishes requirement
    if (customFinishesRequired) {
      const hasCustomFinish = params?.finish && params.finish.type !== 'none';
      if (!hasCustomFinish) {
        violations.push({
          id: `quality-finish-${item.id}`,
          itemId: item.id,
          itemName: item.name,
          violationType: 'quality',
          severity: 'info',
          message: 'Project requires custom finishes but item has no finish specified',
          suggestedAction: 'Specify custom finish for this item',
        });
      }
    }
  }

  return violations;
}

/**
 * Get expected AWI grade for budget tier
 */
function getExpectedAWIGrade(tier: BudgetTier): 'economy' | 'custom' | 'premium' {
  const mapping: Record<BudgetTier, 'economy' | 'custom' | 'premium'> = {
    economy: 'economy',
    standard: 'custom',
    premium: 'premium',
    luxury: 'premium',
  };
  return mapping[tier];
}

/**
 * Check if quality mismatch is significant
 */
function isQualityMismatchSignificant(actual: string, expected: string): boolean {
  const levels = ['economy', 'custom', 'premium'];
  const actualIndex = levels.indexOf(actual);
  const expectedIndex = levels.indexOf(expected);
  return Math.abs(actualIndex - expectedIndex) > 1;
}

// ============================================
// Comprehensive Validation
// ============================================

/**
 * Validate all constraints for design items against strategy
 */
export async function validateDesignItemsAgainstStrategy(
  _projectId: string,
  items: DesignItem[],
  strategy: ProjectStrategy
): Promise<{
  violations: ConstraintViolation[];
  summary: ValidationSummary;
}> {
  const allViolations: ConstraintViolation[] = [];

  // Run all validation checks
  allViolations.push(...validateBudgetConstraints(items, strategy));
  allViolations.push(...validateSpaceConstraints(items, strategy));
  allViolations.push(...validateMaterialConstraints(items, strategy));
  allViolations.push(...validateTimelineConstraints(items, strategy));
  allViolations.push(...validateQualityConstraints(items, strategy));

  // Build summary
  const summary: ValidationSummary = {
    totalViolations: allViolations.length,
    byType: {
      budget: allViolations.filter((v) => v.violationType === 'budget').length,
      space: allViolations.filter((v) => v.violationType === 'space').length,
      timeline: allViolations.filter((v) => v.violationType === 'timeline').length,
      material: allViolations.filter((v) => v.violationType === 'material').length,
      quality: allViolations.filter((v) => v.violationType === 'quality').length,
    },
    bySeverity: {
      error: allViolations.filter((v) => v.severity === 'error').length,
      warning: allViolations.filter((v) => v.severity === 'warning').length,
      info: allViolations.filter((v) => v.severity === 'info').length,
    },
    criticalIssues: allViolations.filter((v) => v.severity === 'error'),
    hasBlockingIssues: allViolations.some((v) => v.severity === 'error'),
  };

  return { violations: allViolations, summary };
}

/**
 * Get violations for a specific item
 */
export function getViolationsForItem(
  itemId: string,
  violations: ConstraintViolation[]
): ConstraintViolation[] {
  return violations.filter((v) => v.itemId === itemId);
}

/**
 * Get violations by severity
 */
export function getViolationsBySeverity(
  violations: ConstraintViolation[],
  severity: ViolationSeverity
): ConstraintViolation[] {
  return violations.filter((v) => v.severity === severity);
}

/**
 * Format violation for display
 */
export function formatViolationMessage(violation: ConstraintViolation): string {
  let message = violation.message;

  if (violation.suggestedAction) {
    message += `\n\nSuggested action: ${violation.suggestedAction}`;
  }

  if (violation.actualValue !== undefined && violation.expectedValue !== undefined) {
    message += `\n\nActual: ${violation.actualValue}\nExpected: ${violation.expectedValue}`;
  }

  return message;
}
