/**
 * BriefIntakeForm — Phase 6.UI.D.1 (PR 5).
 *
 * Editable form over `master_job.campaign.brief`. Surfaces the
 * co-authored intake fields introduced by Phase 6.D (Addendum
 * v1.1 §7.3 / C6):
 *
 *   - documentDeliveredAt   datetime picker
 *   - verbalBriefingAt      datetime picker
 *   - authorContributions[] repeater (client + agency sides)
 *
 * Plus the legacy fields: tier, objectives, target audience,
 * deliverablesSummary, deadline.
 *
 * Validation runs through `validateBrief()` from
 * `@/modules/campaigns/utils/briefValidation` — the warnings render
 * inline as yellow banners but never block save. The 24h-doc-before-
 * verbal rule is advisory.
 *
 * Save persists via `updateMasterJobBriefFn` (callable shipped in
 * this PR). The callable whitelists fields server-side.
 */

import { useMemo, useState } from 'react';
import { FirebaseError } from 'firebase/app';
import { Plus, Trash2, AlertTriangle } from 'lucide-react';
import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import type {
  Brief,
  BriefAuthorContribution,
} from '@/modules/campaigns/types/campaign.types';
import type { BriefTier as NumericBriefTier } from '@/modules/campaigns/constants/tiers';
import { validateBrief } from '@/modules/campaigns/utils/briefValidation';
import { updateMasterJobBriefFn } from '../services/brief-ces.service';
import { cn } from '@/shared/lib/utils';

interface Props {
  masterJobId: string;
  brief: Brief | undefined;
  onSaved?: () => void;
}

interface ContributionDraft extends Omit<BriefAuthorContribution, 'contributedAt'> {
  contributedAt: string;
}

function nowIso(): string {
  return new Date().toISOString();
}

function rid(): string {
  return `bac_${Math.random().toString(36).slice(2, 10)}`;
}

function isoToLocalInput(value: unknown): string {
  if (!value) return '';
  if (typeof value === 'string') {
    const d = new Date(value);
    if (Number.isNaN(d.getTime())) return '';
    // datetime-local expects YYYY-MM-DDTHH:mm
    const off = d.getTimezoneOffset() * 60_000;
    return new Date(d.getTime() - off).toISOString().slice(0, 16);
  }
  return '';
}

function localInputToIso(value: string): string | undefined {
  if (!value) return undefined;
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return undefined;
  return d.toISOString();
}

const CONTRIBUTION_ROLE_HINTS = [
  'creative_lead', 'strategy_lead', 'account_lead', 'client_lead',
  'subject_matter_expert', 'producer', 'planner',
];

export function BriefIntakeForm({ masterJobId, brief, onSaved }: Props) {
  // Form state
  const [tier, setTier] = useState<NumericBriefTier>((brief?.tier ?? 2) as NumericBriefTier);
  const [objectives, setObjectives] = useState(brief?.objectives ?? '');
  const [targetAudience, setTargetAudience] = useState(brief?.targetAudience ?? '');
  const [deliverablesSummary, setDeliverablesSummary] = useState(brief?.deliverablesSummary ?? '');
  const [documentDeliveredAt, setDocumentDeliveredAt] = useState(isoToLocalInput(brief?.documentDeliveredAt));
  const [verbalBriefingAt, setVerbalBriefingAt] = useState(isoToLocalInput(brief?.verbalBriefingAt));
  const [contributions, setContributions] = useState<ContributionDraft[]>(() => {
    const seed = (brief?.authorContributions ?? []) as BriefAuthorContribution[];
    return seed.map((c) => ({
      ...c,
      contributedAt:
        typeof c.contributedAt === 'string'
          ? c.contributedAt
          : nowIso(),
    }));
  });

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  // Build a Brief shape for validation (uses the same source-of-truth fn).
  const briefForValidation: Brief = useMemo(
    () => ({
      tier,
      objectives,
      targetAudience,
      kpis: brief?.kpis ?? [],
      deliverablesSummary,
      documentDeliveredAt: localInputToIso(documentDeliveredAt),
      verbalBriefingAt: localInputToIso(verbalBriefingAt),
      authorContributions: contributions,
    }),
    [tier, objectives, targetAudience, deliverablesSummary, documentDeliveredAt, verbalBriefingAt, contributions, brief?.kpis],
  );

  const warnings = useMemo(() => validateBrief(briefForValidation), [briefForValidation]);

  const addContribution = (principalKind: 'client' | 'agency') => {
    setContributions((prev) => [
      ...prev,
      {
        id: rid(),
        principalKind,
        principalRef: '',
        role: principalKind === 'client' ? 'client_lead' : 'account_lead',
        contributionSummary: '',
        contributedAt: nowIso(),
      },
    ]);
  };

  const updateContribution = (id: string, patch: Partial<ContributionDraft>) => {
    setContributions((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };

  const removeContribution = (id: string) => {
    setContributions((prev) => prev.filter((c) => c.id !== id));
  };

  const submit = async () => {
    setBusy(true);
    setErr(null);
    setSaved(false);
    try {
      await updateMasterJobBriefFn({
        masterJobId,
        brief: {
          tier,
          objectives,
          targetAudience,
          deliverablesSummary: deliverablesSummary || undefined,
          documentDeliveredAt: localInputToIso(documentDeliveredAt),
          verbalBriefingAt: localInputToIso(verbalBriefingAt),
          authorContributions: contributions,
        },
      });
      setSaved(true);
      onSaved?.();
    } catch (e) {
      setErr(e instanceof FirebaseError ? `${e.code}: ${e.message}` : (e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section data-testid="brief-intake-form" className="space-y-4">
      {/* Top — tier + cadence */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
            Tier
          </span>
          <select
            data-testid="brief-tier-input"
            value={tier}
            onChange={(e) => setTier(Number(e.target.value) as NumericBriefTier)}
            className="w-full h-8 px-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px]"
          >
            <option value={1}>Tier 1 — full multi-channel</option>
            <option value={2}>Tier 2 — tactical / problem</option>
            <option value={3}>Tier 3 — small jobs</option>
          </select>
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
            Document delivered at
          </span>
          <Input
            type="datetime-local"
            data-testid="brief-document-delivered-at"
            value={documentDeliveredAt}
            onChange={(e) => setDocumentDeliveredAt(e.target.value)}
          />
        </label>
        <label className="block">
          <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
            Verbal briefing at
          </span>
          <Input
            type="datetime-local"
            data-testid="brief-verbal-briefing-at"
            value={verbalBriefingAt}
            onChange={(e) => setVerbalBriefingAt(e.target.value)}
          />
        </label>
      </div>

      {/* Validation warnings */}
      {warnings.length > 0 && (
        <ul
          data-testid="brief-warnings"
          className="space-y-1.5"
          aria-live="polite"
        >
          {warnings.map((w) => (
            <li
              key={w.code}
              data-testid={`brief-warning-${w.code}`}
              className="flex items-start gap-2 p-2 rounded-md border border-[var(--rag-amber)] bg-[var(--rag-amber-soft)] text-[var(--rag-amber-deep)] text-[12px]"
            >
              <AlertTriangle className="h-3.5 w-3.5 mt-0.5 flex-shrink-0" aria-hidden="true" />
              <span>{w.message}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Free-text fields */}
      <label className="block">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
          Objectives
        </span>
        <textarea
          data-testid="brief-objectives-input"
          value={objectives}
          onChange={(e) => setObjectives(e.target.value)}
          rows={3}
          className="w-full p-2 rounded border border-[var(--border-default)] bg-[var(--bg-surface)] text-[13px]"
        />
      </label>
      <label className="block">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
          Target audience
        </span>
        <Input
          data-testid="brief-target-audience-input"
          value={targetAudience}
          onChange={(e) => setTargetAudience(e.target.value)}
        />
      </label>
      <label className="block">
        <span className="block text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] mb-1">
          Deliverables (summary)
        </span>
        <Input
          data-testid="brief-deliverables-summary-input"
          value={deliverablesSummary}
          onChange={(e) => setDeliverablesSummary(e.target.value)}
        />
      </label>

      {/* Author contributions repeater */}
      <fieldset className="space-y-2 border border-[var(--border-default)] rounded-md p-3">
        <legend className="text-[11px] font-medium uppercase tracking-wide text-[var(--fg-tertiary)] px-1">
          Author contributions (co-authored brief)
        </legend>
        {contributions.length === 0 ? (
          <p className="text-[12px] text-[var(--fg-tertiary)] italic">
            No contributions recorded — add at least one client and one agency entry to clear the co-authorship warning.
          </p>
        ) : (
          <ul className="space-y-2">
            {contributions.map((c) => (
              <li
                key={c.id}
                data-testid={`brief-contribution-${c.id}`}
                className="rounded border border-[var(--border-default)] bg-[var(--bg-sunken)] p-2 space-y-1.5"
              >
                <header className="flex items-center justify-between gap-2">
                  <span
                    className={cn(
                      'text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded',
                      c.principalKind === 'agency'
                        ? 'bg-[var(--accent-soft)] text-[var(--accent)]'
                        : 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
                    )}
                  >
                    {c.principalKind}
                  </span>
                  <button
                    onClick={() => removeContribution(c.id)}
                    aria-label="Remove contribution"
                    data-testid={`brief-contribution-${c.id}-remove`}
                    className="text-[var(--fg-tertiary)] hover:text-[var(--rag-red)]"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </header>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    data-testid={`brief-contribution-${c.id}-ref`}
                    placeholder={c.principalKind === 'agency' ? 'staff user id' : 'client contact name / id'}
                    value={c.principalRef}
                    onChange={(e) => updateContribution(c.id, { principalRef: e.target.value })}
                  />
                  <Input
                    data-testid={`brief-contribution-${c.id}-role`}
                    placeholder={`role (e.g. ${CONTRIBUTION_ROLE_HINTS.join(', ')})`}
                    value={c.role}
                    onChange={(e) => updateContribution(c.id, { role: e.target.value })}
                    list="brief-contribution-roles"
                  />
                </div>
                <Input
                  data-testid={`brief-contribution-${c.id}-summary`}
                  placeholder="What did they contribute?"
                  value={c.contributionSummary}
                  onChange={(e) => updateContribution(c.id, { contributionSummary: e.target.value })}
                />
              </li>
            ))}
            <datalist id="brief-contribution-roles">
              {CONTRIBUTION_ROLE_HINTS.map((r) => <option key={r} value={r} />)}
            </datalist>
          </ul>
        )}
        <div className="flex items-center gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            data-testid="add-contribution-agency"
            onClick={() => addContribution('agency')}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" /> Agency contributor
          </Button>
          <Button
            size="sm"
            variant="outline"
            data-testid="add-contribution-client"
            onClick={() => addContribution('client')}
          >
            <Plus className="h-3.5 w-3.5 mr-1.5" aria-hidden="true" /> Client contributor
          </Button>
        </div>
      </fieldset>

      {/* Save */}
      <div className="flex items-center gap-3 pt-1">
        <Button
          size="sm"
          data-testid="brief-save-btn"
          disabled={busy}
          onClick={submit}
        >
          {busy ? 'Saving…' : 'Save brief'}
        </Button>
        {saved && (
          <span
            data-testid="brief-saved-banner"
            className="text-[12px] text-[var(--rag-green-deep)]"
          >
            Saved.
          </span>
        )}
        {err && (
          <span
            role="alert"
            data-testid="brief-save-error"
            className="text-[12px] text-[var(--rag-red)]"
          >
            {err}
          </span>
        )}
      </div>
    </section>
  );
}
