/**
 * Payroll Batch List Component
 * ZeusOS HR Central - Payroll Module
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
    gray: 'bg-[var(--bg-sunken)] text-foreground',
    blue: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
    indigo: 'bg-indigo-100 text-indigo-800',
    yellow: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
    orange: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
    cyan: 'bg-cyan-100 text-cyan-800',
    teal: 'bg-teal-100 text-teal-800',
    purple: 'bg-purple-100 text-purple-800',
    green: 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]',
    red: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
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
        className="p-1 rounded hover:bg-[var(--bg-sunken)] transition-colors"
      >
        <MoreVertical className="h-4 w-4 text-muted-foreground" />
      </button>
      
      {isOpen && (
        <>
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setIsOpen(false)}
          />
          <div className="absolute right-0 mt-1 w-48 bg-card rounded-md shadow-lg border border-[var(--border-subtle)] z-20">
            <div className="py-1">
              <button
                onClick={(e) => { e.stopPropagation(); onView(); setIsOpen(false); }}
                className="flex items-center w-full px-4 py-2 text-sm text-muted-foreground hover:bg-[var(--bg-sunken)]"
              >
                <Eye className="h-4 w-4 mr-2" />
                View Details
              </button>
              
              {batch.status === 'draft' && onCalculate && (
                <button
                  onClick={(e) => { e.stopPropagation(); onCalculate(); setIsOpen(false); }}
                  className="flex items-center w-full px-4 py-2 text-sm text-muted-foreground hover:bg-[var(--bg-sunken)]"
                >
                  <Play className="h-4 w-4 mr-2" />
                  Calculate Payroll
                </button>
              )}
              
              {batch.status === 'calculated' && onSubmit && (
                <button
                  onClick={(e) => { e.stopPropagation(); onSubmit(); setIsOpen(false); }}
                  className="flex items-center w-full px-4 py-2 text-sm text-muted-foreground hover:bg-[var(--bg-sunken)]"
                >
                  <Send className="h-4 w-4 mr-2" />
                  Submit for Review
                </button>
              )}
              
              {['hr_review', 'finance_review', 'ceo_review'].includes(batch.status) && (
                <button
                  onClick={(e) => { e.stopPropagation(); onView(); setIsOpen(false); }}
                  className="flex items-center w-full px-4 py-2 text-sm text-muted-foreground hover:bg-[var(--bg-sunken)]"
                >
                  <CheckCircle className="h-4 w-4 mr-2" />
                  Review & Approve
                </button>
              )}
              
              {batch.status === 'approved' && (
                <button
                  onClick={(e) => { e.stopPropagation(); onView(); setIsOpen(false); }}
                  className="flex items-center w-full px-4 py-2 text-sm text-muted-foreground hover:bg-[var(--bg-sunken)]"
                >
                  <CreditCard className="h-4 w-4 mr-2" />
                  Process Payment
                </button>
              )}
              
              <hr className="my-1" />
              
              <button
                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                className="flex items-center w-full px-4 py-2 text-sm text-muted-foreground hover:bg-[var(--bg-sunken)]"
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
            <div key={i} className="bg-[var(--bg-sunken)] animate-pulse h-24 rounded-lg" />
          ))}
        </div>
        <div className="bg-[var(--bg-sunken)] animate-pulse h-96 rounded-lg" />
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
      <div className="bg-card rounded-lg border border-[var(--border-subtle)] shadow-sm">
        {/* Header */}
        <div className="p-4 border-b border-[var(--border-subtle)]">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <h2 className="text-lg font-semibold text-foreground">Payroll Batches</h2>
            
            <div className="flex items-center gap-2 flex-wrap">
              {/* Search */}
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-[var(--fg-tertiary)]" />
                <input
                  type="text"
                  placeholder="Search batches..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 pr-4 py-2 border border-[var(--border-default)] rounded-md text-sm focus:ring-2 focus:ring-[var(--rag-blue)] focus:border-[var(--rag-blue)] w-[200px]"
                />
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-2 top-1/2 transform -translate-y-1/2"
                  >
                    <X className="h-4 w-4 text-[var(--fg-tertiary)] hover:text-muted-foreground" />
                  </button>
                )}
              </div>
              
              {/* Status Filter */}
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="px-3 py-2 border border-[var(--border-default)] rounded-md text-sm focus:ring-2 focus:ring-[var(--rag-blue)] focus:border-[var(--rag-blue)]"
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
                className="p-2 border border-[var(--border-default)] rounded-md hover:bg-[var(--bg-sunken)] transition-colors"
                title="Refresh"
              >
                <RefreshCw className="h-4 w-4 text-muted-foreground" />
              </button>
              
              {/* Create New */}
              <button
                onClick={onCreateBatch}
                className="flex items-center gap-2 px-4 py-2 bg-[var(--rag-blue)] text-white rounded-md hover:bg-[var(--rag-blue)] transition-colors text-sm font-medium"
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
            <thead className="bg-[var(--bg-sunken)] border-b border-[var(--border-subtle)]">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Batch Number</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Period</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Subsidiary</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider">Employees</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-muted-foreground uppercase tracking-wider">Total Net Pay</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Payment Date</th>
                <th className="px-4 py-3 text-center text-xs font-medium text-muted-foreground uppercase tracking-wider w-[50px]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[var(--border-subtle)]">
              {paginatedBatches.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-10 text-center">
                    <p className="text-muted-foreground">
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
                    className="hover:bg-[var(--bg-sunken)] cursor-pointer transition-colors"
                    onClick={() => handleViewBatch(batch)}
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-[var(--rag-blue)] hover:text-[var(--rag-blue)]">
                        {batch.batchNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {formatPeriod(batch.year, batch.month)}
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
                      {batch.subsidiaryName}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[var(--bg-sunken)] text-foreground">
                        {batch.employeeCount}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-foreground">
                      {formatCurrency(batch.totalNetPay)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={batch.status} />
                    </td>
                    <td className="px-4 py-3 text-sm text-foreground">
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
          <div className="flex items-center justify-between px-4 py-3 border-t border-[var(--border-subtle)]">
            <p className="text-sm text-muted-foreground">
              Showing {page * rowsPerPage + 1} to {Math.min((page + 1) * rowsPerPage, filteredBatches.length)} of {filteredBatches.length} batches
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-[var(--border-default)] rounded-md hover:bg-[var(--bg-sunken)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                <ChevronLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                onClick={() => setPage(p => p + 1)}
                disabled={page >= totalPages - 1}
                className="flex items-center gap-1 px-3 py-1.5 text-sm border border-[var(--border-default)] rounded-md hover:bg-[var(--bg-sunken)] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
