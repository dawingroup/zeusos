/**
 * Supplier Recommendation Service
 * AI-powered supplier selection and preferred supplier enforcement.
 * Ranks suppliers based on historical performance, pricing, and lead times.
 */

import {
  collection,
  getDocs,
  query,
  where,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { getActiveSuppliers, getSuppliersByMaterial, calculateSupplierRating } from '@/modules/suppliers/services/supplierService';
import type { Supplier, SubsidiaryId } from '@/modules/suppliers/types/supplier';
import type { PurchaseOrder } from '../types/purchaseOrder';

// ============================================================================
// TYPES
// ============================================================================

export interface SupplierRecommendation {
  supplier: Supplier;
  score: number;              // 0-100 composite score
  rank: number;
  isPreferred: boolean;
  reasons: string[];
  breakdown: {
    ratingScore: number;      // From supplier rating (0-25)
    priceScore: number;       // From material rates vs market (0-25)
    deliveryScore: number;    // From on-time delivery rate (0-25)
    historyScore: number;     // From order volume / relationship (0-25)
  };
  estimatedLeadDays?: number;
  lastOrderDate?: string;
  totalHistoricalSpend?: number;
}

export interface PreferredSupplierRule {
  id: string;
  materialId?: string;
  category?: string;
  supplierId: string;
  supplierName: string;
  reason: string;
  priority: number;           // Lower = higher priority
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
}

// ============================================================================
// SUPPLIER SCORING
// ============================================================================

/**
 * Score a supplier based on multiple factors.
 * Returns a composite score from 0-100.
 */
function scoreSupplier(
  supplier: Supplier,
  historicalPOs: PurchaseOrder[],
  materialId?: string,
): { score: number; breakdown: SupplierRecommendation['breakdown']; reasons: string[] } {
  const reasons: string[] = [];

  // 1. Rating score (0-25) — from supplier rating calculation
  const rating = calculateSupplierRating(supplier);
  const ratingScore = (rating / 5) * 25;
  if (rating >= 4) reasons.push(`High rating: ${rating.toFixed(1)}/5`);

  // 2. Price score (0-25) — based on material rates if available
  let priceScore = 12.5; // Default middle score
  if (materialId && supplier.materials?.includes(materialId)) {
    priceScore = 20; // Bonus for supplying the specific material
    reasons.push('Supplies requested material');
  }

  // 3. Delivery score (0-25) — from on-time delivery rate
  const deliveryRate = supplier.onTimeDeliveryRate ?? 0;
  const deliveryScore = (deliveryRate / 100) * 25;
  if (deliveryRate >= 90) reasons.push(`Excellent delivery: ${deliveryRate}% on-time`);

  // 4. History score (0-25) — from order volume and relationship depth
  const supplierPOs = historicalPOs.filter(
    (po) => po.supplierId === supplier.id,
  );
  const orderCount = supplierPOs.length;
  const totalSpend = supplierPOs.reduce(
    (sum, po) => sum + po.totals.grandTotal,
    0,
  );
  const historyScore = Math.min(25, orderCount * 2.5 + (totalSpend > 0 ? 5 : 0));
  if (orderCount > 5) reasons.push(`Proven track record: ${orderCount} orders`);

  const score = Math.round(ratingScore + priceScore + deliveryScore + historyScore);

  return {
    score: Math.min(100, score),
    breakdown: { ratingScore, priceScore, deliveryScore, historyScore },
    reasons,
  };
}

// ============================================================================
// RECOMMENDATION ENGINE
// ============================================================================

/**
 * Get ranked supplier recommendations for a procurement need.
 * Considers rating, pricing, delivery, and order history.
 */
export async function getSupplierRecommendations(
  subsidiaryId: SubsidiaryId,
  options: {
    materialId?: string;
    category?: string;
    minRating?: number;
    limit?: number;
  } = {},
): Promise<SupplierRecommendation[]> {
  // Get candidate suppliers
  let candidates: Supplier[];
  if (options.materialId) {
    candidates = await getSuppliersByMaterial(options.materialId, subsidiaryId);
  } else {
    candidates = await getActiveSuppliers(subsidiaryId);
  }

  if (options.category) {
    candidates = candidates.filter((s) => s.categories.includes(options.category!));
  }

  if (options.minRating) {
    candidates = candidates.filter(
      (s) => (s.rating ?? 0) >= options.minRating!,
    );
  }

  // Get historical POs for scoring
  const poQuery = query(
    collection(db, 'purchaseOrders'),
    where('subsidiaryId', '==', subsidiaryId),
  );
  const poSnap = await getDocs(poQuery);
  const historicalPOs = poSnap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as PurchaseOrder),
  );

  // Score and rank suppliers
  const recommendations: SupplierRecommendation[] = candidates.map((supplier) => {
    const { score, breakdown, reasons } = scoreSupplier(
      supplier,
      historicalPOs,
      options.materialId,
    );

    const supplierPOs = historicalPOs.filter((po) => po.supplierId === supplier.id);
    const totalSpend = supplierPOs.reduce(
      (sum, po) => sum + po.totals.grandTotal,
      0,
    );
    const lastOrder = supplierPOs.length > 0
      ? supplierPOs.sort((a, b) => {
          const aTime = (a.createdAt as unknown as { seconds: number })?.seconds ?? 0;
          const bTime = (b.createdAt as unknown as { seconds: number })?.seconds ?? 0;
          return bTime - aTime;
        })[0]
      : null;

    return {
      supplier,
      score,
      rank: 0, // Set after sorting
      isPreferred: score >= 75,
      reasons,
      breakdown,
      totalHistoricalSpend: totalSpend,
      lastOrderDate: lastOrder
        ? new Date(
            ((lastOrder.createdAt as unknown as { seconds: number })?.seconds ?? 0) * 1000,
          ).toISOString().split('T')[0]
        : undefined,
    };
  });

  // Sort by score descending
  recommendations.sort((a, b) => b.score - a.score);

  // Assign ranks
  recommendations.forEach((rec, index) => {
    rec.rank = index + 1;
  });

  const limit = options.limit ?? 10;
  return recommendations.slice(0, limit);
}

/**
 * Get the recommended (top-ranked) supplier for a specific material.
 */
export async function getPreferredSupplier(
  subsidiaryId: SubsidiaryId,
  materialId: string,
): Promise<SupplierRecommendation | null> {
  const recommendations = await getSupplierRecommendations(subsidiaryId, {
    materialId,
    limit: 1,
  });
  return recommendations[0] ?? null;
}

/**
 * Validate that a selected supplier meets minimum quality thresholds.
 * Returns warnings if the supplier has poor metrics.
 */
export function validateSupplierSelection(
  supplier: Supplier,
): { valid: boolean; warnings: string[] } {
  const warnings: string[] = [];

  const rating = calculateSupplierRating(supplier);
  if (rating < 2) {
    warnings.push(`Low supplier rating: ${rating.toFixed(1)}/5`);
  }

  if ((supplier.onTimeDeliveryRate ?? 0) < 70) {
    warnings.push(`Poor delivery rate: ${supplier.onTimeDeliveryRate ?? 0}%`);
  }

  if ((supplier.qualityScore ?? 0) < 70) {
    warnings.push(`Low quality score: ${supplier.qualityScore ?? 0}%`);
  }

  if (supplier.status === 'blacklisted') {
    warnings.push('Supplier is blacklisted');
  }

  if (supplier.status === 'inactive') {
    warnings.push('Supplier is inactive');
  }

  return {
    valid: warnings.length === 0 && supplier.status === 'active',
    warnings,
  };
}
