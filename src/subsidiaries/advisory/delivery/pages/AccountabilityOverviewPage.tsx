/**
 * AccountabilityOverviewPage - Country Director Dashboard
 *
 * High-level view of all requisitions and accountability status across projects.
 */

import { useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Download,
  Filter,
  Calendar,
  ChevronRight,
  Loader2,
  AlertCircle,
  Building2,
  RefreshCw,
} from 'lucide-react';
import {
  useAccountabilityOverview,
  useAccountabilityAging,
  AccountabilityOverviewFilters,
} from '../hooks/accountability-hooks';
import {
  AccountabilityMetrics,
  AccountabilityStatusCards,
} from '../components/accountability/AccountabilityMetrics';
import { AccountabilityAgingChart } from '../components/accountability/AccountabilityAgingChart';
import { RequisitionFlowCard } from '../components/accountability/RequisitionFlowCard';
import { ProjectAccountabilitySummaryTable } from '../components/accountability/ProjectAccountabilitySummary';
import { useAllPrograms } from '../hooks/program-hooks';
import { db } from '@/core/services/firebase';

type TabType = 'overview' | 'overdue' | 'due-soon' | 'by-project';

export function AccountabilityOverviewPage() {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<TabType>('overview');
  const [statusFilter, setStatusFilter] = useState('all');
  const [filters, setFilters] = useState<AccountabilityOverviewFilters>({});

  // Fetch programs for filter
  const { programs } = useAllPrograms(db, {});

  // Fetch accountability data
  const {
    summary,
    byProject,
    overdueRequisitions,
    dueSoonRequisitions,
    requisitions,
    manualRequisitions,
    loading,
    error,
    refresh,
  } = useAccountabilityOverview(db, filters);

  // Fetch aging data
  const { aging, totalPending } = useAccountabilityAging(db, filters.projectId);

  // Combine formal and manual requisitions for the overview filter
  const allRequisitions = useMemo(() => {
    const mappedManual = manualRequisitions.map(r => ({
      ...r,
      id: r.id,
      projectId: r.linkedProjectId || '',
      projectName: r.linkedProjectName || '',
      grossAmount: r.amount,
      isManualRequisition: true as const,
    }));

    const mappedFormal = requisitions.map(r => ({
      ...r,
      isManualRequisition: false as const,
    }));

    return [...mappedFormal, ...mappedManual];
  }, [requisitions, manualRequisitions]);

  // Filter requisitions by status
  const filteredRequisitions = useMemo(() => {
    if (statusFilter === 'all') return allRequisitions;
    return allRequisitions.filter(r => r.accountabilityStatus === statusFilter);
  }, [allRequisitions, statusFilter]);

  const handleProgramChange = (programId: string) => {
    setFilters(prev => ({
      ...prev,
      programId: programId === 'all' ? undefined : programId,
    }));
  };

  const handleSendReminder = async (requisitionId: string) => {
    try {
      const { doc, updateDoc, Timestamp } = await import('firebase/firestore');
      const { db } = await import('../../../../firebase/config');
      await updateDoc(doc(db, 'requisitions', requisitionId), {
        lastReminderSentAt: Timestamp.now(),
        reminderCount: (allRequisitions.find(r => r.id === requisitionId) as any)?.reminderCount
          ? ((allRequisitions.find(r => r.id === requisitionId) as any).reminderCount + 1)
          : 1,
      });
      alert('Reminder sent successfully');
    } catch (error) {
      console.error('Failed to send reminder:', error);
      alert('Failed to send reminder');
    }
  };

  const handleFlagIssue = async (requisitionId: string) => {
    const reason = prompt('Please describe the issue:');
    if (!reason) return;

    try {
      const { doc, updateDoc, Timestamp } = await import('firebase/firestore');
      const { db } = await import('../../../../firebase/config');
      await updateDoc(doc(db, 'requisitions', requisitionId), {
        flagged: true,
        flagReason: reason,
        flaggedAt: Timestamp.now(),
      });
      alert('Issue flagged successfully');
    } catch (error) {
      console.error('Failed to flag issue:', error);
      alert('Failed to flag issue');
    }
  };

  const handleProjectClick = (projectId: string) => {
    navigate(`/advisory/delivery/projects/${projectId}/requisitions`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading accountability data...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-500" />
          <span className="text-red-700">{error.message}</span>
          <button
            onClick={refresh}
            className="ml-auto px-3 py-1 text-sm border border-red-200 rounded-lg hover:bg-red-100"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Accountability Overview</h1>
          <p className="text-gray-600">
            Track requisition spending and accountability across all projects
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Program Filter */}
          <div className="flex items-center gap-2">
            <Filter className="w-4 h-4 text-gray-400" />
            <select
              value={filters.programId || 'all'}
              onChange={e => handleProgramChange(e.target.value)}
              className="px-3 py-2 border rounded-lg bg-white text-sm"
            >
              <option value="all">All Programs</option>
              {programs.map(p => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Refresh */}
          <button
            onClick={refresh}
            className="p-2 border rounded-lg hover:bg-gray-50"
            title="Refresh data"
          >
            <RefreshCw className="w-4 h-4" />
          </button>

          {/* Export */}
          <button className="inline-flex items-center gap-2 px-4 py-2 border rounded-lg hover:bg-gray-50">
            <Download className="w-4 h-4" />
            Export
          </button>
        </div>
      </div>

      {/* Summary Metrics */}
      <AccountabilityMetrics summary={summary} currency="UGX" />

      {/* Tabs */}
      <div className="border-b">
        <nav className="flex gap-6">
          {[
            { key: 'overview', label: 'Overview' },
            { key: 'overdue', label: 'Overdue', count: summary.overdueCount },
            { key: 'due-soon', label: 'Due Soon', count: dueSoonRequisitions.length },
            { key: 'by-project', label: 'By Project', count: byProject.length },
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key as TabType)}
              className={`pb-3 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-primary text-primary'
                  : 'border-transparent text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
              {tab.count !== undefined && tab.count > 0 && (
                <span
                  className={`ml-2 px-2 py-0.5 text-xs rounded-full ${
                    tab.key === 'overdue'
                      ? 'bg-red-100 text-red-700'
                      : 'bg-gray-100 text-gray-700'
                  }`}
                >
                  {tab.count}
                </span>
              )}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main content - 2 columns */}
          <div className="lg:col-span-2 space-y-6">
            {/* Status Filter Cards */}
            <AccountabilityStatusCards
              summary={summary}
              onFilterChange={setStatusFilter}
              activeFilter={statusFilter}
            />

            {/* Requisitions requiring attention */}
            <div className="bg-white rounded-lg border">
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">
                  Requisitions Requiring Attention
                </h2>
                <Link
                  to="/advisory/delivery/approvals"
                  className="text-sm text-primary hover:underline flex items-center gap-1"
                >
                  View all <ChevronRight className="w-4 h-4" />
                </Link>
              </div>
              <div className="p-4 space-y-4">
                {filteredRequisitions.length === 0 ? (
                  <div className="text-center py-8">
                    <Building2 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">No requisitions match your filters</p>
                  </div>
                ) : (
                  filteredRequisitions.slice(0, 5).map(req => (
                    <RequisitionFlowCard
                      key={req.id}
                      requisition={{
                        ...req,
                        accountabilities: [],
                        daysUntilDue: Math.ceil(
                          (new Date(String(req.accountabilityDueDate)).getTime() - Date.now()) /
                            (1000 * 60 * 60 * 24)
                        ),
                      } as any}
                      currency="UGX"
                      onSendReminder={handleSendReminder}
                      onFlagIssue={handleFlagIssue}
                    />
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Sidebar - Aging Chart */}
          <div className="space-y-6">
            <AccountabilityAgingChart
              aging={aging}
              totalPending={totalPending}
              currency="UGX"
            />

            {/* Quick Stats */}
            <div className="bg-white rounded-lg border p-4">
              <h3 className="font-semibold text-gray-900 mb-4">Quick Stats</h3>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Accountability Rate</span>
                  <span className="font-medium">{summary.accountabilityRate.toFixed(1)}%</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full ${
                      summary.accountabilityRate >= 90
                        ? 'bg-green-500'
                        : summary.accountabilityRate >= 70
                        ? 'bg-amber-500'
                        : 'bg-red-500'
                    }`}
                    style={{ width: `${summary.accountabilityRate}%` }}
                  />
                </div>

                <div className="pt-3 border-t space-y-2">
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Projects with Issues</span>
                    <span className="font-medium text-red-600">
                      {byProject.filter(p => p.status === 'critical').length}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-gray-600">Healthy Projects</span>
                    <span className="font-medium text-green-600">
                      {byProject.filter(p => p.status === 'healthy').length}
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'overdue' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Overdue Accountabilities ({overdueRequisitions.length})
            </h2>
          </div>

          {overdueRequisitions.length === 0 ? (
            <div className="bg-white rounded-lg border p-12 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Building2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Overdue Items</h3>
              <p className="text-gray-500">All accountabilities are on track!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {overdueRequisitions.map(req => (
                <RequisitionFlowCard
                  key={req.id}
                  requisition={{
                    ...req,
                    accountabilities: [],
                    daysUntilDue: Math.ceil(
                      (new Date(String(req.accountabilityDueDate)).getTime() - Date.now()) /
                        (1000 * 60 * 60 * 24)
                    ),
                  } as any}
                  currency="UGX"
                  onSendReminder={handleSendReminder}
                  onFlagIssue={handleFlagIssue}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'due-soon' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Due Within 7 Days ({dueSoonRequisitions.length})
            </h2>
          </div>

          {dueSoonRequisitions.length === 0 ? (
            <div className="bg-white rounded-lg border p-12 text-center">
              <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-8 h-8 text-gray-400" />
              </div>
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Upcoming Deadlines</h3>
              <p className="text-gray-500">No accountabilities due in the next 7 days.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {dueSoonRequisitions.map(req => (
                <RequisitionFlowCard
                  key={req.id}
                  requisition={{
                    ...req,
                    accountabilities: [],
                    daysUntilDue: Math.ceil(
                      (new Date(String(req.accountabilityDueDate)).getTime() - Date.now()) /
                        (1000 * 60 * 60 * 24)
                    ),
                  } as any}
                  currency="UGX"
                  onSendReminder={handleSendReminder}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === 'by-project' && (
        <ProjectAccountabilitySummaryTable
          projects={byProject}
          currency="UGX"
          onProjectClick={handleProjectClick}
        />
      )}
    </div>
  );
}

export default AccountabilityOverviewPage;
