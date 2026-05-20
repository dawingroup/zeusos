import type { PartTreeNode } from '../types/workshop-viewer.types';

function normalizeMeshToken(s: string | null | undefined): string {
  return (s ?? '').trim().toLowerCase().replace(/\s+/g, '_');
}

/**
 * Resolve a tree node id by any of the provided mesh-name needles.
 * Matches both raw and normalized tokens to absorb GLTF naming drift.
 */
export function findPartTreeNodeIdByMeshNeedles(
  nodes: PartTreeNode[],
  needles: Set<string>,
): string | null {
  for (const node of nodes) {
    const matchesNode = node.meshObjectNames.some(name =>
      needles.has(name) || needles.has(normalizeMeshToken(name)),
    );
    if (matchesNode) return node.id;

    const childMatch = findPartTreeNodeIdByMeshNeedles(node.children ?? [], needles);
    if (childMatch) return childMatch;
  }
  return null;
}

export function expandMeshNeedles(meshId: string | null, meshName: string): Set<string> {
  return new Set([meshId, meshName].filter(Boolean).flatMap(s => [s, normalizeMeshToken(s)])) as Set<string>;
}

