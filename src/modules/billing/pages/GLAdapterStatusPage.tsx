/**
 * /billing/gl-status — per-subsidiary GL adapter health.
 *
 * Probes each ZeusOS subsidiary's configured adapter (defaults to the
 * Firestore audit adapter) and surfaces queue depth + last sync. The
 * QBO/Xero adapters return NOT_CONFIGURED until Phase 5 wires them.
 */

import { useEffect, useState } from 'react';
import { SUBSIDIARY_IDS } from '@/core/settings/types';
import type { SubsidiaryId } from '@/core/settings/types';
import { resolveAdapter } from '../services/gl-adapter.service';
import type { GLConnectionHealth } from '../types/gl.types';

interface Row {
  orgId: SubsidiaryId;
  health: GLConnectionHealth | null;
  error?: string;
}

export function GLAdapterStatusPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const results: Row[] = [];
      for (const orgId of SUBSIDIARY_IDS) {
        try {
          const adapter = await resolveAdapter(orgId);
          const health = await adapter.status(orgId);
          results.push({ orgId, health });
        } catch (err) {
          results.push({
            orgId,
            health: null,
            error: String((err as Error)?.message ?? err),
          });
        }
      }
      if (!cancelled) {
        setRows(results);
        setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">GL Adapter Status</h1>
        <p className="text-sm text-muted-foreground">
          Per-subsidiary connection health, queue depth, and last sync.
          The default adapter writes to the gl_postings audit collection;
          QBO/Xero connections land in Phase 5.
        </p>
      </header>

      {loading && <p className="text-sm text-muted-foreground">Probing…</p>}

      {!loading && (
        <table className="w-full text-sm">
          <thead className="text-left text-xs uppercase text-muted-foreground">
            <tr>
              <th className="py-2">Organisation</th>
              <th className="py-2">Adapter</th>
              <th className="py-2">Status</th>
              <th className="py-2 text-right">Queue depth</th>
              <th className="py-2">Last sync</th>
              <th className="py-2">Notes</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.orgId} className="border-t">
                <td className="py-2 font-mono text-xs">{row.orgId}</td>
                <td className="py-2 text-xs">{row.health?.adapter ?? '—'}</td>
                <td className="py-2 text-xs">
                  {row.health ? (
                    <span
                      className={statusBadgeClass(row.health.status)}
                    >
                      {row.health.status}
                    </span>
                  ) : (
                    <span className="rounded bg-red-100 px-2 py-0.5 text-xs text-red-800">
                      ERROR
                    </span>
                  )}
                </td>
                <td className="py-2 text-right font-mono">
                  {row.health?.queueDepth ?? '—'}
                </td>
                <td className="py-2 text-xs">
                  {row.health?.lastSyncAt
                    ? String(row.health.lastSyncAt)
                    : '—'}
                </td>
                <td className="py-2 text-xs text-muted-foreground">
                  {row.error ?? row.health?.message ?? ''}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function statusBadgeClass(status: GLConnectionHealth['status']): string {
  switch (status) {
    case 'CONNECTED':
      return 'rounded bg-green-100 px-2 py-0.5 text-xs text-green-800';
    case 'NOT_CONFIGURED':
      return 'rounded bg-[var(--bg-sunken)] px-2 py-0.5 text-xs text-muted-foreground';
    case 'DISCONNECTED':
      return 'rounded bg-amber-100 px-2 py-0.5 text-xs text-amber-800';
    case 'ERROR':
    default:
      return 'rounded bg-red-100 px-2 py-0.5 text-xs text-red-800';
  }
}

export default GLAdapterStatusPage;
