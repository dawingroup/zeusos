/**
 * Purchase Order Card Component
 * Reusable card for displaying PO summary information
 */

import { Link } from 'react-router-dom';
import { ShoppingCart, ExternalLink, Package, Truck } from 'lucide-react';
import type { PurchaseOrder } from '@/modules/procurement/types/purchaseOrder';
import { POStatusBadge } from './StatusBadge';

interface POCardProps {
  order: PurchaseOrder;
  showActions?: boolean;
  compact?: boolean;
  onClick?: () => void;
}

export function POCard({ order, showActions = true, compact = false, onClick }: POCardProps) {
  const compactClassName =
    'block bg-white rounded-lg border border-gray-200 p-3 hover:shadow-sm hover:border-gray-300 transition-all';
  const fullClassName =
    'block bg-white rounded-lg shadow-sm border border-gray-200 hover:shadow-md hover:border-gray-300 transition-all';

  // Calculate receiving progress
  const totalQuantity = order.lineItems.reduce((sum, li) => sum + li.quantity, 0);
  const receivedQuantity = order.lineItems.reduce((sum, li) => sum + li.quantityReceived, 0);
  const receivingProgress = totalQuantity > 0 ? (receivedQuantity / totalQuantity) * 100 : 0;

  // Compact card content
  const compactContent = (
    <>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <ShoppingCart className="h-4 w-4 text-gray-400 flex-shrink-0" />
          <span className="font-medium text-gray-900 truncate">{order.poNumber}</span>
        </div>
        <POStatusBadge status={order.status} />
      </div>
      <p className="text-sm text-gray-600 mt-1 truncate">{order.supplierName}</p>
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
              <ShoppingCart className="h-4 w-4 text-gray-400 flex-shrink-0" />
              <span className="font-semibold text-gray-900">{order.poNumber}</span>
            </div>
            <p className="text-sm text-gray-600 mt-0.5 truncate">{order.supplierName}</p>
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
        {/* Status Badge */}
        <POStatusBadge status={order.status} />

        {/* Line Items Summary */}
        <div className="flex items-center gap-1 text-sm text-gray-600">
          <Package className="h-4 w-4" />
          <span>
            {order.lineItems.length} item{order.lineItems.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Totals */}
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-500">Subtotal</span>
            <span className="text-gray-900">
              {order.totals.subtotal.toLocaleString()} {order.totals.currency}
            </span>
          </div>
          {order.totals.landedCostTotal > 0 && (
            <div className="flex justify-between">
              <span className="text-gray-500">Landed</span>
              <span className="text-gray-600">+{order.totals.landedCostTotal.toLocaleString()}</span>
            </div>
          )}
          <div className="flex justify-between font-medium pt-1 border-t border-gray-100">
            <span>Total</span>
            <span>
              {order.totals.grandTotal.toLocaleString()} {order.totals.currency}
            </span>
          </div>
        </div>

        {/* Receiving Progress (for sent/partially-received) */}
        {['sent', 'partially-received', 'received'].includes(order.status) && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-1 text-gray-600">
                <Truck className="h-4 w-4" />
                <span>Receiving</span>
              </div>
              <span className="text-gray-900">
                {receivedQuantity}/{totalQuantity}
              </span>
            </div>
            <div className="w-full bg-gray-100 rounded-full h-1.5">
              <div
                className="bg-green-500 h-1.5 rounded-full transition-all"
                style={{ width: `${receivingProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Footer with Linked MOs */}
      {order.linkedMOIds && order.linkedMOIds.length > 0 && (
        <div className="px-4 py-2 bg-gray-50 border-t border-gray-100 rounded-b-lg">
          <span className="text-xs text-gray-500">
            {order.linkedMOIds.length} linked MO{order.linkedMOIds.length !== 1 ? 's' : ''}
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
      <Link to={`/procurement/orders/${order.id}`} className={compactClassName}>
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
    <Link to={`/procurement/orders/${order.id}`} className={fullClassName}>
      {fullContent}
    </Link>
  );
}

// Grid layout wrapper for PO cards
interface POCardGridProps {
  orders: PurchaseOrder[];
  compact?: boolean;
  onOrderClick?: (order: PurchaseOrder) => void;
}

export function POCardGrid({ orders, compact = false, onOrderClick }: POCardGridProps) {
  if (orders.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
        <ShoppingCart className="w-12 h-12 text-gray-300 mx-auto mb-3" />
        <h3 className="text-lg font-medium text-gray-900">No purchase orders</h3>
        <p className="text-gray-500 mt-1">Purchase orders will appear here when created</p>
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
        <POCard
          key={order.id}
          order={order}
          compact={compact}
          onClick={onOrderClick ? () => onOrderClick(order) : undefined}
        />
      ))}
    </div>
  );
}
