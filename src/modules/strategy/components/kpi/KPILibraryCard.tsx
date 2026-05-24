/**
 * KPI Library Card
 * Displays a single KPI library entry with formula, badges, and tracking action.
 */

import { ArrowUp, ArrowDown, Target, Check, Plus } from 'lucide-react';
import { KPI_CATEGORY_LABELS, KPI_DIRECTION, KPI_FREQUENCY_LABELS } from '../../constants/kpi.constants';
import { BSC_PERSPECTIVE_LABELS } from '../../constants/kpi.constants';
import type { KPILibraryEntry } from '../../constants/kpiLibrary.constants';
import { ModuleLinkBadge } from './ModuleLinkBadge';

interface KPILibraryCardProps {
  entry: KPILibraryEntry;
  isTracked: boolean;
  onAddToTracking: (entry: KPILibraryEntry) => void;
}

function DirectionIcon({ direction }: { direction: string }) {
  switch (direction) {
    case KPI_DIRECTION.HIGHER_IS_BETTER:
      return <ArrowUp className="w-3.5 h-3.5 text-green-600" />;
    case KPI_DIRECTION.LOWER_IS_BETTER:
      return <ArrowDown className="w-3.5 h-3.5 text-red-500" />;
    case KPI_DIRECTION.TARGET_IS_BEST:
    case KPI_DIRECTION.RANGE_IS_BEST:
      return <Target className="w-3.5 h-3.5 text-blue-500" />;
    default:
      return null;
  }
}

function directionLabel(direction: string): string {
  switch (direction) {
    case KPI_DIRECTION.HIGHER_IS_BETTER:
      return 'Higher is better';
    case KPI_DIRECTION.LOWER_IS_BETTER:
      return 'Lower is better';
    case KPI_DIRECTION.TARGET_IS_BEST:
      return 'Target is best';
    case KPI_DIRECTION.RANGE_IS_BEST:
      return 'Range is best';
    default:
      return '';
  }
}

export function KPILibraryCard({ entry, isTracked, onAddToTracking }: KPILibraryCardProps) {
  return (
    <div className="bg-card rounded-lg border border-[var(--border-subtle)] p-4 hover:shadow-md transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-xs font-mono text-[var(--fg-tertiary)] bg-[var(--bg-sunken)] px-1.5 py-0.5 rounded">
              {entry.code}
            </span>
            <div className="flex items-center gap-1" title={directionLabel(entry.direction)}>
              <DirectionIcon direction={entry.direction} />
            </div>
          </div>
          <h3 className="text-sm font-semibold text-foreground leading-tight">{entry.name}</h3>
        </div>

        {/* Tracking button */}
        {isTracked ? (
          <span className="flex items-center gap-1 text-xs font-medium text-green-700 bg-green-50 border border-green-200 rounded-full px-2.5 py-1 shrink-0">
            <Check className="w-3 h-3" />
            Tracked
          </span>
        ) : (
          <button
            onClick={() => onAddToTracking(entry)}
            className="flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-1 hover:bg-blue-100 transition-colors shrink-0"
          >
            <Plus className="w-3 h-3" />
            Track
          </button>
        )}
      </div>

      {/* Description */}
      <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{entry.description}</p>

      {/* Formula */}
      <div className="bg-[var(--bg-sunken)] rounded-md px-3 py-2 mb-3">
        <p className="text-xs text-[var(--fg-tertiary)] font-medium mb-0.5">Formula</p>
        <p className="text-xs text-muted-foreground font-mono leading-relaxed">{entry.formula}</p>
      </div>

      {/* Tags row */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="text-[10px] font-medium text-muted-foreground bg-[var(--bg-sunken)] rounded-full px-2 py-0.5">
          {KPI_CATEGORY_LABELS[entry.category] || entry.category}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground bg-[var(--bg-sunken)] rounded-full px-2 py-0.5">
          {BSC_PERSPECTIVE_LABELS[entry.bscPerspective] || entry.bscPerspective}
        </span>
        <span className="text-[10px] font-medium text-muted-foreground bg-[var(--bg-sunken)] rounded-full px-2 py-0.5">
          {KPI_FREQUENCY_LABELS[entry.frequency] || entry.frequency}
        </span>
        {entry.moduleLinkage && (
          <ModuleLinkBadge linkage={entry.moduleLinkage} showLink={false} />
        )}
      </div>
    </div>
  );
}
