import type { TalentType } from '../types/talent-profile.types';

const TYPE_STYLES: Record<TalentType, string> = {
  STAFF:      'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
  FREELANCER: 'bg-[var(--rag-amber-soft)] text-[var(--rag-amber)]',
  INFLUENCER: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
  MODEL:      'bg-[var(--rag-blue-soft)] text-[var(--rag-blue)]',
};

const TYPE_LABEL: Record<TalentType, string> = {
  STAFF:      'Staff',
  FREELANCER: 'Freelancer',
  INFLUENCER: 'Influencer',
  MODEL:      'Model',
};

interface Props {
  type: TalentType;
}

export function TalentTypeBadge({ type }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${TYPE_STYLES[type]}`}
    >
      {TYPE_LABEL[type]}
    </span>
  );
}
