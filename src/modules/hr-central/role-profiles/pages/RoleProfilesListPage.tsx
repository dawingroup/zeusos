/**
 * RoleProfilesListPage — Phase 6.UI.A (PR 6).
 *
 * Lists every role profile with a filter by brand + status.
 * "New role profile" opens an inline `RoleProfileForm` (create mode).
 * Clicking a row navigates to the detail page where the same form
 * lands in edit mode.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Briefcase } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import type { RoleProfile } from '@/modules/hr-central/role-profiles/types';
import { subscribeRoleProfiles } from '../services/role-profile.service';
import { RoleProfileForm } from '../components/RoleProfileForm';
import { cn } from '@/shared/lib/utils';

const STATUS_TONE: Record<RoleProfile['status'], string> = {
  draft:    'bg-[var(--bg-sunken)] text-[var(--fg-secondary)]',
  active:   'bg-[var(--rag-green-soft)] text-[var(--rag-green-deep)]',
  archived: 'bg-[var(--bg-sunken)] text-[var(--fg-tertiary)] opacity-60',
};

export default function RoleProfilesListPage() {
  const [rows, setRows] = useState<RoleProfile[]>([]);
  const [err, setErr] = useState<string | null>(null);
  const [brandFilter, setBrandFilter] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [showCreate, setShowCreate] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeRoleProfiles(setRows, (e) =>
      setErr(`Role profiles subscription failed: ${e.message}`),
    );
    return () => unsubscribe();
  }, []);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (brandFilter && r.brandId !== brandFilter) return false;
      if (statusFilter && r.status !== statusFilter) return false;
      return true;
    });
  }, [rows, brandFilter, statusFilter]);

  return (
    <div className="p-6 space-y-4" data-testid="role-profiles-list-page">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h1 className="text-[20px] font-semibold text-[var(--fg-primary)] mb-1">Role Profiles</h1>
          <p className="text-[12.5px] text-[var(--fg-tertiary)]">
            Typed contracts describing what a holder can do, approve, and absorb in workload (Addendum v1.2 §2.1).
          </p>
        </div>
        {!showCreate && (
          <Button size="sm" data-testid="open-create-role-profile" onClick={() => setShowCreate(true)}>
            <Plus className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
            New role profile
          </Button>
        )}
      </header>

      {err && (
        <div role="alert" data-testid="role-profiles-error" className="p-3 rounded-md border border-[var(--rag-red)] bg-[var(--rag-red-soft)] text-[var(--rag-red-deep)] text-[13px]">
          {err}
        </div>
      )}

      {showCreate && (
        <div data-testid="role-profile-create" className="rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
          <header className="flex items-center justify-between mb-3">
            <h2 className="text-[14px] font-semibold text-[var(--fg-primary)]">New role profile</h2>
            <Button size="sm" variant="ghost" onClick={() => setShowCreate(false)}>Cancel</Button>
          </header>
          <RoleProfileForm onSaved={() => setShowCreate(false)} />
        </div>
      )}

      <div className="flex items-end gap-3 flex-wrap">
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">Brand</span>
          <select
            data-testid="rp-brand-filter"
            value={brandFilter}
            onChange={(e) => setBrandFilter(e.target.value)}
            className="h-8 px-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px]"
          >
            <option value="">All brands</option>
            <option value="zeus-the-agency">Zeus The Agency</option>
            <option value="zeus-digital">Zeus Digital</option>
            <option value="labyrinth">Labyrinth</option>
            <option value="odd-gorilla">Odd Gorilla</option>
            <option value="house-of-zeus">House of Zeus</option>
            <option value="all">All-brand roles</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">Status</span>
          <select
            data-testid="rp-status-filter"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="h-8 px-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px]"
          >
            <option value="">All statuses</option>
            <option value="draft">Draft</option>
            <option value="active">Active</option>
            <option value="archived">Archived</option>
          </select>
        </label>
      </div>

      {filtered.length === 0 ? (
        <p
          data-testid="role-profiles-empty"
          className="text-[13px] text-[var(--fg-tertiary)] italic p-4 rounded-md border border-dashed border-[var(--border-default)] text-center"
        >
          {rows.length === 0
            ? 'No role profiles yet. Create the first one to start declaring capabilities + assignments.'
            : 'No role profiles match the current filters.'}
        </p>
      ) : (
        <ul className="space-y-1.5">
          {filtered.map((r) => (
            <li key={r.id}>
              <Link
                to={`/hr/role-profiles/${encodeURIComponent(r.id)}`}
                data-testid={`role-profile-row-${r.id}`}
                className="flex items-center gap-3 p-2.5 rounded-md border border-[var(--border-default)] bg-[var(--bg-surface)] hover:bg-[var(--bg-sunken)] transition-colors"
              >
                <Briefcase className="h-3.5 w-3.5 text-[var(--fg-tertiary)] flex-shrink-0" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] font-medium text-[var(--fg-primary)] truncate">{r.title}</p>
                  <p className="text-[11.5px] text-[var(--fg-tertiary)] truncate">
                    {r.brandId} · {r.departmentId} · {r.jobLevel}
                  </p>
                </div>
                <span className={cn('text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded', STATUS_TONE[r.status])}>
                  {r.status}
                </span>
                <code className="font-mono text-[10.5px] text-[var(--fg-tertiary)] hidden md:inline">
                  {r.id}
                </code>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
