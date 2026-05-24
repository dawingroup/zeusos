import type { LeadStage } from '../types/lead.types';

const STAGE_STYLES: Record<LeadStage, string> = {
  PROSPECT:  'bg-[var(--bg-sunken)] text-muted-foreground',
  QUALIFIED: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
  PITCH:     'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
  WON:       'bg-[var(--rag-green-soft)] text-[var(--rag-green)]',
  LOST:      'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
};

const STAGE_LABEL: Record<LeadStage, string> = {
  PROSPECT:  'Prospect',
  QUALIFIED: 'Qualified',
  PITCH:     'Pitching',
  WON:       'Won',
  LOST:      'Lost',
};

export function LeadStageBadge({ stage }: { stage: LeadStage }) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STAGE_STYLES[stage]}`}
    >
      {STAGE_LABEL[stage]}
    </span>
  );
}

export { STAGE_LABEL, STAGE_STYLES };
