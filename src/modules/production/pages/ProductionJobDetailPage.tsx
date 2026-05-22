/**
 * /production/:jobId — tabbed detail view: Overview | Pre-Prod Checklist | Call Sheets | Post-Production.
 */

import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import {
  getProductionJob,
  advanceProductionStage,
} from '../services/production-job.service';
import type { ProductionJob } from '../types/production-job.types';
import { PRODUCTION_STAGES } from '../types/production-job.types';
import { ProductionStageBadge } from '../components/ProductionStageBadge';
import { ChecklistPanel } from '../components/ChecklistPanel';
import { CallSheetPanel } from '../components/CallSheetPanel';
import { PostProductionPanel } from '../components/PostProductionPanel';

type Tab = 'overview' | 'checklist' | 'callsheets' | 'postproduction';

export default function ProductionJobDetailPage() {
  const { jobId } = useParams<{ jobId: string }>();
  const [job, setJob] = useState<ProductionJob | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>('overview');
  const [advancing, setAdvancing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function reload() {
    if (!jobId) return;
    const j = await getProductionJob(jobId);
    setJob(j);
  }

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [jobId]);

  async function handleAdvance() {
    if (!jobId) return;
    setAdvancing(true);
    setError(null);
    try {
      await advanceProductionStage(jobId, 'current-user');
      await reload();
    } catch (err) {
      setError(String((err as Error).message));
    } finally {
      setAdvancing(false);
    }
  }

  const canAdvance = job && job.stage !== 'COMPLETE';
  const stageIdx = job ? PRODUCTION_STAGES.indexOf(job.stage) : -1;

  if (loading) return <p className="p-6 text-sm text-muted-foreground">Loading…</p>;
  if (!job)   return <p className="p-6 text-sm text-muted-foreground">Job not found.</p>;

  const TABS: Array<{ id: Tab; label: string }> = [
    { id: 'overview',       label: 'Overview' },
    { id: 'checklist',      label: 'Pre-Prod Checklist' },
    { id: 'callsheets',     label: 'Call Sheets' },
    { id: 'postproduction', label: 'Post-Production' },
  ];

  return (
    <div className="space-y-6 p-6">
      <nav className="text-sm text-muted-foreground">
        <Link to="/production" className="hover:underline">Production</Link> › {job.title}
      </nav>

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-semibold">{job.title}</h1>
            <ProductionStageBadge stage={job.stage} />
          </div>
          <p className="text-sm text-muted-foreground">
            Type: {job.type} · Job: {job.masterJobId}
            {job.scheduledShootDate ? ` · Shoot: ${job.scheduledShootDate}` : ''}
          </p>
        </div>
        {canAdvance && (
          <button
            onClick={handleAdvance}
            disabled={advancing}
            className="rounded bg-primary px-3 py-1.5 text-sm text-primary-foreground disabled:opacity-60"
          >
            {advancing ? 'Advancing…' : `Advance to ${PRODUCTION_STAGES[stageIdx + 1]}`}
          </button>
        )}
      </header>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {/* Stage progress rail */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {PRODUCTION_STAGES.map((stage, idx) => (
          <div
            key={stage}
            className={`flex-shrink-0 rounded px-2 py-0.5 text-xs ${
              idx < stageIdx
                ? 'bg-primary/20 text-primary'
                : idx === stageIdx
                ? 'bg-primary text-primary-foreground'
                : 'bg-muted text-muted-foreground'
            }`}
          >
            {idx + 1}. {stage.replace(/_/g, ' ')}
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b flex gap-4">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? 'border-primary text-foreground'
                : 'border-transparent text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div>
        {activeTab === 'overview' && (
          <div className="space-y-3">
            <dl className="grid grid-cols-2 gap-3">
              {[
                { label: 'Subsidiary',    value: job.subsidiaryOrgId },
                { label: 'Producer',      value: job.producerId },
                { label: 'Master Job',    value: job.masterJobId },
                { label: 'Type',          value: job.type },
                { label: 'Current Stage', value: job.stage },
              ].map(({ label, value }) => (
                <div key={label} className="rounded border p-2">
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                  <dd className="text-sm font-medium">{value}</dd>
                </div>
              ))}
            </dl>
            {job.notes && (
              <div className="rounded border p-3">
                <p className="text-xs text-muted-foreground mb-1">Notes</p>
                <p className="text-sm">{job.notes}</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'checklist' && (
          <ChecklistPanel jobId={job.id} currentUserId="current-user" />
        )}

        {activeTab === 'callsheets' && (
          <CallSheetPanel jobId={job.id} />
        )}

        {activeTab === 'postproduction' && (
          <PostProductionPanel jobId={job.id} />
        )}
      </div>
    </div>
  );
}
