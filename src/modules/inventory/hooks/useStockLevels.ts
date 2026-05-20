/**
 * Hook for subscribing to stock levels
 */

import { useState, useEffect } from 'react';
import type { StockLevel } from '../types/warehouse';
import {
  subscribeToStockLevels,
  subscribeToStockByWarehouse,
} from '../services/stockLevelService';
import { subscribeToOffcutCountForMaterial } from '@/shared/services/offcutLibraryService';

interface UseStockLevelsResult {
  stockLevels: StockLevel[];
  loading: boolean;
  error: string | null;
  aggregated: {
    totalOnHand: number;
    totalReserved: number;
    totalAvailable: number;
  };
  /** Available offcut pieces for this material (by name match) */
  offcutCount: number;
  /** Total cost value of available offcuts */
  offcutValue: number;
}

/**
 * Subscribe to stock levels for an inventory item across all locations.
 * Also subscribes to available offcuts for the same material name.
 */
export function useStockLevels(
  inventoryItemId: string | null,
  materialName?: string,
): UseStockLevelsResult {
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, _setError] = useState<string | null>(null);
  const [offcutCount, setOffcutCount] = useState(0);
  const [offcutValue, setOffcutValue] = useState(0);

  useEffect(() => {
    if (!inventoryItemId) {
      setStockLevels([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToStockLevels(inventoryItemId, (levels) => {
      setStockLevels(levels);
      setLoading(false);
    });

    return unsubscribe;
  }, [inventoryItemId]);

  // Subscribe to offcut count for this material
  useEffect(() => {
    if (!materialName) {
      setOffcutCount(0);
      setOffcutValue(0);
      return;
    }

    const unsubscribe = subscribeToOffcutCountForMaterial(materialName, (data) => {
      setOffcutCount(data.count);
      setOffcutValue(data.totalValue);
    });

    return unsubscribe;
  }, [materialName]);

  const aggregated = stockLevels.reduce(
    (acc, sl) => ({
      totalOnHand: acc.totalOnHand + sl.quantityOnHand,
      totalReserved: acc.totalReserved + sl.quantityReserved,
      totalAvailable: acc.totalAvailable + sl.quantityAvailable,
    }),
    { totalOnHand: 0, totalReserved: 0, totalAvailable: 0 },
  );

  return { stockLevels, loading, error, aggregated, offcutCount, offcutValue };
}

/**
 * Subscribe to stock levels at a specific warehouse
 */
export function useWarehouseStock(warehouseId: string | null) {
  const [stockLevels, setStockLevels] = useState<StockLevel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!warehouseId) {
      setStockLevels([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const unsubscribe = subscribeToStockByWarehouse(warehouseId, (levels) => {
      setStockLevels(levels);
      setLoading(false);
    });

    return unsubscribe;
  }, [warehouseId]);

  return { stockLevels, loading };
}
