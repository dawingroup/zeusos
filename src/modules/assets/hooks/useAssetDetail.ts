/**
 * useAssetDetail Hook
 * Fetches all data for an asset detail page:
 * asset, maintenance logs, status changes, checkouts, linked features.
 */

import { useState, useEffect, useCallback } from 'react';
import {
  collection,
  query,
  where,
  orderBy,
  getDocs,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { AssetService } from '../services/AssetService';
import type { Asset, AssetStatusChange, Feature } from '@/shared/types';
import type { MaintenanceLog, AssetCheckout } from '../types';

const assetService = new AssetService();

interface UseAssetDetailReturn {
  asset: Asset | null;
  maintenanceLogs: MaintenanceLog[];
  statusChanges: AssetStatusChange[];
  checkouts: AssetCheckout[];
  features: Feature[];
  isLoading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useAssetDetail(assetId: string | undefined): UseAssetDetailReturn {
  const [asset, setAsset] = useState<Asset | null>(null);
  const [maintenanceLogs, setMaintenanceLogs] = useState<MaintenanceLog[]>([]);
  const [statusChanges, setStatusChanges] = useState<AssetStatusChange[]>([]);
  const [checkouts, setCheckouts] = useState<AssetCheckout[]>([]);
  const [features, setFeatures] = useState<Feature[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    if (!assetId) {
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      // Fetch all data in parallel
      const [assetData, logs, changes, checkoutRecords, linkedFeatures] =
        await Promise.all([
          assetService.getAsset(assetId),
          fetchMaintenanceLogs(assetId),
          fetchStatusChanges(assetId),
          fetchCheckouts(assetId),
          fetchLinkedFeatures(assetId),
        ]);

      if (!assetData) {
        setError('Asset not found');
        setIsLoading(false);
        return;
      }

      setAsset(assetData);
      setMaintenanceLogs(logs);
      setStatusChanges(changes);
      setCheckouts(checkoutRecords);
      setFeatures(linkedFeatures);
    } catch (err) {
      console.error('Failed to fetch asset detail:', err);
      setError(err instanceof Error ? err.message : 'Failed to load asset');
    } finally {
      setIsLoading(false);
    }
  }, [assetId]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  return {
    asset,
    maintenanceLogs,
    statusChanges,
    checkouts,
    features,
    isLoading,
    error,
    refresh: fetchAll,
  };
}

// ============================================================================
// DATA FETCHERS
// ============================================================================

async function fetchMaintenanceLogs(assetId: string): Promise<MaintenanceLog[]> {
  const q = query(
    collection(db, 'maintenanceLogs'),
    where('assetId', '==', assetId),
    orderBy('performedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as MaintenanceLog);
}

async function fetchStatusChanges(assetId: string): Promise<AssetStatusChange[]> {
  const q = query(
    collection(db, 'assetStatusChanges'),
    where('assetId', '==', assetId),
    orderBy('changedAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as AssetStatusChange);
}

async function fetchCheckouts(assetId: string): Promise<AssetCheckout[]> {
  const q = query(
    collection(db, 'assetCheckouts'),
    where('assetId', '==', assetId),
    orderBy('checkedOutAt', 'desc')
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as AssetCheckout);
}

async function fetchLinkedFeatures(assetId: string): Promise<Feature[]> {
  const q = query(
    collection(db, 'features'),
    where('requiredAssetIds', 'array-contains', assetId)
  );
  const snap = await getDocs(q);
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() }) as Feature);
}
