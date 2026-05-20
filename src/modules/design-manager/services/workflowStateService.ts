/**
 * Workflow State Service
 * Manages pricing/estimation workflow progress tracking
 */

import { doc, updateDoc, Timestamp as FirestoreTimestamp } from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { DesignItem } from '../types';
import type { Project, Timestamp } from '@/shared/types';
import {
  detectProjectStaleness,
  getItemsMissingCosting,
  hasValidCosting,
  type StalenessReport,
} from './workflowStalenessService';

export type WorkflowStepStatus = 'not-started' | 'in-progress' | 'complete' | 'stale';

export interface ValidationError {
  itemId: string;
  itemName: string;
  issue: string;
  severity: 'error' | 'warning';
  tab?: 'parts' | 'pricing' | 'construction' | 'procurement';
  action?: string;
}

export interface WorkflowStep {
  status: WorkflowStepStatus;
  lastUpdated?: Timestamp;
  metadata?: Record<string, any>;
}

export interface ItemCostingStep extends WorkflowStep {
  completedItems: string[];
  totalItems: number;
  missingCostingItems: string[];
}

export interface OptimizationStep extends WorkflowStep {
  lastRun?: Timestamp;
  invalidatedAt?: Timestamp;
  invalidReason?: string;
}

export interface EstimateGenerationStep extends WorkflowStep {
  lastGenerated?: Timestamp;
  isStale: boolean;
  staleReason?: string;
}

export interface PricingWorkflowState {
  steps: {
    itemCosting: ItemCostingStep;
    optimization: OptimizationStep;
    estimateGeneration: EstimateGenerationStep;
  };
  validationErrors: ValidationError[];
  currentStep: 'item-costing' | 'optimization' | 'estimate' | 'complete';
  suggestedAction?: string;
  lastUpdated: Timestamp;
}

/**
 * Calculate workflow state from project and design items
 * This is the main function to get current workflow status
 */
export async function calculateWorkflowState(
  project: Project,
  designItems: DesignItem[]
): Promise<PricingWorkflowState> {
  // Detect staleness
  const stalenessReport = detectProjectStaleness(project, designItems);

  // Get items missing costing
  const missingCostingItems = getItemsMissingCosting(designItems);
  const costedItems = designItems.filter(item => {
    if (item.sourcingType === 'MANUFACTURED' || item.sourcingType === 'CUSTOM_FURNITURE_MILLWORK') {
      return hasValidCosting(item);
    }
    // For non-manufactured items, check their respective costing fields
    return true; // Simplified for now
  });

  // Calculate item costing step status
  const itemCostingStatus = getItemCostingStatus(designItems, missingCostingItems);

  // Calculate optimization step status
  const optimizationStatus = getOptimizationStatus(project, stalenessReport);

  // Calculate estimate generation step status
  const estimateStatus = getEstimateStatus(project, stalenessReport);

  // Determine current step (what user should do next)
  const currentStep = determineCurrentStep(itemCostingStatus, optimizationStatus, estimateStatus);

  // Generate validation errors
  const validationErrors = generateValidationErrors(designItems, missingCostingItems, stalenessReport);

  // Generate suggested action
  const suggestedAction = generateSuggestedAction(currentStep, validationErrors, stalenessReport);

  return {
    steps: {
      itemCosting: {
        status: itemCostingStatus,
        completedItems: costedItems.map(i => i.id),
        totalItems: designItems.length,
        missingCostingItems: missingCostingItems.map(i => i.id),
        lastUpdated: FirestoreTimestamp.now(),
      },
      optimization: {
        status: optimizationStatus,
        lastRun: project.optimizationState?.estimation?.validAt,
        invalidatedAt: project.optimizationState?.estimation?.invalidatedAt,
        invalidReason: stalenessReport.reasons.find(r => r.includes('Optimization'))?.replace('Optimization: ', ''),
        lastUpdated: FirestoreTimestamp.now(),
      },
      estimateGeneration: {
        status: estimateStatus,
        lastGenerated: project.consolidatedEstimate?.generatedAt,
        isStale: stalenessReport.reasons.some(r => r.includes('Estimate')),
        staleReason: stalenessReport.reasons.find(r => r.includes('Estimate'))?.replace('Estimate: ', ''),
        lastUpdated: FirestoreTimestamp.now(),
      },
    },
    validationErrors,
    currentStep,
    suggestedAction,
    lastUpdated: FirestoreTimestamp.now(),
  };
}

/**
 * Determine item costing step status
 */
function getItemCostingStatus(
  designItems: DesignItem[],
  missingCostingItems: DesignItem[]
): WorkflowStepStatus {
  if (designItems.length === 0) {
    return 'not-started';
  }

  if (missingCostingItems.length === 0) {
    return 'complete';
  }

  if (missingCostingItems.length === designItems.length) {
    return 'not-started';
  }

  return 'in-progress';
}

/**
 * Determine optimization step status
 */
function getOptimizationStatus(
  project: Project,
  stalenessReport: StalenessReport
): WorkflowStepStatus {
  const optimization = project.optimizationState?.estimation;

  if (!optimization || !optimization.validAt) {
    return 'not-started';
  }

  // Check if optimization is stale
  const optimizationStale = stalenessReport.reasons.some(r => r.includes('Optimization'));
  if (optimizationStale) {
    return 'stale';
  }

  return 'complete';
}

/**
 * Determine estimate generation step status
 */
function getEstimateStatus(
  project: Project,
  stalenessReport: StalenessReport
): WorkflowStepStatus {
  const estimate = project.consolidatedEstimate;

  if (!estimate || !estimate.generatedAt) {
    return 'not-started';
  }

  // Check if estimate is stale
  const estimateStale = stalenessReport.reasons.some(r => r.includes('Estimate'));
  if (estimateStale || estimate.isStale) {
    return 'stale';
  }

  return 'complete';
}

/**
 * Determine what step user should focus on next
 */
function determineCurrentStep(
  itemCostingStatus: WorkflowStepStatus,
  optimizationStatus: WorkflowStepStatus,
  estimateStatus: WorkflowStepStatus
): 'item-costing' | 'optimization' | 'estimate' | 'complete' {
  // Priority order: item-costing → optimization → estimate

  if (itemCostingStatus === 'not-started' || itemCostingStatus === 'in-progress') {
    return 'item-costing';
  }

  if (optimizationStatus === 'not-started' || optimizationStatus === 'stale') {
    return 'optimization';
  }

  if (estimateStatus === 'not-started' || estimateStatus === 'stale') {
    return 'estimate';
  }

  return 'complete';
}

/**
 * Generate validation errors from staleness and missing costing
 */
function generateValidationErrors(
  _designItems: DesignItem[],
  missingCostingItems: DesignItem[],
  stalenessReport: StalenessReport
): ValidationError[] {
  const errors: ValidationError[] = [];

  // Add errors for missing costing
  for (const item of missingCostingItems) {
    let issue = 'Missing costing data';
    let tab: ValidationError['tab'] = 'parts';
    let action = 'Click Auto Calculate and Save Costing';

    if (item.sourcingType === 'PROCURED') {
      issue = 'Missing procurement pricing';
      tab = 'procurement';
      action = 'Enter vendor pricing';
    } else if (item.sourcingType === 'DESIGN_DOCUMENT') {
      issue = 'Missing design document pricing';
      tab = 'pricing';
      action = 'Enter hours in pricing matrix';
    } else if (item.sourcingType === 'CONSTRUCTION') {
      issue = 'Missing construction pricing';
      tab = 'pricing';
      action = 'Enter construction costs';
    }

    errors.push({
      itemId: item.id,
      itemName: item.name,
      issue,
      severity: 'error',
      tab,
      action,
    });
  }

  // Add warnings from staleness report
  if (stalenessReport.isStale) {
    for (const reason of stalenessReport.reasons) {
      errors.push({
        itemId: '',
        itemName: 'Project',
        issue: reason,
        severity: 'warning',
        action: stalenessReport.requiredActions[0],
      });
    }
  }

  return errors;
}

/**
 * Generate user-friendly suggested action
 */
function generateSuggestedAction(
  currentStep: PricingWorkflowState['currentStep'],
  validationErrors: ValidationError[],
  stalenessReport: StalenessReport
): string {
  const errorCount = validationErrors.filter(e => e.severity === 'error').length;
  const warningCount = validationErrors.filter(e => e.severity === 'warning').length;

  switch (currentStep) {
    case 'item-costing':
      if (errorCount > 0) {
        return `Complete costing for ${errorCount} item(s) in their respective tabs`;
      }
      return 'All items are costed! Proceed to optimization';

    case 'optimization':
      if (stalenessReport.reasons.some(r => r.includes('Optimization'))) {
        return 'Re-run optimization in NestingStudio tab (data has changed)';
      }
      return 'Run optimization in NestingStudio tab';

    case 'estimate':
      if (stalenessReport.reasons.some(r => r.includes('Estimate'))) {
        return 'Regenerate estimate (costing or optimization has changed)';
      }
      return 'Generate estimate in Estimate tab';

    case 'complete':
      if (warningCount > 0) {
        return `Review ${warningCount} warning(s) - data may be stale`;
      }
      return 'All done! Estimate is up to date';
  }
}

/**
 * Save workflow state to Firestore
 * Note: This is optional - workflow state can be calculated on-demand
 */
export async function saveWorkflowState(
  projectId: string,
  workflowState: PricingWorkflowState
): Promise<void> {
  const projectRef = doc(db, 'designProjects', projectId);
  await updateDoc(projectRef, {
    'workflowState': workflowState,
    'workflowState.lastUpdated': FirestoreTimestamp.now(),
  });
}

/**
 * Mark a workflow step as updated
 * Helper function to update individual step timestamps
 */
export async function markStepUpdated(
  projectId: string,
  step: 'itemCosting' | 'optimization' | 'estimateGeneration'
): Promise<void> {
  const projectRef = doc(db, 'designProjects', projectId);
  await updateDoc(projectRef, {
    [`workflowState.steps.${step}.lastUpdated`]: FirestoreTimestamp.now(),
  });
}

/**
 * Get workflow progress percentage (0-100)
 */
export function getWorkflowProgress(workflowState: PricingWorkflowState): number {
  const steps = [
    workflowState.steps.itemCosting.status,
    workflowState.steps.optimization.status,
    workflowState.steps.estimateGeneration.status,
  ];

  const completedSteps = steps.filter(s => s === 'complete').length;
  return Math.round((completedSteps / steps.length) * 100);
}

/**
 * Get workflow step display info
 */
export function getStepDisplayInfo(status: WorkflowStepStatus): {
  color: string;
  icon: string;
  label: string;
} {
  switch (status) {
    case 'complete':
      return { color: 'green', icon: '✓', label: 'Complete' };
    case 'in-progress':
      return { color: 'blue', icon: '⏳', label: 'In Progress' };
    case 'stale':
      return { color: 'yellow', icon: '⚠', label: 'Needs Update' };
    case 'not-started':
      return { color: 'gray', icon: '○', label: 'Not Started' };
  }
}

/**
 * Check if workflow is ready for estimate generation
 */
export function isReadyForEstimate(workflowState: PricingWorkflowState): boolean {
  return (
    workflowState.steps.itemCosting.status === 'complete' &&
    workflowState.steps.optimization.status === 'complete' &&
    workflowState.validationErrors.filter(e => e.severity === 'error').length === 0
  );
}

/**
 * Get next action for user
 */
export function getNextAction(workflowState: PricingWorkflowState): {
  step: string;
  action: string;
  link?: string;
} {
  const currentStep = workflowState.currentStep;
  const suggestedAction = workflowState.suggestedAction || '';

  switch (currentStep) {
    case 'item-costing':
      return {
        step: 'Item Costing',
        action: suggestedAction,
        link: '#items', // Link to items tab
      };
    case 'optimization':
      return {
        step: 'Optimization',
        action: suggestedAction,
        link: '#production', // Link to production/nesting tab
      };
    case 'estimate':
      return {
        step: 'Estimate',
        action: suggestedAction,
        link: '#estimate', // Link to estimate tab
      };
    case 'complete':
      return {
        step: 'Complete',
        action: suggestedAction,
      };
  }
}
