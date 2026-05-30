/* eslint-disable design-system/no-inline-style-literals -- TODO(U.4): early Phase 5.D scaffolding mirrors BurnAndSlaPage/IwoHealthPage; full Tailwind token refactor scheduled with the U.4 sweep. */
/**
 * MyTimeThisWeekPage — `/time`.
 *
 * The first Phase 5.D surface: a cross-IWO "my time this week" view
 * for any staff member who logs time against IWOs. The backend
 * (postTimeEntry callable + time_entries subcollection +
 * collection-group index) shipped in Phase 3.B; this page is the
 * missing UI that lets staff see what they've already posted before
 * they fill out their next entry.
 *
 * Layout:
 *   • Header: week pager (← prev / "Week of …" / next →) + weekly
 *     total.
 *   • Per-IWO buckets sorted by total minutes desc. Each bucket has
 *     a "Log time" deep-link to the IWO workspace where the existing
 *     posting form lives.
 *   • Inside each bucket: rows for individual entries, day + minutes
 *     + note.
 *
 * Posting from this page is intentionally not in scope for the MVP —
 * the IWO workspace owns the canonical form (it carries the rate-card
 * + budget-hold context the Cloud Function needs). This page is a
 * read view to close the visibility gap.
 *
 * Permissions: read-only. Firestore rules on `time_entries` already
 * scope reads to parent-org or the IWO's home subsidiary, which means
 * staff see only their own entries in their own brand without any
 * extra UI guard.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useCurrentDawinUser } from '@/core/settings';
import { Button } from '@/core/components/ui/button';
import { PageHero } from '@/shared/components/refresh';
import type { TimeEntry } from '@/modules/delivery';
import {
  subscribeMyTimeEntries,
  weekRange,
  totalMinutes,
  groupByIwo,
  dayKey,
  formatMinutes,
} from '../services/time-tracking.service';
import { AddTimeEntryDialog } from '../components/AddTimeEntryDialog';

function fmtWeek(from: Date): string {
  // Monday → Sunday — show the calendar bounds compactly.
  const to = new Date(from);
  to.setDate(to.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, {
    month: 'short', day: 'numeric',
  });
  return `${fmt(from)} – ${fmt(to)}`;
}

export default function MyTimeThisWeekPage() {
  const { dawinUser } = useCurrentDawinUser();
  const uid = dawinUser?.id ?? null;

  const [weekOffset, setWeekOffset] = useState(0);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  const { from, to } = useMemo(
    () => weekRange(new Date(), weekOffset),
    [weekOffset],
  );

  useEffect(() => {
    if (!uid) return;
    setErr(null);
    const u = subscribeMyTimeEntries(
      uid,
      from,
      to,
      setEntries,
      (e) => setErr(`Time entries load failed: ${e.message}`),
    );
    return () => u();
  }, [uid, from, to]);

  const buckets = useMemo(() => groupByIwo(entries), [entries]);
  const weekTotal = useMemo(() => totalMinutes(entries), [entries]);

  if (!uid) {
    return (
      <div style={{ padding: 'var(--pad-page)' }}>
        <PageHero eyebrow="Delivery" title="My time" body="Sign in to see your time entries." />
      </div>
    );
  }

  return (
    <div style={{ padding: 'var(--pad-page)' }} data-testid="my-time-this-week-page">
      <PageHero
        eyebrow="Delivery · Time"
        title="My time"
        body="What you've logged against IWOs this week. The IWO workspace still owns the canonical posting form (with rate-card + budget-hold context) — this quick-add bypasses the round-trip for the common case."
        actions={
          <Button size="sm" data-testid="my-time-add-entry-btn" onClick={() => setDialogOpen(true)}>
            <Plus size={14} aria-hidden="true" style={{ marginRight: 4 }} />
            Add entry
          </Button>
        }
      />

      {err && (
        <div role="alert" data-testid="my-time-error" style={{
          padding: 12, marginBottom: 16, borderRadius: 6,
          background: '#fef2f2', color: '#7f1d1d', border: '1px solid #fecaca',
        }}>
          {err}
        </div>
      )}

      <section style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        padding: '12px 16px',
        marginBottom: 16,
        borderRadius: 8,
        border: '1px solid #e2e8f0',
        background: '#fff',
      }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <button
            type="button"
            data-testid="my-time-prev-week"
            onClick={() => setWeekOffset(o => o - 1)}
            style={{
              padding: '4px 10px', borderRadius: 4,
              border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer',
              fontSize: 12,
            }}
            aria-label="Previous week"
          >
            ← Prev
          </button>
          <div data-testid="my-time-week-label" style={{ fontSize: 13, fontWeight: 600 }}>
            Week of {fmtWeek(from)}
            {weekOffset === 0 ? <span style={{ marginLeft: 8, color: '#64748b', fontWeight: 400 }}>(this week)</span> : null}
          </div>
          <button
            type="button"
            data-testid="my-time-next-week"
            onClick={() => setWeekOffset(o => o + 1)}
            disabled={weekOffset >= 0}
            style={{
              padding: '4px 10px', borderRadius: 4,
              border: '1px solid #e2e8f0',
              background: weekOffset >= 0 ? '#f1f5f9' : '#fff',
              color: weekOffset >= 0 ? '#94a3b8' : '#0f172a',
              cursor: weekOffset >= 0 ? 'not-allowed' : 'pointer',
              fontSize: 12,
            }}
            aria-label="Next week"
          >
            Next →
          </button>
        </div>
        <div style={{ fontSize: 14 }}>
          <span style={{ color: '#64748b', marginRight: 6 }}>Total</span>
          <strong data-testid="my-time-week-total">{formatMinutes(weekTotal)}</strong>
        </div>
      </section>

      {entries.length === 0 ? (
        <p
          data-testid="my-time-empty"
          style={{ color: '#64748b', fontSize: 13 }}
        >
          No time logged this week. Open an IWO from the inbox to post your first entry.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid="my-time-bucket-list">
          {buckets.map((b) => (
            <li
              key={b.iwoId}
              data-testid={`my-time-bucket-${b.iwoId}`}
              style={{
                marginBottom: 16,
                padding: 12,
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#fff',
              }}
            >
              <header style={{
                display: 'flex',
                alignItems: 'baseline',
                justifyContent: 'space-between',
                marginBottom: 8,
                gap: 12,
              }}>
                <Link
                  to={`/delivery/iwo/${b.iwoId}`}
                  style={{
                    fontFamily: 'monospace',
                    color: '#0f172a',
                    textDecoration: 'none',
                    fontWeight: 600,
                    fontSize: 14,
                  }}
                  data-testid={`my-time-bucket-${b.iwoId}-link`}
                >
                  {b.iwoId}
                </Link>
                <div style={{ fontSize: 13 }}>
                  <span style={{ color: '#64748b', marginRight: 4 }}>This week</span>
                  <strong data-testid={`my-time-bucket-${b.iwoId}-total`}>
                    {formatMinutes(b.totalMinutes)}
                  </strong>
                </div>
              </header>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {b.entries.map((e) => (
                  <li
                    key={e.id}
                    data-testid={`my-time-entry-${e.id}`}
                    style={{
                      padding: '6px 0',
                      borderBottom: '1px solid #f1f5f9',
                      display: 'grid',
                      gridTemplateColumns: 'auto 80px 1fr',
                      gap: 12,
                      fontSize: 13,
                      alignItems: 'baseline',
                    }}
                  >
                    <span style={{ color: '#64748b', fontVariantNumeric: 'tabular-nums' }}>
                      {dayKey(e.entryDate)}
                    </span>
                    <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 500 }}>
                      {formatMinutes(e.minutes)}
                    </span>
                    <span style={{ color: '#475569' }}>{e.note || '—'}</span>
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ul>
      )}

      <AddTimeEntryDialog
        open={dialogOpen}
        onClose={() => setDialogOpen(false)}
        userId={uid}
        recentIwoIds={buckets.map(b => b.iwoId)}
      />
    </div>
  );
}
