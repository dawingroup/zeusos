/**
 * Dimension Engine
 * Detects intermediate dimensions (shelf positions, division spacing, opening sizes)
 * by analyzing part bounding boxes and structural roles.
 */

import type {
  ParsedModel,
  BoundingBox3D,
  DimensionSet,
  IntermediateDimension,
  ViewDirection,
  PartRole,
} from '../types/workshop-viewer.types';
import { DIMENSION_COLORS } from '../constants/workshop-viewer.constants';
import {
  computeBoundingBox,
  computeModelBounds,
  bboxDimensions,
  classifyPartRole,
  cleanPartName,
} from './geometryEngine';

interface ClassifiedPart {
  name: string;
  cleanName: string;
  role: PartRole;
  bbox: BoundingBox3D;
}

/**
 * Compute overall and intermediate dimensions from a parsed model.
 */
export function computeDimensions(model: ParsedModel): DimensionSet {
  const overallBbox = computeModelBounds(model);
  const overallDims = bboxDimensions(overallBbox);

  // Classify all parts
  const classified: ClassifiedPart[] = model.objects.map(obj => ({
    name: obj.name,
    cleanName: cleanPartName(obj.name),
    role: classifyPartRole(obj.name),
    bbox: computeBoundingBox(obj.vertices),
  }));

  const intermediate: IntermediateDimension[] = [];

  // --- FRONT VIEW dimensions (XZ plane) ---
  intermediate.push(...extractFrontHorizontalChain(classified));
  intermediate.push(...extractFrontVerticalChain(classified));
  intermediate.push(...extractOpeningDimensions(classified, 'front'));

  // --- SIDE VIEW dimensions (YZ plane) ---
  intermediate.push(...extractSideHorizontalChain(classified));

  // --- TOP VIEW dimensions (XY plane) ---
  intermediate.push(...extractTopChains(classified));

  return {
    overall: {
      width: overallDims.w,
      depth: overallDims.d,
      height: overallDims.h,
    },
    intermediate,
  };
}

/**
 * Front view: horizontal chain from side panels + vertical divisions.
 * Collects X-min and X-max of all side + vertical_division parts → sorted unique positions.
 */
function extractFrontHorizontalChain(parts: ClassifiedPart[]): IntermediateDimension[] {
  const relevantRoles: PartRole[] = ['side', 'vertical_division'];
  const positions = new Set<number>();

  for (const part of parts) {
    if (relevantRoles.includes(part.role)) {
      positions.add(roundTo(part.bbox.min.x, 1));
      positions.add(roundTo(part.bbox.max.x, 1));
    }
  }

  const sorted = [...positions].sort((a, b) => a - b);
  if (sorted.length < 2) return [];

  return [{
    type: 'horizontal_chain',
    view: 'front',
    positions: sorted,
    tier: 2,
    label: 'Divisions',
    color: DIMENSION_COLORS.horizontal,
  }];
}

/**
 * Front view: vertical chain from top/bottom + shelves.
 * Collects Z-min and Z-max of all top_bottom + shelf parts.
 */
function extractFrontVerticalChain(parts: ClassifiedPart[]): IntermediateDimension[] {
  const relevantRoles: PartRole[] = ['top_bottom', 'shelf', 'mobile_shelf'];
  const positions = new Set<number>();

  for (const part of parts) {
    if (relevantRoles.includes(part.role)) {
      positions.add(roundTo(part.bbox.min.z, 1));
      positions.add(roundTo(part.bbox.max.z, 1));
    }
  }

  const sorted = [...positions].sort((a, b) => a - b);
  if (sorted.length < 2) return [];

  return [{
    type: 'vertical_chain',
    view: 'front',
    positions: sorted,
    tier: 2,
    label: 'Heights',
    color: DIMENSION_COLORS.vertical,
  }];
}

/**
 * Extract opening dimensions for doors and drawers.
 */
function extractOpeningDimensions(parts: ClassifiedPart[], view: ViewDirection): IntermediateDimension[] {
  const dims: IntermediateDimension[] = [];
  const openingRoles: PartRole[] = ['door', 'drawer'];

  // Group by clean name to find unique openings
  const seen = new Set<string>();

  for (const part of parts) {
    if (!openingRoles.includes(part.role)) continue;
    if (seen.has(part.cleanName)) continue;
    seen.add(part.cleanName);

    const width = Math.abs(part.bbox.max.x - part.bbox.min.x);
    const height = Math.abs(part.bbox.max.z - part.bbox.min.z);

    if (width > 10 && height > 10) {
      // Single horizontal dimension for opening width
      dims.push({
        type: 'single_horizontal',
        view,
        positions: [part.bbox.min.x, part.bbox.max.x],
        tier: 3,
        label: `${part.cleanName} opening`,
        color: DIMENSION_COLORS.detail,
      });

      // Single vertical dimension for opening height
      dims.push({
        type: 'single_vertical',
        view,
        positions: [part.bbox.min.z, part.bbox.max.z],
        tier: 3,
        label: `${part.cleanName} height`,
        color: DIMENSION_COLORS.detail,
      });
    }
  }

  return dims;
}

/**
 * Side view: horizontal chain from depth positions of top_bottom + back parts.
 */
function extractSideHorizontalChain(parts: ClassifiedPart[]): IntermediateDimension[] {
  const relevantRoles: PartRole[] = ['top_bottom', 'back'];
  const positions = new Set<number>();

  for (const part of parts) {
    if (relevantRoles.includes(part.role)) {
      positions.add(roundTo(part.bbox.min.y, 1));
      positions.add(roundTo(part.bbox.max.y, 1));
    }
  }

  const sorted = [...positions].sort((a, b) => a - b);
  if (sorted.length < 2) return [];

  return [{
    type: 'horizontal_chain',
    view: 'right',
    positions: sorted,
    tier: 2,
    label: 'Depth positions',
    color: DIMENSION_COLORS.horizontal,
  }];
}

/**
 * Top view: chains from X and Y positions.
 */
function extractTopChains(parts: ClassifiedPart[]): IntermediateDimension[] {
  const dims: IntermediateDimension[] = [];

  // X positions (same as front horizontal)
  const xRoles: PartRole[] = ['side', 'vertical_division'];
  const xPositions = new Set<number>();
  for (const part of parts) {
    if (xRoles.includes(part.role)) {
      xPositions.add(roundTo(part.bbox.min.x, 1));
      xPositions.add(roundTo(part.bbox.max.x, 1));
    }
  }
  const sortedX = [...xPositions].sort((a, b) => a - b);
  if (sortedX.length >= 2) {
    dims.push({
      type: 'horizontal_chain',
      view: 'top',
      positions: sortedX,
      tier: 2,
      label: 'Width divisions',
      color: DIMENSION_COLORS.horizontal,
    });
  }

  // Y positions (depth)
  const yRoles: PartRole[] = ['top_bottom', 'back'];
  const yPositions = new Set<number>();
  for (const part of parts) {
    if (yRoles.includes(part.role)) {
      yPositions.add(roundTo(part.bbox.min.y, 1));
      yPositions.add(roundTo(part.bbox.max.y, 1));
    }
  }
  const sortedY = [...yPositions].sort((a, b) => a - b);
  if (sortedY.length >= 2) {
    dims.push({
      type: 'vertical_chain',
      view: 'top',
      positions: sortedY,
      tier: 2,
      label: 'Depth divisions',
      color: DIMENSION_COLORS.vertical,
    });
  }

  return dims;
}

function roundTo(val: number, precision: number): number {
  return Math.round(val / precision) * precision;
}
