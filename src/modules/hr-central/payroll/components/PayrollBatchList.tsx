/**
 * Payroll Batch List Component
 * DawinOS HR Central - Payroll Module
 * 
 * Displays list of payroll batches with status, actions, and filtering.
 */

import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Plus,
  MoreVertical,
  Eye,
  Play,
  Send,
  CheckCircle,
  CreditCard,
  Download,
  RefreshCw,
  Search,
  ChevronLeft,
  ChevronRight,
  X
} from 'lucide-react';

import {
  PayrollBatch,
  PayrollBatchStatus,
  BATCH_STATUS_LABELS,
  BATCH_STATUS_COLORS
} from '../types/payroll-batch.types';
import { formatCurrency } from '../utils/tax-calculator';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

// ============================================================================
// Types
// ============================================================================

interface PayrollBatchListProps {
  batches: PayrollBatch[];
  isLoading: boolean;
  onCreateBatch: () => void;
  onRefresh: () => void;
  onCalculate?: (batchId: string) => void;
  onSubmitForReview?: (batchId: string) => void;
}

// ============================================================================
// Status Badge Component
// ============================================================================

function StatusBadge({ status }: { status: PayrollBatchStatus }) {
  const colorMap: Record<string, string> = {
    gray: 'bg-gray-100 text-gray-800',
    blue: 'bg-blue-100 text-blue-800',
    indigo: 'bg-indigo-100 text-indigo-800',
    yellow: 'bg-yellow-100 text-yellow-800',
    orange: 'bg-orange-100 text-orange-800',
    cyan: 'bg-cyan-100 text-cyan-800',
    teal: 'bg-teal-100 text-teal-800',
    purple: 'bg-purple-100 text-purple-800',
    green: 'bg-green-100 text-green-800',
    red: 'bg-red-100 text-red-800',
  };

  const color = BATCH_STATUS_COLORS[status] || 'gray';
  const colorClass = colorMap[color] || colorMap.gray;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${colorClass}`}>
      {BATCH_STATUS_LABELS[status]}
    </span>
  );
}

// ============================================================================
// Stat Card Component
// ============================================================================

// ============================================================================
// Dropdown Menu Component (Simple Implementation)
// ============================================================================

function ActionMenu({ 
  batch, 
  onView, 
  onCalculate, 
  onSubmit 
}: { 
  batch: PayrollBatch;
  onView: () => void;
  onCalculate?: () => void;
  onSubmit?: () => void;
}) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setIsOpen(!isOpen); }}
        className="p-1 rounded hover:bg-gray-100 transition-colors"
      >
        <MoreVertical className="h-4 w-4 text-gray-500" />
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-1 w-48 bg-white rounded-md shadow-lg border border-gray-200 z-20">
            <div className="py-1">
              <button
                onClick={(e) => { e.stopPropagation(); onView(); setIsOpen(false); }}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </button>
              
              {batch.status === 'draft' && onCalculate && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCalculate(); setIsOpen(false); }}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Calculate Payroll
                </button>
              )}
              
              {batch.status === 'calculated' && onSubmit && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSubmit(); setIsOpen(false); }}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Submit for Review
                </button>
              )}
              
              {['hr_review', 'finance_review', 'ceo_review'].includes(batch.status) && (
                <button
                  onClick={(e) => { e.stopPropagation(); onView(); setIsOpen(false); }}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Review & Approve
                </button>
              )}
              
              {batch.status === 'approved' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onView(); setIsOpen(false); }}
                  className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Process Payment
                </button>
              )}
              
              <hr className="my-1" />
              
              <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                className="flex items-center w-full px-4 py-2 text-sm text-gray-700 hover:bg-gray-100"
              >
                <Download className="h-4 w-4 mr-2" />
                Download Report
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ============================================================================
// Main Component
// ============================================================================

export const PayrollBatchList: React.FC<PayrollBatchListProps> = ({
  batches,
  isLoading,
  onCreateBatch,
  onRefresh,
  onCalculate,
  onSubmitForReview
}) => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [page, setPage] = useState(0);
  const rowsPerPage = 10;

  // Filter batches
  const filteredBatches = batches.filter(batch => {
    const matchesSearch = 
      batch.batchNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      batch.subsidiaryName.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesStatus = statusFilter === 'all' || batch.status === statusFilter;
    
    return matchesSearch && matchesStatus;
  });

  // Paginate
  const paginatedBatches = filteredBatches.slice(
    page * rowsPerPage,
    page * rowsPerPage + rowsPerPage
  );
  const totalPages = Math.ceil(filteredBatches.length / rowsPerPage);

  const handleViewBatch = (batch: PayrollBatch) => {
    navigate(`/hr/payroll/batches/${batch.id}`);
  };

  const formatPeriod = (year: number, month: number) => {
    const date = new Date(year, month - 1, 1);
    return date.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const formatDate = (date: Date) => {
    return new Date(date).toLocaleDateString('en-US', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Calculate summary stats
  const stats = {
    total: batches.length,
    pending: batches.filter(b => ['draft', 'calculated', 'hr_review', 'finance_review', 'ceo_review'].includes(b.status)).length,
    approved: batches.filter(b => b.status === 'approved').length,
    totalAmount: batches.filter(b => b.status === 'paid').reduce((sum, b) => sum + b.totalNetPay, 0)
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <div key={i} className="bg-gray-100 animate-pulse h-24 rounded-lg" />
          ))}
        </div>
        <div className="bg-gray-100 animate-pulse h-96 rounded-lg" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <KPIGrid cols={4}>
        <KPICard label="Total Batches" value={stats.total} />
        <KPICard label="Pending Review" value={stats.pending} />
        <KPICard label="Approved" value={stats.approved} trend="up" />
        <KPICard label="Total Paid (YTD)" value={formatCurrency(stats.totalAmount)} />
      </KPIGrid>

      {/* List Card */}
      <div className="bg-white rounded-lg border border-gray-200 shadow-sm">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-gray-900">Payroll Batches</h2>
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search batches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 w-[200px]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                  </button>
                )}
              </div>
              
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All Status</option>
                <option value="draft">Draft</option>
                <option value="calculated">Calculated</option>
                <option value="hr_review">HR Review</option>
                <option value="finance_review">Finance Review</option>
                <option value="approved">Approved</option>
                <option value="paid">Paid</option>
              </select>
              
              {/* Refresh */}
              <button
                onClick={onRefresh}
                className="p-2 border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4 text-gray-600" />
              </button>
              
              {/* Create New */}
              <button
                onClick={onCreateBatch}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors text-sm font-medium"
              >
                <Plus className="h-4 w-4" />
                New Batch
              </button>
            </div>
          </div>
        </div>
        
        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Batch Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Period</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Subsidiary</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Employees</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Total Net Pay</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Payment Date</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider w-[50px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {paginatedBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <p className="text-gray-500">
                      {searchQuery || statusFilter !== 'all' 
                        ? 'No batches match your filters.'
                        : 'No payroll batches found. Click "New Batch" to create one.'}
                    </p>
                  </td>
                </tr>
              ) : (
                paginatedBatches.map((batch) => (
                  <tr
                    key={batch.id}
                    className="hover:bg-gray-50 cursor-pointer transition-colors"
                    onClick={() => handleViewBatch(batch)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-blue-600 hover:text-blue-800">
                        {batch.batchNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatPeriod(batch.year, batch.month)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {batch.subsidiaryName}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-800">
                        {batch.employeeCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-gray-900">
                      {formatCurrency(batch.totalNetPay)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={batch.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {formatDate(batch.paymentDate)}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <ActionMenu
                        batch={batch}
                        onView={() => handleViewBatch(batch)}
                        onCalculate={onCalculate ? () => onCalculate(batch.id) : undefined}
                        onSubmit={onSubmitForReview ? () => onSubmitForReview(batch.id) : undefined}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Pagination */}
        {filteredBatches.length > rowsPerPage && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Showing {page * rowsPerPage + 1} to {Math.min((page + 1) * rowsPerPage, filteredBatches.length)} of {filteredBatches.length} batches
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Next
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PayrollBatchList;
