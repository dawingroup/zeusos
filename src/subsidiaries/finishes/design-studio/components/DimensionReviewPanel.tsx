// src/modules/workshop-viewer/components/DimensionReviewPanel.tsx
import { useMemo } from 'react';
import type { ManagedDimension } from '../types/dimension.types';
import { groupByTier } from '../services/dimensionManager';

interface DimensionReviewPanelProps {
  dimensions: ManagedDimension[];
  onToggleVisibility: (dimId: string, visible: boolean) => void;
  onToggleTier: (tier: string, visible: boolean) => void;
  onDeleteUserDim: (dimId: string) => void;
  onActivateMeasureTool: () => void;
  onResetOverrides: () => void;
  measureToolActive: boolean;
  selectedDimId: string | null;
  onSelectDim: (dimId: string | null) => void;
}

const TIER_LABELS: Record<string, string> = {
  overall: 'Overall (Tier 1)',
  intermediate: 'Intermediate (Tier 2)',
  detail: 'Detail (Tier 3)',
  manual: 'User Dimensions',
};

export function DimensionReviewPanel({
  dimensions,
  onToggleVisibility,
  onToggleTier,
  onDeleteUserDim,
  onActivateMeasureTool,
  onResetOverrides,
  measureToolActive,
  selectedDimId,
  onSelectDim,
}: DimensionReviewPanelProps) {
  const grouped = useMemo(() => groupByTier(dimensions), [dimensions]);

  return (
    <div className="flex flex-col gap-3 p-3 text-sm">
      {Object.entries(grouped).map(([tier, dims]) => {
        if (dims.length === 0) return null;
        const allVisible = dims.every((d) => d.visible);
        const someVisible = dims.some((d) => d.visible);

        return (
          <div key={tier} className="space-y-1">
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                <input
                  type="checkbox"
                  checked={allVisible}
                  ref={(el) => { if (el) el.indeterminate = someVisible && !allVisible; }}
                  onChange={(e) => onToggleTier(tier, e.target.checked)}
                  className="rounded"
                />
                {TIER_LABELS[tier] ?? tier}
              </label>
              <span className="text-xs text-muted-foreground">{dims.length}</span>
            </div>

            {dims.map((dim) => (
              <div
                key={dim.id}
                className={`flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-muted/50 transition-colors ${selectedDimId === dim.id ? 'bg-muted' : ''}`}
                onClick={() => onSelectDim(selectedDimId === dim.id ? null : dim.id)}
              >
                <input
                  type="checkbox"
                  checked={dim.visible}
                  onChange={(e) => { e.stopPropagation(); onToggleVisibility(dim.id, e.target.checked); }}
                  className="rounded flex-shrink-0"
                />
                <span
                  className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                  style={{ backgroundColor: dim.color }}
                />
                <span className={`flex-1 font-mono text-xs ${!dim.visible ? 'opacity-40 line-through' : ''}`}>
                  {dim.label} mm
                </span>
                {dim.type === 'user' && (
                  <button
                    className="text-xs text-destructive hover:text-destructive/80 leading-none"
                    onClick={(e) => { e.stopPropagation(); onDeleteUserDim(dim.id); }}
                    title="Delete dimension"
                  >
                    &times;
                  </button>
                )}
              </div>
            ))}
          </div>
        );
      })}

      {dimensions.length === 0 && (
        <div className="text-xs text-muted-foreground py-2">
          Load a model to see dimensions
        </div>
      )}

      <div className="flex gap-2 pt-2 border-t">
        <button
          className={`flex-1 px-3 py-1.5 text-xs rounded-md border transition-colors ${
            measureToolActive
              ? 'bg-cyan-500/10 border-cyan-500 text-cyan-700 dark:text-cyan-400'
              : 'border-input hover:bg-muted'
          }`}
          onClick={onActivateMeasureTool}
        >
          {measureToolActive ? '✓ Measuring... (Esc to cancel)' : '+ Add Dimension'}
        </button>
        <button
          className="px-3 py-1.5 text-xs rounded-md border border-input hover:bg-muted"
          onClick={onResetOverrides}
          title="Reset all visibility overrides"
        >
          Reset
        </button>
      </div>
    </div>
  );
}
