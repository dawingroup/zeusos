/**
 * Formula Suggestion Service
 * Manages formula suggestions with caching and analytics
 */

import {
  collection,
  doc,
  getDocs,
  updateDoc,
  increment,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase';
import type { StandardFormula, BOQItem } from '../types';
import {
  getFormulaSuggestions,
  getQuickSuggestions,
  type FormulaSuggestion,
  type MatchOptions,
} from '../ai/matchers';

const FORMULAS_COLLECTION = 'matflow/data/formulas';

/**
 * Cache for formulas to avoid repeated fetches
 */
let formulasCache: StandardFormula[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

/**
 * Get all formulas with caching
 */
async function getFormulasWithCache(): Promise<StandardFormula[]> {
  const now = Date.now();
  
  if (formulasCache && (now - cacheTimestamp) < CACHE_TTL) {
    return formulasCache;
  }
  
  const snapshot = await getDocs(collection(db, FORMULAS_COLLECTION));
  formulasCache = snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data(),
  } as StandardFormula));
  cacheTimestamp = now;
  
  return formulasCache;
}

/**
 * Invalidate formula cache
 */
export function invalidateFormulaCache(): void {
  formulasCache = null;
  cacheTimestamp = 0;
}

/**
 * Get formula suggestions for a BOQ item description
 */
export async function suggestFormulas(
  description: string,
  unit: string,
  options?: MatchOptions
): Promise<FormulaSuggestion[]> {
  const formulas = await getFormulasWithCache();
  return getFormulaSuggestions(description, unit, formulas, options);
}

/**
 * Get quick suggestions (rule-based only, for real-time)
 */
export async function suggestFormulasQuick(
  description: string,
  unit: string,
  maxResults: number = 3
): Promise<FormulaSuggestion[]> {
  const formulas = await getFormulasWithCache();
  return getQuickSuggestions(description, unit, formulas, maxResults);
}

/**
 * Record formula selection (for learning/analytics)
 */
export async function recordFormulaSelection(
  formulaCode: string,
  boqDescription: string,
  wasAISuggestion: boolean,
  confidence?: number
): Promise<void> {
  try {
    // Find the formula document by code
    const formulas = await getFormulasWithCache();
    const formula = formulas.find(f => f.code === formulaCode);
    
    if (!formula) return;
    
    const formulaRef = doc(db, FORMULAS_COLLECTION, formula.id);
    
    await updateDoc(formulaRef, {
      usageCount: increment(1),
      lastUsed: serverTimestamp(),
    });
    
    // Log for future ML training
    console.log('Formula selection recorded:', {
      formulaCode,
      wasAISuggestion,
      confidence,
      descriptionLength: boqDescription.length,
    });
  } catch (error) {
    console.error('Failed to record formula selection:', error);
    // Non-critical, don't throw
  }
}

/**
 * Get suggestions for multiple BOQ items
 */
export async function suggestFormulasForBatch(
  items: Array<{ id: string; description: string; unit: string }>,
  options?: MatchOptions
): Promise<Map<string, FormulaSuggestion[]>> {
  const formulas = await getFormulasWithCache();
  const results = new Map<string, FormulaSuggestion[]>();
  
  // Process in parallel with controlled concurrency
  const BATCH_SIZE = 10;
  
  for (let i = 0; i < items.length; i += BATCH_SIZE) {
    const batch = items.slice(i, i + BATCH_SIZE);
    
    await Promise.all(
      batch.map(async (item) => {
        const suggestions = await getFormulaSuggestions(
          item.description,
          item.unit,
          formulas,
          { ...options, enableSemantic: false } // Disable semantic for batch
        );
        results.set(item.id, suggestions);
      })
    );
  }
  
  return results;
}

/**
 * Auto-assign formulas to BOQ items based on confidence threshold
 */
export async function autoAssignFormulas(
  items: BOQItem[],
  confidenceThreshold: number = 0.85
): Promise<{
  assigned: Array<{ itemId: string; formulaCode: string; confidence: number }>;
  unassigned: Array<{ itemId: string; reason: string }>;
}> {
  const formulas = await getFormulasWithCache();
  const assigned: Array<{ itemId: string; formulaCode: string; confidence: number }> = [];
  const unassigned: Array<{ itemId: string; reason: string }> = [];
  
  for (const item of items) {
    if (item.formulaId || item.formulaCode) {
      // Already has a formula
      continue;
    }
    
    const suggestions = getQuickSuggestions(item.description, item.unit, formulas, 1);
    
    if (suggestions.length === 0) {
      unassigned.push({ itemId: item.id, reason: 'No matching formulas found' });
    } else if (suggestions[0].confidence < confidenceThreshold) {
      unassigned.push({
        itemId: item.id,
        reason: `Best match confidence (${Math.round(suggestions[0].confidence * 100)}%) below threshold`,
      });
    } else {
      assigned.push({
        itemId: item.id,
        formulaCode: suggestions[0].formulaCode,
        confidence: suggestions[0].confidence,
      });
    }
  }
  
  return { assigned, unassigned };
}
