/**
 * /media — list of all media plans, filterable by status and campaign.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listMediaPlans } from '../services/media-plan.service';
import type { MediaPlan, MediaPlanStatus } from '../types/media-plan.types';
import { MediaPlanStatusBadge } from '../components/MediaPlanStatusBadge';
import { PageHero } from '@/shared/components/refresh';

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
    <div style={{ padding: 'var(--pad-page)' }} className="space-y-6">
      <PageHero
        eyebrow="Operations · Media"
        title="Media plans"
        body="Budget allocation and channel buys for active campaigns."
        actions={
          <>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as MediaPlanStatus | 'ALL')}
              className="input"
              style={{ width: 'auto' }}
            >
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : s}</option>
              ))}
            </select>
            <Link to="/media/new" className="btn btn-primary">
              New plan
            </Link>
          </>
        }
      />

      {loading && <p style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>Loading media plans…</p>}
      {error && <p style={{ fontSize: 13, color: 'var(--rag-red)' }}>Error: {error}</p>}

      {!loading && !error && plans.length === 0 && (
        <div className="card card-pad" style={{ borderStyle: 'dashed', textAlign: 'center', color: 'var(--fg-tertiary)', fontSize: 13 }}>
          No media plans found. Create a plan to start buying media for a campaign.
        </div>
      )}

      {!loading && plans.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {plans.map((plan) => (
            <div key={plan.id} className="list-row" style={{ justifyContent: 'space-between' }}>
              <div>
                <Link to={`/media/${plan.id}`} className="ttl hover:underline">
                  {plan.title}
                </Link>
                <div className="meta">
                  Job: {plan.masterJobId} <span className="sep">·</span> {plan.currency}{' '}
                  {(plan.totalBudgetMinor / 100).toLocaleString()} total budget
                </div>
              </div>
              <MediaPlanStatusBadge status={plan.status} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
