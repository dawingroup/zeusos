/**
 * RateCardEditorPage — line editor for one rate card (role_code, unit,
 * cost_minor, currency). Read-only once status leaves DRAFT.
 *
 * Activation: the page surfaces an "Activate" button when the card is
 * DRAFT and has at least one line. Activation calls `activateRateCard`,
 * which auto-retires the prior ACTIVE for the same subsidiary at
 * (newEffectiveFrom − 1 day).
 *
 * PHASE 3.A.5 PLACEHOLDER: line edits today are read-only-after-create
 * (the createRateCardVersion CFn writes the lines at creation time and
 * the only way to change them is to create a new draft version). The
 * "edit existing draft lines" affordance lands with 3.A.5 once we have
 * the canonical write rules.
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { getRateCard, listRateCardLines } from '../services/firestore';
import { activateRateCardFn, retireRateCardFn } from '../services/firebase';
import type { RateCard, RateCardLine } from '../types';

export default function RateCardEditorPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [card, setCard] = useState<RateCard | null>(null);
  const [lines, setLines] = useState<RateCardLine[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [effectiveFrom, setEffectiveFrom] = useState(() => {
    const d = new Date();
    d.setUTCHours(0, 0, 0, 0);
    return d.toISOString().slice(0, 10);
  });

  useEffect(() => {
    if (!id) return;
    Promise.all([getRateCard(id), listRateCardLines(id)])
      .then(([c, ls]) => {
        setCard(c);
        setLines(ls);
      })
      .finally(() => setLoading(false));
  }, [id]);

  const handleActivate = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const { data } = await activateRateCardFn({
        rateCardId: id,
        effectiveFrom: new Date(`${effectiveFrom}T00:00:00.000Z`).toISOString(),
      });
      alert(
        data.retiredPriorId
          ? `Activated. Prior card ${data.retiredPriorId} auto-retired the day before.`
          : 'Activated.',
      );
      navigate('/pricing/rate-cards');
    } catch (err) {
      alert(`Activate failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  const handleRetire = async () => {
    if (!id) return;
    if (!confirm('Retire this rate card? It will no longer be selectable by the pricing engine.')) return;
    setBusy(true);
    try {
      await retireRateCardFn({ rateCardId: id });
      navigate('/pricing/rate-cards');
    } catch (err) {
      alert(`Retire failed: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <div style={{ padding: 24 }}>Loading…</div>;
  if (!card) return <div style={{ padding: 24 }}>Not found. <Link to="/pricing/rate-cards">Back</Link></div>;

  return (
    <div style={{ padding: 24 }}>
      <header style={{ marginBottom: 16 }}>
        <Link to="/pricing/rate-cards" style={{ color: '#64748b', fontSize: 13 }}>← Rate cards</Link>
        <h1 style={{ margin: '8px 0 4px', fontSize: 22, fontWeight: 600 }}>
          {card.orgId} · v{card.version}
        </h1>
        <p style={{ margin: 0, color: '#475569', fontSize: 13 }}>Status: {card.status}</p>
      </header>

      {card.status === 'DRAFT' && (
        <div style={{ background: '#fff7ed', border: '1px solid #fed7aa', padding: 12, borderRadius: 6, marginBottom: 16 }}>
          <div style={{ fontWeight: 600, marginBottom: 4 }}>Activate this draft</div>
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <label style={{ fontSize: 13 }}>Effective from:</label>
            <input
              type="date"
              value={effectiveFrom}
              onChange={e => setEffectiveFrom(e.target.value)}
              style={{ padding: '6px 8px', border: '1px solid #d1d5db', borderRadius: 4 }}
            />
            <button
              type="button"
              onClick={handleActivate}
              disabled={busy || !lines.length}
              style={{ padding: '6px 12px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, fontWeight: 600, cursor: 'pointer' }}
            >
              Activate
            </button>
          </div>
          <div style={{ fontSize: 12, color: '#92400e', marginTop: 6 }}>
            Any existing ACTIVE card for this subsidiary will auto-retire effective the day before.
          </div>
        </div>
      )}

      {card.status === 'ACTIVE' && (
        <div style={{ marginBottom: 16 }}>
          <button
            type="button"
            onClick={handleRetire}
            disabled={busy}
            style={{ padding: '6px 12px', background: '#fef2f2', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 4, fontWeight: 600, cursor: 'pointer' }}
          >
            Retire card
          </button>
        </div>
      )}

      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
        <thead>
          <tr style={{ textAlign: 'left', color: '#64748b', fontSize: 12, textTransform: 'uppercase' }}>
            <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Role</th>
            <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Unit</th>
            <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0', textAlign: 'right' }}>Cost (internal)</th>
            <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Currency</th>
          </tr>
        </thead>
        <tbody>
          {lines.map(line => (
            <tr key={line.id}>
              <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9', fontFamily: 'monospace' }}>{line.roleCode}</td>
              <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9' }}>{line.unit}</td>
              <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                {formatCost(line.costMinor)}
              </td>
              <td style={{ padding: 12, borderBottom: '1px solid #f1f5f9' }}>{line.currency}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <p style={{ marginTop: 12, fontSize: 11, color: '#94a3b8' }}>
        <strong>cost_minor</strong> is the subsidiary's internal cost basis. Per spec §4.3 schema invariant, this number never reaches a client-facing surface.
      </p>
    </div>
  );
}

function formatCost(minor: number): string {
  return (minor / 100).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
