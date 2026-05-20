/**
 * AssemblyTree — Hierarchical tree view of assemblies within a cabinet
 *
 * Each node expandable to show parts. Selection highlights in viewport.
 */
import { useState, useCallback } from 'react';
import type { SceneAssembly, ScenePart } from '../../types/assembly.types';

interface AssemblyTreeProps {
  assemblies: SceneAssembly[];
  selectedAssemblyId?: string;
  selectedPartId?: string;
  onAssemblySelect?: (assemblyId: string) => void;
  onPartSelect?: (partId: string) => void;
}

const ASSEMBLY_ICONS: Record<string, string> = {
  carcass: 'C',
  drawer_box: 'D',
  door_assembly: 'Dr',
  drawer_front: 'DF',
  shelf_pack: 'S',
  hardware_kit: 'H',
  plinth_assembly: 'P',
  cornice_run: 'Cr',
  panel_run: 'Pn',
  custom: '?',
};

export function AssemblyTree({
  assemblies,
  selectedAssemblyId,
  selectedPartId,
  onAssemblySelect,
  onPartSelect,
}: AssemblyTreeProps) {
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());

  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  if (assemblies.length === 0) {
    return (
      <div className="p-3 text-xs text-gray-400 text-center">
        No assemblies extracted yet
      </div>
    );
  }

  return (
    <div className="text-sm">
      {assemblies.map(assembly => {
        const isExpanded = expandedIds.has(assembly.id);
        const isSelected = assembly.id === selectedAssemblyId;
        const icon = ASSEMBLY_ICONS[assembly.assemblyType] ?? '?';

        return (
          <div key={assembly.id}>
            {/* Assembly node */}
            <div
              className={`flex items-center gap-2 px-2 py-1.5 cursor-pointer rounded ${
                isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50'
              }`}
              onClick={() => onAssemblySelect?.(assembly.id)}
            >
              {/* Expand toggle */}
              <button
                type="button"
                onClick={e => { e.stopPropagation(); toggleExpand(assembly.id); }}
                className="w-4 h-4 flex items-center justify-center text-gray-400"
              >
                {assembly.parts.length > 0 && (
                  <svg
                    className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path d="M6 6l4 4 4-4" />
                  </svg>
                )}
              </button>

              {/* Assembly type badge */}
              <span className="w-6 h-5 flex items-center justify-center text-[10px] font-bold bg-gray-200 text-gray-600 rounded">
                {icon}
              </span>

              {/* Name + count */}
              <span className="flex-1 truncate text-xs font-medium">
                {assembly.displayName}
              </span>
              <span className="text-[10px] text-gray-400">
                {assembly.totalPartCount}p
              </span>

              {/* Completeness indicator */}
              {!assembly.isComplete && (
                <span className="w-2 h-2 rounded-full bg-amber-400" title="Incomplete" />
              )}
            </div>

            {/* Parts (expanded) */}
            {isExpanded && assembly.parts.length > 0 && (
              <div className="ml-6 border-l border-gray-100">
                {assembly.parts.map(part => (
                  <PartNode
                    key={part.id}
                    part={part}
                    isSelected={part.id === selectedPartId}
                    onClick={() => onPartSelect?.(part.id)}
                  />
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function PartNode({
  part,
  isSelected,
  onClick,
}: {
  part: ScenePart;
  isSelected: boolean;
  onClick: () => void;
}) {
  const dims = part.dimensions;
  const dimStr = dims ? `${dims.length}×${dims.width}×${dims.thickness}` : '';

  return (
    <div
      className={`flex items-center gap-2 px-2 py-1 cursor-pointer text-xs ${
        isSelected ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-600'
      }`}
      onClick={onClick}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-gray-300 flex-shrink-0" />
      <span className="flex-1 truncate">{part.partName}</span>
      {dimStr && <span className="text-[10px] text-gray-400 font-mono">{dimStr}</span>}
      <span className="text-[10px] text-gray-400">{part.quantity}{part.unit}</span>
    </div>
  );
}
