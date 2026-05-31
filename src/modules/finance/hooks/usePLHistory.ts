/**
 * usePLHistory Hook
 * Reusable hook for loading P&L historical data from QBO.
 * Used by all analysis pages (KPIs, Growth, Trend, etc.)
 */

import { useState, useEffect, useMemo } from 'react';
import { getDetailedPLHistory } from '../services/forecastService';
import type { HistoricalPeriodData } from '../services/forecastService';
import type { PLAccountDetail } from '../types/forecast.types';

const COMPANY_ID = 'zeus-group';

export function usePLHistory(histMonths = 12) {
  const [accounts, setAccounts] = useState<PLAccountDetail[]>([]);
  const [periodData, setPeriodData] = useState<Record<string, HistoricalPeriodData>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        const now = new Date();
        const firstFP = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const result = await getDetailedPLHistory(COMPANY_ID, histMonths, firstFP);
        setAccounts(result.accounts);
        setPeriodData(result.periodData);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load P&L data');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [histMonths]);

  const periods = useMemo(() => Object.keys(periodData).sort(), [periodData]);

  return { accounts, periodData, periods, loading, error };
}
