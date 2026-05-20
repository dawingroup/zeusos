/**
 * Material Service
 * Three-tier material library: Global → Customer → Project
 */

import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  serverTimestamp,
  Timestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type {
  Material,
  MaterialFormData,
  MaterialListItem,
  ResolvedMaterial,
  MaterialTier,
  MaterialCategory,
} from '../types/materials';
import { stampMaterialCostOverride } from '../types/materialCost';
import { assertMaterialTierInvariant } from '../utils/materialTierInvariants';

/**
 * Collection references
 */
const globalMaterialsRef = collection(db, 'materials');

function getCustomerMaterialsRef(customerId: string) {
  return collection(db, 'customers', customerId, 'materials');
}

function getProjectMaterialsRef(projectId: string) {
  return collection(db, 'designProjects', projectId, 'materials');
}

/**
 * Generate a material code
 */
export function generateMaterialCode(name: string, category: MaterialCategory): string {
  const categoryPrefix: Record<MaterialCategory, string> = {
    'sheet-goods': 'SHT',
    'solid-wood': 'WOD',
    'hardware': 'HDW',
    'edge-banding': 'EDG',
    'finishing': 'FIN',
    'glass': 'GLS',
    'metal': 'MTL',
    'fabric-upholstery': 'FAB',
    'stone-composite': 'STN',
    'other': 'OTH',
  };
  
  const prefix = categoryPrefix[category];
  const namePart = name
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '')
    .substring(0, 6);
  const randomPart = Math.random().toString(36).substring(2, 5).toUpperCase();
  
  return `${prefix}-${namePart}-${randomPart}`;
}

/**
 * Subscribe to global materials
 */
export function subscribeToGlobalMaterials(
  callback: (materials: MaterialListItem[]) => void,
  onError?: (error: Error) => void,
  options?: { category?: MaterialCategory; status?: 'active' | 'discontinued' | 'out-of-stock' }
): () => void {
  const q = query(globalMaterialsRef);
  
  return onSnapshot(
    q,
    (snapshot) => {
      let materials = snapshot.docs.map((doc) => ({
        id: doc.id,
        code: doc.data().code || '',
        name: doc.data().name || '',
        category: doc.data().category || 'other',
        subcategory: doc.data().subcategory,
        tier: 'global' as MaterialTier,
        thickness: doc.data().dimensions?.thickness,
        unitCost: doc.data().pricing?.unitCost,
        currency: doc.data().pricing?.currency,
        // P12-4 (F11) — surface override flag + inventory link on the
        // list item so MaterialList can resolve canonical cost + detect
        // drift per row without re-fetching the full Material doc.
        isOverride: doc.data().pricing?.isOverride,
        inventoryItemId: doc.data().inventoryItemId,
        status: doc.data().status || 'active',
      })) as MaterialListItem[];
      
      // Client-side filtering
      if (options?.category) {
        materials = materials.filter(m => m.category === options.category);
      }
      if (options?.status) {
        materials = materials.filter(m => m.status === options.status);
      }
      
      materials.sort((a, b) => a.name.localeCompare(b.name));
      callback(materials);
    },
    (error) => {
      console.error('Material subscription error:', error);
      onError?.(error);
    }
  );
}

/**
 * Subscribe to customer materials
 */
export function subscribeToCustomerMaterials(
  customerId: string,
  callback: (materials: MaterialListItem[]) => void,
  onError?: (error: Error) => void
): () => void {
  const ref = getCustomerMaterialsRef(customerId);
  
  return onSnapshot(
    ref,
    (snapshot) => {
      const materials = snapshot.docs.map((doc) => ({
        id: doc.id,
        code: doc.data().code || '',
        name: doc.data().name || '',
        category: doc.data().category || 'other',
        tier: 'customer' as MaterialTier,
        thickness: doc.data().dimensions?.thickness,
        unitCost: doc.data().pricing?.unitCost,
        currency: doc.data().pricing?.currency,
        // P12-4 (F11) — surface override flag + inventory link on the
        // list item so MaterialList can resolve canonical cost + detect
        // drift per row without re-fetching the full Material doc.
        isOverride: doc.data().pricing?.isOverride,
        inventoryItemId: doc.data().inventoryItemId,
        status: doc.data().status || 'active',
      })) as MaterialListItem[];
      
      materials.sort((a, b) => a.name.localeCompare(b.name));
      callback(materials);
    },
    (error) => {
      console.error('Customer materials subscription error:', error);
      onError?.(error);
    }
  );
}

/**
 * Subscribe to project materials
 */
export function subscribeToProjectMaterials(
  projectId: string,
  callback: (materials: MaterialListItem[]) => void,
  onError?: (error: Error) => void
): () => void {
  const ref = getProjectMaterialsRef(projectId);
  
  return onSnapshot(
    ref,
    (snapshot) => {
      const materials = snapshot.docs.map((doc) => ({
        id: doc.id,
        code: doc.data().code || '',
        name: doc.data().name || '',
        category: doc.data().category || 'other',
        tier: 'project' as MaterialTier,
        thickness: doc.data().dimensions?.thickness,
        unitCost: doc.data().pricing?.unitCost,
        currency: doc.data().pricing?.currency,
        // P12-4 (F11) — surface override flag + inventory link on the
        // list item so MaterialList can resolve canonical cost + detect
        // drift per row without re-fetching the full Material doc.
        isOverride: doc.data().pricing?.isOverride,
        inventoryItemId: doc.data().inventoryItemId,
        status: doc.data().status || 'active',
      })) as MaterialListItem[];
      
      materials.sort((a, b) => a.name.localeCompare(b.name));
      callback(materials);
    },
    (error) => {
      console.error('Project materials subscription error:', error);
      onError?.(error);
    }
  );
}

/**
 * Get material by ID
 */
export async function getMaterial(
  materialId: string,
  tier: MaterialTier,
  scopeId?: string // customerId or projectId
): Promise<Material | null> {
  let docRef;
  
  switch (tier) {
    case 'global':
      docRef = doc(globalMaterialsRef, materialId);
      break;
    case 'customer':
      if (!scopeId) throw new Error('customerId required for customer materials');
      docRef = doc(getCustomerMaterialsRef(scopeId), materialId);
      break;
    case 'project':
      if (!scopeId) throw new Error('projectId required for project materials');
      docRef = doc(getProjectMaterialsRef(scopeId), materialId);
      break;
  }
  
  const snapshot = await getDoc(docRef);
  if (snapshot.exists()) {
    return { id: snapshot.id, ...snapshot.data() } as Material;
  }
  return null;
}

/**
 * Get all materials for a project (merged from all tiers)
 * Resolution order: Project > Customer > Global
 */
export async function getMaterialsForProject(
  projectId: string,
  customerId?: string
): Promise<ResolvedMaterial[]> {
  const materialMap = new Map<string, ResolvedMaterial>();
  
  // 1. Load global materials
  const globalSnapshot = await getDocs(query(globalMaterialsRef, where('status', '==', 'active')));
  globalSnapshot.forEach((doc) => {
    const material = { id: doc.id, ...doc.data() } as Material;
    materialMap.set(material.code, {
      ...material,
      resolvedFrom: 'global',
    });
  });
  
  // 2. Load customer materials (override globals)
  if (customerId) {
    const customerRef = getCustomerMaterialsRef(customerId);
    const customerSnapshot = await getDocs(customerRef);
    customerSnapshot.forEach((doc) => {
      const material = { id: doc.id, ...doc.data() } as Material;
      materialMap.set(material.code, {
        ...material,
        resolvedFrom: 'customer',
      });
    });
  }
  
  // 3. Load project materials (override customer/global)
  const projectRef = getProjectMaterialsRef(projectId);
  const projectSnapshot = await getDocs(projectRef);
  projectSnapshot.forEach((doc) => {
    const material = { id: doc.id, ...doc.data() } as Material;
    materialMap.set(material.code, {
      ...material,
      resolvedFrom: 'project',
    });
  });
  
  // Convert to array and sort
  return Array.from(materialMap.values()).sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Create a global material (admin only)
 */
export async function createGlobalMaterial(
  data: MaterialFormData,
  userId: string
): Promise<string> {
  // P19/F20 — global materials are the root of the tier hierarchy and
  // MUST NOT carry `parentMaterialId`. The form-data type technically
  // allows it so we assert here at the write boundary.
  assertMaterialTierInvariant('global', (data as { parentMaterialId?: string }).parentMaterialId);

  // Strip undefined values — Firestore rejects them
  const doc: Record<string, unknown> = {
    code: data.code,
    name: data.name,
    description: data.description,
    category: data.category,
    status: data.status,
    tier: 'global',
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  };
  if (data.subcategory) doc.subcategory = data.subcategory;
  if (data.grainPattern) doc.grainPattern = data.grainPattern;
  if (data.dimensions) doc.dimensions = data.dimensions;
  if (data.pricing) {
    doc.pricing = { ...data.pricing, lastUpdated: serverTimestamp() };
  }
  if (data.useCases?.length) doc.useCases = data.useCases;
  if (data.functionalUse) doc.functionalUse = data.functionalUse;
  if (data.applicationAreas?.length) doc.applicationAreas = data.applicationAreas;
  if (data.preferredSupplier) doc.preferredSupplier = data.preferredSupplier;
  if (data.alternateSuppliers?.length) doc.alternateSuppliers = data.alternateSuppliers;
  if (data.properties && Object.values(data.properties).some(v => v != null)) doc.properties = data.properties;
  if (data.images?.length) doc.images = data.images;
  if (data.datasheetUrl) doc.datasheetUrl = data.datasheetUrl;

  const docRef = await addDoc(globalMaterialsRef, doc);

  return docRef.id;
}

/**
 * Create a customer material
 */
export async function createCustomerMaterial(
  customerId: string,
  data: MaterialFormData,
  userId: string
): Promise<string> {
  // P19/F20 — customer materials MAY override a global (parent set) or
  // be standalone customer-specifics (parent undefined). We only assert
  // the self-parent guard here; the permissive branch of the invariant
  // accepts both cases.
  assertMaterialTierInvariant('customer', (data as { parentMaterialId?: string }).parentMaterialId);

  const ref = getCustomerMaterialsRef(customerId);
  const docRef = await addDoc(ref, {
    ...data,
    tier: 'customer',
    pricing: data.pricing ? {
      ...data.pricing,
      lastUpdated: serverTimestamp(),
    } : undefined,
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
  
  return docRef.id;
}

/**
 * Create a project material (override)
 */
export async function createProjectMaterial(
  projectId: string,
  data: MaterialFormData,
  userId: string,
  parentMaterialId?: string,
  options: { strict?: boolean } = {}
): Promise<string> {
  // P19/F20 — project materials are always meant to be overrides of a
  // higher-tier (global or customer) material. Passing `strict: true`
  // makes that invariant a hard rejection; the default soft path logs
  // a warning so existing legacy callers (batch-save flows in
  // `useMaterials` + `saveMaterial`) keep working while the gap is
  // visible and fixable on its own cadence.
  if (options.strict) {
    assertMaterialTierInvariant('project', parentMaterialId);
  } else if (!parentMaterialId) {
    console.warn(
      '[materialService] createProjectMaterial: project-tier material created with no parentMaterialId — ' +
        'this is allowed for backward compatibility but should be a customer or global material. ' +
        `projectId=${projectId} code=${data.code}`,
    );
  } else {
    // Even in soft mode, self-parent is a clear bug — catch it.
    assertMaterialTierInvariant('project', parentMaterialId);
  }

  const ref = getProjectMaterialsRef(projectId);
  const docRef = await addDoc(ref, {
    ...data,
    tier: 'project',
    parentMaterialId,
    pricing: data.pricing ? {
      ...data.pricing,
      lastUpdated: serverTimestamp(),
    } : undefined,
    createdAt: serverTimestamp(),
    createdBy: userId,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
  
  return docRef.id;
}

/**
 * Update a material
 */
export async function updateMaterial(
  materialId: string,
  tier: MaterialTier,
  scopeId: string | undefined,
  data: Partial<MaterialFormData>,
  userId: string
): Promise<void> {
  let docRef;
  
  switch (tier) {
    case 'global':
      docRef = doc(globalMaterialsRef, materialId);
      break;
    case 'customer':
      if (!scopeId) throw new Error('customerId required');
      docRef = doc(getCustomerMaterialsRef(scopeId), materialId);
      break;
    case 'project':
      if (!scopeId) throw new Error('projectId required');
      docRef = doc(getProjectMaterialsRef(scopeId), materialId);
      break;
  }
  
  // Strip undefined values — Firestore rejects them
  const cleanData: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (value === undefined) continue;
    // Strip undefined values from nested objects (e.g. properties)
    if (value && typeof value === 'object' && !Array.isArray(value)) {
      const cleaned: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        if (v !== undefined) cleaned[k] = v;
      }
      if (Object.keys(cleaned).length > 0) cleanData[key] = cleaned;
    } else {
      cleanData[key] = value;
    }
  }

  const updateData: Record<string, any> = {
    ...cleanData,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  };

  if (cleanData.pricing) {
    // P12-6: stamp override audit metadata. We need the previous
    // pricing.isOverride to decide stamp vs. preserve vs. clear, so
    // read the doc first. One extra read per material save is cheap
    // compared to getting the audit wrong.
    const prevSnap = await getDoc(docRef);
    const prevPricing = (prevSnap.data()?.pricing ?? null) as
      | { isOverride?: boolean; overrideAt?: unknown; overrideBy?: string }
      | null;
    const stamped = stampMaterialCostOverride(
      cleanData.pricing,
      prevPricing,
      userId,
      serverTimestamp(),
    );
    // Replace undefineds produced by the "clear" path with deleteField()
    // so Firestore actually drops the keys (undefined is rejected).
    const pricingForWrite: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(stamped)) {
      pricingForWrite[k] = v === undefined ? deleteField() : v;
    }
    pricingForWrite.lastUpdated = serverTimestamp();
    updateData.pricing = pricingForWrite;
  }

  await updateDoc(docRef, updateData);
}

/**
 * Delete a material
 */
export async function deleteMaterial(
  materialId: string,
  tier: MaterialTier,
  scopeId?: string
): Promise<void> {
  let docRef;
  
  switch (tier) {
    case 'global':
      docRef = doc(globalMaterialsRef, materialId);
      break;
    case 'customer':
      if (!scopeId) throw new Error('customerId required');
      docRef = doc(getCustomerMaterialsRef(scopeId), materialId);
      break;
    case 'project':
      if (!scopeId) throw new Error('projectId required');
      docRef = doc(getProjectMaterialsRef(scopeId), materialId);
      break;
  }
  
  await deleteDoc(docRef);
}

/**
 * Link material to a part (update part.materialId)
 */
export async function linkMaterialToPart(
  projectId: string,
  itemId: string,
  partId: string,
  materialId: string,
  materialCode: string,
  materialName: string,
  currentParts: any[],
  userId: string
): Promise<void> {
  const docRef = doc(db, 'designProjects', projectId, 'designItems', itemId);
  
  const updatedParts = currentParts.map((part) =>
    part.id === partId
      ? { ...part, materialId, materialCode, materialName, updatedAt: Timestamp.now() }
      : part
  );
  
  await updateDoc(docRef, {
    parts: updatedParts,
    updatedAt: serverTimestamp(),
    updatedBy: userId,
  });
}

/**
 * Import materials from CSV data
 */
export async function importMaterialsFromCSV(
  tier: MaterialTier,
  scopeId: string | undefined,
  materials: MaterialFormData[],
  userId: string
): Promise<{ imported: number; errors: string[] }> {
  const errors: string[] = [];
  let imported = 0;
  
  for (const material of materials) {
    try {
      switch (tier) {
        case 'global':
          await createGlobalMaterial(material, userId);
          break;
        case 'customer':
          if (!scopeId) throw new Error('customerId required');
          await createCustomerMaterial(scopeId, material, userId);
          break;
        case 'project':
          if (!scopeId) throw new Error('projectId required');
          await createProjectMaterial(scopeId, material, userId);
          break;
      }
      imported++;
    } catch (error) {
      errors.push(`Failed to import "${material.name}": ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
  
  return { imported, errors };
}
