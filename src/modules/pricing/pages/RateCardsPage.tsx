/**
 * RateCardsPage — list ACTIVE + DRAFT rate cards per subsidiary.
 *
 * Spec §4.3 / task spec — one tab per subsidiary, each showing the active
 * card prominently and any draft beneath. From each row the PRICING_ADMIN
 * can drill into the editor (`/pricing/rate-cards/:id`) or activate a
 * draft. Retired cards are hidden by default to keep the chrome clean —
 * surfaceable behind a "show retired" toggle.
 *
 * PHASE 3.A.5 PLACEHOLDER NOTE — the page works without 3.A.5 (it reads
 * directly from the `rate_cards` collection); when 3.A.5 introduces
 * `organizations/{id}/rate_cards`, switch the query in `firestore.ts`.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { subscribeRateCardsForSubsidiary } from '../services/firestore';
import { createRateCardVersionFn } from '../services/firebase';
import type { RateCard } from '../types';
import type { SubsidiaryId } from '@/core/settings/types';

const SUBSIDIARIES: { id: SubsidiaryId; label: string }[] = [
  { id: 'zeus-the-agency', label: 'Zeus The Agency' },
  { id: 'zeus-digital',    label: 'Zeus Digital' },
  { id: 'labyrinth',       label: 'Labyrinth' },
  { id: 'odd-gorilla',     label: 'Odd Gorilla' },
  { id: 'house-of-zeus',   label: 'House of Zeus' },
];

export default function RateCardsPage() {
  const [active, setActive] = useState<SubsidiaryId>('zeus-the-agency');
  const [cardsBySubsidiary, setCardsBySubsidiary] = useState<Record<SubsidiaryId, RateCard[]>>(
    {} as Record<SubsidiaryId, RateCard[]>,
  );
  const [showRetired, setShowRetired] = useState(false);
  const [busy, setBusy] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const unsubs = SUBSIDIARIES.map(s =>
      subscribeRateCardsForSubsidiary(s.id, cards => {
        setCardsBySubsidiary(prev => ({ ...prev, [s.id]: cards }));
      }),
    );
    return () => unsubs.forEach(u => u());
  }, []);

  const visible = useMemo(() => {
    const all = cardsBySubsidiary[active] ?? [];
    return all
      .filter(c => showRetired || c.status !== 'RETIRED')
      .sort((a, b) => b.version - a.version);
  }, [cardsBySubsidiary, active, showRetired]);

  const handleNewDraft = async () => {
    setBusy(true);
    try {
      const { data } = await createRateCardVersionFn({
        orgId: active,
        lines: [
          { roleCode: 'ACCOUNT_DIRECTOR', unit: 'HOUR', costMinor: 10_000_00, currency: 'UGX' },
        ],
      });
      navigate(`/pricing/rate-cards/${data.rateCardId}`);
    } catch (err) {
      alert(`Could not create draft: ${(err as Error).message}`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div style={{ padding: 24 }}>
      <header style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Rate Cards</h1>
          <p style={{ marginTop: 4, color: '#475569', fontSize: 13 }}>
            Subsidiary cost basis per role and unit. PRICING_ADMIN only — subsidiary users cannot view <code>cost_minor</code>.
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <label style={{ fontSize: 12, color: '#475569' }}>
            <input
              type="checkbox"
              checked={showRetired}
              onChange={e => setShowRetired(e.target.checked)}
              style={{ marginRight: 6 }}
            />
            Show retired
          </label>
          <button
            type="button"
            onClick={handleNewDraft}
            disabled={busy}
            style={{
              padding: '8px 14px', borderRadius: 6, border: 'none',
              background: '#1d4ed8', color: '#fff', fontWeight: 600, cursor: 'pointer',
            }}
          >
            + New draft for {SUBSIDIARIES.find(s => s.id === active)?.label}
          </button>
        </div>
      </header>

      <nav role="tablist" style={{ display: 'flex', gap: 4, borderBottom: '1px solid #e2e8f0', marginBottom: 16 }}>
        {SUBSIDIARIES.map(s => (
          <button
            key={s.id}
            role="tab"
            aria-selected={active === s.id}
            onClick={() => setActive(s.id)}
            style={{
              padding: '8px 16px',
              border: 'none',
              background: 'transparent',
              borderBottom: active === s.id ? '2px solid #1d4ed8' : '2px solid transparent',
              color: active === s.id ? '#1d4ed8' : '#475569',
              fontWeight: active === s.id ? 600 : 400,
              cursor: 'pointer',
            }}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {visible.length === 0 ? (
        <div style={{ padding: 32, textAlign: 'center', color: '#94a3b8', border: '1px dashed #e2e8f0', borderRadius: 8 }}>
          No rate cards for this subsidiary yet. Click <strong>+ New draft</strong> to start.
        </div>
      ) : (
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14 }}>
          <thead>
            <tr style={{ textAlign: 'left', color: '#64748b', fontSize: 12, textTransform: 'uppercase' }}>
              <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Version</th>
              <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Status</th>
              <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Effective from</th>
              <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }}>Effective to</th>
              <th style={{ padding: '8px 12px', borderBottom: '1px solid #e2e8f0' }} />
            </tr>
          </thead>
          <tbody>
            {visible.map(card => (
              <tr key={card.id}>
                <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>v{card.version}</td>
                <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
                  <StatusPill status={card.status} />
                </td>
                <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
                  {formatDate(card.effectiveFrom)}
                </td>
                <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9' }}>
                  {formatDate(card.effectiveTo)}
                </td>
                <td style={{ padding: '12px', borderBottom: '1px solid #f1f5f9', textAlign: 'right' }}>
                  <Link to={`/pricing/rate-cards/${card.id}`} style={{ color: '#1d4ed8', fontWeight: 600 }}>
                    Open →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function StatusPill({ status }: { status: RateCard['status'] }) {
  const colors: Record<RateCard['status'], { bg: string; fg: string }> = {
    DRAFT:   { bg: '#e2e8f0', fg: '#475569' },
    ACTIVE:  { bg: '#dcfce7', fg: '#166534' },
    RETIRED: { bg: '#f1f5f9', fg: '#94a3b8' },
  };
  const s = colors[status];
  return (
    <span style={{ padding: '2px 8px', borderRadius: 4, background: s.bg, color: s.fg, fontSize: 11, fontWeight: 600 }}>
      {status}
    </span>
  );
}

function formatDate(value: unknown): string {
  if (!value) return '—';
  if (typeof value === 'string') return new Date(value).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  if (typeof value === 'object' && value !== null && 'toDate' in value && typeof (value as { toDate: unknown }).toDate === 'function') {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
  }
  return '—';
}
