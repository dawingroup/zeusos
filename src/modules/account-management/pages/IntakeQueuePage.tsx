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
import { ArrowUpRight } from 'lucide-react';
import {
  listOpenIntakeRequests,
  type DirectClientRequestEvent,
} from '@/modules/assignment/services/firestore';
import { PageHero, Pill } from '@/shared/components/refresh';

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
    <div style={{ padding: 'var(--pad-page)' }} className="space-y-6">
      <PageHero
        eyebrow="Account Management"
        title="Intake"
        body="Inbound client requests that subsidiaries routed back to Account Management — ready to triage into a Master Job. Pricing, contracts and billing live exclusively here; subsidiaries have no UI affordance to answer the client with a price."
      />

      {loading && <p style={{ fontSize: 13, color: 'var(--fg-tertiary)' }}>Loading intake queue…</p>}

      {!loading && rows.length === 0 && (
        <div className="card card-pad" style={{ borderStyle: 'dashed', textAlign: 'center', color: 'var(--fg-tertiary)', fontSize: 13 }}>
          No open intake items. When a subsidiary forwards a direct client ask, it appears here.
        </div>
      )}

      {!loading && rows.length > 0 && (
        <div className="card" style={{ overflow: 'hidden' }}>
          <table className="tbl">
            <thead>
              <tr>
                <th>Subsidiary</th>
                <th>Client</th>
                <th>Related</th>
                <th>Request</th>
                <th style={{ textAlign: 'right' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id}>
                  <td><Pill tone="brand" dot={false}>{r.subsidiaryOrgId}</Pill></td>
                  <td style={{ fontWeight: 600 }}>{r.clientId || '—'}</td>
                  <td className="mono" style={{ fontSize: 12, color: 'var(--fg-tertiary)' }}>
                    {r.iwoId && <div>IWO {r.iwoId}</div>}
                    {r.masterJobId && (
                      <Link to={`/master-jobs/${r.masterJobId}`} className="hover:underline" style={{ color: 'var(--rag-blue)' }}>
                        {r.masterJobId}
                      </Link>
                    )}
                  </td>
                  <td style={{ maxWidth: 340, color: 'var(--fg-secondary)', fontSize: 12.5 }}>{r.requestText}</td>
                  <td style={{ textAlign: 'right' }}>
                    {r.clientId && (
                      <Link to={`/clients/${r.clientId}`} className="btn btn-secondary" style={{ marginLeft: 'auto' }}>
                        <ArrowUpRight size={13} /> Open client
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
