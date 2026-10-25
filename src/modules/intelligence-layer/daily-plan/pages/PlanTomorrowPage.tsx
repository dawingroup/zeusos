/**
 * /tasks/review — Plan Tomorrow, the manager's last task of the day.
 *
 * Every evening at 17:00 the system drafts a focus plan for each person with
 * open work and files one task in their manager's inbox pointing here. The
 * manager works down the team, shapes each plan, and marks it reviewed. At
 * 06:00 those plans publish and become what each person opens to.
 *
 * The left rail shows at a glance who is still unreviewed, the editor opens
 * on the first person who needs attention, and "Mark reviewed" moves to the
 * next. The Coverage banner shows the two gaps the plans cannot: people with
 * no plan, and work with nobody.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import { AlertTriangle, CalendarDays, CheckCircle2, ChevronRight, Clock, RefreshCw, Target, Users } from 'lucide-react';

import { Button } from '@/core/components/ui/button';
import { Input } from '@/core/components/ui/input';
import { Progress } from '@/core/components/ui/progress';
import { describeCallableError } from '@/shared/utils/callableError';
import { pushToast } from '@/shared/components/feedback/toastBus';
import { CoverageBanner } from '../components/CoverageBanner';
import { PlanEditor } from '../components/PlanEditor';
import { formatPlanDate, nextWorkingDay, previousWorkingDay } from '../format';
import { useTeamPlans } from '../hooks/useTeamPlans';
import { fetchPlan, markReviewed } from '../services/dailyPlanService';
import type { DailyPlan } from '../types';

export default function PlanTomorrowPage() {
  const [date, setDate] = useState(() => nextWorkingDay());
  const { rows, isFallback, isParentOrg, loading, error, total, reviewed, pending, reload, managerUid } = useTeamPlans(date);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [yesterday, setYesterday] = useState<DailyPlan | null>(null);
  const [bulkSaving, setBulkSaving] = useState(false);

  // Open on the first person who still needs attention.
  useEffect(() => {
    if (selectedId || loading) return;
    const firstUnreviewed = rows.find((r) => r.plan && !r.plan.reviewed);
    const firstWithPlan = rows.find((r) => r.plan);
    setSelectedId((firstUnreviewed || firstWithPlan || rows[0])?.person.id ?? null);
  }, [rows, loading, selectedId]);

  const selected = useMemo(() => rows.find((r) => r.person.id === selectedId) ?? null, [rows, selectedId]);

  useEffect(() => {
    let cancelled = false;
    const uid = selected?.plan?.assigneeUid || selected?.person.uid;
    if (!uid) {
      setYesterday(null);
      return;
    }
    fetchPlan(previousWorkingDay(date), uid)
      .then((p) => { if (!cancelled) setYesterday(p); })
      .catch(() => { if (!cancelled) setYesterday(null); });
    return () => { cancelled = true; };
  }, [selected?.plan?.assigneeUid, selected?.person.uid, date]);

  /** After a save, move to the next person still waiting. */
  const advance = useCallback(() => {
    const idx = rows.findIndex((r) => r.person.id === selectedId);
    const next = rows.slice(idx + 1).find((r) => r.plan && !r.plan.reviewed);
    if (next) setSelectedId(next.person.id);
  }, [rows, selectedId]);

  /** Accept every remaining draft as-is — a decision, labelled as one. */
  const confirmAll = async () => {
    setBulkSaving(true);
    try {
      const targets = rows.filter((r) => r.plan && !r.plan.reviewed);
      for (const row of targets) {
        try {
          await markReviewed(date, row.plan!.assigneeUid);
        } catch (err) {
          pushToast(`Couldn't mark ${row.person.name}'s plan reviewed: ${describeCallableError(err, 'review it')}`, { tone: 'error' });
        }
      }
    } finally {
      setBulkSaving(false);
    }
  };

  const pct = total > 0 ? Math.round((reviewed / total) * 100) : 0;

  if (!managerUid) {
    return (
      <div className="px-4 sm:px-6 lg:px-8 py-5" data-testid="plan-tomorrow-signed-out">
        <p className="text-[13px]" style={{ color: 'var(--fg-secondary)' }}>Sign in to review your team's plans.</p>
      </div>
    );
  }

  return (
    <div className="px-4 sm:px-6 lg:px-8 py-5 max-w-[1640px] mx-auto space-y-4" data-testid="plan-tomorrow-page">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0">
          <h1 className="text-[17px] font-semibold m-0" style={{ color: 'var(--fg-primary)' }}>Plan tomorrow</h1>
          <p className="text-[12.5px] mt-0.5 m-0" style={{ color: 'var(--fg-secondary)' }}>
            Review each person’s focus for {formatPlanDate(date)}. What you mark reviewed is what they open to at 06:00.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <CalendarDays className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 pointer-events-none" style={{ color: 'var(--fg-tertiary)' }} />
            <Input type="date" value={date} onChange={(e) => { setDate(e.target.value); setSelectedId(null); }} className="pl-8 h-8 w-[168px] text-[12.5px]" data-testid="plan-date" />
          </div>
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]" onClick={() => void reload()} disabled={loading}>
            <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </Button>
        </div>
      </div>

      <div className="rounded-[10px] px-4 py-3 flex items-center gap-4 flex-wrap" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" style={{ color: 'var(--accent)' }} />
          <span className="text-[13px] font-medium" style={{ color: 'var(--fg-primary)' }} data-testid="review-progress">{reviewed} of {total} reviewed</span>
        </div>
        <Progress value={pct} className="h-1.5 flex-1 min-w-[140px]" />
        {pending > 0 && (
          <Button variant="outline" size="sm" className="h-8 gap-1.5 text-[12px]" onClick={() => void confirmAll()} disabled={bulkSaving} title="Accept every remaining draft exactly as ranked" data-testid="accept-remaining">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {bulkSaving ? 'Confirming…' : `Accept ${pending} remaining as drafted`}
          </Button>
        )}
      </div>

      <CoverageBanner rows={rows} loading={loading} />

      {error && (
        <div className="rounded-[10px] px-3 py-2 flex items-start gap-2 text-[12.5px]" role="alert" style={{ backgroundColor: 'var(--rag-red-soft)', color: 'var(--rag-red)', border: '1px solid var(--rag-red)' }}>
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>The team's plans could not be loaded: {error.message}. Check your access and reload.</span>
        </div>
      )}

      {isFallback && !loading && rows.length > 0 && (
        <div className="rounded-[10px] px-3 py-2 flex items-start gap-2 text-[12.5px]" style={{ backgroundColor: 'var(--rag-amber-soft)', color: 'var(--rag-amber)', border: '1px solid var(--rag-amber)' }} data-testid="fallback-notice">
          <AlertTriangle className="h-4 w-4 mt-0.5 shrink-0" />
          <span>No one reports to you in the org chart, so this is showing all active staff{isParentOrg ? ' across the group' : ''}. Set reporting lines in HR to narrow it to your team.</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[300px_1fr] gap-4 items-start">
        <div className="rounded-[10px] overflow-hidden" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
          <div className="px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em]" style={{ color: 'var(--fg-tertiary)', borderBottom: '1px solid var(--border-default)' }}>
            {isParentOrg ? 'Everyone with a plan' : 'Your team'}
          </div>
          {loading ? (
            <div className="p-3 space-y-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-11 rounded animate-pulse" style={{ backgroundColor: 'var(--bg-sunken)' }} />)}</div>
          ) : rows.length === 0 ? (
            <p className="p-4 text-[12.5px] m-0" style={{ color: 'var(--fg-tertiary)' }} data-testid="team-empty">No team members found. Set <code>position.reportingTo</code> on their employee records to see them here.</p>
          ) : (
            <ul className="m-0 p-0 list-none divide-y" style={{ borderColor: 'var(--border-default)' }} data-testid="team-rail">
              {rows.map(({ person, plan }) => {
                const active = person.id === selectedId;
                const n = (plan?.items || []).length;
                return (
                  <li key={person.id}>
                    <button type="button" onClick={() => setSelectedId(person.id)} className="w-full text-left px-3 py-2.5 flex items-center gap-2.5 border-0 cursor-pointer" style={{ backgroundColor: active ? 'var(--bg-sunken)' : 'transparent' }} data-testid={`team-row-${person.id}`}>
                      <span className="h-2 w-2 rounded-full shrink-0" style={{ backgroundColor: !plan ? 'var(--fg-quaternary)' : plan.reviewed ? 'var(--rag-green)' : 'var(--rag-amber)' }} aria-hidden />
                      <span className="min-w-0 flex-1">
                        <span className="block text-[12.5px] font-medium truncate" style={{ color: 'var(--fg-primary)' }}>{person.name}</span>
                        <span className="block text-[11px]" style={{ color: 'var(--fg-tertiary)' }}>
                          {plan ? `${n} ${n === 1 ? 'item' : 'items'}${plan.reviewed ? ' · reviewed' : ' · needs review'}` : 'no plan drafted'}
                        </span>
                      </span>
                      {active && <ChevronRight className="h-3.5 w-3.5" style={{ color: 'var(--fg-tertiary)' }} />}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div>
          {!selected ? (
            <div className="rounded-[10px] py-16 text-center" style={{ backgroundColor: 'var(--bg-surface)', border: '1px solid var(--border-default)' }}>
              <Target className="h-10 w-10 mx-auto mb-3" style={{ color: 'var(--fg-quaternary)' }} />
              <p className="text-[13.5px] font-medium m-0" style={{ color: 'var(--fg-primary)' }}>Pick someone to review</p>
            </div>
          ) : (
            <PlanEditor
              person={selected.person}
              plan={selected.plan}
              date={date}
              yesterday={yesterday}
              onSaved={advance}
              onPlanStarted={() => void reload()}
            />
          )}
        </div>
      </div>

      <p className="text-[11.5px] flex items-center gap-1.5 m-0" style={{ color: 'var(--fg-quaternary)' }}>
        <Clock className="h-3 w-3" /> Drafts are generated at 17:00 and published at 06:00, Africa/Nairobi.
      </p>
    </div>
  );
}
