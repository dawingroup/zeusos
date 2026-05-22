/**
 * /account-mgmt/intake — DirectClientRequestRouted events from the
 * subsidiary side (spec §11.3). Each row shows the subsidiary that routed
 * the request and gives the AM links to either:
 *   - convert to a Change Order against an existing SOW
 *   - or kick off a New SOW
 *
 * 3.E will write the events on the subsidiary side; the consumer wiring
 * (this page) is part of 3.D.
 */

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  listOpenIntakeRequests,
  type DirectClientRequestEvent,
} from '@/modules/assignment/services/firestore';

export default function IntakeQueuePage() {
  const [rows, setRows] = useState<DirectClientRequestEvent[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listOpenIntakeRequests().then(rs => {
      setRows(rs);
      setLoading(false);
    });
  }, []);

  return (
    <div className="space-y-4 p-6">
      <header>
        <h1 className="text-xl font-semibold">Intake queue</h1>
        <p className="text-sm text-muted-foreground">
          Direct client requests that subsidiaries routed back to Account
          Management. Pricing, contracts and billing live exclusively here —
          subsidiaries have no UI affordance to answer the client with a price.
        </p>
      </header>

      {loading && <p className="text-sm text-muted-foreground">Loading intake queue…</p>}

      {!loading && rows.length === 0 && (
        <div className="rounded border border-dashed p-6 text-center text-sm text-muted-foreground">
          No open intake items. When a subsidiary forwards a direct client ask, it appears here.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="text-left text-xs uppercase text-muted-foreground">
              <th className="px-3 py-2">Subsidiary</th>
              <th className="px-3 py-2">Client</th>
              <th className="px-3 py-2">Related</th>
              <th className="px-3 py-2">Request</th>
              <th className="px-3 py-2">Action</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id} className="border-t align-top">
                <td className="px-3 py-2">{r.subsidiaryOrgId}</td>
                <td className="px-3 py-2">{r.clientId || '—'}</td>
                <td className="px-3 py-2 text-xs">
                  {r.iwoId && <div>IWO {r.iwoId}</div>}
                  {r.masterJobId && (
                    <Link to={`/master-jobs/${r.masterJobId}`} className="font-mono text-blue-700 hover:underline">
                      {r.masterJobId}
                    </Link>
                  )}
                </td>
                <td className="px-3 py-2 text-xs">{r.requestText}</td>
                <td className="px-3 py-2 text-xs">
                  {r.clientId && (
                    <Link to={`/clients/${r.clientId}`} className="block text-blue-700 hover:underline">
                      Open client →
                    </Link>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
