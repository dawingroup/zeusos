/**
 * LeftToolbar — Compact vertical toolbar for view controls
 *
 * Sections:
 *   - Navigation Cube (3D iso views, NW/NE/SW/SE)
 *   - Orthographic views (Front/Back/Left/Right/Top/Bottom) with axis-aware icons
 *   - Display toggles (edges, dimensions, hidden lines)
 *   - Actions (explode, reset, upload)
 */

import {
  RotateCcw, Grid, Ruler, Expand, EyeOff, Eye, Upload,
  ArrowUp, ArrowDown, ChevronUpIcon,
  Box as BoxIcon, RectangleHorizontal, RectangleVertical,
} from 'lucide-react';
import type { ViewerState, HiddenLineMode } from '../types/workshop-viewer.types';

interface LeftToolbarProps {
  viewerState: ViewerState;
  onViewChange: (view: string) => void;
  onToggleEdges: () => void;
  onToggleDimensions: () => void;
  onHiddenLineModeChange: (mode: HiddenLineMode) => void;
  onResetView: () => void;
  onExplodeToggle?: () => void;
  canExplode: boolean;
  onUploadClick?: () => void;
  hasModel: boolean;
}

interface ViewDef {
  key: string;
  label: string;
  title: string;
  icon: typeof ArrowUp;
}

// Orthographic view definitions with directional icons
const ORTHO_VIEWS: ViewDef[] = [
  { key: 'front', label: 'Front', title: 'Front Elevation', icon: RectangleVertical },
  { key: 'back', label: 'Back', title: 'Back Elevation', icon: RectangleVertical },
  { key: 'left', label: 'Left', title: 'Left Elevation', icon: RectangleHorizontal },
  { key: 'right', label: 'Right', title: 'Right Elevation', icon: RectangleHorizontal },
  { key: 'top', label: 'Top', title: 'Plan (Top View)', icon: ChevronUpIcon },
  { key: 'bottom', label: 'Bot', title: 'Bottom View', icon: ArrowDown },
];

// Isometric view definitions
const ISO_VIEWS: ViewDef[] = [
  { key: 'iso', label: 'SW Iso', title: 'Isometric — South-West', icon: BoxIcon },
  { key: 'isoBack', label: 'NE Iso', title: 'Isometric — North-East', icon: BoxIcon },
];

function ViewIconBtn({
  active, onClick, title, label, icon: Icon, disabled,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  label: string;
  icon: typeof ArrowUp;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onClick()}
      title={title}
      disabled={disabled}
      className={`
        w-12 py-1 flex flex-col items-center gap-0.5 rounded-md
        transition-all duration-100
        ${active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : disabled
            ? 'text-muted-foreground/40 cursor-not-allowed'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent'
        }
      `}
    >
      <Icon className="h-3.5 w-3.5" />
      <span className="text-[8px] font-medium leading-none">{label}</span>
    </button>
  );
}

function IconBtn({
  active, onClick, title, children, disabled,
}: {
  active?: boolean;
  onClick: () => void;
  title: string;
  children: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={() => !disabled && onClick()}
      title={title}
      disabled={disabled}
      className={`
        w-10 h-10 flex items-center justify-center rounded-lg
        transition-all duration-100
        ${active
          ? 'bg-primary/15 text-primary border border-primary/30'
          : disabled
            ? 'text-muted-foreground/40 cursor-not-allowed border border-transparent'
            : 'text-muted-foreground hover:text-foreground hover:bg-accent border border-transparent'
        }
      `}
    >
      {children}
    </button>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[8px] font-bold text-muted-foreground/70 uppercase tracking-widest mb-1 mt-1">
      {children}
    </span>
  );
}

export default function LeftToolbar({
  viewerState,
  onViewChange,
  onToggleEdges,
  onToggleDimensions,
  onHiddenLineModeChange,
  onResetView,
  onExplodeToggle,
  canExplode,
  onUploadClick,
  hasModel,
}: LeftToolbarProps) {
  return (
    <div className="w-12 sm:w-14 flex flex-col items-center py-2 gap-0 bg-card border-r border-border shrink-0 overflow-y-auto shadow-sm">
      {/* ISOMETRIC */}
      <SectionLabel>Iso</SectionLabel>
      {ISO_VIEWS.map(v => (
        <ViewIconBtn
          key={v.key}
          active={viewerState.currentView === v.key}
          onClick={() => onViewChange(v.key)}
          title={v.title}
          label={v.label}
          icon={v.icon}
          disabled={!hasModel}
        />
      ))}

      {/* Divider */}
      <div className="w-9 border-t border-border/60 my-1.5" />

      {/* ORTHOGRAPHIC */}
      <SectionLabel>Ortho</SectionLabel>
      {ORTHO_VIEWS.map(v => (
        <ViewIconBtn
          key={v.key}
          active={viewerState.currentView === v.key}
          onClick={() => onViewChange(v.key)}
          title={v.title}
          label={v.label}
          icon={v.icon}
          disabled={!hasModel}
        />
      ))}

      {/* Divider */}
      <div className="w-9 border-t border-border/60 my-1.5" />

      {/* DISPLAY */}
      <SectionLabel>Show</SectionLabel>
      <IconBtn
        active={viewerState.showEdges}
        onClick={onToggleEdges}
        title="Edges"
        disabled={!hasModel}
      >
        <Grid className="h-4 w-4" />
      </IconBtn>

      <IconBtn
        active={viewerState.showDimensions}
        onClick={onToggleDimensions}
        title="Dimensions"
        disabled={!hasModel}
      >
        <Ruler className="h-4 w-4" />
      </IconBtn>

      <IconBtn
        active={viewerState.hiddenLineMode === 'faint'}
        onClick={() => onHiddenLineModeChange(viewerState.hiddenLineMode === 'faint' ? 'hidden' : 'faint')}
        title={`Hidden lines: ${viewerState.hiddenLineMode}`}
        disabled={!hasModel}
      >
        {viewerState.hiddenLineMode === 'faint' ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
      </IconBtn>

      {/* Divider */}
      <div className="w-9 border-t border-border/60 my-1.5" />

      {/* ACTIONS */}
      <SectionLabel>Tools</SectionLabel>
      {onExplodeToggle && (
        <IconBtn
          onClick={onExplodeToggle}
          title="Explode assembly"
          disabled={!canExplode}
        >
          <Expand className="h-4 w-4" />
        </IconBtn>
      )}

      <IconBtn
        onClick={onResetView}
        title="Reset view"
        disabled={!hasModel}
      >
        <RotateCcw className="h-4 w-4" />
      </IconBtn>

      {/* Push upload to bottom */}
      <div className="flex-1" />

      {onUploadClick && (
        <IconBtn onClick={onUploadClick} title="Upload model">
          <Upload className="h-4 w-4" />
        </IconBtn>
      )}
    </div>
  );
}
