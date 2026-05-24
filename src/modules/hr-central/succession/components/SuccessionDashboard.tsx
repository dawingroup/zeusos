// ============================================================================
// SUCCESSION DASHBOARD
// ZeusOS v2.0 - HR Module
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
      <div className="bg-[var(--rag-red-soft)] border border-[var(--rag-red)] rounded-lg p-4">
        <p className="text-[var(--rag-red)]">{error}</p>
        <button
          onClick={handleRefresh}
          className="mt-2 text-sm text-[var(--rag-red)] hover:text-[var(--rag-red)] underline"
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
          <h1 className="text-2xl font-bold text-foreground">Succession Planning</h1>
          <p className="text-muted-foreground">Manage critical roles and talent pipeline</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 text-muted-foreground hover:text-foreground hover:bg-[var(--bg-sunken)] rounded-lg"
          >
            <RefreshCw className={`w-5 h-5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
          <button
            onClick={onAddCriticalRole}
            className="flex items-center gap-2 px-4 py-2 bg-[var(--rag-blue)] text-white rounded-lg hover:bg-[var(--rag-blue)]"
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
      <div className="border-b border-[var(--border-subtle)]">
        <nav className="flex gap-4">
          <button
            onClick={() => setActiveTab('roles')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'roles'
                ? 'border-[var(--rag-blue)] text-[var(--rag-blue)]'
                : 'border-transparent text-muted-foreground hover:text-muted-foreground'
            }`}
          >
            Critical Roles ({filteredRoles.length})
          </button>
          <button
            onClick={() => setActiveTab('plans')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm ${
              activeTab === 'plans'
                ? 'border-[var(--rag-blue)] text-[var(--rag-blue)]'
                : 'border-transparent text-muted-foreground hover:text-muted-foreground'
            }`}
          >
            Development Plans ({developmentPlans.length})
          </button>
          <button
            onClick={() => setActiveTab('matrix')}
            className={`pb-3 px-1 border-b-2 font-medium text-sm flex items-center gap-1 ${
              activeTab === 'matrix'
                ? 'border-[var(--rag-blue)] text-[var(--rag-blue)]'
                : 'border-transparent text-muted-foreground hover:text-muted-foreground'
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
              <Filter className="w-4 h-4 text-[var(--fg-tertiary)]" />
              <select
                value={criticalityFilter}
                onChange={(e) => setCriticalityFilter(e.target.value as RoleCriticalityLevel | '')}
                className="text-sm border border-[var(--border-default)] rounded-lg px-3 py-1.5"
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
                className="text-sm border border-[var(--border-default)] rounded-lg px-3 py-1.5"
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
                  className="text-sm text-muted-foreground hover:text-muted-foreground underline"
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
                <div key={i} className="bg-[var(--bg-sunken)] rounded-lg h-64 animate-pulse" />
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
            <div className="text-center py-12 bg-[var(--bg-sunken)] rounded-lg">
              <Users className="w-12 h-12 text-[var(--fg-tertiary)] mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No critical roles found</p>
              <p className="text-sm text-muted-foreground mt-1">
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
              className="flex items-center gap-2 px-3 py-1.5 text-sm bg-[var(--rag-blue)] text-white rounded-lg hover:bg-[var(--rag-blue)]"
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
            <div className="text-center py-12 bg-[var(--bg-sunken)] rounded-lg">
              <Target className="w-12 h-12 text-[var(--fg-tertiary)] mx-auto mb-3" />
              <p className="text-muted-foreground font-medium">No development plans yet</p>
              <p className="text-sm text-muted-foreground mt-1">
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
