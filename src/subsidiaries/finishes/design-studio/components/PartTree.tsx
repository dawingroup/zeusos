/**
 * PartTree — Hierarchical part tree with assembly grouping, explode support,
 * and mesh↔cutlist match indicators.
 */

import { ChevronRight, ChevronDown, Expand, Check, AlertTriangle, X } from 'lucide-react';
import { ScrollArea } from '@/core/components/ui/scroll-area';
import { Badge } from '@/core/components/ui/badge';
import { Button } from '@/core/components/ui/button';
import type { PartTreeNode, MeshCutListLink } from '../types/workshop-viewer.types';

interface PartTreeProps {
  nodes: PartTreeNode[];
  selectedId: string | null;
  expandedIds: string[];
  meshLinks: MeshCutListLink[];
  onSelect: (nodeId: string) => void;
  onToggleExpand: (nodeId: string) => void;
  onExplode: (nodeId: string) => void;
}

function getMatchIndicator(node: PartTreeNode, meshLinks: MeshCutListLink[]) {
  // Check best confidence among this node's mesh objects
  const links = meshLinks.filter(l => node.meshObjectNames.includes(l.meshObjectName));
  if (links.length === 0) return null;

  const hasExact = links.some(l => l.confidence === 'exact');
  const hasFuzzy = links.some(l => l.confidence === 'fuzzy');
  const hasUnmatched = links.some(l => l.confidence === 'unmatched');

  if (hasExact && !hasUnmatched) {
    return <Check className="w-3 h-3 text-green-600 flex-shrink-0" />;
  }
  if (hasFuzzy) {
    return <AlertTriangle className="w-3 h-3 text-yellow-500 flex-shrink-0" />;
  }
  if (hasUnmatched) {
    return <X className="w-3 h-3 text-red-400 flex-shrink-0" />;
  }
  return null;
}

function TreeNode({
  node,
  depth,
  selectedId,
  expandedIds,
  meshLinks,
  onSelect,
  onToggleExpand,
  onExplode,
}: {
  node: PartTreeNode;
  depth: number;
  selectedId: string | null;
  expandedIds: string[];
  meshLinks: MeshCutListLink[];
  onSelect: (id: string) => void;
  onToggleExpand: (id: string) => void;
  onExplode: (id: string) => void;
}) {
  const isSelected = selectedId === node.id;
  const isExpanded = expandedIds.includes(node.id);
  const hasChildren = node.children.length > 0;
  const isAssembly = !!node.assemblyType;
  const isExploded = node.isExpanded;

  const dims = `${Math.round(node.dims.w)}×${Math.round(node.dims.d)}×${Math.round(node.dims.h)}`;

  return (
    <div>
      <div
        className={`flex items-center gap-1 py-1 px-1 rounded cursor-pointer text-xs hover:bg-muted ${
          isSelected ? 'bg-primary/10 text-primary' : ''
        }`}
        style={{ paddingLeft: `${depth * 16 + 4}px` }}
        onClick={() => onSelect(node.id)}
      >
        {/* Expand/collapse toggle */}
        {hasChildren ? (
          <button
            className="w-4 h-4 flex items-center justify-center hover:bg-muted rounded flex-shrink-0"
            onClick={(e) => {
              e.stopPropagation();
              onToggleExpand(node.id);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </button>
        ) : (
          <span className="w-4" />
        )}

        {/* Name */}
        <span className={`flex-1 truncate ${isAssembly ? 'font-medium' : ''}`}>
          {node.name}
        </span>

        {/* Match indicator */}
        {getMatchIndicator(node, meshLinks)}

        {/* Assembly type badge */}
        {isAssembly && (
          <Badge variant="outline" className="text-[9px] h-4 px-1 flex-shrink-0">
            {node.assemblyType?.replace(/_/g, ' ')}
          </Badge>
        )}

        {/* Explode button for assemblies */}
        {isAssembly && (
          <Button
            variant="ghost"
            size="sm"
            className="h-5 w-5 p-0 flex-shrink-0"
            title={isExploded ? 'Collapse' : 'Explode'}
            onClick={(e) => {
              e.stopPropagation();
              onExplode(node.id);
            }}
          >
            <Expand className="w-3 h-3" />
          </Button>
        )}
      </div>

      {/* Dimensions on hover / selected */}
      {isSelected && (
        <div
          className="text-[10px] text-muted-foreground pb-1"
          style={{ paddingLeft: `${depth * 16 + 24}px` }}
        >
          {dims} mm
        </div>
      )}

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              selectedId={selectedId}
              expandedIds={expandedIds}
              meshLinks={meshLinks}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onExplode={onExplode}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default function PartTree({
  nodes,
  selectedId,
  expandedIds,
  meshLinks,
  onSelect,
  onToggleExpand,
  onExplode,
}: PartTreeProps) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-3 py-2 border-b">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          Parts ({countLeaves(nodes)})
        </h3>
      </div>
      <ScrollArea className="flex-1">
        <div className="py-1">
          {nodes.map(node => (
            <TreeNode
              key={node.id}
              node={node}
              depth={0}
              selectedId={selectedId}
              expandedIds={expandedIds}
              meshLinks={meshLinks}
              onSelect={onSelect}
              onToggleExpand={onToggleExpand}
              onExplode={onExplode}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
}

function countLeaves(nodes: PartTreeNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.isLeaf) count++;
    else count += countLeaves(node.children);
  }
  return count;
}
