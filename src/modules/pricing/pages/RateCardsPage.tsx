/* eslint-disable design-system/no-inline-style-literals -- TODO(U.4): early Phase 3.C scaffolding, uses inline px + hex throughout. Real Tailwind/token refactor scheduled for U.4. */
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
import { PageHero, Pill, type RagTone } from '@/shared/components/refresh';
import { Plus } from 'lucide-react';

const STATUS_TONE: Record<RateCard['status'], RagTone> = {
  DRAFT: 'blue',
  ACTIVE: 'green',
  RETIRED: 'neutral',
};

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
    <div style={{ padding: 'var(--pad-page)' }}>
      <PageHero
        eyebrow="Commercial · Pricing"
        title="Rate cards"
        body="Subsidiary cost basis per role and unit. PRICING_ADMIN only — subsidiary users cannot view cost_minor."
        actions={
          <>
            <label className="btn btn-secondary" style={{ cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={showRetired}
                onChange={(e) => setShowRetired(e.target.checked)}
                style={{ marginRight: 2 }}
              />
              Retired
            </label>
            <button type="button" onClick={handleNewDraft} disabled={busy} className="btn btn-primary">
              <Plus size={13} /> New draft · {SUBSIDIARIES.find((s) => s.id === active)?.label}
            </button>
          </>
        }
      />

      <nav role="tablist" style={{ display: 'flex', gap: 2, borderBottom: '1px solid var(--border-subtle)', marginBottom: 18 }}>
        {SUBSIDIARIES.map((s) => (
          <button
            key={s.id}
            role="tab"
            aria-selected={active === s.id}
            onClick={() => setActive(s.id)}
            style={{
              padding: '10px 14px',
              border: 0,
              background: 'transparent',
              borderBottom: `2px solid ${active === s.id ? 'var(--zeus-red)' : 'transparent'}`,
              marginBottom: -1,
              color: active === s.id ? 'var(--fg-primary)' : 'var(--fg-tertiary)',
              fontWeight: active === s.id ? 600 : 500,
              fontSize: 13,
              cursor: 'pointer',
            }}
          >
            {s.label}
          </button>
        ))}
      </nav>

      {visible.length === 0 ? (
        <div className="card card-pad" style={{ borderStyle: 'dashed', textAlign: 'center', color: 'var(--fg-tertiary)', fontSize: 13 }}>
          No rate cards for this subsidiary yet. Click <strong>+ New draft</strong> to start.
        </div>
      ) : (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Version</th>
                <th>Status</th>
                <th>Effective from</th>
                <th>Effective to</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {visible.map((card) => (
                <tr key={card.id}>
                  <td className="tabular" style={{ fontWeight: 600 }}>v{card.version}</td>
                  <td>
                    <Pill tone={STATUS_TONE[card.status]} dot={false}>{card.status}</Pill>
                  </td>
                  <td className="tabular" style={{ color: 'var(--fg-secondary)' }}>{formatDate(card.effectiveFrom)}</td>
                  <td className="tabular" style={{ color: 'var(--fg-secondary)' }}>{formatDate(card.effectiveTo)}</td>
                  <td style={{ textAlign: 'right' }}>
                    <Link to={`/pricing/rate-cards/${card.id}`} style={{ color: 'var(--rag-blue)', fontWeight: 600 }}>
                      Open →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
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
