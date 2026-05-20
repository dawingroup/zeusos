/**
 * Feature Detail Component
 * Full view of a manufacturing feature with all details
 */

import { useState } from 'react';
import { 
  X, Clock, Wrench, Layers, AlertTriangle, CheckCircle, 
  ChevronDown, ChevronUp, Edit, Trash2, DollarSign
} from 'lucide-react';
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

const SKILL_CONFIG: Record<SkillLevel, { label: string; color: string; bg: string }> = {
  basic: { label: 'Basic', color: 'text-green-700', bg: 'bg-green-100' },
  intermediate: { label: 'Intermediate', color: 'text-yellow-700', bg: 'bg-yellow-100' },
  advanced: { label: 'Advanced', color: 'text-orange-700', bg: 'bg-orange-100' },
  specialist: { label: 'Specialist', color: 'text-red-700', bg: 'bg-red-100' },
};

// ============================================
// Types
// ============================================

interface FeatureDetailProps {
  feature: ManufacturingFeature;
  onClose: () => void;
  onEdit?: (feature: ManufacturingFeature) => void;
  onDelete?: (feature: ManufacturingFeature) => void;
}

// ============================================
// Component
// ============================================

export function FeatureDetail({ feature, onClose, onEdit, onDelete }: FeatureDetailProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(
    new Set(['steps', 'equipment', 'materials'])
  );

  const categoryConfig = CATEGORY_CONFIG[feature.category];
  const skillConfig = SKILL_CONFIG[feature.skillLevel];

  const toggleSection = (section: string) => {
    setExpandedSections(prev => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const timeDisplay = feature.estimatedTime.unit === 'hours'
    ? `${feature.estimatedTime.min}-${feature.estimatedTime.max} hours`
    : `${feature.estimatedTime.min}-${feature.estimatedTime.max} minutes`;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <span className={`px-3 py-1 text-sm rounded-full ${categoryConfig.bg} ${categoryConfig.color}`}>
                {categoryConfig.label}
              </span>
              <span className={`px-3 py-1 text-sm rounded-full ${skillConfig.bg} ${skillConfig.color}`}>
                {skillConfig.label}
              </span>
            </div>
            <h2 className="text-2xl font-bold text-gray-900">{feature.name}</h2>
          </div>
          <div className="flex items-center gap-2">
            {onEdit && (
              <button
                onClick={() => onEdit(feature)}
                className="p-2 text-gray-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
              >
                <Edit className="w-5 h-5" />
              </button>
            )}
            {onDelete && (
              <button
                onClick={() => onDelete(feature)}
                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            )}
            <button
              onClick={onClose}
              className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Description */}
          <div>
            <p className="text-gray-700">{feature.description}</p>
          </div>

          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-4">
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <Clock className="w-6 h-6 mx-auto mb-2 text-gray-400" />
              <div className="text-lg font-semibold text-gray-900">{timeDisplay}</div>
              <div className="text-xs text-gray-500">Estimated Time</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <Wrench className="w-6 h-6 mx-auto mb-2 text-gray-400" />
              <div className="text-lg font-semibold text-gray-900">{feature.requiredEquipment.length}</div>
              <div className="text-xs text-gray-500">Equipment</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <Layers className="w-6 h-6 mx-auto mb-2 text-gray-400" />
              <div className="text-lg font-semibold text-gray-900">{feature.processSteps.length}</div>
              <div className="text-xs text-gray-500">Steps</div>
            </div>
            <div className="bg-gray-50 rounded-lg p-4 text-center">
              <CheckCircle className="w-6 h-6 mx-auto mb-2 text-gray-400" />
              <div className="text-lg font-semibold text-gray-900">{feature.qualityCheckpoints.length}</div>
              <div className="text-xs text-gray-500">Quality Checks</div>
            </div>
          </div>

          {/* Process Steps */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('steps')}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100"
            >
              <span className="font-semibold text-gray-900">Process Steps</span>
              {expandedSections.has('steps') ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            {expandedSections.has('steps') && (
              <div className="p-4 space-y-3">
                {feature.processSteps.map((step) => (
                  <div key={step.order} className="flex gap-4">
                    <div className="flex-shrink-0 w-8 h-8 rounded-full bg-purple-100 text-purple-700 flex items-center justify-center text-sm font-medium">
                      {step.order}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h4 className="font-medium text-gray-900">{step.name}</h4>
                        <span className="text-sm text-gray-500">{step.duration} min</span>
                      </div>
                      <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Equipment */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('equipment')}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100"
            >
              <span className="font-semibold text-gray-900">Required Equipment</span>
              {expandedSections.has('equipment') ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            {expandedSections.has('equipment') && (
              <div className="p-4 space-y-2">
                {feature.requiredEquipment.map((equip) => (
                  <div
                    key={equip.id}
                    className={`flex items-center justify-between p-3 rounded-lg ${
                      equip.isRequired ? 'bg-red-50' : 'bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <Wrench className={`w-4 h-4 ${equip.isRequired ? 'text-red-500' : 'text-gray-400'}`} />
                      <div>
                        <span className="font-medium text-gray-900">{equip.name}</span>
                        <span className="text-sm text-gray-500 ml-2">({equip.type})</span>
                      </div>
                    </div>
                    {equip.isRequired ? (
                      <span className="text-xs px-2 py-1 rounded bg-red-100 text-red-700">Required</span>
                    ) : (
                      <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-600">Optional</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Material Constraints */}
          <div className="border border-gray-200 rounded-lg overflow-hidden">
            <button
              onClick={() => toggleSection('materials')}
              className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100"
            >
              <span className="font-semibold text-gray-900">Material Constraints</span>
              {expandedSections.has('materials') ? (
                <ChevronUp className="w-5 h-5 text-gray-400" />
              ) : (
                <ChevronDown className="w-5 h-5 text-gray-400" />
              )}
            </button>
            {expandedSections.has('materials') && (
              <div className="p-4 space-y-2">
                {feature.materialConstraints.length === 0 ? (
                  <p className="text-gray-500 text-sm">No specific material constraints</p>
                ) : (
                  feature.materialConstraints.map((constraint, idx) => (
                    <div key={idx} className="p-3 bg-amber-50 rounded-lg">
                      <div className="flex items-center justify-between">
                        <span className="font-medium text-amber-900">{constraint.materialType}</span>
                        {constraint.grainRequired && (
                          <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-700">
                            Grain Required
                          </span>
                        )}
                      </div>
                      <div className="mt-1 text-sm text-amber-700">
                        {constraint.minThickness && constraint.maxThickness
                          ? `${constraint.minThickness}-${constraint.maxThickness}mm thickness`
                          : constraint.minThickness
                          ? `Min ${constraint.minThickness}mm`
                          : constraint.maxThickness
                          ? `Max ${constraint.maxThickness}mm`
                          : 'Any thickness'}
                      </div>
                      {constraint.notes && (
                        <p className="mt-1 text-xs text-amber-600">{constraint.notes}</p>
                      )}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Quality Checkpoints */}
          {feature.qualityCheckpoints.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('quality')}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100"
              >
                <span className="font-semibold text-gray-900">Quality Checkpoints</span>
                {expandedSections.has('quality') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {expandedSections.has('quality') && (
                <div className="p-4 space-y-3">
                  {feature.qualityCheckpoints.map((check) => (
                    <div
                      key={check.order}
                      className={`p-3 rounded-lg ${check.isCritical ? 'bg-red-50' : 'bg-gray-50'}`}
                    >
                      <div className="flex items-center gap-2">
                        {check.isCritical ? (
                          <AlertTriangle className="w-4 h-4 text-red-500" />
                        ) : (
                          <CheckCircle className="w-4 h-4 text-green-500" />
                        )}
                        <span className="font-medium text-gray-900">{check.name}</span>
                        {check.isCritical && (
                          <span className="text-xs px-2 py-0.5 rounded bg-red-100 text-red-700">Critical</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600 mt-1 ml-6">{check.description}</p>
                      <ul className="mt-2 ml-6 space-y-1">
                        {check.criteria.map((criterion, idx) => (
                          <li key={idx} className="text-xs text-gray-500 flex items-center gap-1">
                            <span className="w-1 h-1 rounded-full bg-gray-400" />
                            {criterion}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Pricing Factors */}
          {feature.pricingFactors.length > 0 && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <button
                onClick={() => toggleSection('pricing')}
                className="w-full flex items-center justify-between p-4 bg-gray-50 hover:bg-gray-100"
              >
                <span className="font-semibold text-gray-900">Pricing Factors</span>
                {expandedSections.has('pricing') ? (
                  <ChevronUp className="w-5 h-5 text-gray-400" />
                ) : (
                  <ChevronDown className="w-5 h-5 text-gray-400" />
                )}
              </button>
              {expandedSections.has('pricing') && (
                <div className="p-4 space-y-2">
                  {feature.pricingFactors.map((factor, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                      <div className="flex items-center gap-3">
                        <DollarSign className="w-4 h-4 text-gray-400" />
                        <div>
                          <span className="font-medium text-gray-900">{factor.name}</span>
                          <span className="text-sm text-gray-500 ml-2">({factor.type})</span>
                        </div>
                      </div>
                      <span className="text-sm font-mono text-gray-700">×{factor.multiplier}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FeatureDetail;
