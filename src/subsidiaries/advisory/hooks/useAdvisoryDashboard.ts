/**
 * useAdvisoryDashboard - Composite Hook
 * ZeusOS v2.0 - Zeus Group
 * Aggregates data from investment deals, clients, and portfolios
 * for the Advisory Dashboard page
 */

import { useMemo } from 'react';
import { usePipelineSummary } from '../investment/hooks/deal-hooks';
import { useClients } from '../advisory/hooks/client-hooks';
import { useActivePortfolios } from '../advisory/hooks/portfolio-hooks';

interface AdvisoryDashboardData {
  activeDeals: number;
  totalPipelineValue: number;
  pipelineCurrency: string;
  activeClients: number;
  activePortfolios: number;
  loading: boolean;
  error: string | null;
}

interface AdvisoryModuleStats {
  investment: {
    deals: number;
    pipelineValue: string;
  };
  portfolio: {
    active: number;
    clients: number;
  };
}

export interface UseAdvisoryDashboardReturn {
  data: AdvisoryDashboardData;
  moduleStats: AdvisoryModuleStats;
}

export function useAdvisoryDashboard(): UseAdvisoryDashboardReturn {
  const {
    summary: pipelineSummary,
    loading: pipelineLoading,
    error: pipelineError,
  } = usePipelineSummary();

  const {
    data: clients,
    isLoading: clientsLoading,
    error: clientsError,
  } = useClients({ status: ['active'] });

  const {
    data: portfolios,
    isLoading: portfoliosLoading,
    error: portfoliosError,
  } = useActivePortfolios();

  const formatValue = (amount: number, currency: string): string => {
    if (amount >= 1_000_000) return `${currency === 'USD' ? '$' : ''}${(amount / 1_000_000).toFixed(1)}M`;
    if (amount >= 1_000) return `${currency === 'USD' ? '$' : ''}${(amount / 1_000).toFixed(0)}K`;
    return `${currency === 'USD' ? '$' : ''}${amount}`;
  };

  const data: AdvisoryDashboardData = useMemo(() => {
    const totalDeals = pipelineSummary?.totalDeals ?? 0;
    const totalValue = pipelineSummary?.totalValue?.amount ?? 0;
    const currency = pipelineSummary?.totalValue?.currency ?? 'USD';
    const clientCount = clients?.length ?? 0;
    const portfolioCount = portfolios?.length ?? 0;

    const loading = pipelineLoading || clientsLoading || portfoliosLoading;
    const error = pipelineError?.message || (clientsError as Error)?.message || (portfoliosError as Error)?.message || null;

    return {
      activeDeals: totalDeals,
      totalPipelineValue: totalValue,
      pipelineCurrency: currency,
      activeClients: clientCount,
      activePortfolios: portfolioCount,
      loading,
      error,
    };
  }, [pipelineSummary, clients, portfolios, pipelineLoading, clientsLoading, portfoliosLoading, pipelineError, clientsError, portfoliosError]);

  const moduleStats: AdvisoryModuleStats = useMemo(() => ({
    investment: {
      deals: pipelineSummary?.totalDeals ?? 0,
      pipelineValue: formatValue(
        pipelineSummary?.totalValue?.amount ?? 0,
        pipelineSummary?.totalValue?.currency ?? 'USD'
      ),
    },
    portfolio: {
      active: portfolios?.length ?? 0,
      clients: clients?.length ?? 0,
    },
  }), [pipelineSummary, portfolios, clients]);

  return { data, moduleStats };
}
