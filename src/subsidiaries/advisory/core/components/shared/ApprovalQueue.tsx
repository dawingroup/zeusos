/**
 * APPROVAL QUEUE
 * 
 * Displays pending approvals with quick action buttons.
 */

import React, { useState, useMemo } from 'react';
import {
  Clock,
  CheckCircle,
  XCircle,
  RotateCcw,
  AlertTriangle,
  ChevronRight,
  Search,
} from 'lucide-react';
import { formatDate, formatRelativeTime } from '../../utils/formatters';

// ============================================================================
// Types
// ============================================================================

type ApprovalStatus = 'pending' | 'approved' | 'rejected' | 'returned' | 'escalated' | 'cancelled';
type ApprovalPriority = 'low' | 'normal' | 'high' | 'urgent';

interface ApprovalStep {
  stepNumber: number;
  status: 'pending' | 'approved' | 'rejected' | 'skipped';
}

interface ApprovalRequest {
  id: string;
  title: string;
  type: string;
  status: ApprovalStatus;
  priority: ApprovalPriority;
  amount?: number;
  currency?: string;
  requestedBy: string;
  requestedAt: { toDate: () => Date };
  dueDate?: { toDate: () => Date; toMillis: () => number };
  currentStep: number;
  steps: ApprovalStep[];
}

interface ApprovalQueueProps {
  approvals: ApprovalRequest[];
  loading?: boolean;
  onApprove: (requestId: string, comments?: string) => Promise<void>;
  onReject: (requestId: string, reason: string) => Promise<void>;
  onReturn: (requestId: string, reason: string) => Promise<void>;
  onDelegate?: (requestId: string, delegateTo: string) => Promise<void>;
  onViewDetails: (request: ApprovalRequest) => void;
  showFilters?: boolean;
  emptyMessage?: string;
  className?: string;
}

interface ApprovalItemProps {
  request: ApprovalRequest;
  onApprove: (requestId: string, comments?: string) => Promise<void>;
  onReject: (requestId: string, reason: string) => Promise<void>;
  onReturn: (requestId: string, reason: string) => Promise<void>;
  onViewDetails: (request: ApprovalRequest) => void;
}

interface StatusConfig {
  icon: React.ElementType;
  color: string;
  bgColor: string;
  label: string;
}

// ============================================================================
// Configuration
// ============================================================================

const STATUS_CONFIG: Record<ApprovalStatus, StatusConfig> = {
  pending: { 
    icon: Clock, 
    color: 'text-yellow-600', 
    bgColor: 'bg-yellow-100', 
    label: 'Pending' 
  },
  approved: { 
    icon: CheckCircle, 
    color: 'text-green-600', 
    bgColor: 'bg-green-100', 
    label: 'Approved' 
  },
  rejected: { 
    icon: XCircle, 
    color: 'text-red-600', 
    bgColor: 'bg-red-100', 
    label: 'Rejected' 
  },
  returned: { 
    icon: RotateCcw, 
    color: 'text-orange-600', 
    bgColor: 'bg-orange-100', 
    label: 'Returned' 
  },
  escalated: { 
    icon: AlertTriangle, 
    color: 'text-amber-600', 
    bgColor: 'bg-amber-100', 
    label: 'Escalated' 
  },
  cancelled: { 
    icon: XCircle, 
    color: 'text-gray-500', 
    bgColor: 'bg-gray-100', 
    label: 'Cancelled' 
  },
};

const PRIORITY_COLORS: Record<ApprovalPriority, string> = {
  low: 'border-l-gray-300',
  normal: 'border-l-blue-400',
  high: 'border-l-orange-400',
  urgent: 'border-l-red-500',
};

// ============================================================================
// Sub-components
// ============================================================================

const ApprovalItem: React.FC<ApprovalItemProps> = ({
  request,
  onApprove,
  onReject,
  onReturn,
  onViewDetails,
}) => {
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  
  const statusConfig = STATUS_CONFIG[request.status];
  const StatusIcon = statusConfig.icon;
  
  // Calculate urgency
  const isOverdue = request.dueDate && request.dueDate.toDate() < new Date();
  const isDueSoon = request.dueDate && !isOverdue && 
    (request.dueDate.toDate().getTime() - Date.now()) < 24 * 60 * 60 * 1000;
  
  const handleAction = async (action: 'approve' | 'reject' | 'return') => {
    setActionLoading(action);
    try {
      if (action === 'approve') {
        await onApprove(request.id);
      } else if (action === 'reject') {
        if (!rejectReason.trim()) return;
        await onReject(request.id, rejectReason);
        setShowRejectModal(false);
        setRejectReason('');
      } else if (action === 'return') {
        if (!rejectReason.trim()) return;
        await onReturn(request.id, rejectReason);
        setShowRejectModal(false);
        setRejectReason('');
      }
    } finally {
      setActionLoading(null);
    }
  };
  
  return (
    <div
      className={`
        bg-white border border-gray-200 rounded-lg overflow-hidden
        border-l-4 ${PRIORITY_COLORS[request.priority]}
        hover:shadow-md transition-shadow
      `}
    >
      {/* Header */}
      <div 
        className="p-4 cursor-pointer"
        onClick={() => onViewDetails(request)}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className={`
                inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium
                ${statusConfig.bgColor} ${statusConfig.color}
              `}>
                <StatusIcon className="w-3 h-3" />
                {statusConfig.label}
              </span>
              {isOverdue && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-700">
                  <AlertTriangle className="w-3 h-3" />
                  Overdue
                </span>
              )}
              {isDueSoon && !isOverdue && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-xs font-medium bg-amber-100 text-amber-700">
                  <Clock className="w-3 h-3" />
                  Due soon
                </span>
              )}
            </div>
            <h4 className="font-medium text-gray-900 truncate">
              {request.title}
            </h4>
            <p className="text-sm text-gray-500 mt-0.5">
              {request.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}
              {request.amount && (
                <span className="ml-2 font-medium">
                  • {new Intl.NumberFormat('en-US', {
                    style: 'currency',
                    currency: request.currency || 'USD',
                  }).format(request.amount)}
                </span>
              )}
            </p>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-400 flex-shrink-0" />
        </div>
        
        {/* Progress indicator */}
        <div className="mt-3 flex items-center gap-2">
          <div className="flex-1 flex items-center gap-1">
            {request.steps.map((step) => (
              <div
                key={step.stepNumber}
                className={`
                  h-1.5 flex-1 rounded-full
                  ${step.status === 'approved' 
                    ? 'bg-green-500' 
                    : step.status === 'pending' 
                      ? 'bg-blue-500' 
                      : step.status === 'rejected'
                        ? 'bg-red-500'
                        : 'bg-gray-200'
                  }
                `}
              />
            ))}
          </div>
          <span className="text-xs text-gray-500">
            Step {request.currentStep}/{request.steps.length}
          </span>
        </div>
        
        {/* Metadata */}
        <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
          <span>
            Requested by {request.requestedBy} • {formatRelativeTime(request.requestedAt.toDate())}
          </span>
          {request.dueDate && (
            <span>
              Due {formatDate(request.dueDate.toDate())}
            </span>
          )}
        </div>
      </div>
      
      {/* Actions */}
      {request.status === 'pending' && (
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center gap-2">
          <button
            onClick={(e) => {
              e.stopPropagation();
              handleAction('approve');
            }}
            disabled={actionLoading !== null}
            className={`
              flex-1 px-3 py-2 rounded-lg text-sm font-medium
              bg-green-600 text-white hover:bg-green-700
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-1
            `}
          >
            <CheckCircle className="w-4 h-4" />
            {actionLoading === 'approve' ? 'Approving...' : 'Approve'}
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowRejectModal(true);
            }}
            disabled={actionLoading !== null}
            className={`
              px-3 py-2 rounded-lg text-sm font-medium
              border border-gray-300 text-gray-700 hover:bg-gray-100
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-1
            `}
          >
            <XCircle className="w-4 h-4" />
            Reject
          </button>
          <button
            onClick={(e) => {
              e.stopPropagation();
              setShowRejectModal(true);
            }}
            disabled={actionLoading !== null}
            className={`
              px-3 py-2 rounded-lg text-sm font-medium
              border border-gray-300 text-gray-700 hover:bg-gray-100
              disabled:opacity-50 disabled:cursor-not-allowed
              flex items-center justify-center gap-1
            `}
          >
            <RotateCcw className="w-4 h-4" />
            Return
          </button>
        </div>
      )}
      
      {/* Reject/Return Modal */}
      {showRejectModal && (
        <div 
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setShowRejectModal(false)}
        >
          <div 
            className="bg-white rounded-xl p-6 w-full max-w-md"
            onClick={e => e.stopPropagation()}
          >
            <h3 className="text-lg font-semibold mb-4">Provide Reason</h3>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter reason for rejection or return..."
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:border-blue-500"
            />
            <div className="mt-4 flex gap-2">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={() => handleAction('reject')}
                disabled={!rejectReason.trim() || actionLoading !== null}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                Reject
              </button>
              <button
                onClick={() => handleAction('return')}
                disabled={!rejectReason.trim() || actionLoading !== null}
                className="flex-1 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 disabled:opacity-50"
              >
                Return
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Main Component
// ============================================================================

export const ApprovalQueue: React.FC<ApprovalQueueProps> = ({
  approvals,
  loading = false,
  onApprove,
  onReject,
  onReturn,
  onViewDetails,
  showFilters = true,
  emptyMessage = 'No pending approvals',
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<ApprovalStatus | 'all'>('pending');
  const [filterPriority, setFilterPriority] = useState<string>('all');
  
  // Filter approvals
  const filteredApprovals = useMemo(() => {
    return approvals.filter(request => {
      if (filterStatus !== 'all' && request.status !== filterStatus) {
        return false;
      }
      if (filterPriority !== 'all' && request.priority !== filterPriority) {
        return false;
      }
      if (searchTerm) {
        const term = searchTerm.toLowerCase();
        return (
          request.title.toLowerCase().includes(term) ||
          request.type.toLowerCase().includes(term) ||
          request.requestedBy.toLowerCase().includes(term)
        );
      }
      return true;
    });
  }, [approvals, filterStatus, filterPriority, searchTerm]);
  
  // Group by priority for pending
  const groupedApprovals = useMemo(() => {
    if (filterStatus !== 'pending') return { all: filteredApprovals };
    
    return {
      urgent: filteredApprovals.filter(a => a.priority === 'urgent'),
      high: filteredApprovals.filter(a => a.priority === 'high'),
      normal: filteredApprovals.filter(a => a.priority === 'normal'),
      low: filteredApprovals.filter(a => a.priority === 'low'),
    };
  }, [filteredApprovals, filterStatus]);
  
  return (
    <div className={className}>
      {/* Filters */}
      {showFilters && (
        <div className="mb-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search approvals..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            />
          </div>
          
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value as ApprovalStatus | 'all')}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
            <option value="returned">Returned</option>
          </select>
          
          <select
            value={filterPriority}
            onChange={(e) => setFilterPriority(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:border-blue-500"
          >
            <option value="all">All Priority</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="normal">Normal</option>
            <option value="low">Low</option>
          </select>
        </div>
      )}
      
      {/* Loading state */}
      {loading && (
        <div className="py-8 text-center text-gray-500">
          Loading approvals...
        </div>
      )}
      
      {/* Empty state */}
      {!loading && filteredApprovals.length === 0 && (
        <div className="py-8 text-center">
          <Clock className="w-12 h-12 mx-auto text-gray-300 mb-3" />
          <p className="text-gray-500">{emptyMessage}</p>
        </div>
      )}
      
      {/* Approval list */}
      {!loading && filteredApprovals.length > 0 && (
        <div className="space-y-6">
          {filterStatus === 'pending' ? (
            <>
              {groupedApprovals.urgent && groupedApprovals.urgent.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-red-600 mb-2 flex items-center gap-1">
                    <AlertTriangle className="w-4 h-4" />
                    Urgent ({groupedApprovals.urgent.length})
                  </h3>
                  <div className="space-y-3">
                    {groupedApprovals.urgent.map((request) => (
                      <ApprovalItem
                        key={request.id}
                        request={request}
                        onApprove={onApprove}
                        onReject={onReject}
                        onReturn={onReturn}
                        onViewDetails={onViewDetails}
                      />
                    ))}
                  </div>
                </div>
              )}
              {groupedApprovals.high && groupedApprovals.high.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-orange-600 mb-2">
                    High Priority ({groupedApprovals.high.length})
                  </h3>
                  <div className="space-y-3">
                    {groupedApprovals.high.map((request) => (
                      <ApprovalItem
                        key={request.id}
                        request={request}
                        onApprove={onApprove}
                        onReject={onReject}
                        onReturn={onReturn}
                        onViewDetails={onViewDetails}
                      />
                    ))}
                  </div>
                </div>
              )}
              {groupedApprovals.normal && groupedApprovals.normal.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-600 mb-2">
                    Normal ({groupedApprovals.normal.length})
                  </h3>
                  <div className="space-y-3">
                    {groupedApprovals.normal.map((request) => (
                      <ApprovalItem
                        key={request.id}
                        request={request}
                        onApprove={onApprove}
                        onReject={onReject}
                        onReturn={onReturn}
                        onViewDetails={onViewDetails}
                      />
                    ))}
                  </div>
                </div>
              )}
              {groupedApprovals.low && groupedApprovals.low.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-gray-400 mb-2">
                    Low Priority ({groupedApprovals.low.length})
                  </h3>
                  <div className="space-y-3">
                    {groupedApprovals.low.map((request) => (
                      <ApprovalItem
                        key={request.id}
                        request={request}
                        onApprove={onApprove}
                        onReject={onReject}
                        onReturn={onReturn}
                        onViewDetails={onViewDetails}
                      />
                    ))}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              {filteredApprovals.map((request) => (
                <ApprovalItem
                  key={request.id}
                  request={request}
                  onApprove={onApprove}
                  onReject={onReject}
                  onReturn={onReturn}
                  onViewDetails={onViewDetails}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ApprovalQueue;
