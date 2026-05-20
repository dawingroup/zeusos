/**
 * EXCHANGE RATE HOOKS
 *
 * React hooks for program-level exchange rate management.
 * Wraps ExchangeRateService for fetching, creating, and deleting rates.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Firestore } from 'firebase/firestore';
import { ExchangeRateService } from '../services/exchange-rate-service';
import type {
  ExchangeRateEntry,
  ExchangeRateSource,
} from '../types/exchange-rate';

// ─────────────────────────────────────────────────────────────────
// HOOK: useProgramExchangeRates
// ─────────────────────────────────────────────────────────────────

interface UseProgramExchangeRatesResult {
  rates: ExchangeRateEntry[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Fetch all exchange rates for a program, ordered by date desc.
 */
export function useProgramExchangeRates(
  db: Firestore,
  programId: string | null
): UseProgramExchangeRatesResult {
  const [rates, setRates] = useState<ExchangeRateEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ExchangeRateService.getInstance(db), [db]);

  const fetchRates = useCallback(async () => {
    if (!programId) {
      setRates([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await service.getRates(programId);
      setRates(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch exchange rates'));
    } finally {
      setLoading(false);
    }
  }, [service, programId]);

  useEffect(() => {
    fetchRates();
  }, [fetchRates]);

  return { rates, loading, error, refresh: fetchRates };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useLatestRate
// ─────────────────────────────────────────────────────────────────

interface UseLatestRateResult {
  rate: ExchangeRateEntry | null;
  loading: boolean;
  error: Error | null;
}

/**
 * Fetch the most recent exchange rate for a specific currency pair.
 * Re-fetches when fromCurrency or toCurrency change.
 */
export function useLatestRate(
  db: Firestore,
  programId: string | null,
  fromCurrency: string | null,
  toCurrency: string | null
): UseLatestRateResult {
  const [rate, setRate] = useState<ExchangeRateEntry | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ExchangeRateService.getInstance(db), [db]);

  const fetchLatestRate = useCallback(async () => {
    if (!programId || !fromCurrency || !toCurrency) {
      setRate(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await service.getLatestRate(programId, fromCurrency, toCurrency);
      setRate(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch latest rate'));
    } finally {
      setLoading(false);
    }
  }, [service, programId, fromCurrency, toCurrency]);

  useEffect(() => {
    fetchLatestRate();
  }, [fetchLatestRate]);

  return { rate, loading, error };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useExchangeRateMutations
// ─────────────────────────────────────────────────────────────────

interface UseExchangeRateMutationsResult {
  addRate: (
    programId: string,
    data: {
      fromCurrency: string;
      toCurrency: string;
      rate: number;
      effectiveDate: Date;
      expiresDate?: Date;
      source: ExchangeRateSource;
      notes?: string;
    }
  ) => Promise<string>;
  deleteRate: (programId: string, rateId: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

/**
 * Mutation hooks for adding and deleting exchange rates.
 */
export function useExchangeRateMutations(
  db: Firestore,
  userId: string
): UseExchangeRateMutationsResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => ExchangeRateService.getInstance(db), [db]);

  const addRate = useCallback(
    async (
      programId: string,
      data: {
        fromCurrency: string;
        toCurrency: string;
        rate: number;
        effectiveDate: Date;
        expiresDate?: Date;
        source: ExchangeRateSource;
        notes?: string;
      }
    ): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const id = await service.addRate(programId, data, userId);
        return id;
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to add exchange rate');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  const deleteRate = useCallback(
    async (programId: string, rateId: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.deleteRate(programId, rateId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to delete exchange rate');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service]
  );

  return { addRate, deleteRate, loading, error };
}
