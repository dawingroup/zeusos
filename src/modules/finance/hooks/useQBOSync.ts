// ============================================================================
// USE QBO SYNC HOOK
// DawinOS v2.0 - Financial Management Module
// React hook for QuickBooks Online sync operations and data
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import type {
  QBOConnectionStatus,
  QBOSyncJob,
  QBODataCategory,
  QBOProfitAndLoss,
  QBOBalanceSheet,
  QBOAccount,
  QBOInvoice,
  QBOBill,
  QBOBankTransaction,
} from '../types/integrations.types';
import {
  getQBOConnectionStatus,
  getQBOAuthUrl,
  syncAllQBOData,
  syncQBOCategory,
  getQBOSyncHistory,
  subscribeToSyncJobs,
  getQBOProfitAndLoss,
  getQBOBalanceSheet,
  getQBOAccounts,
  getQBOInvoices,
  getQBOBills,
  getQBOBankTransactions,
} from '../services/qboSyncService';

export interface UseQBOSyncOptions {
  companyId: string;
  autoCheckConnection?: boolean;
  subscribeToJobs?: boolean;
}

export interface UseQBOSyncReturn {
  // Connection
  connection: QBOConnectionStatus | null;
  connectionLoading: boolean;
  checkConnection: () => Promise<void>;
  getAuthUrl: () => Promise<string>;

  // Sync
  syncing: boolean;
  syncAll: (categories?: QBODataCategory[]) => Promise<void>;
  syncCategory: (category: QBODataCategory, startDate?: string, endDate?: string) => Promise<void>;

  // Sync history
  syncJobs: QBOSyncJob[];
  loadSyncHistory: () => Promise<void>;

  // Synced data
  profitAndLoss: QBOProfitAndLoss | null;
  balanceSheet: QBOBalanceSheet | null;
  accounts: QBOAccount[];
  invoices: QBOInvoice[];
  bills: QBOBill[];
  bankTransactions: QBOBankTransaction[];
  dataLoading: boolean;
  loadSyncedData: () => Promise<void>;

  // Error
  error: string | null;
}

export function useQBOSync({
  companyId,
  autoCheckConnection = true,
  subscribeToJobs = true,
}: UseQBOSyncOptions): UseQBOSyncReturn {
  const [connection, setConnection] = useState<QBOConnectionStatus | null>(null);
  const [connectionLoading, setConnectionLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncJobs, setSyncJobs] = useState<QBOSyncJob[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Synced data state
  const [profitAndLoss, setProfitAndLoss] = useState<QBOProfitAndLoss | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<QBOBalanceSheet | null>(null);
  const [accounts, setAccounts] = useState<QBOAccount[]>([]);
  const [invoices, setInvoices] = useState<QBOInvoice[]>([]);
  const [bills, setBills] = useState<QBOBill[]>([]);
  const [bankTransactions, setBankTransactions] = useState<QBOBankTransaction[]>([]);
  const [dataLoading, setDataLoading] = useState(false);

  // Check connection status
  const checkConnection = useCallback(async () => {
    setConnectionLoading(true);
    setError(null);
    try {
      const status = await getQBOConnectionStatus();
      setConnection(status);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to check connection');
    } finally {
      setConnectionLoading(false);
    }
  }, []);

  // Get OAuth URL
  const getAuthUrlFn = useCallback(async (): Promise<string> => {
    try {
      return await getQBOAuthUrl();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to get auth URL');
      throw err;
    }
  }, []);

  // Sync all data
  const syncAll = useCallback(
    async (categories?: QBODataCategory[]) => {
      setSyncing(true);
      setError(null);
      try {
        const result = await syncAllQBOData(companyId, categories);
        if (!result.success && result.errors) {
          setError(`Some syncs failed: ${Object.keys(result.errors).join(', ')}`);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Sync failed');
      } finally {
        setSyncing(false);
      }
    },
    [companyId]
  );

  // Sync single category
  const syncCategoryFn = useCallback(
    async (category: QBODataCategory, startDate?: string, endDate?: string) => {
      setSyncing(true);
      setError(null);
      try {
        await syncQBOCategory(companyId, category, startDate, endDate);
      } catch (err) {
        setError(err instanceof Error ? err.message : `Failed to sync ${category}`);
      } finally {
        setSyncing(false);
      }
    },
    [companyId]
  );

  // Load sync history
  const loadSyncHistory = useCallback(async () => {
    try {
      const jobs = await getQBOSyncHistory(companyId);
      setSyncJobs(jobs);
    } catch (err) {
      console.error('Failed to load sync history:', err);
    }
  }, [companyId]);

  // Load synced data
  const loadSyncedData = useCallback(async () => {
    setDataLoading(true);
    try {
      const now = new Date();
      const fyStart = now.getMonth() >= 6
        ? `${now.getFullYear()}-07-01`
        : `${now.getFullYear() - 1}-07-01`;
      const today = now.toISOString().split('T')[0];

      const [pl, bs, accts, invs, bls, txns] = await Promise.all([
        getQBOProfitAndLoss(companyId, fyStart, today).catch(() => null),
        getQBOBalanceSheet(companyId, today).catch(() => null),
        getQBOAccounts(companyId).catch(() => []),
        getQBOInvoices(companyId).catch(() => []),
        getQBOBills(companyId).catch(() => []),
        getQBOBankTransactions(companyId).catch(() => []),
      ]);

      setProfitAndLoss(pl);
      setBalanceSheet(bs);
      setAccounts(accts);
      setInvoices(invs);
      setBills(bls);
      setBankTransactions(txns);
    } catch (err) {
      console.error('Failed to load synced data:', err);
    } finally {
      setDataLoading(false);
    }
  }, [companyId]);

  // Auto check connection
  useEffect(() => {
    if (autoCheckConnection && companyId) {
      checkConnection();
    }
  }, [autoCheckConnection, companyId, checkConnection]);

  // Subscribe to sync jobs
  useEffect(() => {
    if (!subscribeToJobs || !companyId) return;

    const unsub = subscribeToSyncJobs(companyId, setSyncJobs);
    return () => unsub();
  }, [subscribeToJobs, companyId]);

  return {
    connection,
    connectionLoading,
    checkConnection,
    getAuthUrl: getAuthUrlFn,
    syncing,
    syncAll,
    syncCategory: syncCategoryFn,
    syncJobs,
    loadSyncHistory,
    profitAndLoss,
    balanceSheet,
    accounts,
    invoices,
    bills,
    bankTransactions,
    dataLoading,
    loadSyncedData,
    error,
  };
}
