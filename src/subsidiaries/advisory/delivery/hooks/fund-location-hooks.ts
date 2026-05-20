/**
 * FUND LOCATION HOOKS
 *
 * React hooks for fund location management: locations, balances,
 * transfers, and CRUD mutations.
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Firestore } from 'firebase/firestore';
import { FundLocationService } from '../services/fund-location-service';
import type {
  FundLocation,
  FundLocationBalance,
  FundTransfer,
  FundTransferStatus,
  TransferLineItem,
} from '../types/fund-location';
import type { Money } from '../../core/types/money';
import type { TransactionExchangeRate } from '../types/exchange-rate';

// ─────────────────────────────────────────────────────────────────
// HOOK: useProgramFundLocations
// ─────────────────────────────────────────────────────────────────

interface UseProgramFundLocationsResult {
  locations: FundLocation[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Fetch all fund locations for a program.
 */
export function useProgramFundLocations(
  db: Firestore,
  programId: string | null
): UseProgramFundLocationsResult {
  const [locations, setLocations] = useState<FundLocation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => FundLocationService.getInstance(db), [db]);

  const fetchLocations = useCallback(async () => {
    if (!programId) {
      setLocations([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await service.getLocations(programId);
      setLocations(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch fund locations'));
    } finally {
      setLoading(false);
    }
  }, [service, programId]);

  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  return { locations, loading, error, refresh: fetchLocations };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useFundLocationBalances
// ─────────────────────────────────────────────────────────────────

interface UseFundLocationBalancesResult {
  balances: FundLocationBalance[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Calculate balances for a set of fund locations in parallel.
 * Re-fetches when locationIds change.
 */
export function useFundLocationBalances(
  db: Firestore,
  programId: string | null,
  locationIds: string[]
): UseFundLocationBalancesResult {
  const [balances, setBalances] = useState<FundLocationBalance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => FundLocationService.getInstance(db), [db]);
  const locationIdsKey = JSON.stringify(locationIds);

  const fetchBalances = useCallback(async () => {
    if (!programId || locationIds.length === 0) {
      setBalances([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const results = await Promise.all(
        locationIds.map(locationId =>
          service.calculateBalance(programId, locationId)
        )
      );
      setBalances(results);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to calculate fund location balances'));
    } finally {
      setLoading(false);
    }
  }, [service, programId, locationIdsKey]);

  useEffect(() => {
    fetchBalances();
  }, [fetchBalances]);

  return { balances, loading, error, refresh: fetchBalances };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useFundTransfers
// ─────────────────────────────────────────────────────────────────

interface UseFundTransfersResult {
  transfers: FundTransfer[];
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Fetch fund transfers for a program with optional filters.
 */
export function useFundTransfers(
  db: Firestore,
  programId: string | null,
  options?: { locationId?: string; status?: FundTransferStatus }
): UseFundTransfersResult {
  const [transfers, setTransfers] = useState<FundTransfer[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => FundLocationService.getInstance(db), [db]);
  const optionsKey = JSON.stringify(options);

  const fetchTransfers = useCallback(async () => {
    if (!programId) {
      setTransfers([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await service.getTransfers(programId, options);
      setTransfers(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch fund transfers'));
    } finally {
      setLoading(false);
    }
  }, [service, programId, optionsKey]);

  useEffect(() => {
    fetchTransfers();
  }, [fetchTransfers]);

  return { transfers, loading, error, refresh: fetchTransfers };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useFundTransfer (single transfer)
// ─────────────────────────────────────────────────────────────────

interface UseFundTransferResult {
  transfer: FundTransfer | null;
  loading: boolean;
  error: Error | null;
  refresh: () => Promise<void>;
}

/**
 * Fetch a single fund transfer by ID.
 */
export function useFundTransfer(
  db: Firestore,
  programId: string | null,
  transferId: string | null
): UseFundTransferResult {
  const [transfer, setTransfer] = useState<FundTransfer | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => FundLocationService.getInstance(db), [db]);

  const fetchTransfer = useCallback(async () => {
    if (!programId || !transferId) {
      setTransfer(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const result = await service.getTransfer(programId, transferId);
      setTransfer(result);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to fetch fund transfer'));
    } finally {
      setLoading(false);
    }
  }, [service, programId, transferId]);

  useEffect(() => {
    fetchTransfer();
  }, [fetchTransfer]);

  return { transfer, loading, error, refresh: fetchTransfer };
}

// ─────────────────────────────────────────────────────────────────
// HOOK: useFundLocationMutations
// ─────────────────────────────────────────────────────────────────

interface UseFundLocationMutationsResult {
  createLocation: (programId: string, data: Omit<FundLocation, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>) => Promise<string>;
  updateLocation: (programId: string, locationId: string, updates: Partial<FundLocation>) => Promise<void>;
  deactivateLocation: (programId: string, locationId: string) => Promise<void>;
  createTransfer: (programId: string, data: Omit<FundTransfer, 'id' | 'createdBy' | 'createdAt'>) => Promise<string>;
  updateTransfer: (programId: string, transferId: string, updates: {
    amount?: Money;
    exchangeRate?: TransactionExchangeRate;
    convertedAmount?: Money;
    reference?: string;
    purpose?: string;
    lineItems?: TransferLineItem[];
    transferDate?: Date;
  }) => Promise<void>;
  confirmTransfer: (programId: string, transferId: string) => Promise<void>;
  cancelTransfer: (programId: string, transferId: string) => Promise<void>;
  deleteTransfer: (programId: string, transferId: string) => Promise<void>;
  loading: boolean;
  error: Error | null;
}

/**
 * Mutation hooks for fund locations and transfers.
 */
export function useFundLocationMutations(
  db: Firestore,
  userId: string
): UseFundLocationMutationsResult {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const service = useMemo(() => FundLocationService.getInstance(db), [db]);

  const createLocation = useCallback(
    async (
      programId: string,
      data: Omit<FundLocation, 'id' | 'createdBy' | 'createdAt' | 'updatedAt'>
    ): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const id = await service.createLocation(programId, data, userId);
        return id;
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to create fund location');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  const updateLocation = useCallback(
    async (programId: string, locationId: string, updates: Partial<FundLocation>): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.updateLocation(programId, locationId, updates, userId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to update fund location');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  const deactivateLocation = useCallback(
    async (programId: string, locationId: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.deactivateLocation(programId, locationId, userId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to deactivate fund location');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  const createTransfer = useCallback(
    async (
      programId: string,
      data: Omit<FundTransfer, 'id' | 'createdBy' | 'createdAt'>
    ): Promise<string> => {
      setLoading(true);
      setError(null);

      try {
        const id = await service.createTransfer(programId, data, userId);
        return id;
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to create fund transfer');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  const updateTransfer = useCallback(
    async (
      programId: string,
      transferId: string,
      updates: {
        amount?: Money;
        exchangeRate?: TransactionExchangeRate;
        convertedAmount?: Money;
        reference?: string;
        purpose?: string;
        lineItems?: TransferLineItem[];
        transferDate?: Date;
      }
    ): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.updateTransfer(programId, transferId, updates, userId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to update fund transfer');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  const confirmTransfer = useCallback(
    async (programId: string, transferId: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.confirmTransfer(programId, transferId, userId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to confirm fund transfer');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  const cancelTransfer = useCallback(
    async (programId: string, transferId: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.cancelTransfer(programId, transferId, userId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to cancel fund transfer');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service, userId]
  );

  const deleteTransfer = useCallback(
    async (programId: string, transferId: string): Promise<void> => {
      setLoading(true);
      setError(null);

      try {
        await service.deleteTransfer(programId, transferId);
      } catch (err) {
        const e = err instanceof Error ? err : new Error('Failed to delete fund transfer');
        setError(e);
        throw e;
      } finally {
        setLoading(false);
      }
    },
    [service]
  );

  return {
    createLocation,
    updateLocation,
    deactivateLocation,
    createTransfer,
    updateTransfer,
    confirmTransfer,
    cancelTransfer,
    deleteTransfer,
    loading,
    error,
  };
}
