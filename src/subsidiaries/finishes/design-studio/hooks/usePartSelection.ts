/**
 * usePartSelection — Assembly-aware part selection state management
 * Click mesh → selects parent assembly in tree. Ctrl+click for individual.
 */

import { useState, useCallback } from 'react';
import type { PartTreeNode } from '../types/workshop-viewer.types';

interface UsePartSelectionReturn {
  selectedPartId: string | null;
  expandedIds: string[];
  expandedAssemblyIds: string[];
  selectPart: (meshName: string | null, ctrlKey?: boolean) => void;
  selectNodeById: (nodeId: string) => void;
  toggleExpand: (nodeId: string) => void;
  toggleExplode: (nodeId: string) => void;
  clearSelection: () => void;
  getSelectedNode: () => PartTreeNode | null;
}

export function usePartSelection(partTree: PartTreeNode[]): UsePartSelectionReturn {
  const [selectedPartId, setSelectedPartId] = useState<string | null>(null);
  const [expandedIds, setExpandedIds] = useState<string[]>([]);
  const [expandedAssemblyIds, setExpandedAssemblyIds] = useState<string[]>([]);

  // Find a node by id in the tree
  const findNodeById = useCallback((id: string): PartTreeNode | null => {
    function search(nodes: PartTreeNode[]): PartTreeNode | null {
      for (const node of nodes) {
        if (node.id === id) return node;
        const found = search(node.children);
        if (found) return found;
      }
      return null;
    }
    return search(partTree);
  }, [partTree]);

  // Find the tree node that contains a specific mesh name
  const findNodeByMeshName = useCallback((meshName: string): PartTreeNode | null => {
    function search(nodes: PartTreeNode[]): PartTreeNode | null {
      for (const node of nodes) {
        if (node.meshObjectNames.includes(meshName)) return node;
        const found = search(node.children);
        if (found) return found;
      }
      return null;
    }
    return search(partTree);
  }, [partTree]);

  // Find the parent assembly of a leaf node
  const findParentAssembly = useCallback((meshName: string): PartTreeNode | null => {
    function search(nodes: PartTreeNode[], parent: PartTreeNode | null): PartTreeNode | null {
      for (const node of nodes) {
        if (node.meshObjectNames.includes(meshName)) {
          // If this is a leaf inside an assembly, return the assembly
          return parent?.assemblyType ? parent : node;
        }
        const found = search(node.children, node);
        if (found) return found;
      }
      return null;
    }
    return search(partTree, null);
  }, [partTree]);

  const selectPart = useCallback((meshName: string | null, _ctrlKey?: boolean) => {
    if (!meshName) {
      setSelectedPartId(null);
      return;
    }

    // Find the node — default to parent assembly, Ctrl for individual part
    const node = _ctrlKey ? findNodeByMeshName(meshName) : findParentAssembly(meshName);
    if (node) {
      setSelectedPartId(node.id);
      // Auto-expand parent if selecting a child
      if (node.assemblyType) {
        setExpandedIds(prev => prev.includes(node.id) ? prev : [...prev, node.id]);
      }
    }
  }, [findNodeByMeshName, findParentAssembly]);

  const selectNodeById = useCallback((nodeId: string) => {
    setSelectedPartId(nodeId);
  }, []);

  const toggleExpand = useCallback((nodeId: string) => {
    setExpandedIds(prev =>
      prev.includes(nodeId)
        ? prev.filter(id => id !== nodeId)
        : [...prev, nodeId]
    );
  }, []);

  const toggleExplode = useCallback((nodeId: string) => {
    setExpandedAssemblyIds(prev =>
      prev.includes(nodeId)
        ? prev.filter(id => id !== nodeId)
        : [...prev, nodeId]
    );
    // Also expand in tree view
    setExpandedIds(prev =>
      prev.includes(nodeId) ? prev : [...prev, nodeId]
    );
  }, []);

  const clearSelection = useCallback(() => {
    setSelectedPartId(null);
  }, []);

  const getSelectedNode = useCallback((): PartTreeNode | null => {
    if (!selectedPartId) return null;
    return findNodeById(selectedPartId);
  }, [selectedPartId, findNodeById]);

  return {
    selectedPartId,
    expandedIds,
    expandedAssemblyIds,
    selectPart,
    selectNodeById,
    toggleExpand,
    toggleExplode,
    clearSelection,
    getSelectedNode,
  };
}
