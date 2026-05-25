/**
 * RoleAssignmentsListPage — Phase 6.UI.A (PR 6).
 *
 * Global view of every role assignment, grouped by role profile.
 * The page is read-only; rows link back to the role profile detail
 * page where ending assignments + creating new ones lives.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import type { RoleAssignment, RoleProfile } from '@/modules/hr-central/role-profiles/types';
import {
  subscribeRoleAssignments,
  subscribeRoleProfiles,
} from '../services/role-profile.service';

export default function RoleAssignmentsListPage() {
  const [profiles, setProfiles] = useState<RoleProfile[]>([]);
  const [assignments, setAssignments] = useState<RoleAssignment[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('active');

  useEffect(() => {
    const u1 = subscribeRoleProfiles(setProfiles);
    const u2 = subscribeRoleAssignments(setAssignments, (e) =>
      setErr(`Role assignments subscription failed: ${e.message}`),
    );
    return () => { u1(); u2(); };
  }, []);

  const profilesById = useMemo(() => {
    const out: Record<string, RoleProfile> = {};
    for (const p of profiles) out[p.id] = p;
    return out;
  }, [profiles]);

  const visible = useMemo(() => {
    if (!statusFilter) return assignments;
    return assignments.filter((a) => a.status === statusFilter);
  }, [assignments, statusFilter]);

  const grouped = useMemo(() => {
    const out = new Map<string, RoleAssignment[]>();
    for (const a of visible) {
      if (!out.has(a.roleProfileId)) out.set(a.roleProfileId, []);
      out.get(a.roleProfileId)!.push(a);
    }
    return Array.from(out.entries()).sort((a, b) => {
      const titleA = profilesById[a[0]]?.title ?? a[0];
      const titleB = profilesById[b[0]]?.title ?? b[0];
      return titleA.localeCompare(titleB);
    });
  }, [visible, profilesById]);

  return (
    <div className="p-6 space-y-4" data-testid="role-assignments-list-page">
      <header>
        <h1 className="text-[20px] font-semibold text-[var(--fg-primary)] mb-1">Role Assignments</h1>
        <p className="text-[12.5px] text-[var(--fg-tertiary)]">
          Effective-dated EmployeeId × RoleProfileId edges consumed by the EmployeeAssignmentService.
        </p>
      </header>

      {err && (
        <div role="alert" data-testid="ra-list-error" className="p-3 rounded-md border border-[var(--rag-red)] bg-[var(--rag-red-soft)] text-[var(--rag-red-deep)] text-[13px]">
          {err}
        </div>
      )}

      <label className="block">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">Status</span>
        <select
          data-testid="ra-status-filter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="h-8 px-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px]"
        >
          <option value="">All</option>
          <option value="active">Active</option>
          <option value="ended">Ended</option>
          <option value="paused">Paused</option>
        </select>
      </label>

      {grouped.length === 0 ? (
        <p
          data-testid="ra-list-empty"
          className="text-[13px] text-[var(--fg-tertiary)] italic p-4 rounded-md border border-dashed border-[var(--border-default)] text-center"
        >
          No assignments match the current filter.
        </p>
      ) : (
        <ul className="space-y-3">
          {grouped.map(([roleProfileId, rows]) => {
            const profile = profilesById[roleProfileId];
            return (
              <li
                key={roleProfileId}
                data-testid={`ra-group-${roleProfileId}`}
                className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-3"
              >
                <header className="flex items-baseline justify-between gap-3 mb-2">
                  <Link
                    to={`/hr/role-profiles/${encodeURIComponent(roleProfileId)}`}
                    className="text-[13.5px] font-semibold text-[var(--fg-primary)] hover:underline"
                  >
                    {profile?.title ?? roleProfileId}
                  </Link>
                  <span className="text-[11.5px] text-[var(--fg-tertiary)]">
                    {profile?.brandId ?? '—'} · {rows.length}
                  </span>
                </header>
                <ul className="space-y-1">
                  {rows.map((a) => (
                    <li
                      key={a.id}
                      data-testid={`ra-row-${a.id}`}
                      className="flex items-center gap-3 text-[12px]"
                    >
                      <code className="font-mono text-[var(--fg-primary)]">{a.employeeId}</code>
                      {a.isPrimary && (
                        <span className="text-[10px] uppercase tracking-wide font-semibold text-[var(--accent)] bg-[var(--accent-soft)] px-1.5 py-0.5 rounded">
                          primary
                        </span>
                      )}
                      <span className="ml-auto text-[11px] text-[var(--fg-tertiary)]">
                        {a.status} · {typeof a.effectiveFrom === 'string' ? (a.effectiveFrom as string).slice(0, 10) : '—'}
                      </span>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
