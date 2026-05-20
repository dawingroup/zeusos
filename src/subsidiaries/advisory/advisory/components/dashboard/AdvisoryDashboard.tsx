/**
 * Advisory Dashboard
 * 
 * Main dashboard for the Advisory module showing KPIs,
 * portfolio summaries, and alerts.
 */

import React, { useState } from 'react';
import {
  TrendingUp,
  Users,
  Briefcase,
  DollarSign,
  Target,
  Calendar,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import { PortfolioSummaryCard } from './PortfolioSummaryCard';
import { PerformanceWidget } from './PerformanceWidget';
import { PipelineWidget } from './PipelineWidget';
import { AlertsWidget } from './AlertsWidget';
import { useCrossModuleDashboard } from '../../hooks/integration-hooks';

interface AdvisoryDashboardProps {
  userId: string;
}

type Timeframe = 'mtd' | 'qtd' | 'ytd' | '1y';

interface DashboardData {
  totalAUM: number;
  aumChange: number;
  activeClients: number;
  clientChange: number;
  aggregateIRR: number;
  irrChange: number;
  pipelineValue: number;
  pipelineCount: number;
  topPortfolios: {
    id: string;
    name: string;
    value: number;
    irr: number;
    status: string;
  }[];
}

export function AdvisoryDashboard({ userId: _userId }: AdvisoryDashboardProps) {
  const [timeframe, setTimeframe] = useState<Timeframe>('ytd');
  const { data: crossModuleDashboard } = useCrossModuleDashboard();
  
  // Mock dashboard data - would come from a hook in production
  const dashboard: DashboardData = {
    totalAUM: 125000000,
    aumChange: 0.08,
    activeClients: 24,
    clientChange: 0.12,
    aggregateIRR: 0.156,
    irrChange: 0.02,
    pipelineValue: 45000000,
    pipelineCount: 8,
    topPortfolios: [
      { id: '1', name: 'Growth Fund I', value: 45000000, irr: 0.18, status: 'active' },
      { id: '2', name: 'Infrastructure Fund', value: 32000000, irr: 0.14, status: 'active' },
      { id: '3', name: 'Healthcare Portfolio', value: 28000000, irr: 0.21, status: 'active' },
    ],
  };
  
  const loading = false;
  
  if (loading) {
    return <DashboardSkeleton />;
  }
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Advisory Dashboard</h1>
          <p className="text-gray-500">Investment management overview</p>
        </div>
        
        <div className="flex items-center gap-4">
          {/* Timeframe selector */}
          <div className="flex bg-gray-100 rounded-lg p-1">
            {(['mtd', 'qtd', 'ytd', '1y'] as const).map((tf) => (
              <button
                key={tf}
                onClick={() => setTimeframe(tf)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  timeframe === tf
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {tf.toUpperCase()}
              </button>
            ))}
          </div>
          
          <button className="inline-flex items-center px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
            <Calendar className="h-4 w-4 mr-2" />
            Custom Range
          </button>
        </div>
      </div>
      
      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <KPICard
          title="Total AUM"
          value={formatCurrency(dashboard.totalAUM)}
          change={dashboard.aumChange}
          icon={<DollarSign className="h-5 w-5" />}
          trend={dashboard.aumChange >= 0 ? 'up' : 'down'}
        />
        <KPICard
          title="Active Clients"
          value={dashboard.activeClients.toString()}
          change={dashboard.clientChange}
          icon={<Users className="h-5 w-5" />}
          trend={dashboard.clientChange >= 0 ? 'up' : 'down'}
        />
        <KPICard
          title="Portfolio IRR"
          value={formatPercent(dashboard.aggregateIRR)}
          change={dashboard.irrChange}
          icon={<TrendingUp className="h-5 w-5" />}
          trend={dashboard.irrChange >= 0 ? 'up' : 'down'}
        />
        <KPICard
          title="Deal Pipeline"
          value={formatCurrency(dashboard.pipelineValue)}
          subtitle={`${dashboard.pipelineCount} deals`}
          icon={<Target className="h-5 w-5" />}
        />
      </div>
      
      {/* Main Content */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column - Performance & Portfolio */}
        <div className="lg:col-span-2 space-y-6">
          <PerformanceWidget timeframe={timeframe} />
          
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">Portfolio Performance</h3>
            </div>
            <div className="p-4 space-y-4">
              {dashboard.topPortfolios.map((portfolio) => (
                <PortfolioSummaryCard
                  key={portfolio.id}
                  portfolio={portfolio}
                  compact
                />
              ))}
            </div>
          </div>
        </div>
        
        {/* Right Column - Pipeline & Alerts */}
        <div className="space-y-6">
          <PipelineWidget />
          <AlertsWidget />
          
          {/* Quick Actions */}
          <div className="bg-white rounded-lg border shadow-sm">
            <div className="p-4 border-b">
              <h3 className="font-semibold text-gray-900">Quick Actions</h3>
            </div>
            <div className="p-4 space-y-2">
              <button className="w-full flex items-center justify-start px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                <Briefcase className="h-4 w-4 mr-2" />
                New Portfolio
              </button>
              <button className="w-full flex items-center justify-start px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                <Users className="h-4 w-4 mr-2" />
                Add Client
              </button>
              <button className="w-full flex items-center justify-start px-3 py-2 border border-gray-300 rounded-md text-sm font-medium text-gray-700 bg-white hover:bg-gray-50">
                <TrendingUp className="h-4 w-4 mr-2" />
                Record Transaction
              </button>
            </div>
          </div>
        </div>
      </div>
      
      {/* Cross-Module Integration */}
      {crossModuleDashboard && (
        <div className="bg-white rounded-lg border shadow-sm">
          <div className="p-4 border-b">
            <h3 className="font-semibold text-gray-900">Cross-Module Overview</h3>
          </div>
          <div className="p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <h4 className="font-medium text-blue-900">Investment Pipeline</h4>
                <p className="text-2xl font-bold text-blue-600">
                  {crossModuleDashboard.pipeline.dealsInPipeline}
                </p>
                <p className="text-sm text-blue-700">
                  {formatCurrency(crossModuleDashboard.pipeline.pipelineValue.amount)} value
                </p>
              </div>
              
              <div className="p-4 bg-green-50 rounded-lg">
                <h4 className="font-medium text-green-900">Active Projects</h4>
                <p className="text-2xl font-bold text-green-600">
                  {crossModuleDashboard.deliveryStatus.activeProjects}
                </p>
                <p className="text-sm text-green-700">
                  {crossModuleDashboard.deliveryStatus.onTrackProjects} on track
                </p>
              </div>
              
              <div className="p-4 bg-purple-50 rounded-lg">
                <h4 className="font-medium text-purple-900">Portfolio Performance</h4>
                <p className="text-2xl font-bold text-purple-600">
                  {crossModuleDashboard.portfolioPerformance.aggregateMOIC.toFixed(2)}x
                </p>
                <p className="text-sm text-purple-700">Aggregate MOIC</p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

interface KPICardProps {
  title: string;
  value: string;
  change?: number;
  subtitle?: string;
  icon: React.ReactNode;
  trend?: 'up' | 'down';
}

function KPICard({ title, value, change, subtitle, icon, trend }: KPICardProps) {
  return (
    <div className="bg-white rounded-lg border shadow-sm p-6">
      <div className="flex items-center justify-between">
        <div className="p-2 bg-gray-100 rounded-lg">{icon}</div>
        {change !== undefined && (
          <div
            className={`flex items-center text-sm ${
              trend === 'up' ? 'text-green-600' : 'text-red-600'
            }`}
          >
            {trend === 'up' ? (
              <ArrowUpRight className="h-4 w-4" />
            ) : (
              <ArrowDownRight className="h-4 w-4" />
            )}
            {formatPercent(Math.abs(change))}
          </div>
        )}
      </div>
      <div className="mt-4">
        <p className="text-sm text-gray-500">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value}</p>
        {subtitle && <p className="text-sm text-gray-500">{subtitle}</p>}
      </div>
    </div>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-10 bg-gray-200 rounded w-1/3" />
      <div className="grid grid-cols-4 gap-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-32 bg-gray-200 rounded-lg" />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-6">
        <div className="col-span-2 h-96 bg-gray-200 rounded-lg" />
        <div className="h-96 bg-gray-200 rounded-lg" />
      </div>
    </div>
  );
}

function formatCurrency(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${(amount / 1000).toFixed(0)}K`;
  }
  return `$${amount.toFixed(0)}`;
}

function formatPercent(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

export default AdvisoryDashboard;
