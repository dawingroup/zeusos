/**
 * /media/:planId/actuals — reconcile actual spend against planned buys.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMediaPlan, listMediaBuys } from '../services/media-plan.service';
import { postActual } from '../services/media-actuals.service';
import type { MediaPlan } from '../types/media-plan.types';
import type { MediaBuy } from '../types/media-buy.types';
import type { MediaActual } from '../types/media-actual.types';
import { ActualReconcileForm } from '../components/ActualReconcileForm';

export default function MediaPlanActualsPage() {
  const { planId } = useParams<{ planId: string }>();
  const [plan, setPlan] = useState<MediaPlan | null>(null);
  const [buys, setBuys] = useState<MediaBuy[]>([]);
  const [activeBuy, setActiveBuy] = useState<MediaBuy | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState<string | null>(null);

  useEffect(() => {
    if (!planId) return;
    Promise.all([getMediaPlan(planId), listMediaBuys(planId)])
      .then(([p, b]) => { setPlan(p); setBuys(b); })
      .catch((err) => setError(String((err as Error).message)))
      .finally(() => setLoading(false));
  }, [planId]);

  async function handlePostActual(values: Omit<MediaActual, 'id' | 'planId' | 'createdAt'>) {
    if (!planId) return;
    await postActual(planId, values);
    setSaved(`Actual posted for ${activeBuy?.vehicleName}`);
    setActiveBuy(null);
    // Reload buys to reflect updated actualMinor.
    const freshBuys = await listMediaBuys(planId);
    setBuys(freshBuys);
  }

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (error)   return <p className="p-6 text-sm text-destructive">Error: {error}</p>;
  if (!plan)   return <p className="p-6 text-sm text-muted-foreground">Plan not found.</p>;

  return (
    <div className="space-y-6 p-6">
      <nav className="text-sm text-muted-foreground">
        <Link to="/media" className="hover:underline">Media Plans</Link> ›{' '}
        <Link to={`/media/${planId}`} className="hover:underline">{plan.title}</Link> › Actuals
      </nav>

      <h1 className="text-xl font-semibold">Post Actuals — {plan.title}</h1>

      {saved && (
        <div className="rounded bg-[var(--rag-green-soft)] px-3 py-2 text-sm text-[var(--rag-green)]">
          {saved}
        </div>
      )}

      {activeBuy ? (
        <ActualReconcileForm
          buy={activeBuy}
          onSave={handlePostActual}
          onCancel={() => setActiveBuy(null)}
        />
      ) : (
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Select a buy to reconcile actual spend:
          </p>
          <ul className="divide-y rounded border">
            {buys.map((buy) => (
              <li
                key={buy.id}
                className="flex items-center justify-between p-3 hover:bg-muted/20 cursor-pointer"
                onClick={() => setActiveBuy(buy)}
              >
                <div>
                  <span className="font-medium">{buy.vehicleName}</span>
                  <span className="ml-2 text-xs text-muted-foreground">{buy.vehicleType}</span>
                </div>
                <div className="text-sm font-mono text-muted-foreground">
                  Planned: {plan.currency} {(buy.plannedMinor / 100).toLocaleString()} ·
                  Actual: {plan.currency} {(buy.actualMinor / 100).toLocaleString()}
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
