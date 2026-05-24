/**
 * /crm/:leadId — lead detail with profile, activity log, stage actions,
 * and a "Convert to Client" handoff for WON leads.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useAuth } from '@/core/hooks/useAuth';
import {
  getLead,
  listActivities,
  changeLeadStage,
  allowedNextStages,
  updateLead,
} from '../services/lead.service';
import type { Lead, LeadActivity, LeadStage } from '../types/lead.types';
import { LeadStageBadge } from '../components/LeadStageBadge';
import { ActivityLogPanel } from '../components/ActivityLogPanel';

function formatMoney(minor: number | undefined, currency: string): string {
  if (typeof minor !== 'number') return '—';
  return `${currency} ${(minor / 100).toLocaleString(undefined, { minimumFractionDigits: 0 })}`;
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  if (typeof value === 'string') return value.slice(0, 10);
  const ts = value as { seconds?: number; toDate?: () => Date };
  if (typeof ts.toDate === 'function') return ts.toDate().toISOString().slice(0, 10);
  if (typeof ts.seconds === 'number') return new Date(ts.seconds * 1000).toISOString().slice(0, 10);
  return '—';
}

export default function LeadDetailPage() {
  const { leadId } = useParams<{ leadId: string }>();
  const { user } = useAuth();
  const userId = user?.uid ?? 'unknown-user';

  const [lead, setLead] = useState<Lead | null>(null);
  const [activities, setActivities] = useState<LeadActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pendingStage, setPendingStage] = useState<LeadStage | null>(null);

  // Inline next-action editor state
  const [editingNextAction, setEditingNextAction] = useState(false);
  const [nextActionDraft, setNextActionDraft] = useState('');
  const [nextActionDateDraft, setNextActionDateDraft] = useState('');

  async function reload() {
    if (!leadId) return;
    setLoading(true);
    setError(null);
    try {
      const [l, acts] = await Promise.all([
        getLead(leadId),
        listActivities(leadId),
      ]);
      setLead(l);
      setActivities(acts);
      setNextActionDraft(l?.nextActionLabel ?? '');
      setNextActionDateDraft(l?.nextActionDate ?? '');
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, [leadId]);

  async function handleStageChange(next: LeadStage) {
    if (!leadId || !lead) return;
    let lostReason: string | undefined;
    if (next === 'LOST') {
      const reason = prompt('Reason for losing this deal? (required for audit log)');
      if (!reason || !reason.trim()) return;
      lostReason = reason;
    }
    setPendingStage(next);
    try {
      await changeLeadStage(leadId, next, userId, { lostReason });
      await reload();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setPendingStage(null);
    }
  }

  async function handleSaveNextAction() {
    if (!leadId) return;
    try {
      await updateLead(leadId, {
        nextActionLabel: nextActionDraft.trim() || undefined,
        nextActionDate: nextActionDateDraft || undefined,
      });
      setEditingNextAction(false);
      await reload();
    } catch (err) {
      setError(String((err as Error).message));
    }
  }

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading lead…</p>;
  if (error)   return <p className="p-6 text-sm text-destructive">Error: {error}</p>;
  if (!lead)   return <p className="p-6 text-sm text-muted-foreground">Lead not found.</p>;

  const nextStages = allowedNextStages(lead.stage);

  return (
    <div className="space-y-6 p-6">
      <header>
        <Link to="/crm" className="text-xs text-muted-foreground hover:underline">
          ← Back to pipeline
        </Link>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-xl font-semibold" data-testid="lead-name">{lead.name}</h1>
            <LeadStageBadge stage={lead.stage} />
          </div>
          <div className="flex flex-wrap gap-2" data-testid="stage-actions">
            {nextStages.length === 0 && (
              <span className="text-xs text-muted-foreground">Closed — no further transitions</span>
            )}
            {nextStages.map((s) => (
              <button
                key={s}
                onClick={() => handleStageChange(s)}
                disabled={pendingStage !== null}
                className={`rounded px-3 py-1 text-sm disabled:opacity-60 ${
                  s === 'WON'  ? 'bg-[var(--rag-green)] text-white' :
                  s === 'LOST' ? 'border border-[var(--rag-red)] text-[var(--rag-red)]' :
                  'border'
                }`}
                data-stage={s}
              >
                {pendingStage === s ? 'Updating…' : `Move to ${s}`}
              </button>
            ))}
            {lead.stage === 'WON' && !lead.convertedClientId && (
              <Link
                to={`/clients/new?fromLead=${lead.id}`}
                className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground"
                data-testid="convert-to-client"
              >
                Convert to Client →
              </Link>
            )}
            {lead.convertedClientId && (
              <Link
                to={`/clients/${lead.convertedClientId}`}
                className="rounded border px-3 py-1 text-sm"
              >
                View Client →
              </Link>
            )}
          </div>
        </div>
      </header>

      <section className="rounded border bg-card p-4">
        <h2 className="mb-3 text-sm font-medium">Profile</h2>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm md:grid-cols-3">
          <div>
            <dt className="text-xs text-muted-foreground">Contact</dt>
            <dd>
              {lead.contactName ?? '—'}
              {lead.contactEmail && (
                <a href={`mailto:${lead.contactEmail}`} className="block text-xs hover:underline">
                  {lead.contactEmail}
                </a>
              )}
              {lead.contactPhone && (
                <span className="block text-xs text-muted-foreground">{lead.contactPhone}</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Source</dt>
            <dd>{lead.source}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Estimated value</dt>
            <dd className="font-medium">{formatMoney(lead.estimatedValueMinor, lead.currency)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Probability</dt>
            <dd>{typeof lead.probability === 'number' ? `${(lead.probability * 100).toFixed(0)}%` : '—'}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Created</dt>
            <dd>{formatDate(lead.createdAt)}</dd>
          </div>
          <div>
            <dt className="text-xs text-muted-foreground">Last activity</dt>
            <dd>{formatDate(lead.lastActivityAt)}</dd>
          </div>
          {lead.closedAt && (
            <div>
              <dt className="text-xs text-muted-foreground">Closed</dt>
              <dd>{formatDate(lead.closedAt)}</dd>
            </div>
          )}
          {lead.lostReason && (
            <div className="col-span-2 md:col-span-3">
              <dt className="text-xs text-muted-foreground">Lost reason</dt>
              <dd className="text-[var(--rag-red)]">{lead.lostReason}</dd>
            </div>
          )}
        </dl>
      </section>

      {/* Next action editor */}
      <section className="rounded border bg-card p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium">Next action</h2>
          {!editingNextAction && (
            <button
              onClick={() => setEditingNextAction(true)}
              className="text-xs text-muted-foreground hover:underline"
              data-testid="edit-next-action"
            >
              Edit
            </button>
          )}
        </div>
        {!editingNextAction && (
          <p className="mt-2 text-sm">
            {lead.nextActionLabel ? (
              <>
                {lead.nextActionLabel}
                {lead.nextActionDate && (
                  <span className="ml-1 text-muted-foreground">· {formatDate(lead.nextActionDate)}</span>
                )}
              </>
            ) : (
              <span className="text-muted-foreground">No next action set.</span>
            )}
          </p>
        )}
        {editingNextAction && (
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <input
              value={nextActionDraft}
              onChange={(e) => setNextActionDraft(e.target.value)}
              placeholder="What's next?"
              className="flex-1 rounded border px-2 py-1 text-sm"
              data-testid="next-action-input"
            />
            <input
              type="date"
              value={nextActionDateDraft}
              onChange={(e) => setNextActionDateDraft(e.target.value)}
              className="rounded border px-2 py-1 text-sm"
            />
            <button
              onClick={handleSaveNextAction}
              className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground"
            >
              Save
            </button>
            <button
              onClick={() => { setEditingNextAction(false); setNextActionDraft(lead.nextActionLabel ?? ''); setNextActionDateDraft(lead.nextActionDate ?? ''); }}
              className="rounded border px-3 py-1 text-sm"
            >
              Cancel
            </button>
          </div>
        )}
      </section>

      {lead.notes && (
        <section className="rounded border bg-card p-4">
          <h2 className="mb-2 text-sm font-medium">Notes</h2>
          <p className="whitespace-pre-line text-sm">{lead.notes}</p>
        </section>
      )}

      <section>
        <h2 className="mb-3 text-sm font-medium">Activity</h2>
        <ActivityLogPanel
          leadId={lead.id}
          activities={activities}
          performedBy={userId}
          onLogged={reload}
        />
      </section>
    </div>
  );
}
