/**
 * useStockIndicators — Map stock levels to UI availability badges
 *
 * For each BOM line, checks the Firestore stockLevels collection
 * and returns availability status for display in StockBadge components.
 */
import { useQuery } from '@tanstack/react-query';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { ComputedBOMLine } from '../types/constraintEngine.types';

export type StockBadgeStatus = 'in-stock' | 'low-stock' | 'out-of-stock' | 'unknown';

export interface StockIndicator {
  bomLineKey: string;
  itemName: string;
  status: StockBadgeStatus;
  availableQuantity: number;
  requiredQuantity: number;
  shortfall: number;
}

const STOCK_KEYS = {
  indicators: (itemIds: string) => ['stockIndicators', itemIds] as const,
};

/**
 * Fetch stock levels for all BOM lines and return UI-ready indicators.
 */
export function useStockIndicators(bomLines: ComputedBOMLine[]) {
  const itemIds = bomLines
    .filter(l => l.inventoryItemId)
    .map(l => l.inventoryItemId)
    .join(',');

  return useQuery<StockIndicator[]>({
    queryKey: STOCK_KEYS.indicators(itemIds),
    queryFn: async (): Promise<StockIndicator[]> => {
      const indicators: StockIndicator[] = [];

      for (const line of bomLines) {
        if (!line.inventoryItemId) {
          indicators.push({
            bomLineKey: line.bomTemplateLineKey,
            itemName: line.inventoryItemName,
            status: 'unknown',
            availableQuantity: 0,
            requiredQuantity: line.quantity,
            shortfall: line.quantity,
          });
          continue;
        }

        // Query stockLevels collection
        let available = 0;
        try {
          const q = query(
            collection(db, 'stockLevels'),
            where('inventoryItemId', '==', line.inventoryItemId),
          );
          const snap = await getDocs(q);
          if (!snap.empty) {
            const stockDoc = snap.docs[0].data();
            available = stockDoc.currentQuantity ?? stockDoc.quantity ?? 0;
          }
        } catch {
          // Firestore query failed — treat as unknown
        }

        let status: StockBadgeStatus;
        if (available >= line.quantity) {
          status = 'in-stock';
        } else if (available > 0) {
          status = 'low-stock';
        } else {
          status = 'out-of-stock';
        }

        indicators.push({
          bomLineKey: line.bomTemplateLineKey,
          itemName: line.inventoryItemName,
          status,
          availableQuantity: available,
          requiredQuantity: line.quantity,
          shortfall: Math.max(0, line.quantity - available),
        });
      }

      return indicators;
    },
    enabled: bomLines.length > 0,
    staleTime: 60_000, // Cache for 1 minute
  });
}
