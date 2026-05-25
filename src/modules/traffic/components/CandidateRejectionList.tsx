/**
 * Phase 6.UI.B — rejected-candidate breakdown for the routing
 * proposal card. Shows every brand the engine considered, the
 * rejection reason (capability / conflict / capacity), and the
 * `openIwoCount` so the AM can sanity-check the capacity signal.
 */

import { XCircle, CheckCircle2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import {
  HUMAN_REJECTION_REASON,
  type BrandCandidate,
  type CandidateRejectionReason,
} from '../types/traffic.types';

interface Props {
  candidates: BrandCandidate[];
  proposedBrandId: string | null;
}

function reasonLabel(reason: CandidateRejectionReason): string {
  if (reason === null) return 'Eligible';
  return HUMAN_REJECTION_REASON[reason];
}

export function CandidateRejectionList({ candidates, proposedBrandId }: Props) {
  return (
    <ul
      className="space-y-1.5 text-[12.5px]"
      data-testid="candidate-rejection-list"
    >
      {candidates.map((c) => {
        const isProposed = c.brandId === proposedBrandId;
        const isRejected = c.rejectionReason !== null;
        return (
          <li
            key={c.brandId}
            data-testid={`candidate-${c.brandId}`}
            className={cn(
              'flex items-center gap-2 px-2 py-1.5 rounded-md border',
              isProposed
                ? 'border-[var(--accent)] bg-[var(--accent-soft)]'
                : isRejected
                  ? 'border-[var(--border-default)] bg-[var(--bg-sunken)] opacity-75'
                  : 'border-[var(--border-default)] bg-[var(--bg-surface)]',
            )}
          >
            {isRejected ? (
              <XCircle className="h-3.5 w-3.5 text-[var(--rag-red)] flex-shrink-0" aria-hidden="true" />
            ) : (
              <CheckCircle2 className="h-3.5 w-3.5 text-[var(--rag-green)] flex-shrink-0" aria-hidden="true" />
            )}
            <span className="font-medium text-[var(--fg-primary)]">{c.brandId}</span>
            <span className="ml-auto flex items-center gap-2 text-[var(--fg-tertiary)]">
              <span>{c.openIwoCount} open</span>
              <span aria-hidden="true">·</span>
              <span
                data-testid={`candidate-${c.brandId}-reason`}
                className={isRejected ? 'text-[var(--rag-red)]' : 'text-[var(--rag-green)]'}
              >
                {reasonLabel(c.rejectionReason)}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}
