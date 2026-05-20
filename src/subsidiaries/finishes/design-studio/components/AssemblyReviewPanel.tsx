import { useState, useCallback } from 'react';
import { Package, GripVertical, Check, RotateCcw, ChevronDown, ChevronRight } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import type { AssemblyGroup, PartTreeNode } from '../types/workshop-viewer.types';

const CATEGORY_COLORS: Record<string, string> = {
  carcase: 'bg-blue-100 text-blue-800',
  fixed_shelves: 'bg-green-100 text-green-800',
  mobile_shelves: 'bg-emerald-100 text-emerald-800',
  drawer_box: 'bg-amber-100 text-amber-800',
  drawer_front: 'bg-orange-100 text-orange-800',
  door: 'bg-purple-100 text-purple-800',
  cover: 'bg-pink-100 text-pink-800',
  hardware: 'bg-slate-100 text-slate-800',
  other: 'bg-gray-100 text-gray-800',
};

const CONFIDENCE_ICONS: Record<string, string> = {
  high: 'text-green-500',
  medium: 'text-amber-500',
  low: 'text-red-400',
};

interface AssemblyReviewPanelProps {
  groups: AssemblyGroup[];
  partTree: PartTreeNode[];
  isConfirmed: boolean;
  onMovePart: (partId: string, fromGroupId: string, toGroupId: string) => void;
  onConfirm: () => void;
  onReset: () => void;
  onGroupHover?: (groupId: string | null) => void;
  onPartSelect?: (partId: string | null) => void;
}

export default function AssemblyReviewPanel({
  groups,
  partTree,
  isConfirmed,
  onMovePart,
  onConfirm,
  onReset,
  onGroupHover,
  onPartSelect,
}: AssemblyReviewPanelProps) {
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set(groups.map(g => g.id)));
  const [dragState, setDragState] = useState<{ partId: string; fromGroupId: string } | null>(null);
  const [dropTargetId, setDropTargetId] = useState<string | null>(null);

  // Resolve part name from ID
  const findPartName = useCallback((partId: string): string => {
    function search(nodes: PartTreeNode[]): string | null {
      for (const n of nodes) {
        if (n.id === partId) return n.name;
        const found = search(n.children || []);
        if (found) return found;
      }
      return null;
    }
    return search(partTree) || partId;
  }, [partTree]);

  const toggleGroup = (groupId: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupId)) next.delete(groupId);
      else next.add(groupId);
      return next;
    });
  };

  const handleDragStart = (e: React.DragEvent, partId: string, groupId: string) => {
    e.dataTransfer.setData('text/plain', partId);
    setDragState({ partId, fromGroupId: groupId });
  };

  const handleDragOver = (e: React.DragEvent, groupId: string) => {
    e.preventDefault();
    setDropTargetId(groupId);
    onGroupHover?.(groupId);
  };

  const handleDragLeave = () => {
    setDropTargetId(null);
    onGroupHover?.(null);
  };

  const handleDrop = (e: React.DragEvent, toGroupId: string) => {
    e.preventDefault();
    if (dragState && dragState.fromGroupId !== toGroupId) {
      onMovePart(dragState.partId, dragState.fromGroupId, toGroupId);
    }
    setDragState(null);
    setDropTargetId(null);
    onGroupHover?.(null);
  };

  const totalParts = groups.reduce((sum, g) => sum + g.partIds.length, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 py-2 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <Package className="w-3.5 h-3.5 text-primary" />
            <span className="text-xs font-medium text-foreground">
              Assembly Groups
            </span>
          </div>
          <span className="text-[10px] text-muted-foreground">
            {groups.length} groups, {totalParts} parts
          </span>
        </div>
        {!isConfirmed && (
          <p className="text-[10px] text-muted-foreground mt-1">
            Drag parts between groups to adjust. Confirm when ready.
          </p>
        )}
      </div>

      {/* Groups list */}
      <div className="flex-1 overflow-auto">
        {groups.map(group => (
          <div
            key={group.id}
            className={`border-b border-border ${dropTargetId === group.id ? 'bg-primary/10' : ''}`}
            onDragOver={(e) => handleDragOver(e, group.id)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDrop(e, group.id)}
            onMouseEnter={() => onGroupHover?.(group.id)}
            onMouseLeave={() => onGroupHover?.(null)}
          >
            {/* Group header */}
            <button
              className="w-full flex items-center gap-1.5 px-3 py-2 hover:bg-muted text-left"
              onClick={() => toggleGroup(group.id)}
            >
              {expandedGroups.has(group.id) ? (
                <ChevronDown className="w-3 h-3 text-muted-foreground" />
              ) : (
                <ChevronRight className="w-3 h-3 text-muted-foreground" />
              )}
              <span className={`text-[9px] px-1.5 py-0.5 rounded font-medium ${CATEGORY_COLORS[group.category] || CATEGORY_COLORS.other}`}>
                {group.category.replace(/_/g, ' ').toUpperCase()}
              </span>
              <span className="text-xs font-medium text-foreground flex-1 truncate">
                {group.name}
              </span>
              <span className="text-[10px] text-muted-foreground">
                {group.partIds.length}
              </span>
              <span className={`w-1.5 h-1.5 rounded-full ${CONFIDENCE_ICONS[group.confidence]?.replace('text-', 'bg-') || 'bg-gray-300'}`} />
            </button>

            {/* Parts list */}
            {expandedGroups.has(group.id) && (
              <div className="pb-1">
                {group.partIds.map(partId => (
                  <div
                    key={partId}
                    draggable={!isConfirmed}
                    onDragStart={(e) => handleDragStart(e, partId, group.id)}
                    onClick={() => onPartSelect?.(partId)}
                    className={`flex items-center gap-1.5 px-4 py-1 text-xs cursor-pointer hover:bg-muted ${
                      dragState?.partId === partId ? 'opacity-50' : ''
                    }`}
                  >
                    {!isConfirmed && (
                      <GripVertical className="w-3 h-3 text-muted-foreground/50 cursor-grab" />
                    )}
                    <span className="text-muted-foreground truncate">
                      {findPartName(partId)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="p-2 border-t border-border flex gap-2">
        {isConfirmed ? (
          <div className="flex items-center gap-2 text-xs text-green-600 flex-1">
            <Check className="w-3.5 h-3.5" />
            Groups confirmed
          </div>
        ) : (
          <Button size="sm" className="flex-1 text-xs" onClick={onConfirm}>
            <Check className="w-3 h-3 mr-1" />
            Confirm Groups
          </Button>
        )}
        <Button size="sm" variant="outline" className="text-xs" onClick={onReset}>
          <RotateCcw className="w-3 h-3" />
        </Button>
      </div>
    </div>
  );
}
