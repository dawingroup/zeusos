/**
 * Cutlist Enhancement Service
 *
 * When both a 3D model AND CSV cutlist are available, merges
 * model geometry data into the cutlist to add/correct information
 * and flag discrepancies.
 */

import type { CutListEntry, ParsedModel, MeshCutListLink } from '../types/workshop-viewer.types';
import type { EnhancedCutListEntry, RecognitionResult } from '../types/ai-recognition.types';
import { computeBoundingBox, bboxDimensions } from './geometryEngine';

const DIMENSION_TOLERANCE = 2; // mm — tolerance for dimension comparison

/**
 * Enhance cutlist entries with data from the 3D model and AI recognition.
 */
export function enhanceCutList(
  cutList: CutListEntry[],
  model: ParsedModel,
  links: MeshCutListLink[],
  recognition?: RecognitionResult | null,
): EnhancedCutListEntry[] {
  // Build a map of mesh name → geometry dims
  const meshDimsMap = new Map<string, { length: number; width: number; thickness: number }>();
  for (const obj of model.objects) {
    const bbox = computeBoundingBox(obj.vertices);
    const dims = bboxDimensions(bbox);
    const sorted = [dims.w, dims.d, dims.h].sort((a, b) => b - a);
    meshDimsMap.set(obj.name, { length: sorted[0], width: sorted[1], thickness: sorted[2] });
  }

  // Build cutlist index → mesh name map from links
  const cutListToMesh = new Map<number, string>();
  for (const link of links) {
    if (link.confidence !== 'unmatched') {
      cutListToMesh.set(link.cutListIndex, link.meshObjectName);
    }
  }

  // Build recognition lookup
  const recognitionMap = new Map<string, typeof recognition extends null ? never : NonNullable<typeof recognition>['parts'][number]>();
  if (recognition?.parts) {
    for (const part of recognition.parts) {
      recognitionMap.set(part.originalName, part);
    }
  }

  return cutList.map((entry, index) => {
    const enhanced: EnhancedCutListEntry = {
      originalRow: entry.originalRow,
      partName: entry.partName,
      material: entry.material,
      enhancedFields: [],
      discrepancies: [],
    };

    const meshName = cutListToMesh.get(index);
    const meshDims = meshName ? meshDimsMap.get(meshName) : undefined;
    const aiPart = meshName ? recognitionMap.get(meshName) : undefined;

    if (meshDims) {
      enhanced.modelDims = meshDims;

      // Check dimension discrepancies
      const dimChecks: [string, number, number][] = [
        ['length', entry.length, meshDims.length],
        ['width', entry.width, meshDims.width],
        ['thickness', entry.thickness, meshDims.thickness],
      ];

      for (const [field, csvVal, modelVal] of dimChecks) {
        const diff = Math.abs(csvVal - modelVal);
        if (diff > DIMENSION_TOLERANCE) {
          enhanced.discrepancies.push({
            field,
            csvValue: csvVal,
            modelValue: Math.round(modelVal),
            severity: diff > 10 ? 'error' : 'warning',
          });
        }
      }
    }

    // Grain direction: if CSV doesn't have it, infer from geometry
    if (!entry.grainDirection && meshDims) {
      // Longest dimension typically follows grain
      enhanced.suggestedGrainDirection = meshDims.length > meshDims.width ? 'length' : 'width';
      enhanced.enhancedFields.push('grainDirection');
    }

    // Material from AI if CSV material is generic
    if (aiPart?.inferredMaterial && entry.material !== aiPart.inferredMaterial) {
      enhanced.discrepancies.push({
        field: 'material',
        csvValue: entry.material,
        modelValue: aiPart.inferredMaterial,
        severity: 'info',
      });
    }

    return enhanced;
  });
}

/**
 * Count total discrepancies by severity.
 */
export function summarizeEnhancements(enhanced: EnhancedCutListEntry[]): {
  totalDiscrepancies: number;
  errors: number;
  warnings: number;
  enhancedCount: number;
} {
  let errors = 0, warnings = 0, totalDiscrepancies = 0, enhancedCount = 0;
  for (const e of enhanced) {
    totalDiscrepancies += e.discrepancies.length;
    errors += e.discrepancies.filter(d => d.severity === 'error').length;
    warnings += e.discrepancies.filter(d => d.severity === 'warning').length;
    if (e.enhancedFields.length > 0) enhancedCount++;
  }
  return { totalDiscrepancies, errors, warnings, enhancedCount };
}
