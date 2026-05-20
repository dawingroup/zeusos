/**
 * GizmoModeToggle — inline overlay pill for switching the cabinet
 * gizmo between translate and rotate modes.
 *
 * Lives at the bottom-left of the viewport so it doesn't fight with
 * the Positioning panel (right) or the NudgePad (bottom-right). Only
 * rendered when a cabinet is selected (otherwise there's no gizmo to
 * toggle).
 */
import { Move, RotateCw } from 'lucide-react';
import type { GizmoMode } from '../../hooks/useCabinetGizmo';

interface GizmoModeToggleProps {
  visible: boolean;
  mode: GizmoMode;
  onChange: (mode: GizmoMode) => void;
}

export function GizmoModeToggle({ visible, mode, onChange }: GizmoModeToggleProps) {
  if (!visible) return null;
  // Positioning is now owned by the parent (AutoFramingViewport's
  // edit-mode row), so this component only renders the inline pill.
  return (
    <div className="flex items-center gap-0.5 p-1 rounded-full bg-card/95 backdrop-blur border border-border shadow-lg">
      <PillButton
        label="Translate"
        active={mode === 'translate'}
        onClick={() => onChange('translate')}
        icon={<Move className="h-3.5 w-3.5" />}
        shortcut="G"
      />
      <PillButton
        label="Rotate"
        active={mode === 'rotate'}
        onClick={() => onChange('rotate')}
        icon={<RotateCw className="h-3.5 w-3.5" />}
        shortcut="R"
      />
    </div>
  );
}

interface PillButtonProps {
  label: string;
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  shortcut: string;
}

function PillButton({ label, active, onClick, icon, shortcut }: PillButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${label} (${shortcut})`}
      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
        active
          ? 'bg-primary text-primary-foreground shadow-sm'
          : 'text-muted-foreground hover:text-foreground hover:bg-accent'
      }`}
    >
      {icon}
      <span>{label}</span>
      <kbd className={`ml-1 px-1 text-[9px] font-mono rounded ${
        active ? 'bg-primary-foreground/20' : 'bg-accent text-muted-foreground'
      }`}>
        {shortcut}
      </kbd>
    </button>
  );
}
