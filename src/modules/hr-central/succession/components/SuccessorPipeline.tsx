// ============================================================================
// SUCCESSOR PIPELINE
// DawinOS v2.0 - HR Module
// Displays successors for a critical role in a pipeline view
// ============================================================================

import React from 'react';
import {
  Star,
  AlertCircle,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Edit,
  Trash2,
} from 'lucide-react';
import { SuccessorCandidate } from '../types/succession.types';
import {
  READINESS_LABELS,
  READINESS_COLORS,
  NINE_BOX_LABELS,
  NINE_BOX_COLORS,
  POTENTIAL_LABELS,
} from '../constants/succession.constants';

interface SuccessorPipelineProps {
  successors: SuccessorCandidate[];
  onEdit?: (successor: SuccessorCandidate) => void;
  onRemove?: (successorId: string) => void;
  onReorder?: (successorId: string, direction: 'up' | 'down') => void;
}

export const SuccessorPipeline: React.FC<SuccessorPipelineProps> = ({
  successors,
  onEdit,
  onRemove,
  onReorder,
}) => {
  const sortedSuccessors = [...successors].sort((a, b) => a.rank - b.rank);

  const getFlightRiskColor = (risk: 'low' | 'medium' | 'high') => {
    switch (risk) {
      case 'low': return 'text-green-600 bg-green-50';
      case 'medium': return 'text-amber-600 bg-amber-50';
      case 'high': return 'text-red-600 bg-red-50';
    }
  };

  if (successors.length === 0) {
    return (
      <div className="text-center py-8 bg-gray-50 rounded-lg border border-dashed border-gray-300">
        <AlertCircle className="w-12 h-12 text-gray-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">No successors identified</p>
        <p className="text-sm text-gray-500 mt-1">
          Add potential successors to build the talent pipeline
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {sortedSuccessors.map((successor, index) => (
        <div
          key={successor.id}
          className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-md transition-shadow"
        >
          <div className="flex items-start justify-between">
            {/* Left Section - Avatar and Info */}
            <div className="flex items-start gap-3">
              {/* Rank Badge */}
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-white ${
                  successor.rank === 1
                    ? 'bg-indigo-600'
                    : successor.rank === 2
                    ? 'bg-indigo-400'
                    : 'bg-gray-400'
                }`}
              >
                {successor.rank}
              </div>

              <div>
                <h4 className="font-semibold text-gray-900">
                  {successor.employeeName}
                </h4>
                <p className="text-sm text-gray-500">
                  {successor.currentPosition} • {successor.currentDepartment}
                </p>

                {/* Readiness and 9-Box */}
                <div className="flex flex-wrap gap-2 mt-2">
                  <span
                    className="px-2 py-1 text-xs font-medium rounded"
                    style={{
                      backgroundColor: `${READINESS_COLORS[successor.readinessLevel]}20`,
                      color: READINESS_COLORS[successor.readinessLevel],
                    }}
                  >
                    {READINESS_LABELS[successor.readinessLevel]}
                  </span>
                  <span
                    className="px-2 py-1 text-xs font-medium rounded"
                    style={{
                      backgroundColor: `${NINE_BOX_COLORS[successor.nineBoxCategory]}20`,
                      color: NINE_BOX_COLORS[successor.nineBoxCategory],
                    }}
                  >
                    {NINE_BOX_LABELS[successor.nineBoxCategory]}
                  </span>
                </div>
              </div>
            </div>

            {/* Right Section - Actions */}
            <div className="flex items-center gap-1">
              {onReorder && index > 0 && (
                <button
                  onClick={() => onReorder(successor.id, 'up')}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                  title="Move up"
                >
                  <ChevronUp className="w-4 h-4" />
                </button>
              )}
              {onReorder && index < sortedSuccessors.length - 1 && (
                <button
                  onClick={() => onReorder(successor.id, 'down')}
                  className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded"
                  title="Move down"
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              )}
              {onEdit && (
                <button
                  onClick={() => onEdit(successor)}
                  className="p-1 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded"
                  title="Edit"
                >
                  <Edit className="w-4 h-4" />
                </button>
              )}
              {onRemove && (
                <button
                  onClick={() => onRemove(successor.id)}
                  className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
                  title="Remove"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>
          </div>

          {/* Metrics Row */}
          <div className="grid grid-cols-4 gap-3 mt-4 pt-3 border-t border-gray-100">
            <div>
              <p className="text-xs text-gray-500">Performance</p>
              <div className="flex items-center gap-1 mt-1">
                <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                <span className="font-medium">{successor.performanceRating.toFixed(1)}</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500">Potential</p>
              <p className="text-sm font-medium text-gray-900 mt-1">
                {POTENTIAL_LABELS[successor.potentialRating]}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500">Readiness</p>
              <div className="flex items-center gap-1 mt-1">
                <TrendingUp className="w-4 h-4 text-indigo-500" />
                <span className="font-medium">{successor.readinessScore}%</span>
              </div>
            </div>
            <div>
              <p className="text-xs text-gray-500">Flight Risk</p>
              <span
                className={`inline-block px-2 py-0.5 text-xs font-medium rounded mt-1 ${getFlightRiskColor(
                  successor.flightRisk
                )}`}
              >
                {successor.flightRisk.charAt(0).toUpperCase() + successor.flightRisk.slice(1)}
              </span>
            </div>
          </div>

          {/* Competency Gaps */}
          {successor.competencyGaps.length > 0 && (
            <div className="mt-3 pt-3 border-t border-gray-100">
              <p className="text-xs text-gray-500 mb-2">
                Key Development Areas ({successor.competencyGaps.length})
              </p>
              <div className="flex flex-wrap gap-1">
                {successor.competencyGaps.slice(0, 3).map((gap, i) => (
                  <span
                    key={i}
                    className={`px-2 py-0.5 text-xs rounded ${
                      gap.priority === 'critical'
                        ? 'bg-red-100 text-red-700'
                        : gap.priority === 'high'
                        ? 'bg-orange-100 text-orange-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {gap.competency}
                  </span>
                ))}
                {successor.competencyGaps.length > 3 && (
                  <span className="px-2 py-0.5 text-xs text-gray-500">
                    +{successor.competencyGaps.length - 3} more
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Interest Indicator */}
          <div className="flex items-center gap-4 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-500">
            <span className={successor.interestedInRole ? 'text-green-600' : 'text-gray-400'}>
              {successor.interestedInRole ? '✓ Interested in role' : '○ Interest not confirmed'}
            </span>
            {successor.willingToRelocate !== undefined && (
              <span className={successor.willingToRelocate ? 'text-green-600' : 'text-gray-400'}>
                {successor.willingToRelocate ? '✓ Willing to relocate' : '○ Location bound'}
              </span>
            )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SuccessorPipeline;
