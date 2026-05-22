/**
 * /master-jobs — every master job grouped by client. Columns: code,
 * client, SOW, allocated vs ceiling, status, IWO count. Phase 3.D.
 */

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { listMasterJobs, listIwosForMasterJob } from '@/modules/assignment/services/firestore';
import type { MasterJob } from '@/modules/assignment/types/master-job.types';
import { formatMinor } from '../utils/money';

interface Row extends MasterJob {
  iwoCount: number;
}

export default function MasterJobsPage() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const mjs = await listMasterJobs();
      const enriched: Row[] = [];
      for (const mj of mjs) {
        const iwos = await listIwosForMasterJob(mj.id).catch(() => []);
        enriched.push({ ...mj, iwoCount: iwos.length });
      }
      if (!cancelled) {
        setRows(enriched);
        setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  const groups = useMemo(() => {
    const by: Record<string, Row[]> = {};
    for (const r of rows) {
      const key = r.clientId || '—';
      (by[key] ??= []).push(r);
    }
    return Object.entries(by).sort((a, b) => a[0].localeCompare(b[0]));
  }, [rows]);

  return (
    <div className="space-y-6 p-6">
      <header>
        <h1 className="text-xl font-semibold">Master Jobs</h1>
        <p className="text-sm text-muted-foreground">
          One row per active client engagement increment. Allocated is the
          sum of issued IWO budgets; ceiling is the SOW cap (raised only by
          approved Change Orders).
        </p>
      </header>

      {loading && <p className="text-sm text-muted-foreground">Loading master jobs…</p>}

      {!loading && rows.length === 0 && (
        <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
          No master jobs yet. Accept a Quote in the Pricing module and one will open automatically.
        </div>
      )}

      {!loading && groups.map(([clientId, jobs]) => (
        <section key={clientId}>
          <h2 className="mb-2 text-sm font-semibold uppercase text-muted-foreground">Client {clientId}</h2>
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="text-left text-xs uppercase text-muted-foreground">
                <th className="px-3 py-2">Code</th>
                <th className="px-3 py-2">SOW</th>
                <th className="px-3 py-2">Status</th>
                <th className="px-3 py-2 text-right">Allocated</th>
                <th className="px-3 py-2 text-right">Ceiling</th>
                <th className="px-3 py-2 text-right">% used</th>
                <th className="px-3 py-2 text-right">IWOs</th>
              </tr>
            </thead>
            <tbody>
              {jobs.map(j => {
                const pct = j.ceilingMinor > 0 ? Math.round((j.allocatedMinor / j.ceilingMinor) * 100) : 0;
                return (
                  <tr key={j.id} className="border-t hover:bg-slate-50">
                    <td className="px-3 py-2">
                      <Link to={`/master-jobs/${j.id}`} className="font-mono text-xs text-blue-700 hover:underline">{j.code}</Link>
                    </td>
                    <td className="px-3 py-2 font-mono text-xs">{j.sowId}</td>
                    <td className="px-3 py-2">{j.status}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMinor(j.allocatedMinor, j.currency)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{formatMinor(j.ceilingMinor, j.currency)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{pct}%</td>
                    <td className="px-3 py-2 text-right tabular-nums">{j.iwoCount}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      ))}
    </div>
  );
}
