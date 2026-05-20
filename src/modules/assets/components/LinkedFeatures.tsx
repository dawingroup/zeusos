/**
 * Linked Features
 * Shows features from the Feature Library that require this asset.
 */

import { Cpu, CheckCircle, XCircle } from 'lucide-react';
import type { Feature, FeatureCategory, AssetStatus } from '@/shared/types';

const CATEGORY_LABELS: Record<FeatureCategory, string> = {
  JOINERY: 'Joinery',
  EDGE_TREATMENT: 'Edge Treatment',
  DRILLING: 'Drilling',
  SHAPING: 'Shaping',
  ASSEMBLY: 'Assembly',
  FINISHING: 'Finishing',
  CUTTING: 'Cutting',
  SPECIALTY: 'Specialty',
};

const CATEGORY_COLORS: Record<FeatureCategory, string> = {
  JOINERY: 'bg-purple-100 text-purple-700',
  EDGE_TREATMENT: 'bg-teal-100 text-teal-700',
  DRILLING: 'bg-sky-100 text-sky-700',
  SHAPING: 'bg-orange-100 text-orange-700',
  ASSEMBLY: 'bg-indigo-100 text-indigo-700',
  FINISHING: 'bg-rose-100 text-rose-700',
  CUTTING: 'bg-emerald-100 text-emerald-700',
  SPECIALTY: 'bg-gray-100 text-gray-700',
};

interface LinkedFeaturesProps {
  features: Feature[];
  assetStatus: AssetStatus;
}

export function LinkedFeatures({ features, assetStatus }: LinkedFeaturesProps) {
  const isOperational = assetStatus === 'ACTIVE' || assetStatus === 'CHECKED_OUT';

  if (features.length === 0) {
    return (
      <div className="text-center py-12 text-gray-400">
        <Cpu className="w-10 h-10 mx-auto mb-3 opacity-50" />
        <p className="text-sm">No features linked to this asset</p>
        <p className="text-xs mt-1">
          Use the Asset Capabilities analyzer to discover features
        </p>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${
            isOperational
              ? 'bg-green-100 text-green-700'
              : 'bg-red-100 text-red-700'
          }`}
        >
          {isOperational ? (
            <CheckCircle className="w-3 h-3" />
          ) : (
            <XCircle className="w-3 h-3" />
          )}
          {isOperational ? 'Asset Operational' : 'Asset Unavailable'}
        </div>
        <span className="text-xs text-gray-500">
          {features.length} feature{features.length !== 1 ? 's' : ''} linked
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {features.map((feature) => (
          <div
            key={feature.id}
            className={`border rounded-lg p-3 ${
              isOperational
                ? 'border-gray-200 bg-white'
                : 'border-red-200 bg-red-50/30'
            }`}
          >
            <div className="flex items-start justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-900 leading-tight">
                {feature.name}
              </h4>
              <span
                className={`shrink-0 ml-2 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                  CATEGORY_COLORS[feature.category] || 'bg-gray-100 text-gray-600'
                }`}
              >
                {CATEGORY_LABELS[feature.category] || feature.category}
              </span>
            </div>

            {feature.description && (
              <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                {feature.description}
              </p>
            )}

            <div className="flex items-center gap-3 text-xs text-gray-400">
              {feature.estimatedMinutes && (
                <span>{feature.estimatedMinutes} min</span>
              )}
              {feature.complexityFactor && (
                <span>
                  Complexity:{' '}
                  {feature.complexityFactor <= 1
                    ? 'Simple'
                    : feature.complexityFactor <= 2
                      ? 'Moderate'
                      : 'Complex'}
                </span>
              )}
            </div>

            {feature.tags && feature.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {feature.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 bg-gray-50 text-gray-500 text-[10px] rounded"
                  >
                    {tag}
                  </span>
                ))}
                {feature.tags.length > 3 && (
                  <span className="text-[10px] text-gray-400">
                    +{feature.tags.length - 3}
                  </span>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
