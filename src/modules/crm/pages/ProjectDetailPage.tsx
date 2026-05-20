/**
 * Project Detail Page
 * Aggregated view of a design project with customer info, financials,
 * design items, manufacturing orders, and activity timeline.
 */

import { useParams, useNavigate, NavLink } from 'react-router-dom';
import {
  ArrowLeft,
  User,
  MapPin,
  Phone,
  Mail,
  DollarSign,
  FolderOpen,
  Factory,
  Clock,
  ExternalLink,
  AlertCircle,
} from 'lucide-react';
import { useProjectDetail } from '../hooks/useProjectDetail';
import { FullPageLoader } from '@/shared/components/feedback/FullPageLoader';
import { ACTIVITY_TYPE_LABELS } from '../constants/crm.constants';
import type { CRMActivityType } from '../types';
import { deriveHandoverStatus } from '@/modules/design-manager/services/designItemStatusDerivation';

// ============================================================
// Helpers
// ============================================================

function formatCurrency(value: number): string {
  return `UGX ${value.toLocaleString()}`;
}

function formatTimestamp(ts: { toDate?: () => Date; seconds?: number } | undefined): string {
  if (!ts) return '-';
  const date = ts.toDate?.() ?? new Date((ts.seconds ?? 0) * 1000);
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const STATUS_BADGE: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  'on-hold': 'bg-yellow-100 text-yellow-700',
  completed: 'bg-blue-100 text-blue-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const STAGE_BADGE: Record<string, string> = {
  // Design stages
  concept: 'bg-gray-100 text-gray-600',
  preliminary: 'bg-blue-50 text-blue-600',
  technical: 'bg-indigo-50 text-indigo-600',
  'pre-production': 'bg-purple-50 text-purple-600',
  'production-ready': 'bg-green-50 text-green-700',
  // Procurement stages
  'procure-identify': 'bg-gray-100 text-gray-600',
  'procure-quote': 'bg-blue-50 text-blue-600',
  'procure-approve': 'bg-indigo-50 text-indigo-600',
  'procure-order': 'bg-purple-50 text-purple-600',
  'procure-received': 'bg-green-50 text-green-700',
  // MO stages
  queued: 'bg-gray-100 text-gray-600',
  cutting: 'bg-blue-100 text-blue-700',
  assembly: 'bg-indigo-100 text-indigo-700',
  finishing: 'bg-purple-100 text-purple-700',
  qc: 'bg-amber-100 text-amber-700',
  ready: 'bg-green-100 text-green-700',
};

const MO_STATUS_BADGE: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-700',
  'pending-approval': 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  'in-progress': 'bg-indigo-100 text-indigo-700',
  'on-hold': 'bg-red-100 text-red-700',
  completed: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

const RAG_COLORS: Record<string, string> = {
  green: 'bg-green-500',
  amber: 'bg-amber-500',
  red: 'bg-red-500',
  'not-applicable': 'bg-gray-300',
};

const FINAL_RELEASE_STAGES = new Set([
  'production-ready',
  'procure-received',
  'arch-approved',
  'const-complete',
]);

function formatStageName(stage: string): string {
  return stage
    .replace(/^(procure-|arch-|const-)/, '')
    .split('-')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

// ============================================================
// Component
// ============================================================

export default function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { project, loading, error } = useProjectDetail(projectId);

  if (loading) return <FullPageLoader />;

  if (error || !project) {
    return (
      <div className="text-center py-12">
        <AlertCircle className="h-12 w-12 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500">{error || 'Project not found.'}</p>
        <button
          onClick={() => navigate('/crm/projects')}
          className="text-blue-600 text-sm mt-2 inline-block"
        >
          Back to Project Tracker
        </button>
      </div>
    );
  }

  const statusBadge = STATUS_BADGE[project.projectStatus] || STATUS_BADGE.active;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/crm/projects')} className="p-1 hover:bg-gray-100 rounded">
          <ArrowLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold text-gray-900">{project.projectName}</h2>
            <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${statusBadge}`}>
              {project.projectStatus.charAt(0).toUpperCase() + project.projectStatus.slice(1).replace('-', ' ')}
            </span>
          </div>
          <p className="text-sm text-gray-500">
            {project.projectCode}
            {project.startDate && ` \u00b7 Started ${formatTimestamp(project.startDate)}`}
            {project.dueDate && ` \u00b7 Due ${formatTimestamp(project.dueDate)}`}
          </p>
        </div>
        {project.linkedDeal && (
          <NavLink
            to={`/crm/deals/${project.linkedDeal.id}`}
            className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-blue-600 border border-blue-200 rounded-lg hover:bg-blue-50"
          >
            Linked Deal: {project.linkedDeal.dealNumber}
          </NavLink>
        )}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Main content */}
        <div className="lg:col-span-2 space-y-6">
          {/* Financial Summary */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <DollarSign className="h-4 w-4" />
              Financial Summary
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <p className="text-xs text-gray-500">Manufacturing Cost</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(project.financials.totalManufacturingCost)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Material Cost</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(project.financials.totalMaterialCost)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Quoted Value</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(project.financials.totalQuotedValue)}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-500">Est. Profit</p>
                <p className="text-lg font-bold text-gray-900">
                  {formatCurrency(project.financials.estimatedProfit)}
                </p>
              </div>
            </div>
          </div>

          {/* Design Items Table */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                Design Items ({project.designItems.length})
              </h3>
            </div>
            {project.designItems.length === 0 ? (
              <p className="text-sm text-gray-400 p-4 text-center">No design items yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Stage</th>
                      <th className="px-4 py-2.5 text-center text-xs font-medium text-gray-500 uppercase">RAG</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Readiness</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">MO</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {project.designItems.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <div>
                            <span className="text-sm font-medium text-gray-900">{item.name}</span>
                            <span className="block text-xs text-gray-500">{item.itemCode}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-xs text-gray-600">
                          {item.sourcingType || '-'}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STAGE_BADGE[item.currentStage] || 'bg-gray-100 text-gray-600'}`}>
                            {formatStageName(item.currentStage)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`inline-block h-3 w-3 rounded-full ${RAG_COLORS[item.ragStatus] || RAG_COLORS['not-applicable']}`} />
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700">
                          {item.overallReadiness}%
                        </td>
                        <td className="px-4 py-3">
                          {item.manufacturingOrderId ? (
                            <NavLink
                              to={`/manufacturing/orders/${item.manufacturingOrderId}`}
                              className="text-xs text-blue-600 hover:underline"
                            >
                              View MO
                            </NavLink>
                          ) : deriveHandoverStatus(item) === 'pending' ? (
                            <span className="text-xs text-amber-600">Pending</span>
                          ) : (
                            <span className="text-xs text-gray-400">-</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Manufacturing Orders Table */}
          <div className="bg-white rounded-lg border overflow-hidden">
            <div className="px-4 py-3 border-b bg-gray-50">
              <h3 className="text-sm font-medium text-gray-700 flex items-center gap-2">
                <Factory className="h-4 w-4" />
                Manufacturing Orders ({project.manufacturingOrders.length})
              </h3>
            </div>
            {project.manufacturingOrders.length === 0 ? (
              <p className="text-sm text-gray-400 p-4 text-center">No manufacturing orders yet</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">MO Number</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Design Item</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                      <th className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase">Stage</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Cost</th>
                      <th className="px-4 py-2.5 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {project.manufacturingOrders.map((mo) => (
                      <tr key={mo.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm font-medium text-gray-900">{mo.moNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-700">{mo.designItemName}</td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${MO_STATUS_BADGE[mo.status] || 'bg-gray-100 text-gray-600'}`}>
                            {mo.status.charAt(0).toUpperCase() + mo.status.slice(1).replace('-', ' ')}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`px-2 py-0.5 text-xs font-medium rounded-full ${STAGE_BADGE[mo.currentStage] || 'bg-gray-100 text-gray-600'}`}>
                            {formatStageName(mo.currentStage)}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-sm text-gray-700">
                          {formatCurrency(mo.costSummary.totalCost)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <NavLink
                            to={`/manufacturing/orders/${mo.id}`}
                            className="p-1 hover:bg-gray-100 rounded inline-flex"
                          >
                            <ExternalLink className="h-4 w-4 text-gray-400" />
                          </NavLink>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Activity Timeline */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3 flex items-center gap-2">
              <Clock className="h-4 w-4" />
              Activity Timeline ({project.activities.length})
            </h3>
            {project.activities.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">No activities recorded yet</p>
            ) : (
              <div className="space-y-3">
                {project.activities.slice(0, 10).map((activity) => (
                  <div key={activity.id} className="flex items-start gap-3">
                    <div className="w-2 h-2 rounded-full bg-blue-400 mt-2 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-900">{activity.title}</p>
                      {activity.description && (
                        <p className="text-xs text-gray-500 mt-0.5">{activity.description}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">
                        {ACTIVITY_TYPE_LABELS[activity.type as CRMActivityType] || activity.type}
                        {' \u00b7 '}
                        {activity.performedByName}
                        {' \u00b7 '}
                        {formatTimestamp(activity.performedAt)}
                      </p>
                    </div>
                  </div>
                ))}
                {project.activities.length > 10 && (
                  <p className="text-xs text-gray-400 text-center">
                    + {project.activities.length - 10} more activities
                  </p>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Sidebar */}
        <div className="space-y-4">
          {/* Customer Card */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Customer</h3>
            <div className="space-y-2">
              {project.customerId ? (
                <NavLink
                  to={`/customers/${project.customerId}`}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  <User className="h-4 w-4" />
                  {project.customerName || 'Unknown'}
                </NavLink>
              ) : (
                <p className="text-sm text-gray-500 flex items-center gap-2">
                  <User className="h-4 w-4 text-gray-400" />
                  {project.customerName || 'No customer linked'}
                </p>
              )}
              {project.customerType && (
                <p className="text-xs text-gray-500 ml-6 capitalize">{project.customerType}</p>
              )}
              {project.customerEmail && (
                <p className="text-xs text-gray-600 flex items-center gap-2">
                  <Mail className="h-3.5 w-3.5 text-gray-400" />
                  {project.customerEmail}
                </p>
              )}
              {project.customerPhone && (
                <p className="text-xs text-gray-600 flex items-center gap-2">
                  <Phone className="h-3.5 w-3.5 text-gray-400" />
                  {project.customerPhone}
                </p>
              )}
              {project.siteLocation && (
                <p className="text-xs text-gray-600 flex items-center gap-2">
                  <MapPin className="h-3.5 w-3.5 text-gray-400" />
                  {project.siteLocation}
                </p>
              )}
            </div>
          </div>

          {/* Project Summary Stats */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Summary</h3>
            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Design Items</span>
                <span className="font-medium text-gray-900">{project.designItems.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Manufacturing Orders</span>
                <span className="font-medium text-gray-900">{project.manufacturingOrders.length}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">Items Ready</span>
                <span className="font-medium text-gray-900">
                  {project.designItems.filter(
                    (i) => FINAL_RELEASE_STAGES.has(i.currentStage)
                  ).length}
                  /{project.designItems.length}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">MOs Completed</span>
                <span className="font-medium text-gray-900">
                  {project.manufacturingOrders.filter((mo) => mo.status === 'completed').length}
                  /{project.manufacturingOrders.length}
                </span>
              </div>
            </div>
          </div>

          {/* Cross-module Links */}
          <div className="bg-white rounded-lg border p-4">
            <h3 className="text-sm font-medium text-gray-700 mb-3">Quick Links</h3>
            <div className="space-y-2">
              <NavLink
                to={`/design/project/${project.projectId}`}
                className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-gray-50"
              >
                <FolderOpen className="h-4 w-4" />
                Open in Design Manager
              </NavLink>
              {project.customerId && (
                <NavLink
                  to={`/customers/${project.customerId}`}
                  className="flex items-center gap-2 text-sm text-blue-600 hover:text-blue-800 p-2 rounded-lg hover:bg-gray-50"
                >
                  <User className="h-4 w-4" />
                  Customer Profile
                </NavLink>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
