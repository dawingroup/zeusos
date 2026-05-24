// ============================================================================
// RECONCILIATION SCHEDULE LIST
// ZeusOS v2.0 - Financial Management Module
// Table view of reconciliation schedules with status badges and actions
// ============================================================================

import { useState } from 'react';
import {
  CheckCircle2,
  Clock,
  AlertTriangle,
  Plus,
  MoreVertical,
  Pause,
  Play,
  Trash2,
  Calendar,
  User,
} from 'lucide-react';
import type { ReconciliationSchedule } from '../../types/integrations.types';
import {
  RECONCILIATION_TYPES,
  RECONCILIATION_FREQUENCIES,
} from '../../constants/integrations.constants';

interface ReconciliationScheduleListProps {
  schedules: ReconciliationSchedule[];
  loading: boolean;
  onComplete: (scheduleId: string) => void;
  onToggle: (scheduleId: string, isActive: boolean) => void;
  onDelete: (scheduleId: string) => void;
  onAdd: () => void;
  overdueCount: number;
  dueThisWeekCount: number;
}

function getScheduleStatus(schedule: ReconciliationSchedule): {
  label: string;
  color: string;
  icon: typeof Clock;
} {
  const dueDate = (schedule.nextDueDate as any)?.toDate?.()
    || new Date(schedule.nextDueDate as any);
  const now = new Date();
  const weekFromNow = new Date();
  weekFromNow.setDate(weekFromNow.getDate() + 7);

  if (dueDate < now) {
    return { label: 'Overdue', color: 'red', icon: AlertTriangle };
  }
  if (dueDate <= weekFromNow) {
    return { label: 'Due Soon', color: 'amber', icon: Clock };
  }
  return { label: 'Upcoming', color: 'slate', icon: Calendar };
}

function formatDate(timestamp: any): string {
  if (!timestamp) return '—';
  const date = timestamp?.toDate?.() || new Date(timestamp);
  return date.toLocaleDateString('en-UG', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export function ReconciliationScheduleList({
  schedules,
  loading,
  onComplete,
  onToggle,
  onDelete,
  onAdd,
  overdueCount,
  dueThisWeekCount,
}: ReconciliationScheduleListProps) {
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="animate-pulse h-16 bg-[var(--bg-sunken)] rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-card rounded-lg border p-3 text-center">
          <p className="text-2xl font-bold text-foreground">{schedules.length}</p>
          <p className="text-xs text-muted-foreground">Total Schedules</p>
        </div>
        <div className={`rounded-lg border p-3 text-center ${overdueCount > 0 ? 'bg-[var(--rag-red-soft)] border-[var(--rag-red)]' : 'bg-card'}`}>
          <p className={`text-2xl font-bold ${overdueCount > 0 ? 'text-[var(--rag-red)]' : 'text-foreground'}`}>
            {overdueCount}
          </p>
          <p className="text-xs text-muted-foreground">Overdue</p>
        </div>
        <div className={`rounded-lg border p-3 text-center ${dueThisWeekCount > 0 ? 'bg-[var(--rag-amber-soft)] border-[var(--rag-amber)]' : 'bg-card'}`}>
          <p className={`text-2xl font-bold ${dueThisWeekCount > 0 ? 'text-[var(--rag-amber)]' : 'text-foreground'}`}>
            {dueThisWeekCount}
          </p>
          <p className="text-xs text-muted-foreground">Due This Week</p>
        </div>
      </div>

      {/* Add Button */}
      <button
        onClick={onAdd}
        className="w-full flex items-center justify-center gap-2 py-2.5 px-4 border-2 border-dashed border-[var(--border-default)] rounded-lg text-sm text-muted-foreground hover:border-[var(--rag-green)] hover:text-[var(--rag-green)] transition-colors"
      >
        <Plus className="w-4 h-4" />
        Add Reconciliation Schedule
      </button>

      {/* Schedule List */}
      {schedules.length === 0 ? (
        <div className="text-center py-8 text-[var(--fg-tertiary)]">
          <Calendar className="w-10 h-10 mx-auto mb-2 opacity-50" />
          <p className="text-sm">No reconciliation schedules yet</p>
        </div>
      ) : (
        <div className="space-y-2">
          {schedules.map((schedule) => {
            const status = getScheduleStatus(schedule);
            const StatusIcon = status.icon;

            return (
              <div
                key={schedule.id}
                className={`bg-card rounded-lg border p-4 hover:shadow-sm transition-shadow ${
                  !schedule.isActive ? 'opacity-60' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-medium text-foreground truncate">
                        {schedule.name}
                      </h4>
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-${status.color}-100 text-${status.color}-700`}
                      >
                        <StatusIcon className="w-3 h-3" />
                        {status.label}
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        Due: {formatDate(schedule.nextDueDate)}
                      </span>
                      <span>
                        {RECONCILIATION_TYPES[schedule.type] || schedule.type}
                      </span>
                      <span>
                        {RECONCILIATION_FREQUENCIES[schedule.frequency] || schedule.frequency}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <User className="w-3 h-3" />
                        {schedule.assigneeName}
                      </span>
                    </div>
                    {schedule.lastCompletedDate && (
                      <p className="text-xs text-[var(--rag-green)] mt-1">
                        Last completed: {formatDate(schedule.lastCompletedDate)}
                      </p>
                    )}
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => onComplete(schedule.id)}
                      className="p-1.5 rounded-md hover:bg-[var(--rag-green-soft)] text-[var(--rag-green)]"
                      title="Mark as Completed"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                    </button>

                    <div className="relative">
                      <button
                        onClick={() => setOpenMenuId(openMenuId === schedule.id ? null : schedule.id)}
                        className="p-1.5 rounded-md hover:bg-[var(--bg-sunken)] text-[var(--fg-tertiary)]"
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>

                      {openMenuId === schedule.id && (
                        <div className="absolute right-0 top-8 z-10 bg-card rounded-lg shadow-lg border py-1 w-40">
                          <button
                            onClick={() => {
                              onToggle(schedule.id, !schedule.isActive);
                              setOpenMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-[var(--bg-sunken)]"
                          >
                            {schedule.isActive ? (
                              <>
                                <Pause className="w-3.5 h-3.5" /> Pause
                              </>
                            ) : (
                              <>
                                <Play className="w-3.5 h-3.5" /> Resume
                              </>
                            )}
                          </button>
                          <button
                            onClick={() => {
                              onDelete(schedule.id);
                              setOpenMenuId(null);
                            }}
                            className="w-full flex items-center gap-2 px-3 py-1.5 text-sm text-[var(--rag-red)] hover:bg-[var(--rag-red-soft)]"
                          >
                            <Trash2 className="w-3.5 h-3.5" /> Delete
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default ReconciliationScheduleList;
