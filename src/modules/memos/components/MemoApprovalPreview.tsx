/**
 * "This memo will go to…" — the live answer before submitting:
 *   WHO   the route from the header — Through parties clear it in order, then
 *         the people it is addressed To decide it; the author, and names typed
 *         without a ZeusOS login, are left off
 *   TIER  the seniority its amount, impact and type call for (the same
 *         resolver the callable runs)
 */
import { useEffect, useMemo, useState } from 'react';
import { Banner } from '@/shared/components/data-display';
import { loadMemoRoutingConfig } from '../services/memoService';
import { describeMemoApproval, EMPTY_MEMO_ROUTING, resolveMemoApproval, type MemoApprovalInput, type MemoRoutingConfig } from '../utils/memoApproval';
import { describeRoute, planMemoRoute } from '../utils/memoRoute';
import { MEMO_CATEGORY_LABELS } from '../constants/memoTemplates';
import type { MemoCategory, MemoHeader } from '../types/memo';

interface Props {
  memo: MemoApprovalInput;
  header: Pick<MemoHeader, 'to' | 'through'>;
  authorUid: string;
  /** Injected in tests; loaded from systemSettings/approvalRouting otherwise. */
  config?: MemoRoutingConfig;
}

export function MemoApprovalPreview({ memo, header, authorUid, config: given }: Props) {
  const [loaded, setLoaded] = useState<MemoRoutingConfig | null>(given ?? null);
  useEffect(() => {
    if (given) return;
    let cancelled = false;
    loadMemoRoutingConfig().then((c) => { if (!cancelled) setLoaded(c); }).catch(() => { if (!cancelled) setLoaded(EMPTY_MEMO_ROUTING); });
    return () => { cancelled = true; };
  }, [given]);
  const config = loaded ?? EMPTY_MEMO_ROUTING;
  const resolution = useMemo(() => resolveMemoApproval(memo, config), [memo, config]);
  const plan = useMemo(() => planMemoRoute(header, authorUid), [header, authorUid]);

  const { route, skipped } = plan;
  const hasClearance = route.clearance.length > 0;
  const issuesNow = !resolution.required && !hasClearance;
  const ladderNote = resolution.bandEnabled
    ? null
    : `No amount ladder is configured for ${MEMO_CATEGORY_LABELS[(memo.category as MemoCategory) ?? 'operations'].toLowerCase()} memos; the tier comes from impact and memo type.`;

  const warnings: string[] = [];
  for (const s of skipped) {
    warnings.push(s.reason === 'author'
      ? `You are listed under ${s.list === 'to' ? 'To' : 'Through'} — you cannot ${s.list === 'to' ? 'decide' : 'clear'} your own memo, so you are left off the route.`
      : `“${s.name || 'A typed name'}” has no ZeusOS login, so it cannot receive the memo as a task.`);
  }
  if (resolution.required && route.source === 'role') {
    warnings.push(`Nobody under To can receive a task, so a decider is picked by role (${resolution.roleChain?.join(' → ')}) — never you.`);
  }
  if (resolution.currencyMismatch) warnings.push('The amount is in a different currency from the ladder; it is compared as entered, with no conversion.');

  return (
    <div className="space-y-2" data-testid="memo-route-preview">
      <Banner
        tone={issuesNow ? 'success' : 'info'}
        title={issuesNow ? 'Issued on submit' : describeRoute(route, resolution.required)}
        message={
          <span>
            {issuesNow
              ? 'It needs no decision and goes through nobody, so submitting numbers it and issues it to everyone in the header.'
              : resolution.required
                ? `Tier: ${describeMemoApproval(resolution)}.`
                : 'It needs no decision; once cleared it is issued to everyone in the header.'}
            {ladderNote ? ` ${ladderNote}` : ''}
          </span>
        }
      />
      {warnings.length > 0 && (
        <Banner tone="warning" title="Check the routing" message={<ul className="list-disc pl-4">{warnings.map((w) => <li key={w}>{w}</li>)}</ul>} />
      )}
    </div>
  );
}
