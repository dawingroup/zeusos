/**
 * Formula Service
 * Access and manage standard calculation formulas
 */

import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  orderBy,
  updateDoc,
  increment,
  serverTimestamp,
  deleteDoc,
} from 'firebase/firestore';
import { db } from '@/core/services/firebase';
import type { StandardFormula, FormulaComponent, MaterialCategory } from '../types';

const FORMULAS_COLLECTION = 'matflow/data/formulas';

export interface CreateFormulaInput {
  code: string;
  name: string;
  description?: string;
  category: string;
  subcategory?: string;
  outputUnit: string;
  components: FormulaComponent[];
}

export async function getFormulas(category?: MaterialCategory): Promise<StandardFormula[]> {
  let q = query(
    collection(db, FORMULAS_COLLECTION),
    where('isActive', '==', true),
    orderBy('usageCount', 'desc')
  );
  
  if (category) {
    q = query(q, where('category', '==', category));
  }
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as StandardFormula[];
}

export async function getFormulaById(formulaId: string): Promise<StandardFormula | null> {
  if (!formulaId || typeof formulaId !== 'string') return null;
  const snapshot = await getDoc(doc(db, FORMULAS_COLLECTION, formulaId));
  if (!snapshot.exists()) return null;
  return { id: snapshot.id, ...snapshot.data() } as StandardFormula;
}

export async function getFormulaByCode(code: string): Promise<StandardFormula | null> {
  const q = query(
    collection(db, FORMULAS_COLLECTION),
    where('code', '==', code),
    where('isActive', '==', true)
  );
  
  const snapshot = await getDocs(q);
  if (snapshot.empty) return null;
  
  return { id: snapshot.docs[0].id, ...snapshot.docs[0].data() } as StandardFormula;
}

export async function searchFormulas(searchTerm: string): Promise<StandardFormula[]> {
  // Firestore doesn't support full-text search, so we search by keywords
  const q = query(
    collection(db, FORMULAS_COLLECTION),
    where('isActive', '==', true),
    where('keywords', 'array-contains', searchTerm.toLowerCase())
  );
  
  const snapshot = await getDocs(q);
  return snapshot.docs.map(docSnap => ({
    id: docSnap.id,
    ...docSnap.data(),
  })) as StandardFormula[];
}

export async function incrementFormulaUsage(formulaId: string): Promise<void> {
  await updateDoc(doc(db, FORMULAS_COLLECTION, formulaId), {
    usageCount: increment(1),
  });
}

// CREATE
export async function createFormula(input: CreateFormulaInput, userId: string): Promise<string> {
  const formulaRef = doc(collection(db, FORMULAS_COLLECTION));

  // Generate keywords from code and name
  const keywords = [
    input.code.toLowerCase(),
    ...input.name.toLowerCase().split(' '),
    input.category.toLowerCase(),
  ];

  const formula: Omit<StandardFormula, 'id'> = {
    code: input.code,
    name: input.name,
    description: input.description,
    category: input.category,
    subcategory: input.subcategory || '',
    outputUnit: input.outputUnit,
    components: input.components,
    keywords,
    usageCount: 0,
    isActive: true,
    createdAt: serverTimestamp() as any,
    createdBy: userId,
    updatedAt: serverTimestamp() as any,
    updatedBy: userId,
  };

  await setDoc(formulaRef, formula);
  return formulaRef.id;
}

// UPDATE
export async function updateFormula(
  formulaId: string,
  updates: Partial<CreateFormulaInput>,
  userId: string
): Promise<void> {
  const updateData: any = {
    ...Object.fromEntries(Object.entries(updates).filter(([, v]) => v !== undefined)),
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  };

  // Regenerate keywords if code or name changed
  if (updates.code || updates.name || updates.category) {
    const formula = await getFormulaById(formulaId);
    if (formula) {
      const keywords = [
        (updates.code || formula.code).toLowerCase(),
        ...(updates.name || formula.name).toLowerCase().split(' '),
        (updates.category || formula.category).toLowerCase(),
      ];
      updateData.keywords = keywords;
    }
  }

  await updateDoc(doc(db, FORMULAS_COLLECTION, formulaId), updateData);
}

// DELETE (soft delete)
export async function deleteFormula(formulaId: string, userId: string): Promise<void> {
  await updateDoc(doc(db, FORMULAS_COLLECTION, formulaId), {
    isActive: false,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

// HARD DELETE (use with caution)
export async function permanentlyDeleteFormula(formulaId: string): Promise<void> {
  await deleteDoc(doc(db, FORMULAS_COLLECTION, formulaId));
}

// SEED STANDARD FORMULAS
/**
 * Seed the formula library with standard construction formulas
 * based on AAQS Standard Method of Measuring Building Work for Africa 2015.
 * Uses the Firestore-managed formula library (formulas.json → formulaLibraryService).
 * Skips formulas that already exist (add_only mode).
 */
export async function seedStandardFormulas(userId: string): Promise<{ created: number; skipped: number }> {
  const { importFromJSON } = await import('../data/formulaLibraryService');
  const formulaData = await import('../data/formulas.json');

  const result = await importFromJSON(JSON.stringify(formulaData), 'add_only', userId);

  return { created: result.created, skipped: result.skipped };
}
