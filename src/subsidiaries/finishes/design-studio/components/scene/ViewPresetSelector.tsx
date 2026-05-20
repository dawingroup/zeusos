/**
 * ViewPresetSelector — Compact preset picker for the viewport toolbar
 *
 * Groups presets by type: Iso dropdown, Ortho row, Perspective.
 */
import { useState } from 'react';
import { Box, ChevronDown } from 'lucide-react';
import {
  ISO_PRESETS, ORTHO_PRESETS, PERSPECTIVE_PRESETS, PRESET_LABELS,
  type ViewPresetKey,
} from '../../constants/framing.constants';

interface ViewPresetSelectorProps {
  currentPreset: ViewPresetKey;
  onSelect: (preset: ViewPresetKey) => void;
}

export function ViewPresetSelector({ currentPreset, onSelect }: ViewPresetSelectorProps) {
  const [isoOpen, setIsoOpen] = useState(false);
  const currentIso = ISO_PRESETS.find(p => p === currentPreset);

  return (
    <div className="inline-flex items-center gap-1 rounded-md border border-gray-200 bg-white p-0.5">
      {/* Iso dropdown */}
      <div className="relative">
        <button
          type="button"
          onClick={() => setIsoOpen(!isoOpen)}
          onBlur={() => setTimeout(() => setIsoOpen(false), 150)}
          className={`flex items-center gap-1 px-2 py-1 text-xs rounded ${
            currentIso ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
          title="Isometric views"
        >
          <Box className="w-3 h-3" />
          {currentIso ? PRESET_LABELS[currentIso] : 'Iso'}
          <ChevronDown className="w-2.5 h-2.5" />
        </button>
        {isoOpen && (
          <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-md shadow-lg z-10 min-w-[80px]">
            {ISO_PRESETS.map(p => (
              <button
                key={p}
                type="button"
                onMouseDown={() => {
                  onSelect(p);
                  setIsoOpen(false);
                }}
                className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-50 ${
                  currentPreset === p ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'
                }`}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Ortho presets */}
      <div className="w-px h-4 bg-gray-200" />
      {ORTHO_PRESETS.map(p => (
        <button
          key={p}
          type="button"
          onClick={() => onSelect(p)}
          className={`px-2 py-1 text-xs rounded ${
            currentPreset === p ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
          title={PRESET_LABELS[p]}
        >
          {PRESET_LABELS[p]}
        </button>
      ))}

      {/* Perspective presets */}
      <div className="w-px h-4 bg-gray-200" />
      {PERSPECTIVE_PRESETS.map(p => (
        <button
          key={p}
          type="button"
          onClick={() => onSelect(p)}
          className={`px-2 py-1 text-xs rounded ${
            currentPreset === p ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'
          }`}
          title={PRESET_LABELS[p]}
        >
          {PRESET_LABELS[p]}
        </button>
      ))}
    </div>
  );
}
