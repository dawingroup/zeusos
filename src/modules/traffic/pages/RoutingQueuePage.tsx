/**
 * Phase 6.UI.B — Routing Queue page.
 *
 * Lists master_jobs awaiting brand routing (`status === 'OPEN'`,
 * `allocatedMinor === 0`). For each row Traffic picks a capability
 * and clicks "Propose" → the `routeBrand` callable runs, the result
 * lands in `RoutingProposal` state, and `RouteBrandProposalCard`
 * renders the proposal with Confirm / Override CTAs.
 *
 * Confirm → routes the user to the master_job detail page so the
 * Account Manager can complete IWO issuance with the proposed brand
 * (the existing `IssueIWODialog` from Phase 3.D owns the budget /
 * handoff inputs). Override does the same with a different brand
 * and emits a console marker so the override flow is visible during
 * QA (Phase 6.E's unified inbox will persist override decisions).
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { FirebaseError } from 'firebase/app';
import { RefreshCw } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { BRAND_CAPABILITIES, type Capability, type DeliverySubsidiaryId } from '@/core/settings/brand-capabilities';
import type { MasterJob } from '@/modules/assignment/types/master-job.types';
import { RouteBrandProposalCard } from '../components/RouteBrandProposalCard';
import {
  routeBrandFn,
  subscribeOpenMasterJobs,
} from '../services/traffic.service';
import type { RoutingProposal } from '../types/traffic.types';

// Capability options Traffic can dispatch against. Union of every
// capability declared by any sub-brand in `BRAND_CAPABILITIES`.
const ALL_CAPABILITIES: Capability[] = Array.from(
  new Set(
    Object.values(BRAND_CAPABILITIES).flatMap((set) => Array.from(set)),
  ),
).sort() as Capability[];

interface QueueRowState {
  capability: Capability;
  proposal: RoutingProposal | null;
  loading: boolean;
  error: string | null;
}

export default function RoutingQueuePage() {
  const navigate = useNavigate();
  const [jobs, setJobs] = useState<MasterJob[]>([]);
  const [subscribeError, setSubscribeError] = useState<string | null>(null);
  const [rows, setRows] = useState<Record<string, QueueRowState>>({});

  useEffect(() => {
    const unsubscribe = subscribeOpenMasterJobs(
      (next) => {
        setJobs(next);
        // Seed row state for any new ids.
        setRows((prev) => {
          const out = { ...prev };
          for (const j of next) {
            if (!out[j.id]) {
              out[j.id] = { capability: 'creative', proposal: null, loading: false, error: null };
            }
          }
          return out;
        });
      },
      (e) => setSubscribeError(`Queue subscription failed: ${e.message}`),
    );
    return () => unsubscribe();
  }, []);

  const updateRow = (id: string, patch: Partial<QueueRowState>) => {
    setRows((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  };

  const requestProposal = async (job: MasterJob) => {
    const row = rows[job.id];
    if (!row) return;
    updateRow(job.id, { loading: true, error: null });
    try {
      const res = await routeBrandFn({
        masterJobId: job.id,
        requiredCapability: row.capability,
        tier: job.tier,
        accountId: job.clientId,
      });
      updateRow(job.id, { proposal: res.data, loading: false });
    } catch (err) {
      const msg = err instanceof FirebaseError
        ? `${err.code}: ${err.message}`
        : err instanceof Error ? err.message : 'Unknown error';
      updateRow(job.id, { error: msg, loading: false });
    }
  };

  const confirmAndIssue = (job: MasterJob, brandId: DeliverySubsidiaryId) => {
    // Hand off to the existing AM-side issuance dialog on the
    // master_job detail page. The hash carries the proposed brand
    // so MasterJobDetailPage can pre-select it on `IssueIWODialog`.
    navigate(`/master-jobs/${job.id}#issue-iwo:${brandId}`);
  };

  const overrideAndIssue = (job: MasterJob, brandId: DeliverySubsidiaryId, reason?: string) => {
    // Override decisions are observable today via the
    // `RoutingBrandProposed` event (already emitted by the
    // callable) cross-referenced with the eventual IWO's
    // subsidiaryOrgId. The cross-reference UI lands in 6.E; for now
    // we just log so QA can see the override fire.
    if (import.meta.env.DEV) {
      console.info('[traffic] override', { masterJobId: job.id, brandId, reason });
    }
    navigate(`/master-jobs/${job.id}#issue-iwo:${brandId}`);
  };

  const visibleJobs = useMemo(() => jobs, [jobs]);

  if (subscribeError) {
    return (
      <div
        role="alert"
        data-testid="routing-queue-error"
        className="p-4 rounded-md border border-[var(--rag-red)] bg-[var(--rag-red-soft)] text-[var(--rag-red-deep)]"
      >
        {subscribeError}
      </div>
    );
  }

  return (
    <section data-testid="routing-queue-page" className="space-y-4">
      {visibleJobs.length === 0 ? (
        <p
          data-testid="routing-queue-empty"
          className="text-[13px] text-[var(--fg-tertiary)] p-4 rounded-md border border-dashed border-[var(--border-default)] text-center"
        >
          No master jobs awaiting routing. Newly opened, unallocated jobs land here.
        </p>
      ) : (
        visibleJobs.map((job) => {
          const row = rows[job.id];
          if (!row) return null;
          return (
            <div key={job.id} data-testid={`queue-row-${job.id}`} className="space-y-2">
              {!row.proposal ? (
                <article className="rounded-lg border border-[var(--border-default)] bg-[var(--bg-surface)] p-4">
                  <header className="flex items-center justify-between gap-3 mb-3">
                    <div className="min-w-0">
                      <p className="text-[14px] font-semibold text-[var(--fg-primary)] truncate">
                        {job.code || job.id}
                      </p>
                      {job.campaign?.clientName && (
                        <p className="text-[12px] text-[var(--fg-tertiary)] truncate">
                          {job.campaign.clientName}
                          {job.campaign.name ? ` · ${job.campaign.name}` : ''}
                        </p>
                      )}
                    </div>
                  </header>
                  <div className="flex items-end gap-3">
                    <label className="flex-1 max-w-[200px]">
                      <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
                        Required capability
                      </span>
                      <select
                        data-testid={`capability-select-${job.id}`}
                        value={row.capability}
                        onChange={(e) =>
                          updateRow(job.id, { capability: e.target.value as Capability })
                        }
                        className="w-full h-8 px-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px]"
                      >
                        {ALL_CAPABILITIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </label>
                    <Button
                      size="sm"
                      data-testid={`propose-btn-${job.id}`}
                      disabled={row.loading}
                      onClick={() => requestProposal(job)}
                    >
                      {row.loading ? (
                        <>
                          <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" aria-hidden="true" />
                          Routing…
                        </>
                      ) : (
                        'Propose'
                      )}
                    </Button>
                  </div>
                  {row.error && (
                    <p
                      role="alert"
                      data-testid={`propose-error-${job.id}`}
                      className="mt-2 text-[12px] text-[var(--rag-red)]"
                    >
                      {row.error}
                    </p>
                  )}
                </article>
              ) : (
                <RouteBrandProposalCard
                  masterJob={job}
                  proposal={row.proposal}
                  onConfirm={(brandId) => confirmAndIssue(job, brandId)}
                  onOverride={(brandId, reason) => overrideAndIssue(job, brandId, reason)}
                />
              )}
            </div>
          );
        })
      )}
    </section>
  );
}
