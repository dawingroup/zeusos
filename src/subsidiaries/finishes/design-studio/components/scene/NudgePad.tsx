/**
 * NudgePad — touch-only directional pad for cabinet nudging.
 *
 * Phase 4 ships a stub shell so the integration points are in place;
 * Phase 6 (input adapter + touch support) wires the touch-only
 * show/hide, step selector, and hit targets (44×44px per Apple HIG).
 *
 * Desktop users can ignore this — arrow-key nudging via
 * `useKeyboardShortcuts` is the equivalent flow.
 */
import { ChevronLeft, ChevronRight, ChevronUp, ChevronDown } from 'lucide-react';
import { NUDGE_STEP_MM, POSITION_GRID_MM } from '../../constants/scene.constants';
import type { SceneCabinet, CabinetPosition } from '../../types/scene.types';

const quantise = (v: number) => Math.round(v / POSITION_GRID_MM) * POSITION_GRID_MM;

export type NudgeStep = 'fine' | 'default' | 'coarse';

const STEP_MM: Record<NudgeStep, number> = {
  fine: 1,
  default: NUDGE_STEP_MM,
  coarse: NUDGE_STEP_MM * 10,
};

interface NudgePadProps {
  visible: boolean;
  cabinets: SceneCabinet[];
  selectedIds: string[];
  step: NudgeStep;
  onStepChange: (step: NudgeStep) => void;
  onMove: (cabinetId: string, position: CabinetPosition, rotation?: number) => Promise<void>;
}

export function NudgePad({
  visible, cabinets, selectedIds, step, onStepChange, onMove,
}: NudgePadProps) {
  if (!visible || selectedIds.length === 0) return null;

  const stepMm = STEP_MM[step];

  const nudge = (dx: number, dz: number) => {
    const targets = cabinets.filter(c => selectedIds.includes(c.id));
    for (const c of targets) {
      if (c.isLocked) continue;
      const locks = c.position?.axisLocks ?? {};
      const next: CabinetPosition = {
        ...(c.position ?? { x: 0, y: 0, z: 0 }),
        x: quantise((c.position?.x ?? 0) + (locks.x ? 0 : dx)),
        z: quantise((c.position?.z ?? 0) + (locks.z ? 0 : dz)),
      };
      onMove(c.id, next, c.rotation).catch(err =>
        console.warn('[NudgePad] nudge failed:', err),
      );
    }
  };

  return (
    <div
      className="fixed z-40 flex flex-col items-center gap-2 p-2 rounded-lg bg-card/95 backdrop-blur border border-border shadow-lg"
      style={{ right: 'max(3.5rem, calc(0.75rem + env(safe-area-inset-right)))', bottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
    >
      <div className="flex gap-0.5 text-[10px]">
        {(['fine', 'default', 'coarse'] as NudgeStep[]).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => onStepChange(s)}
            className={`px-1.5 py-0.5 rounded ${step === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'}`}
          >
            {STEP_MM[s]}mm
          </button>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1">
        <div />
        <PadButton icon={ChevronUp} onClick={() => nudge(0, -stepMm)} />
        <div />
        <PadButton icon={ChevronLeft} onClick={() => nudge(-stepMm, 0)} />
        <div className="w-11 h-11 flex items-center justify-center text-[9px] text-muted-foreground font-mono">
          {stepMm}mm
        </div>
        <PadButton icon={ChevronRight} onClick={() => nudge(stepMm, 0)} />
        <div />
        <PadButton icon={ChevronDown} onClick={() => nudge(0, stepMm)} />
        <div />
      </div>
    </div>
  );
}

function PadButton({ icon: Icon, onClick }: { icon: typeof ChevronLeft; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-11 h-11 flex items-center justify-center rounded-md bg-accent hover:bg-accent/80 text-foreground active:scale-95 transition-transform"
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}
