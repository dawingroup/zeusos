// ============================================================================
// SUCCESSION DASHBOARD
// DawinOS v2.0 - HR Module
// Main dashboard for succession planning
// ============================================================================

import React, { useState } from 'react';
import {
  Users,
  Target,
  Plus,
  RefreshCw,
  Filter,
  BarChart3,
} from 'lucide-react';
import { useSuccession } from '../hooks/useSuccession';
import { CriticalRoleCard } from './CriticalRoleCard';
import { RiskHeatmap } from './RiskHeatmap';
import { TalentPoolMatrix } from './TalentPoolMatrix';
import { DevelopmentPlanCard } from './DevelopmentPlanCard';
import {
  ROLE_CRITICALITY_LEVELS,
  SUCCESSION_RISK_LEVELS,
  RoleCriticalityLevel,
  SuccessionRiskLevel,
} from '../constants/succession.constants';
import { CriticalRole, DevelopmentPlan } from '../types/succession.types';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

interface SuccessionDashboardProps {
  companyId: string;
  onAddCriticalRole?: () => void;
  onViewRole?: (role: CriticalRole) => void;
  onManageSuccessors?: (role: CriticalRole) => void;
  onViewDevelopmentPlan?: (plan: DevelopmentPlan) => void;
  onAddDevelopmentPlan?: () => void;
}

export const SuccessionDashboard: React.FC<SuccessionDashboardProps> = ({
  companyId,
  onAddCriticalRole,
  onViewRole,
  onManageSuccessors,
  onViewDevelopmentPlan,
  onAddDevelopmentPlan,
}) => {
  const {
    criticalRoles,
    developmentPlans,
    analytics,
    isLoading,
    error,
    loadCriticalRoles,
    loadAnalytics,
    activatePlan,
  } = useSuccession({ companyId });

  const [criticalityFilter, setCriticalityFilter] = useState<RoleCriticalityLevel | ''>('');
  const [riskFilter, setRiskFilter] = useState<SuccessionRiskLevel | ''>('');
  const [activeTab, setActiveTab] = useState<'roles' | 'plans' | 'matrix'>('roles');

  const handleRefresh = () => {
    loadCriticalRoles();
    loadAnalytics();
  };

  const filteredRoles = criticalRoles.filter(role => {
    if (criticalityFilter && role.criticalityLevel !== criticalityFilter) return false;
    if (riskFilter && role.successionRisk !== riskFilter) return false;
    return true;
  });

  const handleHeatmapClick = (criticality: RoleCriticalityLevel, risk: SuccessionRiskLevel) => {
    setCriticalityFilter(criticality);
    setRiskFilter(risk);
    setActiveTab('roles');
  };

  // Get all successors for the matrix
  const allSuccessors = criticalRoles.flatMap(r => r.successors);

  if (error) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-4">
        <p className="text-red-600">{error}</p>
        <button
          onClick={handleRefresh}
          className="mt-2 text-sm text-red-600 hover:text-red-800 underline"
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Succession Planning</h1>
          <p className="text-gray-500">Manage critical roles and talent pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onAddCriticalRole}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
          >
            <Plus className="w-4 h-4" />
            Add Critical Role
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      {analytics && (
        <KPIGrid cols={4}>
          <KPICard label="Critical Roles" value={analytics.totalCriticalRoles} />
          <KPICard label="Ready Now Coverage" value={`${analytics.overallCoverage}%`} />
          <KPICard
            label="High Risk Roles"
            value={analytics.criticalRiskCount + analytics.highRiskCount}
          />
          <KPICard label="Active Dev Plans" value={analytics.activeDevelopmentPlans} />
        </KPIGrid>
      )}

      {/* Risk Heatmap */}
      <RiskHeatmap roles={criticalRoles} onCellClick={handleHeatmapClick} />

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('roles')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'roles'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Critical Roles ({filteredRoles.length})
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'plans'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Development Plans ({developmentPlans.length})
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm flex items-center gap-1 ${
              activeTab === 'matrix'
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            9-Box Matrix
          </button>
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'roles' && (
        <div>
          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex items-center gap-2">
              <Filter className="w-4 h-4 text-gray-400" />
              <select
                value={criticalityFilter}
                onChange={(e) => setCriticalityFilter(e.target.value as RoleCriticalityLevel | '')}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
              >
                <option value="">All Criticality</option>
                <option value={ROLE_CRITICALITY_LEVELS.MISSION_CRITICAL}>Mission Critical</option>
                <option value={ROLE_CRITICALITY_LEVELS.HIGH}>High</option>
                <option value={ROLE_CRITICALITY_LEVELS.MEDIUM}>Medium</option>
                <option value={ROLE_CRITICALITY_LEVELS.LOW}>Low</option>
              </select>
              <select
                value={riskFilter}
                onChange={(e) => setRiskFilter(e.target.value as SuccessionRiskLevel | '')}
                className="text-sm border border-gray-300 rounded-lg px-3 py-1.5"
              >
                <option value="">All Risk Levels</option>
                <option value={SUCCESSION_RISK_LEVELS.CRITICAL}>Critical Risk</option>
                <option value={SUCCESSION_RISK_LEVELS.HIGH}>High Risk</option>
                <option value={SUCCESSION_RISK_LEVELS.MEDIUM}>Medium Risk</option>
                <option value={SUCCESSION_RISK_LEVELS.LOW}>Low Risk</option>
              </select>
              {(criticalityFilter || riskFilter) && (
                <button
                  onClick={() => {
                    setCriticalityFilter('');
                    setRiskFilter('');
                  }}
                  className="text-sm text-gray-500 hover:text-gray-700 underline"
                >
                  Clear filters
                </button>
              )}
            </div>
          </div>

          {/* Roles Grid */}
          {isLoading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="bg-gray-100 rounded-lg h-64 animate-pulse" />
              ))}
            </div>
          ) : filteredRoles.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredRoles.map(role => (
                <CriticalRoleCard
                  key={role.id}
                  role={role}
                  onSelect={onViewRole}
                  onManageSuccessors={onManageSuccessors}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No critical roles found</p>
              <p className="text-sm text-gray-500 mt-1">
                {criticalityFilter || riskFilter
                  ? 'Try adjusting your filters'
                  : 'Add your first critical role to get started'}
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'plans' && (
        <div>
          <div className="flex justify-end mb-4">
            <button
              onClick={onAddDevelopmentPlan}
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-indigo-600 text-white rounded-lg hover:bg-indigo-700"
            >
              <Plus className="w-4 h-4" />
              New Development Plan
            </button>
          </div>

          {developmentPlans.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {developmentPlans.map(plan => (
                <DevelopmentPlanCard
                  key={plan.id}
                  plan={plan}
                  onSelect={onViewDevelopmentPlan}
                  onActivate={activatePlan}
                />
              ))}
            </div>
          ) : (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <Target className="w-12 h-12 text-gray-400 mx-auto mb-3" />
              <p className="text-gray-600 font-medium">No development plans yet</p>
              <p className="text-sm text-gray-500 mt-1">
                Create development plans for your succession candidates
              </p>
            </div>
          )}
        </div>
      )}

      {activeTab === 'matrix' && (
        <TalentPoolMatrix
          members={allSuccessors}
          onMemberClick={(memberId) => {
            const role = criticalRoles.find(r => r.successors.some(s => s.id === memberId));
            if (role) onViewRole?.(role);
          }}
        />
      )}
    </div>
  );
};

export default SuccessionDashboard;
