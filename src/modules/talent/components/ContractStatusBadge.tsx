import type { ContractStatus } from '../types/freelancer-contract.types';

const STATUS_STYLES: Record<ContractStatus, string> = {
  DRAFT:   'bg-[var(--bg-sunken)] text-muted-foreground',
  SIGNED:  'bg-green-100 text-green-700',
  EXPIRED: 'bg-red-100 text-red-600',
};

interface Props {
  status: ContractStatus;
}

export function ContractStatusBadge({ status }: Props) {
  return (
    <span
      className={`inline-flex items-center rounded px-2 py-0.5 text-xs font-medium ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  );
}
