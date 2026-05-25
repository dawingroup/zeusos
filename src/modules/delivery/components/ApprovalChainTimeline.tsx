/**
 * ApprovalChainTimeline — Phase 6.UI.D.2.
 *
 * Visual ladder rendered as a horizontal track of rungs (or vertical
 * on narrow viewports). The current rung is highlighted; granted rungs
 * are filled; rejected entries are flagged by a count of reject loops
 * (history entries with `action === 'REJECT'`).
 */

import { Check, X, Loader2 } from 'lucide-react';
import { cn } from '@/shared/lib/utils';
import type {
  ApprovalChain,
  ApprovalRung,
} from '@/modules/assignment/types/approval-chain.types';

interface Props {
  chain: ApprovalChain;
  /** Compact horizontal mode — for use inside an IWO card. */
  compact?: boolean;
}

const RUNG_LABEL: Record<ApprovalRung, string> = {
  DESIGNER: 'Designer',
  AD: 'AD',
  STUDIO_MGR: 'Studio Mgr',
  ACD: 'ACD',
  CD: 'CD',
  ECD: 'ECD',
};

function rungStatus(
  chain: ApprovalChain,
  rung: ApprovalRung,
): 'granted' | 'current' | 'pending' {
  const ladder = chain.ladder;
  const currentIdx = ladder.indexOf(chain.currentRung);
  const rungIdx = ladder.indexOf(rung);
  if (rungIdx < currentIdx) return 'granted';
  if (rungIdx === currentIdx) {
    if (chain.complete) return 'granted';
    return 'current';
  }
  return 'pending';
}

function countRejectLoops(chain: ApprovalChain): number {
  return chain.history.filter((e) => e.action === 'REJECT').length;
}

export function ApprovalChainTimeline({ chain, compact = false }: Props) {
  const rejects = countRejectLoops(chain);

  return (
    <div
      data-testid="approval-chain-timeline"
      className={cn('space-y-2', compact && 'space-y-1')}
    >
      <ol
        className={cn(
          'flex items-center gap-0',
          compact ? 'flex-wrap' : 'flex-wrap',
        )}
        aria-label="Approval ladder"
      >
        {chain.ladder.map((r, idx) => {
          const status = rungStatus(chain, r);
          const isLast = idx === chain.ladder.length - 1;
          return (
            <li
              key={r}
              data-testid={`ladder-rung-${r}`}
              data-status={status}
              className="flex items-center"
            >
              <div
                className={cn(
                  'inline-flex items-center gap-1.5 px-2 py-1 rounded-md border text-[12px]',
                  status === 'granted' &&
                    'bg-[var(--rag-green-soft)] border-[var(--rag-green)] text-[var(--rag-green-deep)]',
                  status === 'current' &&
                    'bg-[var(--accent-soft)] border-[var(--accent)] text-[var(--accent)] font-medium',
                  status === 'pending' &&
                    'bg-[var(--bg-sunken)] border-[var(--border-default)] text-[var(--fg-tertiary)]',
                )}
              >
                {status === 'granted' && <Check className="h-3 w-3" aria-hidden="true" />}
                {status === 'current' && !chain.complete && (
                  <Loader2 className="h-3 w-3 animate-pulse" aria-hidden="true" />
                )}
                <span>{RUNG_LABEL[r]}</span>
              </div>
              {!isLast && (
                <span
                  className={cn(
                    'inline-block w-3 h-px mx-1',
                    status === 'granted'
                      ? 'bg-[var(--rag-green)]'
                      : 'bg-[var(--border-default)]',
                  )}
                  aria-hidden="true"
                />
              )}
            </li>
          );
        })}
      </ol>
      {rejects > 0 && (
        <p
          data-testid="reject-loop-count"
          className="text-[11.5px] text-[var(--rag-amber-deep)]"
        >
          <X className="inline h-3 w-3 mr-0.5" aria-hidden="true" />
          {rejects} reject {rejects === 1 ? 'loop' : 'loops'} in this chain
        </p>
      )}
    </div>
  );
}
