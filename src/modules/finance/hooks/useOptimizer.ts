/**
 * useOptimizer — Phase 1.C Stub
 *
 * The original `useOptimizer` hook was the bridge between Finance pages and
 * the BOM/cutlist Optimization service (project-driven spend prioritization
 * for construction projects). That service was deleted in Phase 1.C alongside
 * the design-manager / manufacturing modules.
 *
 * This stub keeps the surface API stable so the SpendPlan / CashForecast /
 * CashProjections / FinanceOverview pages continue to render. All data is
 * empty / no-op; the optimizer-driven sections will show as inactive until
 * Phase 3 rebuilds a Campaign-aware spend optimizer.
 *
 * TODO Phase 3: replace with real `useCampaignSpendOptimizer` that scores
 * pending expenditures against active Campaigns + the Tier System.
 */

interface UseOptimizerOptions {
  companyId: string;
}

/**
 * Permissive `any` return shape — destructured in many places. Phase 3 will
 * replace this with a typed Campaign-aware optimizer.
 */
export function useOptimizer(_options: UseOptimizerOptions): any {
  const noop = async (..._args: any[]) => {};
  return {
    todaysSpendPlan: null,
    projection: null,
    expenditureQueue: [],
    queueByTier: {},
    criticalCount: 0,
    totalPendingAmount: 0,
    config: {},
    isLoading: false,
    error: null,
    refresh: noop,
    generatePlan: noop,
    approveItem: noop,
    deferItem: noop,
    runIngestion: noop,
    rescoreAll: noop,
  };
}
