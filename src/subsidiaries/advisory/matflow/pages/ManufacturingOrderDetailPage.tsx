/**
 * Manufacturing Order Detail Page
 * View and manage a single manufacturing work order
 */

import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Factory,
  ArrowLeft,
  Loader2,
  AlertTriangle,
  Clock,
  PlayCircle,
  PauseCircle,
  CheckCircle,
  XCircle,
  ClipboardCheck,
} from 'lucide-react';
import { cn } from '@/core/lib/utils';
import { useAuth } from '@/shared/hooks';
import { getManufacturingOrder, updateManufacturingOrderStatus } from '../services/manufacturing-service';
import type { ManufacturingOrder, ManufacturingOrderStatus } from '../types/manufacturing';
import { MO_STATUS_CONFIG, MO_PRIORITY_CONFIG, MO_STATUS_TRANSITIONS } from '../types/manufacturing';

const STATUS_ICONS: Partial<Record<ManufacturingOrderStatus, React.ElementType>> = {
  draft: Clock,
  planned: Clock,
  in_progress: PlayCircle,
  on_hold: PauseCircle,
  quality_check: ClipboardCheck,
  completed: CheckCircle,
  cancelled: XCircle,
};

const ACTION_LABELS: Partial<Record<ManufacturingOrderStatus, string>> = {
  planned: 'Plan',
  in_progress: 'Start Production',
  on_hold: 'Put On Hold',
  quality_check: 'Send to QC',
  completed: 'Mark Complete',
  cancelled: 'Cancel',
};

const formatCurrency = (amount: number): string =>
  new Intl.NumberFormat('en-UG', { style: 'currency', currency: 'UGX', minimumFractionDigits: 0 }).format(amount);

const formatDate = (timestamp: any): string => {
  if (!timestamp) return '-';
  const date = timestamp?.toDate ? timestamp.toDate() : new Date(timestamp);
  return date.toLocaleDateString('en-UG', { year: 'numeric', month: 'short', day: 'numeric' });
};

const ManufacturingOrderDetailPage: React.FC = () => {
  const { projectId, moId } = useParams<{ projectId: string; moId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();

  const [order, setOrder] = useState<ManufacturingOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchOrder = useCallback(async () => {
    if (!projectId || !moId) return;
    setLoading(true);
    try {
      const data = await getManufacturingOrder(projectId, moId);
      setOrder(data);
    } catch (err) {
      console.error('Failed to load order:', err);
    } finally {
      setLoading(false);
    }
  }, [projectId, moId]);

  useEffect(() => {
    fetchOrder();
  }, [fetchOrder]);

  const handleStatusChange = async (newStatus: ManufacturingOrderStatus) => {
    if (!user || !projectId || !moId) return;
    setActionLoading(newStatus);
    try {
      const userName = user.displayName || user.email || 'Unknown';
      await updateManufacturingOrderStatus(projectId, moId, newStatus, user.uid, userName);
      await fetchOrder();
    } catch (err) {
      console.error('Status update failed:', err);
      alert('Failed to update status. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-amber-600" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
        <AlertTriangle className="w-8 h-8 text-red-500 mx-auto mb-2" />
        <p className="text-red-700">Manufacturing order not found</p>
        <button onClick={() => navigate(-1)} className="mt-2 text-sm text-red-600 underline">
          Go back
        </button>
      </div>
    );
  }

  const statusConfig = MO_STATUS_CONFIG[order.status];
  const priorityConfig = MO_PRIORITY_CONFIG[order.priority];
  const validTransitions = MO_STATUS_TRANSITIONS[order.status];
  const progress = order.quantity > 0 ? Math.round((order.completedQuantity / order.quantity) * 100) : 0;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate(-1)}
          className="p-2 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Factory className="h-6 w-6 text-amber-600" />
              {order.orderNumber}
            </h1>
            <span className={cn('inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full', statusConfig.color)}>
              {statusConfig.label}
            </span>
            <span className={cn('inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full', priorityConfig.color)}>
              {priorityConfig.label}
            </span>
          </div>
          <p className="text-muted-foreground">{order.productName}</p>
        </div>
      </div>

      {/* Status Actions */}
      {validTransitions.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap">
          {validTransitions.map(status => {
            const Icon = STATUS_ICONS[status] || Clock;
            const isDestructive = status === 'cancelled';
            return (
              <button
                key={status}
                onClick={() => handleStatusChange(status)}
                disabled={!!actionLoading}
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors disabled:opacity-50',
                  isDestructive
                    ? 'bg-red-50 text-red-700 hover:bg-red-100 border border-red-200'
                    : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                )}
              >
                {actionLoading === status ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Icon className="w-4 h-4" />
                )}
                {ACTION_LABELS[status] || MO_STATUS_CONFIG[status].label}
              </button>
            );
          })}
        </div>
      )}

      {/* Progress */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider">Production Progress</h3>
          <span className="text-sm font-medium text-gray-700">{progress}%</span>
        </div>
        <div className="w-full h-3 bg-gray-200 rounded-full overflow-hidden mb-3">
          <div
            className={cn('h-full rounded-full transition-all', progress >= 100 ? 'bg-green-500' : 'bg-amber-500')}
            style={{ width: `${Math.min(progress, 100)}%` }}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
          <div>
            <span className="text-gray-500">Target:</span>
            <span className="ml-2 font-medium">{order.quantity} {order.unit}</span>
          </div>
          <div>
            <span className="text-gray-500">Completed:</span>
            <span className="ml-2 font-medium">{order.completedQuantity} {order.unit}</span>
          </div>
          <div>
            <span className="text-gray-500">Defects:</span>
            <span className="ml-2 font-medium text-red-600">{order.defectQuantity}</span>
          </div>
          <div>
            <span className="text-gray-500">Remaining:</span>
            <span className="ml-2 font-medium">{Math.max(0, order.quantity - order.completedQuantity)} {order.unit}</span>
          </div>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Details</h3>
          <dl className="space-y-3 text-sm">
            {order.productDescription && (
              <div>
                <dt className="text-gray-500">Description</dt>
                <dd className="text-gray-900 mt-0.5">{order.productDescription}</dd>
              </div>
            )}
            {order.workCenter && (
              <div>
                <dt className="text-gray-500">Work Center</dt>
                <dd className="text-gray-900 mt-0.5">{order.workCenter}</dd>
              </div>
            )}
            {order.assignedToName && (
              <div>
                <dt className="text-gray-500">Assigned To</dt>
                <dd className="text-gray-900 mt-0.5">{order.assignedToName}</dd>
              </div>
            )}
            {order.notes && (
              <div>
                <dt className="text-gray-500">Notes</dt>
                <dd className="text-gray-900 mt-0.5">{order.notes}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Timeline & Cost</h3>
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500">Planned Start</dt>
              <dd className="text-gray-900">{formatDate(order.plannedStartDate)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Planned End</dt>
              <dd className="text-gray-900">{formatDate(order.plannedEndDate)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Actual Start</dt>
              <dd className="text-gray-900">{formatDate(order.actualStartDate)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Actual End</dt>
              <dd className="text-gray-900">{formatDate(order.actualEndDate)}</dd>
            </div>
            <div className="border-t pt-3 flex justify-between">
              <dt className="text-gray-500">Estimated Cost</dt>
              <dd className="font-medium text-gray-900">{formatCurrency(order.estimatedCost)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Material Cost</dt>
              <dd className="text-gray-900">{formatCurrency(order.materialCost)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500">Labor Cost</dt>
              <dd className="text-gray-900">{formatCurrency(order.laborCost)}</dd>
            </div>
          </dl>
        </div>
      </div>

      {/* Materials */}
      {order.materials.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">Bill of Materials</h3>
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b">
                <th className="pb-2">Material</th>
                <th className="pb-2 text-right">Required</th>
                <th className="pb-2 text-right">Consumed</th>
                <th className="pb-2 text-right">Unit Cost</th>
                <th className="pb-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {order.materials.map((m, idx) => (
                <tr key={idx}>
                  <td className="py-2 text-gray-900">{m.materialName}</td>
                  <td className="py-2 text-right text-gray-600">{m.quantityRequired} {m.unit}</td>
                  <td className="py-2 text-right text-gray-600">{m.quantityConsumed} {m.unit}</td>
                  <td className="py-2 text-right text-gray-600">{formatCurrency(m.unitCost)}</td>
                  <td className="py-2 text-right font-medium">{formatCurrency(m.totalCost)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* History */}
      {order.history && order.history.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <h3 className="text-sm font-semibold text-gray-900 uppercase tracking-wider mb-4">History</h3>
          <div className="space-y-3">
            {order.history.map((entry, idx) => (
              <div key={idx} className="flex items-start gap-3 text-sm">
                <div className="w-2 h-2 rounded-full bg-amber-400 mt-1.5 flex-shrink-0" />
                <div>
                  <p className="text-gray-900">{entry.action}</p>
                  <p className="text-gray-500">
                    {entry.userName} &middot; {formatDate(entry.timestamp)}
                  </p>
                  {entry.notes && <p className="text-gray-600 mt-0.5">{entry.notes}</p>}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default ManufacturingOrderDetailPage;
