// ============================================================================
// RECONCILIATIONS PAGE
// ZeusOS v2.0 - Financial Management Module
// Account reconciliation dashboard with schedule list and summary
// ============================================================================

import { useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import {
  CheckCircle,
  Clock,
  AlertTriangle,
  Calendar,
  X,
} from 'lucide-react';
import { Card, CardContent } from '@/core/components/ui/card';
import { Skeleton } from '@/core/components/ui/skeleton';
import { KPIGrid, KPICard } from '@/shared/components/data-display';
import { ReconciliationScheduleList } from '../components/admin/ReconciliationScheduleList';
import { useReconciliationSchedule } from '../hooks/useReconciliationSchedule';
import { useCurrentUserId } from '@/contexts/AuthContext';
import type {
  ReconciliationScheduleInput,
  ReconciliationType,
  ReconciliationFrequency,
} from '../types/integrations.types';
import {
  RECONCILIATION_TYPES,
  RECONCILIATION_FREQUENCIES,
} from '../constants/integrations.constants';

const COMPANY_ID = 'dawinos';

function isThisMonth(timestamp: any): boolean {
  if (!timestamp) return false;
  const date = timestamp?.toDate?.() || new Date(timestamp);
  const now = new Date();
  return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear();
}

export function ReconciliationsPage() {
  const reconciliation = useReconciliationSchedule({ companyId: COMPANY_ID });
  const userId = useCurrentUserId();
  const [showForm, setShowForm] = useState(false);

  // Summary calculations
  const summary = useMemo(() => {
    const total = reconciliation.schedules.length;
    const reconciledThisMonth = reconciliation.schedules.filter(
      (s) => s.lastCompletedDate && isThisMonth(s.lastCompletedDate)
    ).length;
    const pending = reconciliation.schedules.filter((s) => {
      const dueDate = (s.nextDueDate as any)?.toDate?.() || new Date(s.nextDueDate as any);
      const weekFromNow = new Date();
      weekFromNow.setDate(weekFromNow.getDate() + 7);
      return dueDate <= weekFromNow && dueDate >= new Date() && s.isActive;
    }).length;
    const overdue = reconciliation.overdueCount;

    return { total, reconciledThisMonth, pending, overdue };
  }, [reconciliation.schedules, reconciliation.overdueCount]);

  if (reconciliation.error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Link to="/finance/operations" className="text-sm text-muted-foreground hover:text-muted-foreground">
            &larr; Operations
          </Link>
        </div>
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-center">
          <p className="text-red-700">{reconciliation.error}</p>
          <button
            onClick={reconciliation.refresh}
            className="mt-3 text-sm text-red-600 hover:underline"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <div className="flex items-center gap-3">
        <Link to="/finance/operations" className="text-sm text-muted-foreground hover:text-muted-foreground">
          &larr; Operations
        </Link>
      </div>

      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-foreground">Account Reconciliations</h2>
        <p className="text-sm text-muted-foreground mt-1">
          Track and manage reconciliation schedules across all accounts
        </p>
      </div>

      {/* Summary Cards */}
      <KPIGrid cols={4}>
        <KPICard
          label={
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="w-3 h-3 text-blue-500" /> Total Accounts
            </span>
          }
          value={reconciliation.loading ? <Skeleton className="h-7 w-16" /> : summary.total}
        />
        <KPICard
          label={
            <span className="inline-flex items-center gap-1.5">
              <CheckCircle className="w-3 h-3 text-green-500" /> Reconciled This Month
            </span>
          }
          value={reconciliation.loading ? <Skeleton className="h-7 w-16" /> : summary.reconciledThisMonth}
        />
        <KPICard
          label={
            <span className="inline-flex items-center gap-1.5">
              <Clock className="w-3 h-3 text-amber-500" /> Pending
            </span>
          }
          value={reconciliation.loading ? <Skeleton className="h-7 w-16" /> : summary.pending}
        />
        <KPICard
          label={
            <span className="inline-flex items-center gap-1.5">
              <AlertTriangle className="w-3 h-3 text-red-500" /> Overdue
            </span>
          }
          value={reconciliation.loading ? <Skeleton className="h-7 w-16" /> : summary.overdue}
          trend={!reconciliation.loading && summary.overdue > 0 ? 'down' : 'flat'}
        />
      </KPIGrid>

      {/* Reconciliation Schedule List */}
      <Card>
        <CardContent className="p-6">
          <ReconciliationScheduleList
            schedules={reconciliation.schedules}
            loading={reconciliation.loading}
            onComplete={(id) => reconciliation.complete(id, userId)}
            onToggle={reconciliation.toggle}
            onDelete={reconciliation.remove}
            onAdd={() => setShowForm(true)}
            overdueCount={reconciliation.overdueCount}
            dueThisWeekCount={reconciliation.dueThisWeekCount}
          />
        </CardContent>
      </Card>

      {/* New Schedule Form Modal */}
      {showForm && (
        <NewScheduleFormModal
          onClose={() => setShowForm(false)}
          defaultAssigneeId={userId}
          onSubmit={async (input) => {
            await reconciliation.create(input, userId);
            setShowForm(false);
          }}
        />
      )}
    </div>
  );
}

// ============================================================================
// NEW SCHEDULE FORM MODAL
// ============================================================================

function NewScheduleFormModal({
  onClose,
  onSubmit,
  defaultAssigneeId,
}: {
  onClose: () => void;
  onSubmit: (input: ReconciliationScheduleInput) => Promise<void>;
  defaultAssigneeId: string;
}) {
  const [name, setName] = useState('');
  const [type, setType] = useState<ReconciliationType>('bank_reconciliation');
  const [frequency, setFrequency] = useState<ReconciliationFrequency>('monthly');
  const [assigneeName, setAssigneeName] = useState('');
  const [nextDueDate, setNextDueDate] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !assigneeName || !nextDueDate) return;
    setSubmitting(true);
    try {
      await onSubmit({
        name,
        type,
        frequency,
        assigneeId: defaultAssigneeId,
        assigneeName,
        nextDueDate: new Date(nextDueDate),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-card rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-5 py-4 border-b">
          <h3 className="font-semibold text-foreground">New Reconciliation Schedule</h3>
          <button onClick={onClose} className="p-1 hover:bg-[var(--bg-sunken)] rounded-md">
            <X className="w-4 h-4" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Monthly Bank Reconciliation - Stanbic"
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Type</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as ReconciliationType)}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {Object.entries(RECONCILIATION_TYPES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Frequency</label>
              <select
                value={frequency}
                onChange={(e) => setFrequency(e.target.value as ReconciliationFrequency)}
                className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              >
                {Object.entries(RECONCILIATION_FREQUENCIES).map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Assignee</label>
            <input
              type="text"
              value={assigneeName}
              onChange={(e) => setAssigneeName(e.target.value)}
              placeholder="Who is responsible?"
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted-foreground mb-1">Next Due Date</label>
            <input
              type="date"
              value={nextDueDate}
              onChange={(e) => setNextDueDate(e.target.value)}
              className="w-full px-3 py-2 text-sm border rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
              required
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-muted-foreground hover:bg-[var(--bg-sunken)] rounded-lg"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="px-4 py-2 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50"
            >
              {submitting ? 'Creating...' : 'Create Schedule'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default ReconciliationsPage;
