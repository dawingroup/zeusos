import type { TalentType } from '../types/talent-profile.types';

const TYPE_STYLES: Record<TalentType, string> = {
  STAFF:      'bg-blue-100 text-blue-700',
  FREELANCER: 'bg-orange-100 text-orange-700',
};

interface Props {
  type: TalentType;
}

export function TalentTypeBadge({ type }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[type]}`}
    >
      {type === 'STAFF' ? 'Staff' : 'Freelancer'}
    </span>
  );
}
