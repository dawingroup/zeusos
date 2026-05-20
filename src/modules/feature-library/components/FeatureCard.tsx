/**
 * Feature Card Component
 * Grid card for displaying manufacturing feature summary
 */

import { Clock, Wrench, Layers, ChevronRight } from 'lucide-react';
import type { ManufacturingFeature, ManufacturingCategory, SkillLevel } from '../types';

// ============================================
// Constants
// ============================================

const CATEGORY_CONFIG: Record<ManufacturingCategory, { label: string; color: string; bg: string }> = {
  joinery: { label: 'Joinery', color: 'text-blue-700', bg: 'bg-blue-100' },
  finishing: { label: 'Finishing', color: 'text-pink-700', bg: 'bg-pink-100' },
  hardware: { label: 'Hardware', color: 'text-orange-700', bg: 'bg-orange-100' },
  'edge-treatment': { label: 'Edge Treatment', color: 'text-green-700', bg: 'bg-green-100' },
  assembly: { label: 'Assembly', color: 'text-purple-700', bg: 'bg-purple-100' },
};

const SKILL_CONFIG: Record<SkillLevel, { label: string; color: string }> = {
  basic: { label: 'Basic', color: 'text-green-600' },
  intermediate: { label: 'Intermediate', color: 'text-yellow-600' },
  advanced: { label: 'Advanced', color: 'text-orange-600' },
  specialist: { label: 'Specialist', color: 'text-red-600' },
};

// ============================================
// Types
// ============================================

interface FeatureCardProps {
  feature: ManufacturingFeature;
  onClick?: (feature: ManufacturingFeature) => void;
  compact?: boolean;
}

// ============================================
// Component
// ============================================

export function FeatureCard({ feature, onClick, compact = false }: FeatureCardProps) {
  const categoryConfig = CATEGORY_CONFIG[feature.category];
  const skillConfig = SKILL_CONFIG[feature.skillLevel];

  const timeDisplay = feature.estimatedTime.unit === 'hours'
    ? `${feature.estimatedTime.min}-${feature.estimatedTime.max}h`
    : `${feature.estimatedTime.min}-${feature.estimatedTime.max}min`;

  if (compact) {
    return (
      <div
        onClick={() => onClick?.(feature)}
        className="flex items-center justify-between p-3 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all cursor-pointer"
      >
        <div className="flex items-center gap-3">
          <span className={`px-2 py-0.5 text-xs rounded-full ${categoryConfig.bg} ${categoryConfig.color}`}>
            {categoryConfig.label}
          </span>
          <span className="font-medium text-gray-900">{feature.name}</span>
        </div>
        <div className="flex items-center gap-4 text-sm text-gray-500">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {timeDisplay}
          </span>
          <ChevronRight className="w-4 h-4" />
        </div>
      </div>
    );
  }

  return (
    <div
      onClick={() => onClick?.(feature)}
      className="bg-white border border-gray-200 rounded-lg p-4 hover:shadow-lg transition-all cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-semibold text-gray-900 group-hover:text-purple-700 transition-colors">
            {feature.name}
          </h3>
          <span className={`inline-block mt-1 px-2 py-0.5 text-xs rounded-full ${categoryConfig.bg} ${categoryConfig.color}`}>
            {categoryConfig.label}
          </span>
        </div>
        <span className={`text-xs font-medium ${skillConfig.color}`}>
          {skillConfig.label}
        </span>
      </div>

      {/* Description */}
      <p className="text-sm text-gray-600 mb-4 line-clamp-2">
        {feature.description}
      </p>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-2 mb-4">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="w-3.5 h-3.5" />
          <span>{timeDisplay}</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Wrench className="w-3.5 h-3.5" />
          <span>{feature.requiredEquipment.length} equip</span>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Layers className="w-3.5 h-3.5" />
          <span>{feature.processSteps.length} steps</span>
        </div>
      </div>

      {/* Equipment Preview */}
      {feature.requiredEquipment.length > 0 && (
        <div className="pt-3 border-t border-gray-100">
          <div className="flex flex-wrap gap-1">
            {feature.requiredEquipment.slice(0, 3).map((equip) => (
              <span
                key={equip.id}
                className={`text-xs px-2 py-0.5 rounded ${
                  equip.isRequired ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-600'
                }`}
              >
                {equip.name}
              </span>
            ))}
            {feature.requiredEquipment.length > 3 && (
              <span className="text-xs text-gray-400">
                +{feature.requiredEquipment.length - 3} more
              </span>
            )}
          </div>
        </div>
      )}

      {/* Materials Preview */}
      {feature.materialConstraints.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {feature.materialConstraints.map((constraint, idx) => (
            <span
              key={idx}
              className="text-xs px-2 py-0.5 rounded bg-amber-50 text-amber-700"
            >
              {constraint.materialType}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export default FeatureCard;
