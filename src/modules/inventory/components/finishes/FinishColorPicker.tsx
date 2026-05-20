/**
 * FinishColorPicker Component
 * Hex color input with visual preview.
 * Uses a native color input styled to match the app design.
 */

import { useState } from 'react';

interface FinishColorPickerProps {
  value?: string;
  onChange: (hex: string) => void;
  label?: string;
}

const PRESET_COLORS = [
  '#FFFFFF', '#F5F5DC', '#D2B48C', '#8B4513', '#2F1B0E',
  '#000000', '#808080', '#C0C0C0', '#D4AF37', '#CD853F',
  '#F5DEB3', '#FFE4C4', '#FFF8DC', '#FFFACD', '#FAFAD2',
  '#E6E6FA', '#B0C4DE', '#87CEEB', '#4682B4', '#1E3A5F',
  '#228B22', '#556B2F', '#8FBC8F', '#DC143C', '#800020',
];

export function FinishColorPicker({ value, onChange, label }: FinishColorPickerProps) {
  const [hexInput, setHexInput] = useState(value || '');

  const handleHexChange = (hex: string) => {
    setHexInput(hex);
    if (/^#[0-9A-Fa-f]{6}$/.test(hex)) {
      onChange(hex);
    }
  };

  const handleColorInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const hex = e.target.value.toUpperCase();
    setHexInput(hex);
    onChange(hex);
  };

  return (
    <div className="space-y-2">
      {label && (
        <label className="block text-sm font-medium text-gray-700">{label}</label>
      )}

      <div className="flex items-center gap-3">
        {/* Native color picker */}
        <div className="relative">
          <input
            type="color"
            value={value || '#CCCCCC'}
            onChange={handleColorInputChange}
            className="w-10 h-10 rounded-lg border border-gray-300 cursor-pointer p-0.5"
          />
        </div>

        {/* Hex input */}
        <input
          type="text"
          value={hexInput}
          onChange={(e) => handleHexChange(e.target.value.toUpperCase())}
          placeholder="#000000"
          maxLength={7}
          className="w-28 px-3 py-2 border border-gray-300 rounded-md text-sm font-mono focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
        />

        {/* Preview swatch */}
        {value && (
          <div
            className="w-10 h-10 rounded-lg border border-gray-200 shadow-sm"
            style={{ backgroundColor: value }}
          />
        )}
      </div>

      {/* Preset colors */}
      <div className="flex flex-wrap gap-1.5 pt-1">
        {PRESET_COLORS.map(color => (
          <button
            key={color}
            type="button"
            onClick={() => { setHexInput(color); onChange(color); }}
            className={`w-6 h-6 rounded-md border transition-transform hover:scale-110 ${
              value === color ? 'border-blue-500 ring-2 ring-blue-200' : 'border-gray-300'
            }`}
            style={{ backgroundColor: color }}
            title={color}
          />
        ))}
      </div>
    </div>
  );
}
