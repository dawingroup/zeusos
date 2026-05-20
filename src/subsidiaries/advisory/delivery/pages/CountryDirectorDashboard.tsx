/**
 * CountryDirectorDashboard - Consolidated accountability dashboard for Country Directors
 *
 * Integrates manual requisitions with system requisitions for ADD-FIN-001 compliance monitoring.
 * Displays unified view across selected program with compliance alerts and investigations.
 */

import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LayoutDashboard,
  Shield,
  Search,
  FileText,
  ChevronDown,
  RefreshCw,
  Loader2,
  AlertCircle,
} from 'lucide-react';
import { db } from '@/core/services/firebase';
import {
  useCountryDirectorDashboard,
  useComplianceOverview,
  useUnifiedAccountabilityAging,
  useProgramSelector,
} from '../hooks/country-director-hooks';
import { CountryDirectorMetrics, VarianceSummaryCards } from '../components/country-director/CountryDirectorMetrics';
import { ComplianceScoreCard, ComplianceScoreCompact } from '../components/country-director/ComplianceScoreCard';
import { ComplianceAlertsBanner, AlertsSummary } from '../components/country-director/ComplianceAlertsBanner';
import { UnifiedRequisitionTable } from '../components/country-director/UnifiedRequisitionTable';
import { UnifiedAgingChart } from '../components/country-director/UnifiedAgingChart';
import { UnifiedRequisitionSummary, ComplianceAlert } from '../types/country-director-dashboard';

type TabId = 'overview' | 'compliance' | 'investigations' | 'requisitions';

export function CountryDirectorDashboard() {
  const navigate = useNavigate();

  // State
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const [varianceFilter, setVarianceFilter] = useState('all');
  const [showAlerts, setShowAlerts] = useState(true);

  // Program selector
  const {
    programs,
    selectedProgramId,
    setSelectedProgramId,
    loading: programsLoading,
  } = useProgramSelector(db);

  // Dashboard data
  const {
    summary,
    unifiedRequisitions,
    complianceAlerts,
    criticalAlertsCount,
    warningAlertsCount,
    loading: dashboardLoading,
    error: dashboardError,
    refresh: refreshDashboard,
  } = useCountryDirectorDashboard(db, selectedProgramId);

  // Compliance overview
  const {
    complianceScore,
    investigations,
    overdueInvestigations,
    activeInvestigations,
    loading: complianceLoading,
  } = useComplianceOverview(db, selectedProgramId);

  // Aging analysis
  const { aging, loading: agingLoading } = useUnifiedAccountabilityAging(db, selectedProgramId);

  // Loading state
  const isLoading = programsLoading || dashboardLoading || complianceLoading || agingLoading;

  // Filtered requisitions by variance
  const filteredRequisitions = useMemo(() => {
    if (varianceFilter === 'all') return unifiedRequisitions;
    return unifiedRequisitions.filter((r) => r.varianceStatus === varianceFilter);
  }, [unifiedRequisitions, varianceFilter]);

  // Handlers
  const handleRequisitionClick = (req: UnifiedRequisitionSummary) => {
    if (req.source === 'manual') {
      navigate(`/advisory/delivery/backlog/${req.id}`);
    } else {
      navigate(`/advisory/delivery/projects/${req.projectId}/accountabilities/${req.id}`);
    }
  };

  const handleAlertClick = (alert: ComplianceAlert) => {
    if (alert.entityType === 'manual_requisition') {
      navigate(`/advisory/delivery/backlog/${alert.entityId}`);
    } else {
      // Navigate to system requisition
      const req = unifiedRequisitions.find((r) => r.id === alert.entityId);
      if (req?.projectId) {
        navigate(`/advisory/delivery/projects/${req.projectId}/accountabilities/${alert.entityId}`);
      }
    }
  };

  const handleRefresh = () => {
    refreshDashboard();
  };

  const tabs: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'compliance', label: 'Compliance', icon: Shield },
    { id: 'investigations', label: 'Investigations', icon: Search },
    { id: 'requisitions', label: 'All Requisitions', icon: FileText },
  ];

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Country Director Dashboard</h1>
          <p className="text-gray-500 mt-1">
            Consolidated accountability monitoring with ADD-FIN-001 compliance tracking
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Program Selector */}
          <div className="relative">
            <select
              value={selectedProgramId || ''}
              onChange={(e) => setSelectedProgramId(e.target.value || null)}
              disabled={programsLoading}
              className="appearance-none pl-4 pr-10 py-2 border border-gray-300 rounded-lg bg-white text-sm font-medium focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent min-w-[200px]"
            >
              {programs.length === 0 && programsLoading ? (
                <option value="">Loading programs...</option>
              ) : programs.length === 0 ? (
                <option value="">No programs available</option>
              ) : (
                programs.map((program) => (
                  <option key={program.id} value={program.id}>
                    {program.name}
                  </option>
                ))
              )}
            </select>
            <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>

          {/* Alerts Summary */}
          <AlertsSummary
            criticalCount={criticalAlertsCount}
            warningCount={warningAlertsCount}
            onClick={() => setShowAlerts(!showAlerts)}
          />

          {/* Refresh */}
          <button
            onClick={handleRefresh}
            disabled={isLoading}
            className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            title="Refresh data"
          >
            <RefreshCw className={`w-5 h-5 text-gray-600 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Error State */}
      {dashboardError && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle className="w-5 h-5 text-red-600" />
          <div>
            <p className="font-medium text-red-800">Failed to load dashboard data</p>
            <p className="text-sm text-red-600">{dashboardError.message}</p>
          </div>
        </div>
      )}

      {/* No Program Selected */}
      {!selectedProgramId && !programsLoading && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <LayoutDashboard className="w-12 h-12 text-amber-500 mx-auto mb-3" />
          <h3 className="font-medium text-amber-800">Select a Program</h3>
          <p className="text-sm text-amber-600 mt-1">
            Please select a program from the dropdown above to view dashboard data.
          </p>
        </div>
      )}

      {/* Loading State */}
      {isLoading && selectedProgramId && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 text-primary animate-spin" />
        </div>
      )}

      {/* Dashboard Content */}
      {!isLoading && selectedProgramId && summary && (
        <>
          {/* Compliance Alerts Banner */}
          {showAlerts && complianceAlerts.length > 0 && (
            <ComplianceAlertsBanner
              alerts={complianceAlerts}
              onAlertClick={handleAlertClick}
              maxVisible={3}
            />
          )}

          {/* Metrics */}
          <CountryDirectorMetrics summary={summary} currency="UGX" />

          {/* Tabs */}
          <div className="border-b border-gray-200">
            <nav className="flex gap-6">
              {tabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;

                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center gap-2 py-3 border-b-2 transition-colors ${
                      isActive
                        ? 'border-primary text-primary'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span className="font-medium">{tab.label}</span>
                    {tab.id === 'investigations' && activeInvestigations.length > 0 && (
                      <span className="bg-amber-100 text-amber-700 text-xs px-2 py-0.5 rounded-full">
                        {activeInvestigations.length}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>
          </div>

          {/* Tab Content */}
          <div className="mt-6">
            {/* Overview Tab */}
            {activeTab === 'overview' && (
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Content */}
                <div className="lg:col-span-2 space-y-6">
                  {/* Variance Summary Cards */}
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      Variance Status
                    </h3>
                    <VarianceSummaryCards
                      summary={summary}
                      activeFilter={varianceFilter}
                      onFilterChange={setVarianceFilter}
                    />
                  </div>

                  {/* Aging Chart */}
                  {aging && (
                    <UnifiedAgingChart
                      aging={aging}
                      currency="UGX"
                    />
                  )}
                </div>

                {/* Sidebar */}
                <div className="space-y-6">
                  {/* Compliance Score */}
                  {complianceScore && (
                    <ComplianceScoreCompact
                      score={complianceScore}
                      onClick={() => setActiveTab('compliance')}
                    />
                  )}

                  {/* Quick Stats */}
                  <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
                    <h4 className="font-medium text-gray-900">Quick Stats</h4>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-gray-50 rounded p-2">
                        <div className="text-xs text-gray-500">Pending</div>
                        <div className="text-lg font-semibold">{summary.pendingCount}</div>
                      </div>
                      <div className="bg-gray-50 rounded p-2">
                        <div className="text-xs text-gray-500">Partial</div>
                        <div className="text-lg font-semibold">{summary.partialCount}</div>
                      </div>
                      <div className="bg-green-50 rounded p-2">
                        <div className="text-xs text-green-600">Complete</div>
                        <div className="text-lg font-semibold text-green-700">{summary.completeCount}</div>
                      </div>
                      <div className="bg-red-50 rounded p-2">
                        <div className="text-xs text-red-600">Overdue</div>
                        <div className="text-lg font-semibold text-red-700">{summary.overdueCount}</div>
                      </div>
                    </div>
                  </div>

                  {/* Overdue Investigations */}
                  {overdueInvestigations.length > 0 && (
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <h4 className="font-medium text-red-800 mb-2">Overdue Investigations</h4>
                      <p className="text-sm text-red-600">
                        {overdueInvestigations.length} investigation(s) past 48-hour deadline
                      </p>
                      <button
                        onClick={() => setActiveTab('investigations')}
                        className="mt-2 text-sm text-red-700 hover:text-red-800 font-medium"
                      >
                        View all &rarr;
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Compliance Tab */}
            {activeTab === 'compliance' && complianceScore && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <ComplianceScoreCard score={complianceScore} />

                <div className="space-y-6">
                  {/* Compliance Summary */}
                  <div className="bg-white rounded-lg border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-900 mb-4">
                      ADD-FIN-001 Summary
                    </h3>
                    <div className="space-y-4">
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Zero Discrepancy Submissions</span>
                        <span className="font-medium">{summary.varianceSummary.compliant}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Minor Variances (&lt;2%)</span>
                        <span className="font-medium text-blue-600">{summary.varianceSummary.minor}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Moderate Variances (2-5%)</span>
                        <span className="font-medium text-amber-600">{summary.varianceSummary.moderate}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Severe Variances (&gt;5%)</span>
                        <span className="font-medium text-red-600">{summary.varianceSummary.severe}</span>
                      </div>
                      <hr />
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Active Investigations</span>
                        <span className="font-medium">{summary.activeInvestigations}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Overdue Investigations</span>
                        <span className="font-medium text-red-600">{summary.overdueInvestigations}</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-gray-600">Pending Reconciliations</span>
                        <span className="font-medium">{summary.pendingReconciliations}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Investigations Tab */}
            {activeTab === 'investigations' && (
              <div className="space-y-6">
                {investigations.length === 0 ? (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                    <Shield className="w-12 h-12 text-green-500 mx-auto mb-3" />
                    <h3 className="font-medium text-green-800">No Active Investigations</h3>
                    <p className="text-sm text-green-600 mt-1">
                      All variance investigations are resolved. Great work!
                    </p>
                  </div>
                ) : (
                  <div className="bg-white rounded-lg border border-gray-200">
                    <div className="p-4 border-b border-gray-200">
                      <h3 className="font-semibold text-gray-900">
                        Variance Investigations ({investigations.length})
                      </h3>
                      <p className="text-sm text-gray-500 mt-1">
                        ADD-FIN-001 requires resolution within 48 hours
                      </p>
                    </div>
                    <div className="divide-y divide-gray-100">
                      {investigations.map((inv) => (
                        <div
                          key={inv.id}
                          className={`p-4 ${inv.isOverdue ? 'bg-red-50' : ''}`}
                        >
                          <div className="flex items-start justify-between">
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-gray-900">
                                  {inv.requisitionNumber}
                                </span>
                                {inv.isOverdue && (
                                  <span className="bg-red-100 text-red-700 text-xs px-2 py-0.5 rounded-full">
                                    Overdue
                                  </span>
                                )}
                              </div>
                              <p className="text-sm text-gray-600 mt-1">
                                {inv.projectName} | Variance: {inv.variancePercentage.toFixed(1)}%
                              </p>
                            </div>
                            <div className="text-right">
                              <div
                                className={`text-lg font-semibold ${
                                  inv.isOverdue ? 'text-red-600' : inv.hoursRemaining <= 12 ? 'text-amber-600' : 'text-gray-900'
                                }`}
                              >
                                {inv.isOverdue
                                  ? 'Past deadline'
                                  : `${inv.hoursRemaining.toFixed(0)}h remaining`}
                              </div>
                              <div className="text-sm text-gray-500">
                                Deadline: {inv.deadline.toLocaleDateString()}
                              </div>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* All Requisitions Tab */}
            {activeTab === 'requisitions' && (
              <UnifiedRequisitionTable
                requisitions={filteredRequisitions}
                onRowClick={handleRequisitionClick}
                currency="UGX"
              />
            )}
          </div>
        </>
      )}
    </div>
  );
}
