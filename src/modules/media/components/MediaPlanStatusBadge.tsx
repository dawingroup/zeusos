import type { MediaPlanStatus } from '../types/media-plan.types';

const STATUS_STYLES: Record<MediaPlanStatus, string> = {
  DRAFT:  'bg-[var(--bg-sunken)] text-muted-foreground',
  ACTIVE: 'bg-[var(--rag-green-soft)] text-[var(--rag-green)]',
  CLOSED: 'bg-[var(--bg-sunken)] text-muted-foreground',
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
