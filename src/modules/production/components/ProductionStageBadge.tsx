import type { ProductionStage } from '../types/production-job.types';

const STAGE_STYLES: Record<ProductionStage, string> = {
  BRIEF:            'bg-gray-100 text-gray-700',
  PRE_PRODUCTION:   'bg-yellow-100 text-yellow-700',
  TALENT_BOOKING:   'bg-orange-100 text-orange-700',
  LOCATION_LOCK:    'bg-amber-100 text-amber-700',
  EQUIPMENT:        'bg-lime-100 text-lime-700',
  SHOOT:            'bg-green-100 text-green-700',
  POST_PRODUCTION:  'bg-teal-100 text-teal-700',
  CLIENT_REVIEW:    'bg-blue-100 text-blue-700',
  MASTER_DELIVERY:  'bg-indigo-100 text-indigo-700',
  COMPLETE:         'bg-purple-100 text-purple-700',
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
