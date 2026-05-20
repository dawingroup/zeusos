/**
 * Part Write Service
 *
 * Orchestrates writing recognized parts to Firestore, updating RAG status,
 * running DFM validation, and storing identifications for learning.
 */

import { syncPartsToDesignItem } from './partsSyncService';
import type { PartEntry } from './partsSyncService';
import { PartsConcurrencyError } from '@/modules/design-manager/services/partsVersioningService';
import type { RecognitionResult, DfmValidationResult, DfmIssue, PastIdentification } from '../types/ai-recognition.types';
import { doc, updateDoc, Timestamp, collection, addDoc } from 'firebase/firestore';
import { db } from '@/firebase/config';

export { PartsConcurrencyError };

// ---------------------------------------------------------------------------
// Write Parts to Project
// ---------------------------------------------------------------------------

export interface WriteResult {
  synced: number;
  /** P6: `partsVersion` after the write bumped it. */
  version: number;
  dfm: DfmValidationResult;
  learningStored: number;
}

/**
 * Write AI-recognized parts to a design item, then:
 * 1. Sync parts via partsSyncService (with optional concurrency check)
 * 2. Update RAG status (parts aspect)
 * 3. Validate DFM rules
 * 4. Store identifications for learning
 *
 * P6: pass `baseVersion` — the `partsVersion` observed when the user
 * started their recognition session — to have the sync reject if another
 * editor moved the item in the meantime. `PartsConcurrencyError` bubbles
 * up so the UI can offer a 3-way merge.
 */
export async function writePartsToProject(
  projectId: string,
  itemId: string,
  parts: PartEntry[],
  recognition: RecognitionResult,
  renames: Record<string, string>,
  userId: string,
  mode: 'replace' | 'merge' = 'merge',
  baseVersion?: number,
): Promise<WriteResult> {
  // 1. Sync parts to Firestore — versioned write, optional conflict check.
  const { synced, version } = await syncPartsToDesignItem(
    projectId,
    itemId,
    parts,
    mode,
    userId,
    baseVersion,
  );

  // 2. Update RAG — mark parts aspect as complete
  try {
    const itemRef = doc(db, 'designProjects', projectId, 'designItems', itemId);
    await updateDoc(itemRef, {
      'ragStatus.parts': parts.length > 0 ? 'green' : 'red',
      'ragStatus.partsNote': `${synced} parts from AI recognition (${recognition.source})`,
      updatedAt: Timestamp.now(),
      updatedBy: userId,
    });
  } catch (err) {
    console.warn('RAG status update failed (non-critical):', err);
  }

  // 3. DFM validation
  const dfm = validateDfm(parts);

  // 4. Store confirmed identifications for learning
  let learningStored = 0;
  try {
    learningStored = await storeIdentifications(projectId, itemId, recognition, renames, userId);
  } catch (err) {
    console.warn('Learning storage failed (non-critical):', err);
  }

  return { synced, version, dfm, learningStored };
}

// ---------------------------------------------------------------------------
// DFM Validation
// ---------------------------------------------------------------------------

const DFM_RULES = {
  minThickness: 3,       // mm
  maxThickness: 50,      // mm
  minDimension: 10,      // mm — smallest meaningful part
  maxDimension: 3000,    // mm — largest sheet
  warnThickness: 6,      // mm — warn if structural part is thin
};

export function validateDfm(parts: PartEntry[]): DfmValidationResult {
  const issues: DfmIssue[] = [];

  for (const part of parts) {
    // Thickness checks
    if (part.thickness < DFM_RULES.minThickness) {
      issues.push({
        partName: part.name,
        severity: 'error',
        category: 'thickness',
        message: `Thickness ${part.thickness}mm below minimum ${DFM_RULES.minThickness}mm`,
      });
    } else if (part.thickness > DFM_RULES.maxThickness) {
      issues.push({
        partName: part.name,
        severity: 'warning',
        category: 'thickness',
        message: `Thickness ${part.thickness}mm exceeds typical maximum ${DFM_RULES.maxThickness}mm`,
      });
    }

    // Dimension checks
    const maxDim = Math.max(part.length, part.width);
    if (maxDim > DFM_RULES.maxDimension) {
      issues.push({
        partName: part.name,
        severity: 'warning',
        category: 'dimension',
        message: `Part dimension ${maxDim}mm exceeds typical sheet size ${DFM_RULES.maxDimension}mm`,
      });
    }

    const minDim = Math.min(part.length, part.width);
    if (minDim < DFM_RULES.minDimension) {
      issues.push({
        partName: part.name,
        severity: 'info',
        category: 'dimension',
        message: `Very small dimension ${minDim}mm — verify this is correct`,
      });
    }

    // Missing material
    if (!part.materialName || part.materialName === 'Unknown') {
      issues.push({
        partName: part.name,
        severity: 'warning',
        category: 'material',
        message: 'No material assigned — needs manual assignment',
      });
    }
  }

  return {
    issues,
    passCount: parts.length - issues.filter(i => i.severity === 'error').length,
    failCount: issues.filter(i => i.severity === 'error').length,
    warnCount: issues.filter(i => i.severity === 'warning').length,
  };
}

// ---------------------------------------------------------------------------
// Learning Storage
// ---------------------------------------------------------------------------

/**
 * Store confirmed part identifications in Firestore for future RAG retrieval.
 */
async function storeIdentifications(
  projectId: string,
  itemId: string,
  recognition: RecognitionResult,
  renames: Record<string, string>,
  userId: string,
): Promise<number> {
  const coll = collection(db, 'part_identifications');
  let stored = 0;

  for (const part of recognition.parts) {
    const confirmedName = renames[part.originalName] || part.suggestedName;

    const identification: Omit<PastIdentification, 'id'> = {
      projectId,
      itemId,
      originalName: part.originalName,
      confirmedName,
      role: part.role,
      dims: {
        w: part.dims.length,
        d: part.dims.width,
        h: part.dims.thickness,
      },
      material: part.inferredMaterial || 'Unknown',
      assemblyCategory: part.assemblyGroup,
      confirmedAt: new Date(),
      confirmedBy: userId,
    };

    await addDoc(coll, {
      ...identification,
      confirmedAt: Timestamp.now(),
    });
    stored++;
  }

  return stored;
}
