/**
 * Supplier Analysis Service
 * Ranks and analyzes suppliers for inventory items by combining
 * pricing data (from SupplierInventoryPricing) with performance
 * metrics (from Supplier entity).
 */

import { getSupplier } from '@/modules/suppliers';
import type {
  SupplierInventoryPricing,
  SupplierRankingResult,
  SupplierRankingWeights,
} from '../types';
import { DEFAULT_RANKING_WEIGHTS } from '../types';

/**
 * Calculate supplier rankings for an item's supplier pricing list.
 * Fetches supplier performance data and computes weighted scores.
 */
export async function calculateSupplierRankings(
  supplierPricing: SupplierInventoryPricing[],
  weights: SupplierRankingWeights = DEFAULT_RANKING_WEIGHTS
): Promise<SupplierRankingResult[]> {
  if (supplierPricing.length === 0) return [];

  // 1. Fetch supplier performance data in parallel
  const supplierDetails = await Promise.all(
    supplierPricing.map(async (sp) => {
      try {
        const supplier = await getSupplier(sp.supplierId);
        return { pricing: sp, supplier };
      } catch {
        return { pricing: sp, supplier: null };
      }
    })
  );

  // 2. Compute min/max for normalization
  const prices = supplierPricing.map(sp => sp.unitPrice);
  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const priceRange = maxPrice - minPrice || 1;

  const leadTimes = supplierPricing
    .map(sp => sp.leadTimeDays)
    .filter((lt): lt is number => lt != null);
  const minLead = leadTimes.length > 0 ? Math.min(...leadTimes) : 0;
  const maxLead = leadTimes.length > 0 ? Math.max(...leadTimes) : 30;
  const leadRange = maxLead - minLead || 1;

  // 3. Score each supplier
  const results: SupplierRankingResult[] = supplierDetails.map(({ pricing, supplier }) => {
    // Price score: 100 = cheapest, 0 = most expensive
    const priceScore = 100 - ((pricing.unitPrice - minPrice) / priceRange) * 100;

    // Delivery score: combines lead time and on-time delivery rate
    const leadTimeScore = pricing.leadTimeDays != null
      ? 100 - ((pricing.leadTimeDays - minLead) / leadRange) * 100
      : 50;
    const onTimeRate = supplier?.onTimeDeliveryRate ?? 50;
    const deliveryScore = (leadTimeScore * 0.5) + (onTimeRate * 0.5);

    // Quality score
    const qualityScoreComputed = supplier?.qualityScore ?? 50;

    // Reliability: based on total orders and rating
    const ratingScore = supplier?.rating ? (supplier.rating / 5) * 100 : 50;
    const orderVolume = supplier?.totalOrders ?? 0;
    const volumeScore = Math.min(orderVolume / 10, 1) * 100;
    const reliabilityScore = (ratingScore * 0.6) + (volumeScore * 0.4);

    // Overall weighted score
    const overallScore =
      priceScore * weights.price +
      deliveryScore * weights.delivery +
      qualityScoreComputed * weights.quality +
      reliabilityScore * weights.reliability;

    return {
      supplierId: pricing.supplierId,
      supplierName: pricing.supplierName,
      unitPrice: pricing.unitPrice,
      currency: pricing.currency,
      leadTimeDays: pricing.leadTimeDays,
      minimumOrder: pricing.minimumOrder,
      rating: supplier?.rating,
      onTimeDeliveryRate: supplier?.onTimeDeliveryRate,
      qualityScore: supplier?.qualityScore,
      totalOrders: supplier?.totalOrders,
      priceScore: Math.round(priceScore),
      deliveryScore: Math.round(deliveryScore),
      qualityScoreComputed: Math.round(qualityScoreComputed),
      overallScore: Math.round(overallScore),
      rank: 0,
      isPreferred: pricing.isPreferred,
      recommendation: 'standard' as const,
    };
  });

  // 4. Sort by overall score descending and assign ranks
  results.sort((a, b) => b.overallScore - a.overallScore);
  results.forEach((r, i) => { r.rank = i + 1; });

  // 5. Assign recommendation labels
  if (results.length > 0) {
    results[0].recommendation = 'best-value';
  }

  // Find fastest delivery
  const fastest = [...results].sort((a, b) => (a.leadTimeDays ?? 999) - (b.leadTimeDays ?? 999));
  if (fastest[0] && fastest[0].supplierId !== results[0].supplierId) {
    fastest[0].recommendation = 'fastest';
  }

  // Find highest quality
  const bestQuality = [...results].sort((a, b) => b.qualityScoreComputed - a.qualityScoreComputed);
  if (bestQuality[0] && bestQuality[0].recommendation === 'standard') {
    bestQuality[0].recommendation = 'highest-quality';
  }

  // Mark currently preferred supplier
  const preferred = results.find(r => r.isPreferred);
  if (preferred && preferred.recommendation === 'standard') {
    preferred.recommendation = 'preferred';
  }

  return results;
}

/**
 * Get a price comparison summary for an item across suppliers
 */
export function getPriceSummary(supplierPricing: SupplierInventoryPricing[]) {
  if (supplierPricing.length === 0) return null;

  const prices = supplierPricing.map(sp => sp.unitPrice);
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const avg = prices.reduce((sum, p) => sum + p, 0) / prices.length;
  const preferred = supplierPricing.find(sp => sp.isPreferred);
  const savings = preferred ? ((preferred.unitPrice - min) / preferred.unitPrice) * 100 : 0;

  return {
    minPrice: min,
    maxPrice: max,
    avgPrice: Math.round(avg),
    priceSpread: max - min,
    priceSpreadPercent: min > 0 ? Math.round(((max - min) / min) * 100) : 0,
    cheapestSupplierId: supplierPricing.find(sp => sp.unitPrice === min)?.supplierId,
    cheapestSupplierName: supplierPricing.find(sp => sp.unitPrice === min)?.supplierName,
    preferredSavingsPercent: Math.round(savings),
    supplierCount: supplierPricing.length,
    currency: supplierPricing[0]?.currency || 'UGX',
  };
}
