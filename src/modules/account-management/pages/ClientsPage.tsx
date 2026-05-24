/**
 * /clients — list every commercial-core Client with their open MSAs and
 * active SOWs at a glance. Phase 3.D.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  subscribeClients,
  listMsasForClient,
  listSowsForClient,
} from '@/modules/contracts/services/firestore';
import type { Client } from '@/modules/contracts/types/client.types';
import type { MSA } from '@/modules/contracts/types/msa.types';
import type { SOW } from '@/modules/contracts/types/sow.types';
import { formatMinor } from '../utils/money';

interface Row {
  client: Client;
  openMsas: number;
  activeSows: number;
  ceilingByCurrency: Record<string, number>;
}

export default function ClientsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [showArchived, setShowArchived] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const unsub = subscribeClients(async (clients) => {
      const enriched: Row[] = [];
      for (const c of clients) {
        const [msas, sows] = await Promise.all([
          listMsasForClient(c.id).catch(() => [] as MSA[]),
          listSowsForClient(c.id).catch(() => [] as SOW[]),
        ]);
        const ceilingByCurrency: Record<string, number> = {};
        for (const s of sows) {
          if (s.status === 'ACTIVE') {
            ceilingByCurrency[s.currency] = (ceilingByCurrency[s.currency] || 0) + s.ceilingMinor;
          }
        }
        enriched.push({
          client: c,
          openMsas: msas.filter(m => m.status === 'DRAFT' || m.status === 'ACTIVE').length,
          activeSows: sows.filter(s => s.status === 'ACTIVE').length,
          ceilingByCurrency,
        });
      }
      if (!cancelled) {
        setRows(enriched.sort((a, b) => a.client.name.localeCompare(b.client.name)));
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
      unsub();
    };
  }, []);

  return (
    <div className="space-y-6 p-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold">Clients</h1>
          <p className="text-sm text-muted-foreground">
            Zeus Group's commercial counterparties. Subsidiary identity is
            never shown on these documents.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={e => setShowArchived(e.target.checked)}
              className="rounded"
            />
            Show archived
          </label>
          <Link
            to="/clients/new"
            className="rounded bg-[var(--rag-blue)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--rag-blue)]"
          >
            + New client
          </Link>
        </div>
      </header>

      {loading && <p className="text-sm text-muted-foreground">Loading clients…</p>}

      {!loading && rows.length === 0 && (
        <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
          No clients yet. Start by creating one — that unlocks MSAs and SOWs.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="border-b text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Status</th>
              <th className="px-3 py-2">Billing</th>
              <th className="px-3 py-2 text-right">Open MSAs</th>
              <th className="px-3 py-2 text-right">Active SOWs</th>
              <th className="px-3 py-2 text-right">Active ceiling</th>
            </tr>
          </thead>
          <tbody>
            {rows
              .filter(({ client }) => showArchived || client.status !== 'BLOCKED')
              .map(({ client, openMsas, activeSows, ceilingByCurrency }) => (
              <tr
                key={client.id}
                className={`border-b hover:bg-[var(--bg-sunken)] ${client.status === 'BLOCKED' ? 'opacity-50' : ''}`}
              >
                <td className="px-3 py-2">
                  <Link to={`/clients/${client.id}`} className="font-medium text-[var(--rag-blue)] hover:underline">
                    {client.name}
                  </Link>
                  {client.code && <span className="ml-2 text-xs text-muted-foreground">{client.code}</span>}
                </td>
                <td className="px-3 py-2">{client.status}</td>
                <td className="px-3 py-2">{client.billingCurrency}</td>
                <td className="px-3 py-2 text-right tabular-nums">{openMsas}</td>
                <td className="px-3 py-2 text-right tabular-nums">{activeSows}</td>
                <td className="px-3 py-2 text-right tabular-nums">
                  {Object.entries(ceilingByCurrency).map(([ccy, amt]) => (
                    <div key={ccy}>{formatMinor(amt, ccy)}</div>
                  )) || '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
