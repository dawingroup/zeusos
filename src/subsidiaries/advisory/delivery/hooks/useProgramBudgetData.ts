/**
 * USE PROGRAM BUDGET DATA
 *
 * Composite hook that aggregates budget periods, fund locations,
 * exchange rates, and project data into a unified program-level
 * budget view. All derived data computed via useMemo.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Firestore } from 'firebase/firestore';

// Existing hooks
import { useProjects } from './project-hooks';
import { useProgramBudgetPeriods, useActiveBudgetPeriod } from './budget-period-hooks';
import { useProgramFundLocations, useFundLocationBalances } from './fund-location-hooks';
import { useProgramExchangeRates, useLatestRate } from './exchange-rate-hooks';

// Types
import type { Program } from '../types/program';
import type { Money } from '../../core/types/money';
import type { BudgetPeriod } from '../types/budget-period';
import type { FundLocation, FundLocationBalance } from '../types/fund-location';
import type { ExchangeRateEntry, TransactionExchangeRate } from '../types/exchange-rate';

// ─────────────────────────────────────────────────────────────────
// TYPES
// ─────────────────────────────────────────────────────────────────

export interface ProjectBudgetRollupItem {
  projectId: string;
  projectName: string;
  projectCode: string;
  budgetCurrency: string;       // Project's budget currency (usually UGX)
  budgetAmount: number;          // Project budget in project currency
  budgetAmountUSD: number;       // Converted to USD
  spentAmount: number;           // In project currency
  spentAmountUSD: number;        // Converted to USD
  committedAmount: number;
  committedAmountUSD: number;
  remainingAmount: number;
  utilizationPercent: number;
  exchangeRate?: TransactionExchangeRate; // Rate used for conversion
}

export interface CurrencyExposure {
  totalBudgetUSD: number;
  totalBudgetUGXEquivalent: number;
  totalSpentUGX: number;
  totalSpentUSDEquivalent: number;
  weightedAvgRate: number;
  fxVariance: number;            // Difference due to rate fluctuations
}

export interface ProgramBudgetData {
  // Consolidated totals
  consolidatedBudgetUSD: Money;
  consolidatedSpentUSD: Money;
  consolidatedCommittedUSD: Money;
  consolidatedAvailableUSD: Money;
  utilizationPercent: number;

  // Per-project rollup
  projectRollup: ProjectBudgetRollupItem[];
  activeProjectCount: number;

  // Budget periods
  periods: BudgetPeriod[];
  activePeriod: BudgetPeriod | null;
  selectedPeriod: BudgetPeriod | null;
  setSelectedPeriodId: (id: string | null) => void;

  // Fund locations
  locations: FundLocation[];
  locationBalances: FundLocationBalance[];

  // Exchange rates
  rates: ExchangeRateEntry[];
  latestRate: ExchangeRateEntry | null;
  currencyExposure: CurrencyExposure;

  // Loading/error
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

// ─────────────────────────────────────────────────────────────────
// COMPOSITE HOOK
// ─────────────────────────────────────────────────────────────────

export function useProgramBudgetData(
  db: Firestore,
  program: Program,
  _userId: string
): ProgramBudgetData {
  const programId = program.id;

  // ── Data hooks ──────────────────────────────────────────────
  const {
    projects,
    loading: projectsLoading,
    error: projectsError,
    refresh: refreshProjects,
  } = useProjects(db, programId);

  const {
    periods,
    loading: periodsLoading,
    error: periodsError,
    refresh: refreshPeriods,
  } = useProgramBudgetPeriods(db, programId);

  const {
    period: activePeriod,
    loading: activePeriodLoading,
    error: activePeriodError,
  } = useActiveBudgetPeriod(db, programId);

  const {
    locations,
    loading: locationsLoading,
    error: locationsError,
    refresh: refreshLocations,
  } = useProgramFundLocations(db, programId);

  // Derive locationIds for balance calculation
  const locationIds = useMemo(
    () => locations.map(loc => loc.id),
    [locations]
  );

  const {
    balances: rawLocationBalances,
    loading: balancesLoading,
    error: balancesError,
    refresh: refreshBalances,
  } = useFundLocationBalances(db, programId, locationIds);

  const {
    rates,
    loading: ratesLoading,
    error: ratesError,
    refresh: refreshRates,
  } = useProgramExchangeRates(db, programId);

  const {
    rate: latestRate,
    loading: latestRateLoading,
    error: latestRateError,
  } = useLatestRate(db, programId, 'USD', 'UGX');

  // ── Selected period state ───────────────────────────────────
  const [selectedPeriodId, setSelectedPeriodId] = useState<string | null>(null);

  // Default to active period when it loads
  useEffect(() => {
    if (activePeriod && !selectedPeriodId) {
      setSelectedPeriodId(activePeriod.id);
    }
  }, [activePeriod, selectedPeriodId]);

  const selectedPeriod = useMemo(() => {
    if (!selectedPeriodId) return activePeriod;
    return periods.find(p => p.id === selectedPeriodId) ?? null;
  }, [selectedPeriodId, periods, activePeriod]);

  // ── Project rollup ─────────────────────────────────────────
  const projectRollup = useMemo<ProjectBudgetRollupItem[]>(() => {
    return projects.map(project => {
      const budget = project.budget;
      const budgetCurrency = budget.currency;
      const budgetAmount = budget.totalBudget;
      const spentAmount = budget.spent;
      const committedAmount = budget.committed;
      const utilizationPercent =
        budgetAmount > 0
          ? ((spentAmount + committedAmount) / budgetAmount) * 100
          : 0;

      let budgetAmountUSD = 0;
      let spentAmountUSD = 0;
      let committedAmountUSD = 0;
      let txRate: TransactionExchangeRate | undefined;

      if (budgetCurrency === 'USD') {
        // Already in USD
        budgetAmountUSD = budgetAmount;
        spentAmountUSD = spentAmount;
        committedAmountUSD = committedAmount;
      } else if (budgetCurrency === 'UGX' && latestRate) {
        // Convert UGX to USD using inverse of the USD→UGX rate
        const inverseRate = latestRate.rate > 0 ? 1 / latestRate.rate : 0;
        budgetAmountUSD = budgetAmount * inverseRate;
        spentAmountUSD = spentAmount * inverseRate;
        committedAmountUSD = committedAmount * inverseRate;

        txRate = {
          fromCurrency: 'USD',
          toCurrency: 'UGX',
          rate: latestRate.rate,
          inverseRate,
          rateDate: latestRate.effectiveDate instanceof Date
            ? latestRate.effectiveDate
            : new Date(latestRate.effectiveDate),
          source: latestRate.source,
        };
      }
      // else: unsupported currency or no rate — leave USD equivalents as 0

      // Remaining is always in USD so it's comparable across mixed-currency programs
      const remainingAmount = budgetAmountUSD - spentAmountUSD - committedAmountUSD;

      return {
        projectId: project.id,
        projectName: project.name,
        projectCode: project.projectCode,
        budgetCurrency,
        budgetAmount,
        budgetAmountUSD,
        spentAmount,
        spentAmountUSD,
        committedAmount,
        committedAmountUSD,
        remainingAmount,
        utilizationPercent,
        exchangeRate: txRate,
      };
    });
  }, [projects, latestRate]);

  // ── Auto-seed treasury balance from program budget ────────
  // The treasury represents where the program budget "lives" before being
  // transferred out to field offices, so its totalReceived starts with the
  // program budget amount. Project budget allocations are treated as
  // committed (pending) funds from the treasury's perspective.
  const locationBalances = useMemo(() => {
    const treasuryLocation = locations.find(l => l.isTreasury && l.isActive);
    if (!treasuryLocation) return rawLocationBalances;

    const programBudgetAmount = program.budget.allocated.amount;
    const programBudgetCurrency = program.budget.currency;

    // Sum all project budgets converted to treasury currency — these
    // represent funds "committed" from treasury to projects.
    const totalProjectBudgetsInTreasuryCurrency = projectRollup.reduce((sum, p) => {
      if (p.budgetCurrency === treasuryLocation.currency) {
        return sum + p.budgetAmount;
      }
      if (!latestRate) return sum;
      if (p.budgetCurrency === 'UGX' && treasuryLocation.currency === 'USD') {
        return sum + (latestRate.rate > 0 ? p.budgetAmount / latestRate.rate : 0);
      }
      if (p.budgetCurrency === 'USD' && treasuryLocation.currency === 'UGX') {
        return sum + p.budgetAmount * latestRate.rate;
      }
      return sum;
    }, 0);

    return rawLocationBalances.map(balance => {
      if (balance.locationId !== treasuryLocation.id) return balance;

      // Seed totalReceived with the program's allocated budget
      let seedAmount = programBudgetAmount;
      if (
        programBudgetCurrency !== balance.currency &&
        latestRate &&
        programBudgetCurrency === 'USD' &&
        balance.currency === 'UGX'
      ) {
        seedAmount = programBudgetAmount * latestRate.rate;
      } else if (
        programBudgetCurrency !== balance.currency &&
        latestRate &&
        programBudgetCurrency === 'UGX' &&
        balance.currency === 'USD'
      ) {
        seedAmount = latestRate.rate > 0 ? programBudgetAmount / latestRate.rate : 0;
      }

      const totalReceived = seedAmount + balance.totalReceived;
      const totalPending = balance.totalPending + totalProjectBudgetsInTreasuryCurrency;
      return {
        ...balance,
        totalReceived,
        totalPending,
        availableBalance: totalReceived - balance.totalDisbursed - totalPending,
      };
    });
  }, [rawLocationBalances, locations, program.budget, latestRate, projectRollup]);

  // ── Active project count ────────────────────────────────────
  const activeProjectCount = useMemo(() => {
    const activeStatuses = ['mobilization', 'active', 'substantial_completion', 'defects_liability'];
    return projects.filter(p => activeStatuses.includes(p.status)).length;
  }, [projects]);

  // ── Consolidated totals ─────────────────────────────────────
  const consolidatedBudgetUSD = useMemo<Money>(() => ({
    amount: projectRollup.reduce((sum, r) => sum + r.budgetAmountUSD, 0),
    currency: 'USD',
  }), [projectRollup]);

  const consolidatedSpentUSD = useMemo<Money>(() => ({
    amount: projectRollup.reduce((sum, r) => sum + r.spentAmountUSD, 0),
    currency: 'USD',
  }), [projectRollup]);

  const consolidatedCommittedUSD = useMemo<Money>(() => ({
    amount: projectRollup.reduce((sum, r) => sum + r.committedAmountUSD, 0),
    currency: 'USD',
  }), [projectRollup]);

  const consolidatedAvailableUSD = useMemo<Money>(() => ({
    amount: consolidatedBudgetUSD.amount - consolidatedSpentUSD.amount - consolidatedCommittedUSD.amount,
    currency: 'USD',
  }), [consolidatedBudgetUSD, consolidatedSpentUSD, consolidatedCommittedUSD]);

  const utilizationPercent = useMemo(() => {
    if (consolidatedBudgetUSD.amount <= 0) return 0;
    return (
      ((consolidatedSpentUSD.amount + consolidatedCommittedUSD.amount) /
        consolidatedBudgetUSD.amount) *
      100
    );
  }, [consolidatedBudgetUSD, consolidatedSpentUSD, consolidatedCommittedUSD]);

  // ── Currency exposure ───────────────────────────────────────
  const currencyExposure = useMemo<CurrencyExposure>(() => {
    const rateValue = latestRate?.rate ?? 0;

    const totalBudgetUSD = consolidatedBudgetUSD.amount;
    const totalBudgetUGXEquivalent = totalBudgetUSD * rateValue;

    // Sum of spent in UGX-denominated projects (in their native currency)
    const totalSpentUGX = projectRollup
      .filter(r => r.budgetCurrency === 'UGX')
      .reduce((sum, r) => sum + r.spentAmount, 0);

    const totalSpentUSDEquivalent = consolidatedSpentUSD.amount;

    // Weighted average rate: total UGX spent / total USD equivalent of that spend
    const weightedAvgRate =
      totalSpentUSDEquivalent > 0
        ? totalSpentUGX / totalSpentUSDEquivalent
        : rateValue;

    // FX variance: the difference between what the UGX budget should cover
    // at the latest rate vs what was actually spent + what remains
    const fxVariance =
      totalBudgetUGXEquivalent -
      totalSpentUGX -
      consolidatedAvailableUSD.amount * rateValue;

    return {
      totalBudgetUSD,
      totalBudgetUGXEquivalent,
      totalSpentUGX,
      totalSpentUSDEquivalent,
      weightedAvgRate,
      fxVariance,
    };
  }, [projectRollup, latestRate, consolidatedBudgetUSD, consolidatedSpentUSD, consolidatedAvailableUSD]);

  // ── Combined loading & error ────────────────────────────────
  const loading =
    projectsLoading ||
    periodsLoading ||
    activePeriodLoading ||
    locationsLoading ||
    balancesLoading ||
    ratesLoading ||
    latestRateLoading;

  const error =
    projectsError ||
    periodsError ||
    activePeriodError ||
    locationsError ||
    balancesError ||
    ratesError ||
    latestRateError ||
    null;

  // ── Refresh all ─────────────────────────────────────────────
  const refresh = useCallback(async () => {
    await Promise.all([
      refreshProjects(),
      refreshPeriods(),
      refreshLocations(),
      refreshBalances(),
      refreshRates(),
    ]);
  }, [refreshProjects, refreshPeriods, refreshLocations, refreshBalances, refreshRates]);

  return {
    consolidatedBudgetUSD,
    consolidatedSpentUSD,
    consolidatedCommittedUSD,
    consolidatedAvailableUSD,
    utilizationPercent,

    projectRollup,
    activeProjectCount,

    periods,
    activePeriod,
    selectedPeriod,
    setSelectedPeriodId,

    locations,
    locationBalances,

    rates,
    latestRate,
    currencyExposure,

    loading,
    error,
    refresh,
  };
}
