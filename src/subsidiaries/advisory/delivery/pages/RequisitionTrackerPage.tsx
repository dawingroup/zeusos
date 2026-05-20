/**
 * RequisitionTrackerPage - Detailed document flow visualization for a project
 *
 * Shows all requisitions with their accountability status and timeline.
 */

import { useState, useMemo } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  Receipt,
  Clock,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Search,
  Filter,
  Download,
  Loader2,
  AlertCircle,
  Building2,
  Plus,
} from 'lucide-react';
import { useRequisitionWithAccountabilities } from '../hooks/accountability-hooks';
import { useProject } from '../hooks/project-hooks';
import { RequisitionFlowCard } from '../components/accountability/RequisitionFlowCard';
import { ReconciliationProgress } from '../components/accountability/FinancialReconciliation';
import { AccountabilityStatus } from '../types/requisition';
import { db } from '@/core/services/firebase';

type FilterStatus = 'all' | AccountabilityStatus;
type SortOption = 'date' | 'amount' | 'due-date' | 'status';

const STATUS_OPTIONS: { key: FilterStatus; label: string; icon: typeof Clock }[] = [
  { key: 'all', label: 'All', icon: Receipt },
  { key: 'pending', label: 'Pending', icon: Clock },
  { key: 'partial', label: 'Partial', icon: AlertTriangle },
  { key: 'overdue', label: 'Overdue', icon: XCircle },
  { key: 'complete', label: 'Complete', icon: CheckCircle },
];

function formatCurrency(amount: number, currency: string = 'UGX'): string {
  if (amount >= 1000000000) return `${currency} ${(amount / 1000000000).toFixed(2)}B`;
  if (amount >= 1000000) return `${currency} ${(amount / 1000000).toFixed(1)}M`;
  if (amount >= 1000) return `${currency} ${(amount / 1000).toFixed(0)}K`;
  return `${currency} ${amount.toLocaleString()}`;
}

export function RequisitionTrackerPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();

  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('date');

  // Fetch project data
  const { project, loading: projectLoading } = useProject(db, projectId || null);

  // Fetch requisitions with accountabilities
  const { requisitions, loading, error } = useRequisitionWithAccountabilities(db, projectId || null);

  // Filter and sort requisitions
  const filteredRequisitions = useMemo(() => {
    let result = [...requisitions];

    // Filter by status
    if (statusFilter !== 'all') {
      result = result.filter(r => r.accountabilityStatus === statusFilter);
    }

    // Filter by search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        r =>
          r.requisitionNumber.toLowerCase().includes(query) ||
          r.purpose.toLowerCase().includes(query)
      );
    }

    // Sort
    result.sort((a, b) => {
      switch (sortBy) {
        case 'amount':
          return b.grossAmount - a.grossAmount;
        case 'due-date':
          return (
            new Date(a.accountabilityDueDate).getTime() -
            new Date(b.accountabilityDueDate).getTime()
          );
        case 'status':
          const statusOrder = ['overdue', 'pending', 'partial', 'complete', 'not_required'];
          return (
            statusOrder.indexOf(a.accountabilityStatus) -
            statusOrder.indexOf(b.accountabilityStatus)
          );
        case 'date':
        default:
          return (
            (b.createdAt?.toDate()?.getTime() || 0) - (a.createdAt?.toDate()?.getTime() || 0)
          );
      }
    });

    return result;
  }, [requisitions, statusFilter, searchQuery, sortBy]);

  // Calculate summary stats
  const stats = useMemo(() => {
    const paidReqs = requisitions.filter(r => r.status === 'paid');
    const totalDisbursed = paidReqs.reduce((sum, r) => sum + r.grossAmount, 0);
    const totalAccounted = paidReqs.reduce(
      (sum, r) => sum + (r.grossAmount - (r.unaccountedAmount || 0)),
      0
    );
    const totalUnaccounted = paidReqs.reduce((sum, r) => sum + (r.unaccountedAmount || 0), 0);

    const byStatus = {
      pending: requisitions.filter(r => r.accountabilityStatus === 'pending').length,
      partial: requisitions.filter(r => r.accountabilityStatus === 'partial').length,
      complete: requisitions.filter(r => r.accountabilityStatus === 'complete').length,
      overdue: requisitions.filter(r => r.accountabilityStatus === 'overdue').length,
    };

    return {
      total: requisitions.length,
      paid: paidReqs.length,
      totalDisbursed,
      totalAccounted,
      totalUnaccounted,
      accountabilityRate: totalDisbursed > 0 ? (totalAccounted / totalDisbursed) * 100 : 0,
      byStatus,
    };
  }, [requisitions]);

  const handleSendReminder = (requisitionId: string) => {
    console.log('Send reminder for:', requisitionId);
  };

  const handleFlagIssue = (requisitionId: string) => {
    console.log('Flag issue for:', requisitionId);
  };

  if (loading || projectLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading requisitions...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error.message}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-gray-900">Requisition Tracker</h1>
          <p className="text-gray-600">
            {project?.name || 'Project'} - {stats.total} requisition{stats.total !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={() => navigate(`/advisory/delivery/projects/${projectId}/requisitions/new`)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
        >
          <Plus className="w-4 h-4" />
          New Requisition
        </button>
      </div>

      {/* Project Summary Bar */}
      <div className="bg-white rounded-lg border p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div>
            <div className="text-sm text-gray-500">Total Budget</div>
            <div className="text-lg font-bold">
              {formatCurrency(project?.budget?.totalBudget || 0)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Disbursed</div>
            <div className="text-lg font-bold text-blue-600">
              {formatCurrency(stats.totalDisbursed)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Accounted</div>
            <div className="text-lg font-bold text-green-600">
              {formatCurrency(stats.totalAccounted)}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-500">Unaccounted</div>
            <div
              className={`text-lg font-bold ${
                stats.totalUnaccounted > 0 ? 'text-amber-600' : 'text-green-600'
              }`}
            >
              {formatCurrency(stats.totalUnaccounted)}
            </div>
          </div>
        </div>

        <ReconciliationProgress
          requisitionAmount={stats.totalDisbursed}
          totalAccounted={stats.totalAccounted}
          currency="UGX"
        />
      </div>

      {/* Status Filter Tabs */}
      <div className="flex flex-wrap gap-2">
        {STATUS_OPTIONS.map(option => {
          const Icon = option.icon;
          const count =
            option.key === 'all'
              ? stats.total
              : stats.byStatus[option.key as keyof typeof stats.byStatus] || 0;
          const isActive = statusFilter === option.key;

          return (
            <button
              key={option.key}
              onClick={() => setStatusFilter(option.key)}
              className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border transition-colors ${
                isActive
                  ? 'bg-primary text-white border-primary'
                  : 'bg-white hover:bg-gray-50 border-gray-200'
              }`}
            >
              <Icon className="w-4 h-4" />
              <span>{option.label}</span>
              <span
                className={`px-2 py-0.5 text-xs rounded-full ${
                  isActive ? 'bg-white/20' : 'bg-gray-100'
                }`}
              >
                {count}
              </span>
            </button>
          );
        })}
      </div>

      {/* Search and Sort */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search by requisition number or purpose..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-9 pr-4 py-2 border rounded-lg bg-white"
          />
        </div>

        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-gray-400" />
          <select
            value={sortBy}
            onChange={e => setSortBy(e.target.value as SortOption)}
            className="px-3 py-2 border rounded-lg bg-white"
          >
            <option value="date">Sort by Date</option>
            <option value="amount">Sort by Amount</option>
            <option value="due-date">Sort by Due Date</option>
            <option value="status">Sort by Status</option>
          </select>
        </div>

        <button className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
          <Download className="w-4 h-4" />
          Export
        </button>
      </div>

      {/* Requisitions List */}
      {filteredRequisitions.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center">
          <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">
            {requisitions.length === 0 ? 'No Requisitions Yet' : 'No Results Found'}
          </h3>
          <p className="text-gray-500 mb-4">
            {requisitions.length === 0
              ? 'Create your first requisition to start tracking accountability.'
              : 'Try adjusting your search or filter criteria.'}
          </p>
          {requisitions.length === 0 && (
            <button
              onClick={() => navigate(`/advisory/delivery/projects/${projectId}/requisitions/new`)}
              className="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              <Plus className="w-4 h-4" />
              Create Requisition
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-4">
          {filteredRequisitions.map(req => (
            <RequisitionFlowCard
              key={req.id}
              requisition={req}
              currency="UGX"
              onSendReminder={handleSendReminder}
              onFlagIssue={handleFlagIssue}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export default RequisitionTrackerPage;
