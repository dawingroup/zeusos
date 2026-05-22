import type { MediaPlanStatus } from '../types/media-plan.types';

const STATUS_STYLES: Record<MediaPlanStatus, string> = {
  DRAFT:  'bg-gray-100 text-gray-700',
  ACTIVE: 'bg-green-100 text-green-700',
  CLOSED: 'bg-slate-100 text-slate-600',
};

const STATUS_LABEL: Record<MediaPlanStatus, string> = {
  DRAFT:  'Draft',
  ACTIVE: 'Active',
  CLOSED: 'Closed',
};

interface Props {
  status: MediaPlanStatus;
}

export function MediaPlanStatusBadge({ status }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {STATUS_LABEL[status]}
    </span>
  );
}
