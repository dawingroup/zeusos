/**
 * Space Parameters Section Component
 * Area input with capacity calculation
 */

import { useMemo } from 'react';
import { Calculator, Users } from 'lucide-react';

interface SpaceParametersSectionProps {
  params: {
    totalArea: number;
    areaUnit: 'sqm' | 'sqft';
    spaceType: string;
    circulationPercent: number;
    calculatedCapacity?: {
      minimum: number;
      optimal: number;
      maximum: number;
    };
  };
  onUpdate: (params: SpaceParametersSectionProps['params']) => void;
}

const SPACE_TYPES = [
  { value: 'fine-dining', label: 'Fine Dining', sqftPerSeat: { min: 20, opt: 17.5, max: 15 } },
  { value: 'casual-dining', label: 'Casual Dining', sqftPerSeat: { min: 15, opt: 13.5, max: 12 } },
  { value: 'fast-casual', label: 'Fast Casual', sqftPerSeat: { min: 12, opt: 11, max: 10 } },
  { value: 'hotel-lobby', label: 'Hotel Lobby', sqftPerSeat: { min: 35, opt: 30, max: 25 } },
  { value: 'office', label: 'Office', sqftPerSeat: { min: 150, opt: 125, max: 100 } },
  { value: 'retail', label: 'Retail', sqftPerSeat: { min: 50, opt: 40, max: 30 } },
  { value: 'restaurant', label: 'Restaurant (General)', sqftPerSeat: { min: 18, opt: 15, max: 12 } },
];

export function SpaceParametersSection({ params, onUpdate }: SpaceParametersSectionProps) {
  // Safety check: provide default values if undefined
  const safeParams = params || { totalArea: 0, areaUnit: 'sqft' as const, spaceType: '', circulationPercent: 25 };

  // Convert to sqft for calculations
  const areaInSqft = useMemo(() => {
    return safeParams.areaUnit === 'sqm' ? safeParams.totalArea * 10.764 : safeParams.totalArea;
  }, [safeParams.totalArea, safeParams.areaUnit]);

  // Calculate usable area after circulation
  const usableArea = useMemo(() => {
    return areaInSqft * (1 - safeParams.circulationPercent / 100);
  }, [areaInSqft, safeParams.circulationPercent]);

  // Calculate capacity based on space type
  const capacity = useMemo(() => {
    const spaceConfig = SPACE_TYPES.find(t => t.value === safeParams.spaceType);
    if (!spaceConfig || usableArea <= 0) {
      return { minimum: 0, optimal: 0, maximum: 0 };
    }

    return {
      minimum: Math.floor(usableArea / spaceConfig.sqftPerSeat.min),
      optimal: Math.floor(usableArea / spaceConfig.sqftPerSeat.opt),
      maximum: Math.floor(usableArea / spaceConfig.sqftPerSeat.max),
    };
  }, [usableArea, safeParams.spaceType]);

  return (
    <div className="space-y-4">
      {/* Area Input */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Total Area</label>
          <input
            type="number"
            min="0"
            value={safeParams.totalArea || ''}
            onChange={(e) => onUpdate({ ...params, totalArea: parseFloat(e.target.value) || 0 })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            placeholder="0"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
          <select
            value={safeParams.areaUnit}
            onChange={(e) => onUpdate({ ...params, areaUnit: e.target.value as 'sqm' | 'sqft' })}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="sqm">Square Meters (m²)</option>
            <option value="sqft">Square Feet (ft²)</option>
          </select>
        </div>
      </div>

      {/* Space Type */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Space Type</label>
        <select
          value={safeParams.spaceType}
          onChange={(e) => onUpdate({ ...params, spaceType: e.target.value })}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          {SPACE_TYPES.map((type) => (
            <option key={type.value} value={type.value}>{type.label}</option>
          ))}
        </select>
      </div>

      {/* Circulation Percentage */}
      <div>
        <div className="flex items-center justify-between mb-1">
          <label className="text-sm font-medium text-gray-700">Circulation %</label>
          <span className="text-sm text-gray-500">{safeParams.circulationPercent}%</span>
        </div>
        <input
          type="range"
          min="10"
          max="50"
          value={safeParams.circulationPercent}
          onChange={(e) => onUpdate({ ...params, circulationPercent: parseInt(e.target.value) })}
          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
        />
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>10%</span>
          <span>30% (default)</span>
          <span>50%</span>
        </div>
      </div>

      {/* Capacity Calculation */}
      {safeParams.totalArea > 0 && (
        <div className="mt-4 p-4 bg-blue-50 rounded-lg">
          <div className="flex items-center gap-2 mb-3">
            <Calculator className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-900">Calculated Capacity</span>
          </div>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 text-xs mb-1">
                <Users className="w-3 h-3" />
                Minimum
              </div>
              <p className="text-2xl font-bold text-blue-600">{capacity.minimum}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 text-xs mb-1">
                <Users className="w-3 h-3" />
                Optimal
              </div>
              <p className="text-2xl font-bold text-blue-800">{capacity.optimal}</p>
            </div>
            <div className="text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 text-xs mb-1">
                <Users className="w-3 h-3" />
                Maximum
              </div>
              <p className="text-2xl font-bold text-blue-600">{capacity.maximum}</p>
            </div>
          </div>
          <p className="text-xs text-blue-600 text-center mt-2">
            Based on {Math.round(usableArea).toLocaleString()} sqft usable area
          </p>
        </div>
      )}
    </div>
  );
}
