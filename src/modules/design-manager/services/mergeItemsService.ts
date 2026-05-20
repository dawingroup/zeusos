/**
 * Merge Design Items Service
 * Merges parts, standard parts, and special parts from source items into a target item.
 * Source items are kept as empty shells (parts cleared, item preserved).
 */

import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '@/shared/services/firebase';
import { nanoid } from 'nanoid';
import type { PartEntry, StandardPartEntry, SpecialPartEntry } from '../types';
import {
  bulkAddParts,
  calculatePartsSummary,
  cleanUndefined,
} from './partsService';

const PROJECTS_COLLECTION = 'designProjects';

export interface MergeItemsOptions {
  projectId: string;
  targetItemId: string;
  sourceItemIds: string[];
  userId: string;
}

export interface MergeItemsResult {
  targetItemId: string;
  mergedPartCount: number;
  mergedStandardPartsCount: number;
  mergedSpecialPartsCount: number;
  clearedSourceIds: string[];
  errors: Array<{ itemId: string; message: string }>;
}

/**
 * Merge standard parts by consolidating same name+category, summing quantities
 */
function mergeStandardParts(
  existing: StandardPartEntry[],
  incoming: StandardPartEntry[]
): StandardPartEntry[] {
  const map = new Map<string, StandardPartEntry>();

  for (const p of existing) {
    map.set(`${p.name}|${p.category}`, { ...p });
  }

  for (const p of incoming) {
    const key = `${p.name}|${p.category}`;
    const prev = map.get(key);
    if (prev) {
      prev.quantity += p.quantity;
      prev.totalCost = prev.quantity * prev.unitCost;
    } else {
      map.set(key, { ...p, id: `sp-merge-${nanoid(6)}` });
    }
  }

  return Array.from(map.values());
}

/**
 * Merge special parts by concatenating (each is a unique luxury item)
 */
function mergeSpecialParts(
  existing: SpecialPartEntry[],
  incoming: SpecialPartEntry[]
): SpecialPartEntry[] {
  return [
    ...existing,
    ...incoming.map(p => ({ ...p, id: `xp-merge-${nanoid(6)}` })),
  ];
}

/**
 * Merge multiple design items' parts into a single target item.
 * Source items are kept as empty shells (parts cleared).
 */
export async function mergeDesignItems(
  options: MergeItemsOptions
): Promise<MergeItemsResult> {
  const { projectId, targetItemId, sourceItemIds, userId } = options;

  // Validate target not in sources
  const filteredSourceIds = sourceItemIds.filter(id => id !== targetItemId);
  if (filteredSourceIds.length === 0) {
    throw new Error('No source items to merge (target cannot be a source)');
  }

  const result: MergeItemsResult = {
    targetItemId,
    mergedPartCount: 0,
    mergedStandardPartsCount: 0,
    mergedSpecialPartsCount: 0,
    clearedSourceIds: [],
    errors: [],
  };

  // Step 1: Fetch all docs in parallel
  const allIds = [targetItemId, ...filteredSourceIds];
  const refs = allIds.map(id =>
    doc(db, PROJECTS_COLLECTION, projectId, 'designItems', id)
  );
  const snapshots = await Promise.all(refs.map(ref => getDoc(ref)));

  const targetSnap = snapshots[0];
  if (!targetSnap.exists()) {
    throw new Error(`Target item ${targetItemId} not found`);
  }

  const targetData = targetSnap.data();
  const existingTargetParts: PartEntry[] = (targetData.parts as PartEntry[]) || [];
  const targetMfg = (targetData.manufacturing || {}) as Record<string, any>;

  // Step 2: Collect all source parts, standard parts, and special parts
  const allSourceParts: PartEntry[] = [];
  const allSourceStandardParts: StandardPartEntry[] = [];
  const allSourceSpecialParts: SpecialPartEntry[] = [];

  for (let i = 1; i < snapshots.length; i++) {
    const snap = snapshots[i];
    const sourceId = filteredSourceIds[i - 1];

    if (!snap.exists()) {
      result.errors.push({ itemId: sourceId, message: 'Item not found' });
      continue;
    }

    const data = snap.data();
    const parts: PartEntry[] = (data.parts as PartEntry[]) || [];
    const mfg = (data.manufacturing || {}) as Record<string, any>;

    allSourceParts.push(...parts);

    if (mfg.standardParts?.length) {
      allSourceStandardParts.push(...(mfg.standardParts as StandardPartEntry[]));
    }
    if (mfg.specialParts?.length) {
      allSourceSpecialParts.push(...(mfg.specialParts as SpecialPartEntry[]));
    }
  }

  // Step 3: Merge parts into target via bulkAddParts (handles partNumber re-sequencing)
  if (allSourceParts.length > 0) {
    // Strip partNumber so bulkAddParts regenerates them sequentially
    const strippedParts = allSourceParts.map(
      ({ id, partNumber, createdAt, updatedAt, ...rest }) => rest
    ) as Omit<PartEntry, 'id' | 'createdAt' | 'updatedAt'>[];

    await bulkAddParts(projectId, targetItemId, strippedParts, existingTargetParts, userId);
    result.mergedPartCount = allSourceParts.length;
  }

  // Step 4: Merge manufacturing standard + special parts
  if (allSourceStandardParts.length > 0 || allSourceSpecialParts.length > 0) {
    const existingStandard: StandardPartEntry[] = targetMfg.standardParts || [];
    const existingSpecial: SpecialPartEntry[] = targetMfg.specialParts || [];

    const finalStandard = allSourceStandardParts.length > 0
      ? mergeStandardParts(existingStandard, allSourceStandardParts)
      : existingStandard;

    const finalSpecial = allSourceSpecialParts.length > 0
      ? mergeSpecialParts(existingSpecial, allSourceSpecialParts)
      : existingSpecial;

    const standardCost = finalStandard.reduce((sum, p) => sum + (p.quantity * p.unitCost), 0);
    const specialCost = finalSpecial.reduce((sum, p) => sum + (p.costing?.totalLandedCost || 0), 0);

    const targetRef = doc(db, PROJECTS_COLLECTION, projectId, 'designItems', targetItemId);
    await updateDoc(targetRef, cleanUndefined({
      'manufacturing.standardParts': finalStandard,
      'manufacturing.standardPartsCost': standardCost,
      'manufacturing.specialParts': finalSpecial,
      'manufacturing.specialPartsCost': specialCost,
      updatedAt: serverTimestamp(),
      updatedBy: userId,
    }));

    result.mergedStandardPartsCount = allSourceStandardParts.length;
    result.mergedSpecialPartsCount = allSourceSpecialParts.length;
  }

  // Step 5: Clear source items' parts (keep as empty shells)
  for (let i = 1; i < snapshots.length; i++) {
    const snap = snapshots[i];
    const sourceId = filteredSourceIds[i - 1];
    if (!snap.exists()) continue;

    try {
      const sourceRef = doc(db, PROJECTS_COLLECTION, projectId, 'designItems', sourceId);
      const emptySummary = calculatePartsSummary([]);

      await updateDoc(sourceRef, cleanUndefined({
        parts: [],
        partsSummary: emptySummary,
        'manufacturing.standardParts': [],
        'manufacturing.standardPartsCost': 0,
        'manufacturing.specialParts': [],
        'manufacturing.specialPartsCost': 0,
        updatedAt: serverTimestamp(),
        updatedBy: userId,
      }));

      result.clearedSourceIds.push(sourceId);
    } catch (err) {
      result.errors.push({
        itemId: sourceId,
        message: `Failed to clear source: ${(err as Error).message}`,
      });
    }
  }

  return result;
}
