/**
 * MatFlow Dashboard
 * Main dashboard with KPIs, charts, and quick actions
 */

import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Plus,
  ArrowRight,
  Truck,
  Receipt,
  ShoppingCart,
  FileText,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { BudgetChart } from './BudgetChart';
import { ProcurementTimeline } from './ProcurementTimeline';

interface MetricCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  trend?: {
    value: number;
    direction: 'up' | 'down';
    label: string;
  };
  icon: React.ReactNode;
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple';
  loading?: boolean;
  onClick?: () => void;
}

const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  subtitle,
  trend,
  icon,
  color = 'blue',
  loading,
  onClick,
}) => {
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-600',
    green: 'bg-green-100 text-green-600',
    yellow: 'bg-yellow-100 text-yellow-600',
    red: 'bg-red-100 text-red-600',
    purple: 'bg-purple-100 text-purple-600',
  };

  if (loading) {
    return (
      <div
        className="rounded-[10px] border bg-[var(--bg-surface)] animate-pulse"
        style={{
          padding: 'var(--pad-card)',
          borderColor: 'var(--border-default)',
        }}
      >
        <div className="h-4 rounded w-1/2 mb-4" style={{ backgroundColor: 'var(--bg-sunken)' }} />
        <div className="h-8 rounded w-1/3 mb-2" style={{ backgroundColor: 'var(--bg-sunken)' }} />
        <div className="h-3 rounded w-2/3" style={{ backgroundColor: 'var(--bg-sunken)' }} />
      </div>
    );
  }

  const inner = (
    <div
      className="flex flex-col gap-1 rounded-[10px] border bg-[var(--bg-surface)] overflow-hidden transition-shadow"
      style={{
        padding: 'var(--pad-card)',
        borderColor: 'var(--border-default)',
      }}
      onMouseEnter={(e) => {
        if (onClick) e.currentTarget.style.boxShadow = 'var(--shadow-md)';
      }}
      onMouseLeave={(e) => {
        if (onClick) e.currentTarget.style.boxShadow = '';
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className="text-[11px] font-medium uppercase tracking-[0.08em]"
          style={{ color: 'var(--fg-tertiary)' }}
        >
          {title}
        </span>
        <span className={cn('p-1.5 rounded-md grid place-items-center shrink-0', colorClasses[color])}>
          {icon}
        </span>
      </div>
      <div
        className="text-[26px] font-semibold tabular-nums mt-1"
        style={{ color: 'var(--fg-primary)', letterSpacing: '-0.02em', lineHeight: 1.15 }}
      >
        {value}
      </div>
      <div className="flex items-center gap-2 mt-1">
        {trend && (
          <span
            className="inline-flex items-center gap-1 text-[12px] font-medium tabular-nums"
            style={{
              color: trend.direction === 'up' ? 'var(--rag-green)' : 'var(--rag-red)',
            }}
          >
            {trend.direction === 'up' ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend.direction === 'up' ? '+' : ''}{trend.value}%
          </span>
        )}
        {subtitle && (
          <span className="text-[12px]" style={{ color: 'var(--fg-secondary)' }}>
            {subtitle}
          </span>
        )}
      </div>
    </div>
  );

  if (onClick) {
    return (
      <button type="button" onClick={onClick} className="text-left w-full cursor-pointer">
        {inner}
      </button>
    );
  }
  return inner;
};

// Utility function for currency formatting
const formatCurrency = (amount: number): string => {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency: 'UGX',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
};

const formatDate = (date: Date | string): string => {
  return new Date(date).toLocaleDateString('en-UG', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

export const MatFlowDashboard: React.FC = () => {
  const navigate = useNavigate();
  const { projectId } = useParams<{ projectId: string }>();

  // Placeholder data - will be connected to hooks later
  const budgetSummary = {
    budgetAmount: 500000000,
    requisitionedAmount: 120000000,
    orderedAmount: 80000000,
    deliveredAmount: 45000000,
    utilizationPercentage: 24,
    variancePercentage: -5,
  };

  const metrics = {
    activeRequisitions: 12,
    openPOs: 8,
    pendingDeliveries: 5,
    overdueDeliveries: 2,
    openPOValue: 150000000,
  };

  const pendingReqs = [
    { id: '1', number: 'REQ-2024-0045', description: 'Cement and sand for foundation', status: 'pending_technical', priority: 'high', createdAt: new Date(), estimatedTotal: 5000000 },
    { id: '2', number: 'REQ-2024-0046', description: 'Steel reinforcement bars', status: 'pending_budget', priority: 'normal', createdAt: new Date(), estimatedTotal: 12000000 },
    { id: '3', number: 'REQ-2024-0047', description: 'Electrical wiring materials', status: 'pending_final', priority: 'urgent', createdAt: new Date(), estimatedTotal: 3500000 },
  ];

  const loading = false;

  const handleQuickAction = (path: string) => {
    navigate(`/advisory/matflow/${projectId}/${path}`);
  };

  return (
    <div>
      {/* Page Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500">
          Overview of material procurement and budget status
        </p>
      </div>

      {/* Budget Alert */}
      {budgetSummary?.variancePercentage && budgetSummary.variancePercentage < -10 && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 text-yellow-600" />
            <span className="text-yellow-800">
              Budget variance is at {budgetSummary.variancePercentage.toFixed(1)}%. 
              Review spending to stay on track.
            </span>
          </div>
          <button
            onClick={() => handleQuickAction('budget')}
            className="text-yellow-700 hover:text-yellow-800 font-medium text-sm"
          >
            View Details
          </button>
        </div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          title="Total Budget"
          value={formatCurrency(budgetSummary?.budgetAmount || 0)}
          subtitle={`${budgetSummary?.utilizationPercentage || 0}% utilized`}
          icon={<FileText className="w-5 h-5" />}
          color="blue"
          loading={loading}
          onClick={() => handleQuickAction('budget')}
        />

        <MetricCard
          title="Active Requisitions"
          value={metrics?.activeRequisitions || 0}
          subtitle={`${pendingReqs?.length || 0} pending approval`}
          icon={<ShoppingCart className="w-5 h-5" />}
          color={pendingReqs?.length ? 'yellow' : 'green'}
          loading={loading}
          onClick={() => handleQuickAction('requisitions')}
        />

        <MetricCard
          title="Open POs"
          value={metrics?.openPOs || 0}
          subtitle={formatCurrency(metrics?.openPOValue || 0)}
          icon={<Receipt className="w-5 h-5" />}
          color="purple"
          loading={loading}
          onClick={() => handleQuickAction('purchase-orders')}
        />

        <MetricCard
          title="Pending Deliveries"
          value={metrics?.pendingDeliveries || 0}
          subtitle="Expected this week"
          icon={<Truck className="w-5 h-5" />}
          color={metrics?.overdueDeliveries ? 'red' : 'green'}
          loading={loading}
          onClick={() => handleQuickAction('deliveries')}
        />
      </div>

      {/* Main Content Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Budget Overview Chart */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-lg border border-gray-200">
            <div className="p-4 border-b border-gray-200 flex items-center justify-between">
              <h2 className="font-semibold text-gray-900">Budget Overview</h2>
              <button
                onClick={() => handleQuickAction('budget')}
                className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
              >
                View All
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
            <div className="p-4">
              <BudgetChart data={budgetSummary} loading={loading} />
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Quick Actions</h2>
          </div>
          <div className="p-4 grid grid-cols-2 gap-3">
            <button
              onClick={() => handleQuickAction('requisitions/new')}
              className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium">New Requisition</span>
            </button>
            <button
              onClick={() => handleQuickAction('purchase-orders/new')}
              className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium">New PO</span>
            </button>
            <button
              onClick={() => handleQuickAction('boq/upload')}
              className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium">Upload BOQ</span>
            </button>
            <button
              onClick={() => handleQuickAction('deliveries/record')}
              className="flex flex-col items-center gap-2 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-5 h-5 text-blue-600" />
              <span className="text-sm font-medium">Record Delivery</span>
            </button>
          </div>
        </div>

        {/* Pending Approvals */}
        <div className="lg:col-span-2 bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <h2 className="font-semibold text-gray-900">Pending Approvals</h2>
            <button
              onClick={() => handleQuickAction('requisitions?filter=pending')}
              className="text-sm text-blue-600 hover:text-blue-700 flex items-center gap-1"
            >
              View All
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {pendingReqs?.length > 0 ? (
              pendingReqs.slice(0, 5).map((req) => (
                <button
                  key={req.id}
                  onClick={() => handleQuickAction(`requisitions/${req.id}`)}
                  className="w-full p-4 hover:bg-gray-50 text-left flex items-center gap-4"
                >
                  <div className="flex-shrink-0">
                    {req.priority === 'urgent' ? (
                      <AlertTriangle className="w-5 h-5 text-red-500" />
                    ) : (
                      <Clock className="w-5 h-5 text-gray-400" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-gray-900">{req.number}</p>
                    <p className="text-sm text-gray-500 truncate">{req.description}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDate(req.createdAt)} • {formatCurrency(req.estimatedTotal)}
                    </p>
                  </div>
                  <span className="flex-shrink-0 px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded">
                    {req.status.replace(/_/g, ' ')}
                  </span>
                </button>
              ))
            ) : (
              <div className="p-8 text-center">
                <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                <p className="text-gray-500">No pending approvals</p>
                <p className="text-sm text-gray-400">All requisitions are up to date</p>
              </div>
            )}
          </div>
        </div>

        {/* Procurement Timeline */}
        <div className="bg-white rounded-lg border border-gray-200">
          <div className="p-4 border-b border-gray-200">
            <h2 className="font-semibold text-gray-900">Procurement Timeline</h2>
          </div>
          <div className="p-4">
            <ProcurementTimeline projectId={projectId!} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default MatFlowDashboard;
