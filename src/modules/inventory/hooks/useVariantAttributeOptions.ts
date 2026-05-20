/**
 * useVariantAttributeOptions Hook
 * Provides category-aware variant attribute options for the VariantManager.
 * Loads attribute definitions from Firestore when available, falls back to local seeds.
 */

import { useState, useEffect, useMemo } from 'react';
import type { InventoryItem } from '../types';
import type { AttributeDefinition } from '../types/finishAttributes';
import type { FinishCategory } from '../types/finishLibrary';
import { getAttributeDefinitions } from '../services/finishAttributeService';
import {
  getVariantAttributeOptions,
  INVENTORY_TO_FINISH_CATEGORY,
  type VariantAttributeOption,
} from '../utils/variantAttributeUtils';
interface UseVariantAttributeOptionsResult {
  attributeOptions: VariantAttributeOption[];
  loading: boolean;
}

/**
 * Hook that returns a merged list of variant attribute options
 * based on the parent item's category and finish category.
 *
 * @param parentItem - The parent inventory item (to derive category context)
 */
export function useVariantAttributeOptions(
  parentItem: InventoryItem | null,
): UseVariantAttributeOptionsResult {
  const organizationId = 'default'; // TODO: Get from org context when available
  const [categoryDefs, setCategoryDefs] = useState<AttributeDefinition[] | null>(null);
  const [loading, setLoading] = useState(false);

  // Derive the finish category for attribute lookup
  const finishCategory: FinishCategory | undefined = parentItem?.finishCategory
    || (parentItem?.category ? INVENTORY_TO_FINISH_CATEGORY[parentItem.category] : undefined);

  // Load attribute definitions from Firestore
  useEffect(() => {
    if (!organizationId || !finishCategory) {
      setCategoryDefs(null);
      return;
    }

    let cancelled = false;
    setLoading(true);

    getAttributeDefinitions(organizationId, finishCategory)
      .then((defs) => {
        if (!cancelled) setCategoryDefs(defs);
      })
      .catch((err) => {
        console.warn('Failed to load attribute definitions:', err);
        if (!cancelled) setCategoryDefs(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [organizationId, finishCategory]);

  // Build merged options
  const attributeOptions = useMemo(
    () => getVariantAttributeOptions(categoryDefs, finishCategory, parentItem?.category),
    [categoryDefs, finishCategory, parentItem?.category],
  );

  return { attributeOptions, loading };
}
