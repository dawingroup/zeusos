/**
 * Production Feedback Service
 *
 * Compares completed MO actuals vs DKB archetype estimates
 * to continuously refine the knowledge base.
 */
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '@/firebase/config';
import { getEntry } from './knowledgeBase.service';
import type { ProductArchetypeEntry } from '../types/knowledgeBase.types';

interface FeedbackComparison {
  archetypeId: string;
  archetypeName: string;
  moId: string;
  discrepancies: Discrepancy[];
  overallAccuracy: number; // 0-1
}

interface Discrepancy {
  field: string;
  expected: number;
  actual: number;
  percentDiff: number;
  severity: 'low' | 'medium' | 'high';
}

/**
 * Compare a completed MO's actual data against the DKB archetype that sourced it.
 */
export async function compareActualsToArchetype(
  moId: string,
  archetypeId: string,
): Promise<FeedbackComparison | null> {
  const archetype = await getEntry(archetypeId);
  if (!archetype || archetype.entryType !== 'product_archetype') return null;
  const arch = archetype as ProductArchetypeEntry;

  // Fetch MO data
  const moSnap = await getDocs(
    query(collection(db, 'manufacturingOrders'), where('__name__', '==', moId))
  );
  if (moSnap.empty) return null;
  const mo = moSnap.docs[0].data();

  const discrepancies: Discrepancy[] = [];

  // Compare dimensions if available
  if (mo.configuration) {
    const config = mo.configuration as Record<string, number>;
    const dims = arch.standardDimensions;

    for (const axis of ['width', 'depth', 'height'] as const) {
      const actual = config[axis];
      const expected = dims[axis].default;
      if (actual && expected) {
        const pctDiff = Math.abs(actual - expected) / expected * 100;
        if (pctDiff > 5) {
          discrepancies.push({
            field: `dimensions.${axis}`,
            expected,
            actual,
            percentDiff: pctDiff,
            severity: pctDiff > 20 ? 'high' : pctDiff > 10 ? 'medium' : 'low',
          });
        }
      }
    }
  }

  // Compare cost if available
  if (mo.actualCost && mo.estimatedCost) {
    const pctDiff = Math.abs(mo.actualCost - mo.estimatedCost) / mo.estimatedCost * 100;
    if (pctDiff > 5) {
      discrepancies.push({
        field: 'cost',
        expected: mo.estimatedCost,
        actual: mo.actualCost,
        percentDiff: pctDiff,
        severity: pctDiff > 25 ? 'high' : pctDiff > 15 ? 'medium' : 'low',
      });
    }
  }

  const overallAccuracy = discrepancies.length === 0
    ? 1
    : 1 - discrepancies.reduce((sum, d) => sum + d.percentDiff, 0) / (discrepancies.length * 100);

  return {
    archetypeId,
    archetypeName: arch.name,
    moId,
    discrepancies,
    overallAccuracy: Math.max(0, overallAccuracy),
  };
}
