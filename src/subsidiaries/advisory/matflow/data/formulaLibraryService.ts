/**
 * MatFlow Formula Library Service
 *
 * Replaces hardcoded standardFormulas.ts with a Firestore-managed library.
 * Formulas are stored in Firestore and can be updated without code deployments.
 *
 * Firestore Structure:
 *   matflow/data/formulaLibrary         → metadata doc (version, lastUpdated, etc.)
 *   matflow/data/formulaLibrary/formulas → subcollection of individual formula docs
 *
 * Each formula doc ID = formula code (e.g., "CONC_C25")
 */

import {
  getFirestore,
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
  deleteDoc,
  writeBatch,
  query,
  where,
  orderBy,
  Timestamp,
  DocumentData,
} from 'firebase/firestore';

// ============================================================================
// Types
// ============================================================================

export interface FormulaComponent {
  materialName: string;
  quantity: number;
  unit: string;
  wastagePercent: number;
}

export interface Formula {
  code: string;
  name: string;
  description: string;
  category: string;
  subcategory?: string;
  outputUnit: string;
  components: FormulaComponent[];
  keywords: string[];
  source?: string;       // 'aaqs_standard' | 'analysis_schedule' | 'bbs_verified' | 'custom'
  isActive: boolean;
  createdAt?: Date;
  updatedAt?: Date;
  updatedBy?: string;
  version?: number;
}

export interface FormulaLibraryMetadata {
  version: string;
  lastUpdated: Date;
  updatedBy: string;
  totalFormulas: number;
  categories: string[];
  standard: string;
  rebarConversionFactors: Record<string, number>;
}

export interface FormulaImportResult {
  created: number;
  updated: number;
  skipped: number;
  errors: { code: string; error: string }[];
}

// ============================================================================
// Constants
// ============================================================================

const LIBRARY_ROOT = 'matflow/data/formulaLibrary';
const FORMULAS_COLLECTION = `${LIBRARY_ROOT}/formulas`;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

// ============================================================================
// In-Memory Cache
// ============================================================================

let formulaCache: Formula[] | null = null;
let cacheTimestamp = 0;

function isCacheValid(): boolean {
  return formulaCache !== null && Date.now() - cacheTimestamp < CACHE_TTL_MS;
}

function invalidateCache(): void {
  formulaCache = null;
  cacheTimestamp = 0;
}

// ============================================================================
// Core CRUD Operations
// ============================================================================

const db = getFirestore();

/**
 * Get all active formulas from the library.
 * Results are cached for 5 minutes.
 */
export async function getAllFormulas(includeInactive = false): Promise<Formula[]> {
  if (isCacheValid() && !includeInactive) {
    return formulaCache!;
  }

  const formulasRef = collection(db, FORMULAS_COLLECTION);
  const q = includeInactive
    ? query(formulasRef, orderBy('category'), orderBy('code'))
    : query(formulasRef, where('isActive', '==', true), orderBy('category'), orderBy('code'));

  const snapshot = await getDocs(q);
  const formulas = snapshot.docs.map((d) => docToFormula(d.data()));

  if (!includeInactive) {
    formulaCache = formulas;
    cacheTimestamp = Date.now();
  }

  return formulas;
}

/**
 * Get a single formula by its code.
 */
export async function getFormulaByCode(code: string): Promise<Formula | null> {
  const docRef = doc(db, FORMULAS_COLLECTION, code);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;
  return docToFormula(snap.data());
}

/**
 * Get all formulas in a specific category.
 */
export async function getFormulasByCategory(category: string): Promise<Formula[]> {
  const formulasRef = collection(db, FORMULAS_COLLECTION);
  const q = query(
    formulasRef,
    where('category', '==', category),
    where('isActive', '==', true),
    orderBy('code')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => docToFormula(d.data()));
}

/**
 * Search formulas by keyword matching.
 */
export async function searchFormulas(searchTerm: string): Promise<Formula[]> {
  const allFormulas = await getAllFormulas();
  const term = searchTerm.toLowerCase();

  return allFormulas.filter(
    (f) =>
      f.name.toLowerCase().includes(term) ||
      f.description.toLowerCase().includes(term) ||
      f.code.toLowerCase().includes(term) ||
      f.keywords.some((kw) => kw.toLowerCase().includes(term))
  );
}

/**
 * Create or update a single formula.
 */
export async function upsertFormula(
  formula: Formula,
  updatedBy = 'system'
): Promise<{ action: 'created' | 'updated' }> {
  const docRef = doc(db, FORMULAS_COLLECTION, formula.code);
  const existing = await getDoc(docRef);

  const now = Timestamp.now();
  const data = {
    ...formula,
    subcategory: formula.subcategory || '',
    updatedAt: now,
    updatedBy,
    version: existing.exists() ? (existing.data()?.version ?? 0) + 1 : 1,
  };

  if (!existing.exists()) {
    data.createdAt = now as any;
  }

  await setDoc(docRef, data, { merge: true });
  invalidateCache();

  return { action: existing.exists() ? 'updated' : 'created' };
}

/**
 * Soft-delete a formula (sets isActive = false).
 */
export async function deactivateFormula(code: string, updatedBy = 'system'): Promise<void> {
  const docRef = doc(db, FORMULAS_COLLECTION, code);
  await updateDoc(docRef, {
    isActive: false,
    updatedAt: Timestamp.now(),
    updatedBy,
  });
  invalidateCache();
}

/**
 * Hard-delete a formula (permanent removal).
 */
export async function deleteFormula(code: string): Promise<void> {
  const docRef = doc(db, FORMULAS_COLLECTION, code);
  await deleteDoc(docRef);
  invalidateCache();
}

// ============================================================================
// Bulk Import / Sync
// ============================================================================

/**
 * Import formulas from a JSON library file.
 * Supports three modes:
 *   - 'merge': Create new, update existing, keep others untouched (default)
 *   - 'replace': Delete all existing, replace with import data
 *   - 'add_only': Only create formulas that don't exist yet
 */
export async function importFormulas(
  formulas: Formula[],
  mode: 'merge' | 'replace' | 'add_only' = 'merge',
  updatedBy = 'system'
): Promise<FormulaImportResult> {
  const result: FormulaImportResult = {
    created: 0,
    updated: 0,
    skipped: 0,
    errors: [],
  };

  // For 'replace' mode, delete all existing formulas first
  if (mode === 'replace') {
    const existing = await getDocs(collection(db, FORMULAS_COLLECTION));
    const deleteBatch = writeBatch(db);
    existing.docs.forEach((d) => deleteBatch.delete(d.ref));
    await deleteBatch.commit();
  }

  // Process in batches of 500 (Firestore batch limit)
  const batchSize = 500;
  for (let i = 0; i < formulas.length; i += batchSize) {
    const chunk = formulas.slice(i, i + batchSize);
    const batch = writeBatch(db);

    for (const formula of chunk) {
      try {
        const docRef = doc(db, FORMULAS_COLLECTION, formula.code);
        const existing = mode !== 'replace' ? await getDoc(docRef) : null;

        if (mode === 'add_only' && existing?.exists()) {
          result.skipped++;
          continue;
        }

        const now = Timestamp.now();
        const data: any = {
          ...formula,
          updatedAt: now,
          updatedBy,
          isActive: formula.isActive ?? true,
        };

        if (!existing?.exists() || mode === 'replace') {
          data.createdAt = now;
          data.version = 1;
          result.created++;
        } else {
          data.version = (existing.data()?.version ?? 0) + 1;
          result.updated++;
        }

        batch.set(docRef, data, { merge: mode === 'merge' });
      } catch (err: any) {
        result.errors.push({ code: formula.code, error: err.message });
      }
    }

    await batch.commit();
  }

  // Update library metadata
  await updateLibraryMetadata(formulas, updatedBy);
  invalidateCache();

  return result;
}

/**
 * Import formulas from a JSON string (e.g., from file upload or API).
 */
export async function importFromJSON(
  jsonString: string,
  mode: 'merge' | 'replace' | 'add_only' = 'merge',
  updatedBy = 'system'
): Promise<FormulaImportResult> {
  const parsed = JSON.parse(jsonString);
  const formulas: Formula[] = parsed.formulas ?? parsed;

  // Validate structure
  for (const f of formulas) {
    if (!f.code || !f.name || !f.components || !Array.isArray(f.components)) {
      throw new Error(`Invalid formula structure for: ${f.code ?? 'unknown'}`);
    }
  }

  return importFormulas(formulas, mode, updatedBy);
}

// ============================================================================
// Library Metadata
// ============================================================================

/**
 * Get library metadata (version, last update, stats).
 */
export async function getLibraryMetadata(): Promise<FormulaLibraryMetadata | null> {
  const docRef = doc(db, LIBRARY_ROOT);
  const snap = await getDoc(docRef);
  if (!snap.exists()) return null;

  const data = snap.data();
  return {
    version: data.version,
    lastUpdated: data.lastUpdated?.toDate(),
    updatedBy: data.updatedBy,
    totalFormulas: data.totalFormulas,
    categories: data.categories,
    standard: data.standard,
    rebarConversionFactors: data.rebarConversionFactors,
  };
}

async function updateLibraryMetadata(
  formulas: Formula[],
  updatedBy: string
): Promise<void> {
  const categories = [...new Set(formulas.map((f) => f.category))].sort();
  const allFormulas = await getAllFormulas(true);

  await setDoc(
    doc(db, LIBRARY_ROOT),
    {
      version: `2.0.${Date.now()}`,
      lastUpdated: Timestamp.now(),
      updatedBy,
      totalFormulas: allFormulas.length,
      categories,
      standard: 'AAQS Standard Method of Measuring Building Work for Africa 2015',
      rebarConversionFactors: {
        '8mm': 0.4,
        '10mm': 0.62,
        '12mm': 0.888,
        '16mm': 1.579,
        '20mm': 2.47,
      },
    },
    { merge: true }
  );
}

// ============================================================================
// Export
// ============================================================================

/**
 * Export all formulas as a JSON library object (for backup or transfer).
 */
export async function exportLibraryAsJSON(includeInactive = false): Promise<string> {
  const formulas = await getAllFormulas(includeInactive);
  const metadata = await getLibraryMetadata();

  const library = {
    _metadata: {
      ...metadata,
      exportedAt: new Date().toISOString(),
    },
    formulas,
  };

  return JSON.stringify(library, null, 2);
}

// ============================================================================
// Migration — One-time import from old standardFormulas.ts
// ============================================================================

/**
 * Migrate from the old hardcoded standardFormulas.ts to the Firestore library.
 * Call this ONCE during deployment. It reads the JSON file and imports all formulas.
 */
export async function migrateFromLegacy(
  jsonFilePath?: string
): Promise<FormulaImportResult> {
  // If a file path is provided, read from it; otherwise use the embedded data
  let formulas: Formula[];

  if (jsonFilePath) {
    // For server-side use with fs
    const fs = await import('fs');
    const raw = fs.readFileSync(jsonFilePath, 'utf-8');
    const parsed = JSON.parse(raw);
    formulas = parsed.formulas;
  } else {
    // Fallback: fetch from a known URL or use bundled data
    throw new Error(
      'Provide the path to formulas.json for migration. ' +
      'Example: migrateFromLegacy("./formulas.json")'
    );
  }

  console.log(`Migrating ${formulas.length} formulas to Firestore library...`);
  const result = await importFormulas(formulas, 'merge', 'migration_script');
  console.log(
    `Migration complete: ${result.created} created, ${result.updated} updated, ${result.errors.length} errors`
  );

  return result;
}

// ============================================================================
// Helpers
// ============================================================================

function docToFormula(data: DocumentData): Formula {
  return {
    code: data.code,
    name: data.name,
    description: data.description,
    category: data.category,
    subcategory: data.subcategory,
    outputUnit: data.outputUnit,
    components: data.components ?? [],
    keywords: data.keywords ?? [],
    source: data.source,
    isActive: data.isActive ?? true,
    createdAt: data.createdAt?.toDate?.() ?? undefined,
    updatedAt: data.updatedAt?.toDate?.() ?? undefined,
    updatedBy: data.updatedBy,
    version: data.version,
  };
}
