/**
 * Phase 6.UI.B — RouteBrand proposal card.
 *
 * Renders the result of a `routeBrand` callable for one master_job.
 * Surfaces:
 *   - Proposed brand (or "no eligible brand" banner).
 *   - Tier badge + an SLA countdown derived from `briefedAt` + the
 *     tier definition. Reverts to `nowIso` if no briefedAt is known.
 *   - Required capability + geography preference (if applied).
 *   - Rejected candidates with reasons.
 *   - Two CTAs: "Confirm and issue" → navigates AM to the master-job
 *     detail page pre-filled with the proposed brand. "Override"
 *     opens a brand picker.
 */

import { useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Shuffle, Check, MapPin } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { BRIEF_TIERS, computeExpectedRevertBy, getSLAStatus, type BriefTier as NumericTier } from '@/modules/campaigns/constants/tiers';
import { ALL_DELIVERY_SUBSIDIARIES, type DeliverySubsidiaryId } from '@/core/settings/brand-capabilities';
import type { BriefTier } from '@/modules/hr-central/role-profiles/types';
import type { MasterJob } from '@/modules/assignment/types/master-job.types';

/**
 * Bridge the Phase-6.A string tier (`'TIER_1' | 'TIER_2' | 'TIER_3'`)
 * to the legacy numeric tier (`1 | 2 | 3`) used by `BRIEF_TIERS`.
 * Both type families coexist during the transition window — the
 * numeric helpers (computeExpectedRevertBy, getSLAStatus, badge
 * colour) are still useful so we adapt rather than fork.
 */
function numericTierFromBriefTier(tier: BriefTier): NumericTier {
  return tier === 'TIER_1' ? 1 : tier === 'TIER_2' ? 2 : 3;
}
import { cn } from '@/shared/lib/utils';
import { CandidateRejectionList } from './CandidateRejectionList';
import type { RoutingProposal } from '../types/traffic.types';

interface Props {
  masterJob: MasterJob;
  proposal: RoutingProposal;
  /** Fired with the chosen brand. `null` means "user dismissed". */
  onConfirm: (brandId: DeliverySubsidiaryId) => void;
  onOverride: (brandId: DeliverySubsidiaryId, reason?: string) => void;
}

const RAG_BORDER: Record<'green' | 'amber' | 'red', string> = {
  green: 'border-[var(--rag-green)]',
  amber: 'border-[var(--rag-amber)]',
  red: 'border-[var(--rag-red)]',
};

function formatCountdown(target: Date, now: Date = new Date()): string {
  const diffMs = target.getTime() - now.getTime();
  if (diffMs <= 0) return 'overdue';
  const hours = Math.floor(diffMs / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);
  if (days >= 2) return `${days}d remaining`;
  return `${hours}h remaining`;
}

export function RouteBrandProposalCard({ masterJob, proposal, onConfirm, onOverride }: Props) {
  const [showOverride, setShowOverride] = useState(false);
  const [overrideBrand, setOverrideBrand] = useState<DeliverySubsidiaryId>(
    proposal.proposedBrandId ?? 'zeus-the-agency',
  );
  const [overrideReason, setOverrideReason] = useState('');

  const tier = proposal.tierApplied ?? masterJob.tier ?? null;
  const numericTier = tier ? numericTierFromBriefTier(tier) : null;
  const briefedAt = masterJob.campaign?.brief?.briefedAt;
  const briefedDate = briefedAt
    ? new Date(typeof briefedAt === 'string' ? briefedAt : (briefedAt as { toDate?: () => Date }).toDate?.() ?? '')
    : null;

  const slaTarget = numericTier && briefedDate ? computeExpectedRevertBy(briefedDate, numericTier) : null;
  const slaStatus = numericTier && briefedDate ? getSLAStatus(briefedDate, numericTier) : null;

  const noEligible = proposal.proposedBrandId === null;

  return (
    <article
      data-testid="route-brand-proposal-card"
      data-master-job-id={masterJob.id}
      className={cn(
        'rounded-lg border bg-[var(--bg-surface)] p-4 shadow-[var(--shadow-sm)]',
        slaStatus ? RAG_BORDER[slaStatus] : 'border-[var(--border-default)]',
      )}
    >
      <header className="flex items-start justify-between gap-3 mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Link
              to={`/master-jobs/${masterJob.id}`}
              className="text-[14.5px] font-semibold text-[var(--fg-primary)] hover:underline truncate"
            >
              {masterJob.code || masterJob.id}
            </Link>
            {numericTier && (
              <span
                data-testid="tier-badge"
                className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded"
                style={{ background: BRIEF_TIERS[numericTier].badgeColor, color: 'white' }}
              >
                {BRIEF_TIERS[numericTier].label}
              </span>
            )}
          </div>
          {masterJob.campaign?.clientName && (
            <p className="text-[12px] text-[var(--fg-tertiary)] truncate">
              {masterJob.campaign.clientName}
              {masterJob.campaign.name ? ` · ${masterJob.campaign.name}` : ''}
            </p>
          )}
        </div>
        {slaTarget && (
          <span
            data-testid="sla-countdown"
            className={cn(
              'text-[11px] font-medium px-2 py-1 rounded',
              slaStatus === 'red' && 'bg-[var(--rag-red-soft)] text-[var(--rag-red-deep)]',
              slaStatus === 'amber' && 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber-deep)]',
              slaStatus === 'green' && 'bg-[var(--rag-green-soft)] text-[var(--rag-green-deep)]',
            )}
          >
            {formatCountdown(slaTarget)}
          </span>
        )}
      </header>

      {/* Proposed brand banner */}
      {noEligible ? (
        <div
          role="alert"
          data-testid="proposal-no-eligible"
          className="flex items-start gap-2 p-3 rounded-md border border-[var(--rag-red)] bg-[var(--rag-red-soft)] text-[var(--rag-red-deep)] mb-3"
        >
          <AlertTriangle className="h-4 w-4 mt-0.5 flex-shrink-0" aria-hidden="true" />
          <div className="text-[12.5px]">
            <strong>No eligible brand.</strong> Every candidate was rejected — see breakdown below.
            Override manually or escalate.
          </div>
        </div>
      ) : (
        <div
          data-testid="proposal-banner"
          className="flex items-center gap-3 p-3 rounded-md border border-[var(--accent)] bg-[var(--accent-soft)] mb-3"
        >
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-medium uppercase tracking-wider text-[var(--fg-tertiary)] mb-0.5">
              Proposed brand
            </p>
            <p
              data-testid="proposed-brand-id"
              className="text-[14px] font-semibold text-[var(--accent)] truncate"
            >
              {proposal.proposedBrandId}
            </p>
          </div>
          {proposal.geographyPreferenceApplied && (
            <span
              data-testid="geography-preference-badge"
              className="inline-flex items-center gap-1 text-[10.5px] font-medium px-2 py-1 rounded bg-[var(--bg-surface)] border border-[var(--border-default)]"
            >
              <MapPin className="h-3 w-3" aria-hidden="true" />
              KE preference
            </span>
          )}
        </div>
      )}

      {/* Candidate breakdown */}
      <details
        className="mb-3"
        open={noEligible}
        data-testid="candidate-breakdown"
      >
        <summary className="cursor-pointer text-[12px] text-[var(--fg-secondary)] mb-2">
          Candidate breakdown ({proposal.candidates.length})
        </summary>
        <CandidateRejectionList
          candidates={proposal.candidates}
          proposedBrandId={proposal.proposedBrandId}
        />
      </details>

      {/* Override editor */}
      {showOverride && (
        <div
          data-testid="override-editor"
          className="mb-3 p-3 rounded-md border border-[var(--border-default)] bg-[var(--bg-sunken)]"
        >
          <label className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
            Override to
          </label>
          <select
            data-testid="override-brand-select"
            value={overrideBrand}
            onChange={(e) => setOverrideBrand(e.target.value as DeliverySubsidiaryId)}
            className="w-full h-8 px-2 mb-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px]"
          >
            {ALL_DELIVERY_SUBSIDIARIES.map((b) => (
              <option key={b} value={b}>
                {b}
              </option>
            ))}
          </select>
          <label className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
            Reason (optional)
          </label>
          <input
            data-testid="override-reason-input"
            type="text"
            value={overrideReason}
            onChange={(e) => setOverrideReason(e.target.value)}
            placeholder="e.g. AM has prior relationship; capacity recovers in 24h"
            className="w-full h-8 px-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px]"
          />
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2">
        {!showOverride ? (
          <>
            <Button
              size="sm"
              data-testid="confirm-and-issue-btn"
              disabled={noEligible}
              onClick={() => proposal.proposedBrandId && onConfirm(proposal.proposedBrandId)}
            >
              <Check className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              Confirm and issue
            </Button>
            <Button
              size="sm"
              variant="outline"
              data-testid="open-override-btn"
              onClick={() => setShowOverride(true)}
            >
              <Shuffle className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" />
              Override
            </Button>
          </>
        ) : (
          <>
            <Button
              size="sm"
              data-testid="confirm-override-btn"
              onClick={() => onOverride(overrideBrand, overrideReason || undefined)}
            >
              Issue to {overrideBrand}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              data-testid="cancel-override-btn"
              onClick={() => setShowOverride(false)}
            >
              Cancel
            </Button>
          </>
        )}
      </div>
    </article>
  );
}
