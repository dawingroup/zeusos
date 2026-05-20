/**
 * PDD Service — CRUD for the productDefinitions Firestore collection
 *
 * Manages Product Definition Documents: the central data structure
 * of the design-to-production pipeline.
 */
import {
  collection, doc, getDoc, getDocs, addDoc, updateDoc,
  query, where, orderBy, serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/firebase/config';
import type { ProductDefinitionDocument } from '../types/productDefinition.types';
import type { PddStatus, ProductType } from '../constants/productDefinition.constants';
import { PDD_STATUS_TRANSITIONS } from '../constants/productDefinition.constants';
import { createPddSchema, updatePddSchema, type CreatePddInput, type UpdatePddInput } from '../schemas/productDefinition.schemas';

const COLLECTION = 'productDefinitions';

/**
 * List PDDs, optionally filtered by productType and/or status.
 */
export async function listPDDs(filters?: {
  productType?: ProductType;
  status?: PddStatus;
}): Promise<ProductDefinitionDocument[]> {
  const constraints = [];
  if (filters?.productType) constraints.push(where('productType', '==', filters.productType));
  if (filters?.status) constraints.push(where('status', '==', filters.status));
  constraints.push(orderBy('updatedAt', 'desc'));

  const q = query(collection(db, COLLECTION), ...constraints);
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductDefinitionDocument));
}

/**
 * Get a single PDD by ID.
 */
export async function getPDD(pddId: string): Promise<ProductDefinitionDocument | null> {
  const snap = await getDoc(doc(db, COLLECTION, pddId));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as ProductDefinitionDocument;
}

/**
 * Create a new PDD. Validates input with Zod schema.
 */
export async function createPDD(data: CreatePddInput): Promise<string> {
  const validated = createPddSchema.parse(data);
  const docRef = await addDoc(collection(db, COLLECTION), {
    ...validated,
    status: 'draft' as PddStatus,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Update an existing PDD. Validates status transitions.
 */
export async function updatePDD(
  pddId: string,
  updates: UpdatePddInput,
): Promise<void> {
  const validated = updatePddSchema.parse(updates);

  // Validate status transition if status is being changed
  if (validated.status) {
    const current = await getPDD(pddId);
    if (!current) throw new Error(`PDD ${pddId} not found`);
    const allowed = PDD_STATUS_TRANSITIONS[current.status];
    if (!allowed.includes(validated.status)) {
      throw new Error(
        `Invalid status transition: ${current.status} → ${validated.status}. Allowed: ${allowed.join(', ')}`
      );
    }
  }

  await updateDoc(doc(db, COLLECTION, pddId), {
    ...validated,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Get all PDDs for a specific product category.
 */
export async function getPDDsForCategory(
  category: 'seating' | 'casegoods' | 'tables' | 'beds' | 'fitout' | 'custom',
): Promise<ProductDefinitionDocument[]> {
  const q = query(
    collection(db, COLLECTION),
    where('category', '==', category),
    where('status', '==', 'active'),
    orderBy('name'),
  );
  const snap = await getDocs(q);
  return snap.docs.map(d => ({ id: d.id, ...d.data() } as ProductDefinitionDocument));
}

/**
 * Clone an existing PDD as a new draft.
 */
export async function clonePDD(sourcePddId: string, newName?: string): Promise<string> {
  const source = await getPDD(sourcePddId);
  if (!source) throw new Error(`PDD ${sourcePddId} not found`);

  const { id, createdAt, updatedAt, ...rest } = source;
  const cloneData = {
    ...rest,
    name: newName || `${source.name} (Copy)`,
    status: 'draft' as PddStatus,
  };

  const docRef = await addDoc(collection(db, COLLECTION), {
    ...cloneData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * Initialize a partial PDD from a DKB ProductArchetypeEntry.
 * Used when creating a new PDD from the archetype selector.
 */
export async function initializeFromArchetype(
  archetypeId: string,
): Promise<Partial<ProductDefinitionDocument>> {
  // Fetch archetype from DKB — import dynamically to avoid circular dependency
  const { getEntry } = await import('./knowledgeBase.service');
  const archetype = await getEntry(archetypeId);
  if (!archetype || archetype.entryType !== 'product_archetype') {
    throw new Error(`Archetype ${archetypeId} not found or invalid type`);
  }

  const arch = archetype as import('../types/knowledgeBase.types').ProductArchetypeEntry;

  // Map archetype to partial PDD
  return {
    productType: arch.productType,
    dkbArchetypeId: archetypeId,
    parameters: [
      {
        key: 'width',
        label: 'Width',
        type: 'number',
        default: arch.standardDimensions.width.default,
        min: arch.standardDimensions.width.min,
        max: arch.standardDimensions.width.max,
        step: arch.standardDimensions.width.step,
        unit: 'mm',
        affectsBom: true,
      },
      {
        key: 'depth',
        label: 'Depth',
        type: 'number',
        default: arch.standardDimensions.depth.default,
        min: arch.standardDimensions.depth.min,
        max: arch.standardDimensions.depth.max,
        step: arch.standardDimensions.depth.step,
        unit: 'mm',
        affectsBom: true,
      },
      {
        key: 'height',
        label: 'Height',
        type: 'number',
        default: arch.standardDimensions.height.default,
        min: arch.standardDimensions.height.min,
        max: arch.standardDimensions.height.max,
        step: arch.standardDimensions.height.step,
        unit: 'mm',
        affectsBom: true,
      },
    ],
    bomTemplate: arch.bomEstimate.map(est => ({
      materialCategory: est.materialCategory,
      quantityExpression: est.quantityExpression,
      unit: est.unit,
      isVariantDriven: true,
    })),
    constraints: arch.constraints || [],
  };
}
