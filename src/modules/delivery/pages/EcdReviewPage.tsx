/**
 * ECD Review — Executive Creative Director approval ladder surface.
 * Phase 6.UI. Subsidiary-scoped. UI refresh (batch 3b).
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { subscribeEcdQueue } from '../services/firestore';
import type { InternalWorkOrder } from '@/modules/assignment/types/internal-work-order.types';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import { SubsidiaryDeliveryGuard } from '../components/SubsidiaryDeliveryGuard';
import { ApprovalLadder } from '../components/ApprovalLadder';
import { PageHero } from '@/shared/components/refresh';

function EcdReviewInner() {
  const { currentSubsidiary } = useSubsidiary();
  const [queue, setQueue] = useState<InternalWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!currentSubsidiary?.id) return;
    const unsub = subscribeEcdQueue(currentSubsidiary.id, (next) => {
      setQueue(next);
      setLoading(false);
    });
    return () => unsub();
  }, [currentSubsidiary?.id]);

  if (loading) return <div style={{ padding: 'var(--pad-page)', color: 'var(--fg-tertiary)' }}>Loading ECD queue…</div>;

  return (
    <div style={{ padding: 'var(--pad-page)' }}>
      <PageHero
        eyebrow={`${currentSubsidiary?.name ?? 'Subsidiary'} · Delivery`}
        title="ECD review"
        body="Creative work awaiting approval-ladder sign-off. Advance or reject each rung of the Executive Creative Director ladder."
      />

      {queue.length === 0 && <p style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>Nothing in the ECD queue.</p>}

      {queue.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {queue.map((wo) => (
            <div key={wo.id} className="card card-pad brand-edge" data-testid={`ecd-${wo.id}`}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <Link to={`/delivery/iwo/${wo.id}`} style={{ fontWeight: 600 }} className="hover:underline">
                    {wo.code}
                  </Link>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-tertiary)', marginTop: 2 }}>{wo.title || 'Untitled'}</div>
                </div>
              </div>
              <div style={{ marginTop: 14 }}>
                <ApprovalLadder iwo={wo} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function EcdReviewPage() {
  return (
    <SubsidiaryDeliveryGuard>
      <EcdReviewInner />
    </SubsidiaryDeliveryGuard>
  );
}
