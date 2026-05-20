/**
 * StatusBadge
 * Legacy primitive — kept for API back-compat across ~57 consumers.
 * Now renders as a RAG-toned soft-bg pill using design-system tokens
 * (matches RagBadge styling without changing the import surface).
 */

import { cn } from '@/shared/lib/utils';

type StatusType =
  | 'draft'
  | 'pending'
  | 'approved'
  | 'rejected'
  | 'active'
  | 'completed'
  | 'cancelled'
  | 'on_hold'
  | 'in_progress'
  | 'submitted'
  | 'under_review';

type Tone = 'green' | 'amber' | 'red' | 'blue' | 'accent' | 'na';

interface StatusBadgeProps {
  status: StatusType | string;
  className?: string;
}

const TONE_VARS: Record<Tone, { bg: string; fg: string }> = {
  green:  { bg: 'var(--rag-green-soft)', fg: 'var(--rag-green)' },
  amber:  { bg: 'var(--rag-amber-soft)', fg: 'var(--rag-amber)' },
  red:    { bg: 'var(--rag-red-soft)',   fg: 'var(--rag-red)' },
  blue:   { bg: 'var(--rag-blue-soft)',  fg: 'var(--rag-blue)' },
  accent: { bg: 'var(--accent-soft)',    fg: 'var(--accent)' },
  na:     { bg: 'var(--bg-sunken)',      fg: 'var(--fg-secondary)' },
};

const STATUS_CONFIG: Record<StatusType, { label: string; tone: Tone }> = {
  draft:        { label: 'Draft',        tone: 'na' },
  pending:      { label: 'Pending',      tone: 'amber' },
  approved:     { label: 'Approved',     tone: 'green' },
  rejected:     { label: 'Rejected',     tone: 'red' },
  active:       { label: 'Active',       tone: 'blue' },
  completed:    { label: 'Completed',    tone: 'green' },
  cancelled:    { label: 'Cancelled',    tone: 'na' },
  on_hold:      { label: 'On Hold',      tone: 'amber' },
  in_progress:  { label: 'In Progress',  tone: 'blue' },
  submitted:    { label: 'Submitted',    tone: 'accent' },
  under_review: { label: 'Under Review', tone: 'accent' },
};

function humanize(s: string) {
  return s.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const cfg = STATUS_CONFIG[status as StatusType];
  const label = cfg?.label ?? humanize(status);
  const tone = cfg?.tone ?? 'na';
  const { bg, fg } = TONE_VARS[tone];
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full',
        'text-[11px] font-medium leading-tight whitespace-nowrap',
        className
      )}
      style={{ backgroundColor: bg, color: fg }}
    >
      <span
        className="h-1.5 w-1.5 rounded-full"
        style={{ backgroundColor: fg }}
        aria-hidden="true"
      />
      {label}
    </span>
  );
}
