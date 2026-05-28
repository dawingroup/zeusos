/* eslint-disable design-system/no-inline-style-literals -- TODO(U.4): Phase 5.D scaffolding mirrors MyTimeThisWeekPage; full Tailwind/token refactor scheduled with the U.4 sweep. */
/**
 * TeamTimePage — `/time/team` (parent-org).
 *
 * The manager-facing counterpart to `/time` (MyTimeThisWeekPage, which
 * is each individual's own view). This page shows EVERY time entry
 * logged across the org in the selected week, grouped by person, so
 * Zeus Group leadership can see where effort is going week-to-week.
 *
 * Scope (MVP):
 *   • Parent-org only. The `time_entries` read rule only lets parent-org
 *     principals see across brands; a subsidiary principal's
 *     collection-group query would be rejected wholesale. The route is
 *     wrapped in `ParentOrgGuard`; this page additionally surfaces a
 *     permission-denied error in its alert region as a backstop.
 *   • Grouped by `userId`. The page shows the raw uid — a follow-up can
 *     join against the employee directory to render display names once
 *     the uid→employee map is wired (it's a SystemAccess.userId lookup
 *     today, not a direct field on Employee).
 *
 * Out of scope (documented follow-ups):
 *   • Brand-scoped team view for subsidiary delivery leads (needs
 *     `subsidiaryOrgId` denormalised onto the time-entry doc, or a
 *     fan-out of per-member queries via the role-assignment org graph).
 *   • Display-name resolution (uid → employee.fullName).
 *   • Cost roll-up (costMinor is internal; a parent-org cost view is a
 *     separate, more sensitive surface).
 */

import { useEffect, useMemo, useState } from 'react';
import type { TimeEntry } from '@/modules/delivery';
import {
  subscribeTeamTimeEntries,
  weekRange,
  totalMinutes,
  groupByUser,
  formatMinutes,
  formatMinor,
} from '../services/time-tracking.service';
import { resolveUserNames, type UserNameMap } from '../services/user-directory.service';

function fmtWeek(from: Date): string {
  const to = new Date(from);
  to.setDate(to.getDate() + 6);
  const fmt = (d: Date) => d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return `${fmt(from)} – ${fmt(to)}`;
}

export default function TeamTimePage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [names, setNames] = useState<UserNameMap>({});

  const { from, to } = useMemo(() => weekRange(new Date(), weekOffset), [weekOffset]);

  useEffect(() => {
    setErr(null);
    const u = subscribeTeamTimeEntries(
      from,
      to,
      setEntries,
      (e) => setErr(`Team time load failed: ${e.message}`),
    );
    return () => u();
  }, [from, to]);

  const members = useMemo(() => groupByUser(entries), [entries]);
  const weekTotal = useMemo(() => totalMinutes(entries), [entries]);
  const weekCostMinor = useMemo(
    () => members.reduce((s, m) => s + m.totalCostMinor, 0),
    [members],
  );
  // The dominant currency in the window (entries within one brand share it).
  const currency = entries[0]?.currency ?? 'USD';

  // Resolve uid → display name whenever the member set changes.
  useEffect(() => {
    const uids = members.map((m) => m.userId);
    if (uids.length === 0) return;
    let cancelled = false;
    resolveUserNames(uids).then((map) => {
      if (!cancelled) setNames(map);
    });
    return () => { cancelled = true; };
  }, [members]);

  return (
    <div style={{ padding: 24 }} data-testid="team-time-page">
      <header style={{ marginBottom: 16 }}>
        <h1 style={{ margin: 0, fontSize: 24, fontWeight: 600 }}>Team Time</h1>
        <p style={{ marginTop: 4, color: '#475569', fontSize: 13 }}>
          Every time entry logged across the group this week, grouped by person.
          Parent-org view — subsidiary leads see their own time on the personal
          My Time page.
        </p>
      </header>

      {err && (
        <div role="alert" data-testid="team-time-error" style={{
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
            data-testid="team-time-prev-week"
            onClick={() => setWeekOffset(o => o - 1)}
            style={{
              padding: '4px 10px', borderRadius: 4,
              border: '1px solid #e2e8f0', background: '#fff', cursor: 'pointer', fontSize: 12,
            }}
            aria-label="Previous week"
          >
            ← Prev
          </button>
          <div data-testid="team-time-week-label" style={{ fontSize: 13, fontWeight: 600 }}>
            Week of {fmtWeek(from)}
            {weekOffset === 0 ? <span style={{ marginLeft: 8, color: '#64748b', fontWeight: 400 }}>(this week)</span> : null}
          </div>
          <button
            type="button"
            data-testid="team-time-next-week"
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
        <div style={{ fontSize: 14, display: 'flex', gap: 16 }}>
          <span>
            <span style={{ color: '#64748b', marginRight: 6 }}>People</span>
            <strong data-testid="team-time-people-count">{members.length}</strong>
          </span>
          <span>
            <span style={{ color: '#64748b', marginRight: 6 }}>Hours</span>
            <strong data-testid="team-time-week-total">{formatMinutes(weekTotal)}</strong>
          </span>
          <span>
            <span style={{ color: '#64748b', marginRight: 6 }}>Cost</span>
            <strong data-testid="team-time-week-cost">{formatMinor(weekCostMinor, currency)}</strong>
          </span>
        </div>
      </section>

      {members.length === 0 ? (
        <p data-testid="team-time-empty" style={{ color: '#64748b', fontSize: 13 }}>
          No time logged across the group this week.
        </p>
      ) : (
        <ul style={{ listStyle: 'none', padding: 0, margin: 0 }} data-testid="team-time-member-list">
          {members.map((m) => (
            <li
              key={m.userId}
              data-testid={`team-time-member-${m.userId}`}
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                padding: '12px 14px',
                marginBottom: 8,
                borderRadius: 8,
                border: '1px solid #e2e8f0',
                background: '#fff',
              }}
            >
              <div style={{ minWidth: 0 }}>
                <span
                  data-testid={`team-time-member-${m.userId}-name`}
                  style={{ fontSize: 13, fontWeight: 600, color: '#0f172a' }}
                >
                  {names[m.userId] ?? m.userId}
                </span>
                <div style={{ marginTop: 2, color: '#64748b', fontSize: 12 }}>
                  {m.iwoCount} {m.iwoCount === 1 ? 'IWO' : 'IWOs'} · {m.entries.length} {m.entries.length === 1 ? 'entry' : 'entries'}
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong
                  data-testid={`team-time-member-${m.userId}-total`}
                  style={{ fontSize: 15, fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatMinutes(m.totalMinutes)}
                </strong>
                <div
                  data-testid={`team-time-member-${m.userId}-cost`}
                  style={{ marginTop: 2, color: '#64748b', fontSize: 12, fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatMinor(m.totalCostMinor, currency)}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
