// ============================================================================
// CRITICAL ROLE CARD
// ZeusOS v2.0 - HR Module
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
      className="bg-card rounded-lg border border-[var(--border-subtle)] shadow-sm hover:shadow-md transition-shadow cursor-pointer"
      onClick={() => onSelect?.(role)}
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex justify-between items-start mb-3">
          <div className="flex-1">
            <h3 className="font-semibold text-foreground text-lg">
              {role.positionTitle}
            </h3>
            <p className="text-sm text-muted-foreground">{role.departmentName}</p>
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
          <div className="flex items-center gap-2 mb-3 p-2 bg-[var(--bg-sunken)] rounded-md">
            <div className="w-8 h-8 rounded-full bg-[var(--rag-blue-soft)] flex items-center justify-center">
              <Users className="w-4 h-4 text-[var(--rag-blue)]" />
            </div>
            <div>
              <p className="text-sm font-medium text-foreground">{role.incumbentName}</p>
              <p className="text-xs text-muted-foreground">Current Incumbent</p>
            </div>
          </div>
        )}

        {/* Metrics Row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <div className="text-center p-2 bg-[var(--bg-sunken)] rounded">
            <p className="text-lg font-bold text-foreground">{role.criticalityScore}</p>
            <p className="text-xs text-muted-foreground">Score</p>
          </div>
          <div className="text-center p-2 bg-[var(--bg-sunken)] rounded">
            <p className="text-lg font-bold text-foreground">{role.successors.length}</p>
            <p className="text-xs text-muted-foreground">Successors</p>
          </div>
          <div className="text-center p-2 bg-[var(--bg-sunken)] rounded">
            <p className="text-lg font-bold text-foreground">{role.benchStrength}</p>
            <p className="text-xs text-muted-foreground">Ready Now</p>
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
          <div className="border-t border-[var(--border-subtle)] pt-3">
            <p className="text-xs text-muted-foreground mb-2">Primary Successor</p>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[var(--rag-green-soft)] flex items-center justify-center">
                  <TrendingUp className="w-4 h-4 text-[var(--rag-green)]" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">
                    {primarySuccessor.employeeName}
                  </p>
                  <p className="text-xs text-muted-foreground">
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
          <div className="border-t border-[var(--border-subtle)] pt-3">
            <div className="flex items-center gap-2 text-[var(--rag-amber)]">
              <Shield className="w-4 h-4" />
              <p className="text-sm">No successor identified</p>
            </div>
          </div>
        )}

        {/* Expected Vacancy */}
        {role.expectedVacancyDate && (
          <div className="flex items-center gap-2 mt-3 text-sm text-muted-foreground">
            <Calendar className="w-4 h-4" />
            <span>
              Expected vacancy:{' '}
              {role.expectedVacancyDate.toDate().toLocaleDateString()}
            </span>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="px-4 py-3 bg-[var(--bg-sunken)] border-t border-[var(--border-subtle)] flex justify-between items-center">
        <button
          onClick={(e) => {
            e.stopPropagation();
            onManageSuccessors?.(role);
          }}
          className="text-sm text-[var(--rag-blue)] hover:text-[var(--rag-blue)] font-medium"
        >
          Manage Successors
        </button>
        <ChevronRight className="w-4 h-4 text-[var(--fg-tertiary)]" />
      </div>
    </div>
  );
};

export default CriticalRoleCard;
