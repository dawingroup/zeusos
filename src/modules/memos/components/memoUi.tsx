/**
 * Small shared UI helpers for the Memos module.
 */
import { RagBadge, type RagTone } from '@/shared/components/data-display';
import { formatMinor } from '@/shared/utils/money';
import type { MemoImpact, MemoParty, MemoStatus, MemoType } from '../types/memo';
import { MEMO_IMPACT_LABELS, MEMO_STATUS_LABELS, MEMO_TYPE_LABELS } from '../constants/memoTemplates';

const STATUS_TONES: Record<MemoStatus, RagTone> = {
  draft: 'na',
  submitted: 'blue',
  approved: 'green',
  rejected: 'red',
  modified: 'amber',
  issued: 'green',
  superseded: 'na',
  withdrawn: 'na',
};

export function MemoStatusBadge({ status }: { status: MemoStatus }) {
  return <RagBadge tone={STATUS_TONES[status]}>{MEMO_STATUS_LABELS[status]}</RagBadge>;
}

const IMPACT_TONES: Record<MemoImpact, RagTone> = { low: 'na', medium: 'amber', high: 'red' };

export function MemoImpactBadge({ impact }: { impact: MemoImpact }) {
  return <RagBadge tone={IMPACT_TONES[impact]}>{MEMO_IMPACT_LABELS[impact]} impact</RagBadge>;
}

export function MemoTypeChip({ type }: { type: MemoType }) {
  return (
    <span className="inline-flex items-center rounded-full border px-2 py-0.5 text-xs" style={{ borderColor: 'var(--border-default)', color: 'var(--fg-secondary)' }}>
      {MEMO_TYPE_LABELS[type]}
    </span>
  );
}

/** "KES 180,000" or "—". */
export function formatMemoAmount(amountMinor: number | null | undefined, currency?: string | null): string {
  if (amountMinor === null || amountMinor === undefined || Number.isNaN(Number(amountMinor))) return '—';
  return formatMinor(Number(amountMinor), currency ?? undefined);
}

export function formatMemoDate(value: string | Date | undefined | null): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  if (!d || Number.isNaN(d.getTime())) return String(value);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function partyLabel(p: MemoParty): string {
  return p.title ? `${p.name}, ${p.title}` : p.name;
}

export function partiesLine(parties: MemoParty[]): string {
  return parties.length ? parties.map(partyLabel).join('; ') : '—';
}
