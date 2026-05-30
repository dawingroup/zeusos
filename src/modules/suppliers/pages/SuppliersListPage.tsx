/**
 * /suppliers — directory of all external suppliers (media houses, talent
 * agencies, production houses, print shops, etc.).
 *
 * Staff read; create/edit requires parent-org principal (firestore.rules).
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { listSuppliers } from '../services/supplier.service';
import type {
  Supplier,
  SupplierKind,
  SupplierStatus,
} from '../types/supplier.types';
import { SupplierKindBadge } from '../components/SupplierKindBadge';
import { SupplierStatusBadge } from '../components/SupplierStatusBadge';
import { PageHero } from '@/shared/components/refresh';

const KIND_OPTIONS: Array<SupplierKind | 'ALL'> = [
  'ALL', 'MEDIA_HOUSE', 'TALENT_AGENCY', 'PRODUCTION_HOUSE', 'PRINT_SHOP', 'TECH_VENDOR', 'VENDOR_OTHER',
];

const STATUS_OPTIONS: Array<SupplierStatus | 'ALL'> = [
  'ALL', 'ACTIVE', 'INACTIVE', 'BLACKLISTED',
];

export default function SuppliersListPage() {
  const [rows, setRows] = useState<Supplier[]>([]);
  const [kindFilter, setKindFilter] = useState<SupplierKind | 'ALL'>('ALL');
  const [statusFilter, setStatusFilter] = useState<SupplierStatus | 'ALL'>('ACTIVE');
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    setLoading(true);
    setError(null);
    try {
      const result = await listSuppliers({
        kind: kindFilter === 'ALL' ? undefined : kindFilter,
        status: statusFilter === 'ALL' ? undefined : statusFilter,
      });
      setRows(result);
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { reload(); }, [kindFilter, statusFilter]);

  const filtered = search.trim()
    ? rows.filter((s) => s.name.toLowerCase().includes(search.trim().toLowerCase()))
    : rows;

  return (
    <div style={{ padding: 'var(--pad-page)' }} className="space-y-6">
      <PageHero
        eyebrow="Operations · Suppliers"
        title="Suppliers"
        body="Shared directory of media houses, talent agencies, production houses, and other external vendors. Linked to media supplier invoices and procurement POs."
      />
      <div className="flex flex-wrap gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name…"
            className="input"
            style={{ width: 'auto' }}
            data-testid="supplier-search"
          />
          <select
            value={kindFilter}
            onChange={(e) => setKindFilter(e.target.value as SupplierKind | 'ALL')}
            className="rounded border px-2 py-1 text-sm"
            data-testid="supplier-kind-filter"
          >
            {KIND_OPTIONS.map((k) => (
              <option key={k} value={k}>{k === 'ALL' ? 'All kinds' : k}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as SupplierStatus | 'ALL')}
            className="rounded border px-2 py-1 text-sm"
            data-testid="supplier-status-filter"
          >
            {STATUS_OPTIONS.map((s) => (
              <option key={s} value={s}>{s === 'ALL' ? 'All statuses' : s}</option>
            ))}
          </select>
          <Link
            to="/suppliers/new"
            className="rounded bg-primary px-3 py-1 text-sm text-primary-foreground"
            data-testid="supplier-new"
          >
            + New supplier
          </Link>
        </div>

      {loading && <p className="text-sm text-muted-foreground">Loading suppliers…</p>}
      {error && <p className="text-sm text-destructive">Error: {error}</p>}

      {!loading && !error && filtered.length === 0 && (
        <div className="card card-pad" style={{ borderStyle: 'dashed', textAlign: 'center', color: 'var(--fg-tertiary)', fontSize: 13 }}>
          No suppliers found. Click &quot;New supplier&quot; to add one.
        </div>
      )}

      {!loading && !error && filtered.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="tbl" data-testid="supplier-table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Kind</th>
                <th>Country</th>
                <th>Currency</th>
                <th>Terms</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((s) => (
                <tr key={s.id} data-supplier-id={s.id}>
                  <td style={{ fontWeight: 600 }}>
                    <Link to={`/suppliers/${s.id}`} className="hover:underline">
                      {s.name}
                    </Link>
                  </td>
                  <td><SupplierKindBadge kind={s.kind} /></td>
                  <td style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>{s.countryCode ?? '—'}</td>
                  <td style={{ fontSize: 12 }}>{s.currency}</td>
                  <td style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>{s.paymentTerms}</td>
                  <td><SupplierStatusBadge status={s.status} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
