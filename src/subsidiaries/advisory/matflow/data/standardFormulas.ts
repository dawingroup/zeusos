/**
 * Standard Formulas — Library Adapter
 *
 * This file replaces the old hardcoded formulas array.
 * It now reads from the Firestore formula library and exposes the same
 * interface so existing code (materialCalculator, formulaSuggestionService)
 * continues to work without changes.
 *
 * For backwards compatibility, it also bundles a static fallback that is
 * used if the Firestore library hasn't been seeded yet.
 */

import { getAllFormulas, Formula } from './formulaLibraryService';

// Re-export types for backwards compatibility
export interface SeedFormulaComponent {
  materialName: string;
  quantity: number;
  unit: string;
  wastagePercent: number;
}

export interface SeedFormula {
  code: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  outputUnit: string;
  components: SeedFormulaComponent[];
  keywords: string[];
}

/**
 * Convert a library Formula to the legacy SeedFormula interface.
 */
function toSeedFormula(f: Formula): SeedFormula {
  return {
    code: f.code,
    name: f.name,
    description: f.description,
    category: f.category,
    subcategory: f.subcategory,
    outputUnit: f.outputUnit,
    components: f.components.map((c) => ({
      materialName: c.materialName,
      quantity: c.quantity,
      unit: c.unit,
      wastagePercent: c.wastagePercent,
    })),
    keywords: f.keywords,
  };
}

/**
 * Get all standard formulas from the Firestore library.
 * Falls back to the static JSON bundle if Firestore is unavailable.
 */
export async function getStandardFormulas(): Promise<SeedFormula[]> {
  try {
    const formulas = await getAllFormulas();
    if (formulas.length > 0) {
      return formulas.map(toSeedFormula);
    }
  } catch (err) {
    console.warn('Formula library unavailable, using static fallback:', err);
  }

  // Fallback: load from bundled JSON
  const fallback = await import('./formulas.json');
  return (fallback.formulas as any[]).map((f) => ({
    code: f.code,
    name: f.name,
    description: f.description,
    category: f.category,
    subcategory: f.subcategory,
    outputUnit: f.outputUnit,
    components: f.components,
    keywords: f.keywords,
  }));
}

/**
 * Synchronous export for existing code that imports ALL_STANDARD_FORMULAS directly.
 * NOTE: This uses the static JSON fallback. For live Firestore data, use getStandardFormulas().
 */
import formulaData from './formulas.json';

export const ALL_STANDARD_FORMULAS: SeedFormula[] = (formulaData.formulas as any[]).map((f) => ({
  code: f.code,
  name: f.name,
  description: f.description,
  category: f.category,
  subcategory: f.subcategory,
  outputUnit: f.outputUnit,
  components: f.components,
  keywords: f.keywords,
}));
