/**
 * /media/:planId/report — post-campaign report: narrative, metrics table, PDF export stub.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { getMediaPlan, listMediaBuys, computeVariancePct } from '../services/media-plan.service';
import type { MediaPlan } from '../types/media-plan.types';
import type { MediaBuy } from '../types/media-buy.types';
import type { CampaignMetric } from '../types/post-campaign-report.types';

export default function PostCampaignReportPage() {
  const { planId } = useParams<{ planId: string }>();
  const [plan, setPlan] = useState<MediaPlan | null>(null);
  const [buys, setBuys] = useState<MediaBuy[]>([]);
  const [narrative, setNarrative] = useState('');
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (!planId) return;
    Promise.all([getMediaPlan(planId), listMediaBuys(planId)])
      .then(([p, b]) => { setPlan(p); setBuys(b); })
      .finally(() => setLoading(false));
  }, [planId]);

  const metrics: CampaignMetric[] = buys.map((buy) => ({
    name: buy.vehicleName,
    planned: buy.plannedMinor,
    actual: buy.actualMinor,
    unit: plan?.currency ?? 'UGX',
  }));

  const totalPlanned = buys.reduce((s, b) => s + b.plannedMinor, 0);
  const totalActual  = buys.reduce((s, b) => s + b.actualMinor,  0);

  function handleExportPDF() {
    // Stub: in Phase 5 this will call a Cloud Function to generate
    // a PDF using @react-pdf/renderer and upload to Storage.
    setExporting(true);
    setTimeout(() => {
      setExporting(false);
      alert('PDF export is not yet wired — this stub confirms the button works.');
    }, 800);
  }

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!plan)   return <p className="p-6 text-sm text-muted-foreground">Plan not found.</p>;

  return (
    <div className="space-y-6 p-6 max-w-3xl">
      <nav className="text-sm text-muted-foreground">
        <Link to="/media" className="hover:underline">Media Plans</Link> ›{' '}
        <Link to={`/media/${planId}`} className="hover:underline">{plan.title}</Link> › Report
      </nav>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">Post-Campaign Report</h1>
        <button
          onClick={handleExportPDF}
          disabled={exporting}
          className="rounded border px-3 py-1.5 text-sm disabled:opacity-60"
        >
          {exporting ? 'Generating PDF…' : 'Export PDF'}
        </button>
      </div>

      {/* Narrative */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Executive Narrative</h2>
        <textarea
          value={narrative}
          onChange={(e) => setNarrative(e.target.value)}
          rows={6}
          placeholder="Summarise campaign performance, key learnings, and recommendations…"
          className="w-full rounded border px-2 py-1.5 text-sm"
        />
      </section>

      {/* Summary row */}
      <section className="grid grid-cols-3 gap-4">
        {[
          { label: 'Total Planned', value: `${plan.currency} ${(totalPlanned / 100).toLocaleString()}` },
          { label: 'Total Actual',  value: `${plan.currency} ${(totalActual  / 100).toLocaleString()}` },
          {
            label: 'Overall Variance',
            value: `${computeVariancePct(totalPlanned, totalActual).toFixed(1)}%`,
          },
        ].map(({ label, value }) => (
          <div key={label} className="rounded border p-3">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="mt-1 font-semibold">{value}</p>
          </div>
        ))}
      </section>

      {/* Per-buy metrics table */}
      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Channel Performance</h2>
        <table className="w-full text-sm border rounded">
          <thead className="bg-muted/40">
            <tr>
              <th className="px-3 py-2 text-left font-medium">Channel</th>
              <th className="px-3 py-2 text-right font-medium">Planned</th>
              <th className="px-3 py-2 text-right font-medium">Actual</th>
              <th className="px-3 py-2 text-right font-medium">Variance %</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {metrics.map((m) => (
              <tr key={m.name}>
                <td className="px-3 py-2">{m.name}</td>
                <td className="px-3 py-2 text-right font-mono">
                  {plan.currency} {(m.planned / 100).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {plan.currency} {(m.actual / 100).toLocaleString()}
                </td>
                <td className="px-3 py-2 text-right font-mono">
                  {computeVariancePct(m.planned, m.actual).toFixed(1)}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
