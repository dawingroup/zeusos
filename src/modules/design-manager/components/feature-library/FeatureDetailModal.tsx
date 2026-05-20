/**
 * Feature Detail Modal
 * Full details view for a feature
 */

import { X, Edit2, Trash2, Clock, Wrench, Star, CheckCircle } from 'lucide-react';
import type { FeatureLibraryItem } from '../../types/featureLibrary';
import { CATEGORY_LABELS, QUALITY_GRADE_LABELS, STATUS_LABELS } from '../../types/featureLibrary';

interface FeatureDetailModalProps {
  feature: FeatureLibraryItem;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
}

export function FeatureDetailModal({ feature, onClose, onEdit, onDelete }: FeatureDetailModalProps) {
  const gradeColors = {
    economy: 'bg-gray-100 text-gray-700',
    custom: 'bg-blue-100 text-blue-700',
    premium: 'bg-amber-100 text-amber-700',
  };

  const statusColors = {
    active: 'bg-green-100 text-green-700',
    'in-development': 'bg-yellow-100 text-yellow-700',
    deprecated: 'bg-red-100 text-red-700',
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-start justify-between px-6 py-4 border-b border-gray-200">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <span className="px-2.5 py-1 bg-gray-100 rounded-lg font-mono text-sm font-medium text-gray-700">
                {feature.code}
              </span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${statusColors[feature.status]}`}>
                {STATUS_LABELS[feature.status]}
              </span>
            </div>
            <h2 className="text-xl font-semibold text-gray-900">{feature.name}</h2>
            <p className="text-sm text-gray-500">{CATEGORY_LABELS[feature.category]}</p>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-500">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Description */}
          {feature.description && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
              <p className="text-gray-700">{feature.description}</p>
            </div>
          )}

          {/* Stats Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                <Clock className="w-4 h-4" />
                <span className="text-xs">Time</span>
              </div>
              <p className="font-semibold text-gray-900">{feature.estimatedTime.typical}h</p>
              <p className="text-xs text-gray-500">
                {feature.estimatedTime.minimum}-{feature.estimatedTime.maximum}h range
              </p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                <Wrench className="w-4 h-4" />
                <span className="text-xs">Equipment</span>
              </div>
              <p className="font-semibold text-gray-900">{feature.requiredEquipment.length}</p>
              <p className="text-xs text-gray-500">items required</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                <Star className="w-4 h-4" />
                <span className="text-xs">Usage</span>
              </div>
              <p className="font-semibold text-gray-900">{feature.usageCount}</p>
              <p className="text-xs text-gray-500">times used</p>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg text-center">
              <div className="flex items-center justify-center gap-1 text-gray-500 mb-1">
                <CheckCircle className="w-4 h-4" />
                <span className="text-xs">Grade</span>
              </div>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${gradeColors[feature.qualityGrade]}`}>
                {QUALITY_GRADE_LABELS[feature.qualityGrade]}
              </span>
            </div>
          </div>

          {/* Tags */}
          {feature.tags.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {feature.tags.map((tag) => (
                  <span key={tag} className="px-2.5 py-1 bg-gray-100 rounded-full text-sm text-gray-700">
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Required Equipment */}
          {feature.requiredEquipment.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Required Equipment</h3>
              <div className="flex flex-wrap gap-2">
                {feature.requiredEquipment.map((item) => (
                  <span key={item} className="px-2.5 py-1 bg-blue-50 text-blue-700 rounded-full text-sm">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Process Steps */}
          {feature.processSteps.length > 0 && (
            <div>
              <h3 className="text-sm font-medium text-gray-500 mb-2">Process Steps</h3>
              <div className="space-y-2">
                {feature.processSteps.map((step, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="flex-shrink-0 w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-medium">
                      {step.order}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <p className="font-medium text-gray-900">{step.name}</p>
                        <span className="text-sm text-gray-500">{step.duration} min</span>
                      </div>
                      {step.description && (
                        <p className="text-sm text-gray-600 mt-1">{step.description}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Cost Factors */}
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Cost Factors</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="p-2 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Labor Intensity</p>
                <p className="font-medium text-gray-900 capitalize">{feature.costFactors.laborIntensity}</p>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Waste %</p>
                <p className="font-medium text-gray-900">{feature.costFactors.wastePercent}%</p>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Skill Level</p>
                <p className="font-medium text-gray-900 capitalize">{feature.costFactors.skillLevel}</p>
              </div>
              <div className="p-2 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500">Setup Time</p>
                <p className="font-medium text-gray-900">{feature.costFactors.setupTime} min</p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
          <button
            onClick={onDelete}
            className="flex items-center gap-2 px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
            >
              Close
            </button>
            <button
              onClick={onEdit}
              className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              <Edit2 className="w-4 h-4" />
              Edit Feature
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
