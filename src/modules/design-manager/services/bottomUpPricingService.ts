/**
 * Bottom-Up Pricing Calculation Service
 * Pure calculation functions for the A&E bottom-up pricing calculator.
 * No side effects - all functions are deterministic.
 */

import type {
  BottomUpPricingProposal,
  BottomUpPricingResult,
  BottomUpPricingConfig,
  DisciplineCostSummary,
  StageCostSummary,
  DeliverableCostSummary,
  PricingDesignStage,
  StaffRole,
  PricingDeliverable,
  PricingDiscipline,
} from '../types/bottomUpPricing';
import {
  PRICING_DISCIPLINE_LABELS,
  PRICING_DESIGN_STAGE_LABELS,
  STAFF_ROLE_LABELS,
} from '../types/bottomUpPricing';
import { nanoid } from 'nanoid';
import type { BudgetTier, ScopedDeliverable } from '../types/strategy';
import { BUDGET_TIER_MULTIPLIERS } from '../types/strategy';

/**
 * Get the hourly rate for a given role from config
 */
export function getRateForRole(role: StaffRole, config: BottomUpPricingConfig): number {
  const found = config.roles.find((r) => r.id === role);
  return found?.hourlyRate ?? 0;
}

/**
 * Calculate the full pricing breakdown from a proposal and config.
 */
export function calculateBottomUpPricing(
  proposal: BottomUpPricingProposal,
  config: BottomUpPricingConfig
): BottomUpPricingResult {
  // ---- Labor cost per discipline ----
  const byDiscipline: DisciplineCostSummary[] = proposal.disciplines.map((disc) => {
    const deliverables: DeliverableCostSummary[] = disc.deliverables.map((del) => {
      const rate = getRateForRole(del.role, config);
      return {
        deliverableId: del.id,
        name: del.name,
        role: del.role,
        roleLabel: STAFF_ROLE_LABELS[del.role],
        hourlyRate: rate,
        hours: del.estimatedHours,
        designStage: del.designStage,
        cost: del.estimatedHours * rate,
      };
    });

    return {
      discipline: disc.discipline,
      label: PRICING_DISCIPLINE_LABELS[disc.discipline],
      deliverables,
      totalHours: deliverables.reduce((sum, d) => sum + d.hours, 0),
      totalCost: deliverables.reduce((sum, d) => sum + d.cost, 0),
    };
  });

  // ---- Labor cost per stage ----
  const stageMap = new Map<PricingDesignStage, { hours: number; cost: number }>();
  for (const disc of byDiscipline) {
    for (const del of disc.deliverables) {
      const existing = stageMap.get(del.designStage) ?? { hours: 0, cost: 0 };
      existing.hours += del.hours;
      existing.cost += del.cost;
      stageMap.set(del.designStage, existing);
    }
  }

  const stageOrder: PricingDesignStage[] = ['concept', 'schematic', 'design-development', 'construction-docs'];
  const byStage: StageCostSummary[] = stageOrder
    .filter((s) => stageMap.has(s))
    .map((stage) => {
      const data = stageMap.get(stage)!;
      return {
        stage,
        label: PRICING_DESIGN_STAGE_LABELS[stage],
        totalHours: data.hours,
        totalCost: data.cost,
      };
    });

  const laborCost = byDiscipline.reduce((sum, d) => sum + d.totalCost, 0);
  const totalLaborHours = byDiscipline.reduce((sum, d) => sum + d.totalHours, 0);

  // ---- Pass-through costs ----
  const logisticsCost = proposal.logistics.reduce((sum, l) => sum + l.amount, 0);
  const externalStudiesCost = proposal.externalStudies.reduce((sum, s) => sum + s.amount, 0);
  const adminFeeAmount = externalStudiesCost * (proposal.adminFeePercent / 100);
  const externalStudiesTotalWithFee = externalStudiesCost + adminFeeAmount;

  const grandTotal = laborCost + logisticsCost + externalStudiesTotalWithFee;

  return {
    laborCost,
    totalLaborHours,
    byDiscipline,
    byStage,
    logisticsCost,
    externalStudiesCost,
    adminFeeAmount,
    externalStudiesTotalWithFee,
    grandTotal,
  };
}

/**
 * Export pricing summary as CSV string
 */
export function exportPricingCSV(
  proposal: BottomUpPricingProposal,
  result: BottomUpPricingResult
): string {
  const lines: string[] = [];

  lines.push(`Project: ${proposal.projectName}`);
  lines.push(`Currency: ${proposal.currency}`);
  lines.push('');

  // Deliverables breakdown
  lines.push('Discipline,Deliverable,Role,Stage,Hours,Rate (UGX),Cost (UGX)');
  for (const disc of result.byDiscipline) {
    for (const del of disc.deliverables) {
      lines.push(
        [
          disc.label,
          `"${del.name}"`,
          del.roleLabel,
          PRICING_DESIGN_STAGE_LABELS[del.designStage],
          del.hours.toString(),
          del.hourlyRate.toFixed(0),
          del.cost.toFixed(0),
        ].join(',')
      );
    }
  }

  lines.push('');

  // Summary by discipline
  lines.push('--- Summary by Discipline ---');
  lines.push('Discipline,Hours,Cost');
  for (const disc of result.byDiscipline) {
    lines.push(`${disc.label},${disc.totalHours},${disc.totalCost.toFixed(0)}`);
  }

  lines.push('');

  // Summary by stage
  lines.push('--- Summary by Design Stage ---');
  lines.push('Stage,Hours,Cost');
  for (const stage of result.byStage) {
    lines.push(`${stage.label},${stage.totalHours},${stage.totalCost.toFixed(0)}`);
  }

  lines.push('');

  // Totals
  lines.push('--- Totals ---');
  lines.push(`Labor Cost,,${result.laborCost.toFixed(0)}`);
  lines.push(`Logistics Cost,,${result.logisticsCost.toFixed(0)}`);
  lines.push(`External Studies,,${result.externalStudiesCost.toFixed(0)}`);
  lines.push(`Admin Fee (${proposal.adminFeePercent}%),,${result.adminFeeAmount.toFixed(0)}`);
  lines.push(`GRAND TOTAL,,${result.grandTotal.toFixed(0)}`);

  return lines.join('\n');
}

/**
 * Download CSV to user's browser
 */
export function downloadPricingCSV(csv: string, projectName: string): void {
  const filename = `${projectName.replace(/\s+/g, '_')}_pricing_${new Date().toISOString().split('T')[0]}.csv`;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
  URL.revokeObjectURL(link.href);
}

// ============================================
// Strategy Integration Functions
// ============================================

/**
 * Infer staff role from deliverable type
 * Uses heuristics based on deliverable name and complexity
 */
export function inferRoleFromDeliverableType(deliverableName: string, complexity?: string): StaffRole {
  const nameLower = deliverableName.toLowerCase();

  // Principal-level work (complex, strategic)
  if (
    nameLower.includes('concept') ||
    nameLower.includes('master plan') ||
    nameLower.includes('strategic') ||
    complexity === 'high'
  ) {
    return 'principal';
  }

  // Senior-level work (technical, coordination)
  if (
    nameLower.includes('coordinate') ||
    nameLower.includes('engineering') ||
    nameLower.includes('mep') ||
    nameLower.includes('structural') ||
    nameLower.includes('calculation')
  ) {
    return 'senior-engineer';
  }

  // Junior-level work (drafting, basic documentation)
  if (
    nameLower.includes('schedule') ||
    nameLower.includes('detail') ||
    nameLower.includes('door') ||
    nameLower.includes('window') ||
    nameLower.includes('draft') ||
    complexity === 'low'
  ) {
    return 'junior-drafter';
  }

  // Default to mid-level architect for most deliverables
  return 'mid-level-architect';
}

/**
 * Infer design stage from deliverable type
 * Uses keywords in deliverable name to guess the stage
 */
export function inferStageFromDeliverableType(deliverableName: string): PricingDesignStage {
  const nameLower = deliverableName.toLowerCase();

  // Construction documents stage
  if (
    nameLower.includes('construction') ||
    nameLower.includes('cd') ||
    nameLower.includes('detail drawing') ||
    nameLower.includes('specification') ||
    nameLower.includes('schedule')
  ) {
    return 'construction-docs';
  }

  // Design development stage
  if (
    nameLower.includes('dd') ||
    nameLower.includes('development') ||
    nameLower.includes('millwork') ||
    nameLower.includes('elevation') ||
    nameLower.includes('section')
  ) {
    return 'design-development';
  }

  // Schematic stage
  if (
    nameLower.includes('schematic') ||
    nameLower.includes('sd') ||
    nameLower.includes('floor plan') ||
    nameLower.includes('layout') ||
    nameLower.includes('furniture')
  ) {
    return 'schematic';
  }

  // Concept stage
  if (
    nameLower.includes('concept') ||
    nameLower.includes('rendering') ||
    nameLower.includes('3d') ||
    nameLower.includes('sketch') ||
    nameLower.includes('mood board')
  ) {
    return 'concept';
  }

  // Default to schematic for most deliverables
  return 'schematic';
}

/**
 * Estimate hours for a deliverable based on type and budget tier
 * Returns base hours adjusted by budget tier multiplier
 */
export function estimateDeliverableHours(
  deliverableName: string,
  budgetTier?: BudgetTier,
  complexity?: string
): number {
  const nameLower = deliverableName.toLowerCase();

  // Base hour estimates by deliverable type
  let baseHours = 20; // Default

  // High-hour deliverables
  if (
    nameLower.includes('master plan') ||
    nameLower.includes('structural analysis') ||
    nameLower.includes('mep layout') ||
    nameLower.includes('coordination')
  ) {
    baseHours = 80;
  }
  // Medium-high deliverables
  else if (
    nameLower.includes('floor plan') ||
    nameLower.includes('elevation') ||
    nameLower.includes('rendering') ||
    nameLower.includes('furniture plan')
  ) {
    baseHours = 40;
  }
  // Medium deliverables
  else if (
    nameLower.includes('section') ||
    nameLower.includes('detail') ||
    nameLower.includes('schedule') ||
    nameLower.includes('lighting')
  ) {
    baseHours = 24;
  }
  // Low-hour deliverables
  else if (
    nameLower.includes('sketch') ||
    nameLower.includes('note') ||
    nameLower.includes('diagram')
  ) {
    baseHours = 8;
  }

  // Adjust by complexity
  const complexityMultiplier = complexity === 'high' ? 1.5 : complexity === 'low' ? 0.7 : 1.0;
  baseHours *= complexityMultiplier;

  // Apply budget tier multiplier (more budget = more time for quality)
  const tierMultiplier = budgetTier ? BUDGET_TIER_MULTIPLIERS[budgetTier] : 1.0;
  const adjustedHours = baseHours * tierMultiplier;

  return Math.round(adjustedHours);
}

/**
 * Map deliverable type to pricing discipline
 * Used to categorize scoped deliverables into disciplines
 */
export function inferDisciplineFromDeliverableType(deliverableName: string): PricingDiscipline {
  const nameLower = deliverableName.toLowerCase();

  // Interior design discipline
  if (
    nameLower.includes('interior') ||
    nameLower.includes('furniture') ||
    nameLower.includes('finish') ||
    nameLower.includes('material board') ||
    nameLower.includes('lighting design') ||
    nameLower.includes('millwork') ||
    nameLower.includes('ff&e') ||
    nameLower.includes('color')
  ) {
    return 'interior-design';
  }

  // MEP discipline
  if (
    nameLower.includes('mep') ||
    nameLower.includes('mechanical') ||
    nameLower.includes('electrical') ||
    nameLower.includes('plumbing') ||
    nameLower.includes('hvac') ||
    nameLower.includes('fire protection')
  ) {
    return 'mep';
  }

  // Structural discipline
  if (
    nameLower.includes('structural') ||
    nameLower.includes('foundation') ||
    nameLower.includes('framing') ||
    nameLower.includes('beam') ||
    nameLower.includes('column')
  ) {
    return 'structural';
  }

  // Default to architecture for most deliverables
  return 'architecture';
}

/**
 * Convert scoped deliverables from project scoping AI to pricing deliverables
 * Filters for DESIGN_DOCUMENT category and infers role, stage, hours
 */
export function convertScopedDeliverablesToPricingDeliverables(
  scopedDeliverables: ScopedDeliverable[],
  budgetTier?: BudgetTier
): PricingDeliverable[] {
  // Filter for DESIGN_DOCUMENT category only
  const designDocDeliverables = scopedDeliverables.filter(
    (del) => del.category === 'DESIGN_DOCUMENT'
  );

  return designDocDeliverables.map((del) => {
    const role = inferRoleFromDeliverableType(del.name, del.complexity);
    const designStage = inferStageFromDeliverableType(del.name);
    const estimatedHours = estimateDeliverableHours(del.name, budgetTier, del.complexity);

    return {
      id: nanoid(10),
      name: del.name,
      estimatedHours,
      role,
      designStage,
    };
  });
}

/**
 * Pre-populate bottom-up pricing from strategy scoped deliverables
 * Groups deliverables by discipline and returns ready-to-use proposal data
 */
export function prepopulateFromStrategy(
  scopedDeliverables: ScopedDeliverable[],
  budgetTier?: BudgetTier
): {
  disciplines: Array<{ discipline: PricingDiscipline; deliverables: PricingDeliverable[] }>;
  totalDeliverables: number;
  totalEstimatedHours: number;
} {
  const pricingDeliverables = convertScopedDeliverablesToPricingDeliverables(
    scopedDeliverables,
    budgetTier
  );

  // Group by discipline
  const disciplineMap = new Map<PricingDiscipline, PricingDeliverable[]>();
  for (const del of pricingDeliverables) {
    const discipline = inferDisciplineFromDeliverableType(del.name);
    const existing = disciplineMap.get(discipline) || [];
    existing.push(del);
    disciplineMap.set(discipline, existing);
  }

  // Convert to array format
  const disciplines = Array.from(disciplineMap.entries()).map(([discipline, deliverables]) => ({
    discipline,
    deliverables,
  }));

  const totalEstimatedHours = pricingDeliverables.reduce((sum, d) => sum + d.estimatedHours, 0);

  return {
    disciplines,
    totalDeliverables: pricingDeliverables.length,
    totalEstimatedHours,
  };
}
