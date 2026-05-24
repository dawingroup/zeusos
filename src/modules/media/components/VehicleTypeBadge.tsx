import type { MediaVehicleType } from '../types/media-buy.types';

const TYPE_STYLES: Record<MediaVehicleType, string> = {
  TV:           'bg-purple-100 text-purple-700',
  RADIO:        'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
  PRINT:        'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
  OOH:          'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
  DIGITAL:      'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
  SOCIAL:       'bg-cyan-100 text-cyan-700',
  SEARCH:       'bg-indigo-100 text-indigo-700',
  PROGRAMMATIC: 'bg-teal-100 text-teal-700',
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
