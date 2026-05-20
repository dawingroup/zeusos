/**
 * Program Budget Page
 *
 * Orchestrator page for the consolidated program-level budget dashboard.
 * Uses useProgramBudgetData composite hook to gather all data, then renders
 * multiple sub-components for budget periods, fund locations, exchange rates,
 * project rollup, and carry-forward management.
 *
 * Route: /advisory/delivery/programs/:programId/budget
 */

import { useState, useCallback, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import { ChevronLeft, Loader2, AlertCircle, RefreshCw } from 'lucide-react';
import { useProgram, useBudgetManagement } from '../hooks/program-hooks';
import { useProgramBudgetData } from '../hooks/useProgramBudgetData';
import { useCarryForwardRequests, useBudgetPeriodMutations } from '../hooks/budget-period-hooks';
import { useFundTransfers, useFundLocationMutations } from '../hooks/fund-location-hooks';
import { useExchangeRateMutations } from '../hooks/exchange-rate-hooks';
import { useCoInvestments, useCoInvestmentMutations } from '../hooks/co-investment-hooks';
import {
  ProgramBudgetSummary,
  FundLocationBalances,
  BudgetPeriodTimeline,
  ProjectBudgetRollup,
  CurrencyConversionSummary,
  CarryForwardManager,
  FundTransferLog,
  NewTransferDialog,
  ExchangeRateManager,
  BudgetPeriodDetail,
  CoInvestmentTracker,
} from '../components/program-budget';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/shared/hooks';
import type { Program } from '../types/program';
import type { TransferLineItem } from '../types/fund-location';

// ─────────────────────────────────────────────────────────────────
// PUBLIC PAGE COMPONENT
// ─────────────────────────────────────────────────────────────────

export function ProgramBudgetPage() {
  const { programId } = useParams<{ programId: string }>();
  const { user } = useAuth();
  const { program, loading, error } = useProgram(db, programId || null);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading program...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error.message}</span>
        </div>
      </div>
    );
  }

  if (!program) {
    return (
      <div className="text-center py-12">
        <h2 className="text-xl font-medium text-gray-900">Program not found</h2>
        <p className="text-gray-600 mt-2">The program you are looking for does not exist.</p>
        <Link
          to="/advisory/delivery/programs"
          className="text-primary hover:underline mt-4 inline-block"
        >
          Back to programs
        </Link>
      </div>
    );
  }

  return (
    <ProgramBudgetContent program={program} userId={user?.uid || ''} />
  );
}

// ─────────────────────────────────────────────────────────────────
// INNER CONTENT COMPONENT (receives loaded Program)
// ─────────────────────────────────────────────────────────────────

interface ProgramBudgetContentProps {
  program: Program;
  userId: string;
}

function ProgramBudgetContent({ program, userId }: ProgramBudgetContentProps) {
  const programId = program.id;

  // ── Composite budget data ────────────────────────────────────
  const budgetData = useProgramBudgetData(db, program, userId);

  // ── Carry-forward requests ───────────────────────────────────
  const {
    requests: carryForwardRequests,
    loading: cfLoading,
    refresh: refreshCF,
  } = useCarryForwardRequests(db, programId);

  // ── Fund transfers ───────────────────────────────────────────
  const {
    transfers,
    loading: transfersLoading,
    refresh: refreshTransfers,
  } = useFundTransfers(db, programId);

  // ── Co-investment data ──────────────────────────────────────
  const {
    summary: coInvestmentSummary,
    loading: coInvestmentLoading,
    refresh: refreshCoInvestments,
  } = useCoInvestments(db, programId);

  // ── Mutation hooks ───────────────────────────────────────────
  const budgetPeriodMutations = useBudgetPeriodMutations(db, userId);
  const fundLocationMutations = useFundLocationMutations(db, userId);
  const exchangeRateMutations = useExchangeRateMutations(db, userId);
  const coInvestmentMutations = useCoInvestmentMutations(db, userId);
  const budgetManagement = useBudgetManagement(db, programId, userId);

  // ── Local state ──────────────────────────────────────────────
  const [showNewTransferDialog, setShowNewTransferDialog] = useState(false);

  // ── Auto-generated transfer reference ──────────────────────
  const nextTransferReference = useMemo(() => {
    const year = new Date().getFullYear();
    const prefix = `TRF-${year}-`;
    // Find the highest existing sequence number for this year
    let maxSeq = 0;
    for (const t of transfers) {
      const ref = t.reference ?? '';
      if (ref.startsWith(prefix)) {
        const seq = parseInt(ref.slice(prefix.length), 10);
        if (!isNaN(seq) && seq > maxSeq) maxSeq = seq;
      }
    }
    return `${prefix}${String(maxSeq + 1).padStart(3, '0')}`;
  }, [transfers]);

  // ── Callbacks ────────────────────────────────────────────────
  const handleApproveCarryForward = useCallback(
    async (requestId: string) => {
      await budgetPeriodMutations.approveCarryForward(programId, requestId);
      await refreshCF();
    },
    [budgetPeriodMutations, programId, refreshCF]
  );

  const handleRejectCarryForward = useCallback(
    async (requestId: string) => {
      await budgetPeriodMutations.rejectCarryForward(programId, requestId);
      await refreshCF();
    },
    [budgetPeriodMutations, programId, refreshCF]
  );

  const handleNewTransfer = useCallback(
    async (data: {
      fromLocationId: string;
      toLocationId: string;
      amount: number;
      exchangeRate?: number;
      reference: string;
      purpose: string;
      lineItems: TransferLineItem[];
    }) => {
      const fromLoc = budgetData.locations.find(l => l.id === data.fromLocationId);
      const toLoc = budgetData.locations.find(l => l.id === data.toLocationId);
      await fundLocationMutations.createTransfer(programId, {
        programId,
        fromLocationId: data.fromLocationId,
        fromLocationName: fromLoc?.name ?? '',
        toLocationId: data.toLocationId,
        toLocationName: toLoc?.name ?? '',
        amount: { amount: data.amount, currency: fromLoc?.currency ?? 'USD' },
        exchangeRate: data.exchangeRate
          ? {
              fromCurrency: fromLoc?.currency ?? 'USD',
              toCurrency: toLoc?.currency ?? 'UGX',
              rate: data.exchangeRate,
              inverseRate: data.exchangeRate > 0 ? 1 / data.exchangeRate : 0,
              rateDate: new Date(),
              source: 'manual' as const,
            }
          : undefined,
        convertedAmount: data.exchangeRate && toLoc
          ? { amount: data.amount * data.exchangeRate, currency: toLoc.currency }
          : undefined,
        reference: data.reference,
        purpose: data.purpose,
        status: 'pending',
        transferDate: new Date(),
        lineItems: data.lineItems,
      });
      setShowNewTransferDialog(false);
      await Promise.all([refreshTransfers(), budgetData.refresh()]);
    },
    [fundLocationMutations, programId, refreshTransfers, budgetData]
  );

  const handleAddLocation = useCallback(
    async (data: {
      name: string;
      type: 'international_hq' | 'regional_office' | 'field_office';
      currency: string;
      country: string;
      region?: string;
      isTreasury: boolean;
      contactPerson?: string;
      contactEmail?: string;
    }) => {
      const locationData: Record<string, any> = {
        programId,
        name: data.name,
        type: data.type,
        currency: data.currency,
        country: data.country,
        isTreasury: data.isTreasury,
        isActive: true,
      };
      if (data.region) locationData.region = data.region;
      if (data.contactPerson) locationData.contactPerson = data.contactPerson;
      if (data.contactEmail) locationData.contactEmail = data.contactEmail;

      await fundLocationMutations.createLocation(programId, locationData as any);
      await budgetData.refresh();
    },
    [fundLocationMutations, programId, budgetData]
  );

  const handleDeactivateLocation = useCallback(
    async (locationId: string) => {
      await fundLocationMutations.deactivateLocation(programId, locationId);
      await budgetData.refresh();
    },
    [fundLocationMutations, programId, budgetData]
  );

  const handleAddRate = useCallback(
    async (data: {
      fromCurrency: string;
      toCurrency: string;
      rate: number;
      effectiveDate: string;
      source: 'manual' | 'reference' | 'bank_rate';
      notes?: string;
    }) => {
      await exchangeRateMutations.addRate(programId, {
        ...data,
        effectiveDate: new Date(data.effectiveDate),
      });
      await budgetData.refresh();
    },
    [exchangeRateMutations, programId, budgetData]
  );

  const handleDeleteRate = useCallback(
    async (rateId: string) => {
      await exchangeRateMutations.deleteRate(programId, rateId);
      await budgetData.refresh();
    },
    [exchangeRateMutations, programId, budgetData]
  );

  // ── Treasury balance for rollup banner ─────────────────────
  const treasuryBalance = useMemo(() => {
    const treasuryLoc = budgetData.locations.find(l => l.isTreasury);
    if (!treasuryLoc) return null;

    const balance = budgetData.locationBalances.find(
      b => b.locationId === treasuryLoc.id
    );
    if (!balance) return null;

    return {
      locationName: balance.locationName,
      currency: balance.currency,
      totalReceived: balance.totalReceived,
      totalDisbursed: balance.totalDisbursed,
      totalPending: balance.totalPending,
      availableBalance: balance.availableBalance,
    };
  }, [budgetData.locations, budgetData.locationBalances]);

  // ── Derived project options for CoInvestmentTracker ─────────
  const projectOptions = useMemo(
    () => budgetData.projectRollup.map(p => ({
      id: p.projectId,
      name: p.projectName,
      projectCode: p.projectCode,
    })),
    [budgetData.projectRollup]
  );

  const handleAddCoInvestment = useCallback(
    async (data: {
      projectId: string;
      projectName: string;
      sourceType: 'donor' | 'client' | 'government' | 'other';
      sourceName: string;
      pledgedAmount: number;
      currency: string;
      conditions?: string;
      isConfirmed?: boolean;
      notes?: string;
    }) => {
      await coInvestmentMutations.addEntry(programId, data);
      await refreshCoInvestments();
    },
    [coInvestmentMutations, programId, refreshCoInvestments]
  );

  const handleUpdateCoInvestment = useCallback(
    async (entryId: string, updates: {
      disbursedAmount?: number;
      spentAmount?: number;
      pledgedAmount?: number;
      isConfirmed?: boolean;
      notes?: string;
      projectId?: string;
      projectName?: string;
    }) => {
      await coInvestmentMutations.updateAmounts(programId, entryId, updates);
      await refreshCoInvestments();
    },
    [coInvestmentMutations, programId, refreshCoInvestments]
  );

  const handleDeleteCoInvestment = useCallback(
    async (entryId: string) => {
      await coInvestmentMutations.deleteEntry(programId, entryId);
      await refreshCoInvestments();
    },
    [coInvestmentMutations, programId, refreshCoInvestments]
  );

  // ── Loading state ────────────────────────────────────────────
  if (budgetData.loading) {
    return (
      <div className="space-y-6 p-6">
        <Link
          to={`/advisory/delivery/programs/${programId}`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Program
        </Link>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
          <span className="ml-2 text-gray-600">Loading budget data...</span>
        </div>
      </div>
    );
  }

  // ── Error state ──────────────────────────────────────────────
  if (budgetData.error) {
    return (
      <div className="space-y-6 p-6">
        <Link
          to={`/advisory/delivery/programs/${programId}`}
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
        >
          <ChevronLeft className="w-4 h-4 mr-1" />
          Back to Program
        </Link>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{budgetData.error.message}</span>
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="space-y-6 p-6">
      {/* Back link */}
      <Link
        to={`/advisory/delivery/programs/${programId}`}
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900"
      >
        <ChevronLeft className="w-4 h-4 mr-1" />
        Back to Program
      </Link>

      {/* Page title + Refresh */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">
          {program.name} &mdash; Budget
        </h1>
        <button
          onClick={() => budgetData.refresh()}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {/* Summary (8 stat cards + co-investment row) */}
      <ProgramBudgetSummary
        consolidatedBudgetUSD={budgetData.consolidatedBudgetUSD}
        consolidatedSpentUSD={budgetData.consolidatedSpentUSD}
        consolidatedCommittedUSD={budgetData.consolidatedCommittedUSD}
        consolidatedAvailableUSD={budgetData.consolidatedAvailableUSD}
        utilizationPercent={budgetData.utilizationPercent}
        activeProjectCount={budgetData.activeProjectCount}
        activePeriod={budgetData.activePeriod}
        currencyExposure={budgetData.currencyExposure}
        coInvestmentSummary={coInvestmentSummary}
        latestRate={budgetData.latestRate?.rate ?? null}
        onEditBudget={async (data) => {
          await budgetManagement.updateAllocated(data);
          await budgetData.refresh();
        }}
        editingBudget={budgetManagement.loading}
      />

      {/* Budget Period Timeline */}
      <BudgetPeriodTimeline
        periods={budgetData.periods}
        activePeriod={budgetData.activePeriod}
        selectedPeriodId={budgetData.selectedPeriod?.id ?? null}
        onSelectPeriod={budgetData.setSelectedPeriodId}
      />

      {/* Budget Period Detail */}
      {budgetData.selectedPeriod && (
        <BudgetPeriodDetail
          period={budgetData.selectedPeriod}
        />
      )}

      {/* Fund Location Balances | Currency Conversion Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FundLocationBalances
          locations={budgetData.locations}
          balances={budgetData.locationBalances}
          onAddLocation={handleAddLocation}
          onDeactivateLocation={handleDeactivateLocation}
        />
        <CurrencyConversionSummary
          currencyExposure={budgetData.currencyExposure}
          latestRate={budgetData.latestRate}
        />
      </div>

      {/* Project Budget Rollup */}
      <ProjectBudgetRollup
        rollup={budgetData.projectRollup}
        latestRate={budgetData.latestRate}
        treasuryBalance={treasuryBalance}
      />

      {/* Co-Investment Tracker */}
      <CoInvestmentTracker
        summary={coInvestmentSummary}
        projects={projectOptions}
        loading={coInvestmentLoading}
        onAddEntry={handleAddCoInvestment}
        onUpdateEntry={handleUpdateCoInvestment}
        onDeleteEntry={handleDeleteCoInvestment}
        currency="USD"
      />

      {/* Fund Transfer Log | Exchange Rate Manager */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <FundTransferLog
          transfers={transfers}
          loading={transfersLoading}
          onNewTransfer={() => setShowNewTransferDialog(true)}
          programId={programId}
        />
        <ExchangeRateManager
          rates={budgetData.rates}
          onAddRate={handleAddRate}
          onDeleteRate={handleDeleteRate}
        />
      </div>

      {/* Carry-Forward Manager (only when active period is closing) */}
      {budgetData.activePeriod?.status === 'closing' && (
        <CarryForwardManager
          requests={carryForwardRequests}
          activePeriodYear={budgetData.activePeriod.year}
          loading={cfLoading}
          onApprove={handleApproveCarryForward}
          onReject={handleRejectCarryForward}
        />
      )}

      {/* New Transfer Dialog */}
      <NewTransferDialog
        open={showNewTransferDialog}
        locations={budgetData.locations}
        projects={budgetData.projectRollup}
        suggestedReference={nextTransferReference}
        onSubmit={handleNewTransfer}
        onClose={() => setShowNewTransferDialog(false)}
      />
    </div>
  );
}
