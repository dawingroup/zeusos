/**
 * /media/:planId — buy grid with planned/booked/actual columns and add-buy slide-over.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getMediaPlan,
  listMediaBuys,
  addMediaBuy,
  updateMediaBuy,
} from '../services/media-plan.service';
import type { MediaPlan } from '../types/media-plan.types';
import type { MediaBuy } from '../types/media-buy.types';
import { MediaPlanStatusBadge } from '../components/MediaPlanStatusBadge';
import { MediaBuyGrid } from '../components/MediaBuyGrid';
import { MediaBuyForm } from '../components/MediaBuyForm';

export default function MediaPlanDetailPage() {
  const { planId } = useParams<{ planId: string }>();
  const [plan, setPlan] = useState<MediaPlan | null>(null);
  const [buys, setBuys] = useState<MediaBuy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [editingBuy, setEditingBuy] = useState<MediaBuy | undefined>();

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
          <button
            onClick={() => { setEditingBuy(undefined); setShowForm(true); }}
            className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground"
          >
            Add Buy
          </button>
        </div>
      </header>

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
