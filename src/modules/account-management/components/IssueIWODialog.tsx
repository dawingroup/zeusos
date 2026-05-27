/**
 * IssueIWODialog — multi-step modal that issues an Internal Work Order
 * against a master job. Spec §7.1 (atomic 7-step construction) +
 * §9.1 (API) + §7.3 (handoff packet completeness).
 *
 * Steps:
 *   1. Pick subsidiary (one IWO targets one subsidiary).
 *   2. Set budget + transfer price (spec §8.3 — transfer pricing is
 *      governed; we just expose it as an explicit field for the AM to
 *      set, matching the standalone § Phase-3.B Cloud Function input).
 *   3. Fill the HandoffPacket: briefMd, milestones, acceptance criteria,
 *      comms_owner. Spec §7.3 validates all of these server-side.
 *
 * On submit the dialog calls `issueWorkOrder`. CEILING_EXCEEDED surfaces
 * with a "Request change order" CTA per task brief.
 */

import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { issueWorkOrderFn } from '@/modules/assignment/services/firebase';
import type { SubsidiaryId } from '@/core/settings/types';
import type { MasterJob } from '@/modules/assignment/types/master-job.types';
import type { IssueWorkOrderHandoffPacket } from '@/modules/assignment/services/firebase';
import { useAuth } from '@/shared/hooks';
import { applyMarkup, resolveIcMarkupPct, DEFAULT_IC_MARKUP_PCT } from '@/modules/billing/utils/ic-markup';
import { formatMinor, parseMajorToMinor } from '../utils/money';

const SUBSIDIARIES: { id: SubsidiaryId; label: string }[] = [
  { id: 'zeus-the-agency', label: 'Zeus The Agency' },
  { id: 'zeus-digital',    label: 'Zeus Digital' },
  { id: 'labyrinth',       label: 'Labyrinth' },
  { id: 'odd-gorilla',     label: 'Odd Gorilla' },
  { id: 'house-of-zeus',   label: 'House of Zeus' },
];

interface Props {
  masterJob: MasterJob;
  /** Headroom available right now: ceilingMinor - allocatedMinor. */
  headroomMinor: number;
  /** Path to the change-order new page (so CEILING_EXCEEDED has a CTA). */
  changeOrderHref?: string;
  onClose: () => void;
  onIssued: () => void;
}

interface MilestoneDraft { id: string; name: string; dueDate: string }
interface CriterionDraft { id: string; description: string; required: boolean }

export function IssueIWODialog({ masterJob, headroomMinor, changeOrderHref, onClose, onIssued }: Props) {
  const { user } = useAuth();
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [subsidiaryOrgId, setSubsidiaryOrgId] = useState<SubsidiaryId>(SUBSIDIARIES[0].id);
  const [budgetMajor, setBudgetMajor] = useState('');
  const [transferMajor, setTransferMajor] = useState('');
  const [briefMd, setBriefMd] = useState('');
  const [clientContextMd, setClientContextMd] = useState('');
  const [commsOwnerUserId, setCommsOwnerUserId] = useState(user?.uid ?? '');
  const [milestones, setMilestones] = useState<MilestoneDraft[]>([
    { id: 'm1', name: '', dueDate: '' },
  ]);
  const [criteria, setCriteria] = useState<CriterionDraft[]>([
    { id: 'c1', description: '', required: true },
  ]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ code?: string; message: string; details?: any } | null>(null);
  // Whether the AM has manually edited the transfer-price field — if so,
  // we stop auto-syncing it to budget × markup so we don't clobber.
  const [transferEdited, setTransferEdited] = useState(false);
  // Resolved IC markup pct for the selected receiving brand. Loaded
  // lazily once the subsidiary picker changes — ADR-2026-05-25 §2.Q3.
  const [icMarkupPct, setIcMarkupPct] = useState<number>(DEFAULT_IC_MARKUP_PCT);
  const navigate = useNavigate();

  const budgetMinor = useMemo(() => parseMajorToMinor(budgetMajor) || 0, [budgetMajor]);
  const transferMinor = useMemo(() => parseMajorToMinor(transferMajor) || 0, [transferMajor]);

  // ADR-2026-05-25 §2.Q3 — resolve the cost-plus markup for the chosen
  // receiving brand. Falls back to DEFAULT_IC_MARKUP_PCT if engine_config
  // isn't seeded or the org has no override.
  useEffect(() => {
    let cancelled = false;
    resolveIcMarkupPct(subsidiaryOrgId).then((pct) => {
      if (!cancelled) setIcMarkupPct(pct);
    });
    return () => { cancelled = true; };
  }, [subsidiaryOrgId]);

  // Auto-sync transfer = budget × (1 + markup/100) until the user
  // edits the transfer field directly. AMs can still override.
  useEffect(() => {
    if (transferEdited) return;
    if (!budgetMinor) {
      if (transferMajor !== '') setTransferMajor('');
      return;
    }
    const suggested = applyMarkup(budgetMinor, icMarkupPct);
    // Convert minor → major string for the input field.
    const suggestedMajor = (suggested / 100).toFixed(2);
    if (suggestedMajor !== transferMajor) setTransferMajor(suggestedMajor);
    // budgetMajor (string) is the input mirror; we sync via numeric budgetMinor.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [budgetMinor, icMarkupPct, transferEdited]);

  const projectedAllocated = (masterJob.allocatedMinor || 0) + budgetMinor;
  const wouldExceedCeiling = projectedAllocated > masterJob.ceilingMinor;

  const handleNextFromStep2 = () => {
    if (!budgetMinor || budgetMinor <= 0) return setError({ message: 'Budget must be a positive amount.' });
    if (!transferMinor || transferMinor <= 0) return setError({ message: 'Transfer price must be a positive amount.' });
    if (wouldExceedCeiling) {
      return setError({
        code: 'WOULD_EXCEED_CEILING',
        message: `Allocating ${formatMinor(budgetMinor, masterJob.currency)} would push the master job past its ${formatMinor(masterJob.ceilingMinor, masterJob.currency)} ceiling. File a change order first.`,
      });
    }
    setError(null);
    setStep(3);
  };

  const handleSubmit = async () => {
    setError(null);
    if (!briefMd.trim()) return setError({ message: 'Brief markdown is required.' });
    if (!commsOwnerUserId) return setError({ message: 'Comms owner user ID is required.' });
    if (!milestones.some(m => m.name.trim() && m.dueDate)) {
      return setError({ message: 'At least one named milestone with a due date is required.' });
    }
    if (!criteria.some(c => c.description.trim() && c.required)) {
      return setError({ message: 'At least one required acceptance criterion is needed.' });
    }
    const packet: IssueWorkOrderHandoffPacket = {
      briefMd: briefMd.trim(),
      milestones: milestones
        .filter(m => m.name.trim() && m.dueDate)
        .map(m => ({ id: m.id, name: m.name.trim(), dueDate: m.dueDate })),
      acceptanceCriteria: criteria
        .filter(c => c.description.trim())
        .map(c => ({ id: c.id, description: c.description.trim(), required: c.required })),
      clientContextMd: clientContextMd.trim() || undefined,
      commsOwnerUserId,
    };

    setBusy(true);
    try {
      await issueWorkOrderFn({
        masterJobId: masterJob.id,
        iwoInput: {
          subsidiaryOrgId,
          budgetMinor,
          transferPriceMinor: transferMinor,
          currency: masterJob.currency,
          handoffPacket: packet,
        },
      });
      onIssued();
    } catch (err: any) {
      const details = err?.details || {};
      if (details.code === 'CEILING_EXCEEDED' || /CEILING_EXCEEDED/.test(err?.message ?? '')) {
        setError({
          code: 'CEILING_EXCEEDED',
          message: err?.message || 'Ceiling exceeded.',
          details,
        });
      } else if (details.code === 'HANDOFF_PACKET_INCOMPLETE') {
        setError({
          code: 'HANDOFF_PACKET_INCOMPLETE',
          message: err?.message || 'Handoff packet incomplete.',
          details,
        });
      } else {
        setError({ message: err?.message || 'Issue failed.' });
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="w-full max-w-3xl rounded-lg bg-card shadow-xl">
        <header className="flex items-center justify-between border-b px-5 py-3">
          <h2 className="text-lg font-semibold">Issue Work Order · {masterJob.code}</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground">✕</button>
        </header>

        <div className="border-b px-5 py-2">
          <ol className="flex gap-3 text-xs">
            {(['1. Subsidiary', '2. Budget + transfer price', '3. Handoff packet'] as const).map((label, i) => {
              const n = (i + 1) as 1 | 2 | 3;
              const active = n === step;
              const done = n < step;
              return (
                <li key={label} className={`${active ? 'font-semibold text-[var(--rag-blue)]' : done ? 'text-muted-foreground' : 'text-[var(--fg-tertiary)]'}`}>
                  {label}
                </li>
              );
            })}
          </ol>
        </div>

        <div className="space-y-4 p-5">
          {step === 1 && (
            <div>
              <label className="block text-sm">
                <span className="block text-xs text-muted-foreground">Receiving subsidiary</span>
                <select
                  value={subsidiaryOrgId}
                  onChange={e => setSubsidiaryOrgId(e.target.value as SubsidiaryId)}
                  className="mt-1 w-full rounded border px-2 py-1"
                >
                  {SUBSIDIARIES.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
                </select>
              </label>
              <p className="mt-3 text-xs text-muted-foreground">
                One IWO targets exactly one subsidiary (spec §7.1). If multiple subsidiaries are doing
                slices of the same scope, issue one IWO each.
              </p>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3">
              <div className="rounded border bg-[var(--bg-sunken)] p-3 text-xs">
                <div>Current allocation: <strong>{formatMinor(masterJob.allocatedMinor, masterJob.currency)}</strong></div>
                <div>Headroom (ceiling − allocated): <strong>{formatMinor(headroomMinor, masterJob.currency)}</strong></div>
              </div>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <label className="block">
                  <span className="block text-xs text-muted-foreground">Budget (major units) *</span>
                  <input
                    value={budgetMajor}
                    onChange={e => setBudgetMajor(e.target.value)}
                    placeholder="e.g. 4800.00"
                    className="mt-1 w-full rounded border px-2 py-1 tabular-nums"
                  />
                </label>
                <label className="block">
                  <span className="block text-xs text-muted-foreground">
                    Transfer price (major units) *
                    <span className="ml-2 font-normal text-[10px] text-[var(--fg-tertiary)]">
                      auto: budget × (1 + {icMarkupPct}%)
                    </span>
                  </span>
                  <input
                    value={transferMajor}
                    onChange={e => { setTransferMajor(e.target.value); setTransferEdited(true); }}
                    placeholder="i/c price subsidiary charges the parent"
                    className="mt-1 w-full rounded border px-2 py-1 tabular-nums"
                    data-testid="iwo-transfer-price-input"
                  />
                  {transferEdited && (
                    <button
                      type="button"
                      onClick={() => { setTransferEdited(false); }}
                      data-testid="iwo-transfer-reset"
                      className="mt-1 text-[10px] text-[var(--accent)] hover:underline"
                    >
                      Reset to auto ({icMarkupPct}% markup)
                    </button>
                  )}
                </label>
              </div>
              {wouldExceedCeiling && budgetMinor > 0 && (
                <div className="rounded border border-[var(--rag-red)] bg-[var(--rag-red-soft)] p-3 text-xs text-[var(--rag-red)]">
                  Allocating <strong>{formatMinor(budgetMinor, masterJob.currency)}</strong> would push allocation to{' '}
                  <strong>{formatMinor(projectedAllocated, masterJob.currency)}</strong> — past the ceiling of{' '}
                  <strong>{formatMinor(masterJob.ceilingMinor, masterJob.currency)}</strong>. File a Change Order to raise the ceiling first.
                </div>
              )}
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3 text-sm">
              <label className="block">
                <span className="block text-xs text-muted-foreground">Brief (markdown) *</span>
                <textarea
                  value={briefMd}
                  onChange={e => setBriefMd(e.target.value)}
                  rows={5}
                  placeholder="What the subsidiary is being asked to deliver."
                  className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs"
                />
              </label>
              <label className="block">
                <span className="block text-xs text-muted-foreground">Client context (scrubbed of price / contract terms)</span>
                <textarea
                  value={clientContextMd}
                  onChange={e => setClientContextMd(e.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs"
                />
              </label>
              <label className="block">
                <span className="block text-xs text-muted-foreground">Comms owner (AM user id) *</span>
                <input
                  value={commsOwnerUserId}
                  onChange={e => setCommsOwnerUserId(e.target.value)}
                  className="mt-1 w-full rounded border px-2 py-1 font-mono text-xs"
                />
              </label>

              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Milestones *</h3>
                {milestones.map((m, i) => (
                  <div key={m.id} className="mb-1 flex gap-2">
                    <input
                      value={m.name}
                      onChange={e => setMilestones(ms => ms.map((mm, j) => j === i ? { ...mm, name: e.target.value } : mm))}
                      placeholder="Milestone name"
                      className="flex-1 rounded border px-2 py-1 text-sm"
                    />
                    <input
                      type="date"
                      value={m.dueDate}
                      onChange={e => setMilestones(ms => ms.map((mm, j) => j === i ? { ...mm, dueDate: e.target.value } : mm))}
                      className="rounded border px-2 py-1 text-sm"
                    />
                    {milestones.length > 1 && (
                      <button onClick={() => setMilestones(ms => ms.filter((_, j) => j !== i))} className="text-[var(--rag-red)]">✕</button>
                    )}
                  </div>
                ))}
                <button onClick={() => setMilestones(ms => [...ms, { id: `m${ms.length + 1}`, name: '', dueDate: '' }])}
                  className="text-xs text-[var(--rag-blue)] hover:underline">+ Add milestone</button>
              </div>

              <div>
                <h3 className="mb-1 text-xs font-semibold uppercase text-muted-foreground">Acceptance criteria (≥1 required) *</h3>
                {criteria.map((c, i) => (
                  <div key={c.id} className="mb-1 flex gap-2">
                    <input
                      value={c.description}
                      onChange={e => setCriteria(cs => cs.map((cc, j) => j === i ? { ...cc, description: e.target.value } : cc))}
                      placeholder="What constitutes acceptance for this criterion?"
                      className="flex-1 rounded border px-2 py-1 text-sm"
                    />
                    <label className="flex items-center gap-1 text-xs">
                      <input type="checkbox" checked={c.required}
                        onChange={e => setCriteria(cs => cs.map((cc, j) => j === i ? { ...cc, required: e.target.checked } : cc))} />
                      required
                    </label>
                    {criteria.length > 1 && (
                      <button onClick={() => setCriteria(cs => cs.filter((_, j) => j !== i))} className="text-[var(--rag-red)]">✕</button>
                    )}
                  </div>
                ))}
                <button onClick={() => setCriteria(cs => [...cs, { id: `c${cs.length + 1}`, description: '', required: true }])}
                  className="text-xs text-[var(--rag-blue)] hover:underline">+ Add criterion</button>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded border border-[var(--rag-red)] bg-[var(--rag-red-soft)] p-3 text-sm text-[var(--rag-red)]">
              <div className="font-medium">{error.code ?? 'Error'}</div>
              <div className="mt-1 text-xs">{error.message}</div>
              {error.code === 'CEILING_EXCEEDED' && changeOrderHref && (
                <button
                  onClick={() => navigate(changeOrderHref)}
                  className="mt-2 rounded bg-[var(--rag-amber)] px-3 py-1 text-xs font-medium text-white hover:bg-[var(--rag-amber)]"
                >
                  Request change order →
                </button>
              )}
            </div>
          )}
        </div>

        <footer className="flex justify-between border-t bg-[var(--bg-sunken)] px-5 py-3">
          <button onClick={onClose} className="rounded border px-3 py-1.5 text-sm hover:bg-card">Cancel</button>
          <div className="flex gap-2">
            {step > 1 && <button onClick={() => setStep((s) => (s - 1) as 1 | 2 | 3)} className="rounded border px-3 py-1.5 text-sm hover:bg-card">Back</button>}
            {step === 1 && <button onClick={() => setStep(2)} className="rounded bg-[var(--rag-blue)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--rag-blue)]">Next →</button>}
            {step === 2 && <button onClick={handleNextFromStep2} className="rounded bg-[var(--rag-blue)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--rag-blue)]">Next →</button>}
            {step === 3 && (
              <button onClick={handleSubmit} disabled={busy} className="rounded bg-[var(--rag-green)] px-3 py-1.5 text-sm font-medium text-white hover:bg-[var(--rag-green)] disabled:opacity-50">
                {busy ? 'Issuing…' : 'Issue IWO'}
              </button>
            )}
          </div>
        </footer>
      </div>
    </div>
  );
}

export default IssueIWODialog;
