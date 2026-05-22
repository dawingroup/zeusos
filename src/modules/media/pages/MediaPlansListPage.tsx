/**
 * /media — list of all media plans, filterable by status and campaign.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listMediaPlans } from '../services/media-plan.service';
import type { MediaPlan, MediaPlanStatus } from '../types/media-plan.types';
import { MediaPlanStatusBadge } from '../components/MediaPlanStatusBadge';

const STATUS_OPTIONS: Array<MediaPlanStatus | 'ALL'> = ['ALL', 'DRAFT', 'ACTIVE', 'CLOSED'];

export default function MediaPlansListPage() {
  const [plans, setPlans] = useState<MediaPlan[]>([]);
  const [statusFilter, setStatusFilter] = useState<MediaPlanStatus | 'ALL'>('ALL');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listMediaPlans({ status: statusFilter === 'ALL' ? undefined : statusFilter })
      .then((rows) => { if (!cancelled) setPlans(rows); })
      .catch((err) => { if (!cancelled) setError(String(err?.message ?? err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [statusFilter]);

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Media Plans</h1>
          <p className="text-sm text-muted-foreground">
            Budget allocation and channel buys for active campaigns.
          </p>
        </div>
        <div className="flex gap-2">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as MediaPlanStatus | 'ALL')}
            className="rounded border px-2 py-1 text-sm"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : s}</option>
            ))}
          </select>
          <Link
            to="/media/new"
            className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground"
          >
            New Plan
          </Link>
        </div>
      </header>

      {loading && <p className="text-sm text-muted-foreground">Loading media plans…</p>}
      {error && <p className="text-sm text-destructive">Error: {error}</p>}

      {!loading && !error && plans.length === 0 && (
        <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
          No media plans found. Create a plan to start buying media for a campaign.
        </div>
      )}

      {!loading && plans.length > 0 && (
        <ul className="divide-y rounded border">
          {plans.map((plan) => (
            <li key={plan.id} className="flex items-center justify-between p-3 hover:bg-muted/20">
              <div>
                <Link
                  to={`/media/${plan.id}`}
                  className="font-medium hover:underline"
                >
                  {plan.title}
                </Link>
                <div className="text-xs text-muted-foreground">
                  Job: {plan.masterJobId} · {plan.currency}{' '}
                  {(plan.totalBudgetMinor / 100).toLocaleString()} total budget
                </div>
              </div>
              <MediaPlanStatusBadge status={plan.status} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
