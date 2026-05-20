/**
 * Procurement List Component
 * Displays list of procurement entries with filtering and actions
 */

import React, { useState } from 'react';
import {
  Search,
  Plus,
  MoreVertical,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Loader2,
  Trash2,
  Package,
  FileCheck,
} from 'lucide-react';
import {
  useProcurementEntries,
  useConfirmProcurement,
  useCancelProcurement,
  useDeleteProcurement,
  useBulkUpdateStatus,
  useBulkDeleteProcurement,
} from '../../hooks/useProcurement';
import type {
  ProcurementEntry,
  ProcurementStatus,
  ProcurementType,
  ProcurementFilters,
} from '../../types/procurement';
import { DeliveryLogForm } from './DeliveryLogForm';
import { QualityCheckDialog } from './QualityCheckDialog';

// ============================================================================
// STATUS BADGE
// ============================================================================

const StatusBadge: React.FC<{ status: ProcurementStatus }> = ({ status }) => {
  const config: Record<ProcurementStatus, { label: string; icon: React.ElementType; className: string }> = {
    pending: { label: 'Pending', icon: Clock, className: 'bg-gray-100 text-gray-700' },
    confirmed: { label: 'Confirmed', icon: CheckCircle, className: 'bg-green-100 text-green-700' },
    cancelled: { label: 'Cancelled', icon: XCircle, className: 'bg-red-100 text-red-700' },
    disputed: { label: 'Disputed', icon: AlertTriangle, className: 'bg-amber-100 text-amber-700' },
  };
  
  const { label, icon: Icon, className } = config[status];
  
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${className}`}>
      <Icon size={12} />
      {label}
    </span>
  );
};

// ============================================================================
// TYPE BADGE
// ============================================================================

const TypeBadge: React.FC<{ type: ProcurementType }> = ({ type }) => {
  const labels: Record<ProcurementType, string> = {
    delivery: 'Delivery',
    purchase_order: 'PO',
    stock_adjustment: 'Adjustment',
    return: 'Return',
    transfer: 'Transfer',
  };
  
  return (
    <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs">
      {labels[type]}
    </span>
  );
};

// ============================================================================
// FORMAT HELPERS
// ============================================================================

const formatCurrency = (amount: number): string => {
  return `UGX ${amount.toLocaleString()}`;
};

const formatDate = (timestamp: { toDate: () => Date }): string => {
  const date = timestamp.toDate();
  return date.toLocaleDateString('en-UG', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ============================================================================
// COMPONENT
// ============================================================================

interface ProcurementListProps {
  projectId: string;
}

export const ProcurementList: React.FC<ProcurementListProps> = ({ projectId }) => {
  const [filters, setFilters] = useState<ProcurementFilters>({});
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [showAddForm, setShowAddForm] = useState(false);
  const [qualityCheckEntry, setQualityCheckEntry] = useState<ProcurementEntry | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  
  // Hooks
  const {
    entries,
    loading,
    loadingMore,
    hasMore,
    loadMore,
    refresh,
  } = useProcurementEntries(projectId, { ...filters, searchQuery });
  
  const { confirm } = useConfirmProcurement(projectId);
  const { cancel } = useCancelProcurement(projectId);
  const { remove } = useDeleteProcurement(projectId);
  const { bulkUpdate, loading: bulkUpdateLoading } = useBulkUpdateStatus(projectId);
  const { bulkDelete, loading: bulkDeleteLoading } = useBulkDeleteProcurement(projectId);
  
  // Selection handlers
  const toggleSelection = (id: string) => {
    const newSelected = new Set(selectedIds);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedIds(newSelected);
  };
  
  const toggleSelectAll = () => {
    if (selectedIds.size === entries.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(entries.map((e) => e.id)));
    }
  };
  
  const handleBulkConfirm = async () => {
    const success = await bulkUpdate(Array.from(selectedIds), 'confirmed');
    if (success) {
      setSelectedIds(new Set());
      refresh();
    }
  };
  
  const handleBulkDelete = async () => {
    if (!window.confirm(`Delete ${selectedIds.size} entries?`)) return;
    const success = await bulkDelete(Array.from(selectedIds));
    if (success) {
      setSelectedIds(new Set());
      refresh();
    }
  };

  const handleConfirm = async (id: string) => {
    const success = await confirm(id);
    if (success) refresh();
    setOpenMenuId(null);
  };

  const handleCancel = async (id: string) => {
    const reason = window.prompt('Reason for cancellation:');
    if (!reason) return;
    const success = await cancel(id, reason);
    if (success) refresh();
    setOpenMenuId(null);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this entry?')) return;
    const success = await remove(id);
    if (success) refresh();
    setOpenMenuId(null);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search deliveries..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 pr-4 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 w-64"
            />
          </div>
          
          {/* Status Filter */}
          <select
            value={filters.status?.[0] || ''}
            onChange={(e) => setFilters(f => ({
              ...f,
              status: e.target.value ? [e.target.value as ProcurementStatus] : undefined,
            }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="confirmed">Confirmed</option>
            <option value="disputed">Disputed</option>
            <option value="cancelled">Cancelled</option>
          </select>
          
          {/* Type Filter */}
          <select
            value={filters.type?.[0] || ''}
            onChange={(e) => setFilters(f => ({
              ...f,
              type: e.target.value ? [e.target.value as ProcurementType] : undefined,
            }))}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-amber-500"
          >
            <option value="">All Types</option>
            <option value="delivery">Delivery</option>
            <option value="purchase_order">Purchase Order</option>
            <option value="stock_adjustment">Adjustment</option>
            <option value="return">Return</option>
          </select>
        </div>
        
        <button
          onClick={() => setShowAddForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-amber-600 text-white rounded-lg font-medium hover:bg-amber-700"
        >
          <Plus size={16} />
          Log Delivery
        </button>
      </div>
      
      {/* Bulk Actions */}
      {selectedIds.size > 0 && (
        <div className="flex items-center gap-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
          <span className="text-sm font-medium text-amber-800">
            {selectedIds.size} selected
          </span>
          <button
            onClick={handleBulkConfirm}
            disabled={bulkUpdateLoading}
            className="flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-lg text-sm font-medium hover:bg-green-200 disabled:opacity-50"
          >
            <CheckCircle size={14} />
            Confirm All
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={bulkDeleteLoading}
            className="flex items-center gap-1 px-3 py-1.5 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200 disabled:opacity-50"
          >
            <Trash2 size={14} />
            Delete
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            Clear
          </button>
        </div>
      )}
      
      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="w-10 px-4 py-3">
                <input
                  type="checkbox"
                  checked={entries.length > 0 && selectedIds.size === entries.length}
                  onChange={toggleSelectAll}
                  className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                />
              </th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reference</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Material</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Qty</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Amount</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Supplier</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
              <th className="w-10 px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {loading ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center">
                  <Loader2 className="w-6 h-6 animate-spin mx-auto text-amber-600" />
                </td>
              </tr>
            ) : entries.length === 0 ? (
              <tr>
                <td colSpan={10} className="px-4 py-12 text-center">
                  <div className="flex flex-col items-center gap-2 text-gray-500">
                    <Package className="w-8 h-8" />
                    <p>No procurement entries yet</p>
                    <button
                      onClick={() => setShowAddForm(true)}
                      className="text-amber-600 hover:text-amber-700 text-sm"
                    >
                      Log your first delivery
                    </button>
                  </div>
                </td>
              </tr>
            ) : (
              entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(entry.id)}
                      onChange={() => toggleSelection(entry.id)}
                      className="w-4 h-4 text-amber-600 rounded focus:ring-amber-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <span className="font-mono text-sm text-gray-700">
                      {entry.referenceNumber}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <TypeBadge type={entry.type} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-[180px] truncate text-sm text-gray-900" title={entry.materialName}>
                      {entry.materialName}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-medium text-gray-900">{entry.quantityAccepted}</span>
                    <span className="text-gray-500 text-sm ml-1">{entry.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-gray-900">
                    {formatCurrency(entry.totalAmount)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="max-w-[140px] truncate text-sm text-gray-600" title={entry.supplierName}>
                      {entry.supplierName}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {formatDate(entry.deliveryDate)}
                  </td>
                  <td className="px-4 py-3">
                    <StatusBadge status={entry.status} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === entry.id ? null : entry.id)}
                        className="p-1 text-gray-400 hover:text-gray-600 rounded"
                      >
                        <MoreVertical size={16} />
                      </button>
                      
                      {openMenuId === entry.id && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenMenuId(null)} />
                          <div className="absolute right-0 z-50 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1">
                            {entry.status === 'pending' && (
                              <>
                                <button
                                  onClick={() => {
                                    setQualityCheckEntry(entry);
                                    setOpenMenuId(null);
                                  }}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <FileCheck size={14} />
                                  Quality Check
                                </button>
                                <button
                                  onClick={() => handleConfirm(entry.id)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <CheckCircle size={14} />
                                  Confirm
                                </button>
                                <button
                                  onClick={() => handleCancel(entry.id)}
                                  className="w-full flex items-center gap-2 px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                                >
                                  <XCircle size={14} />
                                  Cancel
                                </button>
                              </>
                            )}
                            <div className="border-t border-gray-100 my-1" />
                            <button
                              onClick={() => handleDelete(entry.id)}
                              className="w-full flex items-center gap-2 px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                            >
                              <Trash2 size={14} />
                              Delete
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      
      {/* Load More */}
      {hasMore && (
        <div className="flex justify-center">
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="flex items-center gap-2 px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
          >
            {loadingMore && <Loader2 size={16} className="animate-spin" />}
            Load More
          </button>
        </div>
      )}
      
      {/* Dialogs */}
      <DeliveryLogForm
        projectId={projectId}
        open={showAddForm}
        onOpenChange={setShowAddForm}
        onSuccess={refresh}
      />
      
      {qualityCheckEntry && (
        <QualityCheckDialog
          projectId={projectId}
          entry={qualityCheckEntry}
          open={!!qualityCheckEntry}
          onOpenChange={(isOpen: boolean) => {
            if (!isOpen) setQualityCheckEntry(null);
          }}
          onSuccess={() => {
            setQualityCheckEntry(null);
            refresh();
          }}
        />
      )}
    </div>
  );
};

export default ProcurementList;
