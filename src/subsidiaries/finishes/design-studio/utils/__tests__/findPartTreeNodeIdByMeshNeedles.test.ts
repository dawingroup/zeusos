import { describe, expect, it } from 'vitest';
import type { PartTreeNode } from '../../types/workshop-viewer.types';
import {
  expandMeshNeedles,
  findPartTreeNodeIdByMeshNeedles,
} from '../findPartTreeNodeIdByMeshNeedles';

function node(
  id: string,
  meshObjectNames: string[],
  children: PartTreeNode[] = [],
): PartTreeNode {
  return {
    id,
    name: id,
    role: 'other',
    meshObjectNames,
    cutListEntryIds: [],
    children,
    bbox: { min: { x: 0, y: 0, z: 0 }, max: { x: 1, y: 1, z: 1 } },
    dims: { w: 1, d: 1, h: 1 },
    isExpanded: false,
    isLeaf: children.length === 0,
  };
}

describe('findPartTreeNodeIdByMeshNeedles', () => {
  it('matches direct mesh name on a root node', () => {
    const tree = [node('root-a', ['Door Panel 01'])];
    const needles = expandMeshNeedles(null, 'Door Panel 01');
    expect(findPartTreeNodeIdByMeshNeedles(tree, needles)).toBe('root-a');
  });

  it('matches normalized token across whitespace/case differences', () => {
    const tree = [node('root-b', ['Drawer Front Left'])];
    const needles = expandMeshNeedles(null, 'drawer_front_left');
    expect(findPartTreeNodeIdByMeshNeedles(tree, needles)).toBe('root-b');
  });

  it('finds nested child matches recursively', () => {
    const tree = [
      node('asm-1', ['assembly-shell'], [
        node('part-x', ['Internal Rail']),
      ]),
    ];
    const needles = expandMeshNeedles('internal_rail', 'does-not-matter');
    expect(findPartTreeNodeIdByMeshNeedles(tree, needles)).toBe('part-x');
  });

  it('returns null when nothing matches', () => {
    const tree = [node('root-c', ['Back Panel'])];
    const needles = expandMeshNeedles(null, 'unknown_mesh');
    expect(findPartTreeNodeIdByMeshNeedles(tree, needles)).toBeNull();
  });
});

