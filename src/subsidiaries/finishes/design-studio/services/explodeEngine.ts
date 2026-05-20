/**
 * Explode Engine
 * Computes exploded positions for sub-assembly parts.
 * Given a PartTreeNode with children, offsets each child along its dominant axis
 * to spread them apart for inspection.
 */

import type { PartTreeNode } from '../types/workshop-viewer.types';
import { EXPLODE_SETTINGS } from '../constants/workshop-viewer.constants';
import { bboxCenter } from './geometryEngine';

export interface ExplodeOffset {
  x: number;
  y: number;
  z: number;
}

/**
 * Compute exploded position offsets for children of an assembly node.
 * Returns a map of mesh object name → offset vector.
 */
export function computeExplodeOffsets(
  assemblyNode: PartTreeNode,
): Map<string, ExplodeOffset> {
  const offsets = new Map<string, ExplodeOffset>();

  if (assemblyNode.isLeaf || assemblyNode.children.length === 0) {
    return offsets;
  }

  const asmCenter = bboxCenter(assemblyNode.bbox);
  const { gapMultiplier, minGap } = EXPLODE_SETTINGS;

  // For each child, compute its offset direction from the assembly center
  for (const child of assemblyNode.children) {
    const childCenter = bboxCenter(child.bbox);

    // Direction vector from assembly center to child center
    let dx = childCenter.x - asmCenter.x;
    let dy = childCenter.y - asmCenter.y;
    let dz = childCenter.z - asmCenter.z;

    // Normalize and scale by child size + gap
    const maxDim = Math.max(child.dims.w, child.dims.d, child.dims.h);
    const gap = Math.max(maxDim * gapMultiplier, minGap);

    const len = Math.sqrt(dx * dx + dy * dy + dz * dz);
    if (len > 0.1) {
      dx = (dx / len) * gap;
      dy = (dy / len) * gap;
      dz = (dz / len) * gap;
    } else {
      // Child is exactly centered — spread along Z axis
      const childIndex = assemblyNode.children.indexOf(child);
      dz = (childIndex - (assemblyNode.children.length - 1) / 2) * gap;
      dx = 0;
      dy = 0;
    }

    const offset: ExplodeOffset = { x: dx, y: dy, z: dz };

    // Apply offset to all mesh objects in this child node
    for (const meshName of child.meshObjectNames) {
      offsets.set(meshName, offset);
    }
  }

  return offsets;
}

/**
 * Linearly interpolate between two offset values.
 * Used for smooth animation of explode/collapse.
 */
export function lerpOffset(
  from: ExplodeOffset,
  to: ExplodeOffset,
  t: number,
): ExplodeOffset {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
    z: from.z + (to.z - from.z) * t,
  };
}

/** Zero offset constant */
export const ZERO_OFFSET: ExplodeOffset = { x: 0, y: 0, z: 0 };
