/* eslint-disable design-system/no-inline-style-literals -- TODO(U.4): Phase 5.D scaffolding mirrors MyTimeThisWeekPage; full Tailwind/token refactor scheduled with the U.4 sweep. */
/**
 * TeamTimePage — `/time/team`.
 *
 * The manager-facing counterpart to `/time` (each individual's own
 * view). Shows time entries logged in the selected week grouped by
 * person, with hours + cost roll-ups.
 *
 * Two scopes, resolved from the viewer's org context:
 *   • Parent-org principal → ALL brands (`subscribeTeamTimeEntries`),
 *     so Zeus Group leadership sees the whole consortium.
 *   • Subsidiary member → THEIR brand only
 *     (`subscribeTeamTimeEntriesByBrand`, filtered on the denormalised
 *     `subsidiaryOrgId`). The `time_entries` rule's direct-field clause
 *     authorises this collection-group query without a per-doc get().
 * A viewer with neither context sees the empty state. The rules are the
 * backstop — a subsidiary member can never read another brand's entries.
 *
 * Display names resolve via `user-directory.service` (uid → users/{uid}
 * profile). Cost is the internal `costMinor` roll-up; subsidiary members
 * already see their own brand's cost on the burn meter, and parent-org
 * sees all — so showing it here leaks nothing new.
 *
 * Caveat: brand scope relies on `subsidiaryOrgId` denormalised onto the
 * entry at post time; entries posted before that shipped won't appear in
 * the brand view until backfilled.
 */

import { useEffect, useMemo, useState } from 'react';
import { useCurrentDawinUser } from '@/core/settings';
import { isParentOrgUser, resolveHomeSubsidiaryId } from '@/modules/delivery/components/deliveryAccess';
import type { TimeEntry } from '@/modules/delivery';
import {
  subscribeTeamTimeEntries,
  subscribeTeamTimeEntriesByBrand,
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
  const { dawinUser } = useCurrentDawinUser();
  const [weekOffset, setWeekOffset] = useState(0);
  const [entries, setEntries] = useState<TimeEntry[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [names, setNames] = useState<UserNameMap>({});

  const { from, to } = useMemo(() => weekRange(new Date(), weekOffset), [weekOffset]);

  // Resolve the viewer's scope: parent-org → all brands; subsidiary
  // member → their home brand; otherwise none.
  const scope = useMemo<{ kind: 'parent' } | { kind: 'brand'; orgId: string } | { kind: 'none' }>(() => {
    if (!dawinUser) return { kind: 'none' };
    if (isParentOrgUser(dawinUser)) return { kind: 'parent' };
    const homeOrg = resolveHomeSubsidiaryId(dawinUser);
    return homeOrg ? { kind: 'brand', orgId: homeOrg } : { kind: 'none' };
  }, [dawinUser]);

  useEffect(() => {
    setErr(null);
    if (scope.kind === 'none') { setEntries([]); return; }
    const onErr = (e: Error) => setErr(`Team time load failed: ${e.message}`);
    const u = scope.kind === 'parent'
      ? subscribeTeamTimeEntries(from, to, setEntries, onErr)
      : subscribeTeamTimeEntriesByBrand(scope.orgId, from, to, setEntries, onErr);
    return () => u();
  }, [scope, from, to]);

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
        <p style={{ marginTop: 4, color: '#475569', fontSize: 13 }} data-testid="team-time-scope-note">
          {scope.kind === 'parent'
            ? 'Every time entry logged across the group this week, grouped by person (all brands).'
            : scope.kind === 'brand'
              ? 'Time logged by your brand this week, grouped by person.'
              : 'No team-time scope for your account.'}
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
