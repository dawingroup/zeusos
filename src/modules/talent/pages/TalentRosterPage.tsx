/**
 * /talent — searchable talent roster with type/subsidiary/status filters.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listTalentProfiles } from '../services/talent-profile.service';
import type { TalentProfile, TalentType, TalentStatus } from '../types/talent-profile.types';
import { TalentCard } from '../components/TalentCard';

const TYPE_OPTIONS: Array<TalentType | 'ALL'> = ['ALL', 'STAFF', 'FREELANCER'];
const STATUS_OPTIONS: Array<TalentStatus | 'ALL'> = ['ALL', 'ACTIVE', 'INACTIVE', 'BLACKLISTED'];

export default function TalentRosterPage() {
  const [profiles, setProfiles] = useState<TalentProfile[]>([]);
  const [typeFilter, setTypeFilter] = useState<TalentType | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<TalentStatus | 'ALL'>('ACTIVE');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    listTalentProfiles({
      type:   typeFilter   === 'ALL' ? undefined : typeFilter,
      status: statusFilter === 'ALL' ? undefined : statusFilter,
    })
      .then((rows) => { if (!cancelled) setProfiles(rows); })
      .catch((err) => { if (!cancelled) setError(String((err as Error).message)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [typeFilter, statusFilter]);

  const filtered = useMemo(() => {
    if (!search.trim()) return profiles;
    const q = search.toLowerCase();
    return profiles.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        p.email.toLowerCase().includes(q) ||
        p.roles.some((r) => r.toLowerCase().includes(q)),
    );
  }, [profiles, search]);

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Talent Roster</h1>
          <p className="text-sm text-muted-foreground">
            Staff and freelancer profiles, rate cards, and contracts.
          </p>
        </div>
        <Link
          to="/talent/new"
          className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground"
        >
          Add Talent
        </Link>
      </header>

      {/* Filters */}
      <div className="flex flex-wrap gap-2">
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name, email, role…"
          className="rounded border px-2 py-1 text-sm w-64"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as TalentType | 'ALL')}
          className="rounded border px-2 py-1 text-sm"
        >
          {TYPE_OPTIONS.map((t) => (
            <option key={t} value={t}>{t === 'ALL' ? 'All types' : t}</option>
          ))}
        </select>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as TalentStatus | 'ALL')}
          className="rounded border px-2 py-1 text-sm"
        >
          {STATUS_OPTIONS.map((s) => (
            <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : s}</option>
          ))}
        </select>
      </div>

      {loading && <p className="text-sm text-muted-foreground">Loading roster…</p>}
      {error && <p className="text-sm text-destructive">Error: {error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
          No talent profiles match your filters.
        </div>
      )}

      {!loading && filtered.length > 0 && (
        <div className="space-y-2">
          {filtered.map((profile) => (
            <TalentCard key={profile.id} profile={profile} />
          ))}
        </div>
      )}
    </div>
  );
}
