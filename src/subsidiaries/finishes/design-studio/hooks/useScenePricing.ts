/**
 * useScenePricing — Project-level pricing breakdown
 *
 * Aggregates pricing from all cabinets. Updates on cabinet config changes.
 */
import { useMemo } from 'react';
import type { SceneCabinet } from '../types/scene.types';
import type { PricingBreakdown } from '../types/constraintEngine.types';

interface UseScenePricingResult {
  totalPricing: PricingBreakdown | null;
  byCabinet: { cabinetId: string; cabinetCode: string; pricing: PricingBreakdown }[];
}

export function useScenePricing(cabinets: SceneCabinet[]): UseScenePricingResult {
  return useMemo(() => {
    if (cabinets.length === 0) return { totalPricing: null, byCabinet: [] };

    const byCabinet: { cabinetId: string; cabinetCode: string; pricing: PricingBreakdown }[] = [];

    let materialsCost = 0;
    let edgeBandingCost = 0;
    let hardwareCost = 0;
    let laborCost = 0;
    let overheadCost = 0;
    let marginAmount = 0;
    let subtotal = 0;
    let vatAmount = 0;
    let total = 0;

    for (const cab of cabinets) {
      const p = cab.estimatedPrice;
      if (!p) continue;

      materialsCost += p.materialsCost ?? 0;
      edgeBandingCost += p.edgeBandingCost ?? 0;
      hardwareCost += p.hardwareCost ?? 0;
      laborCost += p.laborCost ?? 0;
      overheadCost += p.overheadCost ?? 0;
      marginAmount += p.marginAmount ?? 0;
      subtotal += p.subtotal ?? 0;
      vatAmount += p.vatAmount ?? 0;
      total += p.total ?? 0;

      byCabinet.push({
        cabinetId: cab.id,
        cabinetCode: cab.cabinetCode,
        pricing: p,
      });
    }

    const totalPricing: PricingBreakdown = {
      materialsCost,
      edgeBandingCost,
      hardwareCost,
      laborCost,
      overheadCost,
      marginAmount,
      subtotal,
      vatAmount,
      total,
      currency: cabinets[0]?.estimatedPrice?.currency ?? 'UGX',
      lineItems: [],
    };

    return { totalPricing, byCabinet };
  }, [cabinets]);
}
