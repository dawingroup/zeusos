/**
 * Part Priority Hint Service
 *
 * Computes advisory scores for each part within a design item to help
 * designers decide purchase ordering. Factors: stock availability,
 * part type (special/imported parts often have longer lead times),
 * and cost tier.
 *
 * These are hints only — the manual rank is always the source of truth.
 */

import { db } from '@/shared/services/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import type { DesignItem, StandardPartEntry, SpecialPartEntry, PartEntry } from '../types';

export interface PartPriorityHint {
  partId: string;
  partType: 'sheet' | 'bar' | 'standard' | 'special';
  /** 0-100, higher = should buy sooner */
  score: number;
  signals: string[];
  stockStatus?: 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown';
}

/** Check stock availability for a material ID */
async function checkStock(materialId?: string): Promise<{ status: 'in_stock' | 'low_stock' | 'out_of_stock' | 'unknown'; available: number }> {
  if (!materialId) return { status: 'unknown', available: 0 };

  try {
    const q = query(collection(db, 'stockLevels'), where('inventoryItemId', '==', materialId));
    const snap = await getDocs(q);
    if (snap.empty) return { status: 'unknown', available: 0 };

    let totalAvailable = 0;
    snap.forEach((doc) => {
      const data = doc.data();
      totalAvailable += (data.quantityAvailable ?? data.quantity ?? 0);
    });

    if (totalAvailable <= 0) return { status: 'out_of_stock', available: 0 };
    if (totalAvailable < 5) return { status: 'low_stock', available: totalAvailable };
    return { status: 'in_stock', available: totalAvailable };
  } catch {
    return { status: 'unknown', available: 0 };
  }
}

/**
 * Compute priority hints for all parts in a design item.
 * Returns hints sorted by score descending (highest urgency first).
 */
export async function computePartPriorityHints(
  item: DesignItem,
  parts?: PartEntry[],
): Promise<PartPriorityHint[]> {
  const hints: PartPriorityHint[] = [];
  const manufacturing = (item as any).manufacturing;

  // Sheet/bar parts
  if (parts) {
    for (const p of parts) {
      const stock = await checkStock(p.materialId);
      const signals: string[] = [];
      let score = 0;

      // Stock availability (0-40 pts)
      if (stock.status === 'out_of_stock') {
        score += 40;
        signals.push('Out of stock');
      } else if (stock.status === 'low_stock') {
        score += 25;
        signals.push(`Low stock (${stock.available} avail)`);
      } else if (stock.status === 'in_stock') {
        score += 5;
      }

      // Part type heuristic (0-20 pts)
      if (p.partType === 'bar' || p.partType === 'timber') {
        score += 10;
        signals.push(p.partType === 'timber' ? 'Timber/lumber material' : 'Bar/section material');
      }

      // Quantity (0-15 pts) — larger orders take longer
      if (p.quantity >= 20) {
        score += 15;
        signals.push('Large quantity');
      } else if (p.quantity >= 10) {
        score += 8;
      }

      // CNC operations (0-10 pts) — may need material early for programming
      if (p.hasCNCOperations) {
        score += 10;
        signals.push('Has CNC operations');
      }

      hints.push({
        partId: p.id,
        // Downstream PartPriorityHint.partType only distinguishes bar vs sheet; timber uses linear/bar semantics.
        partType: (p.partType === 'bar' || p.partType === 'timber') ? 'bar' : 'sheet',
        score: Math.min(100, score),
        signals,
        stockStatus: stock.status,
      });
    }
  }

  // Standard parts
  if (manufacturing?.standardParts) {
    for (const p of manufacturing.standardParts as StandardPartEntry[]) {
      const signals: string[] = [];
      let score = 15; // Base: hardware generally available

      if (p.quantity >= 50) {
        score += 15;
        signals.push('Large quantity');
      }

      hints.push({
        partId: `std-${p.id}`,
        partType: 'standard',
        score: Math.min(100, score),
        signals,
        stockStatus: 'unknown',
      });
    }
  }

  // Special parts — typically highest priority (imported, long lead time)
  if (manufacturing?.specialParts) {
    for (const p of manufacturing.specialParts as SpecialPartEntry[]) {
      const signals: string[] = [];
      let score = 50; // Base: special parts are usually imported

      signals.push('Special/imported part');

      // Supplier-based heuristic
      if (p.supplier) {
        score += 10;
        signals.push(`Supplier: ${p.supplier}`);
      }

      // High cost items warrant early ordering
      const landedCost = p.costing?.totalLandedCost ?? 0;
      if (landedCost > 5_000_000) { // > 5M UGX
        score += 15;
        signals.push('High-value item');
      } else if (landedCost > 1_000_000) {
        score += 8;
      }

      hints.push({
        partId: `spl-${p.id}`,
        partType: 'special',
        score: Math.min(100, score),
        signals,
        stockStatus: 'unknown',
      });
    }
  }

  // Sort by score descending
  hints.sort((a, b) => b.score - a.score);
  return hints;
}
