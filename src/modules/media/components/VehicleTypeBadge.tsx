import type { MediaVehicleType } from '../types/media-buy.types';

const TYPE_STYLES: Record<MediaVehicleType, string> = {
  TV:           'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
  RADIO:        'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
  PRINT:        'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
  OOH:          'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
  DIGITAL:      'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
  SOCIAL:       'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
  SEARCH:       'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
  PROGRAMMATIC: 'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
};

interface Props {
  type: MediaVehicleType;
}

export function VehicleTypeBadge({ type }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[type]}`}
    >
      {type}
    </span>
  );
}
