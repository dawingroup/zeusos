/**
 * RAG Status Service
 * Manages Red-Amber-Green status for optimization workflow
 */

import type { 
  Project, 
  OptimizationRAGStatus, 
  EstimationResult, 
  ProductionResult 
} from '@/shared/types';

// ============================================
// Types
// ============================================

export type RAGCategory = 'estimation' | 'production';
export type RAGStatus = 'red' | 'amber' | 'green' | 'grey';

export interface RAGUpdate {
  status: RAGStatus;
  message: string;
}

// ============================================
// RAG Status Helper Functions
// ============================================

/**
 * Update optimization RAG status based on current project state
 */
export function updateOptimizationRAG(project: Project): OptimizationRAGStatus {
  const estimation = project.optimizationState?.estimation ?? null;
  const production = project.optimizationState?.production ?? null;
  
  const ragStatus: OptimizationRAGStatus = {
    estimation: getEstimationRAG(estimation),
    production: getProductionRAG(production, estimation),
  };
  
  return ragStatus;
}

/**
 * Get RAG status for estimation
 */
function getEstimationRAG(estimation: EstimationResult | null): RAGUpdate {
  if (!estimation) {
    return {
      status: 'red',
      message: 'No estimation run - run estimation to get sheet counts and costs',
    };
  }
  
  if (estimation.invalidatedAt) {
    const reasons = estimation.invalidationReasons?.join(', ') || 'Changes detected';
    return {
      status: 'amber',
      message: `Estimation outdated: ${reasons}`,
    };
  }
  
  return {
    status: 'green',
    message: `Estimation current (${estimation.totalSheetsCount} sheets, ${estimation.wasteEstimate.toFixed(1)}% waste)`,
  };
}

/**
 * Get RAG status for production nesting
 */
function getProductionRAG(
  production: ProductionResult | null,
  estimation: EstimationResult | null
): RAGUpdate {
  // Can't have production without estimation
  if (!estimation) {
    return {
      status: 'grey',
      message: 'Run estimation first',
    };
  }
  
  if (!production) {
    return {
      status: 'red',
      message: 'No production nesting - generate nesting for cut sheets',
    };
  }
  
  if (production.invalidatedAt) {
    const reasons = production.invalidationReasons?.join(', ') || 'Changes detected';
    return {
      status: 'amber',
      message: `Production nesting outdated: ${reasons}`,
    };
  }
  
  return {
    status: 'green',
    message: `Nesting current (${production.nestingSheets.length} sheets, ${production.optimizedYield.toFixed(1)}% yield)`,
  };
}

/**
 * Get overall project optimization status
 */
export function getOverallOptimizationStatus(
  ragStatus: OptimizationRAGStatus
): { status: RAGStatus; message: string } {
  // If any is red, overall is red
  if (
    ragStatus.estimation.status === 'red' ||
    ragStatus.production.status === 'red'
  ) {
    return {
      status: 'red',
      message: 'Optimization incomplete',
    };
  }
  
  // If any is amber, overall is amber
  if (
    ragStatus.estimation.status === 'amber' ||
    ragStatus.production.status === 'amber'
  ) {
    return {
      status: 'amber',
      message: 'Optimization needs refresh',
    };
  }
  
  // If estimation and production are green
  if (
    ragStatus.estimation.status === 'green' &&
    ragStatus.production.status === 'green'
  ) {
    return {
      status: 'green',
      message: 'Optimization up to date',
    };
  }
  
  return {
    status: 'grey',
    message: 'Optimization not started',
  };
}

/**
 * Get color class for RAG status (Tailwind)
 */
export function getRAGColorClass(status: RAGStatus): string {
  switch (status) {
    case 'red':
      return 'bg-[var(--rag-red-soft)] text-[var(--rag-red)] border-[var(--rag-red)]';
    case 'amber':
      return 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)] border-[var(--rag-amber)]';
    case 'green':
      return 'bg-[var(--rag-green-soft)] text-[var(--rag-green)] border-[var(--rag-green)]';
    case 'grey':
    default:
      return 'bg-[var(--bg-sunken)] text-muted-foreground border-[var(--border-subtle)]';
  }
}

/**
 * Get icon for RAG status
 */
export function getRAGIcon(status: RAGStatus): string {
  switch (status) {
    case 'red':
      return '🔴';
    case 'amber':
      return '🟡';
    case 'green':
      return '🟢';
    case 'grey':
    default:
      return '⚪';
  }
}
