import type { LeadStage } from '../types/lead.types';

const STAGE_STYLES: Record<LeadStage, string> = {
  PROSPECT:  'bg-slate-100 text-slate-700',
  QUALIFIED: 'bg-amber-100 text-amber-800',
  PITCH:     'bg-sky-100 text-sky-800',
  WON:       'bg-emerald-100 text-emerald-800',
  LOST:      'bg-rose-100 text-rose-700',
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
