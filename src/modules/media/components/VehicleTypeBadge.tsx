import type { MediaVehicleType } from '../types/media-buy.types';

const TYPE_STYLES: Record<MediaVehicleType, string> = {
  TV:           'bg-purple-100 text-purple-700',
  RADIO:        'bg-yellow-100 text-yellow-700',
  PRINT:        'bg-orange-100 text-orange-700',
  OOH:          'bg-red-100 text-red-700',
  DIGITAL:      'bg-blue-100 text-blue-700',
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
