/**
 * Offcut Library Service
 *
 * Manages reusable material remnants from completed production runs.
 * Offcuts are registered after production and consumed by future projects
 * to reduce waste and material costs.
 *
 * Firestore collection: 'offcuts'
 */

import {
  collection,
  doc,
  getDocs,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp as FirestoreTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import type { Offcut, OffcutQuery, OffcutCondition, OffcutStatus, GeneratedOffcut } from '@/shared/types/offcut';
import type { MaterialType, WasteRegion, LinearWasteSegment } from '@/shared/types';

const OFFCUTS_COLLECTION = 'offcuts';

// ============================================
// Query Operations
// ============================================

/**
 * Query the offcut library for available offcuts matching criteria.
 * Returns offcuts sorted by smallest fitting piece first (minimize waste).
 */
export async function queryMatchingOffcuts(
  criteria: OffcutQuery
): Promise<Offcut[]> {
  const offcutsRef = collection(db, OFFCUTS_COLLECTION);

  // Base query: match material type, material name, and status = 'available'
  const q = query(
    offcutsRef,
    where('status', '==', 'available'),
    where('materialType', '==', criteria.materialType),
    where('materialName', '==', criteria.materialName),
    where('length', '>=', criteria.minLength)
  );

  const snapshot = await getDocs(q);
  let offcuts = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Offcut));

  // Additional client-side filtering for dimensions
  offcuts = offcuts.filter(offcut => {
    if (criteria.minWidth && offcut.width < criteria.minWidth) return false;
    if (criteria.minThickness && offcut.thickness < criteria.minThickness) return false;

    // For timber: match cross-section
    if (criteria.crossSection && offcut.crossSection) {
      if (
        offcut.crossSection.thickness < criteria.crossSection.thickness ||
        offcut.crossSection.width < criteria.crossSection.width
      ) {
        return false;
      }
    }

    return offcut.condition !== 'damaged';
  });

  // Sort by length ascending (use smallest fitting offcut first to minimize waste)
  offcuts.sort((a, b) => a.length - b.length);

  return offcuts;
}

/**
 * Query all offcuts for a specific material type.
 * Used by the Offcut Library UI browser.
 */
export async function queryOffcutsByMaterialType(
  materialType?: MaterialType
): Promise<Offcut[]> {
  const offcutsRef = collection(db, OFFCUTS_COLLECTION);

  let q;
  if (materialType) {
    q = query(
      offcutsRef,
      where('materialType', '==', materialType),
      where('status', '==', 'available'),
      orderBy('createdAt', 'desc')
    );
  } else {
    q = query(
      offcutsRef,
      where('status', '==', 'available'),
      orderBy('createdAt', 'desc')
    );
  }

  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Offcut));
}

/**
 * Get summary statistics for the offcut library.
 */
export async function getOffcutStats(): Promise<{
  totalAvailable: number;
  totalValue: number;
  byMaterialType: Record<string, { count: number; value: number }>;
}> {
  const offcuts = await queryOffcutsByMaterialType();

  const byMaterialType: Record<string, { count: number; value: number }> = {};
  let totalValue = 0;

  for (const offcut of offcuts) {
    totalValue += offcut.originalCostAllocation;

    if (!byMaterialType[offcut.materialType]) {
      byMaterialType[offcut.materialType] = { count: 0, value: 0 };
    }
    byMaterialType[offcut.materialType].count++;
    byMaterialType[offcut.materialType].value += offcut.originalCostAllocation;
  }

  return {
    totalAvailable: offcuts.length,
    totalValue,
    byMaterialType,
  };
}

/**
 * Get available offcut count and total value for a material by name.
 * Used by inventory detail to show offcut stock alongside regular stock.
 */
export async function getOffcutCountForMaterial(materialName: string): Promise<{
  count: number;
  totalValue: number;
  offcuts: Offcut[];
}> {
  if (!materialName) return { count: 0, totalValue: 0, offcuts: [] };

  const q = query(
    collection(db, OFFCUTS_COLLECTION),
    where('status', '==', 'available'),
    where('materialName', '==', materialName),
  );

  const snap = await getDocs(q);
  const offcuts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Offcut));
  const totalValue = offcuts.reduce((sum, o) => sum + (o.originalCostAllocation || 0), 0);

  return { count: offcuts.length, totalValue, offcuts };
}

/**
 * Real-time subscription to available offcut count for a material.
 * Fires callback whenever offcuts for this material change.
 */
export function subscribeToOffcutCountForMaterial(
  materialName: string,
  callback: (data: { count: number; totalValue: number }) => void,
): () => void {
  if (!materialName) {
    callback({ count: 0, totalValue: 0 });
    return () => {};
  }

  const q = query(
    collection(db, OFFCUTS_COLLECTION),
    where('status', '==', 'available'),
    where('materialName', '==', materialName),
  );

  return onSnapshot(q, (snap) => {
    let totalValue = 0;
    for (const d of snap.docs) {
      totalValue += (d.data().originalCostAllocation as number) || 0;
    }
    callback({ count: snap.size, totalValue });
  });
}

// ============================================
// Reservation & Usage
// ============================================

/**
 * Reserve an offcut for a project.
 * Prevents other projects from using it during optimization.
 */
export async function reserveOffcut(
  offcutId: string,
  projectId: string
): Promise<void> {
  const offcutRef = doc(db, OFFCUTS_COLLECTION, offcutId);
  await updateDoc(offcutRef, {
    status: 'reserved',
    reservedForProjectId: projectId,
    reservedAt: serverTimestamp(),
  });
}

/**
 * Mark an offcut as used by a project (consumed in production).
 */
export async function markOffcutUsed(
  offcutId: string,
  projectId: string
): Promise<void> {
  const offcutRef = doc(db, OFFCUTS_COLLECTION, offcutId);
  await updateDoc(offcutRef, {
    status: 'used',
    usedInProjectId: projectId,
    usedAt: serverTimestamp(),
  });
}

/**
 * Release a single reserved offcut back to available status.
 */
export async function releaseOffcut(offcutId: string): Promise<void> {
  const offcutRef = doc(db, OFFCUTS_COLLECTION, offcutId);
  await updateDoc(offcutRef, {
    status: 'available',
    reservedForProjectId: null,
    reservedAt: null,
  });
}

/**
 * Release reserved offcuts for a project (e.g., if project is cancelled or re-optimized).
 */
export async function releaseReservedOffcuts(
  projectId: string
): Promise<void> {
  const q = query(
    collection(db, OFFCUTS_COLLECTION),
    where('status', '==', 'reserved'),
    where('reservedForProjectId', '==', projectId)
  );

  const snapshot = await getDocs(q);

  const updates = snapshot.docs.map(d =>
    updateDoc(doc(db, OFFCUTS_COLLECTION, d.id), {
      status: 'available',
      reservedForProjectId: null,
      reservedAt: null,
    })
  );

  await Promise.all(updates);
}

/**
 * Scrap an offcut (too small, damaged, etc.).
 */
export async function scrapOffcut(
  offcutId: string,
  reason: string
): Promise<void> {
  const offcutRef = doc(db, OFFCUTS_COLLECTION, offcutId);
  await updateDoc(offcutRef, {
    status: 'scrapped',
    scrappedAt: serverTimestamp(),
    scrappedReason: reason,
  });
}

// ============================================
// Full Library Queries (all statuses)
// ============================================

/**
 * Query all offcuts across all statuses with optional filters.
 * Used by the standalone Offcut Library page.
 */
export async function queryAllOffcuts(filters?: {
  status?: OffcutStatus;
  materialType?: MaterialType;
}): Promise<Offcut[]> {
  const offcutsRef = collection(db, OFFCUTS_COLLECTION);
  const constraints: ReturnType<typeof where>[] = [];

  if (filters?.status) {
    constraints.push(where('status', '==', filters.status));
  }
  if (filters?.materialType) {
    constraints.push(where('materialType', '==', filters.materialType));
  }

  const q = constraints.length > 0
    ? query(offcutsRef, ...constraints, orderBy('createdAt', 'desc'))
    : query(offcutsRef, orderBy('createdAt', 'desc'));

  const snapshot = await getDocs(q);
  return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Offcut));
}

/**
 * Get full statistics across all offcut statuses.
 */
export async function getFullOffcutStats(): Promise<{
  byStatus: Record<string, { count: number; value: number }>;
  byMaterialType: Record<string, { count: number; value: number }>;
  totalCount: number;
  totalValue: number;
}> {
  const offcuts = await queryAllOffcuts();

  const byStatus: Record<string, { count: number; value: number }> = {};
  const byMaterialType: Record<string, { count: number; value: number }> = {};
  let totalValue = 0;

  for (const offcut of offcuts) {
    totalValue += offcut.originalCostAllocation;

    if (!byStatus[offcut.status]) {
      byStatus[offcut.status] = { count: 0, value: 0 };
    }
    byStatus[offcut.status].count++;
    byStatus[offcut.status].value += offcut.originalCostAllocation;

    if (!byMaterialType[offcut.materialType]) {
      byMaterialType[offcut.materialType] = { count: 0, value: 0 };
    }
    byMaterialType[offcut.materialType].count++;
    byMaterialType[offcut.materialType].value += offcut.originalCostAllocation;
  }

  return {
    byStatus,
    byMaterialType,
    totalCount: offcuts.length,
    totalValue,
  };
}

// ============================================
// Update & Bulk Operations
// ============================================

/**
 * Update editable offcut details (dimensions, condition, warehouse, notes).
 */
export async function updateOffcutDetails(
  offcutId: string,
  updates: {
    warehouseLocation?: string;
    condition?: OffcutCondition;
    notes?: string;
    length?: number;
    width?: number;
    thickness?: number;
  },
): Promise<void> {
  const offcutRef = doc(db, OFFCUTS_COLLECTION, offcutId);
  // Filter out undefined fields
  const data: Record<string, unknown> = {};
  if (updates.warehouseLocation !== undefined) data.warehouseLocation = updates.warehouseLocation;
  if (updates.condition !== undefined) data.condition = updates.condition;
  if (updates.notes !== undefined) data.notes = updates.notes;
  if (updates.length !== undefined) data.length = updates.length;
  if (updates.width !== undefined) data.width = updates.width;
  if (updates.thickness !== undefined) data.thickness = updates.thickness;
  data.updatedAt = serverTimestamp();

  await updateDoc(offcutRef, data);
}

/**
 * Batch scrap multiple offcuts.
 */
export async function bulkScrapOffcuts(
  offcutIds: string[],
  reason: string,
): Promise<void> {
  await Promise.all(offcutIds.map(id => scrapOffcut(id, reason)));
}

/**
 * Batch move offcuts to a new warehouse location.
 */
export async function bulkMoveOffcuts(
  offcutIds: string[],
  newLocation: string,
): Promise<void> {
  await Promise.all(
    offcutIds.map(id =>
      updateDoc(doc(db, OFFCUTS_COLLECTION, id), {
        warehouseLocation: newLocation,
        updatedAt: serverTimestamp(),
      })
    )
  );
}

// ============================================
// Manual Offcut Registration
// ============================================

/**
 * Register a manually-entered offcut (not from a production run).
 * Used when users have leftover material from a job site, purchased remnants, etc.
 */
export async function registerManualOffcut(data: {
  materialType: MaterialType;
  materialId?: string;
  materialName: string;
  length: number;
  width: number;
  thickness: number;
  crossSection?: { thickness: number; width: number };
  isDressed?: boolean;
  condition: OffcutCondition;
  originalCostAllocation: number;
  warehouseLocation?: string;
  notes?: string;
  sourceDescription?: string;
}): Promise<string> {
  const timestamp = FirestoreTimestamp.now();

  // Build offcut data, omitting undefined fields (Firestore rejects undefined)
  const offcutData: Record<string, unknown> = {
    materialType: data.materialType,
    materialId: data.materialId || '',
    materialName: data.materialName,
    length: data.length,
    width: data.width,
    thickness: data.thickness,
    sourceProjectId: 'manual',
    sourceProjectName: 'Manual entry',
    createdAt: timestamp,
    status: 'available',
    condition: data.condition,
    originalCostAllocation: data.originalCostAllocation,
  };
  if (data.crossSection) offcutData.crossSection = data.crossSection;
  if (data.isDressed !== undefined) offcutData.isDressed = data.isDressed;
  if (data.sourceDescription) offcutData.sourceDescription = data.sourceDescription;
  if (data.warehouseLocation) offcutData.warehouseLocation = data.warehouseLocation;
  if (data.notes) offcutData.notes = data.notes;

  const docRef = await addDoc(collection(db, OFFCUTS_COLLECTION), offcutData);
  return docRef.id;
}

// ============================================
// Offcut Registration (after production)
// ============================================

/**
 * Register reusable offcuts from a production run.
 * Called after production optimization is complete.
 *
 * Creates Offcut documents for waste regions / linear waste segments
 * that meet minimum size thresholds.
 */
export async function registerOffcutsFromProduction(
  projectId: string,
  projectName: string,
  generatedOffcuts: GeneratedOffcut[]
): Promise<string[]> {
  const createdIds: string[] = [];
  const timestamp = FirestoreTimestamp.now();

  for (const generated of generatedOffcuts) {
    if (!generated.reusable) continue;

    const offcutData: Omit<Offcut, 'id'> = {
      materialType: generated.materialType,
      materialId: '',
      materialName: generated.materialName,
      length: generated.length,
      width: generated.width,
      thickness: generated.thickness,
      crossSection: generated.crossSection,
      sourceProjectId: projectId,
      sourceProjectName: projectName,
      createdAt: timestamp,
      status: 'available',
      condition: 'good',
      originalCostAllocation: generated.costAllocation,
    };

    const docRef = await addDoc(collection(db, OFFCUTS_COLLECTION), offcutData);
    createdIds.push(docRef.id);
  }

  return createdIds;
}

/**
 * Build GeneratedOffcut records from panel waste regions.
 * Used to prepare offcut data before registration.
 */
export function buildPanelOffcuts(
  wasteRegions: WasteRegion[],
  materialName: string,
  thickness: number,
  costPerSqMm: number,
  minimumSize: { length: number; width: number } = { length: 200, width: 200 }
): GeneratedOffcut[] {
  return wasteRegions.map(region => {
    const reusable = region.length >= minimumSize.length && region.width >= minimumSize.width;
    return {
      materialName,
      materialType: 'PANEL' as MaterialType,
      dimensions: `${region.length}×${region.width}mm`,
      length: region.length,
      width: region.width,
      thickness,
      reusable,
      costAllocation: Math.round(region.area * costPerSqMm),
    };
  });
}

/**
 * Build GeneratedOffcut records from timber linear waste segments.
 */
export function buildTimberOffcuts(
  wasteSegments: LinearWasteSegment[],
  materialName: string,
  crossSection: { thickness: number; width: number },
  costPerLinearMm: number,
  minimumLength: number = 300
): GeneratedOffcut[] {
  return wasteSegments.map(segment => {
    const reusable = segment.length >= minimumLength;
    return {
      materialName,
      materialType: 'TIMBER' as MaterialType,
      dimensions: `${crossSection.thickness}×${crossSection.width}mm × ${segment.length}mm`,
      length: segment.length,
      width: crossSection.width,
      thickness: crossSection.thickness,
      crossSection,
      reusable,
      costAllocation: Math.round(segment.length * costPerLinearMm),
    };
  });
}
