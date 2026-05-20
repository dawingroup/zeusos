/**
 * Manufacturing Order Card Component
 * Reusable card for displaying MO summary information
 */

import { Link } from 'react-router-dom';
import { Factory, ExternalLink, Calendar, DollarSign } from 'lucide-react';
import type { ManufacturingOrder } from '../../types';
import { MOStatusBadge, MOStageBadge, PriorityBadge } from './StatusBadge';

interface MOCardProps {
  order: ManufacturingOrder;
  showActions?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

export function MOCard({ order, showActions = true, compact = false, onClick }: MOCardProps) {
  const compactClassName =
    'block bg-white rounded-lg border border-gray-200 p-3 hover:shadow-sm hover:border-gray-300 transition-all';
  const fullClassName =
    'block bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all';

  // Compact card content
  const compactContent = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <Factory className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="font-medium text-gray-900 truncate">{order.moNumber}</span>
        </div>
        <MOStatusBadge status={order.status} />
      </div>
      <p className="text-sm text-gray-600 mt-1 truncate">{order.designItemName}</p>
    </>
  );

  // Full card content
  const fullContent = (
    <>
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Factory className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="font-semibold text-gray-900">{order.moNumber}</span>
            </div>
            <p className="text-sm text-gray-600 mt-0.5 truncate">{order.designItemName}</p>
          </div>
          {showActions && (
            <button className="p-1 hover:bg-gray-100 rounded transition-colors flex-shrink-0">
              <ExternalLink className="h-4 w-4 text-gray-400" />
            </button>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Status Badges */}
        <div className="flex flex-wrap gap-2">
          <MOStatusBadge status={order.status} />
          <MOStageBadge stage={order.currentStage} />
          <PriorityBadge priority={order.priority} />
        </div>

        {/* Project Info */}
        <div className="text-sm">
          <span className="text-gray-500">Project:</span>{' '}
          <span className="text-gray-900">{order.projectCode}</span>
        </div>

        {/* Stats Row */}
        <div className="flex items-center gap-4 text-sm">
          <div className="flex items-center gap-1 text-gray-600">
            <DollarSign className="h-4 w-4" />
            <span>
              {order.costSummary.totalCost.toLocaleString()} {order.costSummary.currency}
            </span>
          </div>
          {order.scheduling.scheduledEnd && (
            <div className="flex items-center gap-1 text-gray-600">
              <Calendar className="h-4 w-4" />
              <span>
                {new Date(
                  typeof order.scheduling.scheduledEnd === 'object' &&
                  'toDate' in order.scheduling.scheduledEnd
                    ? (order.scheduling.scheduledEnd as { toDate: () => Date }).toDate()
                    : order.scheduling.scheduledEnd as unknown as string | number | Date,
                ).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>

        {/* BOM Summary */}
        {order.bom.length > 0 && (
          <div className="text-sm text-gray-500">
            {order.bom.length} material{order.bom.length !== 1 ? 's' : ''} required
          </div>
        )}
      </div>

      {/* Footer with Linked POs */}
      {order.linkedPOIds && order.linkedPOIds.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 rounded-b-lg">
          <span className="text-xs text-gray-500">
            {order.linkedPOIds.length} linked PO{order.linkedPOIds.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </>
  );

  // Render compact card
  if (compact) {
    if (onClick) {
      return (
        <div onClick={onClick} className={`${compactClassName} cursor-pointer`}>
          {compactContent}
        </div>
      );
    }
    return (
      <Link to={`/manufacturing/orders/${order.id}`} className={compactClassName}>
        {compactContent}
      </Link>
    );
  }

  // Render full card
  if (onClick) {
    return (
      <div onClick={onClick} className={`${fullClassName} cursor-pointer`}>
        {fullContent}
      </div>
    );
  }
  return (
    <Link to={`/manufacturing/orders/${order.id}`} className={fullClassName}>
      {fullContent}
    </Link>
  );
}

// Grid layout wrapper for MO cards
interface MOCardGridProps {
  orders: ManufacturingOrder[];
  compact?: boolean;
  onOrderClick?: (order: ManufacturingOrder) => void;
}

export function MOCardGrid({ orders, compact = false, onOrderClick }: MOCardGridProps) {
  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <Factory className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900">No manufacturing orders</h3>
        <p className="text-gray-500 mt-1">Manufacturing orders will appear here when created</p>
      </div>
    );
  }

  return (
    <div
      className={`grid gap-4 ${
        compact
          ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4'
          : 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3'
      }`}
    >
      {orders.map((order) => (
        <MOCard
          key={order.id}
          order={order}
          compact={compact}
          onClick={onOrderClick ? () => onOrderClick(order) : undefined}
        />
      ))}
    </div>
  );
}
