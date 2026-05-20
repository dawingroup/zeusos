/**
 * MOCascadeTreePanel — full parent/children tree view on the MO detail
 * page, plus aggregate totals (quantity, material+labor cost, % complete)
 * across the whole cascade cluster.
 *
 * Hidden entirely when the MO has no cascade relationships.
 */

import { Link } from 'react-router-dom';
import { GitBranch, GitMerge, FilePlus, Package, ArrowRight } from 'lucide-react';
import type { MOCascadeTree } from '../../services/moCascadeService';
import { MO_STATUS_LABELS, MO_STAGE_LABELS } from '../../types';
import type { ManufacturingOrder, ManufacturingOrderStatus } from '../../types';

interface Props {
  tree: MOCascadeTree | null;
  loading?: boolean;
}

const STATUS_PILL: Record<ManufacturingOrderStatus, string> = {
  draft: 'bg-gray-100 text-gray-700',
  'pending-approval': 'bg-yellow-100 text-yellow-700',
  approved: 'bg-blue-100 text-blue-700',
  'in-progress': 'bg-indigo-100 text-indigo-700',
  'on-hold': 'bg-red-100 text-red-700',
  'partially-complete': 'bg-teal-100 text-teal-700',
  completed: 'bg-green-100 text-green-700',
  'closed-out': 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-gray-100 text-gray-500',
};

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  return new Intl.NumberFormat('en-UG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

function progress(mo: ManufacturingOrder): number {
  if (mo.status === 'completed' || mo.status === 'closed-out') return 100;
  if (mo.status === 'cancelled') return 0;
  const total = mo.batchQuantity ?? mo.quantity ?? 0;
  if (total === 0) return 0;
  return Math.min(100, Math.round(((mo.completedQuantity ?? 0) / total) * 100));
}

export default function MOCascadeTreePanel({ tree, loading }: Props) {
  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="flex items-center gap-2 text-xs text-gray-500">
          <div className="animate-spin rounded-full h-3 w-3 border-b-2 border-gray-400" />
          Loading cascade…
        </div>
      </div>
    );
  }

  if (!tree) return null;

  const hasAnyCascade =
    Boolean(tree.parent) || tree.children.length > 0 || Boolean(tree.root.originChangeOrderId);
  if (!hasAnyCascade) return null;

  const cluster = [tree.root, ...tree.children];
  const aggregateUnits = cluster.reduce((s, m) => s + (m.quantity ?? 0), 0);
  const aggregateCost = cluster.reduce((s, m) => s + (m.costSummary?.totalCost ?? 0), 0);
  const avgProgress = Math.round(cluster.reduce((s, m) => s + progress(m), 0) / cluster.length);
  const currency = tree.root.costSummary?.currency ?? 'UGX';

  return (
    <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
        <div className="flex items-center gap-2">
          <GitMerge className="h-4 w-4 text-indigo-600" />
          <h3 className="text-sm font-semibold text-gray-900">Cascade tree</h3>
          <span className="text-xs text-gray-500">
            {tree.children.length === 0
              ? 'No CO-spawned children'
              : `${tree.children.length} child MO${tree.children.length > 1 ? 's' : ''}`}
          </span>
        </div>
        {tree.originChangeOrderIds.length > 0 && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold bg-violet-50 text-violet-700 border border-violet-200">
            <FilePlus className="h-3 w-3" />
            {tree.originChangeOrderIds.length} originating CO
            {tree.originChangeOrderIds.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* Aggregate totals */}
      <div className="grid grid-cols-3 divide-x divide-gray-100 border-b border-gray-100">
        <div className="px-4 py-2">
          <p className="text-[10px] text-gray-400 uppercase">Total units</p>
          <p className="text-sm font-semibold text-gray-900">{aggregateUnits}</p>
        </div>
        <div className="px-4 py-2">
          <p className="text-[10px] text-gray-400 uppercase">Cluster cost</p>
          <p className="text-sm font-semibold text-gray-900">
            {formatCurrency(aggregateCost, currency)}
          </p>
        </div>
        <div className="px-4 py-2">
          <p className="text-[10px] text-gray-400 uppercase">Avg progress</p>
          <p className="text-sm font-semibold text-gray-900">{avgProgress}%</p>
        </div>
      </div>

      {/* Parent row */}
      {tree.parent && (
        <div className="px-4 py-2 border-b border-gray-100 bg-indigo-50/30">
          <div className="flex items-center gap-2">
            <GitBranch className="h-3.5 w-3.5 text-indigo-600" />
            <span className="text-[10px] uppercase text-indigo-600 font-semibold">
              Parent
            </span>
            <Link
              to={`/manufacturing/orders/${tree.parent.id}`}
              className="text-sm font-medium text-indigo-700 hover:underline"
            >
              {tree.parent.moNumber}
            </Link>
            <span className="text-xs text-gray-500 truncate">
              {tree.parent.itemName}
            </span>
            <span
              className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                STATUS_PILL[tree.parent.status] ?? 'bg-gray-100 text-gray-600'
              }`}
            >
              {MO_STATUS_LABELS[tree.parent.status] ?? tree.parent.status}
            </span>
          </div>
        </div>
      )}

      {/* Root (this MO) */}
      <div className="px-4 py-2 border-b border-gray-100">
        <div className="flex items-center gap-2">
          <Package className="h-3.5 w-3.5 text-gray-600" />
          <span className="text-[10px] uppercase text-gray-500 font-semibold">
            This MO
          </span>
          <span className="text-sm font-medium text-gray-900">{tree.root.moNumber}</span>
          <span className="text-xs text-gray-500 truncate">{tree.root.itemName}</span>
          <span
            className={`ml-auto px-1.5 py-0.5 rounded text-[10px] font-semibold ${
              STATUS_PILL[tree.root.status] ?? 'bg-gray-100 text-gray-600'
            }`}
          >
            {MO_STATUS_LABELS[tree.root.status] ?? tree.root.status}
          </span>
        </div>
      </div>

      {/* Children */}
      {tree.children.length > 0 && (
        <div>
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-100">
            <span className="text-[10px] uppercase text-gray-500 font-semibold">
              Children (spawned by change orders)
            </span>
          </div>
          <ul className="divide-y divide-gray-100">
            {tree.children.map((child) => (
              <li key={child.id} className="px-4 py-2">
                <div className="flex items-center gap-2">
                  <ArrowRight className="h-3.5 w-3.5 text-emerald-600" />
                  <Link
                    to={`/manufacturing/orders/${child.id}`}
                    className="text-sm font-medium text-indigo-700 hover:underline"
                  >
                    {child.moNumber}
                  </Link>
                  <span className="text-xs text-gray-500 truncate flex-1">
                    {child.itemName}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    Qty {child.quantity}
                  </span>
                  <span className="text-[11px] text-gray-500">
                    · {MO_STAGE_LABELS[child.currentStage] ?? child.currentStage}
                  </span>
                  <span
                    className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                      STATUS_PILL[child.status] ?? 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {MO_STATUS_LABELS[child.status] ?? child.status}
                  </span>
                </div>
                {child.originChangeOrderId && child.salesOrderId && (
                  <p className="pl-5 mt-0.5">
                    <Link
                      to={`/sales-orders/${child.salesOrderId}/change-orders/${child.originChangeOrderId}`}
                      className="text-[11px] text-violet-600 hover:underline"
                    >
                      View originating change order →
                    </Link>
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
