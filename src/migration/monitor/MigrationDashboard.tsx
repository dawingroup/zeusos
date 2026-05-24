/**
 * Migration Dashboard
 * UI for monitoring and controlling migrations
 */

import React, { useState, useEffect } from 'react';
import {
  RotateCcw,
  CheckCircle,
  XCircle,
  AlertTriangle,
  Clock,
  Database,
  ArrowRight,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  MigrationJob,
  MigrationStatus,
  MigrationSummary,
} from '../types/migration-types';
import {
  subscribeToMigrationJobs,
  getMigrationSummary,
} from '../utils/progress-tracker';
import { rollbackManager } from '../utils/rollback-manager';

const STATUS_COLORS: Record<MigrationStatus, string> = {
  pending: 'bg-[var(--bg-sunken)] text-muted-foreground',
  in_progress: 'bg-blue-100 text-blue-700',
  validating: 'bg-yellow-100 text-yellow-700',
  completed: 'bg-green-100 text-green-700',
  failed: 'bg-red-100 text-red-700',
  rolled_back: 'bg-orange-100 text-orange-700',
};

const STATUS_ICONS: Record<MigrationStatus, React.ReactNode> = {
  pending: <Clock className="w-4 h-4" />,
  in_progress: <RefreshCw className="w-4 h-4 animate-spin" />,
  validating: <Database className="w-4 h-4" />,
  completed: <CheckCircle className="w-4 h-4" />,
  failed: <XCircle className="w-4 h-4" />,
  rolled_back: <RotateCcw className="w-4 h-4" />,
};

export const MigrationDashboard: React.FC = () => {
  const [jobs, setJobs] = useState<MigrationJob[]>([]);
  const [summary, setSummary] = useState<MigrationSummary | null>(null);
  const [isRollingBack, setIsRollingBack] = useState<string | null>(null);
  const [expandedErrors, setExpandedErrors] = useState<Set<string>>(new Set());

  useEffect(() => {
    const unsubscribe = subscribeToMigrationJobs(setJobs);
    getMigrationSummary().then(setSummary);
    return unsubscribe;
  }, []);

  const getProgress = (job: MigrationJob): number => {
    if (job.totalDocuments === 0) return 0;
    return Math.round((job.processedDocuments / job.totalDocuments) * 100);
  };

  const handleRollback = async (jobId: string) => {
    if (!confirm('Are you sure you want to rollback this migration?')) {
      return;
    }
    setIsRollingBack(jobId);
    try {
      const result = await rollbackManager.rollbackMigration(jobId);
      if (result.success) {
        alert(`Rollback complete: ${result.documentsRolledBack} documents removed`);
      } else {
        alert(`Rollback failed: ${result.errors.join(', ')}`);
      }
    } catch (error) {
      alert(`Rollback error: ${error instanceof Error ? error.message : 'Unknown'}`);
    } finally {
      setIsRollingBack(null);
    }
  };

  const toggleErrors = (jobId: string) => {
    setExpandedErrors(prev => {
      const next = new Set(prev);
      if (next.has(jobId)) {
        next.delete(jobId);
      } else {
        next.add(jobId);
      }
      return next;
    });
  };

  const formatDuration = (start?: Date, end?: Date): string => {
    if (!start) return '-';
    const endTime = end || new Date();
    const duration = endTime.getTime() - start.getTime();
    const seconds = Math.floor(duration / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  };

  return (
    <div className="min-h-screen bg-[var(--bg-sunken)] p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Migration Dashboard</h1>
            <p className="text-muted-foreground mt-1">Monitor v5 to v6 data migrations</p>
          </div>
          <button
            onClick={() => getMigrationSummary().then(setSummary)}
            className="inline-flex items-center gap-2 px-4 py-2 bg-card border rounded-lg hover:bg-[var(--bg-sunken)] text-sm font-medium"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
        </div>

        {/* Summary Cards */}
        {summary && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <SummaryCard label="Total Jobs" value={summary.totalJobs} />
            <SummaryCard label="In Progress" value={summary.inProgressJobs} color="blue" />
            <SummaryCard label="Completed" value={summary.completedJobs} color="green" />
            <SummaryCard label="Failed" value={summary.failedJobs} color="red" />
          </div>
        )}

        {/* Stats Row */}
        {summary && (
          <div className="grid grid-cols-2 gap-4">
            <div className="bg-card rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">Documents Migrated</p>
              <p className="text-xl font-semibold">{summary.totalDocumentsMigrated.toLocaleString()}</p>
            </div>
            <div className="bg-card rounded-xl border p-4">
              <p className="text-sm text-muted-foreground">Total Errors</p>
              <p className="text-xl font-semibold">{summary.totalErrors}</p>
            </div>
          </div>
        )}

        {/* Jobs List */}
        <div className="bg-card rounded-xl border overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="text-lg font-semibold">Migration Jobs</h2>
          </div>

          {jobs.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Database className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>No migration jobs found</p>
            </div>
          ) : (
            <div className="divide-y">
              {jobs.map((job) => (
                <div key={job.id} className="p-4 hover:bg-[var(--bg-sunken)]">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <span className="font-medium capitalize">{job.config.entityType}</span>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <code className="px-1.5 py-0.5 bg-[var(--bg-sunken)] rounded text-xs">
                          {job.config.sourceCollection}
                        </code>
                        <ArrowRight className="w-3 h-3" />
                        <code className="px-1.5 py-0.5 bg-[var(--bg-sunken)] rounded text-xs">
                          {job.config.targetCollection}
                        </code>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${STATUS_COLORS[job.status]}`}>
                        {STATUS_ICONS[job.status]}
                        {job.status.replace('_', ' ')}
                      </span>

                      {job.status === 'completed' && (
                        <button
                          onClick={() => handleRollback(job.id)}
                          disabled={isRollingBack === job.id}
                          className="p-2 text-[var(--fg-tertiary)] hover:text-orange-600 disabled:opacity-50"
                          title="Rollback"
                        >
                          <RotateCcw className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Progress Bar */}
                  <div className="mt-3">
                    <div className="flex justify-between text-xs text-muted-foreground mb-1">
                      <span>{job.successfulDocuments} successful</span>
                      <span>{job.processedDocuments} / {job.totalDocuments}</span>
                    </div>
                    <div className="h-2 bg-[var(--bg-sunken)] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          job.status === 'completed' ? 'bg-green-500' :
                          job.status === 'failed' ? 'bg-red-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${getProgress(job)}%` }}
                      />
                    </div>
                  </div>

                  {/* Metadata */}
                  <div className="mt-3 flex items-center gap-6 text-xs text-muted-foreground">
                    <span>Duration: {formatDuration(job.startedAt, job.completedAt)}</span>
                    <span>Failed: {job.failedDocuments}</span>
                    {job.errors.length > 0 && (
                      <button
                        onClick={() => toggleErrors(job.id)}
                        className="flex items-center gap-1 text-red-600 hover:text-red-700"
                      >
                        <AlertTriangle className="w-3 h-3" />
                        {job.errors.length} errors
                        {expandedErrors.has(job.id) ? (
                          <ChevronUp className="w-3 h-3" />
                        ) : (
                          <ChevronDown className="w-3 h-3" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Expanded Errors */}
                  {expandedErrors.has(job.id) && job.errors.length > 0 && (
                    <div className="mt-3 p-3 bg-red-50 rounded-lg">
                      <p className="text-xs font-medium text-red-700 mb-2">Errors:</p>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {job.errors.slice(0, 20).map((error, idx) => (
                          <div key={idx} className="text-xs text-red-600">
                            <span className="font-mono">{error.documentId}</span>
                            {error.field && <span className="text-red-400"> [{error.field}]</span>}
                            : {error.error}
                          </div>
                        ))}
                        {job.errors.length > 20 && (
                          <p className="text-xs text-red-400">
                            ... and {job.errors.length - 20} more errors
                          </p>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Summary Card Component
const SummaryCard: React.FC<{
  label: string;
  value: number;
  color?: 'blue' | 'green' | 'red';
}> = ({ label, value, color }) => {
  const colorClass = color === 'blue' ? 'text-blue-600' :
                     color === 'green' ? 'text-green-600' :
                     color === 'red' ? 'text-red-600' : 'text-foreground';
  return (
    <div className="bg-card rounded-xl border p-4">
      <p className="text-sm text-muted-foreground">{label}</p>
      <p className={`text-2xl font-bold ${colorClass}`}>{value}</p>
    </div>
  );
};

export default MigrationDashboard;
