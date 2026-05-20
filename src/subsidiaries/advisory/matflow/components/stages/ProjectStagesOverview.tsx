/**
 * Project Stages Overview Component
 * Dashboard view of all construction stages
 */

import React, { useState } from 'react';
import {
  LayoutGrid,
  List,
  Clock,
  TrendingUp,
  AlertTriangle,
  CheckCircle2,
  ChevronRight,
  X,
} from 'lucide-react';
import { useStageProgress, useProjectStageOverview } from '../../hooks/useStageProgress';
import { StageProgressBar } from './StageProgressBar';
import { StageTimeline } from './StageTimeline';
import type { StageProgress } from '../../types/stageProgress';

interface ProjectStagesOverviewProps {
  projectId: string;
  onStageSelect?: (stage: StageProgress) => void;
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) return `UGX ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `UGX ${(value / 1000).toFixed(0)}K`;
  return `UGX ${value.toLocaleString()}`;
};

export const ProjectStagesOverview: React.FC<ProjectStagesOverviewProps> = ({ 
  projectId,
  onStageSelect 
}) => {
  const { stages, loading: stagesLoading } = useStageProgress(projectId);
  const { overview, loading: overviewLoading } = useProjectStageOverview(projectId);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [selectedStage, setSelectedStage] = useState<StageProgress | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'timeline' | 'blockers'>('overview');

  const isLoading = stagesLoading || overviewLoading;

  if (isLoading) {
    return <ProjectStagesOverviewSkeleton />;
  }

  const handleStageClick = (stage: StageProgress) => {
    setSelectedStage(stage);
    onStageSelect?.(stage);
  };

  return (
    <>
      <div className="space-y-6">
        {/* Summary Cards */}
        {overview && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard
              title="Overall Progress"
              value={`${Math.round(overview.overallProgress)}%`}
              icon={TrendingUp}
              iconColor="text-blue-500"
              subtitle={`${overview.completedStages}/${overview.totalStages} stages complete`}
            />
            <SummaryCard
              title="On Schedule"
              value={overview.onScheduleStages}
              icon={CheckCircle2}
              iconColor="text-green-500"
              subtitle={
                overview.daysAheadOrBehind >= 0
                  ? `${overview.daysAheadOrBehind} days ahead` 
                  : `${Math.abs(overview.daysAheadOrBehind)} days behind` 
              }
              subtitleColor={overview.daysAheadOrBehind >= 0 ? 'text-green-600' : 'text-red-600'}
            />
            <SummaryCard
              title="At Risk"
              value={overview.delayedStages + overview.blockedStages}
              icon={AlertTriangle}
              iconColor="text-orange-500"
              subtitle={`${overview.blockedStages} blocked`}
            />
            <SummaryCard
              title="Budget Status"
              value={`${overview.budgetVariancePercent > 0 ? '+' : ''}${overview.budgetVariancePercent.toFixed(1)}%`}
              icon={overview.budgetVariancePercent > 5 ? AlertTriangle : TrendingUp}
              iconColor={overview.budgetVariancePercent > 5 ? 'text-red-500' : 'text-green-500'}
              subtitle={formatCurrency(overview.totalSpent)}
            />
          </div>
        )}

        {/* Stages Section */}
        <div className="bg-white border border-gray-200 rounded-lg">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <h3 className="font-semibold text-gray-900">Construction Stages</h3>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-2 rounded ${viewMode === 'grid' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              >
                <LayoutGrid className="h-4 w-4" />
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-2 rounded ${viewMode === 'list' ? 'bg-gray-100' : 'hover:bg-gray-50'}`}
              >
                <List className="h-4 w-4" />
              </button>
            </div>
          </div>
          <div className="p-4">
            {stages.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <Clock className="h-12 w-12 mx-auto mb-2 opacity-50" />
                <p>No stages configured yet</p>
                <p className="text-sm">Import a BOQ to get started</p>
              </div>
            ) : viewMode === 'grid' ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {stages.map((stage) => (
                  <StageProgressBar
                    key={stage.id}
                    stage={stage}
                    showDetails
                    onClick={() => handleStageClick(stage)}
                  />
                ))}
              </div>
            ) : (
              <div className="space-y-2">
                {stages.map((stage) => (
                  <StageProgressBar
                    key={stage.id}
                    stage={stage}
                    compact
                    onClick={() => handleStageClick(stage)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Critical Path Alert */}
        {overview && overview.criticalPathStages.length > 0 && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4">
            <div className="flex items-center gap-3">
              <AlertTriangle className="h-5 w-5 text-red-600" />
              <div className="flex-1">
                <p className="font-medium text-red-800">
                  {overview.criticalPathStages.length} stage(s) on critical path
                </p>
                <p className="text-sm text-red-600">
                  These stages require immediate attention
                </p>
              </div>
              <button className="flex items-center gap-1 px-3 py-1.5 text-sm border border-red-300 rounded-lg text-red-700 hover:bg-red-100">
                View Details
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Stage Detail Modal */}
      {selectedStage && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between p-4 border-b border-gray-200">
              <h3 className="font-semibold">{selectedStage.stageName}</h3>
              <button 
                onClick={() => setSelectedStage(null)}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {/* Tabs */}
            <div className="border-b border-gray-200">
              <nav className="flex gap-4 px-4">
                {(['overview', 'timeline', 'blockers'] as const).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`py-3 text-sm font-medium border-b-2 transition-colors ${
                      activeTab === tab
                        ? 'border-amber-500 text-amber-600'
                        : 'border-transparent text-gray-500 hover:text-gray-700'
                    }`}
                  >
                    {tab.charAt(0).toUpperCase() + tab.slice(1)}
                  </button>
                ))}
              </nav>
            </div>

            <div className="p-4 overflow-y-auto" style={{ maxHeight: 'calc(80vh - 140px)' }}>
              {activeTab === 'overview' && (
                <StageProgressBar stage={selectedStage} showDetails />
              )}
              {activeTab === 'timeline' && (
                <StageTimeline 
                  projectId={projectId} 
                  stageId={selectedStage.stageId} 
                  maxHeight="300px" 
                />
              )}
              {activeTab === 'blockers' && (
                selectedStage.activeBlockers.length === 0 ? (
                  <div className="text-center py-8 text-gray-500">
                    <CheckCircle2 className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <p>No active blockers</p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {selectedStage.activeBlockers.map((blocker) => (
                      <div
                        key={blocker.id}
                        className="p-3 rounded-lg border bg-orange-50 border-orange-200"
                      >
                        <div className="flex items-center justify-between">
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full border border-orange-300 text-orange-700">
                            {blocker.type.replace('_', ' ')}
                          </span>
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${
                            blocker.severity === 'critical' ? 'bg-red-100 text-red-700' :
                            blocker.severity === 'high' ? 'bg-orange-100 text-orange-700' :
                            'bg-gray-100 text-gray-700'
                          }`}>
                            {blocker.severity}
                          </span>
                        </div>
                        <p className="mt-2 text-sm">{blocker.description}</p>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};

interface SummaryCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  iconColor: string;
  subtitle: string;
  subtitleColor?: string;
}

const SummaryCard: React.FC<SummaryCardProps> = ({
  title,
  value,
  icon: Icon,
  iconColor,
  subtitle,
  subtitleColor = 'text-gray-500',
}) => {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-gray-100">
          <Icon className={`h-5 w-5 ${iconColor}`} />
        </div>
        <div>
          <p className="text-sm text-gray-500">{title}</p>
          <p className="text-2xl font-bold">{value}</p>
          <p className={`text-xs ${subtitleColor}`}>{subtitle}</p>
        </div>
      </div>
    </div>
  );
};

const ProjectStagesOverviewSkeleton: React.FC = () => {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white border border-gray-200 rounded-lg p-4">
            <div className="h-16 bg-gray-100 rounded animate-pulse" />
          </div>
        ))}
      </div>
      <div className="bg-white border border-gray-200 rounded-lg">
        <div className="p-4 border-b border-gray-200">
          <div className="h-6 w-48 bg-gray-100 rounded animate-pulse" />
        </div>
        <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-48 bg-gray-100 rounded animate-pulse" />
          ))}
        </div>
      </div>
    </div>
  );
};

export default ProjectStagesOverview;
