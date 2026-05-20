/**
 * Finish Library Service
 * CRUD operations for the finishLibrary collection.
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  getDoc,
  getDocs,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  type Unsubscribe,
  type QueryConstraint,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { Timestamp } from 'firebase/firestore';
import type { FinishDocument, FinishCategory, FinishAvailability } from '../types';

const COLLECTION_NAME = 'finishLibrary';
const finishRef = collection(db, COLLECTION_NAME);

/**
 * Strip undefined values before Firestore writes.
 */
function stripUndefined<T extends Record<string, unknown>>(obj: T): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    if (value !== null && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Timestamp)) {
      const proto = Object.getPrototypeOf(value);
      if (proto === Object.prototype || proto === null) {
        result[key] = stripUndefined(value as Record<string, unknown>);
        continue;
      }
    }
    result[key] = value;
  }
  return result as T;
}

// ============================================
// CRUD Operations
// ============================================

/**
 * Create a new finish document.
 */
export async function createFinish(
  data: Omit<FinishDocument, 'id' | 'createdAt' | 'updatedAt'>,
  userId: string
): Promise<string> {
  const docData = stripUndefined({
    ...data,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
    createdBy: userId,
    updatedBy: userId,
  });
  const docRef = await addDoc(finishRef, docData);
  return docRef.id;
}

/**
 * Update an existing finish document.
 */
export async function updateFinish(
  finishId: string,
  updates: Partial<FinishDocument>,
  userId: string
): Promise<void> {
  const ref = doc(db, COLLECTION_NAME, finishId);
  const docData = stripUndefined({
    ...updates,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
  // Remove fields that shouldn't be overwritten
  delete (docData as Record<string, unknown>).id;
  delete (docData as Record<string, unknown>).createdAt;
  delete (docData as Record<string, unknown>).createdBy;
  await updateDoc(ref, docData);
}

/**
 * Get a single finish by ID.
 */
export async function getFinish(finishId: string): Promise<FinishDocument | null> {
  const ref = doc(db, COLLECTION_NAME, finishId);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as FinishDocument;
}

/**
 * Get finishes with optional filters.
 */
export async function getFinishes(options?: {
  organizationId?: string;
  category?: FinishCategory;
  availability?: FinishAvailability;
  isActive?: boolean;
}): Promise<FinishDocument[]> {
  const constraints: QueryConstraint[] = [];

  if (options?.organizationId) {
    constraints.push(where('organizationId', '==', options.organizationId));
  }
  if (options?.category) {
    constraints.push(where('category', '==', options.category));
  }
  if (options?.availability) {
    constraints.push(where('availability', '==', options.availability));
  }
  if (options?.isActive !== undefined) {
    constraints.push(where('isActive', '==', options.isActive));
  }

  constraints.push(orderBy('name'));

  const q = query(finishRef, ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as FinishDocument));
}

/**
 * Subscribe to finishes with optional filters (real-time).
 */
export function subscribeToFinishes(
  callback: (finishes: FinishDocument[]) => void,
  options?: {
    organizationId?: string;
    category?: FinishCategory;
    isActive?: boolean;
  }
): Unsubscribe {
  const constraints: QueryConstraint[] = [];

  if (options?.organizationId) {
    constraints.push(where('organizationId', '==', options.organizationId));
  }
  if (options?.category) {
    constraints.push(where('category', '==', options.category));
  }
  if (options?.isActive !== undefined) {
    constraints.push(where('isActive', '==', options.isActive));
  }

  constraints.push(orderBy('name'));

  const q = query(finishRef, ...constraints);
  return onSnapshot(q, (snap) => {
    const finishes = snap.docs.map(d => ({ id: d.id, ...d.data() } as FinishDocument));
    callback(finishes);
  });
}

/**
 * Search finishes by name, code, or tags (client-side filtering).
 */
export async function searchFinishes(
  searchTerm: string,
  options?: {
    organizationId?: string;
    category?: FinishCategory;
  }
): Promise<FinishDocument[]> {
  // Fetch all active finishes for the category, then filter client-side
  const all = await getFinishes({
    ...options,
    isActive: true,
  });

  if (!searchTerm.trim()) return all;

  const term = searchTerm.toLowerCase();
  return all.filter(f =>
    f.name.toLowerCase().includes(term) ||
    f.code.toLowerCase().includes(term) ||
    f.tags?.some(t => t.toLowerCase().includes(term))
  );
}

/**
 * Archive a finish (soft delete via isActive: false).
 */
export async function archiveFinish(finishId: string, userId: string): Promise<void> {
  await updateFinish(finishId, { isActive: false }, userId);
}

/**
 * Bulk import finishes from parsed data.
 * Returns array of created IDs.
 */
export async function importFinishes(
  finishes: Omit<FinishDocument, 'id' | 'createdAt' | 'updatedAt'>[],
  userId: string
): Promise<string[]> {
  const ids: string[] = [];
  for (const finish of finishes) {
    const id = await createFinish(finish, userId);
    ids.push(id);
  }
  return ids;
}

// ============================================
// Seed Default Finishes
// ============================================

interface FinishSeed {
  name: string;
  code: string;
  category: FinishCategory;
  subtype: string;
  hexColor?: string;
  secondaryColor?: string;
  patternType?: 'solid' | 'woodgrain' | 'marble' | 'textile' | 'geometric' | 'speckled' | 'custom';
  availability: FinishAvailability;
  tags: string[];
}

const DEFAULT_FINISH_SEEDS: FinishSeed[] = [
  // ── Boards (Melamine) ──
  { name: 'White Melamine', code: 'BRD-MEL-WHT', category: 'board', subtype: 'melamine', hexColor: '#FFFFFF', patternType: 'solid', availability: 'in_stock', tags: ['white', 'melamine', 'standard'] },
  { name: 'Black Melamine', code: 'BRD-MEL-BLK', category: 'board', subtype: 'melamine', hexColor: '#1A1A1A', patternType: 'solid', availability: 'in_stock', tags: ['black', 'melamine', 'standard'] },
  { name: 'Light Oak Melamine', code: 'BRD-MEL-LOK', category: 'board', subtype: 'melamine', hexColor: '#C4A265', secondaryColor: '#8B6914', patternType: 'woodgrain', availability: 'in_stock', tags: ['oak', 'melamine', 'woodgrain'] },
  { name: 'Walnut Melamine', code: 'BRD-MEL-WAL', category: 'board', subtype: 'melamine', hexColor: '#5C3317', secondaryColor: '#3B1F0B', patternType: 'woodgrain', availability: 'in_stock', tags: ['walnut', 'melamine', 'woodgrain'] },
  { name: 'Grey Melamine', code: 'BRD-MEL-GRY', category: 'board', subtype: 'melamine', hexColor: '#9E9E9E', patternType: 'solid', availability: 'in_stock', tags: ['grey', 'melamine', 'standard'] },
  { name: 'Beech Melamine', code: 'BRD-MEL-BCH', category: 'board', subtype: 'melamine', hexColor: '#D4A56A', secondaryColor: '#B8860B', patternType: 'woodgrain', availability: 'in_stock', tags: ['beech', 'melamine', 'woodgrain'] },

  // ── Boards (MDF / Plywood) ──
  { name: 'Raw MDF', code: 'BRD-MDF-RAW', category: 'board', subtype: 'mdf', hexColor: '#C8A882', patternType: 'solid', availability: 'in_stock', tags: ['mdf', 'raw', 'unfinished'] },
  { name: 'Moisture Resistant MDF', code: 'BRD-MDF-MR', category: 'board', subtype: 'mdf', hexColor: '#7DB87D', patternType: 'solid', availability: 'in_stock', tags: ['mdf', 'moisture-resistant', 'green'] },
  { name: 'Marine Plywood', code: 'BRD-PLY-MRN', category: 'board', subtype: 'plywood', hexColor: '#B8956A', patternType: 'woodgrain', availability: 'in_stock', tags: ['plywood', 'marine', 'exterior'] },
  { name: 'Birch Plywood', code: 'BRD-PLY-BIR', category: 'board', subtype: 'plywood', hexColor: '#E8D5B5', patternType: 'woodgrain', availability: 'in_stock', tags: ['plywood', 'birch', 'premium'] },

  // ── Paints ──
  { name: 'Brilliant White Emulsion', code: 'PNT-EMU-WHT', category: 'paint', subtype: 'emulsion', hexColor: '#FAFAFA', patternType: 'solid', availability: 'in_stock', tags: ['white', 'emulsion', 'interior'] },
  { name: 'Ivory Emulsion', code: 'PNT-EMU-IVR', category: 'paint', subtype: 'emulsion', hexColor: '#FFFFF0', patternType: 'solid', availability: 'in_stock', tags: ['ivory', 'emulsion', 'interior'] },
  { name: 'Charcoal Matt', code: 'PNT-MAT-CHA', category: 'paint', subtype: 'matte', hexColor: '#36454F', patternType: 'solid', availability: 'in_stock', tags: ['charcoal', 'matte', 'interior'] },
  { name: 'Navy Blue Gloss', code: 'PNT-GLO-NAV', category: 'paint', subtype: 'gloss', hexColor: '#000080', patternType: 'solid', availability: 'in_stock', tags: ['navy', 'blue', 'gloss'] },
  { name: 'Forest Green Satin', code: 'PNT-SAT-FGR', category: 'paint', subtype: 'satin', hexColor: '#228B22', patternType: 'solid', availability: 'in_stock', tags: ['green', 'satin', 'interior'] },
  { name: 'Clear Lacquer', code: 'PNT-LAC-CLR', category: 'paint', subtype: 'lacquer', hexColor: '#F5F5DC', patternType: 'solid', availability: 'in_stock', tags: ['lacquer', 'clear', 'topcoat'] },
  { name: 'Dark Walnut Stain', code: 'PNT-STN-DWL', category: 'paint', subtype: 'stain', hexColor: '#4A2C0A', patternType: 'solid', availability: 'in_stock', tags: ['stain', 'walnut', 'wood'] },
  { name: 'White Primer', code: 'PNT-PRM-WHT', category: 'paint', subtype: 'primer', hexColor: '#F0F0F0', patternType: 'solid', availability: 'in_stock', tags: ['primer', 'white', 'prep'] },

  // ── Tiles ──
  { name: 'White Ceramic 300x300', code: 'TIL-CER-WHT', category: 'tile', subtype: 'ceramic', hexColor: '#F8F8FF', patternType: 'solid', availability: 'in_stock', tags: ['white', 'ceramic', '300x300'] },
  { name: 'Grey Porcelain 600x600', code: 'TIL-POR-GRY', category: 'tile', subtype: 'porcelain', hexColor: '#808080', patternType: 'solid', availability: 'in_stock', tags: ['grey', 'porcelain', '600x600'] },
  { name: 'Carrara Marble Effect', code: 'TIL-POR-CAR', category: 'tile', subtype: 'porcelain', hexColor: '#F0EDE8', secondaryColor: '#C0C0C0', patternType: 'marble', availability: 'in_stock', tags: ['marble', 'porcelain', 'premium'] },
  { name: 'Terracotta Floor', code: 'TIL-CER-TER', category: 'tile', subtype: 'ceramic', hexColor: '#CC4E00', patternType: 'solid', availability: 'in_stock', tags: ['terracotta', 'ceramic', 'floor'] },
  { name: 'White Mosaic Sheet', code: 'TIL-MOS-WHT', category: 'tile', subtype: 'mosaic', hexColor: '#FFFFFF', patternType: 'geometric', availability: 'made_to_order', tags: ['mosaic', 'white', 'sheet'] },

  // ── Laminates ──
  { name: 'HPL White Gloss', code: 'LAM-HPL-WGL', category: 'laminate', subtype: 'high_pressure', hexColor: '#FFFFFF', patternType: 'solid', availability: 'in_stock', tags: ['hpl', 'white', 'gloss'] },
  { name: 'HPL Concrete Effect', code: 'LAM-HPL-CON', category: 'laminate', subtype: 'high_pressure', hexColor: '#A9A9A9', patternType: 'speckled', availability: 'in_stock', tags: ['hpl', 'concrete', 'industrial'] },

  // ── Metal ──
  { name: 'Brushed Stainless Steel', code: 'MET-SS-BRS', category: 'metal', subtype: 'stainless_steel', hexColor: '#C0C0C0', patternType: 'solid', availability: 'in_stock', tags: ['stainless', 'brushed', 'metal'] },
  { name: 'Powder Coat Black', code: 'MET-PC-BLK', category: 'metal', subtype: 'powder_coat', hexColor: '#0A0A0A', patternType: 'solid', availability: 'in_stock', tags: ['powder-coat', 'black', 'metal'] },

  // ── Glass ──
  { name: 'Clear Float Glass', code: 'GLS-FLT-CLR', category: 'glass', subtype: 'float', hexColor: '#E0F7FA', patternType: 'solid', availability: 'in_stock', tags: ['glass', 'clear', 'float'] },
  { name: 'Frosted Glass', code: 'GLS-FRS-WHT', category: 'glass', subtype: 'frosted', hexColor: '#F5F5F5', patternType: 'solid', availability: 'in_stock', tags: ['glass', 'frosted', 'privacy'] },
];

/**
 * Seed default finishes (idempotent — checks by code before creating).
 * Returns count of created and skipped.
 */
export async function seedDefaultFinishes(
  organizationId: string,
  userId: string
): Promise<{ created: number; skipped: number }> {
  // Fetch existing finishes by code to avoid duplicates
  const existing = await getFinishes({ organizationId });
  const existingCodes = new Set(existing.map(f => f.code));

  let created = 0;
  let skipped = 0;

  for (const seed of DEFAULT_FINISH_SEEDS) {
    if (existingCodes.has(seed.code)) {
      skipped++;
      continue;
    }

    await createFinish(
      {
        ...seed,
        organizationId,
        isActive: true,
      } as Omit<FinishDocument, 'id' | 'createdAt' | 'updatedAt'>,
      userId
    );
    created++;
  }

  return { created, skipped };
}

/**
 * Export finishes as plain objects (for CSV/JSON export).
 */
export async function exportFinishes(options?: {
  organizationId?: string;
  category?: FinishCategory;
}): Promise<Omit<FinishDocument, 'createdAt' | 'updatedAt'>[]> {
  const finishes = await getFinishes({ ...options, isActive: true });
  return finishes.map(({ createdAt, updatedAt, ...rest }) => rest);
}
