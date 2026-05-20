// ============================================================================
// CRITICAL ROLE CARD
// DawinOS v2.0 - HR Module
// Displays a critical role with succession status
// ============================================================================

import React from 'react';
import {
  AlertTriangle,
  Users,
  Calendar,
  ChevronRight,
  Shield,
  TrendingUp,
} from 'lucide-react';
import { CriticalRole } from '../types/succession.types';
import {
  ROLE_CRITICALITY_LABELS,
  ROLE_CRITICALITY_COLORS,
  SUCCESSION_RISK_LABELS,
  SUCCESSION_RISK_COLORS,
  READINESS_LABELS,
  READINESS_COLORS,
} from '../constants/succession.constants';

interface CriticalRoleCardProps {
  role: CriticalRole;
  onSelect?: (role: CriticalRole) => void;
  onManageSuccessors?: (role: CriticalRole) => void;
}

export const CriticalRoleCard: React.FC<CriticalRoleCardProps> = ({
  role,
  onSelect,
  onManageSuccessors,
}) => {
  const getCriticalityBadgeStyle = () => ({
    backgroundColor: `${ROLE_CRITICALITY_COLORS[role.criticalityLevel]}20`,
    color: ROLE_CRITICALITY_COLORS[role.criticalityLevel],
    borderColor: ROLE_CRITICALITY_COLORS[role.criticalityLevel],
  });

  const getRiskBadgeStyle = () => ({
    backgroundColor: `${SUCCESSION_RISK_COLORS[role.successionRisk]}20`,
    color: SUCCESSION_RISK_COLORS[role.successionRisk],
  });

  const primarySuccessor = role.successors.find(s => s.rank === 1);

  return (
    <div
      className="bg-white rounded-lg border border-gray-200 shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onSelect?.(role)}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-gray-900 text-lg">
              {role.positionTitle}
            </h3>
            <p className="text-sm text-gray-500">{role.departmentName}</p>
          </div>
          <span
            className="px-2 py-1 text-xs font-medium rounded-full border"
            style={getCriticalityBadgeStyle()}
          >
            {ROLE_CRITICALITY_LABELS[role.criticalityLevel]}
          </span>
        </div>

        {/* Incumbent */}
        {role.incumbentName && (
          <div className="flex items-center gap-2 mb-3 p-2 bg-gray-50 rounded-md">
            <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
              <Users className="w-4 h-4 text-indigo-600" />
            </div>
            <div>
              <p className="text-sm font-medium text-gray-900">{role.incumbentName}</p>
              <p className="text-xs text-gray-500">Current Incumbent</p>
            </div>
          </div>
        )}

        {/* Metrics Row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 bg-gray-50 rounded">
            <p className="text-lg font-bold text-gray-900">{role.criticalityScore}</p>
            <p className="text-xs text-gray-500">Score</p>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <p className="text-lg font-bold text-gray-900">{role.successors.length}</p>
            <p className="text-xs text-gray-500">Successors</p>
          </div>
          <div className="text-center p-2 bg-gray-50 rounded">
            <p className="text-lg font-bold text-gray-900">{role.benchStrength}</p>
            <p className="text-xs text-gray-500">Ready Now</p>
          </div>
        </div>

        {/* Risk Badge */}
        <div className="flex items-center gap-2 mb-3">
          <AlertTriangle
            className="w-4 h-4"
            style={{ color: SUCCESSION_RISK_COLORS[role.successionRisk] }}
          />
          <span
            className="px-2 py-1 text-xs font-medium rounded"
            style={getRiskBadgeStyle()}
          >
            {SUCCESSION_RISK_LABELS[role.successionRisk]}
          </span>
        </div>

        {/* Primary Successor */}
        {primarySuccessor ? (
          <div className="border-t border-gray-100 pt-3">
            <p className="text-xs text-gray-500 mb-2">Primary Successor</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-green-100 flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-green-600" />
                </div>
                <div>
                  <p className="text-sm font-medium text-gray-900">
                    {primarySuccessor.employeeName}
                  </p>
                  <p className="text-xs text-gray-500">
                    {primarySuccessor.currentPosition}
                  </p>
                </div>
              </div>
              <span
                className="px-2 py-1 text-xs rounded"
                style={{
                  backgroundColor: `${READINESS_COLORS[primarySuccessor.readinessLevel]}20`,
                  color: READINESS_COLORS[primarySuccessor.readinessLevel],
                }}
              >
                {READINESS_LABELS[primarySuccessor.readinessLevel]}
              </span>
            </div>
          </div>
        ) : (
          <div className="border-t border-gray-100 pt-3">
            <div className="flex items-center gap-2 text-amber-600">
              <Shield className="w-4 h-4" />
              <p className="text-sm">No successor identified</p>
            </div>
          </div>
        )}

        {/* Expected Vacancy */}
        {role.expectedVacancyDate && (
          <div className="flex items-center gap-2 mt-3 text-sm text-gray-600">
            <Calendar className="w-4 h-4" />
            <span>
              Expected vacancy:{' '}
              {role.expectedVacancyDate.toDate().toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="px-4 py-3 bg-gray-50 border-t border-gray-200 flex justify-between items-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onManageSuccessors?.(role);
          }}
          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
        >
          Manage Successors
        </button>
        <ChevronRight className="w-4 h-4 text-gray-400" />
      </div>
    </div>
  );
};

export default CriticalRoleCard;
