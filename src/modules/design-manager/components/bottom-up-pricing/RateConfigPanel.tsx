/**
 * Rate Configuration Panel
 * Allows editing of hourly rates per staff role
 */

import { Settings } from 'lucide-react';
import type { BottomUpPricingConfig, StaffRole } from '../../types/bottomUpPricing';

interface RateConfigPanelProps {
  config: BottomUpPricingConfig;
  onUpdateRate: (role: StaffRole, rate: number) => void;
}

export function RateConfigPanel({ config, onUpdateRate }: RateConfigPanelProps) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-2 mb-3">
        <Settings className="w-4 h-4 text-gray-500" />
        <h3 className="text-sm font-semibold text-gray-900">Hourly Rates</h3>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {config.roles.map((role) => (
          <div key={role.id} className="space-y-1">
            <label className="block text-xs font-medium text-gray-600">{role.label}</label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">UGX</span>
              <input
                type="number"
                value={role.hourlyRate}
                onChange={(e) => onUpdateRate(role.id, parseFloat(e.target.value) || 0)}
                min={0}
                step={5}
                className="w-full pl-11 pr-9 py-1.5 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">/hr</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
