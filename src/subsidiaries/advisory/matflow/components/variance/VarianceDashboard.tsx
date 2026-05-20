/**
 * Variance Dashboard
 * Main dashboard for planned vs actual analysis
 */

import React, { useState } from 'react';
import {
  RefreshCw,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Package,
  DollarSign,
  Loader2,
  BarChart3,
  PieChart,
  Activity,
} from 'lucide-react';
import { useDashboardMetrics } from '../../hooks/useVariance';
import { CostVarianceChart } from '../charts/CostVarianceChart';
import { FulfillmentProgressChart } from '../charts/FulfillmentProgressChart';
import { StageBreakdownChart } from '../charts/StageBreakdownChart';
import { CostTrendChart, QuantityTrendChart } from '../charts/TrendCharts';
import { MaterialVarianceTable } from './MaterialVarianceTable';
import { AlertsList } from './AlertsList';
import type { VarianceStatus } from '../../types/variance';

interface VarianceDashboardProps {
  projectId: string;
  projectName: string;
}

const formatCurrency = (value: number): string => {
  if (value >= 1000000) return `UGX ${(value / 1000000).toFixed(1)}M`;
  if (value >= 1000) return `UGX ${(value / 1000).toFixed(0)}K`;
  return `UGX ${value.toLocaleString()}`;
};

const StatusBadge: React.FC<{ status: VarianceStatus }> = ({ status }) => {
  const config: Record<VarianceStatus, { label: string; className: string }> = {
    'on-track': { label: 'On Track', className: 'bg-green-100 text-green-800' },
    'under-procured': { label: 'Under', className: 'bg-amber-100 text-amber-800' },
    'over-procured': { label: 'Over', className: 'bg-red-100 text-red-800' },
    'cost-overrun': { label: 'Overrun', className: 'bg-red-100 text-red-800' },
    'cost-savings': { label: 'Savings', className: 'bg-green-100 text-green-800' },
    'at-risk': { label: 'At Risk', className: 'bg-red-100 text-red-800' },
  };

  const { label, className } = config[status];
  return (
    <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${className}`}>
      {label}
    </span>
  );
};

export const VarianceDashboard: React.FC<VarianceDashboardProps> = ({
  projectId,
  projectName,
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'materials' | 'stages' | 'trends'>('overview');
  const [selectedStage, setSelectedStage] = useState<string>('all');
  
  const { summary, metrics, trends, loading, error, refresh } = useDashboardMetrics(projectId);

  if (error) {
    return (
      <div className="bg-white border border-red-200 rounded-lg p-8 text-center">
        <AlertTriangle className="w-12 h-12 text-red-500 mx-auto mb-4" />
        <p className="text-red-700 font-medium">Failed to load variance data</p>
        <p className="text-sm text-gray-500 mt-2">{error.message}</p>
        <button
          onClick={refresh}
          className="mt-4 px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700"
        >
          <RefreshCw className="w-4 h-4 inline mr-2" />
          Retry
        </button>
      </div>
    );
  }

  const getStatusFromVariance = (variance?: number): 'success' | 'warning' | 'danger' | 'neutral' => {
    if (variance === undefined) return 'neutral';
    if (variance > 20) return 'danger';
    if (variance > 10) return 'warning';
    if (variance < -10) return 'success';
    return 'neutral';
  };

  const getStatusFromFulfillment = (fulfillment?: number): 'success' | 'warning' | 'danger' | 'neutral' => {
    if (fulfillment === undefined) return 'neutral';
    if (fulfillment >= 90) return 'success';
    if (fulfillment >= 70) return 'warning';
    return 'danger';
  };

  const statusColors = {
    success: 'text-green-600',
    warning: 'text-amber-600',
    danger: 'text-red-600',
    neutral: 'text-gray-600',
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Planned vs. Actual Analysis</h2>
          <p className="text-gray-600">{projectName} - Material procurement variance</p>
        </div>
        <button
          onClick={refresh}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </button>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {/* Budget Status */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Budget Status</span>
            <DollarSign className={`w-4 h-4 ${statusColors[getStatusFromVariance(metrics?.costVariancePercent)]}`} />
          </div>
          {loading ? (
            <div className="h-12 flex items-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-900">{formatCurrency(metrics?.totalSpent || 0)}</p>
              <p className="text-xs text-gray-500">of {formatCurrency(metrics?.totalBudget || 0)} budget</p>
              {metrics?.costVariancePercent !== undefined && (
                <div className={`flex items-center text-xs mt-1 ${
                  metrics.costVariancePercent > 0 ? 'text-red-600' : 'text-green-600'
                }`}>
                  {metrics.costVariancePercent > 0 ? <TrendingUp className="w-3 h-3 mr-1" /> : <TrendingDown className="w-3 h-3 mr-1" />}
                  {metrics.costVariancePercent > 0 ? '+' : ''}{metrics.costVariancePercent.toFixed(1)}% vs budget
                </div>
              )}
            </>
          )}
        </div>

        {/* Material Fulfillment */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Material Fulfillment</span>
            <Package className={`w-4 h-4 ${statusColors[getStatusFromFulfillment(metrics?.fulfillmentPercent)]}`} />
          </div>
          {loading ? (
            <div className="h-12 flex items-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-900">{metrics?.fulfillmentPercent.toFixed(1)}%</p>
              <p className="text-xs text-gray-500">
                {metrics?.materialsOnTrack} of {summary?.totalMaterialsPlanned} materials on track
              </p>
              <div className="h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
                <div 
                  className="h-full bg-amber-500 transition-all"
                  style={{ width: `${metrics?.fulfillmentPercent || 0}%` }}
                />
              </div>
            </>
          )}
        </div>

        {/* Acceptance Rate */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Acceptance Rate</span>
            <CheckCircle className={`w-4 h-4 ${
              (metrics?.acceptanceRate || 0) >= 90 ? 'text-green-600' : 'text-amber-600'
            }`} />
          </div>
          {loading ? (
            <div className="h-12 flex items-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-900">{metrics?.acceptanceRate.toFixed(1)}%</p>
              <p className="text-xs text-gray-500">quality pass rate</p>
              <div className="h-2 bg-gray-200 rounded-full mt-2 overflow-hidden">
                <div 
                  className="h-full bg-green-500 transition-all"
                  style={{ width: `${metrics?.acceptanceRate || 0}%` }}
                />
              </div>
            </>
          )}
        </div>

        {/* Active Alerts */}
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-600">Active Alerts</span>
            <AlertTriangle className={`w-4 h-4 ${
              (metrics?.criticalAlerts || 0) > 0 ? 'text-red-600' : 'text-green-600'
            }`} />
          </div>
          {loading ? (
            <div className="h-12 flex items-center"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
          ) : (
            <>
              <p className="text-2xl font-bold text-gray-900">{metrics?.alertCount || 0}</p>
              <p className="text-xs text-gray-500">
                {metrics?.criticalAlerts ? `${metrics.criticalAlerts} critical` : 'No critical issues'}
              </p>
            </>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="flex gap-4">
          {[
            { id: 'overview', label: 'Overview', icon: BarChart3 },
            { id: 'materials', label: 'Materials', icon: Package },
            { id: 'stages', label: 'By Stage', icon: PieChart },
            { id: 'trends', label: 'Trends', icon: Activity },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as typeof activeTab)}
              className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.id
                  ? 'border-amber-500 text-amber-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              <tab.icon className="w-4 h-4" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Cost Variance Chart */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-base font-medium text-gray-900 mb-4">Cost Variance by Stage</h3>
              {loading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : summary ? (
                <CostVarianceChart stages={summary.stages} />
              ) : null}
            </div>

            {/* Fulfillment Progress */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-base font-medium text-gray-900 mb-4">Material Fulfillment Progress</h3>
              {loading ? (
                <div className="h-64 flex items-center justify-center">
                  <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
                </div>
              ) : summary ? (
                <FulfillmentProgressChart summary={summary} />
              ) : null}
            </div>
          </div>

          {/* Top Issues */}
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Top Cost Overruns */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-base font-medium text-gray-900 mb-4 flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-red-600" />
                Top Cost Overruns
              </h3>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : summary?.topCostOverruns.length ? (
                <div className="space-y-3">
                  {summary.topCostOverruns.map(item => (
                    <div key={item.materialId} className="flex items-center justify-between">
                      <div>
                        <p className="font-medium text-sm">{item.materialInfo.name}</p>
                        <p className="text-xs text-gray-500">
                          {formatCurrency(item.variance.costDelta)} over budget
                        </p>
                      </div>
                      <span className="px-2 py-1 bg-red-100 text-red-800 text-xs font-medium rounded-full">
                        +{item.variance.costPercent.toFixed(1)}%
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">No cost overruns detected</p>
              )}
            </div>

            {/* Top Shortages */}
            <div className="bg-white border border-gray-200 rounded-lg p-6">
              <h3 className="text-base font-medium text-gray-900 mb-4 flex items-center gap-2">
                <TrendingDown className="w-4 h-4 text-amber-600" />
                Materials Behind Schedule
              </h3>
              {loading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map(i => (
                    <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
                  ))}
                </div>
              ) : summary?.topShortages.length ? (
                <div className="space-y-3">
                  {summary.topShortages.map(item => (
                    <div key={item.materialId} className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-medium text-sm truncate">{item.materialInfo.name}</p>
                        <p className="text-xs text-gray-500">
                          {item.variance.fulfillmentPercent.toFixed(1)}% fulfilled
                        </p>
                      </div>
                      <div className="w-20 h-2 bg-gray-200 rounded-full overflow-hidden ml-4">
                        <div
                          className="h-full bg-amber-500"
                          style={{ width: `${item.variance.fulfillmentPercent}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-gray-500 text-center py-4">All materials on track</p>
              )}
            </div>
          </div>

          {/* Recent Alerts */}
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-base font-medium text-gray-900 mb-4">Recent Alerts</h3>
            {loading ? (
              <div className="h-48 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <AlertsList alerts={summary?.recentAlerts || []} />
            )}
          </div>
        </div>
      )}

      {activeTab === 'materials' && (
        <div className="bg-white border border-gray-200 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-medium text-gray-900">Material Variance Details</h3>
            <select
              value={selectedStage}
              onChange={e => setSelectedStage(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="all">All Stages</option>
              {summary?.stages.map(stage => (
                <option key={stage.stageId} value={stage.stageId}>{stage.stageName}</option>
              ))}
            </select>
          </div>
          {loading ? (
            <div className="h-96 flex items-center justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
            </div>
          ) : summary ? (
            <MaterialVarianceTable
              materials={
                selectedStage === 'all'
                  ? summary.stages.flatMap(s => s.materials)
                  : summary.stages.find(s => s.stageId === selectedStage)?.materials || []
              }
            />
          ) : null}
        </div>
      )}

      {activeTab === 'stages' && (
        <div className="space-y-6">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-base font-medium text-gray-900 mb-4">Stage-by-Stage Breakdown</h3>
            {loading ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : summary ? (
              <StageBreakdownChart stages={summary.stages} />
            ) : null}
          </div>

          {/* Stage Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {summary?.stages.map(stage => (
              <div key={stage.stageId} className="bg-white border border-gray-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="font-medium text-sm text-gray-900 truncate">{stage.stageName}</h4>
                  <StatusBadge status={stage.status} />
                </div>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-500">Budget</span>
                    <span>{formatCurrency(stage.totalPlannedCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Actual</span>
                    <span>{formatCurrency(stage.totalActualCost)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-500">Variance</span>
                    <span className={stage.costVariancePercent > 0 ? 'text-red-600' : 'text-green-600'}>
                      {stage.costVariancePercent > 0 ? '+' : ''}{stage.costVariancePercent.toFixed(1)}%
                    </span>
                  </div>
                  <div className="pt-2">
                    <div className="flex justify-between text-xs text-gray-500 mb-1">
                      <span>Fulfillment</span>
                      <span>{stage.fulfillmentPercent.toFixed(0)}%</span>
                    </div>
                    <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-amber-500"
                        style={{ width: `${stage.fulfillmentPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === 'trends' && (
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-base font-medium text-gray-900 mb-4">Cost Trend (30 Days)</h3>
            {loading || !trends ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <CostTrendChart data={trends.cost} />
            )}
          </div>

          <div className="bg-white border border-gray-200 rounded-lg p-6">
            <h3 className="text-base font-medium text-gray-900 mb-4">Quantity Trend (30 Days)</h3>
            {loading || !trends ? (
              <div className="h-64 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              </div>
            ) : (
              <QuantityTrendChart data={trends.quantity} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default VarianceDashboard;
