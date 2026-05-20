/**
 * Child Requisitions Summary
 * Shows on parent funds requisition detail page — lists all child requisitions
 * with budget utilization progress bar.
 */

import { Link } from 'react-router-dom';
import { Package, Hammer, ArrowRight } from 'lucide-react';
import type { Requisition } from '../../types/requisition';
import { REQUISITION_TYPE_CONFIG, normalizeRequisitionType } from '../../types/requisition';

interface ChildRequisitionsSummaryProps {
  parentRequisition: Requisition;
  children: Requisition[];
  loading?: boolean;
}

function formatCurrency(amount: number): string {
  return `UGX ${amount.toLocaleString()}`;
}

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    draft: 'bg-gray-100 text-gray-700',
    submitted: 'bg-blue-100 text-blue-700',
    approved: 'bg-green-100 text-green-700',
    paid: 'bg-purple-100 text-purple-700',
    cancelled: 'bg-red-100 text-red-700',
  };
  return styles[status] || 'bg-gray-100 text-gray-700';
}

export function ChildRequisitionsSummary({
  parentRequisition,
  children,
  loading,
}: ChildRequisitionsSummaryProps) {
  const parentAmount = parentRequisition.grossAmount || 0;
  const summary = parentRequisition.childRequisitionsSummary;

  const totalChildAmount = summary?.totalChildAmount ?? children.reduce((s, c) => s + (c.grossAmount || 0), 0);
  const materialCount = summary?.materialRequisitionsCount ?? children.filter(c => normalizeRequisitionType(c.requisitionType as string) === 'materials').length;
  const labourCount = summary?.labourRequisitionsCount ?? children.filter(c => c.requisitionType === 'labour').length;
  const materialAmount = summary?.materialRequisitionsAmount ?? 0;
  const labourAmount = summary?.labourRequisitionsAmount ?? 0;

  const utilizationPercent = parentAmount > 0 ? Math.min((totalChildAmount / parentAmount) * 100, 100) : 0;
  const exceeded = totalChildAmount > parentAmount;

  if (loading) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 bg-gray-200 rounded w-48"></div>
          <div className="h-3 bg-gray-200 rounded w-full"></div>
          <div className="h-3 bg-gray-200 rounded w-3/4"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      <div className="p-4 border-b border-gray-100">
        <h3 className="text-sm font-semibold text-gray-900">Child Requisitions</h3>
        <p className="text-xs text-gray-500 mt-1">
          Materials and labour requisitions against this funds requisition
        </p>
      </div>

      {/* Budget utilization bar */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
        <div className="flex items-center justify-between text-xs mb-2">
          <span className="text-gray-600">
            Budget Utilization: {formatCurrency(totalChildAmount)} / {formatCurrency(parentAmount)}
          </span>
          <span className={`font-semibold ${exceeded ? 'text-red-600' : 'text-gray-900'}`}>
            {utilizationPercent.toFixed(0)}%
            {exceeded && ' (exceeded)'}
          </span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className={`h-2 rounded-full transition-all ${
              exceeded ? 'bg-red-500' : utilizationPercent > 80 ? 'bg-yellow-500' : 'bg-green-500'
            }`}
            style={{ width: `${Math.min(utilizationPercent, 100)}%` }}
          />
        </div>
        <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
          <span className="flex items-center gap-1">
            <Package className="w-3 h-3 text-blue-600" />
            Materials: {materialCount} ({formatCurrency(materialAmount)})
          </span>
          <span className="flex items-center gap-1">
            <Hammer className="w-3 h-3 text-green-600" />
            Labour: {labourCount} ({formatCurrency(labourAmount)})
          </span>
        </div>
      </div>

      {/* Child requisitions list */}
      {children.length === 0 ? (
        <div className="p-6 text-center text-sm text-gray-500">
          No child requisitions yet. Create materials or labour requisitions from the actions above.
        </div>
      ) : (
        <div className="divide-y divide-gray-100">
          {children.map((child) => {
            const type = normalizeRequisitionType(child.requisitionType as string);
            const config = REQUISITION_TYPE_CONFIG[type];
            return (
              <Link
                key={child.id}
                to={`/advisory/delivery/requisitions/${child.id}`}
                className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors"
              >
                <div
                  className={`w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 ${
                    type === 'materials' ? 'bg-blue-100' : 'bg-green-100'
                  }`}
                >
                  {type === 'materials' ? (
                    <Package className="w-4 h-4 text-blue-600" />
                  ) : (
                    <Hammer className="w-4 h-4 text-green-600" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900 truncate">
                      {child.requisitionNumber || child.purpose}
                    </span>
                    <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${getStatusBadge(child.status)}`}>
                      {child.status}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 truncate">{config?.label} — {child.purpose}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <div className="text-sm font-medium text-gray-900">
                    {formatCurrency(child.grossAmount || 0)}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-400 flex-shrink-0" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
