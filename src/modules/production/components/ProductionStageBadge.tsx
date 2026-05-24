import type { ProductionStage } from '../types/production-job.types';

const STAGE_STYLES: Record<ProductionStage, string> = {
  BRIEF:            'bg-[var(--bg-sunken)] text-muted-foreground',
  PRE_PRODUCTION:   'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
  TALENT_BOOKING:   'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
  LOCATION_LOCK:    'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
  EQUIPMENT:        'bg-lime-100 text-lime-700',
  SHOOT:            'bg-[var(--rag-green-soft)] text-[var(--rag-green)]',
  POST_PRODUCTION:  'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
  CLIENT_REVIEW:    'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
  MASTER_DELIVERY:  'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
  COMPLETE:         'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
};

const STAGE_LABEL: Record<ProductionStage, string> = {
  BRIEF:            'Brief',
  PRE_PRODUCTION:   'Pre-Production',
  TALENT_BOOKING:   'Talent Booking',
  LOCATION_LOCK:    'Location Lock',
  EQUIPMENT:        'Equipment',
  SHOOT:            'Shoot',
  POST_PRODUCTION:  'Post-Production',
  CLIENT_REVIEW:    'Client Review',
  MASTER_DELIVERY:  'Master Delivery',
  COMPLETE:         'Complete',
};

interface Props {
  stage: ProductionStage;
}

export function ProductionStageBadge({ stage }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STAGE_STYLES[stage]}`}
    >
      {STAGE_LABEL[stage]}
    </span>
  );
}
