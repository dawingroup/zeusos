// ============================================================================
// RISK HEATMAP
// DawinOS v2.0 - HR Module
// Displays succession risk distribution
// ============================================================================

import React from 'react';
import { AlertTriangle, CheckCircle, AlertCircle, XCircle } from 'lucide-react';
import { CriticalRole } from '../types/succession.types';
import {
  SUCCESSION_RISK_LEVELS,
  SUCCESSION_RISK_LABELS,
  SUCCESSION_RISK_COLORS,
  ROLE_CRITICALITY_LEVELS,
  ROLE_CRITICALITY_LABELS,
  SuccessionRiskLevel,
  RoleCriticalityLevel,
} from '../constants/succession.constants';

interface RiskHeatmapProps {
  roles: CriticalRole[];
  onCellClick?: (criticalityLevel: RoleCriticalityLevel, riskLevel: SuccessionRiskLevel) => void;
}

export const RiskHeatmap: React.FC<RiskHeatmapProps> = ({
  roles,
  onCellClick,
}) => {
  const getRolesCount = (
    criticalityLevel: RoleCriticalityLevel,
    riskLevel: SuccessionRiskLevel
  ): number => {
    return roles.filter(
      r => r.criticalityLevel === criticalityLevel && r.successionRisk === riskLevel
    ).length;
  };

  const getCellColor = (
    criticalityLevel: RoleCriticalityLevel,
    riskLevel: SuccessionRiskLevel
  ): string => {
    const count = getRolesCount(criticalityLevel, riskLevel);
    if (count === 0) return 'bg-gray-50';

    // More critical = more urgent colors
    const isCriticalRole = criticalityLevel === ROLE_CRITICALITY_LEVELS.MISSION_CRITICAL;
    const isHighRisk = riskLevel === SUCCESSION_RISK_LEVELS.CRITICAL || riskLevel === SUCCESSION_RISK_LEVELS.HIGH;

    if (isCriticalRole && isHighRisk) return 'bg-red-500 text-white';
    if (isCriticalRole) return 'bg-orange-400 text-white';
    if (isHighRisk) return 'bg-red-300 text-red-900';
    if (riskLevel === SUCCESSION_RISK_LEVELS.MEDIUM) return 'bg-amber-200 text-amber-900';
    return 'bg-green-200 text-green-900';
  };

  const getRiskIcon = (riskLevel: SuccessionRiskLevel) => {
    switch (riskLevel) {
      case SUCCESSION_RISK_LEVELS.CRITICAL:
        return <XCircle className="w-4 h-4" />;
      case SUCCESSION_RISK_LEVELS.HIGH:
        return <AlertTriangle className="w-4 h-4" />;
      case SUCCESSION_RISK_LEVELS.MEDIUM:
        return <AlertCircle className="w-4 h-4" />;
      case SUCCESSION_RISK_LEVELS.LOW:
        return <CheckCircle className="w-4 h-4" />;
    }
  };

  const criticalityLevels: RoleCriticalityLevel[] = [
    ROLE_CRITICALITY_LEVELS.MISSION_CRITICAL,
    ROLE_CRITICALITY_LEVELS.HIGH,
    ROLE_CRITICALITY_LEVELS.MEDIUM,
    ROLE_CRITICALITY_LEVELS.LOW,
  ];

  const riskLevels: SuccessionRiskLevel[] = [
    SUCCESSION_RISK_LEVELS.CRITICAL,
    SUCCESSION_RISK_LEVELS.HIGH,
    SUCCESSION_RISK_LEVELS.MEDIUM,
    SUCCESSION_RISK_LEVELS.LOW,
  ];

  // Calculate summary stats
  const totalRoles = roles.length;
  const criticalRiskRoles = roles.filter(r => r.successionRisk === SUCCESSION_RISK_LEVELS.CRITICAL).length;
  const highRiskRoles = roles.filter(r => r.successionRisk === SUCCESSION_RISK_LEVELS.HIGH).length;
  const lowRiskRoles = roles.filter(r => r.successionRisk === SUCCESSION_RISK_LEVELS.LOW).length;

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Succession Risk Heatmap</h3>
        <span className="text-sm text-gray-500">{totalRoles} critical roles</span>
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-4 gap-2 mb-6">
        <div className="text-center p-3 rounded-lg bg-red-50">
          <p className="text-2xl font-bold text-red-600">{criticalRiskRoles}</p>
          <p className="text-xs text-red-600">Critical Risk</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-orange-50">
          <p className="text-2xl font-bold text-orange-600">{highRiskRoles}</p>
          <p className="text-xs text-orange-600">High Risk</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-amber-50">
          <p className="text-2xl font-bold text-amber-600">
            {roles.filter(r => r.successionRisk === SUCCESSION_RISK_LEVELS.MEDIUM).length}
          </p>
          <p className="text-xs text-amber-600">Medium Risk</p>
        </div>
        <div className="text-center p-3 rounded-lg bg-green-50">
          <p className="text-2xl font-bold text-green-600">{lowRiskRoles}</p>
          <p className="text-xs text-green-600">Low Risk</p>
        </div>
      </div>

      {/* Heatmap Grid */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="p-2 text-left text-xs font-medium text-gray-500">
                Criticality / Risk →
              </th>
              {riskLevels.map((risk) => (
                <th
                  key={risk}
                  className="p-2 text-center text-xs font-medium"
                  style={{ color: SUCCESSION_RISK_COLORS[risk] }}
                >
                  <div className="flex items-center justify-center gap-1">
                    {getRiskIcon(risk)}
                    <span className="hidden sm:inline">{SUCCESSION_RISK_LABELS[risk]}</span>
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {criticalityLevels.map((criticality) => (
              <tr key={criticality}>
                <td className="p-2 text-xs font-medium text-gray-700">
                  {ROLE_CRITICALITY_LABELS[criticality]}
                </td>
                {riskLevels.map((risk) => {
                  const count = getRolesCount(criticality, risk);
                  return (
                    <td key={`${criticality}-${risk}`} className="p-1">
                      <button
                        onClick={() => count > 0 && onCellClick?.(criticality, risk)}
                        disabled={count === 0}
                        className={`w-full h-12 rounded-md font-bold text-lg transition-all ${getCellColor(
                          criticality,
                          risk
                        )} ${count > 0 ? 'hover:opacity-80 cursor-pointer' : 'cursor-default'}`}
                      >
                        {count > 0 ? count : '-'}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <p className="text-xs text-gray-500 mb-2">Priority Action:</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-red-500" />
            <span>Immediate action required</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-orange-400" />
            <span>Address within 30 days</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-amber-200" />
            <span>Monitor closely</span>
          </div>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 rounded bg-green-200" />
            <span>Well covered</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default RiskHeatmap;
