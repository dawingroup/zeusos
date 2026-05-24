/**
 * /media/:planId — buy grid with planned/booked/actual columns and add-buy slide-over.
 */

import { useEffect, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import {
  getMediaPlan,
  listMediaBuys,
  addMediaBuy,
  updateMediaBuy,
  updateMediaPlan,
  deleteMediaPlan,
} from '../services/media-plan.service';
import type { MediaPlan, MediaPlanStatus, CurrencyCode } from '../types/media-plan.types';
import type { MediaBuy } from '../types/media-buy.types';
import { MediaPlanStatusBadge } from '../components/MediaPlanStatusBadge';
import { MediaBuyGrid } from '../components/MediaBuyGrid';
import { MediaBuyForm } from '../components/MediaBuyForm';

const CURRENCIES: CurrencyCode[] = ['UGX', 'USD', 'KES'];
const STATUSES: MediaPlanStatus[] = ['DRAFT', 'ACTIVE', 'CLOSED'];

export default function MediaPlanDetailPage() {
  const navigate = useNavigate();
  const { planId } = useParams<{ planId: string }>();
  const [plan, setPlan] = useState<MediaPlan | null>(null);
  const [buys, setBuys] = useState<MediaBuy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingBuy, setEditingBuy] = useState<MediaBuy | undefined>();
  const [editingPlan, setEditingPlan] = useState(false);
  const [draft, setDraft] = useState<Partial<MediaPlan>>({});
  const [savingPlan, setSavingPlan] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function reload() {
    if (!planId) return;
    try {
      const [p, b] = await Promise.all([getMediaPlan(planId), listMediaBuys(planId)]);
      setPlan(p);
      setBuys(b);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, [planId]);

  async function handleSaveBuy(values: Omit<MediaBuy, 'id' | 'planId' | 'actualMinor' | 'createdAt' | 'updatedAt'>) {
    if (!planId) return;
    if (editingBuy) {
      await updateMediaBuy(planId, editingBuy.id, values);
    } else {
      await addMediaBuy(planId, values);
    }
    await reload();
  }

  async function handleSavePlan() {
    if (!planId || !plan) return;
    setSavingPlan(true);
    try {
      const updates: Partial<MediaPlan> = {
        title: draft.title ?? plan.title,
        status: (draft.status ?? plan.status) as MediaPlanStatus,
        currency: (draft.currency ?? plan.currency) as CurrencyCode,
        totalBudgetMinor: draft.totalBudgetMinor ?? plan.totalBudgetMinor,
        flightStartDate: draft.flightStartDate ?? plan.flightStartDate,
        flightEndDate: draft.flightEndDate ?? plan.flightEndDate,
        notes: draft.notes ?? plan.notes,
      };
      await updateMediaPlan(planId, updates);
      await reload();
      setEditingPlan(false);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setSavingPlan(false);
    }
  }

  async function handleDelete() {
    if (!planId || !plan) return;
    const ok = window.confirm(
      `Delete media plan "${plan.title}"? This permanently removes the plan header. ` +
      `Existing buy rows under it will be orphaned — close the plan instead if work is in flight.`,
    );
    if (!ok) return;
    setDeleting(true);
    try {
      await deleteMediaPlan(planId);
      navigate('/media');
    } catch (err) {
      setError(String((err as Error).message));
      setDeleting(false);
    }
  }

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (error)   return <p className="p-6 text-sm text-destructive">Error: {error}</p>;
  if (!plan)   return <p className="p-6 text-sm text-muted-foreground">Plan not found.</p>;

  return (
    <div className="space-y-6 p-6">
      <nav className="text-sm text-muted-foreground">
        <Link to="/media" className="hover:underline">Media Plans</Link> › {plan.title}
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{plan.title}</h1>
            <MediaPlanStatusBadge status={plan.status} />
          </div>
          <p className="text-sm text-muted-foreground">
            Job: {plan.masterJobId} · Currency: {plan.currency} ·
            Total budget: {plan.currency} {(plan.totalBudgetMinor / 100).toLocaleString()}
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            to={`/media/${planId}/actuals`}
            className="rounded border px-3 py-1.5 text-sm"
          >
            Post Actuals
          </Link>
          {!editingPlan && (
            <button
              type="button"
              onClick={() => { setDraft(plan); setEditingPlan(true); }}
              className="rounded border px-3 py-1.5 text-sm hover:bg-[var(--bg-sunken)]"
              data-testid="media-plan-edit-btn"
            >
              Edit Plan
            </button>
          )}
          <button
            type="button"
            onClick={handleDelete}
            disabled={deleting}
            className="rounded border border-red-300 px-3 py-1.5 text-sm text-red-700 hover:bg-red-50 disabled:opacity-50"
            data-testid="media-plan-delete-btn"
          >
            {deleting ? 'Deleting…' : 'Delete'}
          </button>
          <button
            onClick={() => { setEditingBuy(undefined); setShowForm(true); }}
            className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          >
            Add Buy
          </button>
        </div>
      </header>

      {editingPlan && (
        <section className="rounded border bg-[var(--bg-sunken)] p-4">
          <h2 className="mb-3 text-sm font-semibold">Edit plan</h2>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <label className="col-span-2 block">
              <span className="block text-xs text-muted-foreground">Title</span>
              <input
                value={draft.title ?? ''}
                onChange={e => setDraft(d => ({ ...d, title: e.target.value }))}
                className="mt-1 w-full rounded border px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-muted-foreground">Status</span>
              <select
                value={(draft.status ?? plan.status) as string}
                onChange={e => setDraft(d => ({ ...d, status: e.target.value as MediaPlanStatus }))}
                className="mt-1 w-full rounded border px-2 py-1"
              >
                {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label className="block">
              <span className="block text-xs text-muted-foreground">Currency</span>
              <select
                value={(draft.currency ?? plan.currency) as string}
                onChange={e => setDraft(d => ({ ...d, currency: e.target.value as CurrencyCode }))}
                className="mt-1 w-full rounded border px-2 py-1"
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </label>
            <label className="col-span-2 block">
              <span className="block text-xs text-muted-foreground">Total budget (major units)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={((draft.totalBudgetMinor ?? plan.totalBudgetMinor) / 100).toString()}
                onChange={e => setDraft(d => ({ ...d, totalBudgetMinor: Math.round(parseFloat(e.target.value || '0') * 100) }))}
                className="mt-1 w-full rounded border px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-muted-foreground">Flight start</span>
              <input
                type="date"
                value={draft.flightStartDate ?? plan.flightStartDate ?? ''}
                onChange={e => setDraft(d => ({ ...d, flightStartDate: e.target.value }))}
                className="mt-1 w-full rounded border px-2 py-1"
              />
            </label>
            <label className="block">
              <span className="block text-xs text-muted-foreground">Flight end</span>
              <input
                type="date"
                value={draft.flightEndDate ?? plan.flightEndDate ?? ''}
                onChange={e => setDraft(d => ({ ...d, flightEndDate: e.target.value }))}
                className="mt-1 w-full rounded border px-2 py-1"
              />
            </label>
            <label className="col-span-2 block">
              <span className="block text-xs text-muted-foreground">Notes</span>
              <textarea
                value={draft.notes ?? plan.notes ?? ''}
                onChange={e => setDraft(d => ({ ...d, notes: e.target.value }))}
                rows={3}
                className="mt-1 w-full rounded border px-2 py-1"
              />
            </label>
          </div>
          <div className="mt-3 flex gap-2">
            <button
              onClick={handleSavePlan}
              disabled={savingPlan}
              className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-50"
            >
              {savingPlan ? 'Saving…' : 'Save'}
            </button>
            <button
              onClick={() => setEditingPlan(false)}
              className="rounded border px-3 py-1.5 text-sm hover:bg-card"
            >
              Cancel
            </button>
          </div>
        </section>
      )}

      {error && <p className="text-sm text-destructive">{error}</p>}

      <MediaBuyGrid
        buys={buys}
        currency={plan.currency}
        onEditBuy={(buy) => { setEditingBuy(buy); setShowForm(true); }}
      />

      <MediaBuyForm
        open={showForm}
        initial={editingBuy}
        onClose={() => { setShowForm(false); setEditingBuy(undefined); }}
        onSave={handleSaveBuy}
      />
    </div>
  );
}
