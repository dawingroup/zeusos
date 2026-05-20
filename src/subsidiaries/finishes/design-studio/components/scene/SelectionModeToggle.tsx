/**
 * SelectionModeToggle — Segmented control for selection scope
 *
 * Switches between Project / Cabinet / Assembly / Part selection.
 */
import { SELECTION_MODES, type SelectionMode } from '../../constants/scene.constants';

interface SelectionModeToggleProps {
  mode: SelectionMode;
  onChange: (mode: SelectionMode) => void;
}

const MODE_LABELS: Record<SelectionMode, string> = {
  project: 'Project',
  cabinet: 'Cabinet',
  assembly: 'Assembly',
  part: 'Part',
};

export function SelectionModeToggle({ mode, onChange }: SelectionModeToggleProps) {
  return (
    <div className="inline-flex rounded-md border border-gray-200 bg-gray-50 p-0.5">
      {SELECTION_MODES.map(m => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`px-2.5 py-1 text-xs font-medium rounded transition-colors ${
            mode === m
              ? 'bg-white text-blue-700 shadow-sm'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {MODE_LABELS[m]}
        </button>
      ))}
    </div>
  );
}
