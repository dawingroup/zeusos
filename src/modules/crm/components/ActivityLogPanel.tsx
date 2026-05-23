/**
 * ActivityLogPanel — vertical timeline of activities on a lead.
 *
 * Renders a simple log + a "Log activity" sub-form for adding new entries
 * (calls, emails, meetings, notes). STAGE_CHANGE activities are surfaced
 * with a distinct icon to show automatic transitions in context.
 */

import { useState } from 'react';
import type { LeadActivity, ActivityKind } from '../types/lead.types';
import { logActivity } from '../services/lead.service';

const KIND_LABEL: Record<ActivityKind, string> = {
  CALL:          'Call',
  EMAIL:         'Email',
  MEETING:       'Meeting',
  NOTE:          'Note',
  STAGE_CHANGE:  'Stage change',
  TASK:          'Task',
};

const KIND_BADGE: Record<ActivityKind, string> = {
  CALL:         'bg-blue-100 text-blue-800',
  EMAIL:        'bg-violet-100 text-violet-800',
  MEETING:      'bg-amber-100 text-amber-800',
  NOTE:         'bg-stone-100 text-stone-700',
  STAGE_CHANGE: 'bg-emerald-100 text-emerald-800',
  TASK:         'bg-pink-100 text-pink-800',
};

const LOGGABLE_KINDS: ActivityKind[] = ['CALL', 'EMAIL', 'MEETING', 'NOTE', 'TASK'];

function formatTimestamp(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') return value.slice(0, 16).replace('T', ' ');
  const ts = value as { seconds?: number; toDate?: () => Date };
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString().slice(0, 16).replace('T', ' ');
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toISOString().slice(0, 16).replace('T', ' ');
  return '';
}

interface Props {
  leadId: string;
  activities: LeadActivity[];
  performedBy: string;
  onLogged: () => void;
}

export function ActivityLogPanel({ leadId, activities, performedBy, onLogged }: Props) {
  const [kind, setKind] = useState<ActivityKind>('CALL');
  const [summary, setSummary] = useState('');
  const [detail, setDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!summary.trim()) {
      setError('Summary is required');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await logActivity(leadId, {
        kind,
        summary: summary.trim(),
        detail: detail.trim() || undefined,
        performedBy,
      });
      setSummary('');
      setDetail('');
      onLogged();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="space-y-4">
      {/* New-activity form */}
      <form onSubmit={handleSubmit} className="rounded border bg-card p-4 space-y-3" data-testid="log-activity-form">
        <div className="flex items-center gap-2">
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as ActivityKind)}
            className="rounded border px-2 py-1 text-sm"
            data-testid="activity-kind"
          >
            {LOGGABLE_KINDS.map((k) => (
              <option key={k} value={k}>{KIND_LABEL[k]}</option>
            ))}
          </select>
          <input
            value={summary}
            onChange={(e) => setSummary(e.target.value)}
            placeholder='Summary (e.g. "Discovery call with Jane, 30 min")'
            className="flex-1 rounded border px-2 py-1 text-sm"
            data-testid="activity-summary"
          />
        </div>
        <textarea
          value={detail}
          onChange={(e) => setDetail(e.target.value)}
          rows={2}
          placeholder="Details (optional)"
          className="w-full rounded border px-2 py-1 text-sm"
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={submitting}
            className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground disabled:opacity-60"
            data-testid="activity-submit"
          >
            {submitting ? 'Logging…' : 'Log activity'}
          </button>
        </div>
      </form>

      {/* Timeline */}
      {activities.length === 0 && (
        <p className="text-sm text-muted-foreground">No activity yet. Log the first one above.</p>
      )}
      <ol className="space-y-3" data-testid="activity-timeline">
        {activities.map((a) => (
          <li key={a.id} className="rounded border bg-card p-3" data-activity-id={a.id}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={`rounded px-2 py-0.5 text-xs font-medium ${KIND_BADGE[a.kind]}`}>
                  {KIND_LABEL[a.kind]}
                </span>
                <span className="text-sm font-medium">{a.summary}</span>
              </div>
              <span className="text-xs text-muted-foreground">{formatTimestamp(a.performedAt)}</span>
            </div>
            {a.detail && (
              <p className="mt-2 whitespace-pre-line text-sm text-muted-foreground">{a.detail}</p>
            )}
            <p className="mt-2 text-xs text-muted-foreground">by {a.performedBy}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
