/**
 * useVariantResolver Hook
 * Wraps findOrCreateVariant for React components.
 * Provides variant resolution, price preview, and loading state.
 */

import { useState, useCallback } from 'react';
import type { VariantResolutionResult, VariantCreationSource } from '../types';
import { findOrCreateVariant } from '../services/productVariantService';
import { getFinish } from '../services/finishLibraryService';
import { getInventoryItem } from '../services/inventoryService';

interface UseVariantResolverResult {
  resolveVariant: (
    finishId: string,
    attributes: Record<string, string | number | boolean>,
    creationSource?: VariantCreationSource
  ) => Promise<VariantResolutionResult>;
  resolving: boolean;
  error: string | null;
  previewPrice: (
    finishId: string,
    attributes: Record<string, string | number | boolean>
  ) => Promise<ResolvedPricePreview | null>;
}

export interface ResolvedPricePreview {
  baseCost: number;
  finishModifier: number;
  modifierType: 'percentage' | 'absolute' | 'none';
  estimatedUnitCost: number;
  currency: string;
  finishName: string;
}

export function useVariantResolver(
  productId: string | null | undefined,
  organizationId: string,
  userId: string,
  subsidiaryId?: string
): UseVariantResolverResult {
  const [resolving, setResolving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolveVariant = useCallback(async (
    finishId: string,
    attributes: Record<string, string | number | boolean>,
    creationSource?: VariantCreationSource
  ): Promise<VariantResolutionResult> => {
    if (!productId) throw new Error('No product selected');

    setResolving(true);
    setError(null);

    try {
      const result = await findOrCreateVariant(
        { productId, finishId, attributes, creationSource },
        organizationId,
        userId,
        subsidiaryId
      );
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to resolve variant';
      setError(message);
      throw err;
    } finally {
      setResolving(false);
    }
  }, [productId, organizationId, userId, subsidiaryId]);

  const previewPrice = useCallback(async (
    finishId: string,
    _attributes: Record<string, string | number | boolean>
  ): Promise<ResolvedPricePreview | null> => {
    if (!productId) return null;

    try {
      const [product, finish] = await Promise.all([
        getInventoryItem(productId),
        getFinish(finishId),
      ]);

      if (!product || !finish) return null;

      const baseCost = product.pricing?.costPerUnit || 0;
      const currency = product.pricing?.currency || 'UGX';

      let finishModifier = 0;
      let modifierType: 'percentage' | 'absolute' | 'none' = 'none';
      let estimatedUnitCost = baseCost;

      // Check for product-level cost override first
      const linkedFinish = product.linkedFinishes?.find(lf => lf.finishId === finishId);
      if (linkedFinish?.costOverride !== undefined) {
        finishModifier = linkedFinish.costOverride;
        modifierType = 'absolute';
        estimatedUnitCost = baseCost + finishModifier;
      } else if (finish.costModifier && finish.costModifierType) {
        finishModifier = finish.costModifier;
        modifierType = finish.costModifierType;
        if (modifierType === 'percentage') {
          estimatedUnitCost = baseCost * (1 + finishModifier / 100);
        } else {
          estimatedUnitCost = baseCost + finishModifier;
        }
      }

      return {
        baseCost,
        finishModifier,
        modifierType,
        estimatedUnitCost,
        currency,
        finishName: finish.name,
      };
    } catch {
      return null;
    }
  }, [productId]);

  return { resolveVariant, resolving, error, previewPrice };
}
