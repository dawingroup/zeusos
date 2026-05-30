/**
 * IWO Inbox — the subsidiary delivery cockpit. Two sections:
 *   1. Awaiting acceptance (ISSUED) — accept / reject inline.
 *   2. In-flight (ACCEPTED / IN_PROGRESS / DELIVERED).
 * Phase 3.E. UI refresh (batch 3b): PageHero + .card rows + refresh atoms.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { subscribeInbox } from '../services/firestore';
import { acceptWorkOrderFn, rejectWorkOrderFn } from '../services/firebase';
import type { InternalWorkOrder } from '@/modules/assignment/types/internal-work-order.types';
import { IWO_STATE_LABELS } from '@/modules/assignment/constants/iwo-states';
import { useSubsidiary } from '@/contexts/SubsidiaryContext';
import { SubsidiaryDeliveryGuard } from '../components/SubsidiaryDeliveryGuard';
import { formatMinor } from '@/modules/account-management/utils/money';
import { PageHero, SectionH, Pill } from '@/shared/components/refresh';

function IWOInboxInner() {
  const { currentSubsidiary } = useSubsidiary();
  const [issued, setIssued] = useState<InternalWorkOrder[]>([]);
  const [inFlight, setInFlight] = useState<InternalWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    if (!currentSubsidiary?.id) return;
    const unsub = subscribeInbox(currentSubsidiary.id, (next) => {
      setIssued(next.filter((w) => w.state === 'ISSUED'));
      setInFlight(next.filter((w) => ['ACCEPTED', 'IN_PROGRESS', 'DELIVERED'].includes(w.state)));
      setLoading(false);
    });
    return () => unsub();
  }, [currentSubsidiary?.id]);

  const handleAccept = async (id: string) => {
    setBusyId(id);
    try {
      await acceptWorkOrderFn({ iwoId: id });
    } catch (e) {
      alert(`Accept failed: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  const handleReject = async (id: string) => {
    const reason = prompt('Reason for rejection?');
    if (reason === null) return;
    setBusyId(id);
    try {
      await rejectWorkOrderFn({ iwoId: id, reason });
    } catch (e) {
      alert(`Reject failed: ${(e as Error).message}`);
    } finally {
      setBusyId(null);
    }
  };

  if (loading) return <div style={{ padding: 'var(--pad-page)', color: 'var(--fg-tertiary)' }}>Loading inbox…</div>;

  return (
    <div style={{ padding: 'var(--pad-page)' }}>
      <PageHero
        eyebrow={`${currentSubsidiary?.name ?? 'Subsidiary'} · Delivery`}
        title="IWO inbox"
        body="Work orders routed to your brand. Accept or reject what's awaiting you, then track what's in flight."
      />

      <SectionH title={`Awaiting acceptance (${issued.length})`} titleSize={15} />
      {issued.length === 0 && <p style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>Nothing awaiting acceptance.</p>}
      {issued.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {issued.map((wo) => (
            <div key={wo.id} className="card card-pad brand-edge" data-testid={`iwo-issued-${wo.id}`}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
                <div>
                  <Link to={`/delivery/iwo/${wo.id}`} style={{ fontWeight: 600 }} className="hover:underline">
                    {wo.code}
                  </Link>
                  <div style={{ fontSize: 11.5, color: 'var(--fg-tertiary)', marginTop: 2 }}>
                    {wo.title || 'Untitled'} · budget {formatMinor(wo.budgetMinor, wo.currency)}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: 8, flex: 'none' }}>
                  <button
                    onClick={() => handleAccept(wo.id)}
                    disabled={busyId === wo.id}
                    className="btn btn-accept"
                    data-testid={`accept-${wo.id}`}
                  >
                    {busyId === wo.id ? '…' : 'Accept'}
                  </button>
                  <button
                    onClick={() => handleReject(wo.id)}
                    disabled={busyId === wo.id}
                    className="btn btn-reject"
                    data-testid={`reject-${wo.id}`}
                  >
                    Reject
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <SectionH title={`In-flight (${inFlight.length})`} titleSize={15} />
      {inFlight.length === 0 && <p style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>No in-flight work orders.</p>}
      {inFlight.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {inFlight.map((wo) => (
            <div key={wo.id} className="card card-pad brand-edge" data-testid={`iwo-inflight-${wo.id}`}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <Link to={`/delivery/iwo/${wo.id}`} style={{ fontWeight: 600 }} className="hover:underline">
                  {wo.code}
                </Link>
                <Pill tone="blue">{IWO_STATE_LABELS[wo.state]}</Pill>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function IWOInboxPage() {
  return (
    <SubsidiaryDeliveryGuard>
      <IWOInboxInner />
    </SubsidiaryDeliveryGuard>
  );
}
