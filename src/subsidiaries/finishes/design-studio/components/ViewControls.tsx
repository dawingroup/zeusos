/**
 * ViewControls — View preset buttons, display toggles, hidden line control
 */

import { RotateCcw, Ruler, Grid, Expand } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import type { ViewerState, HiddenLineMode } from '../types/workshop-viewer.types';
// VIEW_PRESETS used for label rendering (keys match props)

interface ViewControlsProps {
  viewerState: ViewerState;
  onViewChange: (view: string) => void;
  onToggleEdges: () => void;
  onToggleDimensions: () => void;
  onHiddenLineModeChange: (mode: HiddenLineMode) => void;
  onResetView: () => void;
  onExplodeToggle?: () => void;
  canExplode: boolean;
}

const ORTHO_VIEWS = [
  { key: 'front',  label: 'F' },
  { key: 'back',   label: 'B' },
  { key: 'right',  label: 'R' },
  { key: 'left',   label: 'L' },
  { key: 'top',    label: 'P' },
  { key: 'bottom', label: 'Bt' },
];

const ISO_VIEWS = [
  { key: 'iso',     label: 'SW' },
  { key: 'isoBack', label: 'NE' },
];

export default function ViewControls({
  viewerState,
  onViewChange,
  onToggleEdges,
  onToggleDimensions,
  onHiddenLineModeChange,
  onResetView,
  onExplodeToggle,
  canExplode,
}: ViewControlsProps) {
  return (
    <div className="flex flex-col gap-3 p-3">
      {/* Ortho presets */}
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-1.5">ORTHO</div>
        <div className="grid grid-cols-3 gap-1">
          {ORTHO_VIEWS.map(v => (
            <Button
              key={v.key}
              variant={viewerState.currentView === v.key ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-7"
              onClick={() => onViewChange(v.key)}
            >
              {v.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Iso presets */}
      <div>
        <div className="text-xs font-medium text-muted-foreground mb-1.5">ISOMETRIC</div>
        <div className="grid grid-cols-2 gap-1">
          {ISO_VIEWS.map(v => (
            <Button
              key={v.key}
              variant={viewerState.currentView === v.key ? 'default' : 'outline'}
              size="sm"
              className="text-xs h-7"
              onClick={() => onViewChange(v.key)}
            >
              {v.label}
            </Button>
          ))}
        </div>
      </div>

      {/* Display toggles */}
      <div className="border-t pt-3 space-y-1.5">
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={viewerState.showEdges}
            onChange={onToggleEdges}
            className="rounded border-border"
          />
          <Grid className="w-3.5 h-3.5" />
          Edges
        </label>
        <label className="flex items-center gap-2 text-xs cursor-pointer">
          <input
            type="checkbox"
            checked={viewerState.showDimensions}
            onChange={onToggleDimensions}
            className="rounded border-border"
          />
          <Ruler className="w-3.5 h-3.5" />
          Dimensions
        </label>
      </div>

      {/* Hidden lines */}
      <div className="border-t pt-3">
        <div className="text-xs font-medium text-muted-foreground mb-1.5">HIDDEN LINES</div>
        <div className="flex gap-1">
          <Button
            variant={viewerState.hiddenLineMode === 'faint' ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-7 flex-1"
            onClick={() => onHiddenLineModeChange('faint')}
          >
            Faint
          </Button>
          <Button
            variant={viewerState.hiddenLineMode === 'hidden' ? 'default' : 'outline'}
            size="sm"
            className="text-xs h-7 flex-1"
            onClick={() => onHiddenLineModeChange('hidden')}
          >
            Off
          </Button>
        </div>
      </div>

      {/* Explode */}
      {canExplode && (
        <Button
          variant="outline"
          size="sm"
          className="text-xs h-8 w-full"
          onClick={onExplodeToggle}
        >
          <Expand className="w-3.5 h-3.5 mr-1.5" />
          Explode
        </Button>
      )}

      {/* Reset */}
      <Button
        variant="ghost"
        size="sm"
        className="text-xs h-7 w-full"
        onClick={onResetView}
      >
        <RotateCcw className="w-3.5 h-3.5 mr-1" />
        Reset View
      </Button>
    </div>
  );
}
