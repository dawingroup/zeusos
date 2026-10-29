/**
 * CoverageBanner — who has nothing to do, and what work has nobody to do it.
 *
 * The evening review shows a manager the plans that exist. This shows the two
 * gaps the plans themselves cannot: team members with no plan at all, and open
 * work sitting with no assignee. Deliberately not a one-click "spread the
 * backlog": assigning work is a decision.
 */

import { Inbox, Users } from 'lucide-react';

import { useUnassignedWork } from '../hooks/useUnassignedWork';
import type { TeamPlanRow } from '../hooks/useTeamPlans';
import { moduleLabelOf } from '../format';

export function CoverageBanner({ rows, loading }: { rows: TeamPlanRow[]; loading: boolean }) {
  const { summary, loading: loadingWork } = useUnassignedWork();

  if (loading) return null;

  const idle = rows.filter((r) => !r.plan);
  const hasGap = idle.length > 0 || summary.total > 0;
  if (!hasGap && !loadingWork) return null;

  return (
    <div
      className="rounded-[10px] px-4 py-3 space-y-2"
      style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}
      data-testid="coverage-banner"
    >
      <div className="text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--fg-tertiary)' }}>
        Coverage
      </div>

      {idle.length > 0 && (
        <div className="flex items-start gap-2 text-[12.5px]" data-testid="coverage-idle">
          <Users className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: 'var(--rag-amber)' }} />
          <span style={{ color: 'var(--fg-secondary)' }}>
            <strong style={{ color: 'var(--fg-primary)' }}>{idle.length} of {rows.length}</strong>{' '}
            have no plan, because they have no open tasks:{' '}
            {idle.slice(0, 5).map((r) => r.person.name).join(', ')}
            {idle.length > 5 ? ` and ${idle.length - 5} more` : ''}.
          </span>
        </div>
      )}

      {summary.total > 0 && (
        <div className="flex items-start gap-2 text-[12.5px]" data-testid="coverage-unassigned">
          <Inbox className="h-3.5 w-3.5 mt-0.5 shrink-0" style={{ color: 'var(--rag-blue)' }} />
          <span style={{ color: 'var(--fg-secondary)' }}>
            <strong style={{ color: 'var(--fg-primary)' }}>{summary.total} open {summary.total === 1 ? 'task has' : 'tasks have'}</strong> no
            owner yet, so {summary.total === 1 ? 'it' : 'they'} cannot reach a plan
            {summary.topSources.length > 0 && (
              <> — mostly {summary.topSources.slice(0, 2).map((s) => `${moduleLabelOf(s.sourceModule)} (${s.count})`).join(', ')}</>
            )}
            . The hygiene run places what it can every 30 minutes; the rest needs a manager.
          </span>
        </div>
      )}
    </div>
  );
}

export default CoverageBanner;
