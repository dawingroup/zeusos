/**
 * Site Visits Page - Site visit management and tracking
 */

import { useState, useMemo } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  MapPin,
  Calendar,
  Users,
  AlertTriangle,
  CheckCircle,
  Clock,
  Loader2,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  Eye,
  FileText,
} from 'lucide-react';
import { useSiteVisits, useCreateSiteVisit } from '../hooks/progress-hooks';
import { useProject } from '../hooks/project-hooks';
import {
  SiteVisit,
  SiteVisitStatus,
  SITE_VISIT_TYPE_LABELS,
  countOpenIssues,
  countCriticalIssues,
  countPendingActionItems,
} from '../types/site-visit';
import { db } from '@/core/services/firebase';
import { useAuth } from '@/shared/hooks';
import { KPIGrid, KPICard } from '@/shared/components/data-display';

const STATUS_CONFIG: Record<SiteVisitStatus, { label: string; color: string; icon: React.ElementType }> = {
  draft: { label: 'Draft', color: 'bg-gray-100 text-gray-700', icon: FileText },
  submitted: { label: 'Submitted', color: 'bg-amber-100 text-amber-700', icon: Eye },
  reviewed: { label: 'Reviewed', color: 'bg-green-100 text-green-700', icon: CheckCircle },
};

function formatDate(date: Date | undefined): string {
  if (!date) return '-';
  return new Date(date).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

interface SiteVisitCardProps {
  visit: SiteVisit;
  projectId: string;
}

function SiteVisitCard({ visit, projectId }: SiteVisitCardProps) {
  const statusConfig = STATUS_CONFIG[visit.status];
  const StatusIcon = statusConfig.icon;
  const openIssues = countOpenIssues(visit.issues);
  const criticalIssues = countCriticalIssues(visit.issues);
  const pendingActions = countPendingActionItems(visit.actionItems);

  return (
    <Link
      to={`/advisory/delivery/projects/${projectId}/visits/${visit.id}`}
      className="bg-white border rounded-lg p-4 hover:shadow-md transition-shadow block"
    >
      <div className="flex items-start justify-between mb-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="font-medium text-gray-900">
              {SITE_VISIT_TYPE_LABELS[visit.visitType]} Visit
            </span>
            <span className={`px-2 py-0.5 text-xs rounded-full ${statusConfig.color}`}>
              <StatusIcon className="w-3 h-3 inline mr-1" />
              {statusConfig.label}
            </span>
          </div>
          <div className="flex items-center gap-4 text-sm text-gray-600">
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {formatDate(visit.visitDate)}
            </span>
            <span className="flex items-center gap-1">
              <Users className="w-4 h-4" />
              {visit.visitors.length + 1} visitor(s)
            </span>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-gray-400" />
      </div>

      {/* Progress Observation */}
      {visit.progressObservation && (
        <div className="mb-3 p-3 bg-gray-50 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm text-gray-600">Progress Observed</span>
            <span className="text-lg font-bold text-primary">
              {visit.progressObservation.observedProgress}%
            </span>
          </div>
          <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-primary rounded-full"
              style={{ width: `${visit.progressObservation.observedProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* Issues & Actions Summary */}
      <div className="flex items-center gap-4 text-sm">
        {openIssues > 0 && (
          <span className={`flex items-center gap-1 ${criticalIssues > 0 ? 'text-red-600' : 'text-amber-600'}`}>
            <AlertTriangle className="w-4 h-4" />
            {openIssues} open issue{openIssues !== 1 ? 's' : ''}
            {criticalIssues > 0 && ` (${criticalIssues} critical)`}
          </span>
        )}
        {pendingActions > 0 && (
          <span className="flex items-center gap-1 text-blue-600">
            <Clock className="w-4 h-4" />
            {pendingActions} pending action{pendingActions !== 1 ? 's' : ''}
          </span>
        )}
        {openIssues === 0 && pendingActions === 0 && (
          <span className="flex items-center gap-1 text-green-600">
            <CheckCircle className="w-4 h-4" />
            All items resolved
          </span>
        )}
      </div>

      {/* Lead Inspector */}
      <div className="mt-3 pt-3 border-t flex items-center gap-2 text-sm text-gray-600">
        <MapPin className="w-4 h-4" />
        Lead: {visit.leadInspector.name}
      </div>
    </Link>
  );
}

export function SiteVisitsPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [statusFilter, setStatusFilter] = useState<SiteVisitStatus | 'all'>('all');

  const { project, loading: projectLoading } = useProject(db, projectId || null);
  const { visits, loading, error } = useSiteVisits(db, projectId || null);
  const { createVisit, loading: creating } = useCreateSiteVisit(db, user?.uid || '');

  // Filter visits
  const filteredVisits = useMemo(() => {
    if (statusFilter === 'all') return visits;
    return visits.filter(v => v.status === statusFilter);
  }, [visits, statusFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: visits.length,
    draft: visits.filter(v => v.status === 'draft').length,
    submitted: visits.filter(v => v.status === 'submitted').length,
    reviewed: visits.filter(v => v.status === 'reviewed').length,
    totalIssues: visits.reduce((sum, v) => sum + countOpenIssues(v.issues), 0),
    criticalIssues: visits.reduce((sum, v) => sum + countCriticalIssues(v.issues), 0),
  }), [visits]);

  const handleQuickCreate = async () => {
    if (!projectId || !user) return;

    try {
      const visitId = await createVisit({
        projectId,
        programId: project?.programId || '',
        visitType: 'routine',
        visitDate: new Date(),
        duration: 2,
        leadInspector: {
          userId: user.uid,
          name: user.displayName || 'Unknown',
          role: 'project_manager',
          organization: 'Zeus Group',
        },
        visitors: [],
        weatherConditions: {
          condition: 'sunny',
          affectsWork: false,
        },
        siteConditions: {
          overallCondition: 'good',
          safetyCompliance: 'compliant',
          housekeeping: 'good',
          materialsStorage: 'proper',
        },
        progressObservation: {
          reportedProgress: 0,
          observedProgress: 0,
          variance: 0,
          agreesWithReported: true,
          workPackageObservations: [],
        },
      });
      navigate(`/advisory/delivery/projects/${projectId}/visits/${visitId}`);
    } catch (err) {
      console.error('Failed to create site visit:', err);
    }
  };

  if (projectLoading || loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
        <span className="ml-2 text-gray-600">Loading site visits...</span>
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to={`/advisory/delivery/projects/${projectId}`}
            className="p-2 hover:bg-gray-100 rounded-lg"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Site Visits</h1>
            <p className="text-gray-600">{project?.name || 'Project'}</p>
          </div>
        </div>

        <button
          onClick={handleQuickCreate}
          disabled={creating}
          className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-2 disabled:opacity-50"
        >
          {creating ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <Plus className="w-4 h-4" />
          )}
          New Site Visit
        </button>
      </div>

      {/* Stats Cards */}
      <KPIGrid cols={4}>
        <KPICard label="Total Visits" value={stats.total} />
        <KPICard label="Pending Review" value={stats.submitted} />
        <KPICard
          label="Open Issues"
          value={stats.totalIssues}
          delta={stats.criticalIssues > 0 ? `${stats.criticalIssues} critical` : undefined}
          trend={stats.criticalIssues > 0 ? 'down' : undefined}
        />
        <KPICard label="Approved" value={stats.reviewed} />
      </KPIGrid>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600">Filter:</span>
        {(['all', 'draft', 'submitted', 'reviewed'] as const).map(status => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              statusFilter === status
                ? 'bg-primary text-white'
                : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {status === 'all' ? 'All' : STATUS_CONFIG[status].label}
          </button>
        ))}
      </div>

      {/* Visits List */}
      {filteredVisits.length === 0 ? (
        <div className="bg-white border rounded-lg p-12 text-center">
          <MapPin className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No Site Visits</h3>
          <p className="text-gray-600 mb-4">
            {visits.length === 0
              ? 'No site visits have been recorded for this project yet.'
              : 'No visits match the selected filter.'}
          </p>
          {visits.length === 0 && (
            <button
              onClick={handleQuickCreate}
              disabled={creating}
              className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90"
            >
              Record First Visit
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filteredVisits.map(visit => (
            <SiteVisitCard key={visit.id} visit={visit} projectId={projectId || ''} />
          ))}
        </div>
      )}
    </div>
  );
}
