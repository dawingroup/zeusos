import type { ContractStatus } from '../types/freelancer-contract.types';

const STATUS_STYLES: Record<ContractStatus, string> = {
  DRAFT:   'bg-[var(--bg-sunken)] text-muted-foreground',
  SIGNED:  'bg-[var(--rag-green-soft)] text-[var(--rag-green)]',
  EXPIRED: 'bg-[var(--rag-red-soft)] text-[var(--rag-red)]',
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
